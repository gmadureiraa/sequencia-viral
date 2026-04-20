"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { useGenerate, type GenerationError } from "@/lib/create/use-generate";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Tela 01 — Nova criação. User escreve brief → persiste rascunho + já gera
 * o carrossel completo via /api/generate (puxa transcrição/scrape do link
 * se houver) → navega direto pra /templates com os slides reais.
 * O fluxo antigo passando por /concepts ainda existe via URL, mas não é
 * o padrão — Gabriel pediu pra ir direto do brief pro conteúdo pronto.
 */

type Tone = "editorial" | "informal" | "direto" | "provocativo";
type Lang = "pt-br" | "en";

const SHORTCUTS: { label: string; kicker: string; seed: string }[] = [
  {
    kicker: "Nº 01 · TUTORIAL",
    label: "Como fazer X",
    seed: "Como [ação específica] em [N passos / contexto]. Ex: como ganhar os primeiros 1.000 seguidores sem ads.",
  },
  {
    kicker: "Nº 02 · CASE",
    label: "Lições de um case",
    seed: "O que [marca/pessoa] fez para conseguir [resultado], e as lições aplicáveis ao seu negócio.",
  },
  {
    kicker: "Nº 03 · HOT TAKE",
    label: "Opinião forte",
    seed: "Por que [crença popular] está errada e o que você deveria fazer no lugar.",
  },
  {
    kicker: "Nº 04 · DADOS",
    label: "Dados surpreendentes",
    seed: "X dados que [público] não sabe sobre [tema] — e o que muda quando você entende.",
  },
  {
    kicker: "Nº 05 · MITOS",
    label: "Mitos vs verdades",
    seed: "N mitos sobre [tema] que ninguém questiona — e a verdade que contradiz cada um.",
  },
  {
    kicker: "Nº 06 · PROCESSO",
    label: "Explicador técnico",
    seed: "Como [processo/mecanismo] realmente funciona — passo a passo sem jargão.",
  },
  {
    kicker: "Nº 07 · YOUTUBE",
    label: "Resumir vídeo",
    seed: "Cole URL YouTube aqui — vou extrair a transcript e transformar em carrossel. https://youtube.com/watch?v=...",
  },
  {
    kicker: "Nº 08 · ARTIGO",
    label: "Resumir artigo/link",
    seed: "Cole um link — vou ler o conteúdo e virar carrossel editorial. https://...",
  },
  {
    kicker: "Nº 09 · POST",
    label: "Remixar post",
    seed: "Cole link de um post (X, LinkedIn, Instagram) — vou extrair e remixar no seu tom.",
  },
];

const TONE_OPTS: { id: Tone; label: string }[] = [
  { id: "editorial", label: "Editorial" },
  { id: "informal", label: "Informal" },
  { id: "direto", label: "Direto" },
  { id: "provocativo", label: "Provocativo" },
];
const LANG_OPTS: { id: Lang; label: string }[] = [
  { id: "pt-br", label: "PT-BR" },
  { id: "en", label: "EN" },
];

function OptCycler<T extends string | number>({
  label,
  value,
  options,
  onChange,
  formatter,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  formatter?: (v: T) => string;
}) {
  const idx = options.indexOf(value);
  const next = () => {
    const ni = (idx + 1) % options.length;
    onChange(options[ni]);
  };
  const display = formatter ? formatter(value) : String(value);
  return (
    <button
      type="button"
      onClick={next}
      className="flex items-center justify-between px-4 py-[14px] transition-all"
      style={{
        background: "var(--sv-white)",
        border: "1.5px solid var(--sv-ink)",
        boxShadow: "0 0 0 0 var(--sv-ink)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translate(-1px,-1px)";
        e.currentTarget.style.boxShadow = "3px 3px 0 0 var(--sv-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translate(0,0)";
        e.currentTarget.style.boxShadow = "0 0 0 0 var(--sv-ink)";
      }}
    >
      <span
        style={{
          fontFamily: "var(--sv-sans)",
          fontWeight: 600,
          fontSize: 13,
          color: "var(--sv-ink)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 9.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--sv-ink)",
          fontWeight: 700,
        }}
      >
        {display}
      </span>
    </button>
  );
}

