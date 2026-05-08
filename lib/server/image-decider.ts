/**
 * Image Decider — agente Gemini 2.5 Flash que decide, slide a slide, se a
 * melhor imagem é SEARCH (foto real de entidade específica) ou GENERATE
 * (imagem cinematográfica gerada por IA).
 *
 * Racional:
 *   - Heurística antiga alternava par/ímpar → Serper/Gemini. Problema: quando
 *     o slide fala de "Satoshi lendo um papel no banheiro" o ideal era BUSCAR
 *     foto real do Satoshi, não gerar algo abstrato. E vice-versa: quando o
 *     slide é um conceito abstrato ("princípio da escassez"), buscar stock
 *     photo dá sempre resultado genérico e fraco.
 *
 *   - Decider usa o Gemini pra ler heading+body (+ NER facts) e decidir:
 *       • ENTIDADE NOMEADA famosa → mode="search", searchQuery específico
 *       • CONCEITO / METÁFORA / PRINCÍPIO → mode="generate", StructuredImagePrompt
 *       • CAPA (slide 1) → sempre mode="generate" (cinematográfico)
 *
 *   - StructuredImagePrompt é um JSON com campos ricos (subject, composition,
 *     lighting, mood, palette, camera, textures, negative) que o caller junta
 *     num prompt de 300-500 chars no formato Imagen-4/Flash-Image.
 *
 * Custo: ~$0.0003 por decisão (Gemini 2.5 Flash, thinkingBudget 0). Carrossel
 * de 8 slides ≈ $0.0024 extras. Negligível vs custo de gerar 4 imagens Imagen
 * ($0.032) ou 4 imagens Flash Image ($0.032).
 */

import { GoogleGenAI } from "@google/genai";
import {
  getDesignTemplateMeta,
  type DesignTemplateId,
} from "@/lib/carousel-templates";

const TIMEOUT_MS = 12_000;

/**
 * 2026-05-08 — Por padrão TODO slide é gerado por IA (Gemini Flash Image /
 * Imagen 4). Search/Stock continuam disponíveis no image-picker quando o
 * user troca manualmente um slide pós-geração — só não são o caminho
 * default do pipeline. Motivação: consistência visual cinematográfica
 * em todo carrossel, sem depender de qualidade variável do estoque.
 *
 * Toggle via env `IMAGE_DECIDER_MODE`:
 *   - "generate-only" (default) → sempre gera com IA
 *   - "auto" → decider clássico (search | stock | generate)
 */
const DECIDER_MODE: "generate-only" | "auto" =
  process.env.IMAGE_DECIDER_MODE === "auto" ? "auto" : "generate-only";

export interface StructuredImagePrompt {
  /** Sujeito principal da cena. Ex: "founder sitting alone at laptop at dusk". */
  subject: string;
  /** Regras de composição. Ex: "rule of thirds, subject upper third, bottom third simpler". */
  composition: string;
  /** Iluminação detalhada. Ex: "blue hour + amber practicals, rim light on face". */
  lighting: string;
  /** Humor/emoção. Ex: "cinematic thriller, uneasy tension". */
  mood: string;
  /** Paleta dominante (3-5 cores). Ex: ["navy blue", "amber", "charcoal"]. */
  palette: string[];
  /** Especificações de câmera. Ex: "35mm prime, shallow DoF, film grain". */
  camera: string;
  /** Texturas enfatizadas. Ex: "skin pores, wool fabric, scratched desk". */
  textures: string;
  /** Negative prompt inline (reforço). */
  negative: string;
  /** Sempre 1:1 (Instagram carousel). */
  aspectRatio: "1:1";
}

export type ImageDeciderMode = "search" | "stock" | "generate";

export interface ImageDecision {
  mode: ImageDeciderMode;
  /** Preenchido quando mode="search". Query específica de Google Images. */
  searchQuery?: string;
  /**
   * Preenchido quando mode="stock". Query curta/genérica pra Unsplash
   * (2-4 palavras em inglês, conceito abstrato clássico).
   */
  stockQuery?: string;
  /** Preenchido quando mode="generate". JSON estruturado. */
  generatePrompt?: StructuredImagePrompt;
  /** Log/debug — 1 frase explicando a decisão. */
  reasoning: string;
}

