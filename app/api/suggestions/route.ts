import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { geminiWithRetry } from "@/lib/server/gemini-retry";
import { GoogleGenAI } from "@google/genai";
import { costForTokens, recordGeneration } from "@/lib/server/generation-log";

export const maxDuration = 15;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type SuggestionItem = {
  id: string;
  title: string;
  hook: string;
  angle: string;
  style?: string;
};

type CachedSuggestions = {
  items: SuggestionItem[];
  generatedAt: string;
  nicheKey: string;
  toneKey: string;
};

function nicheKey(niche: string[] | null | undefined) {
  const arr = Array.isArray(niche) ? niche : [];
  return arr
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * GET /api/suggestions
 * Retorna 6 ideias de carrossel geradas pela IA baseadas em niche+tone do profile.
 * Cache por 24h em `profiles.brand_analysis.__suggestions`.
 * Força refresh: `?refresh=1`.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = checkRateLimit({
    key: getRateLimitKey(request, "suggestions", user.id),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit. Tenta mais tarde." },
      { status: 429 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    return Response.json({ error: "Supabase indisponível" }, { status: 503 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("niche,tone,language,brand_analysis")
    .eq("id", user.id)
    .single();

  const niche = (profile?.niche as string[] | null) || [];
  const tone = (profile?.tone as string | null) || "casual";
  const language = (profile?.language as string | null) || "pt-br";
  const currentKey = nicheKey(niche);

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Cache hit?
  const brandAnalysis =
    (profile?.brand_analysis as Record<string, unknown> | null) || {};
  const cached = brandAnalysis.__suggestions as CachedSuggestions | undefined;

  if (!forceRefresh && cached?.generatedAt) {
    const age = Date.now() - new Date(cached.generatedAt).getTime();
    if (
      age < CACHE_TTL_MS &&
      cached.nicheKey === currentKey &&
      cached.toneKey === tone &&
      Array.isArray(cached.items) &&
      cached.items.length > 0
    ) {
      return Response.json({
        items: cached.items,
        cached: true,
        ageSec: Math.round(age / 1000),
        generatedAt: cached.generatedAt,
      });
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json(
      { error: "IA não configurada no servidor", items: [] },
      { status: 503 }
    );
  }

  const langNote = (language || "pt-br").startsWith("pt")
    ? "Responda em português brasileiro coloquial."
    : language === "en"
      ? "Respond in English."
      : `Respond in ${language}.`;

  const nicheHint = niche.length > 0 ? niche.join(", ") : "marketing, conteúdo digital, IA";
  const prompt = `Você é um estrategista editorial. ${langNote}

Gere 6 IDEIAS DE CARROSSEL radicalmente diferentes para um creator com perfil:
- Nichos: ${nicheHint}
- Tom: ${tone}

REGRAS:
- Cada ideia deve ter um ângulo único: dados, provocação, história, como-fazer, mito, reenquadramento.
- Titles curtos e concretos (máx 45 chars).
- Hooks com 2 partes separadas por "|": parte 1 = interrupção (máx 8 palavras); parte 2 = âncora (máx 12 palavras).
- Angle = 1 frase explicando a tensão narrativa (máx 20 palavras).
- Evite cliché: nada de "descubra como", "o segredo", "guia definitivo".
- Cada ideia deve ser específica ao nicho mencionado — nunca genérica.

Retorne APENAS JSON válido no formato:
{"items":[{"id":"s1","title":"...","hook":"...|...","angle":"...","style":"data|story|provocative|howto|mythbust"}]}`;

  let parsed: { items?: SuggestionItem[] };
  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.95,
          maxOutputTokens: 1500,
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
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { items: [] };
    }
  } catch (err) {
    console.error("[suggestions] Gemini falhou:", err);
    // Fallback: se tem cache antigo mesmo expirado, devolve ele.
    if (cached?.items?.length) {
      return Response.json({
        items: cached.items,
        cached: true,
        stale: true,
        generatedAt: cached.generatedAt,
      });
    }
    return Response.json(
      { error: "Falha ao gerar ideias. Tente em alguns minutos.", items: [] },
      { status: 502 }
    );
  }

  const items = (parsed.items || []).slice(0, 6).map((it, idx) => ({
    id: it.id || `sug-${idx + 1}`,
    title: it.title?.slice(0, 60) || `Ideia ${idx + 1}`,
    hook: it.hook || "",
    angle: it.angle || "",
    style: it.style,
  }));

  if (items.length === 0) {
    return Response.json(
      { error: "IA não retornou ideias. Tente de novo.", items: [] },
      { status: 502 }
    );
  }

  // Salva cache
  const updatedBrand: Record<string, unknown> = {
    ...brandAnalysis,
    __suggestions: {
      items,
      generatedAt: new Date().toISOString(),
      nicheKey: currentKey,
      toneKey: tone,
    } satisfies CachedSuggestions,
  };
  await sb
    .from("profiles")
    .update({ brand_analysis: updatedBrand })
    .eq("id", user.id);

  return Response.json({
    items,
    cached: false,
    generatedAt: new Date().toISOString(),
  });
}
