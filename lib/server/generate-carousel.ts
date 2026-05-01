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
import { translateSourceIfNeeded } from "@/lib/server/translate-source";
import {
  describeImages,
  type ImageDescription,
} from "@/lib/server/describe-images";

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
  requiredCta: string | null;
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

  // Briefing pode pedir CTA explícita: "cta: 'X'", "no final escreva 'X'",
  // "termina com 'X'", "call to action: ...". Quando detecta, vira ordem
  // direta e VENCE a regra estilística "CTA semântico" do system prompt.
  const ctaPatterns = [
    /(?:c\.?t\.?a\.?|call\s+to\s+action|chamada\s+(?:final|para\s+a[çc][ãa]o))\s*(?:deve\s+ser|tem\s+que\s+ser|precisa\s+ser|exata|exato|literal)?\s*[:=]\s*["“”'‘’]{1,2}([^"“”'‘’]{3,240})["“”'‘’]{1,2}/i,
    /(?:c\.?t\.?a\.?|call\s+to\s+action)\s+["“”'‘’]{1,2}([^"“”'‘’]{3,240})["“”'‘’]{1,2}/i,
    /(?:no\s+final|[uú]ltimo\s+slide|slide\s+final|fechar?|encerre?|termina(?:r|e)?)\s+(?:com|colocar?|escreve(?:r|ndo)?|coloque)\s*:?\s*["“”'‘’]{1,2}([^"“”'‘’]{3,240})["“”'‘’]{1,2}/i,
  ];
  let requiredCta: string | null = null;
  for (const p of ctaPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      requiredCta = m[1].trim();
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
    .filter(
      (q) => !!q && q !== requiredTitle && q !== requiredCta,
    );
  const literalQuotes = Array.from(new Set(quoteMatches)).slice(0, 5);

  return {
    requiredTitle,
    requiredCta,
    strictFidelity,
    referenceWithTwist,
    literalQuotes,
  };
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

  // ── 1.5. Pré-tradução do source quando idioma divergente ──
  // Sem isso, o writer com regra "cite literal do source" copia o idioma
  // original e ignora a LANGUAGE pedida pelo usuário.
  sourceContent = await translateSourceIfNeeded(sourceContent, language);

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

  // Detecta contagem explícita de slides/tópicos no brief do user.
  // Bug 28/04: user pediu "cada página = 1 dos 6 tópicos do vídeo" e a
  // IA gerou 16 slides. Aqui parseamos sinais explícitos e travamos a
  // contagem antes do writer, dependente de `advNumSlides` não estar
  // setado (Modo Avançado vence).
  function detectSlideCountFromBrief(brief: string): {
    count: number;
    semantics: "exact-slides" | "topics-plus-shell";
  } | null {
    if (!brief) return null;
    const text = brief
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // "8 slides", "12 paginas"
    const slidesMatch = text.match(
      /\b(\d{1,2})\s*(slides?|paginas?|cards?)\b/
    );
    if (slidesMatch) {
      const n = parseInt(slidesMatch[1], 10);
      if (n >= 3 && n <= 20) {
        return { count: n, semantics: "exact-slides" };
      }
    }

    // "6 topicos", "5 partes", "4 secoes", "3 etapas", "7 passos" —
    // semântica = capa + N + CTA (slides totais = N + 2)
    const topicsMatch = text.match(
      /\b(\d{1,2})\s*(topicos?|topicos|partes?|seco?es?|etapas?|passos?|fases?|pontos?|itens?)\b/
    );
    if (topicsMatch) {
      const n = parseInt(topicsMatch[1], 10);
      if (n >= 2 && n <= 18) {
        return { count: n, semantics: "topics-plus-shell" };
      }
    }
    return null;
  }

  const detectedCount =
    advNumSlides == null ? detectSlideCountFromBrief(topic) : null;
  const explicitSlideCount = detectedCount
    ? detectedCount.semantics === "topics-plus-shell"
      ? detectedCount.count + 2 // capa + N tópicos + CTA
      : detectedCount.count
    : null;
  if (explicitSlideCount) {
    console.log(
      `[generate-carousel] slide count explícito detectado: ${detectedCount?.count} ${detectedCount?.semantics} → ${explicitSlideCount} slides`
    );
  }
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

  // Visão prévia das imagens — Gemini Flash analisa cada imagem ANTES do writer
  // pra que a copy de cada slide case semanticamente com a imagem correspondente.
  let imageDescriptions: ImageDescription[] = [];
  if (advUploadedImages.length > 0) {
    try {
      imageDescriptions = await describeImages(advUploadedImages);
      console.log(
        `[generate-carousel] describe-images: ${imageDescriptions.length} imagens analisadas`
      );
    } catch (err) {
      console.warn("[describe-images] falhou, seguindo sem visão:", err);
    }
  }

  const advContentFramework = advanced?.contentFramework ?? null;
  const advancedActive = !!(
    advCustomCta ||
    advHookDirection ||
    advExtraContext ||
    advNumSlides ||
    advPreferredStyle ||
    advContentFramework ||
    explicitSlideCount
  );

  // Contagem final que vai pro prompt — prioridade:
  // 1. advNumSlides (Modo Avançado, user explícito via UI)
  // 2. explicitSlideCount (detectado no brief: "8 slides", "6 tópicos")
  // 3. null → modelo escolhe entre 6-10
  const enforcedSlideCount = advNumSlides ?? explicitSlideCount;
  const slideCountInstruction = enforcedSlideCount
    ? `EXATAMENTE ${enforcedSlideCount}`
    : "6-10";
  const slideCountStrictBlock = enforcedSlideCount
    ? `

🔒 REGRA INVIOLÁVEL #2 — CONTAGEM DE SLIDES
NUMERO DE SLIDES = EXATAMENTE ${enforcedSlideCount}. Nem mais, nem menos.
${
  detectedCount?.semantics === "topics-plus-shell"
    ? `O usuário pediu ${detectedCount.count} tópicos. Estrutura obrigatória:
- Slide 1: capa (cover)
- Slides 2 a ${enforcedSlideCount - 1}: cada um cobre exatamente UM dos ${detectedCount.count} tópicos da fonte/brief — não invente tópicos extras, não funda dois em um.
- Slide ${enforcedSlideCount}: CTA final.`
    : `Capa + miolo + CTA cabem dentro de ${enforcedSlideCount}. Não estoure.`
}
Se você gerar diferente, o output será REJEITADO.
`
    : "";

  // CTA do user — vem do Modo Avançado (UI explícita) OU detectada no
  // briefing (ex: "cta: 'comenta X que eu te mando Y'"). Modo Avançado
  // tem precedência. Quando ativa, vira REGRA INVIOLÁVEL #3 e SOBRESCREVE
  // a regra estilística "# LAST SLIDE — CTA SEMÂNTICO" do system prompt.
  const userMandatedCta = (advCustomCta || overrides.requiredCta || "")
    .trim()
    .slice(0, 300);
  const ctaStrictBlock = userMandatedCta
    ? `

🔒 REGRA INVIOLÁVEL #3 — CTA DO USUÁRIO
O CTA do ÚLTIMO SLIDE deve ser EXATAMENTE: """${userMandatedCta}"""
Pode ajustar formatação leve (caixa, pontuação, quebra de linha), MAS NUNCA o conteúdo, a ação ou as palavras-chave.
Esta regra VENCE qualquer outra instrução deste prompt — incluindo "CTA semântico", lista de PROIBIDOS (mesmo "salva esse carrossel" / "me siga" / "comenta X" estão liberados se foi o que o user pediu), exemplos de CTA padrão, e qualquer regra estilística.
Se a CTA do user for "salva esse carrossel", o último slide DEVE conter "salva esse carrossel" — não substitua por CTA "criativo".
Se gerar CTA diferente, o output será REJEITADO.
`
    : "";

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
${advHookDirection ? `- Gancho deve: ${advHookDirection}\n` : ""}${advCustomCta ? `- CTA final EXATO: "${advCustomCta}"\n` : ""}${enforcedSlideCount ? `- Número de slides: EXATAMENTE ${enforcedSlideCount}.\n` : ""}${advPreferredStyle ? `- Estilo forçado: APENAS "${advPreferredStyle}"\n` : ""}${advContentFramework ? `- Framework: ${frameworkSpec[advContentFramework]}\n` : ""}${advExtraContext ? `- Contexto adicional:\n"""\n${advExtraContext}\n"""\n` : ""}
`
    : "";

  // ── 4. Prompts (copiados da rota, mantendo paridade) ──
  const layoutOnlyPrompt = `🔒 REGRA INVIOLÁVEL #1 — IDIOMA DA SAÍDA

LANGUAGE = ${language === "pt-br" ? "português brasileiro (pt-BR)" : language}

Esta regra VENCE qualquer outra instrução deste prompt — incluindo "fidelidade ao source", citações literais, exemplos. Se o source/refs estão em outro idioma, você TRADUZ E ADAPTA mantendo significado, não copia o idioma original.

Exceção única: nomes próprios (pessoas, marcas, ferramentas), termos técnicos universalmente conhecidos (API, framework, ROI), e códigos/símbolos. TUDO o mais é traduzido.

Use "você" (não "tu" ou "tú"). Tom natural brasileiro, não Portugal.

Você é um FORMATADOR de texto em slides. PRESERVE O WORDING, PRESERVE A ORDEM, PRESERVE DADOS E NOMES, PRESERVE O CTA. Zero reescrita. Divide em ${slideCountInstruction} slides. Retorne variations com 1 item. ${languageInstruction} ${advancedBlock}${slideCountStrictBlock}${ctaStrictBlock}

# OUTPUT
\`\`\`json
{"variations":[{"title":"...","style":"story","ctaType":"save","slides":[{"heading":"...","body":"...","imageQuery":"english keywords","variant":"cover|solid-brand|full-photo-bottom|text-only|cta","imageRef":"number 1-based ou null"}]}]}
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

  const writerPrompt = `🔒 REGRA INVIOLÁVEL #1 — IDIOMA DA SAÍDA

LANGUAGE = ${language === "pt-br" ? "português brasileiro (pt-BR)" : language}

Esta regra VENCE qualquer outra instrução deste prompt — incluindo "fidelidade ao source", citações literais, exemplos. Se o source/refs estão em outro idioma, você TRADUZ E ADAPTA mantendo significado, não copia o idioma original.

Exceção única: nomes próprios (pessoas, marcas, ferramentas), termos técnicos universalmente conhecidos (API, framework, ROI), e códigos/símbolos. TUDO o mais é traduzido.

Use "você" (não "tu" ou "tú"). Tom natural brasileiro, não Portugal.

You are a narrative architect for Instagram carousels and LinkedIn document posts.

# REGRA DE LINGUAGEM
Escreva como se uma criança de 12 anos precisasse entender sem reler. Frases curtas (max 18 palavras). Palavras do dia a dia. Zero jargão. Se puder usar palavra simples, use. Sem "ecossistema", "narrativa", "ruptura", "paradigma", "sinergia", "disrupção".

${languageInstruction}
TONE: ${tone || "professional"}
NICHE: ${niche || "general"}
${nicheGuide}
${advancedBlock}${slideCountStrictBlock}${ctaStrictBlock}
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
Create 1 carousel (${slideCountInstruction} slides) built on NARRATIVE TENSION.

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

# LAST SLIDE — CTA SEMÂNTICO (default)
CTA = melhor linha do carrossel. (a) FECHA loop do slide 1, (b) ação específica ao conteúdo, (c) opcional prova social. PROIBIDO: "salva esse carrossel", "me siga", "manda pra aquele amigo", "comente X abaixo", qualquer genérico.
**EXCEÇÃO:** se REGRA INVIOLÁVEL #3 (CTA do usuário) está ativa acima, ela VENCE este default — use a CTA exata pedida, mesmo que caia em "PROIBIDO".

# RADICAL SPECIFICITY
BANIDAS: "muitas pessoas", "resultados incríveis", "game-changer", "nesse sentido", "atualmente", "e por isso que", "a maioria", "muito tempo", "grandes resultados", "descubra como", "o segredo", "guia definitivo".
REQUIRED: todo claim tem número, nome próprio, ou exemplo concreto.

# IMAGE QUERY — só pra slides que MERECEM imagem
**REGRA NOVA 28/04:** nem todo slide precisa de imagem. Só ~50% dos slides
costumam fazer sentido com imagem. Resto fica forte em texto puro.

QUANDO INCLUIR imageQuery (deixa string preenchida):
- Slide 1 (cover) — SEMPRE. Capa precisa de imagem forte.
- Slide menciona pessoa específica (criador, executivo, autor)
- Slide menciona produto/marca específico (iPhone, Bitcoin, Tesla)
- Slide menciona lugar/cena concreta (escritório, palco, cidade)
- Slide tem dado/número visual (gráfico, tela, mockup)
- Slide é testimonial/quote — imagem da pessoa citada

QUANDO NÃO INCLUIR (deixa imageQuery: "" string vazia):
- Slide 100% texto/conceito abstrato (transição, recap, definição)
- Slide com lista pura de bullets
- CTA (último slide) — geralmente texto + ação
- Slide que repete visual já mostrado em outro

Slide 1 (cover) = OBRIGATÓRIO ter imageQuery. Outros slides = você decide
baseado no conteúdo. Em geral, mire em ~50% dos slides com imagem.

REGRAS DE QUALIDADE quando preencher:
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
        {"heading":"string","body":"string","imageQuery":"english keywords concrete scene","variant":"cover"|"solid-brand"|"full-photo-bottom"|"text-only"|"cta","imageRef": number | null}
      ]
    }
  ]
}
${slideCountInstruction} slides por variação.`;

  // ── 5. Source slice + facts block ──
  const SOURCE_SLICE = sourceType === "video" ? 18000 : 10000;

  const overrideLines: string[] = [];
  if (overrides.requiredTitle) {
    overrideLines.push(
      `• TÍTULO OBRIGATÓRIO (capa): "${overrides.requiredTitle}" — exato, sem parafraseio.`
    );
  }
  if (userMandatedCta) {
    overrideLines.push(
      `• CTA OBRIGATÓRIA (último slide): "${userMandatedCta}" — exata, sem parafraseio. Vence regra "CTA semântico".`
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

  // Bloco de imagens do usuário — injetado ANTES do conteúdo principal pra que
  // o writer associe semanticamente cada slide às imagens disponíveis.
  // O modelo deve retornar `imageRef` (1-based) em cada slide que quiser usar imagem.
  const imagesBlock =
    imageDescriptions.length > 0
      ? `\n\n# IMAGENS QUE O USER QUER USAR (você DEVE incorporar nos slides certos)\n${imageDescriptions
          .map(
            (img, i) =>
              `- Imagem #${i + 1}: ${img.kind} · ${img.description} · mood ${img.mood}`
          )
          .join("\n")}\n\nREGRA: cada slide que use imagem deve ter copy que CASA com a imagem. Você decide a ORDEM pelo conteúdo. Devolva no JSON: slides[i].imageRef = índice (1, 2, 3...) da imagem que casa, ou null se não usar imagem nesse slide.`
      : "";

  const userMessage =
    overrides.strictFidelity && sourceContent
      ? // Fidelidade literal força layout-only
        sourceContent
        ? `${overridesBlock}TEXTO PRA FORMATAR EM SLIDES (${sourceType}):${sourceFidelityBlock}${factsBlockPrefix}${imagesBlock}\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""${topic && topic.trim().length > 50 ? `\n\nContexto:\n${topic.slice(0, 1000)}` : ""}`
        : `${overridesBlock}TEXTO PRA FORMATAR EM SLIDES:${imagesBlock}\n\n"""\n${topic}\n"""`
      : mode === "layout-only"
        ? sourceContent
          ? `${overridesBlock}TEXTO PRA FORMATAR (${sourceType}):${sourceFidelityBlock}${factsBlockPrefix}${imagesBlock}\n\n"""\n${sourceContent.slice(0, SOURCE_SLICE)}\n"""`
          : `${overridesBlock}TEXTO DO USUÁRIO PRA FORMATAR:${imagesBlock}\n\n"""\n${topic}\n"""`
        : sourceContent
          ? `${overridesBlock}Create 3 carousel variations (data, story, provocative) based on:\n\nTopic: ${topic}${sourceFidelityBlock}${factsBlockPrefix}${imagesBlock}\n\nSource (${sourceType}):\n${sourceContent.slice(0, SOURCE_SLICE)}`
          : `${overridesBlock}Create 3 carousel variations (data, story, provocative) about: ${topic}${imagesBlock}`;

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
  // Perf calibration 2026-04-22: thinkingBudget 16000 → 12000 e output
  // 14000 → 10000. Paridade com app/api/generate/route.ts. Ganho P50 ~3-5s
  // sem queda perceptível de qualidade (10k output cabe 3 variations x 10 slides).
  const thinkingBudget = effectiveMode === "layout-only" ? 2000 : 12000;
  const maxOutputTokens = effectiveMode === "layout-only" ? 10000 : 10000;
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

  // Hard truncate: se o user pediu N slides explícito (via Modo Avançado
  // OU detecção no brief tipo "6 tópicos"), e o modelo desobedeceu, corta
  // pra contagem certa. Mantém capa (slide 0) e CTA (último slide), corta
  // o miolo. Bug 28/04: user pediu 8 slides, modelo deu 16; agora trunca
  // pra 8 mantendo a capa + 6 do meio + CTA.
  if (enforcedSlideCount && enforcedSlideCount >= 3) {
    for (const variation of finalVariations) {
      if (!variation.slides || variation.slides.length === enforcedSlideCount) {
        continue;
      }
      const slides = variation.slides;
      if (slides.length > enforcedSlideCount) {
        const cover = slides[0];
        const cta = slides[slides.length - 1];
        const middleNeeded = enforcedSlideCount - 2;
        const middleAvailable = slides.slice(1, -1);
        // Pega os primeiros N-2 do miolo (ordem narrativa preservada).
        const middle = middleAvailable.slice(0, middleNeeded);
        variation.slides = [cover, ...middle, cta];
        console.log(
          `[generate-carousel] truncate: ${slides.length} → ${variation.slides.length} slides (enforced=${enforcedSlideCount})`
        );
      }
      // Se vier menos que enforced, deixa rolar — não dá pra inventar
      // slides com qualidade pós-fato. Toast no front pode avisar.
    }
  }
  // Pós-processamento de imagens do usuário.
  // Se o modelo retornou imageRef (1-based) nos slides, usa esse mapeamento semântico.
  // Fallback posicional (comportamento antigo) cobre slides sem imageRef.
  if (advUploadedImages.length > 0 && finalVariations[0]?.slides) {
    // Etapa 1: aplica imageRef do modelo (mapeamento semântico)
    for (let i = 0; i < finalVariations[0].slides.length; i++) {
      const slide = finalVariations[0].slides[i] as {
        imageUrl?: string;
        imageRef?: number;
      };
      if (
        typeof slide.imageRef === "number" &&
        slide.imageRef >= 1 &&
        slide.imageRef <= advUploadedImages.length
      ) {
        slide.imageUrl = advUploadedImages[slide.imageRef - 1];
      }
    }
    // Etapa 2: fallback posicional para slides que ainda não têm imageUrl
    // (cobre o caso onde o modelo não retornou imageRef ou ignorou a instrução)
    const usedIndices = new Set<number>();
    for (const s of finalVariations[0].slides) {
      const ref = (s as { imageRef?: number }).imageRef;
      if (typeof ref === "number" && ref >= 1 && ref <= advUploadedImages.length) {
        usedIndices.add(ref - 1);
      }
    }
    let nextUnused = 0;
    for (let i = 0; i < finalVariations[0].slides.length; i++) {
      const slide = finalVariations[0].slides[i] as { imageUrl?: string };
      if (slide.imageUrl) continue; // já tem imagem (via imageRef)
      while (usedIndices.has(nextUnused) && nextUnused < advUploadedImages.length) {
        nextUnused++;
      }
      if (nextUnused < advUploadedImages.length) {
        slide.imageUrl = advUploadedImages[nextUnused];
        usedIndices.add(nextUnused);
        nextUnused++;
      }
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
