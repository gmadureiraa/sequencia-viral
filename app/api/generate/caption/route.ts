import { GoogleGenAI } from "@google/genai";
import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  costForTokens,
  recordGeneration,
} from "@/lib/server/generation-log";

export const maxDuration = 45;

interface CaptionSlideInput {
  heading: string;
  body: string;
}

interface CaptionRequest {
  slides: CaptionSlideInput[];
  title: string;
  niche?: string;
  tone?: string;
  language?: string;
}

interface CaptionResponse {
  caption: string;
  hashtags: string[];
}

function sanitizeHashtag(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  // Remove caracteres inválidos (mantém letras unicode, números, _ e #)
  const cleaned = withHash.replace(/[^#\p{L}\p{N}_]/gu, "");
  if (cleaned.length < 2) return null;
  return cleaned;
}

interface BrandContextParts {
  voiceSamples: string;
  tabus: string;
  contentRules: string;
  voicePreference: string;
  audience: string;
  pillars: string;
}

function extractBrandParts(
  ba: Record<string, unknown> | null
): BrandContextParts {
  const empty: BrandContextParts = {
    voiceSamples: "",
    tabus: "",
    contentRules: "",
    voicePreference: "",
    audience: "",
    pillars: "",
  };
  if (!ba || typeof ba !== "object") return empty;
  const voiceSamples = Array.isArray(ba.voice_samples)
    ? (ba.voice_samples as string[])
        .map((s) => (typeof s === "string" ? s.slice(0, 240) : ""))
        .filter(Boolean)
        .join("\n---\n")
    : "";
  const tabus = Array.isArray(ba.tabus)
    ? (ba.tabus as string[]).filter(Boolean).join(", ")
    : "";
  const contentRules = Array.isArray(ba.content_rules)
    ? (ba.content_rules as string[]).filter(Boolean).join("; ")
    : "";
  const voicePreference = (ba.voice_preference as string) || "";
  const audience = (ba.audience_description as string) || "";
  const pillars = Array.isArray(ba.content_pillars)
    ? (ba.content_pillars as string[]).filter(Boolean).join(", ")
    : "";
  return { voiceSamples, tabus, contentRules, voicePreference, audience, pillars };
}

function buildSystemPrompt(params: {
  tone: string;
  language: string;
  niche: string;
  brand: BrandContextParts;
}): string {
  const { tone, language, niche, brand } = params;
  const brandBlock =
    brand.voiceSamples ||
    brand.tabus ||
    brand.contentRules ||
    brand.voicePreference ||
    brand.audience ||
    brand.pillars
      ? `
CONTEXTO DE MARCA (siga religiosamente — melhor legenda genérica do que legenda fora da voz desse criador):
${brand.pillars ? `- Pilares de conteúdo: ${brand.pillars}\n` : ""}${brand.audience ? `- Audiência-alvo: ${brand.audience}\n` : ""}${brand.voicePreference ? `- Preferência de voz: ${brand.voicePreference}\n` : ""}${brand.voiceSamples ? `- Exemplos de voz (imite ritmo, NÃO copie literalmente):\n${brand.voiceSamples}\n` : ""}${brand.tabus ? `- NUNCA use estas palavras/expressões: ${brand.tabus}\n` : ""}${brand.contentRules ? `- Regras obrigatórias: ${brand.contentRules}\n` : ""}`
      : "";
  return `Você é um copywriter editorial brasileiro experiente em conteúdo de Instagram/LinkedIn.

Dada uma sequência de slides de carrossel, escreva a LEGENDA do post seguindo:

ESTRUTURA SEMÂNTICA (não visual — sem separadores tipo "---" ou "━━━"):
- Comece com um hook que REFLETE o slide 1 (sem copiar literal).
- Desenvolva em 1 a 3 parágrafos curtos (max 3 frases cada), com linha em branco entre eles.
- Inclua pelo menos 1 dado concreto OU contraste do carrossel — nunca invente dado novo que não estava nos slides.
- Feche com UMA pergunta genuína OU uma provocação (não "salva esse carrossel").
- Hashtags: 3 a 6 no máximo, TODAS nichadas (zero #love #brasil #instagood). NO LINKEDIN (se \`niche\` indicar): ZERO hashtag.

BANIDO:
- Separadores visuais ("---", "━━━", "===")
- Emojis decorativos
- Clichês: "descubra como", "o segredo", "guia definitivo", "você precisa saber", "muitas pessoas"
- CTA genérico: "salva esse carrossel", "me siga para mais", "manda pra aquele amigo"
- Hashtags mainstream

TOM: ${tone || "profissional, direto, analítico"}
IDIOMA: ${language || "pt-BR"}
NICHO: ${niche || "geral"}
${brandBlock}
Retorne JSON: { "caption": "texto completo com quebras \\n", "hashtags": ["#a", "#b"] }

Importante:
- A "caption" deve conter \\n explicitamente entre parágrafos. SEM separador visual "---".
- Não envolva a caption em aspas extras nem em markdown.
- As hashtags no array NÃO precisam aparecer duplicadas dentro da caption; elas serão renderizadas separadas.
- Total da caption ~500 a 1200 caracteres (conta sem hashtags). Menor e mais denso vence maior e diluído.`;
}

function buildUserMessage(
  slides: CaptionSlideInput[],
  title: string,
  seed: string
): string {
  const slideBlocks = slides
    .map((s, i) => {
      const h = (s.heading || "").trim();
      const b = (s.body || "").trim();
      return `Slide ${i + 1}:\nHeading: ${h || "(vazio)"}\nBody: ${b || "(vazio)"}`;
    })
    .join("\n\n");

  return `Escreva a legenda de um carrossel intitulado "${title || "Sem título"}".

Conteúdo dos slides:

${slideBlocks}

[variation-seed: ${seed}]`;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "generate-caption", user.id),
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Limite de gerações de legenda atingido. Tente novamente em alguns minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(limiter.retryAfterSec) },
        }
      );
    }

    let body: CaptionRequest;
    try {
      body = (await request.json()) as CaptionRequest;
    } catch {
      return Response.json({ error: "Body JSON inválido." }, { status: 400 });
    }

    const { slides, title } = body;
    if (!Array.isArray(slides) || slides.length === 0) {
      return Response.json(
        { error: "Envie ao menos 1 slide (slides[])." },
        { status: 400 }
      );
    }
    if (slides.length > 20) {
      return Response.json(
        { error: "Máximo de 20 slides por legenda." },
        { status: 400 }
      );
    }

    const tone = (body.tone || "profissional, direto, analítico").slice(0, 120);
    const language = (body.language || "pt-BR").slice(0, 12);
    const niche = (body.niche || "").slice(0, 120);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[generate/caption] GEMINI_API_KEY missing");
      return Response.json(
        {
          error:
            "Configure GEMINI_API_KEY no servidor para habilitar a geração automática de legenda.",
          code: "GEMINI_MISSING",
        },
        { status: 503 }
      );
    }

    // Fetch brand context (opcional — se usuário não preencheu, buildSystemPrompt
    // simplesmente omite o bloco de marca).
    let brandParts: BrandContextParts = extractBrandParts(null);
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("brand_analysis")
        .eq("id", user.id)
        .single();
      brandParts = extractBrandParts(
        (prof?.brand_analysis as Record<string, unknown> | null) ?? null
      );
    }

    const systemPrompt = buildSystemPrompt({
      tone,
      language,
      niche,
      brand: brandParts,
    });
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const userMessage = buildUserMessage(slides, title ?? "", seed);

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    let textResponse: string;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const genResult = await geminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: userMessage,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens: 2400,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        })
      );
      textResponse = genResult.text || "";
      const usage = genResult.usageMetadata;
      if (usage) {
        inputTokens = usage.promptTokenCount ?? 0;
        outputTokens = usage.candidatesTokenCount ?? 0;
      }
    } catch (err) {
      console.error("[generate/caption] Gemini error (after retries):", err);
      return Response.json(
        {
          error:
            process.env.NODE_ENV === "production"
              ? "Geração de legenda falhou. Tente novamente."
              : `Geração de legenda falhou. ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    if (!textResponse) {
      return Response.json(
        { error: "Resposta vazia do modelo. Tente novamente." },
        { status: 502 }
      );
    }

    let parsed: { caption?: unknown; hashtags?: unknown };
    try {
      parsed = JSON.parse(textResponse);
    } catch {
      const m = textResponse.match(/\{[\s\S]*\}/);
      if (!m) {
        console.error(
          "[generate/caption] Failed to parse model response:",
          textResponse.slice(0, 500)
        );
        return Response.json(
          { error: "Falha ao interpretar resposta do modelo." },
          { status: 502 }
        );
      }
      parsed = JSON.parse(m[0]);
    }

    const captionRaw = typeof parsed.caption === "string" ? parsed.caption : "";
    const rawHashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];

    const caption = captionRaw.trim();
    if (!caption) {
      return Response.json(
        { error: "Modelo retornou legenda vazia. Tente novamente." },
        { status: 502 }
      );
    }

    const hashtags: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawHashtags) {
      const tag = sanitizeHashtag(String(raw));
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hashtags.push(tag);
      if (hashtags.length >= 8) break;
    }

    const response: CaptionResponse = { caption, hashtags };

    const costUsd = costForTokens("gemini-2.5-flash", inputTokens, outputTokens);
    await recordGeneration({
      userId: user.id,
      model: "gemini-2.5-flash",
      provider: "google",
      inputTokens,
      outputTokens,
      costUsd,
      promptType: "caption",
    });

    getPostHogClient().capture({
      distinctId: user.id,
      event: "caption_generated",
      properties: {
        niche,
        tone,
        language,
        slide_count: slides.length,
        caption_length: caption.length,
        hashtag_count: hashtags.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      },
    });

    return Response.json(response);
  } catch (error) {
    console.error("[generate/caption] Unhandled error:", error);
    return Response.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Erro interno ao gerar legenda. Tente novamente."
            : error instanceof Error
              ? error.message
              : "Internal server error",
      },
      { status: 500 }
    );
  }
}
