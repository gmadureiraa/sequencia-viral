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
  // Gemini Imagen 4 — cobrado por imagem gerada, não por token. Usado
  // exclusivamente em capa (qualidade cinematografica).
  "imagen-4.0-generate-001": {
    input: 0,
    output: 0,
    perImage: 0.04, // $0.04 por imagem
  },
  // Gemini 3.1 Flash Image ("Nano Banana") — usado em slides internos.
  // ~5x mais barato que Imagen 4 com qualidade aceitavel pra inner slide.
  // Capa continua Imagen pq tem que stop scroll.
  "gemini-3.1-flash-image-preview": {
    input: 0,
    output: 0,
    perImage: 0.008, // $0.008 por imagem (estimativa conservadora)
  },
  // Claude Sonnet 4.6 — pricing Anthropic 2026.
  "claude-sonnet-4-6": {
    input: 0.000003, // $3.00 / 1M input
    output: 0.000015, // $15.00 / 1M output
  },
  // Perplexity Sonar (small) — fact-check ao vivo com citations. $1/M I/O.
  // Usado opcionalmente no writer quando o briefing pede dados recentes
  // verificáveis (opt-in via flag `useFactCheck` ou auto-detect em dataPoints).
  sonar: {
    input: 0.000001, // $1.00 / 1M input
    output: 0.000001, // $1.00 / 1M output
  },
  // Perplexity Sonar Pro — raciocínio mais pesado. $3/M input, $15/M output.
  // Reservado pra casos onde Sonar small não dá conta (raro no pipeline atual).
  "sonar-pro": {
    input: 0.000003, // $3.00 / 1M input
    output: 0.000015, // $15.00 / 1M output
  },
  // Firecrawl — scraping LLM-ready de blogs/artigos. Freemium, tracking
  // cosmético (custos por request não são cobrados no tier atual). Mantemos
  // entry pra admin enxergar as chamadas de scrape no log.
  firecrawl: {
    input: 0,
    output: 0,
  },
  // Unsplash — busca de fotos editoriais stock. Freemium (API pública,
  // 50 req/h demo, 5000 req/h production). Tracking cosmético.
  unsplash: {
    input: 0,
    output: 0,
  },
  // Serper.dev — Google Images search. Freemium (2500/mês Starter,
  // $50/mês Pro). 1 query = 1 request cobrado. Tracking cosmético
  // pra admin enxergar volume (1 row por chamada).
  serper: {
    input: 0,
    output: 0,
    perCall: 0.0003, // ~$0.30 / 1000 queries no Starter
  },
  // Apify Instagram Scraper — pago por resultado. Tier atual ~$0.02/
  // request (estimativa conservadora). Usado no instagram-extractor
  // como scraper primário.
  apify: {
    input: 0,
    output: 0,
    perCall: 0.02,
  },
  // ScrapeCreators — fallback do Apify quando falha. Pago por
  // request ($0.01 estimativa).
  scrapecreators: {
    input: 0,
    output: 0,
    perCall: 0.01,
  },
  // Supadata — transcrição de áudio (reels IG, YouTube). Freemium.
  // Tracking cosmético — custo real depende do tier.
  supadata: {
    input: 0,
    output: 0,
    perCall: 0,
  },
} as const;

type ModelId = keyof typeof PRICING;

export type PromptType =
  | "carousel"
  | "caption"
  | "concepts"
  | "image"
  | "stock-search"
  | "image-picker-search"
  | "brand-aesthetic"
  | "brand-analysis"
  | "cover-scene"
  | "voice-ingest"
  | "post-vision-transcripts"
  | "source-ner"
  | "source-scrape"
  | "ig-scrape"
  | "audio-transcript"
  | "fact-check"
  | "feedback-classify";

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
 * Custo por chamada (API-based pricing — 1 request = 1 cobrança
 * independente de resposta).
 */
export function costForCall(model: ModelId, numberOfCalls: number = 1): number {
  const p = PRICING[model] as { perCall?: number };
  const perCall = typeof p?.perCall === "number" ? p.perCall : 0;
  return Math.round(perCall * numberOfCalls * 1_000_000) / 1_000_000;
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
  provider:
    | "google"
    | "anthropic"
    | "openai"
    | "perplexity"
    | "firecrawl"
    | "unsplash"
    | "serper"
    | "apify"
    | "scrapecreators"
    | "supadata";
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
