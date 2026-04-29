import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { extractContentFromUrl } from "@/lib/url-extractor";
import { getYouTubeTranscript } from "@/lib/youtube-transcript";
import {
  costForTokens,
  recordGeneration,
} from "@/lib/server/generation-log";
import { GoogleGenAI } from "@google/genai";

/**
 * Constrói o bloco "USER BRAND CONTEXT" a partir de profiles.brand_analysis.
 * Pattern copiado de /api/generate/route.ts:87-104 + novos campos do onboarding
 * (voice_samples / tabus / content_rules).
 */
function buildBrandContext(ba: Record<string, unknown> | null): string {
  if (!ba || typeof ba !== "object") return "";
  const pillars = Array.isArray(ba.content_pillars)
    ? (ba.content_pillars as string[]).join(", ")
    : "";
  const topics = Array.isArray(ba.top_topics)
    ? (ba.top_topics as string[]).join(", ")
    : "";
  const tone_detected = (ba.tone_detected as string) || "";
  const audience = (ba.audience_description as string) || "";
  const voice = (ba.voice_preference as string) || "";
  const samples = Array.isArray(ba.voice_samples)
    ? (ba.voice_samples as string[])
        .map((s) => (typeof s === "string" ? s.slice(0, 240) : ""))
        .filter(Boolean)
        .join("\n---\n")
    : "";
  const tabus = Array.isArray(ba.tabus)
    ? (ba.tabus as string[]).filter(Boolean).join(", ")
    : "";
  const rules = Array.isArray(ba.content_rules)
    ? (ba.content_rules as string[]).filter(Boolean).join("; ")
    : "";
  if (
    !pillars &&
    !topics &&
    !tone_detected &&
    !audience &&
    !voice &&
    !samples &&
    !tabus &&
    !rules
  ) {
    return "";
  }
  return `
USER BRAND CONTEXT (use this to make content sound authentically like this creator, not generic AI):
- Content pillars: ${pillars || "not specified"}
- Typical topics: ${topics || "not specified"}
- Detected writing tone: ${tone_detected || "not specified"}
- Target audience: ${audience || "not specified"}
- Voice preference: ${voice || "not specified"}
${samples ? `- Voice samples (imite ritmo e estrutura, não copie literalmente):\n${samples}\n` : ""}${tabus ? `- NEVER use these words or phrases: ${tabus}\n` : ""}${rules ? `- Rules to follow strictly: ${rules}\n` : ""}`;
}

export const maxDuration = 45;

