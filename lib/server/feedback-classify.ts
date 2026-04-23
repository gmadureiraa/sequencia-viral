/**
 * Feedback Classifier — lê o texto livre que o user escreveu no modal
 * pós-download e extrai:
 *   - buckets: sobre o que ele tá falando (text, image, both)
 *   - textRules: 0-3 regras acionáveis pra próximo writer prompt
 *   - imageRules: 0-3 regras acionáveis pro image decider
 *
 * As regras viram instruções diretas ("não usar emoji nos títulos",
 * "imagens mais minimalistas"). A regra entra no prompt de geração com
 * peso alto — o writer trata como ground truth da preferência do user.
 *
 * Custo: ~$0.0003 por chamada (Gemini 2.5 Flash, thinkingBudget 0).
 */

import { GoogleGenAI } from "@google/genai";
import type { ModelId } from "./generation-log";

const TIMEOUT_MS = 10_000;
const MODEL: ModelId = "gemini-2.5-flash";

export interface FeedbackClassification {
  buckets: Array<"text" | "image" | "both">;
  /** 0-3 regras curtas e acionáveis sobre redação (injeta no writer). */
  textRules: string[];
  /** 0-3 regras curtas e acionáveis sobre imagens (injeta no image-decider). */
  imageRules: string[];
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  model: ModelId;
}

export function emptyClassification(): FeedbackClassification {
  return {
    buckets: [],
    textRules: [],
    imageRules: [],
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    model: MODEL,
  };
}

const SYSTEM_PROMPT = `Você é um classificador de feedback de usuário sobre carrosséis gerados por IA. Sua função é:

1. Ler o feedback livre que o user escreveu depois de baixar o carrossel.
2. Classificar em 1 ou mais buckets: "text" (redação, headings, body, CTA, voz, tom), "image" (imagens, cores, estética, composição), "both" (quando ele comenta dos dois).
3. Extrair REGRAS ACIONÁVEIS diretas, em português, imperativas, específicas — que virem instrução curta pra próxima geração.

REGRAS DAS REGRAS:
- Escreva no imperativo direto: "não usar X", "sempre fazer Y", "escrever em primeira pessoa".
- Seja ESPECÍFICO. Regra genérica NÃO SERVE.
  ✓ BOM: "não usar emoji nos títulos"
  ✓ BOM: "imagens mais minimalistas, menos saturadas"
  ✓ BOM: "escrever em primeira pessoa do singular"
  ✗ RUIM: "melhorar o texto"
  ✗ RUIM: "ficou bom"
  ✗ RUIM: "gostei"
- Máximo 120 caracteres por regra.
- 0 a 3 regras por bucket. Se user só elogiou ("ficou top", "gostei"), retorne arrays vazios.
- textRules fala só de redação. imageRules fala só de imagens. Não misture.
- Se o feedback disse "texto e imagens bons" sem especificar o que melhorar, retorne arrays vazios e bucket "both".

OUTPUT: JSON puro, sem markdown.
{
  "buckets": ["text"] | ["image"] | ["text", "image"] | ["both"],
  "textRules": ["regra 1", "regra 2"],
  "imageRules": ["regra 1"]
}`;

export async function classifyFeedback(
  rawText: string
): Promise<FeedbackClassification> {
  const start = Date.now();
  const trimmed = (rawText || "").trim();
  if (trimmed.length < 5) {
    return emptyClassification();
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return emptyClassification();
  }

  const prompt = `${SYSTEM_PROMPT}

FEEDBACK DO USER:
"""
${trimmed.slice(0, 2500)}
"""

Retorne APENAS o JSON.`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const result = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 1000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () =>
          reject(new Error("feedback-classify timeout"))
        )
      ),
    ]);
    clearTimeout(timeout);

    const text = result.text || "";
    if (!text.trim()) {
      return emptyClassification();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return emptyClassification();
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return emptyClassification();
      }
    }

    const cleaned = normalize(parsed);
    const usage = result.usageMetadata;
    return {
      ...cleaned,
      durationMs: Date.now() - start,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      model: MODEL,
    };
  } catch (err) {
    console.warn(
      "[feedback-classify] falha silenciosa:",
      err instanceof Error ? err.message : err
    );
    return emptyClassification();
  }
}

function normalize(raw: unknown): Omit<
  FeedbackClassification,
  "durationMs" | "inputTokens" | "outputTokens" | "model"
> {
  if (!raw || typeof raw !== "object") {
    return { buckets: [], textRules: [], imageRules: [] };
  }
  const r = raw as Record<string, unknown>;

  const buckets: Array<"text" | "image" | "both"> = [];
  if (Array.isArray(r.buckets)) {
    for (const b of r.buckets) {
      if (typeof b !== "string") continue;
      const v = b.toLowerCase().trim();
      if (v === "text" || v === "image" || v === "both") {
        if (!buckets.includes(v)) buckets.push(v);
      }
    }
  }

  const cleanRule = (x: unknown): string | null => {
    if (typeof x !== "string") return null;
    const t = x.trim();
    if (t.length < 4) return null;
    return t.length > 120 ? t.slice(0, 120) : t;
  };
  const textRules = Array.isArray(r.textRules)
    ? (r.textRules as unknown[])
        .map(cleanRule)
        .filter((v): v is string => v !== null)
        .slice(0, 3)
    : [];
  const imageRules = Array.isArray(r.imageRules)
    ? (r.imageRules as unknown[])
        .map(cleanRule)
        .filter((v): v is string => v !== null)
        .slice(0, 3)
    : [];

  return { buckets, textRules, imageRules };
}

/**
 * Dedupe case-insensitive preservando a 1ª ocorrência. Caps novas regras
 * no começo do array (mais recentes têm mais peso — FIFO corta as antigas).
 */
export function mergeRules(
  incoming: string[],
  existing: string[],
  cap = 20
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (r: string) => {
    const key = r.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(r);
  };
  for (const r of incoming) push(r);
  for (const r of existing) push(r);
  return out.slice(0, cap);
}
