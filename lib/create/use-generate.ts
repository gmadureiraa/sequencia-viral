"use client";

import { useCallback, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";
import { trackCompleteRegistration } from "@/lib/meta-pixel";
import type { CreateConcept, CreateVariation } from "./types";

/**
 * Hooks de chamada pras rotas de geração de conteúdo. Extraído de
 * `app/app/create/page.tsx` (versão legada) pra reaproveitar no fluxo novo.
 */

/**
 * Erro tipado que preserva `status` HTTP, `code` da API e `retryAfterSec`
 * pro componente montar mensagem específica (rate limit vs. plan limit vs.
 * IA offline).
 */
export interface GenerationError extends Error {
  status?: number;
  code?: string;
  retryAfterSec?: number;
}

export interface GenerateConceptsInput {
  topic: string;
  niche: string;
  tone: string;
  language: string;
  sourceType?: "idea" | "video" | "link" | "instagram";
  sourceUrl?: string;
}

export interface AdvancedGenerationOptions {
  customCta?: string;
  hookDirection?: string;
  numSlides?: number;
  preferredStyle?: "data" | "story" | "provocative";
  extraContext?: string;
  uploadedImageUrls?: string[];
  /**
   * 2026-05-06: "pro" ativa o prompt elaborado com 3 variações + archetypes
   * de hook + arquiteturas narrativas. Default (omitido) = "simple",
   * 1 variação curta otimizada pra prestador de serviço (15-20s).
   */
  mode?: "simple" | "pro";
}

export type GenerationMode = "writer" | "layout-only";

export interface GenerateCarouselInput {
  concept: CreateConcept;
  niche: string;
  tone: string;
  language: string;
  designTemplate?: string;
  sourceType?: "idea" | "link" | "video" | "instagram" | "ai";
  sourceUrl?: string;
  advanced?: AdvancedGenerationOptions;
  /** writer (default) = IA escreve. layout-only = IA só formata em slides. */
  mode?: GenerationMode;
}

export function useGenerate(session: Session | null) {
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [loadingCarousel, setLoadingCarousel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateConcepts = useCallback(
    async (input: GenerateConceptsInput): Promise<CreateConcept[]> => {
      setError(null);
      setLoadingConcepts(true);
      try {
        // Timeout de 60s — concepts é Gemini Flash, mais rápido que generate.
        const res = await fetch("/api/generate-concepts", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(60_000),
        });
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const raw = await res.text();
          throw buildError(raw.slice(0, 200), res);
        }
        const data: { concepts?: CreateConcept[]; error?: string; code?: string } =
          await res.json();
        if (!res.ok)
          throw buildError(data.error || "Falha ao gerar conceitos.", res, data.code);
        if (!data.concepts?.length)
          throw new Error("Nenhum conceito gerado. Tente outro tópico.");
        return data.concepts;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao gerar conceitos.";
        setError(msg);
        throw err;
      } finally {
        setLoadingConcepts(false);
      }
    },
    [session]
  );

  const generateCarousel = useCallback(
    async (
      input: GenerateCarouselInput
    ): Promise<{ variations: CreateVariation[]; promptUsed?: string }> => {
      setError(null);
      setLoadingCarousel(true);
      try {
        const { concept, advanced } = input;
        // Se o user digitou um briefing completo, ele vem em `angle`.
        // NÃO concatene labels "Hook: / Angle: / Style:" — confunde a IA a
        // parafrasear. Se tem hook/style explícito, manda como metadado
        // extra; senão, usa só o angle (= briefing cru).
        const hasExplicitConcept =
          !!concept.hook?.trim() && concept.hook.trim() !== concept.angle?.trim();
        const topicPayload = hasExplicitConcept
          ? `${concept.title}\n\nHook: ${concept.hook}\nAngle: ${concept.angle}\nStyle: ${concept.style}`
          : concept.angle?.trim() || concept.title?.trim() || "";
        // Timeout de 130s — Vercel Hobby tem cap de 60s no Node runtime, mas
        // /api/generate tem maxDuration estendido. 130s cobre P99 (writer Pro
        // + retry Flash). Se o backend trava, evita o cliente bloquear eterno
        // (audit 02 — fix [LOW] do briefing→generation).
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            topic: topicPayload,
            sourceType: input.sourceType ?? "idea",
            sourceUrl: input.sourceUrl,
            niche: input.niche,
            tone: input.tone,
            language: input.language,
            designTemplate: input.designTemplate ?? "manifesto",
            advanced: advanced ?? undefined,
            mode: input.mode ?? "writer",
          }),
          signal: AbortSignal.timeout(130_000),
        });
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const raw = await res.text();
          throw buildError(raw.slice(0, 200), res);
        }
        const data: {
          variations?: CreateVariation[];
          promptUsed?: string;
          error?: string;
          code?: string;
        } = await res.json();
        if (!res.ok)
          throw buildError(data.error || "Falha na geração.", res, data.code);
        if (!data.variations?.length)
          throw new Error("Nenhum carrossel gerado.");

        // Meta Pixel `CompleteRegistration` — primeiro carrossel gerado
        // sinaliza "user ativo de verdade" pro Meta otimizar Ads. Gate via
        // localStorage pra nunca duplicar (passa entre sessões nesse browser).
        try {
          if (typeof window !== "undefined") {
            const flagKey = "sv_first_generation_tracked";
            if (!window.localStorage.getItem(flagKey)) {
              trackCompleteRegistration("first_carousel");
              window.localStorage.setItem(flagKey, String(Date.now()));
            }
          }
        } catch {
          /* ignore — pixel é fire-and-forget */
        }

        return {
          variations: data.variations,
          promptUsed: data.promptUsed,
        };
      } catch (err) {
        let msg =
          err instanceof Error ? err.message : "Erro ao gerar carrossel.";
        // AbortSignal.timeout dispara DOMException "TimeoutError" — humaniza.
        if (
          err instanceof Error &&
          (err.name === "TimeoutError" ||
            err.name === "AbortError" ||
            msg.toLowerCase().includes("timeout"))
        ) {
          msg =
            "A geração demorou demais e foi cancelada. Pode ser sobrecarga do Gemini ou source muito grande. Tenta de novo em alguns minutos, ou simplifica o briefing.";
        }
        setError(msg);
        throw err;
      } finally {
        setLoadingCarousel(false);
      }
    },
    [session]
  );

  return {
    generateConcepts,
    generateCarousel,
    loadingConcepts,
    loadingCarousel,
    error,
  };
}

function buildError(
  message: string,
  res: Response,
  code?: string
): GenerationError {
  const err = new Error(message) as GenerationError;
  err.status = res.status;
  if (code) err.code = code;
  const retryHeader = res.headers.get("Retry-After");
  if (retryHeader) {
    const n = Number.parseInt(retryHeader, 10);
    if (Number.isFinite(n)) err.retryAfterSec = n;
  }
  return err;
}
