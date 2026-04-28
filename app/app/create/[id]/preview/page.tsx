"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { TemplateRenderer, type TemplateId } from "@/components/app/templates";
import { useAuth } from "@/lib/auth-context";
import { isAdminEmail } from "@/lib/admin-emails";
import { useDraft } from "@/lib/create/use-draft";
import { useExport } from "@/lib/create/use-export";
import { resolveVariant, resolveLayers } from "@/lib/create/render-defaults";
import { useCaption } from "@/lib/create/use-caption";
import { supabase } from "@/lib/supabase";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import CarouselFeedbackPanel from "@/components/app/carousel-feedback";
import FeedbackModal from "@/components/app/FeedbackModal";

// Mesmo injector que o edit usa — garante que a fonte display escolhida
// esteja disponível no momento do export PNG/PDF.
const DISPLAY_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Archivo+Black&family=Bebas+Neue&family=Instrument+Serif:ital@0;1&display=swap";

function useInjectDisplayFonts() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "sv-create-display-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = DISPLAY_FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

/** Injeta keyframe local pro shimmer do loader de legenda. Não mexe no globals.css. */
function useInjectCaptionShimmerKeyframe() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "sv-caption-shimmer-keyframe";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `@keyframes sv-caption-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
    document.head.appendChild(el);
  }, []);
}

/**
 * Tela 04 — Preview / Export. iPhone mockup com slides do rascunho,
 * controles de export PNG/PDF/Clipboard, legenda editável e agendamento stub.
 */

function buildPreviewProfile(profile: {
  name: string;
  twitter_handle?: string;
  instagram_handle?: string;
  avatar_url?: string;
} | null) {
  if (!profile) return { name: "Seu nome", handle: "@seuhandle", photoUrl: "" };
  const handle = profile.twitter_handle
    ? `@${profile.twitter_handle}`
    : profile.instagram_handle
      ? `@${profile.instagram_handle}`
      : "@seuhandle";
  return {
    name: profile.name || "Seu nome",
    handle,
    photoUrl: profile.avatar_url || "",
  };
}

export default function PreviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  useInjectDisplayFonts();
  useInjectCaptionShimmerKeyframe();
  const { id } = use(props.params);
  const router = useRouter();
  const { profile, session, user } = useAuth();
  const { draft, loading, error } = useDraft(id);

  // SNAPSHOT DO EDITOR (session): estratégia anti-race. Quando user vem de
  // /edit, o editor grava slides + overrides EXATOS em sessionStorage antes
  // de navegar. Preview usa esse snapshot como fonte de verdade PRINCIPAL,
  // independente do que o DB retornou. Se nao tem snapshot (user abriu /preview
  // direto), cai no draft do DB.
  const [snapshot, setSnapshot] = useState<null | {
    slides: NonNullable<typeof draft>["slides"];
    title: string;
    slideStyle: "white" | "dark";
    visualTemplate?: TemplateId;
    accentOverride?: string;
    displayFont?: string;
    textScale?: number;
  }>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`sv_preview_snapshot_${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.slides)) {
        setSnapshot(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  const slides = snapshot?.slides ?? draft?.slides ?? [];
  const templateId: TemplateId =
    snapshot?.visualTemplate ?? draft?.visualTemplate ?? "manifesto";
  const accentOverride = snapshot?.accentOverride ?? draft?.accentOverride;
  const displayFontOverride = snapshot?.displayFont ?? draft?.displayFont;
  const textScaleOverride =
    typeof snapshot?.textScale === "number"
      ? snapshot.textScale
      : typeof draft?.textScale === "number"
        ? draft.textScale
        : undefined;
  const previewProfile = useMemo(
    () =>
      buildPreviewProfile(
        profile
          ? {
              name: profile.name,
              twitter_handle: profile.twitter_handle,
              instagram_handle: profile.instagram_handle,
              avatar_url: profile.avatar_url,
            }
          : null
      ),
    [profile]
  );

  const [currentSlide, setCurrentSlide] = useState(0);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [captionMissingKey, setCaptionMissingKey] = useState(false);
  const [captionStale, setCaptionStale] = useState(false);

  // Modal de feedback pos-download. Abre 800ms depois de um export zip/pdf
  // bem-sucedido. Nao trava o download — so aparece depois que o browser
  // processou o save. Ver components/app/FeedbackModal.tsx.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  function scheduleFeedbackModal() {
    setTimeout(() => setFeedbackOpen(true), 800);
  }
  async function handleExportZip() {
    await exportZip(draft?.title || "carrossel");
    scheduleFeedbackModal();
  }
  async function handleExportPdf() {
    await exportPdf(draft?.title || "carrossel");
    scheduleFeedbackModal();
  }

  // Hash simples dos slides pra detectar quando legenda ficou desatualizada
  // (usuário voltou pro /edit e mudou texto). Guardado em localStorage porque
  // não queremos tocar no schema do draft só pra isso.
  const currentSlidesHash = useMemo(() => {
    if (!slides.length) return "";
    return slides
      .map((s) => `${(s.heading || "").trim()}|${(s.body || "").trim()}`)
      .join("||");
  }, [slides]);

  const hashStorageKey = draft ? `sv_caption_hash_${draft.id}` : null;

  const slideStyle =
    (snapshot?.slideStyle ?? draft?.style) === "dark" ? "dark" : "white";

  // Watermark: plano Free (ou ausente) recebe marca d'água discreta no export.
  // Planos pagos (pro, business) e admin exportam limpo.
  const showWatermark = (() => {
    if (isAdminEmail(profile?.email ?? user?.email)) return false;
    const plan = profile?.plan ?? "free";
    return plan === "free" || plan === "";
  })();

  // 28/04: passa slideMediaUrls pro hook saber quais têm vídeo. Slides
  // com URL de vídeo (.mp4/.webm/.mov) são exportados como MP4 original
  // no ZIP, em vez de captura PNG (que só pegaria o frame congelado).
  const slideMediaUrls = slides.map((s) => s.imageUrl ?? "");
  const { exportRefs, exportPng, exportPdf, exportZip, isExporting, progress } =
    useExport(slides.length, { showWatermark, slideMediaUrls });

  const {
    generate: generateCaption,
    loading: captionLoading,
    error: captionError,
  } = useCaption(session);

  // Hidrata legenda e hashtags salvos no draft quando ele carregar. Roda
  // apenas uma vez por draft.id — não depende de slides/hash pra não
  // re-hidratar sempre que o usuário edita.
  const hydratedDraftIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft) return;
    if (hydratedDraftIdRef.current === draft.id) return;
    hydratedDraftIdRef.current = draft.id;
    if (typeof draft.caption === "string" && draft.caption.trim()) {
      setCaption(draft.caption);
    }
    if (Array.isArray(draft.captionHashtags) && draft.captionHashtags.length > 0) {
      setHashtags(draft.captionHashtags);
    }
  }, [draft]);

  // Detecta legenda "stale": roda quando slides mudam ou draft muda. Se o
  // hash persistido no localStorage não bate com o hash atual dos slides,
  // a legenda foi gerada pra outro conjunto — exibe banner pra o usuário
  // decidir regenerar.
  useEffect(() => {
    if (!draft) return;
    if (!hashStorageKey || typeof window === "undefined") return;
    if (!draft.caption?.trim()) {
      setCaptionStale(false);
      return;
    }
    try {
      const saved = window.localStorage.getItem(hashStorageKey);
      if (saved && currentSlidesHash && saved !== currentSlidesHash) {
        setCaptionStale(true);
      } else {
        setCaptionStale(false);
      }
    } catch {
      /* storage bloqueado */
    }
  }, [draft, hashStorageKey, currentSlidesHash]);

  // Persiste legenda + hashtags no Supabase preservando todo o resto do draft.
  const persistCaption = useCallback(
    async (newCaption: string, newHashtags: string[]) => {
      if (!user || !draft || !supabase) return;
      try {
        await upsertUserCarousel(supabase, user.id, {
          id: draft.id,
          title: draft.title,
          slides: draft.slides,
          slideStyle: slideStyle,
          status: (draft.status as "draft" | "published" | "archived") ?? "draft",
          visualTemplate: draft.visualTemplate,
          accentOverride: draft.accentOverride,
          displayFont: draft.displayFont,
          textScale: draft.textScale,
          caption: newCaption,
          captionHashtags: newHashtags,
        });
      } catch (err) {
        console.warn("[preview] Falha ao salvar legenda:", err);
      }
    },
    [user, draft, slideStyle]
  );

  // Dispara geração automática ao abrir a página quando não há legenda salva.
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!draft) return;
    if (loading) return;
    if (draft.caption && draft.caption.trim()) return;
    if (slides.length === 0) return;
    autoTriggeredRef.current = true;
    void (async () => {
      try {
        const result = await generateCaption({
          slides: slides.map((s) => ({
            heading: s.heading ?? "",
            body: s.body ?? "",
          })),
          title: draft.title,
          niche: profile?.niche?.[0] || undefined,
          tone: profile?.tone || undefined,
          language: profile?.language || "pt-BR",
        });
        setCaption(result.caption);
        setHashtags(result.hashtags);
        void persistCaption(result.caption, result.hashtags);
        setCaptionStale(false);
        if (hashStorageKey && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(hashStorageKey, currentSlidesHash);
          } catch {
            /* storage bloqueado */
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/GEMINI_API_KEY|GEMINI_MISSING|não está configurada/i.test(msg)) {
          setCaptionMissingKey(true);
        }
      }
    })();
  }, [
    draft,
    loading,
    slides,
    profile,
    generateCaption,
    persistCaption,
    hashStorageKey,
    currentSlidesHash,
  ]);

  async function handleRegenerate() {
    if (!draft || slides.length === 0) return;
    try {
      const result = await generateCaption({
        slides: slides.map((s) => ({
          heading: s.heading ?? "",
          body: s.body ?? "",
        })),
        title: draft.title,
        niche: profile?.niche?.[0] || undefined,
        tone: profile?.tone || undefined,
        language: profile?.language || "pt-BR",
      });
      setCaption(result.caption);
      setHashtags(result.hashtags);
      void persistCaption(result.caption, result.hashtags);
      setCaptionStale(false);
      if (hashStorageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(hashStorageKey, currentSlidesHash);
        } catch {
          /* storage bloqueado */
        }
      }
      toast.success("Nova legenda gerada.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar legenda.";
      if (/GEMINI_API_KEY|GEMINI_MISSING|não está configurada/i.test(msg)) {
        setCaptionMissingKey(true);
      }
      toast.error(msg);
    }
  }

  // Debounce imperativo pra salvar caption editado manualmente (1500ms).
  // Usa ref + setTimeout ao invés de state + useEffect pra eliminar a
  // race condition entre setState batching e o effect que persiste.
  const captionSaveTimerRef = useRef<number | null>(null);
  function handleCaptionChange(value: string) {
    const trimmed = value.slice(0, 4000);
    setCaption(trimmed);
    if (captionSaveTimerRef.current !== null) {
      window.clearTimeout(captionSaveTimerRef.current);
    }
    captionSaveTimerRef.current = window.setTimeout(() => {
      captionSaveTimerRef.current = null;
      void persistCaption(trimmed, hashtags);
    }, 1500);
  }
  useEffect(() => {
    return () => {
      if (captionSaveTimerRef.current !== null) {
        window.clearTimeout(captionSaveTimerRef.current);
      }
    };
  }, []);

  function handleCopyHashtag(tag: string) {
    try {
      void navigator.clipboard.writeText(tag);
      toast.success(`Copiado ${tag}`);
    } catch {
      toast.error("Falha ao copiar.");
    }
  }

  async function handleCopyAll() {
    const tagsLine = hashtags.join(" ");
    const full = hashtags.length > 0 ? `${caption}\n\n${tagsLine}` : caption;
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Legenda + hashtags copiadas.");
    } catch {
      toast.error("Falha ao copiar.");
    }
  }

  async function handleClipboard() {
    const full = [
      ...slides.map((s, i) => `${i + 1}. ${s.heading}\n${s.body}`),
      "",
      caption,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Copiado para o clipboard.");
    } catch {
      toast.error("Falha ao copiar.");
    }
  }


  async function handleCopyCaptionForIG() {
    const tagsLine = hashtags.join(" ");
    const full = hashtags.length > 0 ? `${caption}\n\n${tagsLine}` : caption;
    try {
      await navigator.clipboard.writeText(full);
      toast.success("Legenda copiada. Cola no Instagram e anexa os PNGs exportados.");
    } catch {
      toast.error("Falha ao copiar.");
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <p
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          Carregando...
        </p>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "var(--sv-ink)" }}>{error ?? "Rascunho não encontrado."}</p>
      </div>
    );
  }

  const active = slides[currentSlide] ?? slides[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1200 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="sv-eyebrow">
          <span className="sv-dot" /> Pronto · {slides.length} slides · 4:5
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="sv-btn sv-btn-outline"
            style={{ padding: "7px 12px", fontSize: 9 }}
            onClick={() => router.push(`/app/create/${id}/edit`)}
          >
            ← Editar
          </button>
        </div>
      </div>

      <h1
        className="sv-display"
        style={{
          fontSize: "clamp(38px, 6vw, 56px)",
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
        }}
      >
        Preview no <em>Instagram</em>.
      </h1>
      <p
        className="mt-2"
        style={{
          color: "var(--sv-muted)",
          fontSize: 15,
          maxWidth: 560,
        }}
      >
        Veja como fica no feed antes de exportar. Você pode ajustar a legenda e
        agendar direto.
      </p>

      <div
        className="mt-6 grid gap-10 items-start"
        style={{ gridTemplateColumns: "1.1fr 1fr" }}
      >
        {/* LEFT: iPhone mockup */}
        <div className="flex flex-col items-center gap-4">
          <div
            style={{
              width: 320,
              aspectRatio: "9/19",
              background: "#111",
              borderRadius: 36,
              padding: 10,
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "6px 6px 0 0 var(--sv-ink)",
              position: "relative",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 18,
                left: "50%",
                transform: "translateX(-50%)",
                width: 80,
                height: 6,
                background: "#000",
                borderRadius: 10,
                zIndex: 5,
              }}
            />
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "var(--sv-white)",
                borderRadius: 28,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* IG bar */}
              <div
                className="flex items-center gap-2.5"
                style={{
                  padding: "44px 14px 10px",
                  borderBottom: "1px solid rgba(0,0,0,.08)",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg,#f09433,#dc2743,#bc1888)",
                    padding: 2,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background: "var(--sv-green)",
                      border: "1.5px solid var(--sv-ink)",
                    }}
                  />
                </div>
                <div
                  className="flex-1"
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {previewProfile.handle.replace(/^@/, "")}
                </div>
                <div style={{ fontSize: 18, letterSpacing: 4 }}>• • •</div>
              </div>

              {/* Post */}
              <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--sv-white)" }}>
                {active && (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TemplateRenderer
                      templateId={templateId}
                      heading={active.heading}
                      body={active.body}
                      imageUrl={active.imageUrl}
                      slideNumber={currentSlide + 1}
                      totalSlides={slides.length}
                      profile={previewProfile}
                      style={slideStyle}
                      scale={0.26}
                      showFooter={currentSlide === 0}
                      isLastSlide={currentSlide === slides.length - 1}
                      accentOverride={accentOverride}
                      displayFontOverride={displayFontOverride}
                      textScale={textScaleOverride}
                      // BUG FIX 28/04: defaults DEVEM ser idênticos ao editor —
                      // antes preview passava `active.variant` e `active.layers`
                      // crus, enquanto editor passava `?? "headline"` e
                      // `?? DEFAULT_LAYERS`. Quando slide vinha sem essas props,
                      // editor usava fallback e preview renderizava diferente.
                      variant={resolveVariant(active.variant)}
                      bgColor={active.bgColor}
                      layers={resolveLayers(active.layers)}
                    />
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 4,
                  }}
                >
                  {slides.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background:
                          i === currentSlide
                            ? "var(--sv-white)"
                            : "rgba(255,255,255,.4)",
                        border: "0.5px solid rgba(0,0,0,.2)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Action bar */}
              <div
                className="flex gap-3.5"
                style={{
                  padding: "10px 14px",
                  borderTop: "1px solid rgba(0,0,0,.08)",
                }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={1.8}>
                  <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
                </svg>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={1.8}>
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" />
                </svg>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={1.8}>
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                <div style={{ flex: 1 }} />
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={1.8}>
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </svg>
              </div>

              <div
                style={{
                  padding: "0 14px 16px",
                  fontFamily: "var(--sv-sans)",
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                <strong>{previewProfile.handle.replace(/^@/, "")}</strong>{" "}
                {caption.slice(0, 80) || "Adicione uma legenda..."}
              </div>
            </div>
          </div>

          {/* Nav circular */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() =>
                setCurrentSlide((i) => (i - 1 + slides.length) % slides.length)
              }
              style={{
                width: 36,
                height: 36,
                border: "1.5px solid var(--sv-ink)",
                borderRadius: "50%",
                background: "var(--sv-white)",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
                cursor: "pointer",
              }}
              aria-label="Slide anterior"
            >
              ←
            </button>
            <span
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Slide{" "}
              <strong>{String(currentSlide + 1).padStart(2, "0")}</strong> /{" "}
              {String(slides.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentSlide((i) => (i + 1) % slides.length)}
              style={{
                width: 36,
                height: 36,
                border: "1.5px solid var(--sv-ink)",
                borderRadius: "50%",
                background: "var(--sv-white)",
                boxShadow: "2px 2px 0 0 var(--sv-ink)",
                cursor: "pointer",
              }}
              aria-label="Próximo slide"
            >
              →
            </button>
          </div>
        </div>

        {/* RIGHT: 3 cards */}
        <div className="flex flex-col gap-4">
          {/* Exportar */}
          <div
            style={{
              padding: 22,
              background: "var(--sv-ink)",
              color: "var(--sv-paper)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "3px 3px 0 0 var(--sv-green)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-green)",
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              Nº 01 · Exportar
            </div>
            <h4
              className="sv-display"
              style={{ fontSize: 24, letterSpacing: "-0.01em", marginBottom: 16 }}
            >
              Escolha o <em>formato</em>.
            </h4>
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {[
                { label: "Baixar .zip", hi: true, onClick: () => void handleExportZip() },
                { label: `PNG × ${slides.length}`, onClick: () => void exportPng() },
                { label: "PDF", onClick: () => void handleExportPdf() },
                { label: "Copiar", onClick: () => void handleClipboard() },
              ].map((btn, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={btn.onClick}
                  disabled={isExporting}
                  style={{
                    padding: "11px 12px",
                    border: btn.hi
                      ? "1.5px solid var(--sv-ink)"
                      : "1.5px solid var(--sv-paper)",
                    background: btn.hi ? "var(--sv-green)" : "transparent",
                    color: btn.hi ? "var(--sv-ink)" : "var(--sv-paper)",
                    fontFamily: "var(--sv-mono)",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: isExporting ? "wait" : "pointer",
                    fontWeight: 700,
                    opacity: isExporting ? 0.6 : 1,
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            {progress && (
              <div
                className="mt-3"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(247,245,239,.7)",
                }}
              >
                {progress}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div
            style={{
              padding: 22,
              background: "var(--sv-white)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <label
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                  display: "block",
                }}
              >
                Nº 02 · Legenda
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={captionLoading || slides.length === 0}
                  className="sv-btn sv-btn-outline"
                  style={{
                    padding: "6px 10px",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    opacity: captionLoading ? 0.6 : 1,
                    cursor: captionLoading ? "wait" : "pointer",
                  }}
                  aria-label="Gerar nova legenda"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      marginRight: 6,
                      transition: "transform .4s",
                      transform: captionLoading
                        ? "rotate(360deg)"
                        : "rotate(0deg)",
                    }}
                  >
                    ↻
                  </span>
                  {captionLoading ? "Gerando..." : "Nova legenda"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyAll()}
                  disabled={!caption}
                  className="sv-btn sv-btn-outline"
                  style={{
                    padding: "6px 10px",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    opacity: caption ? 1 : 0.4,
                  }}
                >
                  Copiar tudo
                </button>
              </div>
            </div>

            {captionStale && !captionLoading && (
              <div
                className="mt-3 flex items-center justify-between gap-3"
                style={{
                  padding: "10px 12px",
                  background: "var(--sv-green)",
                  border: "1.5px solid var(--sv-ink)",
                  boxShadow: "3px 3px 0 0 var(--sv-ink)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--sv-sans)",
                    fontSize: 12,
                    color: "var(--sv-ink)",
                    fontWeight: 600,
                  }}
                >
                  ⚠︎ Slides mudaram. A legenda pode estar desatualizada.
                </span>
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={captionLoading}
                  className="sv-btn sv-btn-ink"
                  style={{
                    padding: "5px 10px",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    whiteSpace: "nowrap",
                  }}
                >
                  Atualizar →
                </button>
              </div>
            )}

            <div className="mt-3" style={{ position: "relative" }}>
              <textarea
                value={caption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                disabled={captionLoading}
                style={{
                  width: "100%",
                  minHeight: 180,
                  border: "1.5px solid var(--sv-ink)",
                  padding: 14,
                  fontFamily: "var(--sv-sans)",
                  fontSize: 13,
                  lineHeight: 1.55,
                  outline: 0,
                  resize: "vertical",
                  background: captionLoading
                    ? "var(--sv-paper)"
                    : "var(--sv-paper)",
                  color: "var(--sv-ink)",
                  opacity: captionLoading ? 0.5 : 1,
                }}
                placeholder={
                  captionMissingKey
                    ? "Configure GEMINI_API_KEY pra gerar automaticamente, ou escreva a legenda aqui."
                    : "Escrevendo legenda..."
                }
              />
              {captionLoading && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                      "linear-gradient(90deg, rgba(247,245,239,0) 0%, rgba(247,245,239,.6) 50%, rgba(247,245,239,0) 100%)",
                    backgroundSize: "200% 100%",
                    animation: "sv-caption-shimmer 1.4s linear infinite",
                  }}
                >
                  <em
                    style={{
                      fontFamily: "var(--sv-serif, ui-serif, Georgia, serif)",
                      fontStyle: "italic",
                      fontSize: 14,
                      color: "var(--sv-ink)",
                      background: "var(--sv-paper)",
                      padding: "4px 10px",
                      border: "1.5px solid var(--sv-ink)",
                    }}
                  >
                    Escrevendo legenda...
                  </em>
                </div>
              )}
            </div>

            <div
              className="mt-2 flex items-center justify-between"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                color: "var(--sv-muted)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              <span>{caption.length} / 4000</span>
              {captionError && !captionLoading && (
                <span style={{ color: "#b5230f" }}>
                  Erro: tente novamente.
                </span>
              )}
              {captionMissingKey && (
                <span>IA desativada · edite manualmente</span>
              )}
            </div>

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {hashtags.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleCopyHashtag(h)}
                    className="sv-chip"
                    style={{
                      padding: "4px 9px",
                      background: "var(--sv-paper)",
                      border: "1.5px solid var(--sv-ink)",
                      fontFamily: "var(--sv-mono)",
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "var(--sv-ink)",
                    }}
                    title={`Copiar ${h}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Publicar — fluxo manual honesto (Graph API ainda não conectada) */}
          <div
            style={{
              padding: 22,
              background: "var(--sv-white)",
              border: "1.5px solid var(--sv-ink)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
            }}
          >
            <label
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
                fontWeight: 700,
                display: "block",
                marginBottom: 4,
              }}
            >
              Nº 03 · Publicar
            </label>
            <p
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 12,
                color: "var(--sv-muted)",
                lineHeight: 1.45,
                marginBottom: 14,
              }}
            >
              Exporta os PNGs, copia a legenda daqui e sobe direto no Instagram
              ou LinkedIn.
            </p>
            <button
              type="button"
              onClick={() => void handleCopyCaptionForIG()}
              disabled={!caption}
              className="sv-btn sv-btn-ink"
              style={{
                width: "100%",
                opacity: caption ? 1 : 0.5,
                cursor: caption ? "pointer" : "not-allowed",
              }}
            >
              Copiar legenda + hashtags
            </button>
            <div
              className="mt-3"
              style={{
                padding: "8px 10px",
                border: "1px dashed var(--sv-ink)",
                background: "var(--sv-paper)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 8.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                }}
              >
                Em breve
              </div>
              <div
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontSize: 11,
                  color: "var(--sv-ink)",
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                Agendamento automático + publicação direta via Instagram Graph API.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback do carrossel — aparece só aqui (pos-finalizacao). Antes
          ficava no editor, mas atrapalhava o foco de edicao. */}
      {draft && user?.id && (
        <section
          className="mt-10"
          style={{
            padding: "20px 22px",
            border: "1.5px solid var(--sv-ink)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
            background: "var(--sv-white)",
          }}
        >
          <CarouselFeedbackPanel
            carouselId={draft.id}
            userId={user.id}
            supabase={supabase}
            initial={draft.feedback ?? null}
          />
        </section>
      )}

      {/* Modal de feedback pos-download. Abre 800ms depois do export zip/pdf
          completar. Manda o texto bruto pra /api/feedback/carousel que
          classifica e alimenta profile.brand_analysis.__generation_memory. */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        carouselId={draft?.id ?? null}
        session={session}
      />

      {/* Export render hidden container: 1080×1350 full scale.
           Mudança 2026-04-22: top:-99999/left:-99999/opacity:0 causava webkit
           não pintar o container → 4/8 slides capturados em branco pelo toPng.
           Agora container ainda invisivel ao user (pointer-events:none, opacity:0)
           mas dentro da viewport (top/left 0 + z-index baixo) — força paint. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          opacity: 0,
          zIndex: -1,
          overflow: "hidden",
          width: "1px",
          height: "1px",
        }}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            ref={(el: HTMLDivElement | null) => {
              exportRefs.current[i] = el;
            }}
          >
            <TemplateRenderer
              templateId={templateId}
              heading={s.heading}
              body={s.body}
              imageUrl={s.imageUrl}
              slideNumber={i + 1}
              totalSlides={slides.length}
              profile={previewProfile}
              style={slideStyle}
              scale={1}
              showFooter={i === 0}
              isLastSlide={i === slides.length - 1}
              exportMode
              accentOverride={accentOverride}
              displayFontOverride={displayFontOverride}
              textScale={textScaleOverride}
              // BUG FIX 2026-04-22 + 2026-04-28: variant, bgColor e layers
              // precisam dos MESMOS defaults do editor (?? "headline" e
              // ?? DEFAULT_LAYERS). Sem fallback, slide sem essas props
              // exportava como "default render" enquanto editor já tinha
              // aplicado os defaults visualmente — divergência silenciosa.
              variant={resolveVariant(s.variant)}
              bgColor={s.bgColor}
              layers={resolveLayers(s.layers)}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
