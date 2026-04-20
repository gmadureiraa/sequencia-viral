import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "./auth";

/**
 * Pricing table (USD per 1 token). Centralizado aqui pra o admin poder
 * auditar o custo real de cada chamada IA. Valores baseados na documentação
 * pública em 2026-04.
 *
 * Pricing pode mudar — revisar a cada 3 meses ou quando Google/Anthropic
 * publicar release de preço novo.
 */
const PRICING = {
  // Gemini 2.5 Flash — barato. Usado pra layout-only, concepts, suggestions.
  "gemini-2.5-flash": {
    input: 0.00000015, // $0.15 / 1M input
    output: 0.00000060, // $0.60 / 1M output
  },
  // Gemini 2.5 Pro — qualidade muito superior. Usado no writer mode
  // (criação de conteúdo do zero). ~8x mais caro que Flash mas vale.
  "gemini-2.5-pro": {
    input: 0.00000125, // $1.25 / 1M input
    output: 0.00000500, // $5.00 / 1M output
  },
  // Gemini Imagen 4 — cobrado por imagem gerada, não por token.
  "imagen-4.0-generate-001": {
    input: 0,
    output: 0,
    perImage: 0.04, // $0.04 por imagem
  },
  // Claude Sonnet 4.6 — pricing Anthropic 2026.
  "claude-sonnet-4-6": {
    input: 0.000003, // $3.00 / 1M input
    output: 0.000015, // $15.00 / 1M output
  },
} as const;

type ModelId = keyof typeof PRICING;

export type PromptType =
  | "carousel"
  | "caption"
  | "concepts"
  | "image"
  | "brand-aesthetic"
  | "brand-analysis"
  | "cover-scene";

export function costForTokens(
  model: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PRICING[model];
  if (!p) return 0;
  const raw = inputTokens * p.input + outputTokens * p.output;
  return Math.round(raw * 1_000_000) / 1_000_000;
}

export function costForImages(
  model: ModelId,
  numberOfImages: number
): number {
  const p = PRICING[model] as { perImage?: number };
  const perImage = typeof p?.perImage === "number" ? p.perImage : 0;
  return Math.round(perImage * numberOfImages * 1_000_000) / 1_000_000;
}

/**
 * Grava uma linha em `generations` pra auditoria. Falha silenciosa — se
 * não der pra registrar, a chamada IA não deve quebrar. Aceita cliente
 * opcional pra reuso quando a rota já tem um em mãos.
 */
export async function recordGeneration(params: {
  userId: string;
  carouselId?: string | null;
  model: ModelId;
  provider: "google" | "anthropic" | "openai";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  promptType: PromptType;
  supabase?: SupabaseClient | null;
}): Promise<void> {
  const sb = params.supabase ?? createServiceRoleSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("generations").insert({
      user_id: params.userId,
      carousel_id: params.carouselId ?? null,
      model: params.model,
      provider: params.provider,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost_usd: params.costUsd,
      prompt_type: params.promptType,
    });
  } catch (err) {
    console.warn(
      "[generation-log] falha ao registrar:",
      err instanceof Error ? err.message : err
    );
  }
}

export type { ModelId };
