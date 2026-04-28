"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { isVideoUrl } from "@/components/app/templates/utils";

/**
 * Hook de export (PNG e PDF) — extraído da página legada. A página que usa
 * precisa montar os refs em `exportRefs.current[i]` apontando pro nó com
 * scale=1 (1080×1350) antes de chamar `exportPng()` / `exportPdf()`.
 *
 * @param totalSlides - quantos slides o carrossel tem
 * @param opts.showWatermark - true = usuário Free → injeta marca d'água
 *   discreta no último slide antes de capturar via toPng. false (padrão) =
 *   plano pago ou admin → export limpo.
 * @param opts.slideMediaUrls - URLs de imagem/vídeo de cada slide (pelo
 *   índice). Usado pra detectar slides com vídeo: nesses, o ZIP inclui o
 *   MP4 ORIGINAL em vez de PNG (que só capturaria o frame congelado).
 *   PDF/PNG individuais sempre exportam frame como PNG.
 * @param opts.getAuthHeaders - função que devolve os headers de auth do
 *   client (Bearer da sessão Supabase). Usado pra pré-buscar imagens de
 *   hosts não-CORS via /api/img-proxy e converter pra blob URL antes da
 *   captura toPng. Sem isso, slides com imagens de hosts random (Serper,
 *   notícias, blogs) ficam com canvas tainted e a captura falha — bug
 *   reportado em 28/04 quando user pediu .zip de carrossel de 16 slides
 *   e só veio 4 (os tweets text-only).
 */
export interface UseExportOpts {
  showWatermark?: boolean;
  slideMediaUrls?: string[];
  getAuthHeaders?: () => HeadersInit;
}

/** Hosts que servem CORS público — não precisam ir pelo proxy. Espelha
 *  PUBLIC_CORS_HOSTS de components/app/templates/utils.ts pra evitar
 *  importação cross-package (utils.ts não exporta esse helper). */
const EXPORT_PUBLIC_CORS_HOSTS = [
  "supabase.co",
  "supabase.in",
  "cdninstagram.com",
  "fbcdn.net",
  "pbs.twimg.com",
  "twimg.com",
  "licdn.com",
  "googleusercontent.com",
  "ytimg.com",
  "unsplash.com",
  "images.unsplash.com",
];

function isPublicCorsHostExport(host: string): boolean {
  const h = host.toLowerCase();
  return EXPORT_PUBLIC_CORS_HOSTS.some(
    (suffix) => h === suffix || h.endsWith(`.${suffix}`)
  );
}

/**
 * Pré-busca imagens de hosts não-CORS via /api/img-proxy (com Bearer)
 * e converte pra blob URL same-origin. Substitui src dos `<img>` dentro
 * dos refs. Devolve lista de blob URLs criadas pra revoke depois.
 *
 * Isso é a chave pra .zip de 16 slides exportar 16 (e não 4) — quando
 * Serper devolve imagens de news/blog/stock sites sem CORS, `<img
 * crossOrigin="anonymous">` cai em fail load OU canvas-tainted, e a
 * `toPng` joga exception. Trocando pra blob: URL same-origin, o canvas
 * captura limpo.
 */
