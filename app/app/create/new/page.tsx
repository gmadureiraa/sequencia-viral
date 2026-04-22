"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { useGenerate, type GenerationError } from "@/lib/create/use-generate";
import { DiscountPopup } from "@/components/app/discount-popup";
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
    kicker: "Nº 02 · HOT TAKE",
    label: "Opinião forte",
    seed: "Por que [crença popular] está errada e o que você deveria fazer no lugar.",
  },
  {
    kicker: "Nº 03 · YOUTUBE",
    label: "Resumir vídeo",
    seed: "Faça um carrossel com base nesse vídeo: https://youtube.com/watch?v=... (eu extraio a transcript).",
  },
  {
    kicker: "Nº 04 · REMIX",
    label: "Remixar carrossel",
    seed: "Use esse carrossel como referência mas foca em [ângulo novo]: https://www.instagram.com/p/...",
  },
  {
    kicker: "Nº 05 · CASE",
    label: "Lições de um case",
    seed: "O que [marca/pessoa] fez para conseguir [resultado], e as lições aplicáveis ao seu negócio.",
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
  const searchParams = useSearchParams();
  const { user, profile, session } = useAuth();
  const { generateCarousel, loadingCarousel } = useGenerate(session);

  const [idea, setIdea] = useState(() => searchParams?.get("idea") ?? "");

  useEffect(() => {
    // Se user clicou "Usar ideia" no dashboard, o card grava um briefing
    // completo na sessionStorage (title + hook + angle + style + theme).
    // Substitui a query string curta por um prompt rico, porque: a IA
    // produzia carrossel genérico com só o title no topic.
    try {
      const raw = sessionStorage.getItem("sv_active_idea");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          title?: string;
          hook?: string;
          angle?: string;
          style?: string;
          theme?: string;
          body?: string;
        };
        if (parsed.title) {
          const brief = [
            `Tema: ${parsed.title}`,
            parsed.theme ? `Nicho/contexto: ${parsed.theme}` : "",
            parsed.hook ? `Hook (abertura): ${parsed.hook}` : "",
            parsed.angle ? `Ângulo: ${parsed.angle}` : "",
            parsed.style ? `Estilo dominante: ${parsed.style}` : "",
            parsed.body && parsed.body !== parsed.angle
              ? `Direção: ${parsed.body}`
              : "",
            "",
            "Crie um carrossel de 6-8 slides que explore exatamente esse ângulo, usando linguagem simples (criança de 12 entende) e o tom do perfil.",
          ]
            .filter(Boolean)
            .join("\n");
          setIdea(brief);
          sessionStorage.removeItem("sv_active_idea");
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const q = searchParams?.get("idea");
    if (q && !idea) setIdea(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [tone, setTone] = useState<Tone>("editorial");
  const [lang, setLang] = useState<Lang>("pt-br");
  const [submitting, setSubmitting] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);

  // Modo de geração — decisão MAIS importante: IA escreve vs IA só formata.
  // Default writer (comportamento antigo). Layout-only = preserva wording.
  const [mode, setMode] = useState<"writer" | "layout-only">("writer");

  // Template visual escolhido antes de gerar — determina a lógica de imagem:
  // - twitter: busca stock (Serper)
  // - manifesto/futurista/autoral: gera imagem cinematográfica (Imagen)
  const [designTemplate, setDesignTemplate] = useState<
    "manifesto" | "twitter"
  >("manifesto");

  // Modo avançado — dá mais controle ao usuário sobre a geração.
  // Fica escondido atrás de um toggle pra não assustar usuário novo.
  const [advOpen, setAdvOpen] = useState(false);
  const [advHookDirection, setAdvHookDirection] = useState("");
  const [advCustomCta, setAdvCustomCta] = useState("");
  const [advExtraContext, setAdvExtraContext] = useState("");
  const [advNumSlides, setAdvNumSlides] = useState<number | "">("");
  // advPreferredStyle removido: era confuso porque duplicava o campo "tone" com
  // outro significado (data/story/provocative vs editorial/informal/direto...).
  // Manter tom único evita conflito.
  const [advUploadedUrls, setAdvUploadedUrls] = useState<string[]>([]);
  const [advUploading, setAdvUploading] = useState(false);
  const advFileInputRef = useRef<HTMLInputElement>(null);

  // Interview mode — IA faz 1-2 perguntas antes de gerar pra melhorar
  // qualidade do conteúdo. Opt-in dentro do Modo Avançado.
  const [advInterview, setAdvInterview] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewQs, setInterviewQs] = useState<
    { id: string; question: string; why: string; suggestedAnswer?: string }[]
  >([]);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  const [interviewOpen, setInterviewOpen] = useState(false);

  // Fase atual do progresso (usado no overlay pra dizer o que está rolando).
  const [phase, setPhase] = useState<
    "generating" | "images" | "finalizing" | null
  >(null);
  const [imagesProgress, setImagesProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // Countdown ETA enquanto /api/generate roda. Target 60s — capa
  // cinematográfica demora ~45s (2-pass: scene planning + Imagen 4).
  const ETA_TARGET_SEC = 60;
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
      // Dispara popup de desconto — é o momento natural pra oferecer upgrade.
      setShowLimitPopup(true);
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

  /**
   * Pré-handler: se interview mode está ligado, busca perguntas antes
   * de prosseguir. Usa sessionStorage pra herdar respostas entre retries.
   */
  async function maybeRunInterview(): Promise<boolean> {
    // retorna true se deve continuar direto (interview off ou já respondido)
    if (!advOpen || !advInterview) return true;
    // já respondeu nessa sessão?
    if (Object.keys(interviewAnswers).length > 0 && interviewQs.length > 0) {
      return true;
    }
    setInterviewLoading(true);
    try {
      const res = await fetch("/api/generate/interview", {
        method: "POST",
        headers: jsonWithAuth(session),
        body: JSON.stringify({
          topic: idea.slice(0, 4900),
          niche,
          tone,
          language: lang,
        }),
      });
      const data = (await res.json()) as {
        questions?: { id: string; question: string; why: string; suggestedAnswer?: string }[];
      };
      const qs = data.questions ?? [];
      if (qs.length === 0) {
        toast.info("Briefing já está específico — seguindo direto.");
        return true;
      }
      setInterviewQs(qs);
      setInterviewAnswers(
        Object.fromEntries(qs.map((q) => [q.id, ""]))
      );
      setInterviewOpen(true);
      return false; // espera user responder
    } catch (err) {
      console.warn("[interview] falhou, seguindo sem perguntas:", err);
      return true;
    } finally {
      setInterviewLoading(false);
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

    // Interview mode — se ligado e ainda não respondeu, para aqui e mostra modal.
    const proceed = await maybeRunInterview();
    if (!proceed) return;

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

      // Interview answers → injeta no extraContext (se houver).
      const interviewPack =
        interviewQs.length > 0
          ? interviewQs
              .map((q) => {
                const ans = (interviewAnswers[q.id] || "").trim();
                if (!ans) return null;
                return `Q: ${q.question}\nA: ${ans}`;
              })
              .filter(Boolean)
              .join("\n\n")
          : "";

      const mergedExtra = [advExtraContext.trim(), interviewPack]
        .filter(Boolean)
        .join("\n\n");

      // 2) Gera carrossel direto — passa o brief como topic + URL detectada.
      //    Se modo avançado tá aberto, passa overrides junto.
      const advanced =
        advOpen &&
        (advHookDirection.trim() ||
          advCustomCta.trim() ||
          mergedExtra ||
          advNumSlides !== "" ||
          advUploadedUrls.length > 0)
          ? {
              hookDirection: advHookDirection.trim() || undefined,
              customCta: advCustomCta.trim() || undefined,
              extraContext: mergedExtra || undefined,
              numSlides:
                advNumSlides !== ""
                  ? Math.min(12, Math.max(6, Number(advNumSlides)))
                  : undefined,
              uploadedImageUrls:
                advUploadedUrls.length > 0 ? advUploadedUrls : undefined,
            }
          : undefined;

      // Passa o briefing completo (até 4900 chars). O servidor aceita até
      // 5000. NÃO fatia em title/hook/angle diferentes — isso confundia a
      // IA a "parafrasear" em vez de respeitar o conteúdo.
      const fullIdea = idea.slice(0, 4900);
      const { variations, promptUsed } = await generateCarousel({
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
        designTemplate,
        advanced,
        mode,
      });
      const chosen = variations[0];
      if (!chosen) throw new Error("IA não devolveu slides.");

      // 3) Busca imagens em paralelo pra cada slide. Search (Serper) em
      //    vez de generate (Imagen) pra não explodir latência — usuário
      //    pode trocar pra Imagen no editor depois.
      setPhase("images");
      setImagesProgress({ done: 0, total: chosen.slides.length });
      // Lógica por template:
      // - twitter: busca stock (Serper) — imagens candid pra ficar como "post real"
      // - manifesto/futurista/autoral: gera cinematográfico (Imagen) na capa + headlines/photo
      //   variants; quote/cta sem imagem (são tipográficos); restante buscar stock
      //   editorial se não for cover.
      const imageMode: "search" | "generate" =
        designTemplate === "twitter" ? "search" : "generate";
      // Nota: server já injetou as imagens do usuário nos slides 0..N-1 (ordem
      // fornecida). Aqui só tratamos slides SEM imageUrl (precisam fetch).
      // Isso evita o bug de duplicar URLs entre slides que o server já cobriu
      // e o resto da sequência.
      const slidesWithImages = await Promise.all(
        chosen.slides.map(async (slide, idx) => {
          // Se já veio imageUrl (server injetou do upload do user), pula fetch.
          if (slide.imageUrl && typeof slide.imageUrl === "string") {
            setImagesProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
            return slide;
          }
          // Quote/cta em templates editoriais não precisam de imagem (são puramente tipográficos).
          const skipImage =
            imageMode === "generate" &&
            (slide.variant === "quote" || slide.variant === "cta");
          if (skipImage) {
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

          // Capa (idx 0) recebe reforço dramático/cinematográfico.
          const isCover = idx === 0;

          try {
            const res = await fetch("/api/images", {
              method: "POST",
              headers: jsonWithAuth(session),
              body: JSON.stringify({
                query,
                count: 1,
                mode: imageMode,
                niche,
                tone,
                designTemplate,
                peopleMode: "auto",
                contextHeading: slide.heading?.slice(0, 400) ?? "",
                contextBody: slide.body?.slice(0, 500) ?? "",
                // Flag extra pra /api/images reforçar o prompt do Imagen quando cover.
                isCover,
              }),
              // Imagen demora mais que Serper. Capa tem 2-pass (scene + imagen)
              // então timeout maior ainda — ~50s pra fluxo completo.
              signal: AbortSignal.timeout(
                imageMode === "generate"
                  ? isCover ? 75_000 : 45_000
                  : 12_000
              ),
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

      // 4) Persiste slides com imagens. Template já foi escolhido no briefing
      //    via designTemplate, então pula /templates e vai direto pro editor.
      //    Botão "Trocar template" no editor ainda permite reentrar em /templates.
      setPhase("finalizing");
      await upsertUserCarousel(supabase, user.id, {
        id: row.id,
        title: chosen.title || idea.slice(0, 80),
        slides: slidesWithImages,
        slideStyle: "white",
        status: "draft",
        visualTemplate: designTemplate,
        variation: {
          title: chosen.title || idea.slice(0, 80),
          style: `${tone}|${lang}|${niche}`,
        },
        promptUsed,
      });

      // Template já escolhido no briefing → pula /templates, vai direto pro editor.
      router.push(`/app/create/${row.id}/edit?template=${designTemplate}`);
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
      {/* Popup 30% off — mount only when user hit plan limit (PLAN_LIMIT_REACHED). */}
      {showLimitPopup && <DiscountPopup trigger="limit-reached" />}

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
          {/* ── TOGGLE WRITER / LAYOUT-ONLY (decisão principal) ── */}
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
              O que a IA deve fazer com o seu texto?
            </div>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {(
                [
                  {
                    id: "writer" as const,
                    title: "Escrever pra mim",
                    sub: "Uso seu briefing como inspiração, aplico hooks, escada, CTA.",
                  },
                  {
                    id: "layout-only" as const,
                    title: "Só aplicar meu texto",
                    sub: "Já escrevi. Você só quebra em slides — preserva wording, ordem, CTA.",
                  },
                ] as const
              ).map((opt) => {
                const selected = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(opt.id)}
                    className="text-left transition-all"
                    style={{
                      padding: "12px 14px",
                      border: "1.5px solid var(--sv-ink)",
                      background: selected
                        ? "var(--sv-ink)"
                        : "var(--sv-white)",
                      color: selected ? "var(--sv-paper)" : "var(--sv-ink)",
                      boxShadow: selected
                        ? "3px 3px 0 0 var(--sv-green)"
                        : "3px 3px 0 0 var(--sv-ink)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          border: `1.5px solid ${selected ? "var(--sv-green)" : "var(--sv-ink)"}`,
                          background: selected
                            ? "var(--sv-green)"
                            : "transparent",
                        }}
                      />
                      <div
                        style={{
                          fontFamily: "var(--sv-sans)",
                          fontSize: 13.5,
                          fontWeight: 700,
                        }}
                      >
                        {opt.title}
                      </div>
                    </div>
                    <div
                      className="mt-1"
                      style={{
                        fontFamily: "var(--sv-sans)",
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        opacity: selected ? 0.85 : 0.7,
                      }}
                    >
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SELETOR DE TEMPLATE VISUAL ── */}
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
              Template visual · define estética e tipo de imagem
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
              role="radiogroup"
            >
              {(
                [
                  {
                    // "manifesto" é o id interno; UX chama de "Futurista"
                    // (mood cinematográfico, caps, preto + imagem dramática).
                    id: "manifesto" as const,
                    name: "Futurista",
                    mood: "Editorial cinemático · caps dramático",
                    imageType: "IA cinematográfico",
                    accent: "#0A0A0A",
                  },
                  {
                    id: "twitter" as const,
                    name: "Thread (X)",
                    mood: "Tweet screenshot · candid",
                    imageType: "Busca stock",
                    accent: "#1D9BF0",
                  },
                ] as const
              ).map((tpl) => {
                const selected = designTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDesignTemplate(tpl.id)}
                    className="text-left transition-all"
                    style={{
                      padding: "10px 12px",
                      border: "1.5px solid var(--sv-ink)",
                      background: selected
                        ? "var(--sv-ink)"
                        : "var(--sv-white)",
                      color: selected ? "var(--sv-paper)" : "var(--sv-ink)",
                      boxShadow: selected
                        ? `3px 3px 0 0 ${tpl.accent}`
                        : "2px 2px 0 0 var(--sv-ink)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: tpl.accent,
                          border: `1.5px solid ${selected ? "var(--sv-paper)" : "var(--sv-ink)"}`,
                        }}
                      />
                      <div
                        style={{
                          fontFamily: "var(--sv-sans)",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {tpl.name}
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.06em",
                        marginTop: 4,
                        opacity: selected ? 0.75 : 0.6,
                      }}
                    >
                      {tpl.mood}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        marginTop: 2,
                        opacity: selected ? 0.6 : 0.5,
                      }}
                    >
                      {tpl.imageType}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={
              mode === "layout-only"
                ? "Cole aqui seu texto pronto. A IA preserva o wording inteiro, só distribui em slides."
                : "Escreva o tema, cole um link de YouTube ou carrossel do Instagram como referência.\n\nDica: pode ditar o título entre aspas (o título deve ser \"...\"), pedir pra seguir EXATAMENTE um link, ou dizer \"usa como inspiração mas foca em X\"."
            }
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

          {/* Upload de imagens — primary, sempre visível. Imagens enviadas são
              usadas PRIMEIRO em ordem nos slides; restante cai pra busca/geração. */}
          <div
            style={{
              padding: 16,
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-paper)",
              boxShadow: "3px 3px 0 0 var(--sv-ink)",
            }}
          >
            <div
              className="mb-2 uppercase"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: "var(--sv-ink)",
                fontWeight: 700,
              }}
            >
              ✦ Suas imagens (opcional)
            </div>
            <div
              className="mb-3"
              style={{
                fontFamily: "var(--sv-sans)",
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "var(--sv-muted)",
              }}
            >
              Suba até 8 imagens. A gente usa as suas PRIMEIRO (slide 1, 2,
              3…) e só gera/busca o resto se sobrar slide.
            </div>
            {advUploadedUrls.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {advUploadedUrls.map((url, i) => (
                  <div
                    key={url}
                    style={{
                      position: "relative",
                      width: 80,
                      height: 80,
                      border: "1.5px solid var(--sv-ink)",
                      background: `url(${url}) center/cover`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setAdvUploadedUrls((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "1.5px solid var(--sv-ink)",
                        background: "var(--sv-pink)",
                        fontSize: 11,
                        lineHeight: 1,
                        cursor: "pointer",
                        color: "var(--sv-ink)",
                        fontWeight: 700,
                      }}
                      title="Remover"
                    >
                      ×
                    </button>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 2,
                        left: 2,
                        padding: "1px 5px",
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9,
                        background: "var(--sv-ink)",
                        color: "var(--sv-white)",
                        fontWeight: 700,
                      }}
                    >
                      SLIDE {i + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              ref={advFileInputRef}
              onChange={(e) => handleAdvancedUpload(e.target.files)}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => advFileInputRef.current?.click()}
              disabled={advUploading || advUploadedUrls.length >= 8}
              className="sv-btn sv-btn-outline"
              style={{
                padding: "8px 14px",
                fontSize: 11,
                opacity:
                  advUploading || advUploadedUrls.length >= 8 ? 0.5 : 1,
              }}
            >
              {advUploading
                ? "Subindo…"
                : advUploadedUrls.length === 0
                  ? "+ Subir imagens"
                  : `+ Mais imagens (${advUploadedUrls.length}/8)`}
            </button>
          </div>

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

                    {/* Num slides */}
                    <label className="flex flex-col gap-1.5" style={{ maxWidth: 220 }}>
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

                    {/* Interview toggle — IA pergunta 1-2 questões antes de gerar */}
                    <label
                      className="flex cursor-pointer items-start gap-3"
                      style={{
                        padding: "10px 12px",
                        border: "1.5px solid var(--sv-ink)",
                        background: advInterview ? "var(--sv-green)" : "var(--sv-white)",
                        boxShadow: "2px 2px 0 0 var(--sv-ink)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={advInterview}
                        onChange={(e) => setAdvInterview(e.target.checked)}
                        style={{ marginTop: 3 }}
                      />
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--sv-sans)",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          🧠 Perguntar antes de gerar
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: advInterview ? "var(--sv-ink)" : "var(--sv-muted)",
                            lineHeight: 1.4,
                            marginTop: 2,
                          }}
                        >
                          A IA lê seu briefing e devolve 1-2 perguntas cirúrgicas
                          pra melhorar o output. Depois responde e gera.
                        </div>
                      </div>
                    </label>

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

                    {/* Upload duplicado foi removido — já existe como card
                        primary acima do modo avançado. Ref compartilhada
                        causava bug de React anexando o ref ao input mais
                        recente mounted. */}
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
                    ? designTemplate === "twitter"
                      ? "Nº 02 · Buscando imagens"
                      : "Nº 02 · Criando capa cinematográfica"
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
                  designTemplate === "twitter" ? (
                    <>
                      Buscando <em>imagens</em> pra cada slide…
                    </>
                  ) : (
                    <>
                      Planejando a <em>cena da capa</em>…
                    </>
                  )
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
                    ? designTemplate === "twitter"
                      ? imagesProgress
                        ? `${imagesProgress.done}/${imagesProgress.total} slides com imagem. Rolando em paralelo.`
                        : "Buscando stock alinhado ao conteúdo de cada slide…"
                      : "A IA planeja a cena (3s) + Imagen 4 gera (~45s). Vale a pena — capa é a primeira impressão."
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

      {/* ── Interview Modal ── */}
      <AnimatePresence>
        {interviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{
              background: "rgba(10,10,10,0.55)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setInterviewOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 540,
                maxHeight: "85vh",
                overflow: "auto",
                background: "var(--sv-paper)",
                border: "1.5px solid var(--sv-ink)",
                boxShadow: "8px 8px 0 0 var(--sv-ink)",
                padding: 28,
              }}
            >
              <span
                className="inline-flex items-center gap-2"
                style={{
                  padding: "4px 10px",
                  background: "var(--sv-green)",
                  border: "1.5px solid var(--sv-ink)",
                  fontFamily: "var(--sv-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                🧠 Antes de gerar
              </span>
              <h2
                className="sv-display mt-3"
                style={{
                  fontSize: 24,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                {interviewQs.length === 1
                  ? "Uma pergunta rápida."
                  : "Duas perguntas rápidas."}
              </h2>
              <p
                className="mt-2"
                style={{
                  fontSize: 12.5,
                  color: "var(--sv-muted)",
                  lineHeight: 1.55,
                }}
              >
                A IA identificou o que mais aumentaria a qualidade do seu carrossel. Responde em 1 linha cada — ou pula se não tiver certeza.
              </p>

              <div className="mt-5 flex flex-col gap-4">
                {interviewQs.map((q) => (
                  <div key={q.id}>
                    <div
                      style={{
                        fontFamily: "var(--sv-sans)",
                        fontSize: 14,
                        fontWeight: 700,
                        lineHeight: 1.3,
                      }}
                    >
                      {q.question}
                    </div>
                    <div
                      className="mt-1"
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.1em",
                        color: "var(--sv-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      Por quê: {q.why}
                    </div>
                    <textarea
                      value={interviewAnswers[q.id] ?? ""}
                      onChange={(e) =>
                        setInterviewAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder={q.suggestedAnswer || "Sua resposta..."}
                      maxLength={500}
                      rows={2}
                      style={{
                        marginTop: 8,
                        width: "100%",
                        padding: 10,
                        fontSize: 13,
                        fontFamily: "var(--sv-sans)",
                        border: "1.5px solid var(--sv-ink)",
                        background: "var(--sv-white)",
                        outline: 0,
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInterviewOpen(false);
                    setInterviewQs([]);
                    setInterviewAnswers({});
                    // Continua sem respostas
                    void handleSubmit();
                  }}
                  className="sv-btn sv-btn-outline"
                  style={{ padding: "10px 14px", fontSize: 11 }}
                >
                  Pular e gerar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInterviewOpen(false);
                    // handleSubmit vai encontrar interviewQs preenchido e seguir
                    void handleSubmit();
                  }}
                  className="sv-btn sv-btn-primary"
                  style={{ padding: "10px 14px", fontSize: 11 }}
                >
                  Usar respostas e gerar →
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay do interview */}
      {interviewLoading && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{ background: "rgba(247,245,239,0.85)" }}
        >
          <div
            style={{
              padding: 20,
              border: "1.5px solid var(--sv-ink)",
              background: "var(--sv-white)",
              fontFamily: "var(--sv-mono)",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            <Loader2 className="inline-block animate-spin mr-2" size={13} />
            Pensando nas perguntas...
          </div>
        </div>
      )}
    </motion.div>
  );
}
