import { GoogleGenAI } from "@google/genai";
import {
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { getPostHogClient } from "@/lib/posthog-server";

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

function buildSystemPrompt(params: {
  tone: string;
  language: string;
  niche: string;
}): string {
  const { tone, language, niche } = params;
  return `Você é um copywriter editorial brasileiro experiente em conteúdo de Instagram/LinkedIn.

Dada uma sequência de slides de carrossel, escreva a LEGENDA do post seguindo:

ESTRUTURA OBRIGATÓRIA:
1) HOOK (1 linha, interrompe o scroll, sem clickbait vazio)
2) [linha em branco]
3) CORPO (2 a 4 parágrafos CURTOS, com linha em branco entre cada um.
   Desenvolve a promessa do carrossel. Inclua PELO MENOS 1 dado concreto
   OU contraste provocador. Máximo 3 frases por parágrafo.)
4) [linha em branco]
5) CTA final (1 linha — pergunta genuína OU chamada direta)
6) [linha em branco]
7) [---]
8) [linha em branco]
9) HASHTAGS: 5 a 8 hashtags contextuais, relevantes. Inclua 1-2 mais nichadas
   e 1-2 mais abrangentes.

BANIDO: emojis decorativos. "descubra como", "o segredo", "você precisa saber",
"muitas pessoas". Hashtags genéricas tipo #instagood #love #brasil.

TOM: ${tone || "profissional, direto, analítico"}
IDIOMA: ${language || "pt-BR"}
NICHO: ${niche || "geral"}

Retorne JSON: { "caption": "texto completo com quebras \\n", "hashtags": ["#a", "#b"] }

Importante:
- A "caption" deve conter \\n explicitamente entre parágrafos e antes/depois do separador "---".
- Não envolva a caption em aspas extras nem em markdown.
- As hashtags no array NÃO precisam aparecer duplicadas dentro da caption; elas serão renderizadas separadas.
- Total da caption ~800 a 1500 caracteres (conta sem hashtags).`;
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

    const limiter = checkRateLimit({
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

    const systemPrompt = buildSystemPrompt({ tone, language, niche });
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