async function prefetchImagesAsBlobs(
  refs: { current: (HTMLDivElement | null)[] },
  count: number,
  getAuthHeaders?: () => HeadersInit,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  if (typeof window === "undefined") return [];

  // Mapa: src ORIGINAL no DOM (pode ser /api/img-proxy?url=... OU URL
  // cross-origin direta) → URL externa real (decodificada). Necessário
  // porque o template já reescreve hosts não-CORS pra /api/img-proxy
  // quando exportMode=true (em components/app/templates/utils.ts:38-62),
  // e nosso match no DOM precisa do src ORIGINAL como chave.
  const externalUrlBySrc = new Map<string, string>();

  // Coleta URLs únicas que precisam de prefetch via proxy autenticado.
  // Bug 28/04 (causa raiz do "4/16 slides exportados"): o ramo
  // `src.startsWith("/")` pulava /api/img-proxy?url=... — exatamente o
  // formato que o template já tinha reescrito. Resultado: prefetcher não
  // rodava pras URLs que precisavam, e html-to-image internamente fetchava
  // /api/img-proxy SEM Bearer → 401 → text/plain virava data URL → onerror
  // → toPng rejeita o slide inteiro.
  for (let i = 0; i < count; i++) {
    const el = refs.current[i];
    if (!el) continue;
    el.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;
      if (src.startsWith("blob:") || src.startsWith("data:")) return;

      let externalUrl: string | null = null;

      // Caso A: src já é /api/img-proxy?url=<encoded>
      if (src.startsWith("/api/img-proxy")) {
        try {
          const proxyParsed = new URL(src, window.location.origin);
          externalUrl = proxyParsed.searchParams.get("url");
        } catch {
          return;
        }
      } else if (src.startsWith("/")) {
        // Outras URLs same-origin (não proxy) — passam direto pro toPng.
        return;
      } else {
        // Caso B: src é URL absoluta cross-origin. Verifica se host é
        // CORS-friendly (Supabase, Twitter CDN, etc) — se sim, deixa direto.
        try {
          const u = new URL(src);
          if (u.origin === window.location.origin) return;
          if (isPublicCorsHostExport(u.hostname)) return;
          externalUrl = src;
        } catch {
          return;
        }
      }

      if (!externalUrl) return;
      externalUrlBySrc.set(src, externalUrl);
    });
  }

  if (externalUrlBySrc.size === 0) return [];
  onProgress?.(`Pré-carregando ${externalUrlBySrc.size} imagem(ns)...`);

  const headers = getAuthHeaders?.() ?? {};
  const blobMap = new Map<string, string>();
  const createdBlobs: string[] = [];

  // Fetch único por src ORIGINAL — múltiplos slides com mesma URL
  // compartilham a chave do Map e fazem só 1 fetch.
  await Promise.all(
    Array.from(externalUrlBySrc.entries()).map(
      async ([originalSrc, externalUrl]) => {
        try {
          const proxyUrl = `/api/img-proxy?url=${encodeURIComponent(externalUrl)}`;
          const res = await fetch(proxyUrl, {
            headers,
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) {
            console.warn(
              `[export] prefetch HTTP ${res.status}: ${externalUrl}`
            );
            return;
          }
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          blobMap.set(originalSrc, blobUrl);
          createdBlobs.push(blobUrl);
        } catch (err) {
          console.warn("[export] prefetch failed:", externalUrl, err);
        }
      }
    )
  );

  // Substitui src no DOM (chave = src original do `<img>`, não a URL
  // externa decodificada).
  for (let i = 0; i < count; i++) {
    const el = refs.current[i];
    if (!el) continue;
    el.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;
      const blobUrl = blobMap.get(src);
      if (blobUrl) {
        img.setAttribute("src", blobUrl);
        // Remove crossOrigin pra blob URL — atributo não tem efeito em
        // same-origin e em alguns webkit força reload desnecessário.
        img.removeAttribute("crossorigin");
      }
    });
  }

  return createdBlobs;
}

async function waitForImagesInElement(el: HTMLElement): Promise<void> {
  const imgs = el.querySelectorAll("img");
  // BUG FIX: cross-origin images com CORS bloqueado as vezes nao disparam
  // 'load' nem 'error' de forma confiavel em webkit — export ficava preso
  // em "Preparando export..." infinito. Hard cap 3s por imagem: se nao
  // carregou nem deu erro em 3s, segue em frente. Imagem pode ficar em branco
  // mas pelo menos o export nao trava.
  const IMG_TIMEOUT_MS = 3000;
  await Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(done, IMG_TIMEOUT_MS);
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    )
  );
}

