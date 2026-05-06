/**
 * POST /api/zernio/triggers/suggest-themes
 *
 * Gera N sugestões de temas pra trigger do Piloto Auto baseado em:
 *  - niche (override do form)
 *  - editorialLine (override do form)
 *  - brand context do user (pillars, topics, voice DNA salvo no profile)
 *  - existingThemes (pra evitar redundância)
 *
 * Body: { niche?, editorialLine?, count?, existingThemes? }
 * Resp: { themes: string[] }
 *
 * Custo: ~$0.0008 por chamada (Gemini 2.5 Flash, thinkingBudget=0).
 *
 * Temas são DIRECIONAMENTOS curtos (1 frase / 6-14 palavras), não títulos
 * finais. A IA do gerador desenvolve em copy completo a cada disparo.
 */

import { GoogleGenAI } from "@google/genai";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { loadBrandContextForUser } from "@/lib/server/brand-context";
import { geminiWithRetry } from "@/lib/server/gemini-retry";

export const runtime = "nodejs";
export const maxDuration = 30;

interface SuggestBody {
  niche?: string;
  editorialLine?: string;
  count?: number;
  existingThemes?: string[];
}

const MAX_COUNT = 25;
const DEFAULT_COUNT = 15;

export async function POST(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-suggest-themes", user.id),
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit. Tente em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: SuggestBody;
  try {
    body = (await request.json()) as SuggestBody;
  } catch {
    body = {};
  }

  const niche = (body.niche || "").trim().slice(0, 120);
  const editorialLine = (body.editorialLine || "").trim().slice(0, 1500);
  const count = Math.max(1, Math.min(MAX_COUNT, body.count || DEFAULT_COUNT));
  const existing = (body.existingThemes ?? [])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean)
    .slice(0, 50);

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY ausente." },
      { status: 503 }
    );
  }

  // Carrega brand context (pillars, topics, voice DNA, audience)
  const sb = createServiceRoleSupabaseClient();
  let brandContext = "";
  if (sb) {
    const ctx = await loadBrandContextForUser(sb, user.id);
    brandContext = ctx.brandContext;
  }

  const existingBlock =
    existing.length > 0
      ? `\nTEMAS JÁ NO POOL (NÃO repita ideia, gere ângulos diferentes ou complementares):\n${existing
          .slice(0, 30)
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}\n`
      : "";

  const nicheBlock = niche ? `\nNICHO DECLARADO: ${niche}\n` : "";
  const editorialBlock = editorialLine
    ? `\nLINHA EDITORIAL / VOZ:\n${editorialLine}\n`
    : "";

  const prompt = `Você é um estrategista de conteúdo brasileiro. Gere ${count} TEMAS curtos pra alimentar um pool de geração automática de carrosséis (Instagram + LinkedIn).

REGRAS DO TEMA:
- 1 frase, 6 a 14 palavras.
- É um DIRECIONAMENTO pra IA desenvolver depois — NÃO é título de post nem manchete.
- Cada tema descreve UM ângulo / UMA ideia / UM ensinamento que o criador defenderia.
- Português BR. Linguagem natural, NÃO listagem corporativa.
- Variar formato: dor, contraste, contraintuitivo, processo, lição aprendida, opinião forte, mito, caso real.
- ZERO clichê genérico ("Como crescer no Instagram", "Dicas de produtividade"). Sempre com ângulo específico.

EXEMPLOS BONS (formato):
- "Por que produtores que faturam alto cobram caro mesmo no comecinho"
- "O erro que 90% das agências comete na hora de vender retainer"
- "O que o ChatGPT NUNCA deveria fazer no seu fluxo de copy"
- "Como contratar um closer sem virar babá pro resto da vida"
- "A diferença entre marca pessoal e personalidade — quase ninguém entende"

EXEMPLOS RUINS:
- "Marketing digital" (vago, sem ângulo)
- "10 dicas de produtividade" (listão genérico)
- "Bem-vindo ao mundo das vendas online" (manchete, não direcionamento)

${nicheBlock}${editorialBlock}${brandContext ? `\nCONTEXTO DA MARCA:\n${brandContext}\n` : ""}${existingBlock}

Retorne APENAS JSON, sem markdown, sem texto antes ou depois:
{"themes": ["tema 1", "tema 2", ...]}`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.95,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    );

    const text = result.text || "";
    let parsed: { themes?: unknown };
    try {
      parsed = JSON.parse(text) as { themes?: unknown };
    } catch {
      // Tenta extrair JSON inline (defensivo — Gemini às vezes adiciona ```json wrapping mesmo com responseMimeType)
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) {
        return Response.json(
          { error: "Resposta da IA inválida.", themes: [] },
          { status: 502 }
        );
      }
      parsed = JSON.parse(m[0]) as { themes?: unknown };
    }

    const themes = Array.isArray(parsed.themes)
      ? (parsed.themes as unknown[])
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter((t) => t.length >= 8 && t.length <= 200)
          .slice(0, count)
      : [];

    if (themes.length === 0) {
      return Response.json(
        { error: "IA não devolveu temas válidos.", themes: [] },
        { status: 502 }
      );
    }

    return Response.json({ themes });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[suggest-themes] err:", detail);
    return Response.json(
      { error: `Erro ao gerar temas: ${detail.slice(0, 200)}`, themes: [] },
      { status: 500 }
    );
  }
}