export interface ImageDeciderInput {
  heading: string;
  body: string;
  slideNumber: number;
  totalSlides: number;
  isCover: boolean;
  niche?: string;
  tone?: string;
  /** Descrição da estética da marca (de profile.brand_analysis.__image_aesthetic). */
  brandAesthetic?: string;
  /** Facts extraídos via NER do source (quando disponível). */
  facts?: {
    entities: string[];
    dataPoints: string[];
    summary: string[];
  };
  /**
   * Regras aprendidas com feedback pós-download (profile.brand_analysis.
   * __generation_memory.image_rules). Ex: "imagens mais minimalistas",
   * "menos saturação", "sem pessoas com rosto na frente". Peso ALTO.
   */
  imageRules?: string[];
  /**
   * Template visual escolhido pelo user. Decider usa pra ajustar style guide,
   * paleta e modifier estético do StructuredImagePrompt — garantindo que
   * imagens fiquem coerentes com a referência visual do template (manifesto,
   * twitter, ambitious, blank, etc).
   */
  designTemplate?: DesignTemplateId;
}

/**
 * Chama o Gemini Flash 2.5 e retorna a decisão estruturada. NUNCA lança — em
 * caso de falha, devolve um fallback "generate" com prompt genérico baseado no
 * heading, garantindo que o pipeline continua.
 */
export async function decideSlideImage(
  input: ImageDeciderInput
): Promise<ImageDecision> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return fallbackDecision(input, "GEMINI_API_KEY missing");
  }

  const prompt =
    DECIDER_MODE === "generate-only"
      ? buildGenerateOnlyPrompt(input)
      : buildDeciderPrompt(input);

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const result = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () =>
          reject(new Error("image-decider timeout"))
        )
      ),
    ]);
    clearTimeout(timeout);

    const text = result.text || "";
    if (!text.trim()) {
      return fallbackDecision(input, "empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return fallbackDecision(input, "unparseable JSON");
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return fallbackDecision(input, "unparseable JSON (retry)");
      }
    }

    const decision = normalizeDecision(parsed, input);
    if (!decision) return fallbackDecision(input, "invalid decision shape");
    return decision;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fallbackDecision(input, `error: ${msg}`);
  }
}

// ─────────────────────────────────────────────────────────
// Prompt construction
// ─────────────────────────────────────────────────────────

