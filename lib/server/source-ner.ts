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
  /** Resumo editorial 3-5 bullets do que e a fonte. */
  summary: string[];
  /**
   * Fatos CONCRETOS com contexto em frases completas.
   * Exemplo ruim (palavra-chave): "25%", "Bitcoin", "54K".
   * Exemplo bom (contexto): "25% dos investidores montaram posicoes na faixa 54K-72K do Bitcoin, formando uma base estrutural pra proxima alta."
   * Writer usa essas frases como ground truth — cita literalmente, nao precisa
   * inventar o contexto em volta.
   */
  keyPoints: string[];
  /** Ainda extraimos entidades puras — usado pra imageQuery fallback. */
  entities: string[];
  /** Ainda extraimos data points — referencia rapida. */
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
    summary: [],
    keyPoints: [],
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
    ? `Você é um extrator de FATOS CONTEXTUALIZADOS para produção de conteúdo. Analise o texto abaixo e extraia:

1. SUMMARY — 3 a 5 bullets editorial em português BR que resumem o que o autor/speaker defende. Cada bullet max 140 chars. ESPECÍFICO (com nomes, números) — não genérico.

2. KEY POINTS (CRÍTICO — principal entrega) — 10 a 15 FRASES COMPLETAS em português BR que capturam os fatos e afirmações principais da fonte COM CONTEXTO inline. Cada frase 40 a 220 chars. Formato: afirmação + dado/número + contexto mínimo que dê sentido.
   RUIM: "25%", "Bitcoin na faixa 54K"
   BOM: "25% dos investidores atuais montaram posição entre 54K e 72K, formando a base estrutural do Bitcoin pra próxima alta."
   BOM: "Empresas americanas estão comprando Bitcoin como proteção contra a queda do dólar em 2024, segundo o speaker."
   CADA frase precisa poder virar slide de carrossel SEM o redator ter que inventar nada ao redor.
   ZERO frases vagas. Zero paráfrases genéricas. Zero "muitas empresas fazem X" — SEMPRE cite o dado/entidade/quem-fez.

3. ENTITIES — 5 a 10 nomes próprios literais do texto (pessoas, empresas, produtos, lugares, tokens, ferramentas).

4. DATA POINTS — 5 a 10 números/percentuais/datas/valores literais do texto. Preserve unidade.

5. QUOTES — 3 a 5 frases de impacto LITERAIS do speaker (max 80 chars cada). Palavras exatas, zero paráfrase.

6. ARGUMENTS — 3 argumentos centrais do speaker (1 frase cada, max 120 chars).

REGRAS GERAIS:
- Zero invenção. Zero inferência. Só extração.
- Se dado não existe no texto, NÃO liste.
- KEY POINTS é o mais importante — é o que o redator vai usar pra escrever cada slide. Se vieram só 3 keyPoints curtos, você falhou.

TEXTO:
"""
${sliced}
"""

Retorne APENAS JSON, sem markdown:
{"summary":[], "keyPoints":[], "entities":[], "dataPoints":[], "quotes":[], "arguments":[]}`
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
          // 15 keyPoints de 200 chars cada ≈ 3000 chars ≈ 1500 tokens,
          // + summary + quotes + arguments + entities + dataPoints ≈ +1500.
          // Cap 3500 já acomoda o JSON completo com folga e reduz latência
          // (antes 5000, reduzido em 2026-04-22 pra ganhar ~1s no NER).
          maxOutputTokens: 3500,
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
      summary: unknown;
      keyPoints: unknown;
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

    const summary = Array.isArray(parsed.summary)
      ? (parsed.summary as unknown[])
          .map(cleanStr)
          .filter((v): v is string => v !== null)
          .map((s) => (s.length > 200 ? s.slice(0, 200) : s))
          .slice(0, 6)
      : [];
    const keyPoints = Array.isArray(parsed.keyPoints)
      ? (parsed.keyPoints as unknown[])
          .map(cleanStr)
          .filter((v): v is string => v !== null)
          // descartar frases curtas demais (<30 chars) — provavel que venham sem contexto
          .filter((s) => s.length >= 30)
          .map((s) => (s.length > 260 ? s.slice(0, 260) : s))
          .slice(0, 18)
      : [];
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
      summary,
      keyPoints,
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
 * Prioridade 2026-04-22 (v2): keyPoints como PRIMARY — frases completas com
 * contexto que viram slide direto. Entities/dataPoints/quotes como apoio.
 */
export function formatFactsBlock(facts: SourceFacts): string {
  if (facts.skipped) return "";
  const { summary, keyPoints, entities, dataPoints, quotes, arguments: args } =
    facts;
  const hasAnything =
    keyPoints.length > 0 ||
    summary.length > 0 ||
    entities.length > 0 ||
    dataPoints.length > 0 ||
    quotes.length > 0 ||
    args.length > 0;
  if (!hasAnything) return "";

  const lines: string[] = [];
  lines.push("# FACTS DO SOURCE — USE COMO GROUND TRUTH");
  if (summary.length > 0) {
    lines.push("");
    lines.push("RESUMO DA FONTE (do que o speaker defende):");
    summary.forEach((s) => lines.push(`- ${s}`));
  }
  if (keyPoints.length > 0) {
    lines.push("");
    lines.push(
      "KEY POINTS — frases completas com dado + contexto. CADA slide deve se ancorar em 1 keyPoint. Use texto literal ou edite minimamente pra caber no slide — NUNCA reescreva perdendo o dado ou a especificidade:"
    );
    keyPoints.forEach((k, i) => lines.push(`${i + 1}. ${k}`));
  }
  if (quotes.length > 0) {
    lines.push("");
    lines.push(
      "QUOTES LITERAIS do speaker (se couber no carrossel, use como slide de impacto com aspas):"
    );
    quotes.forEach((q) => lines.push(`- "${q.replace(/"/g, "'")}"`));
  }
  if (args.length > 0) {
    lines.push("");
    lines.push("ARGUMENTOS CENTRAIS:");
    args.forEach((a) => lines.push(`- ${a}`));
  }
  if (entities.length > 0) {
    lines.push("");
    lines.push(
      `ENTIDADES pra imageQuery (use em imagens de slides correspondentes): ${entities.join(", ")}`
    );
  }
  if (dataPoints.length > 0) {
    lines.push(`DATA POINTS literais disponíveis: ${dataPoints.join(", ")}`);
  }
  lines.push("");
  lines.push(
    "REGRAS DE USO:",
    "- 70% dos slides DEVEM ancorar em 1 keyPoint específico (nome, número, fato do source).",
    "- NUNCA substituir nome próprio por termo genérico ('a empresa' → ERRADO, 'Anthropic' → CERTO).",
    "- NUNCA arredondar/inventar número. Se source disse '25%', slide diz '25%'.",
    "- Se inventar dado ou parafrasear pra generico, o carrossel é rejeitado."
  );
  return lines.join("\n");
}
