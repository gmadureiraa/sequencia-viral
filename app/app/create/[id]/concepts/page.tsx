"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, RefreshCcw, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  fetchUserCarousel,
  upsertUserCarousel,
} from "@/lib/carousel-storage";
import { useGenerate, type GenerationError } from "@/lib/create/use-generate";
import type { CreateConcept } from "@/lib/create/types";

/**
 * Traduz um erro do hook em mensagem específica e decide ação colateral
 * (ex: mandar pra /plans em caso de PLAN_LIMIT_REACHED).
 */
function explainGenError(err: unknown): {
  message: string;
  goToPlans: boolean;
} {
  if (!(err instanceof Error)) {
    return { message: "Erro inesperado. Tenta de novo.", goToPlans: false };
  }
  const e = err as GenerationError;
  if (e.code === "PLAN_LIMIT_REACHED" || e.status === 403) {
    return {
      message:
        e.message ||
        "Você atingiu o limite do plano free. Faça upgrade pra seguir gerando.",
      goToPlans: true,
    };
  }
  if (e.status === 429) {
    const wait = e.retryAfterSec ? ` Tenta em ~${e.retryAfterSec}s.` : "";
    return {
      message: `Muitas gerações em pouco tempo.${wait}`,
      goToPlans: false,
    };
  }
  if (e.status === 401) {
    return {
      message: "Sessão expirou. Faça login novamente.",
      goToPlans: false,
    };
  }
  if (e.status === 503) {
    return {
      message: "IA indisponível agora. Aguarda 10s e tenta de novo.",
      goToPlans: false,
    };
  }
  if (e.status === 502) {
    return {
      message: "Modelo devolveu resposta inválida. Tenta de novo.",
      goToPlans: false,
    };
  }
  return { message: e.message, goToPlans: false };
}

/**
 * Tela 02 — Escolha de caminho / conceito.
 *
 * Após o brief em /new, o usuário cai aqui e a IA devolve 5 ângulos
 * diferentes do mesmo tema. Ao clicar em um conceito, a IA gera o
 * carrossel completo com o system prompt editorial (via /api/generate),
 * persiste os slides reais no rascunho e navega pra /templates.
 */