function buildDeciderPrompt(input: ImageDeciderInput): string {
  const {
    heading,
    body,
    slideNumber,
    totalSlides,
    isCover,
    niche,
    tone,
    brandAesthetic,
    facts,
    imageRules,
    designTemplate,
  } = input;

  // Template lock — força o decider a respeitar paleta + modifier estético
  // do template visual. Sem isso, ele inventa palette própria que conflita
  // com o template render.
  const tmplMeta = designTemplate
    ? getDesignTemplateMeta(designTemplate)
    : null;
  const templateBlock = tmplMeta
    ? `
## TEMPLATE VISUAL ESCOLHIDO (REGRA INVIOLÁVEL — não improvise)
- Template: "${tmplMeta.name}" (id: ${tmplMeta.id})
- Style guide: ${tmplMeta.styleGuidePrompt}
- Modifier estético OBRIGATÓRIO em todas as 8 imagens deste carrossel: "${tmplMeta.slideAestheticModifier}"
- Paleta PREFERIDA (use só essas cores no campo palette do StructuredImagePrompt): ${tmplMeta.preferPalette.join(", ")}
- Paleta PROIBIDA (NUNCA use, conflita com accent): ${tmplMeta.avoidPalette.join(", ") || "(nenhuma)"}

Se você gerar StructuredImagePrompt, o campo palette DEVE conter APENAS cores do "preferida". Mood + lighting devem ser coerentes com o style guide acima.`
    : "";

  const factsBlock =
    facts && (facts.entities.length || facts.dataPoints.length || facts.summary.length)
      ? `
FACTS DO SOURCE (use pra entidades nomeadas):
- Entidades: ${facts.entities.slice(0, 10).join(", ") || "(nenhuma)"}
- Data points: ${facts.dataPoints.slice(0, 8).join(", ") || "(nenhum)"}
- Resumo: ${facts.summary.slice(0, 3).join(" | ") || "(vazio)"}`
      : "";

  const imageRulesBlock =
    Array.isArray(imageRules) && imageRules.length > 0
      ? `
## DIRETRIZES DO USER PARA IMAGENS (respeitar sempre, peso ALTO — vindas de feedback passado):
${imageRules.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join("\n")}
Se o prompt gerado violar qualquer regra acima, o slide será rejeitado.`
      : "";

  const coverRule = isCover
    ? `
REGRA CRITICA: ESTE É O SLIDE DE CAPA (slide 1 de ${totalSlides}). SEMPRE use mode="generate" com StructuredImagePrompt cinematográfico MAXIMUM DRAMA. Capa precisa parar o scroll em 0.3s. Nunca search na capa.`
    : "";

  return `Você é um DIRETOR DE ARTE escolhendo a melhor imagem para um slide de carrossel Instagram. Decida entre 3 modos:

1. mode="search" — buscar foto REAL via Google Images.
   USE QUANDO: o slide fala de uma ENTIDADE NOMEADA específica e real — pessoa famosa viva ou morta (Satoshi Nakamoto, Elon Musk, Steve Jobs, Vitalik Buterin, Warren Buffett), empresa específica (Anthropic, Tesla, OpenAI, Apple, Uniswap), produto específico (iPhone 15, Ledger Nano, Model S), lugar real conhecido (Vale do Silício, Bolsa de NY, Dubai), evento real nomeado (Bitcoin halving 2024, SEC v. Ripple, queda da FTX).
   Search funciona porque existe foto real dessa coisa — gerar com IA daria pior resultado.

2. mode="stock" — buscar foto editorial no Unsplash (grátis, qualidade editorial).
   USE QUANDO: o slide fala de CONCEITO ABSTRATO CLÁSSICO — produtividade, café, foco, trabalho, leitura, fim de semana, criatividade, descanso, reunião, parceria, viagem, natureza, cidade, escritório, equipe, computador, ambiente de trabalho. Conceito que aparece em milhões de fotos editoriais de alta qualidade, NÃO precisa de cena específica inventada.
   Stock vence generate nesses casos porque: (a) foto real tem qualidade editorial irretocável, (b) economiza custo de geração IA, (c) responde mais rápido.

3. mode="generate" — gerar imagem com Gemini/Imagen usando StructuredImagePrompt cinematográfico.
   USE QUANDO: o slide fala de METÁFORA VISUAL ESPECÍFICA, cena conceitual ÚNICA que stock não capturaria (escassez como cofre se fechando, ganância como mão quebrando moeda, solidão do fundador às 3am, decisão difícil no limiar de uma porta, ruptura literal, transformação metamórfica, ciclo de mercado como onda quebrando). Cenas que precisam de composição cinematográfica inventada, drama máximo, direção de arte original. Também quando é conceito abstrato FORTE mas sem match óbvio no estoque editorial (princípios, emoções muito específicas).

4. CONTEÚDO MISTO: escolha o que vai dar imagem MAIS IMPACTANTE e específica. Se tem entidade nomeada FORTE → search. Se é conceito clássico com estoque abundante → stock. Se é metáfora única/cinematográfica → generate.
${coverRule}

CONTEXTO DO SLIDE:
- Slide ${slideNumber} de ${totalSlides}${isCover ? " (CAPA)" : ""}
- Heading: "${heading}"
- Body: "${body.slice(0, 500)}"
${niche ? `- Nicho: ${niche}` : ""}
${tone ? `- Tom: ${tone}` : ""}
${brandAesthetic ? `- Estética da marca: ${brandAesthetic.slice(0, 300)}` : ""}
${factsBlock}
${imageRulesBlock}
${templateBlock}

REGRAS DE OUTPUT:

Se mode="search":
- searchQuery: 4-8 palavras em INGLÊS, específico, nomeando a entidade. Ex: "Satoshi Nakamoto portrait mysterious figure", "Vitalik Buterin Ethereum conference 2024", "Anthropic headquarters San Francisco office".
- NÃO use termos genéricos ("strategy", "business", "innovation"). Nome próprio sempre.
- generatePrompt: omita (pode deixar null).

Se mode="stock":
- stockQuery: 2-4 palavras em INGLÊS, CURTO e GENÉRICO — termos que existem em estoque editorial abundante. Ex: "morning coffee", "focused work", "reading book", "weekend leisure", "team meeting", "creative workspace", "city skyline night", "laptop desk".
- NÃO use nomes próprios ou conceitos muito específicos. Stock = termo genérico amplo.
- searchQuery e generatePrompt: omita.

Se mode="generate":
- searchQuery: omita.
- generatePrompt: objeto JSON com TODOS estes campos preenchidos de forma rica e cinematográfica:
  • subject: quem/o quê aparece na cena + ação/estado. 1 frase em inglês, concreta. Ex: "founder sitting alone at laptop at dusk, hand on forehead".
  • composition: regras de enquadramento. Ex: "rule of thirds, subject in upper-left, bottom third simpler for text overlay, negative space right side".
  • lighting: iluminação intencional. Ex: "blue hour + amber desk lamp practicals, rim light from window, hard shadow on wall".
  • mood: emoção/atmosfera. Ex: "cinematic thriller, uneasy tension, introspective".
  • palette: array de 3-5 cores dominantes em inglês. Ex: ["navy blue", "amber", "charcoal", "cream"].
  • camera: especificações. Ex: "35mm prime lens, shallow depth of field, subtle film grain, medium shot".
  • textures: texturas enfatizadas. Ex: "skin pores, wool fabric weave, scratched wood desk, dust particles in light beam".
  • negative: o que evitar. Ex: "no text, no letters, no logos, no visible screens with UI, no stock-photo generic expression".
  • aspectRatio: sempre "1:1".

REGRAS GERAIS:
- Reasoning: 1 frase curta explicando POR QUÊ escolheu search ou generate (pra log). Ex: "slide cita Anthropic especificamente, search traz foto real da empresa" ou "slide fala de medo/ganancia do investidor, conceito abstrato sem entidade real".
- ZERO markdown. Retorne APENAS JSON válido.
- ZERO texto na imagem (negative deve proibir).

Formato de resposta (JSON puro):
{
  "mode": "search" | "stock" | "generate",
  "searchQuery": "string (só se mode=search)",
  "stockQuery": "string (só se mode=stock)",
  "generatePrompt": { ... StructuredImagePrompt ... } OR null,
  "reasoning": "1 frase explicando a escolha"
}`;
}

