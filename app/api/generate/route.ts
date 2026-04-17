import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

interface GenerateRequest {
  topic: string;
  sourceType: "idea" | "link" | "video" | "instagram" | "ai";
  sourceUrl?: string;
  niche: string;
  tone: string;
  language: string;
}

interface Slide {
  heading: string;
  body: string;
  imageQuery: string;
}

interface Variation {
  title: string;
  style: "data" | "story" | "provocative";
  ctaType?: "save" | "comment" | "share";
  slides: Slide[];
}

interface GenerateResponse {
  variations: Variation[];
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "generate", user.id),
      limit: 50,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSec),
          },
        }
      );
    }

    // Single query: plan check + brand context
    const sb = createServiceRoleSupabaseClient();
    let brandContext = "";
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("usage_count, usage_limit, plan, brand_analysis")
        .eq("id", user.id)
        .single();
      if (prof) {
        const limit = prof.usage_limit ?? 5;
        const count = prof.usage_count ?? 0;
        if (count >= limit) {
          return Response.json(
            {
              error: `Você atingiu o limite de ${limit} carrosséis do plano ${prof.plan || "free"}. Faça upgrade para continuar gerando.`,
              code: "PLAN_LIMIT_REACHED",
            },
            { status: 403 }
          );
        }
        // Extract brand context from same query
        const ba = prof.brand_analysis as Record<string, unknown> | null;
        if (ba && typeof ba === "object") {
          const pillars = Array.isArray(ba.content_pillars) ? (ba.content_pillars as string[]).join(", ") : "";
          const topics = Array.isArray(ba.top_topics) ? (ba.top_topics as string[]).join(", ") : "";
          const tone_detected = (ba.tone_detected as string) || "";
          const audience = (ba.audience_description as string) || "";
          const voice = (ba.voice_preference as string) || "";
          if (pillars || topics || tone_detected || audience || voice) {
            brandContext = `
USER BRAND CONTEXT (use this to make content sound authentically like this creator, not generic AI):
- Content pillars: ${pillars || "not specified"}
- Typical topics: ${topics || "not specified"}
- Detected writing tone: ${tone_detected || "not specified"}
- Target audience: ${audience || "not specified"}
- Voice preference: ${voice || "not specified"}
`;
          }
        }
      }
    }

    const body: GenerateRequest = await request.json();
    const { topic, sourceType, sourceUrl, niche, tone, language } = body;

    if (!topic && sourceType === "idea") {
      return Response.json({ error: "Topic is required" }, { status: 400 });
    }

    if (topic && topic.length > 5000) {
      return Response.json({ error: "Topic is too long (max 5000 chars)" }, { status: 400 });
    }
    if (sourceUrl && sourceUrl.length > 2000) {
      return Response.json({ error: "URL is too long (max 2000 chars)" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("[generate] GEMINI_API_KEY missing");
      return Response.json(
        { error: "Geração com IA não está configurada no servidor." },
        { status: 503 }
      );
    }

    // 1. Gather source content
    let sourceContent = "";

    if (sourceType === "link" && sourceUrl) {
      try {
        sourceContent = await extractContentFromUrl(sourceUrl);
      } catch (err) {
        return Response.json(
          {
            error: `Failed to extract content from URL: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
          { status: 400 }
        );
      }
    } else if (sourceType === "video" && sourceUrl) {
      try {
        sourceContent = await getYouTubeTranscript(sourceUrl);
      } catch (err) {
        return Response.json(
          {
            error: `Failed to extract YouTube transcript: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
          { status: 400 }
        );
      }
    } else if (sourceType === "instagram" && sourceUrl) {
      try {
        const { extractInstagramContent } = await import(
          "@/lib/instagram-extractor"
        );
        sourceContent = await extractInstagramContent(sourceUrl);
      } catch (err) {
        return Response.json(
          {
            error: `Falha ao extrair o post do Instagram: ${
              err instanceof Error ? err.message : "erro desconhecido"
            }. Dica: cole a legenda como texto no modo "Minha ideia".`,
          },
          { status: 400 }
        );
      }
    }

    // 2. Build the prompt
    const langCode = (language || "pt-br").toLowerCase();
    const isPtBr = langCode === "pt-br" || langCode === "pt";
    const languageInstruction = isPtBr
      ? `LANGUAGE: PORTUGUÊS BRASILEIRO (pt-BR). Escreva TODO o conteúdo — headings, body, CTA, image queries — em português brasileiro coloquial. NUNCA use inglês no heading ou body. Use "você", não "tu". Imagem queries devem ser em inglês (são usadas em busca de imagens stock).`
      : langCode === "en"
        ? "LANGUAGE: ENGLISH. Write all heading, body, and CTA in English."
        : langCode === "es"
          ? "LANGUAGE: ESPAÑOL. Escribe todo el heading, body y CTA en español."
          : `LANGUAGE: ${language}`;

    const systemPrompt = `You are an elite social media content strategist who creates viral Instagram carousels and LinkedIn document posts. You have deep expertise in copywriting, engagement psychology, and platform algorithms.

${languageInstruction}
TONE: ${tone || "professional"}
NICHE: ${niche || "general"}
${brandContext}

# YOUR MISSION
Create 3 radically different carousel variations from the given topic/content. Each must be independently excellent — not just tone variations of the same text.

# CAROUSEL ARCHITECTURE (6-10 slides each)

## SLIDE 1 — THE HOOK (most critical slide)
The hook MUST stop the scroll in under 0.7 seconds. Max 10 words in the heading.

CRITICAL VARIATION RULES:
- Variation A MUST open with a NUMBER/DATA hook (e.g., "78% dos creators...")
- Variation B MUST open with a PERSONAL STORY hook (e.g., "Em 2024 eu perdi...")
- Variation C MUST open with a CONTRARIAN/BOLD hook (e.g., "Pare de fazer conteudo educativo.")
Each variation must feel like a COMPLETELY DIFFERENT carousel, not just a rewrite.

4 proven hook patterns to use:
- **Number + Consequence**: "7 ferramentas de IA que substituem uma equipe de 5"
- **Contrarian/Pattern Interrupt**: "Pare de fazer conteudo educativo." (challenges belief)
- **Story/Transformation**: "Em 2024 perdi R$50k em um mes." (vulnerability + curiosity)
- **Question + Data**: "Sabia que 90% dos carrosseis falham no slide 1?" (stat + reflexao)

Rules for hooks:
- Max 10 words in the heading — shorter hits harder
- The body must CREATE TENSION that only swiping resolves
- Never reveal the answer in slide 1

## SLIDES 2-N (The Build)
Each slide must:
- Start with a mini-hook (first 3 words must earn the next swipe)
- Deliver ONE clear idea per slide (not multiple)
- Use concrete examples, numbers, names — never vague platitudes
- Build toward a climax or revelation
- Body text: max 3 short lines. Use line breaks for readability.

## LAST SLIDE — THE CTA (strategic, not generic)
The CTA MUST match the content type and REFERENCE something from slide 1 (callback loop).
Example: if slide 1 says "7 erros que matam engajamento", CTA says "Agora que voce conhece os 7 erros, salva pra revisar antes de cada post".
Never be generic "follow me". Include user's @handle + "siga para mais [niche topic]".

# VARIATION STYLES

**Variation A — DADOS & PROOF**: Lead with statistics, comparisons, specific tools/frameworks. Best CTA: Save-focused.
**Variation B — STORYTELLING & NARRATIVE**: Personal/relatable story arc. "eu" perspective. Best CTA: Share/tag-focused.
**Variation C — PROVOCATIVA & CONTRARIAN**: Challenge conventional wisdom. Bold opening. Best CTA: Comment-focused.

# COPYWRITING RULES
1. Write like you talk. No academic language. No corporate jargon.
2. One idea per sentence. Short sentences hit harder.
3. Use power words: "revelei", "secreto", "erro fatal", "transformou", "desbloquear"
4. Numbers are specific: "78%" not "a maioria", "23 minutos" not "pouco tempo"
5. Every heading must be SCANNABLE — someone should get value from headings alone
6. Body text uses conversational line breaks (one thought per line, max 3 lines)
7. Avoid cliches: "game-changer", "nesse sentido", "atualmente", "e por isso que"
8. Each slide's imageQuery should be specific enough to find a relevant, non-generic image (in English)

NEVER use generic phrases like "muitas pessoas", "resultados incriveis", "game-changer". Every claim needs a specific number or example.

# OUTPUT FORMAT
Return valid JSON with this structure:
{
  "variations": [
    {
      "title": "carousel title (compelling, max 60 chars)",
      "style": "data" | "story" | "provocative",
      "ctaType": "save" | "comment" | "share",
      "slides": [
        {
          "heading": "max 10 words, bold, scannable",
          "body": "2-3 short lines\\nwith line breaks\\nfor readability",
          "imageQuery": "specific 2-3 word image search in English"
        }
      ]
    }
  ]
}`;

    const userMessage = sourceContent
      ? `Create 3 carousel variations based on this content:\n\nTopic: ${topic}\n\nSource:\n${sourceContent}`
      : `Create 3 carousel variations about: ${topic}`;

    // 3. Call Gemini 2.0 Flash (fast enough for Vercel Hobby 10s limit)
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    let textResponse: string;
    try {
      const genResult = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${userMessage}\n\n[variation-seed: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      });
      textResponse = genResult.text || "";
    } catch (err) {
      console.error("[generate] Gemini API error:", err);
      return Response.json(
        {
          error: process.env.NODE_ENV === "production"
            ? "Geração com IA falhou. Tente novamente em alguns instantes."
            : `Geração com IA falhou. ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    if (!textResponse) {
      return Response.json(
        { error: "No response from AI" },
        { status: 502 }
      );
    }

    // 4. Parse the JSON response (Gemini with responseMimeType=json should return clean JSON)
    let result: GenerateResponse;
    try {
      result = JSON.parse(textResponse);
    } catch {
      // Try extracting JSON from potential wrapper
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error("[generate] Failed to parse Gemini response:", textResponse.slice(0, 500));
        return Response.json(
          { error: "Failed to parse AI response" },
          { status: 502 }
        );
      }
    }

    // 5. Validate structure
    if (!result.variations || !Array.isArray(result.variations)) {
      return Response.json(
        { error: "Invalid AI response structure" },
        { status: 502 }
      );
    }

    // Increment usage_count server-side and record generation (fire-and-forget)
    if (sb) {
      void (async () => {
        try {
          const { error: incErr } = await sb.rpc("increment_usage_count", { uid: user.id });
          if (incErr) {
            const { data: currentProfile } = await sb
              .from("profiles")
              .select("usage_count")
              .eq("id", user.id)
              .single();
            if (currentProfile) {
              await sb
                .from("profiles")
                .update({ usage_count: (currentProfile.usage_count ?? 0) + 1 })
                .eq("id", user.id);
            }
          }
          await sb.from("generations").insert({
            user_id: user.id,
            model: "gemini-2.0-flash",
            provider: "google",
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            prompt_type: sourceType,
          });
        } catch (e) {
          console.warn("[generate] Failed to track usage:", e);
        }
      })();
    }

    return Response.json(result);
  } catch (error) {
    console.error("Generate error:", error);
    return Response.json(
      {
        error: process.env.NODE_ENV === "production"
          ? "Erro interno ao gerar carrossel. Tente novamente."
          : (error instanceof Error ? error.message : "Internal server error"),
      },
      { status: 500 }
    );
  }
}