export default function ConceptsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user, session } = useAuth();
  const { generateConcepts, generateCarousel, loadingConcepts, loadingCarousel } =
    useGenerate(session);

  const [topic, setTopic] = useState<string>("");
  const [tone, setTone] = useState<string>("editorial");
  const [language, setLanguage] = useState<string>("pt-br");
  const [niche, setNiche] = useState<string>("marketing");
  const [sourceType, setSourceType] = useState<
    "idea" | "video" | "link" | "instagram"
  >("idea");
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [concepts, setConcepts] = useState<CreateConcept[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);

  /** Carrega brief persistido no rascunho e gera os 5 conceitos. */
  const loadAndGenerate = useCallback(async () => {
    if (!id || !user || !supabase) return;
    setLoadingDraft(true);
    setError(null);
    try {
      const draft = await fetchUserCarousel(supabase, id);
      if (!draft) {
        toast.error("Rascunho não encontrado.");
        router.replace("/app/create/new");
        return;
      }
      const t = draft.title || "";
      setTopic(t);
      // variation.style formato: `${tone}|${lang}|${niche}|${jsonMeta?}`
      // jsonMeta opcional contém { sourceType, sourceUrl } detectados em /new.
      const parts = (draft.variation?.style ?? "editorial|pt-br|marketing").split(
        "|"
      );
      const parsedTone = parts[0] || "editorial";
      const parsedLang = parts[1] || "pt-br";
      const parsedNiche = parts[2] || "marketing";
      let parsedSourceType: "idea" | "video" | "link" | "instagram" = "idea";
      let parsedSourceUrl: string | undefined;
      if (parts[3]) {
        try {
          const meta = JSON.parse(parts.slice(3).join("|"));
          if (meta?.sourceType) parsedSourceType = meta.sourceType;
          if (meta?.sourceUrl) parsedSourceUrl = meta.sourceUrl;
        } catch {
          // styleMeta malformado — ignora, vai como idea
        }
      }
      setTone(parsedTone);
      setLanguage(parsedLang);
      setNiche(parsedNiche);
      setSourceType(parsedSourceType);
      setSourceUrl(parsedSourceUrl);

      setLoadingDraft(false);

      const result = await generateConcepts({
        topic: t,
        niche: parsedNiche,
        tone: parsedTone,
        language: parsedLang,
      });
      setConcepts(result);
    } catch (err) {
      const { message } = explainGenError(err);
      setError(message);
      setLoadingDraft(false);
    }
  }, [id, user, router, generateConcepts]);

  useEffect(() => {
    void loadAndGenerate();
  }, [loadAndGenerate]);

  const regenerate = useCallback(async () => {
    if (!topic) return;
    setError(null);
    try {
      const result = await generateConcepts({
        topic,
        niche,
        tone,
        language,
      });
      setConcepts(result);
      setSelectedIdx(null);
    } catch (err) {
      const { message, goToPlans } = explainGenError(err);
      setError(message);
      toast.error(message);
      if (goToPlans) router.push("/app/plans");
    }
  }, [topic, niche, tone, language, generateConcepts, router]);

  const handleSelectConcept = useCallback(
    async (idx: number) => {
      if (!id || !user || !supabase) return;
      const concept = concepts[idx];
      if (!concept) return;
      setSelectedIdx(idx);
      try {
        const variations = await generateCarousel({
          concept,
          niche,
          tone,
          language,
          sourceType,
          sourceUrl,
        });
        const chosen = variations[0];
        if (!chosen) throw new Error("IA não devolveu slides.");

        await upsertUserCarousel(supabase, user.id, {
          id,
          title: concept.title,
          slides: chosen.slides,
          slideStyle: "white",
          status: "draft",
          variation: {
            title: concept.title,
            style: `${tone}|${language}|${niche}`,
          },
        });

        router.push(`/app/create/${id}/templates`);
      } catch (err) {
        const { message, goToPlans } = explainGenError(err);
        toast.error(message);
        setSelectedIdx(null);
        if (goToPlans) router.push("/app/plans");
      }
    },
    [id, user, concepts, generateCarousel, niche, tone, language, sourceType, sourceUrl, router]
  );

  const showLoader = loadingDraft || loadingConcepts;

  // Countdown ETA pra mostrar ao usuário enquanto /api/generate roda.
  // Typical latency Gemini 2.5 Flash com prompt grande: 8-12s. Usamos 12 como
  // target superior pra não frustar (se terminar antes, ótimo).
  const ETA_TARGET_SEC = 12;
  const [etaElapsed, setEtaElapsed] = useState(0);
  const etaStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!loadingCarousel) {
      etaStartedRef.current = null;
      setEtaElapsed(0);
      return;
    }
    etaStartedRef.current = Date.now();
    const t = window.setInterval(() => {
      if (!etaStartedRef.current) return;
      setEtaElapsed(
        Math.floor((Date.now() - etaStartedRef.current) / 1000)
      );
    }, 250);
    return () => window.clearInterval(t);
  }, [loadingCarousel]);
  const etaRemainingSec = Math.max(0, ETA_TARGET_SEC - etaElapsed);
  const etaPercent = Math.min(
    97,
    Math.round((etaElapsed / ETA_TARGET_SEC) * 100)
  );

  const swatches = useMemo(
    () => [
      "var(--sv-ink)",
      "var(--sv-green)",
      "var(--sv-pink)",
      "var(--sv-paper)",
      "var(--sv-ink)",
    ],
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-auto w-full"
      style={{ maxWidth: 1200, minWidth: 0 }}
    >
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push("/app/create/new")}
        className="mb-5 inline-flex items-center gap-2"
        style={{
          fontFamily: "var(--sv-mono)",
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--sv-muted)",
        }}
      >
        <ArrowLeft size={13} />
        Voltar pro brief
      </button>

      <span className="sv-eyebrow">
        <span className="sv-dot" /> Nº 02 · Caminhos · Escolha um ângulo
      </span>

      <h1
        className="sv-display mt-4"
        style={{
          fontSize: "clamp(30px, 4vw, 48px)",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          maxWidth: 820,
        }}
      >
        A IA propôs <em>cinco</em> caminhos diferentes pro seu tema.{" "}
        <em>Qual combina?</em>
      </h1>
      <p
        className="mt-2"
        style={{
          color: "var(--sv-muted)",
          fontSize: 14.5,
          lineHeight: 1.55,
          maxWidth: 640,
        }}
      >
        Cada ângulo é uma versão diferente da mesma ideia — dado, história,
        contraditório, tutorial, mecanismo. Clique no que mais combina com a
        voz da sua marca e a IA gera o carrossel completo.
      </p>

      {/* Topic peek */}
      {topic && (
        <div
          className="mt-5"
          style={{
            padding: "12px 16px",
            border: "1.5px solid var(--sv-ink)",
            background: "var(--sv-white)",
            boxShadow: "3px 3px 0 0 var(--sv-ink)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--sv-mono)",
              fontSize: 9.5,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--sv-muted)",
              marginBottom: 4,
            }}
          >
            Tema
          </div>
          <div
            style={{
              fontFamily: "var(--sv-display)",
              fontSize: 18,
              lineHeight: 1.25,
              color: "var(--sv-ink)",
            }}
          >
            {topic}
          </div>
        </div>
      )}

      {/* Actions row */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={loadingConcepts}
          className="sv-btn sv-btn-outline"
          style={{ padding: "10px 16px", fontSize: 10.5 }}
        >
          {loadingConcepts ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCcw size={13} />
          )}
          Gerar novos caminhos
        </button>
        <span
          style={{
            fontFamily: "var(--sv-mono)",
            fontSize: 9.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--sv-muted)",
          }}
        >
          {loadingCarousel ? "Gerando carrossel..." : "Ou escolha um abaixo"}
        </span>
      </div>

      {/* Error inline */}
      {error && !showLoader && (
        <div
          className="mt-4 p-3"
          style={{
            border: "1.5px solid #c94f3b",
            background: "#fdf0ed",
            color: "#7a2a1a",
            fontFamily: "var(--sv-sans)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Overlay ETA durante geração do carrossel (após escolher concept) */}
      <AnimatePresence>
        {loadingCarousel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ background: "rgba(247, 245, 239, 0.92)" }}
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
                Nº 02 · Escrevendo carrossel
              </div>
              <div
                style={{
                  fontFamily: "var(--sv-display)",
                  fontSize: 26,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "var(--sv-ink)",
                  marginBottom: 14,
                }}
              >
                Montando <em>{concepts[selectedIdx ?? 0]?.title || "..."}</em>
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
                A IA está estruturando 6 a 10 slides com variantes visuais,
                hooks e CTA calibrado pra sua voz.
              </p>

              {/* Progress bar */}
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

      {/* Grid de conceitos */}
      <div className="mt-7" style={{ minWidth: 0 }}>
        <AnimatePresence mode="wait">
          {showLoader ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <ConceptSkeleton key={i} delay={i * 0.08} />
              ))}
            </motion.div>
          ) : concepts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 text-center"
              style={{
                fontFamily: "var(--sv-mono)",
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sv-muted)",
              }}
            >
              Nenhum caminho gerado. Tente novamente.
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {concepts.map((c, i) => {
                const isSelected = selectedIdx === i;
                const isBusy = selectedIdx !== null;
                const bg = swatches[i % swatches.length];
                const isDark =
                  bg === "var(--sv-ink)" || bg === "var(--sv-pink)";
                return (
                  <motion.button
                    key={c.title + i}
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleSelectConcept(i)}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                    whileHover={isBusy ? undefined : { y: -3 }}
                    className="group relative text-left transition-all"
                    style={{
                      padding: 22,
                      background: isSelected ? "var(--sv-green)" : bg,
                      color:
                        isSelected || !isDark
                          ? "var(--sv-ink)"
                          : "var(--sv-paper)",
                      border: "1.5px solid var(--sv-ink)",
                      boxShadow: isSelected
                        ? "5px 5px 0 0 var(--sv-ink)"
                        : "3px 3px 0 0 var(--sv-ink)",
                      opacity: isBusy && !isSelected ? 0.5 : 1,
                      cursor: isBusy ? "not-allowed" : "pointer",
                      minHeight: 240,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 14,
                      minWidth: 0,
                    }}
                  >
                    {/* Kicker */}
                    <div
                      style={{
                        fontFamily: "var(--sv-mono)",
                        fontSize: 9.5,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        opacity: 0.8,
                      }}
                    >
                      {`Nº ${String(i + 1).padStart(2, "0")} · ${c.style || "Ângulo"}`}
                    </div>

                    {/* Hook + título */}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--sv-display)",
                          fontSize: 22,
                          lineHeight: 1.1,
                          letterSpacing: "-0.01em",
                          fontWeight: 400,
                          marginBottom: 6,
                        }}
                      >
                        <em>{c.title}</em>
                      </div>
                      {c.hook && (
                        <div
                          style={{
                            fontFamily: "var(--sv-sans)",
                            fontSize: 12.5,
                            lineHeight: 1.4,
                            opacity: 0.85,
                          }}
                        >
                          {c.hook}
                        </div>
                      )}
                    </div>

                    {/* Angle + CTA */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--sv-sans)",
                          fontSize: 11.5,
                          lineHeight: 1.4,
                          opacity: 0.78,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {c.angle}
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--sv-mono)",
                          fontSize: 9.5,
                          letterSpacing: "0.2em",
                          textTransform: "uppercase",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isSelected ? (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            Escolher
                            <ArrowRight size={11} />
                          </>
                        )}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ConceptSkeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      style={{
        padding: 22,
        background: "var(--sv-soft)",
        border: "1.5px solid var(--sv-ink)",
        minHeight: 240,
      }}
      aria-hidden="true"
    >
      <div
        className="animate-pulse"
        style={{
          width: "40%",
          height: 10,
          background: "var(--sv-muted)",
          opacity: 0.25,
          marginBottom: 16,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "90%",
          height: 22,
          background: "var(--sv-muted)",
          opacity: 0.25,
          marginBottom: 10,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "70%",
          height: 22,
          background: "var(--sv-muted)",
          opacity: 0.25,
          marginBottom: 22,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "100%",
          height: 12,
          background: "var(--sv-muted)",
          opacity: 0.2,
          marginBottom: 6,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: "80%",
          height: 12,
          background: "var(--sv-muted)",
          opacity: 0.2,
        }}
      />
    </motion.div>
  );
}