/**
 * Versão enxuta do prompt — usada quando DECIDER_MODE="generate-only".
 * Pula a árvore de decisão (search/stock/generate) e foca em produzir
 * um StructuredImagePrompt cinematográfico de alta qualidade pra cada
 * slide. Reduz tokens (~40%) e melhora consistência visual.
 */
function buildGenerateOnlyPrompt(input: ImageDeciderInput): string {
  const {
    heading,
    body,
    slideNumber,
    totalSlides,
    isCover,
    niche,
    tone,
    brandAesthetic,
    facts,
    imageRules,
    designTemplate,
  } = input;

  const tmplMeta = designTemplate
    ? getDesignTemplateMeta(designTemplate)
    : null;
  const templateBlock = tmplMeta
    ? `
## TEMPLATE VISUAL ESCOLHIDO (REGRA INVIOLÁVEL — não improvise)
- Template: "${tmplMeta.name}" (id: ${tmplMeta.id})
- Style guide: ${tmplMeta.styleGuidePrompt}
- Modifier estético OBRIGATÓRIO em todas as imagens deste carrossel: "${tmplMeta.slideAestheticModifier}"
- Paleta PREFERIDA (use só essas cores no campo palette): ${tmplMeta.preferPalette.join(", ")}
- Paleta PROIBIDA (NUNCA use, conflita com accent): ${tmplMeta.avoidPalette.join(", ") || "(nenhuma)"}`
    : "";

  const factsBlock =
    facts && (facts.entities.length || facts.dataPoints.length || facts.summary.length)
      ? `
FACTS DO SOURCE:
- Entidades: ${facts.entities.slice(0, 10).join(", ") || "(nenhuma)"}
- Data points: ${facts.dataPoints.slice(0, 8).join(", ") || "(nenhum)"}
- Resumo: ${facts.summary.slice(0, 3).join(" | ") || "(vazio)"}`
      : "";

  const imageRulesBlock =
    Array.isArray(imageRules) && imageRules.length > 0
      ? `
## DIRETRIZES DO USER PARA IMAGENS (peso ALTO):
${imageRules.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join("\n")}`
      : "";

  const coverHint = isCover
    ? "ESTE É A CAPA (slide 1). MAXIMUM DRAMA, scroll-stopping em 0.3s."
    : "Slide de body — coerente com a capa, sem competir com ela.";

  return `Você é um DIRETOR DE ARTE produzindo a imagem de um slide de carrossel Instagram.
Sua tarefa: gerar um StructuredImagePrompt cinematográfico e específico baseado no conteúdo do slide.
Toda imagem é gerada por IA (Imagen 4 / Gemini Flash Image) — não há busca em estoque.

CONTEXTO DO SLIDE:
- Slide ${slideNumber} de ${totalSlides}${isCover ? " (CAPA)" : ""}
- Heading: "${heading}"
- Body: "${body.slice(0, 500)}"
${niche ? `- Nicho: ${niche}` : ""}
${tone ? `- Tom: ${tone}` : ""}
${brandAesthetic ? `- Estética da marca: ${brandAesthetic.slice(0, 300)}` : ""}
${factsBlock}
${imageRulesBlock}
${templateBlock}

DIRETRIZ: ${coverHint}

REGRAS DE OUTPUT:

mode: SEMPRE "generate" (modo único ativo).

generatePrompt — objeto JSON com TODOS estes campos preenchidos de forma rica e cinematográfica:
- subject: quem/o quê aparece + ação/estado. 1 frase em inglês, concreta. Use entidades nomeadas (NER) quando o slide as cita. Ex: "founder sitting alone at laptop at dusk, hand on forehead" / "Vitalik Buterin profile silhouette against Ethereum-themed background".
- composition: regras de enquadramento. Ex: "rule of thirds, subject in upper-left, bottom third simpler for text overlay, negative space right side".
- lighting: iluminação intencional. Ex: "blue hour + amber desk lamp practicals, rim light from window, hard shadow on wall".
- mood: emoção/atmosfera. Ex: "cinematic thriller, uneasy tension, introspective".
- palette: array de 3-5 cores em inglês.${tmplMeta ? ` USE APENAS cores da preferida acima.` : ""} Ex: ["navy blue", "amber", "charcoal", "cream"].
- camera: especificações. Ex: "35mm prime lens, shallow depth of field, subtle film grain, medium shot".
- textures: texturas enfatizadas. Ex: "skin pores, wool fabric weave, scratched wood desk, dust particles in light beam".
- negative: o que evitar. Ex: "no text, no letters, no logos, no visible UI, no stock-photo cliches".
- aspectRatio: sempre "1:1".

reasoning: 1 frase curta explicando a direção criativa (pra log).

ZERO markdown. Retorne APENAS JSON válido.
ZERO texto na imagem (negative deve proibir).

Formato de resposta (JSON puro):
{
  "mode": "generate",
  "generatePrompt": { ... StructuredImagePrompt ... },
  "reasoning": "1 frase explicando a direção criativa"
}`;
}

