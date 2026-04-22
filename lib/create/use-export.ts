"use client";

import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

/**
 * Hook de export (PNG e PDF) — extraído da página legada. A página que usa
 * precisa montar os refs em `exportRefs.current[i]` apontando pro nó com
 * scale=1 (1080×1350) antes de chamar `exportPng()` / `exportPdf()`.
 */

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

export function useExport(totalSlides: number) {
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState("");

  const captureSlideAsPng = useCallback(
    async (index: number): Promise<string> => {
      const el = exportRefs.current[index];
      if (!el) throw new Error(`Export slide ref ${index} not found`);
      return toPng(el, {
        width: 1080,
        height: 1350,
        pixelRatio: 1,
        cacheBust: false,
      });
    },
    []
  );

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
    await Promise.all(
      exportRefs.current.slice(0, totalSlides).map(async (node) => {
        if (node) await waitForImagesInElement(node);
      })
    );
    await new Promise((r) => setTimeout(r, 50));
  }, [totalSlides]);

  const exportPng = useCallback(async () => {
    setIsExporting(true);
    setProgress("Preparando export...");
    try {
      await waitRender();
      let exported = 0;
      for (let i = 0; i < totalSlides; i++) {
        setProgress(`Exportando slide ${i + 1} de ${totalSlides}...`);
        try {
          const dataUrl = await captureSlideAsPng(i);
          const link = document.createElement("a");
          link.download = `slide-${i + 1}.png`;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          exported++;
          await new Promise((r) => setTimeout(r, 400));
        } catch (slideErr) {
          console.warn(`[PNG] Falha slide ${i + 1}:`, slideErr);
        }
      }
      if (exported === 0) {
        toast.error("Nenhum slide capturado. Tente de novo.");
      } else {
        toast.success(
          exported === 1 ? "1 slide exportado." : `${exported} slides exportados.`
        );
      }
    } catch (err) {
      console.error("Export PNG error:", err);
      toast.error(
        `Falha no export. ${err instanceof Error ? err.message : ""}`.trim()
      );
    } finally {
      setProgress("");
      setIsExporting(false);
    }
  }, [totalSlides, waitRender, captureSlideAsPng]);

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
        setProgress("");
        setIsExporting(false);
      }
    },
    [totalSlides, waitRender, captureSlideAsPng]
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
        for (let i = 0; i < totalSlides; i++) {
          setProgress(`Gerando slide ${i + 1}/${totalSlides}...`);
          try {
            const dataUrl = await captureSlideAsPng(i);
            // dataURL = "data:image/png;base64,..." — extrai base64
            const base64 = dataUrl.split(",")[1] ?? "";
            if (base64) {
              zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, base64, {
                base64: true,
              });
              added++;
            }
          } catch (slideErr) {
            console.warn(`[ZIP] Falha slide ${i + 1}:`, slideErr);
          }
        }
        if (added === 0) {
          toast.error("Nenhum slide pra empacotar.");
          return;
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
        setProgress("");
        setIsExporting(false);
      }
    },
    [totalSlides, waitRender, captureSlideAsPng]
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
