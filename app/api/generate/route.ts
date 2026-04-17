import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import { requireAuthenticatedUser, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

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
  qualityScore?: number;
  qualityReasoning?: string;
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

    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("usage_count, usage_limit, plan")
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
      }
    }

    // Fetch user profile for brand_analysis context
    let brandContext = "";
    if (sb) {
      const { data: profileData } = await sb
        .from("profiles")
        .select("brand_analysis")
        .eq("id", user.id)
        .single();
      const ba = profileData?.brand_analysis;
      if (ba && typeof ba === "object") {
        const pillars = Array.isArray(ba.content_pillars) ? ba.content_pillars.join(", ") : "";
        const topics = Array.isArray(ba.top_topics) ? ba.top_topics.join(", ") : "";
        const tone_detected = ba.tone_detected || "";
        const audience = ba.audience_description || "";
        const voice = ba.voice_preference || "";
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        console.error("[generate] ANTHROPIC_API_KEY missing in production");
        return Response.json(
          { error: "Geração com IA não está configurada no servidor." },
          { status: 503 }
        );
      }
      return Response.json(getMockResponse(topic || "Sample Topic"));
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
The hook must answer: "Is this for me?" and "What do I gain by swiping?"

Use one of these 12 proven hook patterns (choose the BEST one for each variation):
- **Number + Consequence**: "7 ferramentas de IA que substituem uma equipe de 5" (not just "7 ferramentas de IA")
- **Contrarian/Pattern Interrupt**: "Pare de fazer conteudo educativo." (challenges belief, forces read)
- **Story/Transformation**: "Em 2024 perdi R$50k em um mes." (vulnerability + curiosity about outcome)
- **Question + Data**: "Sabia que 90% dos carrosseis falham no slide 1?" (stat + reflexao)
- **Curiosity Gap**: "A estrategia que ninguem fala..." (incomplete info the brain needs to complete)
- **Bold Claim/Result**: "Este metodo gera 3x mais saves. Leva 10 min." (specific promise + low effort)
- **Reveal/Exclusivity**: "O framework que uso pra gerar R$100k/mes" (insider access feeling)
- **This vs That**: "Creator 2023 vs Creator 2026" (comparison + self-identification)
- **Fear/Urgency**: "Se nao fizer isso em 2026, vai ficar pra tras" (loss aversion)
- **Authority Proof**: "Analisei 1.000 carrosseis virais. Aqui o padrao." (credibility + data)
- **Audience Targeting**: "Se voce e creator com menos de 1.000 seguidores..." (personal call-out)
- **"I Was Wrong"**: "Passei 2 anos fazendo conteudo errado." (vulnerability + credibility)

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

Slide progression patterns:
- **List**: Each slide = one item (numbered). Build from good to BEST.
- **Story arc**: Setup → Conflict → Turning point → Lesson
- **Framework**: Problem → Why it matters → Step 1 → Step 2 → Step 3 → Result
- **Myth-busting**: Myth → Truth → Evidence → Action

## LAST SLIDE — THE CTA (strategic, not generic)
The CTA MUST match the content type. Never be generic "follow me".

CHOOSE THE RIGHT CTA based on content. ALGORITHM CONTEXT (Instagram 2026):
- DM Shares weight 3-5x more than likes
- Saves are the 2nd strongest signal
- Comments that generate replies boost reach
- Likes have the lowest algorithmic weight

CTA MATRIX:
- **Educational/how-to** → "Salve pra consultar depois" (SAVES = strongest signal after DM shares)
- **Controversial/opinion** → "Concorda? Discorda? Comenta sua visao" (COMMENTS that spark debate)
- **Relatable/personal story** → "Envia pros DMs de alguem que precisa ler isso" (DM SHARES = highest weight)
- **Actionable tips/tools** → "Salve e aplique esta semana. Depois volta e me conta" (SAVES + delayed COMMENTS)
- **Data/comparison** → "Qual desses voce ja usa? Comenta o numero" (low-friction COMMENTS)
- **Case study/results** → "Compartilha com alguem que precisa + siga pra mais" (SHARES + FOLLOW)

The CTA slide must also include: user's @handle + "siga para mais [niche topic]". Never just "follow me" — specify WHAT they'll get.

# VARIATION STYLES

**Variation A — DADOS & PROOF**
- Lead with statistics, percentages, comparisons
- Use "antes vs depois" framing
- Include specific tools, frameworks, or methods with names
- Credibility-driven: cite sources, reference studies, show numbers
- Best CTA: Save-focused (educational value)

**Variation B — STORYTELLING & NARRATIVE**
- Personal or relatable story arc
- Start vulnerable, end with insight
- Use "eu" perspective or hypothetical "imagine que..."
- Emotional connection before intellectual takeaway
- Best CTA: Share/tag-focused (emotional resonance)

**Variation C — PROVOCATIVA & CONTRARIAN**
- Challenge conventional wisdom directly
- Bold opening that creates strong reaction
- "A maioria faz X. Os melhores fazem Y."
- Back up bold claims with evidence in subsequent slides
- Best CTA: Comment-focused (debate/discussion)

# COPYWRITING RULES
1. Write like you talk. No academic language. No corporate jargon.
2. One idea per sentence. Short sentences hit harder.
3. Use power words: "revelei", "secreto", "erro fatal", "transformou", "desbloquear"
4. Numbers are specific: "78%" not "a maioria", "23 minutos" not "pouco tempo"
5. Every heading must be SCANNABLE — someone should get value from headings alone
6. Body text uses conversational line breaks (one thought per line, max 3 lines)
7. Avoid cliches: "game-changer", "nesse sentido", "atualmente", "e por isso que"
8. Each slide's imageQuery should be specific enough to find a relevant, non-generic image

# ADVANCED COPYWRITING PATTERNS
9. **Open loops**: End paragraphs/slides with incomplete thoughts that FORCE the reader to swipe. Example: "Mas o terceiro passo e o que muda tudo..." (reader MUST swipe)
10. **Pattern interrupt every 2-3 slides**: Change the format — if slides 2-3 are tips, make slide 4 a provocative question or a surprising stat. Break the rhythm to re-capture attention.
11. **Radical specificity**: NEVER write "muitas pessoas" — write "78% dos creators". NEVER write "resultados incriveis" — write "3.2x mais saves em 14 dias". Every claim must have a number, name, or concrete example.
12. **Emotional triggers per slide**: Each slide must trigger ONE of: curiosity ("voce nao vai acreditar..."), FOMO ("enquanto voce ignora isso..."), or "aha moment" ("e por isso que seus carrosseis nao passam de 200 impressoes").
13. **Callback loop**: The LAST slide CTA must reference something from slide 1. If slide 1 says "7 erros que matam seu engajamento", the CTA should say "Agora que voce conhece os 7 erros, salva pra revisar antes de cada post".
14. **Micro-cliffhangers**: The last line of each slide body should tease what comes next without revealing it. This is the single most important retention mechanic.

# OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code blocks):
{
  "variations": [
    {
      "title": "carousel title (compelling, max 60 chars)",
      "style": "data" | "story" | "provocative",
      "ctaType": "save" | "comment" | "share",
      "qualityScore": 0-100,
      "qualityReasoning": "1-2 sentence explanation of score: what makes this variation strong or weak",
      "slides": [
        {
          "heading": "max 10 words, bold, scannable",
          "body": "2-3 short lines\\nwith line breaks\\nfor readability",
          "imageQuery": "specific 2-3 word image search"
        }
      ]
    }
  ]
}

# QUALITY SCORING CRITERIA (apply to each variation):
- Hook strength (0-25): Does slide 1 stop the scroll? Is it under 10 words? Does it create irresistible tension?
- Content depth (0-25): Are claims specific? Are there real numbers, tools, examples? Or vague platitudes?
- Flow & retention (0-25): Do open loops work? Is there a pattern interrupt? Does each slide earn the next swipe?
- CTA effectiveness (0-25): Does the CTA match the content type? Does it callback to slide 1? Is it algorithm-optimized?
Be honest and critical. Most carousels should score 60-80. Only truly exceptional ones hit 90+.`;

    const userMessage = sourceContent
      ? `Create 3 carousel variations based on this content:\n\nTopic: ${topic}\n\nSource:\n${sourceContent}`
      : `Create 3 carousel variations about: ${topic}`;

    // 3. Call Claude API
    // Model: Sonnet 4.6 = best cost/quality balance for this task.
    // Opus 4.6 (claude-opus-4-6) is available if you want max quality; it's slower and pricier.
    const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate] Claude API error:", {
        status: response.status,
        model: CLAUDE_MODEL,
        body: errorText,
      });
      // Try to extract the real error message from Claude's JSON error shape
      let detail = `Claude retornou ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed?.error?.message) detail = parsed.error.message;
      } catch {
        // keep generic detail
      }
      return Response.json(
        {
          error: process.env.NODE_ENV === "production"
            ? "Geração com IA falhou. Tente novamente em alguns instantes."
            : `Geração com IA falhou. ${detail}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );

    if (!textBlock?.text) {
      return Response.json(
        { error: "No response from AI" },
        { status: 502 }
      );
    }

    // 4. Parse the JSON response
    let result: GenerateResponse;
    try {
      // Try direct parse first
      result = JSON.parse(textBlock.text);
    } catch {
      // Try extracting JSON from potential markdown code block
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
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

    // 6. Auto-fetch images for every slide IN PARALLEL.
    // We hit Serper (Google Images) via our own /api/images route proxy using
    // the imageQuery from each slide. Any slide that fails image fetch keeps
    // its imageQuery but no imageUrl — the frontend will show a placeholder
    // and the user can replace via upload/regenerate.
    try {
      const origin = new URL(request.url).origin;
      const authHeader = request.headers.get("authorization") ?? "";

      const allSlideQueries: Array<{ varIdx: number; slideIdx: number; query: string }> = [];
      result.variations.forEach((variation, vi) => {
        variation.slides.forEach((slide, si) => {
          if (slide.imageQuery) {
            allSlideQueries.push({ varIdx: vi, slideIdx: si, query: slide.imageQuery });
          }
        });
      });

      // De-duplicate queries to save API calls
      const uniqueQueries = Array.from(new Set(allSlideQueries.map((q) => q.query)));
      const queryToUrl = new Map<string, string>();

      await Promise.allSettled(
        uniqueQueries.map(async (q) => {
          try {
            const r = await fetch(`${origin}/api/images`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                ...(authHeader ? { authorization: authHeader } : {}),
              },
              body: JSON.stringify({ query: q, count: 1 }),
            });
            if (!r.ok) return;
            const j = await r.json();
            const first: string | undefined = j?.images?.[0]?.url || j?.results?.[0]?.url || j?.url;
            if (first) queryToUrl.set(q, first);
          } catch {
            // swallow — slide keeps no imageUrl
          }
        })
      );

      // Stitch URLs back into slides
      for (const { varIdx, slideIdx, query } of allSlideQueries) {
        const url = queryToUrl.get(query);
        if (url) {
          const slide = result.variations[varIdx].slides[slideIdx] as Slide & {
            imageUrl?: string;
          };
          slide.imageUrl = url;
        }
      }
    } catch (imgErr) {
      console.warn("[generate] auto-image fetch failed (non-fatal):", imgErr);
    }

    // Increment usage_count server-side and record generation
    if (sb) {
      const { error: incErr } = await sb.rpc("increment_usage_count", { uid: user.id });
      if (incErr) {
        // Fallback: manual increment if RPC doesn't exist yet
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
        model: CLAUDE_MODEL,
        provider: "anthropic",
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
        cost_usd: ((data.usage?.input_tokens ?? 0) * 0.000003 + (data.usage?.output_tokens ?? 0) * 0.000015),
        prompt_type: sourceType,
      }).then(({ error: genErr }) => {
        if (genErr) console.warn("[generate] Failed to log generation:", genErr);
      });
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

function getMockResponse(topic: string): GenerateResponse {
  const makeSlides = (style: string): Slide[] => [
    {
      heading: `${style === "data" ? "The Numbers Don't Lie" : style === "story" ? "I Was Wrong About This" : "Stop Doing This Now"}`,
      body: `Everything you thought about ${topic} is about to change.\nHere's what the top 1% know.\nSwipe to find out.`,
      imageQuery: `${topic} concept`,
    },
    {
      heading:
        style === "data"
          ? "78% Miss This Key Point"
          : style === "story"
            ? "It Started With a Problem"
            : "The Uncomfortable Truth",
      body: `Most people approach ${topic} the wrong way.\nThey focus on the surface level.\nBut the real impact is deeper.`,
      imageQuery: `${topic} insight`,
    },
    {
      heading:
        style === "data"
          ? "3x More Results With This"
          : style === "story"
            ? "Then Everything Changed"
            : "Nobody Talks About This",
      body: `Here's the strategy that changes everything.\nIt's simpler than you think.\nBut requires a shift in mindset.`,
      imageQuery: `${topic} strategy`,
    },
    {
      heading:
        style === "data"
          ? "The Framework That Works"
          : style === "story"
            ? "The Lesson I Learned"
            : "The Real Problem Is You",
      body: `Step 1: Understand the fundamentals.\nStep 2: Apply consistently.\nStep 3: Measure and iterate.`,
      imageQuery: `${topic} framework`,
    },
    {
      heading:
        style === "data"
          ? "Results: Before vs After"
          : style === "story"
            ? "What I Do Differently Now"
            : "Here's What Actually Works",
      body: `The difference is night and day.\nSmall changes compound over time.\nConsistency beats intensity.`,
      imageQuery: `${topic} results`,
    },
    {
      heading: "Follow For More",
      body: `If this was valuable, follow for more.\nSave this for later.\nShare with someone who needs this.`,
      imageQuery: `social media follow`,
    },
  ];

  return {
    variations: [
      {
        title: `${topic}: By The Numbers`,
        style: "data",
        qualityScore: 72,
        qualityReasoning: "Solid data-driven approach with specific numbers. Hook could be more provocative.",
        slides: makeSlides("data"),
      },
      {
        title: `My ${topic} Journey`,
        style: "story",
        qualityScore: 68,
        qualityReasoning: "Good narrative arc but needs more concrete turning points and specific details.",
        slides: makeSlides("story"),
      },
      {
        title: `${topic}: The Hard Truth`,
        style: "provocative",
        qualityScore: 75,
        qualityReasoning: "Strong pattern interrupt hook. CTA callback to slide 1 is effective.",
        slides: makeSlides("provocative"),
      },
    ],
  };
}