// ─────────────────────────────────────────────────────────
// Parsing / normalization
// ─────────────────────────────────────────────────────────

function normalizeDecision(
  raw: unknown,
  input: ImageDeciderInput
): ImageDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rawMode = typeof r.mode === "string" ? r.mode.toLowerCase().trim() : "";
  let mode: ImageDeciderMode;
  if (rawMode === "search") mode = "search";
  else if (rawMode === "stock") mode = "stock";
  else if (rawMode === "generate") mode = "generate";
  else return null;

  // Capa sempre força generate — blindagem contra decisões erradas do model.
  if (input.isCover) {
    mode = "generate";
  }

  // Modo generate-only (default 2026-05-08): força generate em todo slide.
  // User pode trocar imagens manualmente via image-picker depois.
  if (DECIDER_MODE === "generate-only") {
    mode = "generate";
  }

  const reasoning =
    typeof r.reasoning === "string" && r.reasoning.trim()
      ? r.reasoning.trim().slice(0, 300)
      : "(sem reasoning)";

  if (mode === "search") {
    const searchQuery =
      typeof r.searchQuery === "string" && r.searchQuery.trim()
        ? r.searchQuery.trim().slice(0, 200)
        : null;
    if (!searchQuery) return null;
    return { mode: "search", searchQuery, reasoning };
  }

  if (mode === "stock") {
    const stockQuery =
      typeof r.stockQuery === "string" && r.stockQuery.trim()
        ? r.stockQuery.trim().slice(0, 80)
        : typeof r.searchQuery === "string" && r.searchQuery.trim()
          ? r.searchQuery.trim().slice(0, 80)
          : null;
    if (!stockQuery) {
      // Stock sem query cai pra generate (fallback seguro).
      const structured = normalizeStructuredPrompt(r.generatePrompt, input);
      return { mode: "generate", generatePrompt: structured, reasoning };
    }
    return { mode: "stock", stockQuery, reasoning };
  }

  // mode === "generate"
  const structured = normalizeStructuredPrompt(r.generatePrompt, input);
  return { mode: "generate", generatePrompt: structured, reasoning };
}

