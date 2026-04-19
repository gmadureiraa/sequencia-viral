"use client";

import { useCallback, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

export interface CaptionSlideInput {
  heading: string;
  body: string;
}

export interface CaptionGenerateInput {
  slides: CaptionSlideInput[];
  title: string;
  niche?: string;
  tone?: string;
  language?: string;
}

export interface CaptionResult {
  caption: string;
  hashtags: string[];
}

/**
 * Hook de geração de legenda IA para o preview.
 * Chama POST /api/generate/caption com Bearer do Supabase.
 * Rate limit no server: 40/h por usuário.
 */
export function useCaption(session: Session | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: CaptionGenerateInput): Promise<CaptionResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/generate/caption", {
          method: "POST",
          headers: jsonWithAuth(session),
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as
          | { caption: string; hashtags: string[] }
          | { error?: string; code?: string };
        if (!res.ok) {
          const msg =
            (data as { error?: string }).error ||
            "Falha ao gerar legenda.";
          throw new Error(msg);
        }
        const ok = data as { caption: string; hashtags: string[] };
        return {
          caption: typeof ok.caption === "string" ? ok.caption : "",
          hashtags: Array.isArray(ok.hashtags) ? ok.hashtags : [],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  return { generate, loading, error };
}