async function waitUntilRefsReady(
  count: number,
  refs: { current: (HTMLDivElement | null)[] },
  timeoutMs: number
): Promise<boolean> {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    let ok = true;
    for (let i = 0; i < count; i++) {
      if (!refs.current[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  return false;
}

export function useExport(
  totalSlides: number,
  optsOrShowWatermark: UseExportOpts | boolean = false
) {
  // Backwards-compat: assinatura antiga era useExport(total, showWatermark:bool).
  // Agora: useExport(total, { showWatermark, slideMediaUrls }). Aceitamos as 2.
  const opts: UseExportOpts =
    typeof optsOrShowWatermark === "boolean"
      ? { showWatermark: optsOrShowWatermark }
      : optsOrShowWatermark;
  const showWatermark = !!opts.showWatermark;
  const slideMediaUrls = opts.slideMediaUrls ?? [];
  const getAuthHeaders = opts.getAuthHeaders;

  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState("");

  // Placeholder transparente 1x1 — se uma imagem CORS taintada quebrar,
  // html-to-image substitui por este transparent pixel em vez de abortar
  // o canvas todo. Slide renderiza com imagem branca mas o export FUNCIONA.
  const PLACEHOLDER_1X1 =
    "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

  /**
   * Injeta elemento DOM de watermark no container do slide (apenas Free).
   * Retorna função cleanup que remove o elemento após captura.
   * Só aplica no último slide pra ser discreta — não polui todos os frames.
   */
  const injectWatermark = useCallback(
    (el: HTMLElement, isLastSlide: boolean): (() => void) => {
      if (!showWatermark || !isLastSlide) return () => {};
      const wm = document.createElement("div");
      wm.setAttribute("aria-hidden", "true");
      // Posição absoluta no canto inferior esquerdo do canvas 1080×1350
      Object.assign(wm.style, {
        position: "absolute",
        bottom: "18px",
        left: "20px",
        fontFamily: "monospace",
        fontSize: "13px",
        lineHeight: "1",
        color: "rgba(0,0,0,0.45)",
        letterSpacing: "0.04em",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        zIndex: "9999",
        mixBlendMode: "multiply",
      });
      wm.textContent = "sequenciaviral.com";
      // Container precisa ter position relative/absolute pra o absolute funcionar
      const prevPosition = el.style.position;
      if (!prevPosition || prevPosition === "static") {
        el.style.position = "relative";
      }
      el.appendChild(wm);
      return () => {
        try {
          el.removeChild(wm);
        } catch {
          /* elemento já removido */
        }
        if (!prevPosition || prevPosition === "static") {
          el.style.position = prevPosition;
        }
      };
    },
    [showWatermark]
  );

  const captureSlideAsPng = useCallback(
    async (index: number): Promise<string> => {
      const el = exportRefs.current[index];
      if (!el) throw new Error(`Export slide ref ${index} not found`);
      // Injeta watermark no último slide (plano Free); cleanup remove após captura
      const isLastSlide = index === totalSlides - 1;
      const cleanupWatermark = injectWatermark(el, isLastSlide);
      try {
        return await toPng(el, {
          width: 1080,
          height: 1350,
          pixelRatio: 1,
          cacheBust: true,
          // Chave pra evitar 'nenhum slide capturado': quando imagem CORS
          // falha, usa placeholder em vez de taintar canvas.
          imagePlaceholder: PLACEHOLDER_1X1,
          // Failsafe contra rejeição em cascata: se UMA imagem dispara
          // onerror dentro do html-to-image (ex: prefetch falhou + proxy
          // 401 + data URL text/plain), o handler resolve em vez de
          // rejeitar a Promise inteira do `embedImages`. Slide é capturado
          // sem a imagem que falhou (placeholder 1x1 toma o lugar) — bem
          // melhor que slide ausente do .zip.
          onImageErrorHandler: (...args: unknown[]) => {
            console.warn(
              `[export] image error handled in slide ${index + 1}:`,
              args[0]
            );
          },
          skipFonts: false,
        });
      } catch (err) {
        console.error(`[export] toPng slide ${index + 1} failed:`, err);
        throw err;
      } finally {
        // Garante remoção da watermark DOM mesmo se toPng falhar
        cleanupWatermark();
      }
    },
    [totalSlides, injectWatermark]
  );

  // Lista de blob URLs criadas durante prefetch — guardamos pra revoke
  // depois que TODAS as capturas terminarem. Revoke prematuro durante a
  // captura (ex: dentro do loop) pode invalidar a img antes do toPng do
  // próximo slide ler ela em batch.
  const blobUrlsRef = useRef<string[]>([]);

  const cleanupBlobs = useCallback(() => {
    for (const u of blobUrlsRef.current) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    }
    blobUrlsRef.current = [];
  }, []);

  const waitRender = useCallback(async () => {
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );
    const ok = await waitUntilRefsReady(totalSlides, exportRefs, 8000);
    if (!ok) {
      throw new Error(
        "Slides de export não renderizaram a tempo. Recarregue e tente de novo."
      );
    }
    // Aguarda todas as fontes carregarem (Bebas Neue, Inter Black, etc).
    // Fonte não carregada = title renderiza em fallback system font = visual errado.
    if (typeof document !== "undefined" && "fonts" in document) {
      try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } })
          .fonts?.ready;
      } catch {
        /* best-effort */
      }
    }
    await Promise.all(
      exportRefs.current.slice(0, totalSlides).map(async (node) => {
        if (node) await waitForImagesInElement(node);
      })
    );
    // Pré-busca imagens de hosts não-CORS via /api/img-proxy autenticado
    // e troca src pra blob URL same-origin. Sem isso, toPng falha em
    // slides com imagens de Serper/news/blog (canvas tainted).
    blobUrlsRef.current = await prefetchImagesAsBlobs(
      exportRefs,
      totalSlides,
      getAuthHeaders,
      setProgress
    );
    // Aguarda os <img> com src trocado pra blob: dispararem load.
    await Promise.all(
      exportRefs.current.slice(0, totalSlides).map(async (node) => {
        if (node) await waitForImagesInElement(node);
      })
    );
    // Settle 500ms (antes 50ms) — container off-screen com opacity:0 demora
    // pra pintar em webkit. Sem esse delay, toPng captura state pre-layout e
    // 4/8 slides falham aleatoriamente.
    await new Promise((r) => setTimeout(r, 500));
  }, [totalSlides, getAuthHeaders]);

  const exportPng = useCallback(async () => {
    setIsExporting(true);
    setProgress("Preparando export...");
    try {
      await waitRender();
      let exported = 0;
      const failed: number[] = [];
      for (let i = 0; i < totalSlides; i++) {
        setProgress(`Exportando slide ${i + 1} de ${totalSlides}...`);
        try {
          const dataUrl = await captureSlideAsPng(i);
          const link = document.createElement("a");
          link.download = `slide-${String(i + 1).padStart(2, "0")}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          exported++;
          await new Promise((r) => setTimeout(r, 400));
        } catch (slideErr) {
          console.error(`[PNG] Falha slide ${i + 1}:`, slideErr);
          failed.push(i + 1);
        }
      }
      if (exported === 0) {
        toast.error("Nenhum slide capturado. Tente de novo.");
      } else if (failed.length > 0) {
        toast.error(
          `Só ${exported}/${totalSlides} slides exportaram. Faltaram: ${failed.join(", ")}. Recarregue e tente de novo.`
        );
      } else {
        toast.success(`${exported} slides exportados.`);
      }
    } catch (err) {
      console.error("Export PNG error:", err);
      toast.error(
        `Falha no export. ${err instanceof Error ? err.message : ""}`.trim()
      );
    } finally {
      cleanupBlobs();
      setProgress("");
      setIsExporting(false);
    }
  }, [totalSlides, waitRender, captureSlideAsPng, cleanupBlobs]);

  const exportPdf = useCallback(
    async (filename = "sequencia-viral-carrossel") => {
      setIsExporting(true);
      setProgress("Preparando PDF...");
      try {
        await waitRender();
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "px",
          format: [1080, 1350],
          compress: true,
        });
        let added = 0;
        for (let i = 0; i < totalSlides; i++) {
          setProgress(`Gerando PDF: slide ${i + 1}/${totalSlides}...`);
          try {
            const dataUrl = await captureSlideAsPng(i);
            if (added > 0) pdf.addPage([1080, 1350], "portrait");
            pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1350, undefined, "FAST");
            added++;
          } catch (slideErr) {
            console.warn(`[PDF] Falha slide ${i + 1}:`, slideErr);
          }
        }
        if (added === 0) {
          toast.error("Nenhum slide pra exportar.");
          return;
        }
        const arrayBuf = pdf.output("arraybuffer");
        const blob = new Blob([arrayBuf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 50)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`PDF com ${added} slides baixado.`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : typeof err === "string" ? err : "";
        console.error("Export PDF error:", err);
        toast.error(`Falha PDF. ${msg}`.trim());
      } finally {
        cleanupBlobs();
        setProgress("");
        setIsExporting(false);
      }
    },
    [totalSlides, waitRender, captureSlideAsPng, cleanupBlobs]
  );

  // Export .zip real: capta todos slides, empacota via JSZip e downloa 1 arquivo.
  // Antes, o botao 'Baixar .zip' chamava exportPng() que na verdade fazia
  // N downloads separados — confuso e lento. Agora e 1 .zip de verdade.
  const exportZip = useCallback(
    async (filename = "sequencia-viral-carrossel") => {
      setIsExporting(true);
      setProgress("Preparando .zip...");
      try {
        await waitRender();
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        let added = 0;
        const failed: number[] = [];
        for (let i = 0; i < totalSlides; i++) {
          const url = slideMediaUrls[i] ?? "";
          const isVideo = isVideoUrl(url);
          setProgress(
            `Gerando slide ${i + 1}/${totalSlides}${isVideo ? " (vídeo)" : ""}...`
          );

          // Slide com vídeo: baixa MP4 original e adiciona ao ZIP
          // mantendo o formato. PNG do frame congelado seria perda de
          // informação — user pediu explicitamente: "página que tem
          // vídeo sempre salva como mp4".
          if (isVideo) {
            try {
              const ext = url.toLowerCase().split("?")[0].split(".").pop() ?? "mp4";
              const safeExt = ["mp4", "webm", "mov", "m4v"].includes(ext)
                ? ext
                : "mp4";
              const res = await fetch(url, { mode: "cors" });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buf = await res.arrayBuffer();
              zip.file(
                `slide-${String(i + 1).padStart(2, "0")}.${safeExt}`,
                buf
              );
              added++;
            } catch (videoErr) {
              console.error(`[ZIP] Falha slide ${i + 1} (vídeo):`, videoErr);
              failed.push(i + 1);
            }
            continue;
          }

          // Slide com imagem: captura PNG do DOM render
          try {
            const dataUrl = await captureSlideAsPng(i);
            const base64 = dataUrl.split(",")[1] ?? "";
            if (base64) {
              zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, base64, {
                base64: true,
              });
              added++;
            } else {
              failed.push(i + 1);
            }
          } catch (slideErr) {
            console.error(`[ZIP] Falha slide ${i + 1}:`, slideErr);
            failed.push(i + 1);
          }
        }
        if (added === 0) {
          toast.error("Nenhum slide pra empacotar.");
          return;
        }
        if (failed.length > 0) {
          toast.error(
            `Só ${added}/${totalSlides} slides no .zip. Faltaram: ${failed.join(", ")}. Recarregue e tente de novo.`
          );
        }
        setProgress("Empacotando .zip...");
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 50)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`.zip com ${added} slides baixado.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        console.error("Export ZIP error:", err);
        toast.error(`Falha .zip. ${msg}`.trim());
      } finally {
        cleanupBlobs();
        setProgress("");
        setIsExporting(false);
      }
    },
    [totalSlides, waitRender, captureSlideAsPng, slideMediaUrls, cleanupBlobs]
  );

  return {
    exportRefs,
    exportPng,
    exportPdf,
    exportZip,
    isExporting,
    progress,
  };
}
