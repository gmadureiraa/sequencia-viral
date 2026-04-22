/**
 * NER (Named Entity Recognition) pre-processing.
 *
 * Extrai fatos estruturados do source content (transcript YouTube, scrape de
 * link, carousel IG) ANTES do writer rodar. Esses fatos entram no prompt como
 * "MUST CITE list", forçando o carrossel a citar dados específicos em vez de
 * parafrasear genericamente.
 *
 * Custo: ~$0.0005 por chamada (Gemini 2.5 Flash, thinkingBudget 0). Negligível.
 */

import { GoogleGenAI } from "@google/genai";

const MAX_INPUT_CHARS = 18000; // ~30-40min de fala densa
const MAX_QUOTE_CHARS = 80;
const TIMEOUT_MS = 20_000;

export interface SourceFacts {
  entities: string[];
  dataPoints: string[];
  quotes: string[];
  arguments: string[];
  /** Tempo de execução da extração (ms). 0 quando skipou. */
  durationMs: number;
  /** Tokens usados (input+output). Pra log em generations. */
  inputTokens: number;
  outputTokens: number;
  /** Se rodou ou foi skipado (source vazio, key faltando, etc.). */
  skipped: boolean;
}

export function emptyFacts(): SourceFacts {
  return {
    entities: [],
    dataPoints: [],
    quotes: [],
    arguments: [],
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    skipped: true,
  };
}

/**
 * Extrai fatos estruturados do transcript/conteudo.
 * Retorna listas vazias (skipped:true) se falhar — nunca lança.
 */
