export const maxDuration = 60;

import { getAuthenticatedUser } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  costForTokens,
  recordGeneration,
} from "@/lib/server/generation-log";

interface RecentPost {
  text: string;
  likes: number;
  comments: number;
  imageUrl?: string | null;
  isCarousel?: boolean;
}

interface PostTranscript {
  id: string;
  visible_text: string;
  scene: string;
}

interface BrandAnalysisRequest {
  bio: string | null;
  recentPosts: RecentPost[];
  handle: string;
  platform: string;
  followers?: number | null;
  transcripts?: PostTranscript[];
}

interface BrandAnalysisResponse {
  detected_niche: string[];
  tone_detected: string;
  top_topics: string[];
  posting_frequency: string;
  avg_engagement: { likes: number; comments: number };
  suggested_pillars: string[];
  suggested_audience: string;
  who_you_are?: string;
  communication_style?: string;
}

function buildFallbackAnalysis(req: BrandAnalysisRequest): BrandAnalysisResponse {
  const posts = req.recentPosts || [];
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const count = posts.length || 1;

  return {
    detected_niche: [],
    tone_detected: "casual",
    top_topics: [],
    posting_frequency: posts.length >= 5 ? "~3-5x/semana" : "desconhecida",
    avg_engagement: {
      likes: Math.round(totalLikes / count),
      comments: Math.round(totalComments / count),
    },
    suggested_pillars: [],
    suggested_audience: "",
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
      key: getRateLimitKey(request, "brand-analysis", user.id),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const body: BrandAnalysisRequest = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[brand-analysis] ANTHROPIC_API_KEY not set, returning fallback analysis");
      return Response.json(buildFallbackAnalysis(body));
    }

    const posts = body.recentPosts || [];
    const transcripts = body.transcripts || [];
    const transcriptIndex = new Map<string, PostTranscript>();
    for (const t of transcripts) transcriptIndex.set(t.id, t);

    const postsText = posts
      .map((p, i) => {
        const id = String(i);
        const t = transcriptIndex.get(id);
        const transcriptBlock = t
          ? `\n  [VISUAL] cena: ${t.scene}\n  [TEXTO_NO_POST] ${
              t.visible_text?.slice(0, 600) || "(sem texto visivel)"
            }`
          : "";
        const type = p.isCarousel ? "carrossel" : "single";
        return `Post ${i + 1} (${type}, ${p.likes} likes, ${p.comments} coments):
  [LEGENDA] ${p.text?.slice(0, 600) || "(sem legenda)"}${transcriptBlock}`;
      })
      .join("\n\n");

    const systemPrompt = `Voce e um analista senior de marca e conteudo. Seu trabalho: ler bio + legendas + texto dos slides (quando disponivel) e entregar um diagnostico de DNA editorial concreto, em portugues BR.

Retorne APENAS JSON valido (sem markdown, sem code block), com esta estrutura EXATA:
{
  "detected_niche": ["nicho1", "nicho2"],
  "tone_detected": "casual" | "professional" | "provocative" | "educational",
  "top_topics": ["topico1", "topico2", "topico3", "topico4", "topico5"],
  "posting_frequency": "estimativa por semana, ex: ~3-5x/semana",
  "avg_engagement": { "likes": 123, "comments": 45 },
  "suggested_pillars": ["Pilar 1", "Pilar 2", "Pilar 3"],
  "suggested_audience": "Descricao detalhada (3-5 frases) do publico-alvo: quem e, o que busca, dores, onde passa tempo",
  "who_you_are": "Retrato detalhado do perfil em 3-5 frases. NAO repita a bio palavra por palavra. Sintetize: o que a pessoa faz, qual e o ponto de vista unico, qual e a autoridade, que tipo de conteudo entrega e por que alguem segue. Escreva na terceira pessoa.",
  "communication_style": "2-3 frases descrevendo o estilo de comunicacao: tipo de frase, uso de gatilhos, formatos dominantes (lista/narrativa/provocacao), tamanho medio, presenca de jargao ou dados."
}

Regras:
- detected_niche: 1-3 nichos, primeiro = mais forte. Especifico (ex: "cripto-DeFi" em vez de so "cripto").
- tone_detected: escolha a melhor aproximacao dos 4 valores.
- top_topics: 3-7 temas recorrentes CONCRETOS (nao generico como "marketing" — melhor "ads-de-performance-para-agencia").
- suggested_pillars: 3 pilares executaveis. Cada um em formato "Verbo + Objeto" (ex: "Expor os bastidores da operacao").
- suggested_audience: rico, nao rotulo. 3-5 frases.
- who_you_are: NUNCA copiar bio. Sintetizar com analise. Se o post tiver texto visual (slides), usar isso como evidencia.
- communication_style: concreto, com exemplos de padrao.
- TUDO em portugues BR exceto as chaves JSON.`;

    const userMessage = `Perfil: @${body.handle} em ${body.platform}
${body.followers ? `Seguidores: ${body.followers}` : ""}
Bio: ${body.bio || "(sem bio)"}

Posts recentes (use [TEXTO_NO_POST] quando disponivel — e o texto do slide do carrossel, vale muito mais que a legenda):
${postsText || "(sem posts disponiveis)"}`;

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
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.error("[brand-analysis] Claude API error:", response.status);
      return Response.json(buildFallbackAnalysis(body));
    }

    const data = await response.json();
    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );

    if (!textBlock?.text) {
      console.warn("[brand-analysis] Claude returned no text content, using fallback");
      return Response.json(buildFallbackAnalysis(body));
    }

    let result: BrandAnalysisResponse;
    try {
      result = JSON.parse(textBlock.text);
    } catch {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (innerErr) {
          console.error("[brand-analysis] Failed to parse extracted JSON:", innerErr);
          return Response.json(buildFallbackAnalysis(body));
        }
      } else {
        console.warn("[brand-analysis] No JSON found in Claude response, using fallback");
        return Response.json(buildFallbackAnalysis(body));
      }
    }

    // Log de custo — Claude devolve usage no nível do response.
    const usage = (data.usage ?? {}) as {
      input_tokens?: number;
      output_tokens?: number;
    };
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    await recordGeneration({
      userId: user.id,
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      inputTokens,
      outputTokens,
      costUsd: costForTokens("claude-sonnet-4-6", inputTokens, outputTokens),
      promptType: "brand-analysis",
    });

    return Response.json(result);
  } catch (error) {
    console.error("[brand-analysis] Unexpected error:", error);
    return Response.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
