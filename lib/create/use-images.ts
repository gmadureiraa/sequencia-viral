"use client";

import { useCallback, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

/**
 * Hook pra buscar, trocar e fazer upload de imagens dos slides. Lógica
 * extraída de `app/app/create/page.tsx` (versão legada).
 */

export interface RefetchImageInput {
  query: string;
  niche?: string;
  tone?: string;
  mode?: "search" | "generate";
  peopleMode?: "auto" | "with_people" | "no_people";
  contextHeading?: string;
  contextBody?: string;
  /** Template visual do carrossel — determina style guide do prompt Imagen. */
  designTemplate?:
    | "manifesto"
    | "futurista"
    | "autoral"
    | "twitter"
    | "ambitious"
    | "blank";
  /** Se true, ativa pipeline 2-pass (cover-scene → Imagen) com composição cinematográfica. */
  isCover?: boolean;
  /**
   * Se true, deixa o agente image-decider escolher entre search e generate,
   * ignorando o `mode` passado. Também aceita StructuredImagePrompt do decider
   * quando escolhe generate. Usado no auto-fill pra decidir foto real de
   * entidade vs. cena cinematográfica abstrata.
   */
  useDecider?: boolean;
  /** Número do slide (1-indexed) — contexto pro decider. */
  slideNumber?: number;
  /** Total de slides do carrossel — contexto pro decider. */
  totalSlides?: number;
  /** Facts extraídos via NER do source (quando disponível). */
  facts?: {
    entities?: string[];
    dataPoints?: string[];
    summary?: string[];
  };
}

export function useImages(session: Session | null) {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [pickerOptions, setPickerOptions] = useState<string[]>([]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetchImage = useCallback(
    async (index: number, input: RefetchImageInput) => {
      setLoadingIndex(index);
      setError(null);
      try {
        const mode = input.mode ?? "search";
        const res = await fetch("/api/images", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify({
            query: input.query,
            count: 8,
            mode,
            niche: input.niche,
            tone: input.tone,
            designTemplate: input.designTemplate ?? "manifesto",
            peopleMode: input.peopleMode ?? "auto",
            contextHeading: input.contextHeading?.slice(0, 400),
            contextBody: input.contextBody?.slice(0, 500),
            isCover: input.isCover ?? false,
            useDecider: input.useDecider ?? false,
            slideNumber: input.slideNumber,
            totalSlides: input.totalSlides,
            facts: input.facts,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha na busca de imagem");
        const images: Array<{ url: string; generated?: boolean }> =
          data.images || [];
        if (images.length === 0) {
          throw new Error("Nenhuma imagem encontrada. Tente outro termo.");
        }
        if (mode === "generate" && images.length === 1) {
          return { appliedUrl: images[0].url, options: null };
        }
        const urls = images.map((img) => img.url).filter(Boolean);
        setPickerOptions(urls);
        setPickerIndex(index);
        return { appliedUrl: null, options: urls };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao trocar imagem");
        throw e;
      } finally {
        setLoadingIndex(null);
      }
    },
    [session]
  );

  const uploadImage = useCallback(
    async (
      index: number,
      file: File,
      carouselId: string | null
    ): Promise<string | null> => {
      if (!file.type.startsWith("image/")) {
        setError("Arquivo precisa ser uma imagem.");
        return null;
      }
      setLoadingIndex(index);
      setError(null);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("carouselId", carouselId || "draft");
        form.set("slideIndex", String(index));
        const headers: HeadersInit = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};
        const res = await fetch("/api/upload", {
          method: "POST",
          headers,
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload falhou");
        return data.url as string;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro no upload");
        return null;
      } finally {
        setLoadingIndex(null);
      }
    },
    [session]
  );

  const clearPicker = useCallback(() => {
    setPickerIndex(null);
    setPickerOptions([]);
  }, []);

  return {
    refetchImage,
    uploadImage,
    loadingIndex,
    pickerIndex,
    pickerOptions,
    clearPicker,
    error,
  };
}
