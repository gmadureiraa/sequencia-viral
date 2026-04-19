"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useGenerate } from "@/lib/create/use-generate";
import type { CreateConcept } from "@/lib/create/types";

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
      const parts = (draft.variation?.style ?? "editorial|pt-br|marketing").split(
        "|"
      );
      setTone(parts[0] || "editorial");
      setLanguage(parts[1] || "pt-br");
      setNiche(parts[2] || "marketing");

      setLoadingDraft(false);

      const result = await generateConcepts({
        topic: t,
        niche: parts[2] || "marketing",
        tone: parts[0] || "editorial",
        language: parts[1] || "pt-br",
      });
      setConcepts(result);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao carregar o brief.";
      setError(msg);
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
      const msg =
        err instanceof Error ? err.message : "Erro ao gerar conceitos.";
      setError(msg);
      toast.error(msg);
    }
  }, [topic, niche, tone, language, generateConcepts]);

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
        const msg =
          err instanceof Error ? err.message : "Erro ao gerar o carrossel.";
        toast.error(msg);
        setSelectedIdx(null);
      }
    },
    [id, user, concepts, generateCarousel, niche, tone, language, router]
  );

  const showLoader = loadingDraft || loadingConcepts;

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