/**
 * STEP 1: Generate 5 carousel CONCEPTS (cheap, fast).
 * Returns just title + hook + style for the user to pick.
 * Then /api/generate expands the chosen concept into a full carousel.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const limiter = await rateLimit({
      key: getRateLimitKey(request, "concepts", user.id),
      limit: 100,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
      );
    }

    const {
      topic,
      niche,
      tone,
      language,
      sourceType,
      sourceUrl,
    } = await request.json();

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return Response.json({ error: "IA não configurada." }, { status: 503 });
    }

    // Brand context do profile (opcional — se usuário não completou onboarding,
    // brandContext fica vazio e o prompt funciona normalmente).
    let brandContext = "";
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      const { data: prof } = await sb
        .from("profiles")
        .select("brand_analysis")
        .eq("id", user.id)
        .single();
      brandContext = buildBrandContext(
        (prof?.brand_analysis as Record<string, unknown> | null) ?? null
      );
    }

    // Extração de fonte real quando o brief tem URL (YouTube transcript /
    // artigo / carrossel IG). Sem isso, os conceitos ficam genéricos baseados
    // só no título. Com isso, Gemini vê o conteúdo e propõe ângulos concretos.
    let sourceContent = "";
    let sourceContentKind: "video" | "link" | "instagram" | "" = "";
    try {
      if (sourceType === "video" && typeof sourceUrl === "string" && sourceUrl) {
        sourceContent = await getYouTubeTranscript(sourceUrl);
        sourceContentKind = "video";
      } else if (
        sourceType === "link" &&
        typeof sourceUrl === "string" &&
        sourceUrl
      ) {
        sourceContent = await extractContentFromUrl(sourceUrl);
        sourceContentKind = "link";
      } else if (
        sourceType === "instagram" &&
        typeof sourceUrl === "string" &&
        sourceUrl
      ) {
        const { extractInstagramContent } = await import(
          "@/lib/instagram-extractor"
        );
        sourceContent = await extractInstagramContent(sourceUrl);
        sourceContentKind = "instagram";
      }
    } catch (err) {
      // Falha de extração não bloqueia — gera conceitos só com o tema.
      console.warn(
        "[concepts] source extraction failed, falling back to topic only:",
        err instanceof Error ? err.message : err
      );
    }

    const langNote = (language || "pt-br").startsWith("pt")
      ? "Responda em português brasileiro coloquial."
      : language === "en" ? "Respond in English." : `Respond in ${language}.`;

    // Seed de diversidade evita que o modelo caia sempre na mesma rotação de
    // ângulos (o problema do "sempre os mesmos 5 caminhos").
    const diversitySeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const sourceBlock = sourceContent
      ? `\n# CONTEÚDO REAL EXTRAÍDO (${sourceContentKind}):
${sourceContent.slice(0, 6000)}

REGRA OBRIGATÓRIA: cada conceito DEVE referenciar algo específico desse conteúdo — uma frase, um número, um momento, um argumento concreto. Não invente fatos. Não generalize. Se o conteúdo não tiver material suficiente pra um ângulo, pule esse ângulo.\n`
      : "";

    const prompt = `Você é um estrategista de conteúdo sênior pitchando 5 histórias de carrossel radicalmente diferentes pra uma banca editorial. ${langNote}

NICHE: ${niche || "general"}
TONE: ${tone || "casual"}
${brandContext}
TÍTULO/TEMA DO USUÁRIO: ${topic}
${sourceBlock}
# SUA MISSÃO
Gere 5 conceitos de carrossel. Cada um precisa ser uma HISTÓRIA COMPLETAMENTE DIFERENTE — tensão diferente, emoção diferente na audiência, estrutura narrativa diferente. O leitor deve querer ler OS 5, não achar que são a mesma ideia reformulada.

${
  sourceContent
    ? `# BASEIE-SE NO CONTEÚDO REAL
O usuário trouxe um ${sourceContentKind === "video" ? "vídeo do YouTube (transcrição acima)" : sourceContentKind === "link" ? "artigo/link (texto extraído acima)" : "carrossel do Instagram (transcrição + legenda acima)"}. Leia com atenção e extraia:
- Os argumentos centrais que a pessoa faz
- Os dados, exemplos, nomes, números que ela usa
- As tensões, contradições e frases de destaque
- O que ela NÃO diz (buraco que um carrossel pode preencher)

Cada conceito deve ser um ângulo DIFERENTE sobre esse material. NÃO faça 5 "reenquadramentos". Varie entre: extensão (desenvolver o que foi dito), contra-ponto, aprofundamento técnico, caso prático aplicando a ideia, síntese visual, narrativa pessoal inspirada, bastidor do argumento, lista de implicações práticas, etc.`
    : `# SEM FONTE EXTERNA
O usuário deu só o tema. Varie os ângulos livremente: dado surpreendente, história pessoal, provocação, passo-a-passo técnico, mito vs verdade, lista de erros, estudo de caso, tese contrária, sequência de implicações. NÃO se limite a "reenquadramento/conflito/contradição/mecanismo/inversão" em ordem fixa — decida o que cabe melhor pra ESSE tema.`
}

# REGRA DO HOOK
Cada hook tem 2 partes separadas por "|":
- Parte 1 (INTERRUPÇÃO): Max 8 palavras. Para o scroll. Cria um gap — algo inesperado, contra-intuitivo ou emocional. Use ponto, dois-pontos ou interrogação.
- Parte 2 (ÂNCORA): Max 12 palavras. Dá contexto e stakes. Termina com "." ou "!".

O hook precisa funcionar em 0.7s. Sem palavras de enchimento. Nada genérico como "Descubra como" ou "O guia definitivo".

# QUALITY GATES (cada conceito deve passar em TODOS)
- Um criador de conteúdo pararia o scroll pra ler isso? Se não, kill it.
- O hook é ESPECÍFICO pra esse exato tema${sourceContent ? "/conteúdo extraído" : ""}? Se desse pra trocar o tema e o hook ainda funcionar, tá genérico demais.
- O ângulo revela uma TENSÃO (não só informação)? Sem tensão, sem swipe.
- BANIDO: "muitas pessoas", "resultados incríveis", "game-changer", "descubra como", "o segredo de", "o guia definitivo", "você precisa saber"
- Todo número é específico: "78%", "3 em cada 10", nunca "a maioria" ou "muitos"

# VARIAÇÃO OBRIGATÓRIA ENTRE OS 5 CONCEITOS
Cada um DEVE ter:
- Uma estrutura narrativa distinta (ex: lista, história, tese-antítese, passo-a-passo, ranking)
- Um hook emocional diferente (curiosidade, medo, identificação, surpresa, autoridade)
- Um formato de entrega diferente (dado puro, case, frase de impacto, analogia, bastidor)

Se dois conceitos ficarem parecidos demais, REESCREVA um deles.

[variation-seed: ${diversitySeed}]

# FORMATO DE SAÍDA
Retorne APENAS JSON válido:
{"concepts":[{"title":"max 45 chars — título do carrossel","hook":"linha de interrupção | linha âncora","style":"data|story|provocative|howto|mythbust","angle":"1 frase: a TENSÃO narrativa e POR QUE isso importa (max 25 palavras)"}]}

Gere exatamente 5 conceitos. Faça cada um tão convincente que o leitor não consiga escolher só um.`;

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          // Temperatura alta + topP alto força variedade entre as 5 saídas.
          temperature: 1.0,
          topP: 0.95,
          maxOutputTokens: 2500,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );

    const text = result.text || "";
    let parsed: { concepts: Array<{ title: string; hook: string; style: string; angle: string }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else return Response.json({ error: "Failed to parse concepts" }, { status: 502 });
    }

    // Log de custo — concepts usa menos token que carrossel mas soma.
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

    return Response.json(parsed);
  } catch (error) {
    console.error("Concepts error:", error);
    return Response.json(
      { error: "Erro ao gerar conceitos. Tente novamente." },
      { status: 500 }
    );
  }
}
