"use client";

import { useCallback, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";
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
}

export interface GenerateCarouselInput {
  concept: CreateConcept;
  niche: string;
  tone: string;
  language: string;
  designTemplate?: string;
  sourceType?: "idea" | "link" | "video" | "instagram" | "ai";
  sourceUrl?: string;
  advanced?: AdvancedGenerationOptions;
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
        const res = await fetch("/api/generate-concepts", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify(input),
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
    async (input: GenerateCarouselInput): Promise<CreateVariation[]> => {
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
          }),
        });
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const raw = await res.text();
          throw buildError(raw.slice(0, 200), res);
        }
        const data: {
          variations?: CreateVariation[];
          error?: string;
          code?: string;
        } = await res.json();
        if (!res.ok)
          throw buildError(data.error || "Falha na geração.", res, data.code);
        if (!data.variations?.length)
          throw new Error("Nenhum carrossel gerado.");
        return data.variations;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao gerar carrossel.";
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
