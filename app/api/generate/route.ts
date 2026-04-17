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
        console.error("[generate] URL extraction failed:", err);
        return Response.json(
          {
            error: `Não foi possível extrair conteúdo da URL: ${err instanceof Error ? err.message : "erro desconhecido"}. Dica: cole o texto manualmente no campo "Minha ideia".`,
          },
          { status: 400 }
        );
      }
    } else if (sourceType === "video" && sourceUrl) {
      try {
        sourceContent = await getYouTubeTranscript(sourceUrl);
      } catch (err) {
        console.error("[generate] YouTube transcript failed:", err);
        return Response.json(
          {
            error: `Não foi possível extrair a transcrição do YouTube: ${err instanceof Error ? err.message : "erro desconhecido"}. O vídeo pode não ter legendas disponíveis.`,
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
        console.error("[generate] Instagram extraction failed:", err);
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

    const systemPrompt = `You are a narrative architect for Instagram carousels and LinkedIn document posts. You think like a screenwriter — every slide is a scene that earns the next swipe.

${languageInstruction}
TONE: ${tone || "professional"}
NICHE: ${niche || "general"}
${brandContext ? `
# BRAND VOICE INTEGRATION
${brandContext}
IMPORTANT: Don't just acknowledge these brand signals — WEAVE them into the content. If the creator talks about marketing, use marketing examples. If their audience is founders, write FOR founders. If their tone is irreverent, match that energy. The carousel must sound like THIS creator wrote it, not a generic AI.
` : ""}

# YOUR MISSION
Create 1 carousel (6-10 slides) built on NARRATIVE TENSION — a conflict between what people assume and what's actually true.

Formula: surface reading → friction → reframe → mechanism → proof → implication → expanded closing

# SLIDE 1 — THE HOOK (0.7 seconds to stop the scroll)
Max 8 words in the heading. Every word must earn its place.

Hook patterns (pick the STRONGEST for this topic):
- **Specific number + consequence**: "78% dos criadores cometem esse erro no slide 1"
- **Contrarian rupture**: "Pare de fazer conteudo educativo." (challenges a belief)
- **Vulnerable story**: "Perdi R$47k em 23 dias." (specificity + curiosity gap)
- **Named tension**: "O algoritmo nao odeia voce. Seu hook sim."

Rules:
- Heading = INTERRUPTION. Body = OPEN LOOP that only swiping resolves.
- Never reveal the answer in slide 1. Create a gap the reader NEEDS to close.
- Body's last line must tease slide 2. Example: "E o motivo nao e o que parece."

# SLIDES 2 to N-1 — THE BUILD (narrative engine)

MICRO-CLIFFHANGER RULE: Every slide's body MUST end with a line that pulls the reader to the next slide. This is non-negotiable. Examples:
- "Mas tem um detalhe que muda tudo."
- "Esse nao e nem o maior problema."
- "O terceiro e o mais perigoso."
- "E aqui que a maioria para. Erro."

PATTERN INTERRUPT RULE: Every 3rd slide must break the rhythm.
- If slides 1-3 are statements → slide 4 is a question or surprising statistic
- If slides 2-4 are analytical → slide 5 is a short personal story or metaphor
- Never let 4 slides in a row follow the same structure

EMOTIONAL TRIGGER per slide (pick one):
- CURIOSITY: "O que realmente acontece quando..."
- FOMO: "Enquanto 92% ignora isso..."
- AHA-MOMENT: "Aqui esta o mecanismo que ninguem explica."

Each slide:
- ONE clear idea. One. Not two crammed together.
- First 3 words = mini-hook that earns the swipe
- Concrete specifics: names, percentages, timeframes. Never "muitas empresas" — always "3 em cada 10 startups Series A"
- Body: max 3 short lines with line breaks for scan-reading

# LAST SLIDE — THE CTA (callback loop)
The CTA MUST reference slide 1's hook — close the loop the reader opened.

Structure:
1. Line 1: Callback to slide 1. If slide 1 said "78% dos criadores cometem esse erro" → CTA says "Agora que voce sabe qual e o erro dos 78%..."
2. Line 2: Action optimized for algorithm. Priority: save > share > comment > like. Example: "Salva esse carrossel pra revisar antes do proximo post."
3. Line 3: Social proof nudge. Example: "Manda pra aquele amigo que ainda acha que alcance organico morreu."

Never use: "me siga", "curta esse post", "comente abaixo" alone. Always tie the CTA to the CONTENT.

# RADICAL SPECIFICITY (mandatory)
BANNED forever: "muitas pessoas", "resultados incriveis", "game-changer", "nesse sentido", "atualmente", "e por isso que", "a maioria", "muito tempo", "grandes resultados"
REQUIRED: every claim has a number ("78%", "R$12k", "23 minutos", "3 em cada 10"), a name, or a concrete example. No exceptions.

# STYLE
Choose: data (statistics/proof-driven), story (narrative/personal), or provocative (contrarian/bold). Pick whichever creates the strongest emotional arc for THIS specific topic.

# OUTPUT FORMAT
Return valid JSON:
{
  "variations": [
    {
      "title": "carousel title (compelling, max 60 chars)",
      "style": "data" | "story" | "provocative",
      "ctaType": "save" | "comment" | "share",
      "slides": [
        {
          "heading": "max 8 words, bold, scannable",
          "body": "2-3 short lines\\nwith micro-cliffhanger ending\\nfor readability",
          "imageQuery": "specific 2-3 word image search in English"
        }
      ]
    }
  ]
}`;

    const userMessage = sourceContent
      ? `Create 1 carousel based on this content:\n\nTopic: ${topic}\n\nSource:\n${sourceContent.slice(0, 3000)}`
      : `Create 1 carousel about: ${topic}`;

    // 3. Call Gemini 2.0 Flash (fast enough for Vercel Hobby 10s limit)
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    let textResponse: string;
    try {
      const genResult = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${userMessage}\n\n[variation-seed: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.9,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
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
            model: "gemini-2.5-flash",
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