export default function NewCarouselPage() {
  const router = useRouter();
  const { user, profile, session } = useAuth();
  const { generateCarousel, loadingCarousel } = useGenerate(session);

  const [idea, setIdea] = useState("");
  const [tone, setTone] = useState<Tone>("editorial");
  const [lang, setLang] = useState<Lang>("pt-br");
  const [submitting, setSubmitting] = useState(false);

  // Modo avançado — dá mais controle ao usuário sobre a geração.
  // Fica escondido atrás de um toggle pra não assustar usuário novo.
  const [advOpen, setAdvOpen] = useState(false);
  const [advHookDirection, setAdvHookDirection] = useState("");
  const [advCustomCta, setAdvCustomCta] = useState("");
  const [advExtraContext, setAdvExtraContext] = useState("");
  const [advNumSlides, setAdvNumSlides] = useState<number | "">("");
  const [advPreferredStyle, setAdvPreferredStyle] =
    useState<"" | "data" | "story" | "provocative">("");
  const [advUploadedUrls, setAdvUploadedUrls] = useState<string[]>([]);
  const [advUploading, setAdvUploading] = useState(false);
  const advFileInputRef = useRef<HTMLInputElement>(null);

  // Fase atual do progresso (usado no overlay pra dizer o que está rolando).
  const [phase, setPhase] = useState<
    "generating" | "images" | "finalizing" | null
  >(null);
  const [imagesProgress, setImagesProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // Countdown ETA enquanto /api/generate roda. Target 30s (geração texto +
  // batch de imagens em paralelo). Se terminar antes, ótimo.
  const ETA_TARGET_SEC = 30;
  const [etaElapsed, setEtaElapsed] = useState(0);
  const etaStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!submitting && !loadingCarousel) {
      etaStartedRef.current = null;
      setEtaElapsed(0);
      return;
    }
    etaStartedRef.current = etaStartedRef.current ?? Date.now();
    const t = window.setInterval(() => {
      if (!etaStartedRef.current) return;
      setEtaElapsed(Math.floor((Date.now() - etaStartedRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(t);
  }, [submitting, loadingCarousel]);
  const etaRemainingSec = Math.max(0, ETA_TARGET_SEC - etaElapsed);
  const etaPercent = Math.min(97, Math.round((etaElapsed / ETA_TARGET_SEC) * 100));

  const niche = useMemo(() => {
    const blob = (profile?.niche ?? []).join(" ").toLowerCase();
    if (blob.includes("cripto") || blob.includes("web3")) return "crypto";
    if (blob.includes("ia") || blob.includes("automa")) return "ai";
    if (blob.includes("market") || blob.includes("mkt")) return "marketing";
    return "business";
  }, [profile]);

  /**
   * Detecta se o texto tem URL e classifica o tipo pra o backend usar o
   * extractor certo (YouTube transcript, Instagram via Apify, scrape de
   * link). Se não tem URL, vai como "idea" (texto livre).
   */
  function detectSource(text: string): {
    sourceType: "idea" | "video" | "link" | "instagram";
    sourceUrl?: string;
  } {
    const urlMatch = text.match(/https?:\/\/[^\s)]+/i);
    if (!urlMatch) return { sourceType: "idea" };
    const url = urlMatch[0];
    const host = (() => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) {
      return { sourceType: "video", sourceUrl: url };
    }
    if (/(^|\.)instagram\.com$/.test(host)) {
      return { sourceType: "instagram", sourceUrl: url };
    }
    return { sourceType: "link", sourceUrl: url };
  }

  function explainGenError(err: unknown): string {
    if (!(err instanceof Error)) return "Erro inesperado ao gerar.";
    const e = err as GenerationError;
    if (e.code === "PLAN_LIMIT_REACHED" || e.status === 403) {
      return (
        e.message ||
        "Você atingiu o limite do plano. Faça upgrade pra seguir gerando."
      );
    }
    if (e.status === 429) {
      const wait = e.retryAfterSec ? ` Tenta em ~${e.retryAfterSec}s.` : "";
      return `Muitas gerações em pouco tempo.${wait}`;
    }
    if (e.status === 401) return "Sessão expirou. Faça login novamente.";
    if (e.status === 503) return "IA indisponível agora. Tenta em 10s.";
    if (e.status === 502) return "Modelo devolveu resposta inválida. Tenta de novo.";
    return e.message;
  }

  async function handleAdvancedUpload(files: FileList | null) {
    if (!files || files.length === 0 || !user || !supabase) return;
    if (advUploadedUrls.length + files.length > 8) {
      toast.error("Máximo de 8 imagens no modo avançado.");
      return;
    }
    setAdvUploading(true);
    try {
      const uploads = Array.from(files).map(async (file) => {
        if (!file.type.startsWith("image/")) {
          throw new Error(`"${file.name}" não é imagem.`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`"${file.name}" maior que 5MB.`);
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `user-uploads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase!.storage
          .from("carousel-images")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "31536000",
          });
        if (error) throw new Error(error.message);
        const { data: pub } = supabase!.storage
          .from("carousel-images")
          .getPublicUrl(path);
        return pub.publicUrl;
      });
      const urls = await Promise.all(uploads);
      setAdvUploadedUrls((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} imagem(ns) adicionada(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao subir imagem.");
    } finally {
      setAdvUploading(false);
      if (advFileInputRef.current) advFileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!idea.trim()) {
      toast.error("Escreva uma ideia antes de seguir.");
      return;
    }
    if (!user || !supabase) {
      toast.error("Faça login para criar um carrossel.");
      return;
    }
    setSubmitting(true);
    setPhase("generating");
    try {
      const { sourceType, sourceUrl } = detectSource(idea);

      // 1) Persiste draft vazio pra termos um id.
      const { row } = await upsertUserCarousel(supabase, user.id, {
        id: null,
        title: idea.slice(0, 80),
        slides: [],
        slideStyle: "white",
        status: "draft",
        variation: {
          title: idea.slice(0, 80),
          style: `${tone}|${lang}|${niche}`,
        },
      });

      // 2) Gera carrossel direto — passa o brief como topic + URL detectada.
      //    Se modo avançado tá aberto, passa overrides junto.
      const advanced =
        advOpen &&
        (advHookDirection.trim() ||
          advCustomCta.trim() ||
          advExtraContext.trim() ||
          advNumSlides !== "" ||
          advPreferredStyle !== "" ||
          advUploadedUrls.length > 0)
          ? {
              hookDirection: advHookDirection.trim() || undefined,
              customCta: advCustomCta.trim() || undefined,
              extraContext: advExtraContext.trim() || undefined,
              numSlides:
                advNumSlides !== ""
                  ? Math.min(12, Math.max(6, Number(advNumSlides)))
                  : undefined,
              preferredStyle: advPreferredStyle || undefined,
              uploadedImageUrls:
                advUploadedUrls.length > 0 ? advUploadedUrls : undefined,
            }
          : undefined;

      // Passa o briefing completo (até 4900 chars). O servidor aceita até
      // 5000. NÃO fatia em title/hook/angle diferentes — isso confundia a
      // IA a "parafrasear" em vez de respeitar o conteúdo.
      const fullIdea = idea.slice(0, 4900);
      const variations = await generateCarousel({
        concept: {
          title: idea.split("\n")[0].slice(0, 120) || idea.slice(0, 120),
          hook: "",
          angle: fullIdea,
          style: "story",
        },
        niche,
        tone,
        language: lang,
        sourceType,
        sourceUrl,
        advanced,
      });
      const chosen = variations[0];
      if (!chosen) throw new Error("IA não devolveu slides.");

      // 3) Busca imagens em paralelo pra cada slide. Search (Serper) em
      //    vez de generate (Imagen) pra não explodir latência — usuário
      //    pode trocar pra Imagen no editor depois.
      setPhase("images");
      setImagesProgress({ done: 0, total: chosen.slides.length });
      const slidesWithImages = await Promise.all(
        chosen.slides.map(async (slide, idx) => {
          // Se já veio imageUrl (modo avançado com upload), pula fetch.
          if (slide.imageUrl && typeof slide.imageUrl === "string") {
            setImagesProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
            return slide;
          }
          const query = (slide.imageQuery || slide.heading || "").slice(0, 300);
          if (!query.trim()) {
            setImagesProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
            return slide;
          }
          try {
            const res = await fetch("/api/images", {
              method: "POST",
              headers: jsonWithAuth(session),
              body: JSON.stringify({
                query,
                count: 1,
                mode: "search",
                niche,
                tone,
                designTemplate: "manifesto",
                peopleMode: "auto",
                contextHeading: slide.heading?.slice(0, 400) ?? "",
                contextBody: slide.body?.slice(0, 500) ?? "",
              }),
              signal: AbortSignal.timeout(12_000),
            });
            if (!res.ok) throw new Error(`images ${res.status}`);
            const data = (await res.json()) as {
              images?: Array<{ url?: string }>;
            };
            const url = data.images?.[0]?.url;
            setImagesProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
            return url ? { ...slide, imageUrl: url } : slide;
          } catch (e) {
            console.warn("[new] image fetch slide", idx, e);
            setImagesProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
            return slide;
          }
        })
      );

      // 4) Persiste slides com imagens.
      setPhase("finalizing");
      await upsertUserCarousel(supabase, user.id, {
        id: row.id,
        title: chosen.title || idea.slice(0, 80),
        slides: slidesWithImages,
        slideStyle: "white",
        status: "draft",
        variation: {
          title: chosen.title || idea.slice(0, 80),
          style: `${tone}|${lang}|${niche}`,
        },
      });

      router.push(`/app/create/${row.id}/templates`);
    } catch (err) {
      toast.error(explainGenError(err));
    } finally {
      setSubmitting(false);
      setPhase(null);
      setImagesProgress(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 680, minWidth: 0 }}
    >
      {/* eyebrow */}
      <span className="sv-eyebrow">
        <span className="sv-dot" /> Nº 01 · Brief · Novo carrossel
      </span>

      <h1
        className="sv-display mt-3"
        style={{
          fontSize: "clamp(26px, 3.6vw, 40px)",
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
        }}
      >
        Qual é a <em>ideia</em> do{" "}
        <span
          style={{
            background: "var(--sv-green)",
            padding: "0 8px",
            fontStyle: "italic",
          }}
        >
          carrossel
        </span>
        ?
      </h1>
      <p
        className="mt-1.5"
        style={{
          color: "var(--sv-muted)",
          fontSize: 13.5,
          lineHeight: 1.5,
          maxWidth: 520,
        }}
      >
        Escreve um tema, cola um link, joga um rascunho. Depois a IA monta
        cinco ângulos diferentes pra você escolher o caminho.
      </p>

      {/* Single column centralizada — sem painel lateral */}
      <div className="mt-5" style={{ minWidth: 0 }}>
        <div className="flex flex-col gap-4" style={{ minWidth: 0 }}>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Ex: A estratégia dos três zeros da Coca-Cola e por que ela redefine o mercado de bebidas..."
            style={{
              minHeight: 150,
              fontFamily: "var(--sv-sans)",
              fontSize: 15,
              lineHeight: 1.45,
              letterSpacing: "-0.005em",
              padding: 16,
              background: "var(--sv-white)",
              border: "1.5px solid var(--sv-ink)",
              outline: 0,
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
              fontWeight: 400,
              resize: "vertical",
              color: "var(--sv-ink)",
              width: "100%",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "5px 5px 0 0 var(--sv-green)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "3px 3px 0 0 var(--sv-ink)";
            }}
          />

          <div>
            <div
              className="mb-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Atalhos · clique pra preencher o prompt
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="text-left transition-all"
                  style={{
                    padding: "10px 12px",
                    border: "1.5px solid var(--sv-ink)",
                    background: "var(--sv-white)",
                    boxShadow: "0 0 0 0 var(--sv-ink)",
                  }}
                  onClick={() => setIdea(s.seed)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translate(-1px,-1px)";
                    e.currentTarget.style.boxShadow =
                      "3px 3px 0 0 var(--sv-ink)";
                    e.currentTarget.style.background = "var(--sv-green)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translate(0,0)";
                    e.currentTarget.style.boxShadow = "0 0 0 0 var(--sv-ink)";
                    e.currentTarget.style.background = "var(--sv-white)";
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--sv-mono)",
                      fontSize: 8.5,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--sv-muted)",
                    }}
                  >
                    {s.kicker}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--sv-sans)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--sv-ink)",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              className="mb-2.5"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Tom e idioma
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptCycler
                label="Tom"
                value={tone}
                options={TONE_OPTS.map((o) => o.id)}
                onChange={(v) => setTone(v)}
                formatter={(v) =>
                  TONE_OPTS.find((o) => o.id === v)?.label ?? String(v)
                }
              />
              <OptCycler
                label="Idioma"
                value={lang}
                options={LANG_OPTS.map((o) => o.id)}
                onChange={(v) => setLang(v)}
                formatter={(v) =>
                  LANG_OPTS.find((o) => o.id === v)?.label ?? String(v)
                }
              />
            </div>
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 9.5,
                color: "var(--sv-muted)",
                letterSpacing: "0.08em",
              }}
            >
              A IA decide a quantidade de slides e o CTA ideal pra cada ângulo.
            </p>
          </div>

          {/* ───── MODO AVANÇADO (collapsible) ───── */}
          <div>
            <button
              type="button"
              onClick={() => setAdvOpen((v) => !v)}
              className="flex w-full items-center justify-between transition-colors"
              style={{
                padding: "11px 14px",
                border: "1.5px solid var(--sv-ink)",
                background: advOpen ? "var(--sv-ink)" : "var(--sv-white)",
                color: advOpen ? "var(--sv-paper)" : "var(--sv-ink)",
                boxShadow: "3px 3px 0 0 var(--sv-ink)",
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: advOpen ? "var(--sv-green)" : "var(--sv-muted)",
                  }}
                />
                Modo avançado
              </span>
              <span style={{ fontSize: 14, lineHeight: 1 }}>
                {advOpen ? "−" : "+"}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {advOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    className="mt-3 flex flex-col gap-4"
                    style={{
                      padding: "16px",
                      border: "1.5px solid var(--sv-ink)",
                      background: "var(--sv-paper)",
                    }}
                  >
                    {/* Hook direction */}
                    <label className="flex flex-col gap-1.5">
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--sv-muted)",
                        }}
                      >
                        Gancho · direcionamento
                      </span>
                      <input
                        type="text"
                        value={advHookDirection}
                        onChange={(e) => setAdvHookDirection(e.target.value)}
                        maxLength={400}
                        placeholder="Ex: foca em founder B2B que já queimou dinheiro com ads"
                        style={{
                          padding: 10,
                          fontSize: 13,
                          fontFamily: "var(--sv-sans)",
                          border: "1.5px solid var(--sv-ink)",
                          background: "var(--sv-white)",
                          outline: 0,
                        }}
                      />
                    </label>

                    {/* Custom CTA */}
                    <label className="flex flex-col gap-1.5">
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--sv-muted)",
                        }}
                      >
                        CTA · texto ou intenção
                      </span>
                      <input
                        type="text"
                        value={advCustomCta}
                        onChange={(e) => setAdvCustomCta(e.target.value)}
                        maxLength={300}
                        placeholder="Ex: convida pro meu grupo no WhatsApp / baixe o template"
                        style={{
                          padding: 10,
                          fontSize: 13,
                          fontFamily: "var(--sv-sans)",
                          border: "1.5px solid var(--sv-ink)",
                          background: "var(--sv-white)",
                          outline: 0,
                        }}
                      />
                    </label>

                    {/* Num slides + style */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span
                          style={{
                            fontFamily: "var(--sv-mono)",
                            fontSize: 10,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--sv-muted)",
                          }}
                        >
                          Slides (6-12)
                        </span>
                        <input
                          type="number"
                          min={6}
                          max={12}
                          value={advNumSlides}
                          onChange={(e) =>
                            setAdvNumSlides(
                              e.target.value === "" ? "" : Number(e.target.value)
                            )
                          }
                          placeholder="Auto"
                          style={{
                            padding: 10,
                            fontSize: 13,
                            fontFamily: "var(--sv-sans)",
                            border: "1.5px solid var(--sv-ink)",
                            background: "var(--sv-white)",
                            outline: 0,
                          }}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span
                          style={{
                            fontFamily: "var(--sv-mono)",
                            fontSize: 10,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--sv-muted)",
                          }}
                        >
                          Travar estilo
                        </span>
                        <select
                          value={advPreferredStyle}
                          onChange={(e) =>
                            setAdvPreferredStyle(
                              e.target.value as
                                | ""
                                | "data"
                                | "story"
                                | "provocative"
                            )
                          }
                          style={{
                            padding: 10,
                            fontSize: 13,
                            fontFamily: "var(--sv-sans)",
                            border: "1.5px solid var(--sv-ink)",
                            background: "var(--sv-white)",
                            outline: 0,
                          }}
                        >
                          <option value="">Gerar as 3 variações</option>
                          <option value="data">Só data</option>
                          <option value="story">Só story</option>
                          <option value="provocative">Só provocative</option>
                        </select>
                      </label>
                    </div>

                    {/* Extra context */}
                    <label className="flex flex-col gap-1.5">
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--sv-muted)",
                        }}
                      >
                        Contexto extra · dados, quotes, cases
                      </span>
                      <textarea
                        value={advExtraContext}
                        onChange={(e) => setAdvExtraContext(e.target.value)}
                        maxLength={2000}
                        rows={4}
                        placeholder="Cola aqui dados, quotes, links, cases que você quer que a IA considere..."
                        style={{
                          padding: 10,
                          fontSize: 13,
                          fontFamily: "var(--sv-sans)",
                          border: "1.5px solid var(--sv-ink)",
                          background: "var(--sv-white)",
                          outline: 0,
                          resize: "vertical",
                          minHeight: 80,
                        }}
                      />
                    </label>

                    {/* Uploaded images */}
                    <div className="flex flex-col gap-2">
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--sv-muted)",
                        }}
                      >
                        Suas imagens (max 8)
                      </span>
                      {advUploadedUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {advUploadedUrls.map((url, i) => (
                            <div
                              key={url}
                              style={{
                                position: "relative",
                                width: 56,
                                height: 56,
                                border: "1.5px solid var(--sv-ink)",
                                background: "var(--sv-white)",
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Upload ${i + 1}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAdvUploadedUrls((prev) =>
                                    prev.filter((u) => u !== url)
                                  )
                                }
                                aria-label="Remover"
                                style={{
                                  position: "absolute",
                                  top: -8,
                                  right: -8,
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: "var(--sv-ink)",
                                  color: "var(--sv-paper)",
                                  border: 0,
                                  fontSize: 10,
                                  lineHeight: 1,
                                  cursor: "pointer",
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input
                        ref={advFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleAdvancedUpload(e.target.files)}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => advFileInputRef.current?.click()}
                        disabled={advUploading || advUploadedUrls.length >= 8}
                        className="self-start"
                        style={{
                          padding: "9px 14px",
                          border: "1.5px dashed var(--sv-ink)",
                          background: "var(--sv-white)",
                          fontFamily: "var(--sv-mono)",
                          fontSize: 10,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          cursor:
                            advUploading || advUploadedUrls.length >= 8
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            advUploading || advUploadedUrls.length >= 8
                              ? 0.5
                              : 1,
                        }}
                      >
                        {advUploading ? "Subindo..." : "+ Adicionar foto"}
                      </button>
                      <p
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 9,
                          color: "var(--sv-muted)",
                          letterSpacing: "0.1em",
                          marginTop: 2,
                        }}
                      >
                        As fotos entram na ordem (1ª foto → slide 1, 2ª → slide 2…).
                        Max 5MB cada.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            disabled={submitting || !idea.trim()}
            onClick={handleSubmit}
            className="sv-btn sv-btn-primary"
            style={{
              padding: "11px 18px",
              fontSize: 11,
              alignSelf: "flex-start",
              opacity: submitting || !idea.trim() ? 0.55 : 1,
              cursor: submitting || !idea.trim() ? "not-allowed" : "pointer",
            }}
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.3 5.8 22l2.4-8.1L2 9.4h7.6z" />
            </svg>
            {submitting ? "Gerando..." : "Gerar carrossel →"}
          </button>

          {/* Marcador de build — ajuda a distinguir do bundle antigo cacheado
              no browser. Se você não vê esse texto, force hard refresh. */}
          <div
            className="mt-4"
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 8.5,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
              opacity: 0.6,
            }}
          >
            v2 · build 2026-04-19b · fluxo direto (sem ângulos)
          </div>
        </div>
      </div>

      {/* Overlay ETA enquanto /api/generate roda (pode demorar 15-25s
           quando tem extração de link/vídeo + geração de slides). */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ background: "rgba(247, 245, 239, 0.94)" }}
            aria-live="polite"
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                padding: 28,
                background: "var(--sv-white)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "5px 5px 0 0 var(--sv-ink)",
              }}
            >
              <div
                className="uppercase"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.2em",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                {phase === "generating"
                  ? "Nº 01 · Escrevendo os slides"
                  : phase === "images"
                    ? "Nº 02 · Buscando imagens"
                    : "Nº 03 · Finalizando"}
              </div>
              <div
                style={{
                  fontFamily: "var(--sv-display)",
                  fontSize: 24,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "var(--sv-ink)",
                  marginBottom: 14,
                }}
              >
                {phase === "generating" ? (
                  <>
                    Lendo sua <em>referência</em> e escrevendo…
                  </>
                ) : phase === "images" ? (
                  <>
                    Buscando <em>imagens</em> pra cada slide…
                  </>
                ) : (
                  <>
                    Salvando <em>rascunho</em>…
                  </>
                )}
              </div>
              <p
                style={{
                  fontFamily: "var(--sv-sans)",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: "var(--sv-muted)",
                  marginBottom: 18,
                }}
              >
                {phase === "generating"
                  ? "Se você mandou link, estou extraindo o conteúdo. Depois gero 6-10 slides."
                  : phase === "images"
                    ? imagesProgress
                      ? `${imagesProgress.done}/${imagesProgress.total} slides com imagem. Rolando em paralelo.`
                      : "Buscando stock alinhado ao conteúdo de cada slide…"
                    : "Preparando o editor."}
              </p>
              <div
                style={{
                  height: 6,
                  background: "var(--sv-paper)",
                  border: "1.5px solid var(--sv-ink)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${etaPercent}%`,
                    background: "var(--sv-green)",
                    transition: "width .25s linear",
                  }}
                />
              </div>
              <div
                className="mt-3 flex items-center justify-between"
                style={{
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--sv-muted)",
                  fontWeight: 700,
                }}
              >
                <span>
                  <Loader2
                    size={11}
                    className="animate-spin inline-block mr-1.5 align-[-1px]"
                  />
                  {etaElapsed}s decorridos
                </span>
                <span>
                  {etaRemainingSec > 0
                    ? `~${etaRemainingSec}s restantes`
                    : "quase lá..."}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
