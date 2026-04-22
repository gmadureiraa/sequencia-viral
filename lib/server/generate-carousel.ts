/**
 * Core de geração de carrossel — refatorado pra função exportada e reutilizável.
 *
 * A rota `/api/generate` é o CLIENTE PRINCIPAL (com auth, quota, feedback, etc).
 * A rota `/api/admin/generate-batch` também usa essa função pra rodar N testes
 * sem duplicar a lógica.
 *
 * Responsabilidades:
 * - Extrair source content (video/link/IG)
 * - Rodar NER pre-processing (fatos estruturados)
 * - Montar o systemPrompt + userMessage final
 * - Chamar o Gemini (Pro ou Flash dependendo do mode)
 * - Retornar variations normalizadas + prompt usado + tokens/custo
 *
 * NÃO faz: auth, quota check, persistência — essas ficam na rota.
 */

import type { DesignTemplateId } from "@/lib/carousel-templates";
import { GoogleGenAI } from "@google/genai";
import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import {
  extractSourceFacts,
  emptyFacts,
  formatFactsBlock,
  type SourceFacts,
} from "@/lib/server/source-ner";

export type GenerationMode = "writer" | "layout-only";
export type SlideVariant =
  | "cover"
  | "headline"
  | "photo"
  | "quote"
  | "split"
  | "cta"
  | "solid-brand"
  | "text-only"
  | "full-photo-bottom";

export const VALID_VARIANTS: readonly SlideVariant[] = [
  "cover",
  "headline",
  "photo",
  "quote",
  "split",
  "cta",
  "solid-brand",
  "text-only",
  "full-photo-bottom",
] as const;

export interface Slide {
  heading: string;
  body: string;
  imageQuery: string;
  variant: SlideVariant;
  imageUrl?: string;
}

export interface Variation {
  title: string;
  style: "data" | "story" | "provocative";
  ctaType?: "save" | "comment" | "share";
  slides: Slide[];
}

export interface GenerationArgs {
  topic: string;
  sourceType: "idea" | "link" | "video" | "instagram" | "ai";
  sourceUrl?: string;
  niche: string;
  tone: string;
  language: string;
  designTemplate?: DesignTemplateId;
  mode?: GenerationMode;
  brandContext?: string;
  feedbackContext?: string;
  /**
   * Modo avançado — passa-through dos campos do user.
   */
  advanced?: {
    customCta?: string;
    hookDirection?: string;
    numSlides?: number;
    preferredStyle?: "data" | "story" | "provocative";
    extraContext?: string;
    uploadedImageUrls?: string[];
    contentFramework?:
      | "story-arc"
      | "problem-solution"
      | "mechanism-first"
      | "transformation";
  };
}

export interface GenerationResult {
  variations: Variation[];
  /** systemPrompt + userMessage final, concatenado. */
  promptUsed: string;
  /** Fatos extraídos via NER (pra log). */
  facts: SourceFacts;
  /** Extracted source content pre-trunc (pra log). */
  sourceContentChars: number;
  /** Método / caminho da extração do source. */
  sourceExtractionMethod: string;
  /** Tokens Gemini do writer (sem contar NER). */
  writerInputTokens: number;
  writerOutputTokens: number;
  /** Model usado. */
  writerModel: string;
  /** Total de ms da execução completa. */
  durationMs: number;
  /** Mode efetivamente rodado (strictFidelity força layout-only). */
  effectiveMode: GenerationMode;
}

// ─────────────────────────────────────────────────────────
// Helpers internos (copiados do route.ts; mantemos paridade).
// ─────────────────────────────────────────────────────────

