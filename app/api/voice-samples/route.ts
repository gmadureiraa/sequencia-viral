export const maxDuration = 60;

import { GoogleGenAI } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { costForTokens, recordGeneration } from "@/lib/server/generation-log";

interface VoiceSamplesRequest {
  niche: string[];
  topics: string[];
  language: string;
}

interface VoiceSample {
  tone: string;
  label: string;
  emoji: string;
  hook: string;
  preview: string;
}

interface VoiceSamplesResponse {
  samples: VoiceSample[];
}

function buildFallbackSamples(req: VoiceSamplesRequest): VoiceSamplesResponse {
  const topic = req.topics?.[0] || req.niche?.[0] || "conteudo digital";
  return {
    samples: [
      {
        tone: "casual",
        label: "Casual",
        emoji: "😎",
        hook: `Para de complicar ${topic}.`,
        preview: `A real e simples: voce nao precisa de 10 ferramentas. Precisa de uma estrategia que funcione. Vou te mostrar a minha.`,
      },
      {
        tone: "professional",
        label: "Profissional",
        emoji: "👔",
        hook: `O framework definitivo para ${topic}`,
        preview: `Depois de analisar mais de 200 cases, identifiquei 3 padroes que separam quem cresce de quem estagna. Aqui esta o framework.`,
      },
      {
        tone: "provocative",
        label: "Provocativo",
        emoji: "🔥",
        hook: `Tudo que te ensinaram sobre ${topic} esta errado.`,
        preview: `A maioria faz exatamente o oposto do que funciona. E os "gurus" continuam vendendo a mesma receita quebrada. Hora de mudar.`,
      },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "voice-samples", user.id),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const body: VoiceSamplesRequest = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[voice-samples] GEMINI_API_KEY not set, returning fallback samples");
      return Response.json(buildFallbackSamples(body));
    }

    const isPtBr = (body.language || "pt-br").toLowerCase().startsWith("pt");
    const lang = isPtBr ? "Portugues Brasileiro" : body.language === "es" ? "Espanol" : "English";

    const systemPrompt = `You generate 3 carousel hook samples in different tones for a content creator. Each hook must be specific to their niche/topics and feel authentic, not generic.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "samples": [
    {
      "tone": "casual",
      "label": "Casual",
      "emoji": "😎",
      "hook": "The attention-grabbing first line (max 10 words)",
      "preview": "2-3 sentences showing how the carousel would continue in this tone"
    },
    {
      "tone": "professional",
      "label": "Profissional",
      "emoji": "👔",
      "hook": "...",
      "preview": "..."
    },
    {
      "tone": "provocative",
      "label": "Provocativo",
      "emoji": "🔥",
      "hook": "...",
      "preview": "..."
    }
  ]
}

Rules:
- Write ALL content in ${lang}
- Make hooks specific to their actual niche/topics (never generic)
- Each tone must feel genuinely different, not just word swaps
- Hooks max 10 words, punchy, scroll-stopping
- Preview should be 2-3 short sentences showing the carousel style`;

    const userMessage = `Creator's niche: ${(body.niche || []).join(", ") || "general"}
Top topics: ${(body.topics || []).join(", ") || "content creation"}

Generate 3 hook samples that feel like this creator would actually post them.`;

    const GEMINI_MODEL = "gemini-2.5-pro";

    const ai = new GoogleGenAI({ apiKey });

    let response;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 4000 },
        },
      });
    } catch (err) {
      console.error(
        "[voice-samples] Gemini API error:",
        err instanceof Error ? err.message : err
      );
      return Response.json(buildFallbackSamples(body));
    }

    const usage = (response.usageMetadata ?? {}) as {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
    };
    const inputTokens = usage.promptTokenCount ?? 0;
    const outputTokens =
      (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
    await recordGeneration({
      userId: user.id,
      model: GEMINI_MODEL,
      provider: "google",
      inputTokens,
      outputTokens,
      costUsd: costForTokens(GEMINI_MODEL, inputTokens, outputTokens),
      promptType: "brand-analysis",
    });

    const text = response.text || "";
    if (!text.trim()) {
      console.warn("[voice-samples] Gemini returned no text content, using fallback");
      return Response.json(buildFallbackSamples(body));
    }

    let result: VoiceSamplesResponse;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (innerErr) {
          console.error("[voice-samples] Failed to parse extracted JSON:", innerErr);
          return Response.json(buildFallbackSamples(body));
        }
      } else {
        console.warn("[voice-samples] No JSON found in Gemini response, using fallback");
        return Response.json(buildFallbackSamples(body));
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error("[voice-samples] Unexpected error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