export async function extractSourceFacts(
  sourceContent: string,
  language = "pt-br"
): Promise<SourceFacts> {
  const start = Date.now();
  if (!sourceContent || sourceContent.trim().length < 200) {
    return emptyFacts();
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return emptyFacts();
  }

  const sliced = sourceContent.slice(0, MAX_INPUT_CHARS);
  const isPtBr = language.toLowerCase().startsWith("pt");

  const prompt = isPtBr
    ? `Você é um extrator de FATOS ESTRUTURADOS para produção de conteúdo. Analise o texto abaixo e extraia:

1. ENTITIES — 5 a 10 nomes próprios específicos mencionados (pessoas, empresas, produtos, lugares, tokens, ferramentas). Só nomes que aparecem LITERALMENTE no texto.
2. DATA POINTS — 5 a 10 números, percentuais, datas, estatísticas, valores monetários mencionados. Preserve a unidade ("30%", "R$ 50 mil", "2024", "300 bilhões").
3. QUOTES — 3 a 5 frases de impacto LITERAIS do autor/speaker (max 80 caracteres cada). Copiar as palavras exatas, sem parafrasear.
4. ARGUMENTS — 3 argumentos centrais do speaker (1 frase cada, no máximo 120 chars). Os pontos principais que ele está defendendo.

REGRAS:
- Se o texto não tem nenhum nome próprio, retorna lista vazia (não invente).
- Se um número não existe no texto, NÃO liste.
- Quotes DEVE ser texto literal — se não tem frase forte, retorna lista vazia.
- Zero invenção. Zero inferência. Apenas extração.

TEXTO:
"""
${sliced}
"""

Retorne APENAS JSON, sem markdown:
{"entities":[], "dataPoints":[], "quotes":[], "arguments":[]}`
    : `You are a STRUCTURED FACT extractor. Analyze the text below and extract:

1. ENTITIES — 5 to 10 specific proper nouns mentioned (people, companies, products, places, tokens, tools). Only names that appear LITERALLY in the text.
2. DATA POINTS — 5 to 10 numbers, percentages, dates, statistics, monetary values mentioned. Preserve the unit.
3. QUOTES — 3 to 5 LITERAL impact sentences from the author/speaker (max 80 chars each). Copy the exact words, no paraphrasing.
4. ARGUMENTS — 3 central arguments the speaker is making (1 sentence each, max 120 chars).

RULES:
- If the text has no proper nouns, return empty list (don't invent).
- If a number doesn't exist in the text, DON'T list.
- Quotes MUST be literal text. No strong sentence → empty list.
- Zero invention. Zero inference. Only extraction.

TEXT:
"""
${sliced}
"""

Return ONLY JSON, no markdown:
{"entities":[], "dataPoints":[], "quotes":[], "arguments":[]}`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const raceController = new AbortController();
    const timeoutId = setTimeout(() => raceController.abort(), TIMEOUT_MS);

    const result = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      new Promise<never>((_, reject) =>
        raceController.signal.addEventListener("abort", () =>
          reject(new Error("NER timeout"))
        )
      ),
    ]);
    clearTimeout(timeoutId);

    const text = result.text || "";
    if (!text.trim()) return emptyFacts();

    let parsed: Partial<{
      entities: unknown;
      dataPoints: unknown;
      quotes: unknown;
      arguments: unknown;
    }> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return emptyFacts();
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return emptyFacts();
      }
    }

    const cleanStr = (x: unknown): string | null => {
      if (typeof x !== "string") return null;
      const trimmed = x.trim();
      return trimmed.length > 0 && trimmed.length < 300 ? trimmed : null;
    };

    const entities = Array.isArray(parsed.entities)
      ? (parsed.entities as unknown[])
          .map(cleanStr)
          .filter((v): v is string => v !== null)
          .slice(0, 12)
      : [];
    const dataPoints = Array.isArray(parsed.dataPoints)
      ? (parsed.dataPoints as unknown[])
          .map(cleanStr)
          .filter((v): v is string => v !== null)
          .slice(0, 12)
      : [];
    const quotes = Array.isArray(parsed.quotes)
      ? (parsed.quotes as unknown[])
          .map(cleanStr)
          .filter((v): v is string => v !== null)
          .map((q) => (q.length > MAX_QUOTE_CHARS ? q.slice(0, MAX_QUOTE_CHARS) : q))
          .slice(0, 6)
      : [];
    const argumentsList = Array.isArray(parsed.arguments)
      ? (parsed.arguments as unknown[])
          .map(cleanStr)
          .filter((v): v is string => v !== null)
          .slice(0, 5)
      : [];

    const usage = result.usageMetadata;
    return {
      entities,
      dataPoints,
      quotes,
      arguments: argumentsList,
      durationMs: Date.now() - start,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      skipped: false,
    };
  } catch (err) {
    console.warn(
      "[source-ner] falha silenciosa:",
      err instanceof Error ? err.message : err
    );
    return emptyFacts();
  }
}

/**
 * Monta o bloco "MUST CITE" pra injetar no userMessage do writer.
 * Só emite se pelo menos uma lista tem conteúdo.
 */
export function formatFactsBlock(facts: SourceFacts): string {
  if (facts.skipped) return "";
  const { entities, dataPoints, quotes, arguments: args } = facts;
  const hasAnything =
    entities.length > 0 || dataPoints.length > 0 || quotes.length > 0 || args.length > 0;
  if (!hasAnything) return "";

  const lines: string[] = [];
  lines.push("# FACTS DO SOURCE — CITE EXPLICITAMENTE");
  if (entities.length > 0) {
    lines.push(`Entities: ${entities.join(", ")}`);
  }
  if (dataPoints.length > 0) {
    lines.push(`DataPoints: ${dataPoints.join(", ")}`);
  }
  if (quotes.length > 0) {
    lines.push(
      `Quotes: ${quotes.map((q) => `"${q.replace(/"/g, "'")}"`).join("; ")}`
    );
  }
  if (args.length > 0) {
    lines.push(`Arguments: ${args.join(" | ")}`);
  }
  lines.push("");
  lines.push(
    "TESTE: 60% dos slides DEVE conter pelo menos 1 item das listas acima."
  );
  lines.push(
    "Se não citar entidades/dados específicos, o carrossel está rejeitado. Preservar nomes e numeros LITERAIS — nao parafrasear."
  );
  return lines.join("\n");
}