function parseBriefingOverrides(topic: string): {
  requiredTitle: string | null;
  strictFidelity: boolean;
  referenceWithTwist: boolean;
  literalQuotes: string[];
} {
  const text = topic || "";
  const titlePatterns = [
    /(?:o\s+)?t[ií]tulo\s+(?:deve\s+ser|tem\s+que\s+ser|precisa\s+ser|ser[áa])\s*:?\s*["“”'‘’]{1,2}([^"“”'‘’]{3,200})["“”'‘’]{1,2}/i,
    /(?:o\s+)?t[ií]tulo\s*:\s*["“”'‘’]{1,2}([^"“”'‘’]{3,200})["“”'‘’]{1,2}/i,
    /(?:the\s+)?title\s+(?:should\s+be|must\s+be|has\s+to\s+be)\s*:?\s*["“”'‘’]{1,2}([^"“”'‘’]{3,200})["“”'‘’]{1,2}/i,
  ];
  let requiredTitle: string | null = null;
  for (const p of titlePatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      requiredTitle = m[1].trim();
      break;
    }
  }
  const strictFidelity =
    /siga\s+exat(a|amente)|reproduz(a|ir)\s+(o|esse|este)\s+conte[úu]do|copie\s+(o|esse|este)\s+conte[úu]do|use\s+o\s+mesmo\s+texto|exatamente\s+o\s+mesmo|palavra\s+por\s+palavra|verbatim/i.test(
      text
    );
  const referenceWithTwist =
    !strictFidelity &&
    /use\s+como\s+(refer[êe]ncia|inspira[çc][ãa]o|exemplo|base)|baseado\s+em|inspir(ado|ada|e-se)|no\s+estilo\s+de/i.test(
      text
    );
  const quoteMatches = Array.from(
    text.matchAll(/["“”'‘’]{1,2}([^"“”'‘’]{4,180})["“”'‘’]{1,2}/g)
  )
    .map((m) => m[1].trim())
    .filter((q) => !!q && q !== requiredTitle);
  const literalQuotes = Array.from(new Set(quoteMatches)).slice(0, 5);

  return { requiredTitle, strictFidelity, referenceWithTwist, literalQuotes };
}

/**
 * Lista banida de keywords genéricas no imageQuery. Se bater qualquer uma,
 * rejeita e força fallback.
 */
const BANNED_IMAGE_KEYWORDS = [
  "strategy",
  "innovation",
  "growth",
  "ai",
  "future",
  "success",
  "business",
  "digital",
  "mindset",
  "impact",
  "transformation",
  "leadership",
  "teamwork",
  "collaboration",
  "technology",
  "synergy",
  "professional",
  "corporate",
];

export function validateImageQuery(q: string): {
  ok: boolean;
  reason?: string;
} {
  if (!q || typeof q !== "string") return { ok: false, reason: "empty" };
  const trimmed = q.trim();
  if (trimmed.length < 4) return { ok: false, reason: "too_short" };
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 4) return { ok: false, reason: "few_words" };
  const lower = trimmed.toLowerCase();
  for (const bad of BANNED_IMAGE_KEYWORDS) {
    // Regex de palavra inteira pra não pegar "ai" dentro de "aim"
    const re = new RegExp(`(^|[^a-z])${bad}([^a-z]|$)`, "i");
    if (re.test(lower)) {
      return { ok: false, reason: `banned:${bad}` };
    }
  }
  return { ok: true };
}

/**
 * Fallback pra imageQuery rejeitado. Usa entidade do NER (quando disponível)
 * + slice do heading + modifier cinematográfico.
 */
