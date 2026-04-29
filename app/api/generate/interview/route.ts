import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { GoogleGenAI } from "@google/genai";
import { costForTokens, recordGeneration } from "@/lib/server/generation-log";

export const maxDuration = 15;

interface InterviewRequest {
  topic: string;
  niche?: string;
  tone?: string;
  language?: string;
  sourceType?: "idea" | "link" | "video" | "instagram" | "ai";
}

interface InterviewQuestion {
  id: string;
  question: string;
  why: string; // micro-explicação: por que isso melhora o carrossel
  suggestedAnswer?: string;
}

/**
 * POST /api/generate/interview
 * Lê o briefing + niche + brand_analysis do user e devolve 1-2 perguntas
 * cirúrgicas que melhorariam o carrossel final. Usado no Modo Avançado
 * quando a flag "perguntar antes de gerar" está ativa.
 *
 * Modelo: Gemini 2.5 Flash (barato, ~$0.001 por chamada).
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "generate-interview", user.id),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: InterviewRequest;
  try {
    body = (await request.json()) as InterviewRequest;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const topic = (body.topic || "").trim();
  if (!topic) {
    return Response.json({ error: "topic obrigatório" }, { status: 400 });
  }
  if (topic.length > 5000) {
    return Response.json({ error: "topic > 5000 chars" }, { status: 400 });
  }

  const niche = (body.niche || "general").slice(0, 60);
  const tone = (body.tone || "editorial").slice(0, 60);
  const lang = (body.language || "pt-br").slice(0, 12);

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json({ error: "IA indisponível" }, { status: 503 });
  }

  // Brand context opcional — enriquece as perguntas quando user tem voz
  // configurada (ex: se audience é "founders B2B", a IA pergunta sobre
  // founders específicos, não "pessoas que querem empreender").
  let brandHint = "";
  const sb = createServiceRoleSupabaseClient();
  if (sb) {
    try {
      const { data: prof } = await sb
        .from("profiles")
        .select("brand_analysis")
        .eq("id", user.id)
        .single();
      const ba = prof?.brand_analysis as Record<string, unknown> | null;
      if (ba) {
        const audience = (ba.audience_description as string) || "";
        const voice = (ba.voice_preference as string) || "";
        const pillars = Array.isArray(ba.content_pillars)
          ? (ba.content_pillars as string[]).join(", ")
          : "";
        if (audience || voice || pillars) {
          brandHint = `
CONTEXT DO CRIADOR (pra calibrar as perguntas):
${audience ? `- Audiência: ${audience}\n` : ""}${voice ? `- Voz preferida: ${voice}\n` : ""}${pillars ? `- Pilares: ${pillars}\n` : ""}`;
        }
      }
    } catch {
      /* sem brand é ok */
    }
  }

  const isPtBr = lang.startsWith("pt");
  const langInstr = isPtBr
    ? "Pergunte em português brasileiro coloquial."
    : "Ask in English.";

  const prompt = `Você é um editor sênior de conteúdo ajudando um criador a preparar um carrossel pra redes sociais. ${langInstr}

BRIEFING DO CRIADOR:
"""
${topic}
"""

NICHO: ${niche}
TOM DESEJADO: ${tone}
${brandHint}
Sua missão: identificar as **1 ou 2 perguntas mais importantes** que, se respondidas, transformariam esse briefing de genérico em específico. Você NÃO está tentando entender tudo — está procurando o UM GAP que mais melhora o output.

Tipos de gap pra detectar:
- Dado faltando (ex: "quantos clientes", "qual resultado exato", "em quanto tempo")
- Audiência ambígua (ex: "founder" — pré-seed ou Série A? solo ou com time?)
- Ângulo não-escolhido (ex: pode ser data-driven OU story — qual prefere?)
- CTA ausente (ex: quer engajamento, lead, link, compra?)
- Exemplo concreto faltando (ex: "tem algum case real que você pode citar?")
- Contexto do canal (ex: post de autoridade ou de conexão?)

REGRAS:
- Máximo 2 perguntas. Preferir 1 pergunta excelente do que 2 médias.
- Cada pergunta tem max 140 caracteres.
- \`why\` explica em 1 frase curta por que a resposta melhora o output.
- \`suggestedAnswer\` opcional — exemplo breve de resposta (pode ajudar o user).
- Perguntas ESPECÍFICAS ao briefing que o user escreveu — não perguntas genéricas de template.
- Se o briefing já é MUITO específico (tem dados, audiência clara, ângulo definido, CTA), retorne array vazio (\`questions: []\`) — significa que não precisa perguntar nada.

Retorne JSON válido:
{
  "questions": [
    {
      "id": "q1",
      "question": "string (max 140 chars)",
      "why": "string curta",
      "suggestedAnswer": "opcional, string curta ou omitir"
    }
  ]
}`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );
    const text = result.text || "";
    const usage = result.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    await recordGeneration({
      userId: user.id,
      model: "gemini-2.5-flash",
      provider: "google",
      inputTokens,
      outputTokens,
      costUsd: costForTokens("gemini-2.5-flash", inputTokens, outputTokens),
      promptType: "concepts",
    });

    let parsed: { questions?: InterviewQuestion[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { questions: [] };
    }

    const questions = (parsed.questions ?? [])
      .slice(0, 2)
      .map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: (q.question || "").slice(0, 200),
        why: (q.why || "").slice(0, 200),
        suggestedAnswer: q.suggestedAnswer?.slice(0, 200),
      }))
      .filter((q) => q.question.length > 5);

    return Response.json({ questions });
  } catch (err) {
    console.error("[generate/interview] Gemini falhou:", err);
    return Response.json({ questions: [] }); // fail-soft: sem perguntas, continua geração
  }
}