function normalizeStructuredPrompt(
  raw: unknown,
  input: ImageDeciderInput
): StructuredImagePrompt {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (v: unknown, fallback: string, maxLen = 400): string => {
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, maxLen);
    return fallback;
  };
  const arr = (v: unknown, fallback: string[], maxLen = 60): string[] => {
    if (Array.isArray(v)) {
      const cleaned = v
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => x.length > 0)
        .map((x) => x.slice(0, maxLen))
        .slice(0, 6);
      if (cleaned.length > 0) return cleaned;
    }
    return fallback;
  };

  // P0-4 do audit: heading costuma estar em PT-BR mas Imagen é treinado em
  // inglês — "editorial scene inspired by: PARE DE OTIMIZAR LANDING PAGE"
  // gera resultado degradado. Preferimos entity nomeada (NER), depois niche
  // genérico. Heading só entra se nada melhor existir, e mesmo assim
  // marcamos como "subject from non-english brief" pra Imagen entender que
  // é texto fora do dicionário canônico.
  const firstEntity =
    Array.isArray(input.facts?.entities) && input.facts.entities.length > 0
      ? String(input.facts.entities[0]).slice(0, 80)
      : "";
  const nicheFallback =
    typeof input.niche === "string" && input.niche && input.niche !== "general"
      ? `${input.niche} concept scene`
      : "abstract minimal editorial composition";
  const fallbackSubject = firstEntity
    ? `editorial scene featuring ${firstEntity}`
    : nicheFallback;
  return {
    subject: s(r.subject, fallbackSubject),
    composition: s(
      r.composition,
      "rule of thirds, subject upper third, bottom third simpler and darker for text overlay"
    ),
    lighting: s(
      r.lighting,
      "dramatic directional light, rim light + key light, amber/blue contrast"
    ),
    mood: s(r.mood, "cinematic editorial, powerful, scroll-stopping"),
    palette: arr(r.palette, ["navy blue", "amber", "charcoal"]),
    camera: s(
      r.camera,
      "35mm prime lens, shallow depth of field, medium shot, subtle film grain"
    ),
    textures: s(
      r.textures,
      "natural skin texture, fabric weave, authentic material grain"
    ),
    negative: s(
      r.negative,
      "no text, no letters, no logos, no readable UI, no stock-photo cliches"
    ),
    aspectRatio: "1:1",
  };
}

/**
 * Fallback seguro quando decider falha. Gera decisão "generate" com
 * StructuredImagePrompt genérico baseado no heading. Capa sempre generate.
 */
function fallbackDecision(
  input: ImageDeciderInput,
  reason: string
): ImageDecision {
  return {
    mode: "generate",
    generatePrompt: normalizeStructuredPrompt({}, input),
    reasoning: `(fallback: ${reason})`,
  };
}

/**
 * Monta prompt final pro Imagen-4 / Gemini Flash Image a partir do structured.
 * Formato inspirado em ai.google.dev/gemini-api/docs/image-generation.
 * Target: ~300-500 chars (sem contar rules NO-TEXT do caller).
 */
export function buildImagePromptFromStructured(
  s: StructuredImagePrompt
): string {
  const palette = s.palette.length > 0 ? s.palette.join(", ") : "editorial palette";
  return `A photorealistic ${s.camera} of ${s.subject}. ${s.composition}. Lit by ${s.lighting}, creating ${s.mood}. Emphasizing ${s.textures}. Palette: ${palette}. Aspect ratio ${s.aspectRatio}. ${s.negative}`
    .replace(/\s+/g, " ")
    .trim();
}