export function buildFallbackImageQuery(
  heading: string,
  body: string,
  facts: SourceFacts
): string {
  const entity = facts.entities[0] || "";
  const headingClean = heading
    .toLowerCase()
    .replace(/[^a-zà-ú0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 3 && !BANNED_IMAGE_KEYWORDS.includes(w))
    .slice(0, 3)
    .join(" ");
  const seed = entity || headingClean || "person hand close up";
  const bodyHint = body
    ? body
        .toLowerCase()
        .replace(/[^a-z\s]/gi, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 4 &&
            !BANNED_IMAGE_KEYWORDS.includes(w) &&
            !["which", "there", "these", "those", "about"].includes(w)
        )
        .slice(0, 2)
        .join(" ")
    : "";
  return `${seed} ${bodyHint} cinematic documentary natural light close-up`
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVariant(
  raw: unknown,
  index: number,
  total: number
): SlideVariant {
  if (typeof raw === "string") {
    const v = raw.toLowerCase().trim() as SlideVariant;
    if (VALID_VARIANTS.includes(v)) {
      switch (v) {
        case "photo":
          return "full-photo-bottom";
        case "headline":
          return "solid-brand";
        case "quote":
          return "text-only";
        case "split":
          return "solid-brand";
        default:
          return v;
      }
    }
  }
  return fallbackVariant(index, total);
}

function fallbackVariant(index: number, total: number): SlideVariant {
  if (total <= 1) return "cover";
  if (index === 0) return "cover";
  if (index === total - 1) return "cover";
  if (index === total - 2) return "full-photo-bottom";
  const rotation: SlideVariant[] = [
    "solid-brand",
    "full-photo-bottom",
    "solid-brand",
    "full-photo-bottom",
    "text-only",
    "solid-brand",
    "full-photo-bottom",
  ];
  return rotation[(index - 1) % rotation.length];
}

// ─────────────────────────────────────────────────────────
// Orchestrator principal
// ─────────────────────────────────────────────────────────

export async function runGeneration(
  args: GenerationArgs
): Promise<GenerationResult> {
  const startedAt = Date.now();
  const {
    topic,
    sourceType,
    sourceUrl,
    niche,
    tone,
    language,
    advanced,
    brandContext = "",
    feedbackContext = "",
  } = args;
  const mode: GenerationMode =
    args.mode === "layout-only" ? "layout-only" : "writer";

  // ── 1. Source extraction ──
  let sourceContent = "";
  let extractionMethod = "none";
  if (sourceType === "link" && sourceUrl) {
    sourceContent = await extractContentFromUrl(sourceUrl);
    extractionMethod = "url-extractor";
  } else if (sourceType === "video" && sourceUrl) {
    sourceContent = await getYouTubeTranscript(sourceUrl);
    extractionMethod = "youtube-transcript";
  } else if (sourceType === "instagram" && sourceUrl) {
    const { extractInstagramContent } = await import(
      "@/lib/instagram-extractor"
    );
    sourceContent = await extractInstagramContent(sourceUrl);
    extractionMethod = "instagram-apify";
  }

  // ── 2. NER pre-processing ──
  const facts = sourceContent
    ? await extractSourceFacts(sourceContent, language)
    : emptyFacts();

  // ── 3. Overrides do briefing ──
  const overrides = parseBriefingOverrides(topic);

  // Advanced sanitization
  const advCustomCta =
    typeof advanced?.customCta === "string"
      ? advanced.customCta.trim().slice(0, 300)
      : "";
  const advHookDirection =
    typeof advanced?.hookDirection === "string"
      ? advanced.hookDirection.trim().slice(0, 400)
      : "";
  const advExtraContext =
    typeof advanced?.extraContext === "string"
      ? advanced.extraContext.trim().slice(0, 2000)
      : "";
  const advNumSlides =
    typeof advanced?.numSlides === "number" &&
    advanced.numSlides >= 6 &&
    advanced.numSlides <= 12
      ? Math.round(advanced.numSlides)
      : null;
  const advPreferredStyle =
    advanced?.preferredStyle === "data" ||
    advanced?.preferredStyle === "story" ||
    advanced?.preferredStyle === "provocative"
      ? advanced.preferredStyle
      : null;
  const advUploadedImages = Array.isArray(advanced?.uploadedImageUrls)
    ? advanced.uploadedImageUrls
        .filter((u): u is string => typeof u === "string" && u.length < 2000)
        .slice(0, 12)
    : [];
  const advContentFramework = advanced?.contentFramework ?? null;
  const advancedActive = !!(
    advCustomCta ||
    advHookDirection ||
    advExtraContext ||
    advNumSlides ||
    advPreferredStyle ||
    advContentFramework
  );

  const langCode = (language || "pt-br").toLowerCase();
  const isPtBr = langCode === "pt-br" || langCode === "pt";
  const languageInstruction = isPtBr
    ? `LANGUAGE: PORTUGUÊS BRASILEIRO (pt-BR). Escreva TODO o conteúdo em pt-BR coloquial, "você" (não "tu"). Imagem queries em inglês.`
    : langCode === "en"
      ? "LANGUAGE: ENGLISH. Write heading, body, CTA in English."
      : langCode === "es"
        ? "LANGUAGE: ESPAÑOL."
        : `LANGUAGE: ${language}`;

  const frameworkSpec: Record<string, string> = {
    "story-arc":
      "ARQUITETURA STORY-ARC: Slide 1 capa contraintuitiva, 2 cenário antigo, 3 ruptura, 4-N-1 nova realidade, último CTA callback.",
    "problem-solution":
      "ARQUITETURA PROBLEM-SOLUTION: 1 sintoma concreto, 2 problema real, 3 fricção central, 4-5 mecanismo, 6-N-1 aplicação, último CTA.",
    "mechanism-first":
      "ARQUITETURA MECHANISM-FIRST: 1 afirmação contraintuitiva, 2 por que acontece, 3 evidência, 4-5 implicação sistêmica, 6 exceção, 7+ aplicação, último CTA.",
    transformation:
      "ARQUITETURA TRANSFORMATION: 1 cena inicial forte, 2-3 transformação com costura, 4-5 o que virou a chave, 6+ nova realidade, último CTA.",
  };

  const advancedBlock = advancedActive
    ? `
# MODO AVANÇADO — DIRECIONAMENTOS EXPLÍCITOS DO USUÁRIO (prioridade alta)
${advHookDirection ? `- Gancho deve: ${advHookDirection}\n` : ""}${advCustomCta ? `- CTA final EXATO: "${advCustomCta}"\n` : ""}${advNumSlides ? `- Número de slides: EXATAMENTE ${advNumSlides}.\n` : ""}${advPreferredStyle ? `- Estilo forçado: APENAS "${advPreferredStyle}"\n` : ""}${advContentFramework ? `- Framework: ${frameworkSpec[advContentFramework]}\n` : ""}${advExtraContext ? `- Contexto adicional:\n"""\n${advExtraContext}\n"""\n` : ""}
`
    : "";

  // ── 4. Prompts (copiados da rota, mantendo paridade) ──
  const layoutOnlyPrompt = `Você é um FORMATADOR de texto em slides. PRESERVE O WORDING, PRESERVE A ORDEM, PRESERVE DADOS E NOMES, PRESERVE O CTA. Zero reescrita. Divide em 6-10 slides. Retorne variations com 1 item. ${languageInstruction} ${advancedBlock}

# OUTPUT
\`\`\`json
{"variations":[{"title":"...","style":"story","ctaType":"save","slides":[{"heading":"...","body":"...","imageQuery":"english keywords","variant":"cover|solid-brand|full-photo-bottom|text-only|cta"}]}]}
\`\`\``;

  const nicheGuide =
    niche && niche !== "general"
      ? `
# NICHE CONTEXTUALIZATION
Nicho: **${niche}**. Todo exemplo/nome/ferramenta/número do carrossel DEVE ser do nicho.
- crypto/web3: BTC, ETH, SOL, Uniswap, Aave, Vitalik, halving, $USDC, Binance
- ai: Claude, GPT-5, Gemini 2.5, Cursor, agents, MCP, Sam Altman, Dario Amodei
- marketing: HubSpot, LinkedIn, TikTok, CAC, LTV, SEO, Harry Dry
- business: ARR, MRR, YC, a16z, Buffett
Se não tem fato específico, use grounding. Proibido: "empresa X", números sem atribuição, analogias fora do nicho.`
      : "";

  const writerPrompt = `You are a narrative architect for Instagram carousels and LinkedIn document posts.

# REGRA DE LINGUAGEM
Escreva como se uma criança de 12 anos precisasse entender sem reler. Frases curtas (max 18 palavras). Palavras do dia a dia. Zero jargão. Se puder usar palavra simples, use. Sem "ecossistema", "narrativa", "ruptura", "paradigma", "sinergia", "disrupção".

${languageInstruction}
TONE: ${tone || "professional"}
NICHE: ${niche || "general"}
${nicheGuide}
${advancedBlock}
${
  brandContext
    ? `
# BRAND VOICE INTEGRATION
${brandContext}
WEAVE brand signals into content. Carousel must sound like THIS creator wrote it.
`
    : ""
}${
    feedbackContext
      ? `
# LEARNING FROM USER FEEDBACK
${feedbackContext}
Feedback vence instrução genérica.
`
      : ""
  }

# YOUR MISSION
Create 1 carousel (6-10 slides) built on NARRATIVE TENSION.

# REFERÊNCIA EDITORIAL PREMIUM (BrandsDecoded)
- **CAPA**: "Afirmação Contraintuitiva + Pergunta de Aprofundamento" 12-25 palavras CAIXA ALTA.
- **Estrutura 3 atos**: Slide 2 setup, 3 ruptura, 4+ nova realidade, último CTA.
- UMA ideia por slide. Título curto CAPS 3-6 palavras + parágrafo <=40 palavras.
- Tom analítico (decodificador de mercado, não guru).
- CTA DM-lead: "Comenta X que eu te mando Y na DM."

# GROUND TRUTH
NUNCA INVENTE números, empresas, nomes, valores, datas, fontes. Se a fonte não traz: use derivação com caveat, ou anedota, ou remova métrica. Especificidade vem de NOMES CONCRETOS, não números fabricados.

# HOOK ARCHETYPE LIBRARY — 12 arquétipos
Escolha 1 por variação. 3 variações = 3 arquétipos diferentes.
1. DATA SHOCK, 2. CONFESSION, 3. ENEMY NAMING, 4. FORBIDDEN KNOWLEDGE, 5. ANTI-GURU, 6. SPECIFIC LOSS, 7. TIME COMPRESSION, 8. BEFORE/AFTER, 9. RITUAL EXPOSÉ, 10. META-CRITIQUE, 11. STATUS GAME, 12. QUESTION DE RUPTURA.
Hook slide 1: max 8 palavras. Body slide 1 abre LOOP que próximo slide fecha.

# STAIRCASE RULE
Planeje escada antes. Slide N responde pergunta do N-1. Papéis: SETUP, CLAIM, EVIDENCE, MECHANISM, EXCEPTION, APPLICATION, STAKES, TWIST, CALLBACK-CTA. Nunca 2 seguidos iguais.

# MICRO-CLIFFHANGERS
Cada body termina puxando próximo. PROIBIDO: "mas tem um detalhe que muda tudo", "esse não é nem o maior problema", "e aqui que a maioria para", "aguenta aí". Invente cliffhangers específicos.

# LAST SLIDE — CTA SEMÂNTICO
CTA = melhor linha do carrossel. (a) FECHA loop do slide 1, (b) ação específica ao conteúdo, (c) opcional prova social. PROIBIDO: "salva esse carrossel", "me siga", "manda pra aquele amigo", "comente X abaixo", qualquer genérico.

# RADICAL SPECIFICITY
BANIDAS: "muitas pessoas", "resultados incríveis", "game-changer", "nesse sentido", "atualmente", "e por isso que", "a maioria", "muito tempo", "grandes resultados", "descubra como", "o segredo", "guia definitivo".
REQUIRED: todo claim tem número, nome próprio, ou exemplo concreto.

# IMAGE QUERY — cinematográfica, específica
1. ESPECIFICIDADE TOTAL pro slide: leia heading E body antes. Imagem = cena desse slide.
2. 4-8 keywords em inglês.
3. SUBJECT + AÇÃO/ESTADO + AMBIENTE.
4. Abstrato → converta em cena ("QUEM faz, EM QUAL ambiente, COM QUAL objeto").
5. Se source tem entity relevante ao slide (pessoa, produto, lugar), INCLUA no imageQuery. Ex: slide sobre Bitcoin halving → "bitcoin physical coin close-up macro ledger display golden hour".

MODIFIER POR VARIAÇÃO (coerência):
- data → "close-up macro shallow depth of field 35mm film grain"
- story → "cinematic still hard shadow 35mm film grain warm palette"
- provocative → "editorial documentary natural window light muted palette"

BANIDAS (nunca use): "strategy", "innovation", "growth", "AI", "future", "success", "business", "digital", "mindset", "impact", "transformation", "leadership", "teamwork", "collaboration", "technology", "corporate", "professional", "synergy".
Se imageQuery contém qualquer banida OU tem <4 palavras, REJEITAR e reescrever usando a entity da fonte + cena concreta.

# VARIANT RHYTHM
Slide 1 = "cover" sempre. Último = "cta". Meio alterna "solid-brand" / "full-photo-bottom", com "text-only" como quebra em ponto denso. Nunca 2 iguais seguidos.

# OUTPUT FORMAT
Return valid JSON with 3 variations (data, story, provocative).
{
  "variations": [
    {
      "title": "string",
      "style": "data"|"story"|"provocative",
      "ctaType": "save"|"comment"|"share",
      "slides": [
        {"heading":"string","body":"string","imageQuery":"english keywords concrete scene","variant":"cover"|"solid-brand"|"full-photo-bottom"|"text-only"|"cta"}
      ]
    }
  ]
}
6-10 slides por variação.`;

  // ── 5. Source slice + facts block ──
  const SOURCE_SLICE = sourceType === "video" ? 18000 : 10000;

  const overrideLines: string[] = [];
  if (overrides.requiredTitle) {
    overrideLines.push(
      `• TÍTULO OBRIGATÓRIO (capa): "${overrides.requiredTitle}" — exato, sem parafraseio.`
    );
  }
  if (overrides.strictFidelity) {
    overrideLines.push(
      `• FIDELIDADE LITERAL: siga o wording da fonte.`
    );
  }
  if (overrides.referenceWithTwist) {
    overrideLines.push(
      `• REFERÊNCIA + TWIST: use fonte como base + ângulo próprio.`
    );
  }
  if (overrides.literalQuotes.length > 0) {
    overrideLines.push(
      `• TEXTOS LITERAIS:\n${overrides.literalQuotes.map((q) => `  - "${q}"`).join("\n")}`
    );
  }
  const overridesBlock =
    overrideLines.length > 0
      ? `# ORDENS DIRETAS DO USUÁRIO (PRIORIDADE MÁXIMA)\n${overrideLines.join("\n")}\n\n`
      : "";

  const sourceFidelityBlock = sourceContent
    ? `\n\n# FIDELIDADE AO SOURCE (OBRIGATORIO)
Source = GROUND TRUTH. Cite NOMES PRÓPRIOS, NÚMEROS/DATAS, FRASES DE IMPACTO literais. Não reescreva pra melhorar. Se contradizer regra estilística, fonte vence. imageQuery usa nomes/cenas do source.`
    : "";

  const factsBlock = formatFactsBlock(facts);
  const factsBlockPrefix = factsBlock ? `\n\n${factsBlock}` : "";

  const userMessage =
    overrides.strictFidelity && sourceContent
      ? // Fidelidade literal força layout-only
        sourceContent
        ? `${overridesBlock}TEXTO PRA FORMATAR EM SLIDES (${sourceType}):${sourceFidelityBlock}${factsBlockPrefix}\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""${topic && topic.trim().length > 50 ? `\n\nContexto:\n${topic.slice(0, 1000)}` : ""}`
        : `${overridesBlock}TEXTO PRA FORMATAR EM SLIDES:\n\n"""\n${topic}\n"""`
      : mode === "layout-only"
        ? sourceContent
          ? `${overridesBlock}TEXTO PRA FORMATAR (${sourceType}):${sourceFidelityBlock}${factsBlockPrefix}\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""`
          : `${overridesBlock}TEXTO DO USUÁRIO PRA FORMATAR:\n\n"""\n${topic}\n"""`
        : sourceContent
          ? `${overridesBlock}Create 3 carousel variations (data, story, provocative) based on:\n\nTopic: ${topic}${sourceFidelityBlock}${factsBlockPrefix}\n\nSource (${sourceType}):\n${sourceContent.slice(0, SOURCE_SLICE)}`
          : `${overridesBlock}Create 3 carousel variations (data, story, provocative) about: ${topic}`;

  const effectiveMode: GenerationMode =
    overrides.strictFidelity && sourceContent ? "layout-only" : mode;

  const systemPrompt =
    effectiveMode === "layout-only" ? layoutOnlyPrompt : writerPrompt;

  // ── 6. Call Gemini ──
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY missing");
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const modelId =
    effectiveMode === "layout-only" ? "gemini-2.5-flash" : "gemini-2.5-pro";
  const thinkingBudget = effectiveMode === "layout-only" ? 2000 : 16000;
  const maxOutputTokens = effectiveMode === "layout-only" ? 10000 : 14000;
  const useGrounding = effectiveMode !== "layout-only";

  const fullSystem = useGrounding
    ? `${systemPrompt}\n\n# OUTPUT ONLY VALID JSON\nYour response must be ONLY the JSON — no markdown, no prose.`
    : systemPrompt;

  const genResult = await geminiWithRetry(() =>
    ai.models.generateContent({
      model: modelId,
      contents: `${userMessage}\n\n[variation-seed: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`,
      config: {
        systemInstruction: fullSystem,
        temperature: 0.95,
        topP: 0.95,
        maxOutputTokens,
        ...(useGrounding
          ? { tools: [{ googleSearch: {} }] }
          : { responseMimeType: "application/json" }),
        thinkingConfig: { thinkingBudget },
      },
    })
  );

  const textResponse = genResult.text || "";
  if (!textResponse) throw new Error("Empty response from Gemini");

  let parsed: { variations: unknown };
  try {
    parsed = JSON.parse(textResponse);
  } catch {
    const match = textResponse.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse AI response");
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.variations || !Array.isArray(parsed.variations)) {
    throw new Error("Invalid AI response structure");
  }

  // ── 7. Normalize + validate ──
  const variations: Variation[] = (parsed.variations as unknown[]).map(
    (v) => v as Variation
  );

  for (const variation of variations) {
    if (!variation?.slides || !Array.isArray(variation.slides)) continue;
    const total = variation.slides.length;
    variation.slides = variation.slides.map((s, i) => {
      const raw = s as {
        heading?: unknown;
        body?: unknown;
        imageQuery?: unknown;
        variant?: unknown;
        imageUrl?: unknown;
      };
      const heading =
        typeof raw.heading === "string" && raw.heading.trim()
          ? raw.heading
          : "(sem título)";
      const body =
        typeof raw.body === "string" && raw.body.trim() ? raw.body : "";
      let imageQuery =
        typeof raw.imageQuery === "string" ? raw.imageQuery : "";
      const validation = validateImageQuery(imageQuery);
      if (!validation.ok) {
        imageQuery = buildFallbackImageQuery(heading, body, facts);
      }
      const imageUrl =
        typeof raw.imageUrl === "string" && raw.imageUrl.trim()
          ? raw.imageUrl
          : undefined;
      let variant: SlideVariant;
      if (total <= 1) {
        variant = "cover";
      } else if (i === 0) {
        variant = "cover";
      } else if (i === total - 1) {
        variant = "cta";
      } else {
        variant = normalizeVariant(raw.variant, i, total);
      }
      return {
        heading,
        body,
        imageQuery,
        variant,
        ...(imageUrl ? { imageUrl } : {}),
      };
    });
    // Anti-monotonia
    const contrast: Record<SlideVariant, SlideVariant> = {
      cover: "solid-brand",
      headline: "full-photo-bottom",
      photo: "solid-brand",
      quote: "solid-brand",
      split: "full-photo-bottom",
      cta: "solid-brand",
      "solid-brand": "full-photo-bottom",
      "full-photo-bottom": "solid-brand",
      "text-only": "full-photo-bottom",
    };
    for (let i = 1; i < variation.slides.length; i++) {
      if (variation.slides[i].variant === variation.slides[i - 1].variant) {
        const prev = variation.slides[i - 1].variant;
        variation.slides[i] = {
          ...variation.slides[i],
          variant: contrast[prev] ?? "solid-brand",
        };
      }
    }
  }

  // Advanced post-processing
  let finalVariations = variations;
  if (advPreferredStyle && finalVariations.length > 1) {
    const filtered = finalVariations.filter(
      (v) => v.style === advPreferredStyle
    );
    if (filtered.length > 0) finalVariations = filtered.slice(0, 1);
  }
  if (advUploadedImages.length > 0 && finalVariations[0]?.slides) {
    for (
      let i = 0;
      i < Math.min(advUploadedImages.length, finalVariations[0].slides.length);
      i++
    ) {
      finalVariations[0].slides[i].imageUrl = advUploadedImages[i];
    }
  }

  const usage = genResult.usageMetadata;
  const writerInputTokens = usage?.promptTokenCount ?? 0;
  const writerOutputTokens = usage?.candidatesTokenCount ?? 0;

  const promptUsed = `${fullSystem}\n\n========== USER MESSAGE ==========\n\n${userMessage}`;

  return {
    variations: finalVariations,
    promptUsed,
    facts,
    sourceContentChars: sourceContent.length,
    sourceExtractionMethod: extractionMethod,
    writerInputTokens,
    writerOutputTokens,
    writerModel: modelId,
    durationMs: Date.now() - startedAt,
    effectiveMode,
  };
}
