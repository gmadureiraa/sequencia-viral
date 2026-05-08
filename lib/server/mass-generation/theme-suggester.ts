/**
 * Sugere N temas pra geração em massa baseado no perfil do user.
 *
 * Inputs:
 *   - profile.brand_analysis (top_topics, content_pillars, niche, audience)
 *   - últimos 20 carrosseis do user (pra evitar repetir tema)
 *
 * Output: lista de N strings curtas (5-12 palavras), 1 tema por linha.
 *
 * Modelo: Gemini 2.5 Flash com `thinkingBudget: 0` (rápido, ~3-5s pra 10 temas).
 *
 * Fallback: se Gemini não responder ou perfil estiver vazio, retorna lista
 * genérica baseada no `niche` que pelo menos não trava o job — temas tipo
 * "5 erros comuns em <niche>", "guia rápido de <niche>", etc.
 */

import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 30_000;

interface BrandSnapshot {
  niche: string;
  topTopics: string[];
  contentPillars: string[];
  audience: string;
  tone: string;
}

async function loadBrandSnapshot(
  sb: SupabaseClient,
  userId: string
): Promise<BrandSnapshot> {
  const { data: prof } = await sb
    .from("profiles")
    .select("brand_analysis, niche, tone")
    .eq("id", userId)
    .maybeSingle();

  const ba = (prof?.brand_analysis ?? null) as Record<string, unknown> | null;
  const niche =
    (ba?.detected_niche && Array.isArray(ba.detected_niche)
      ? (ba.detected_niche as string[])[0]
      : null) ||
    (Array.isArray(prof?.niche) ? prof.niche[0] : null) ||
    "marketing";

  const topTopics =
    ba && Array.isArray(ba.top_topics) ? (ba.top_topics as string[]) : [];
  const contentPillars =
    ba && Array.isArray(ba.content_pillars)
      ? (ba.content_pillars as string[])
      : [];
  const audience = (ba?.audience_description as string) || "";
  const tone = (prof?.tone as string) || (ba?.tone_detected as string) || "editorial";

  return { niche, topTopics, contentPillars, audience, tone };
}

async function loadRecentCarouselTitles(
  sb: SupabaseClient,
  userId: string,
  limit = 20
): Promise<string[]> {
  const { data } = await sb
    .from("carousels")
    .select("title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .map((r) => (r.title as string) || "")
    .filter((t) => t.length > 0);
}

function fallbackThemes(snapshot: BrandSnapshot, count: number): string[] {
  const niche = snapshot.niche || "marketing";
  const seeds = [
    `5 erros que ninguém te conta sobre ${niche}`,
    `Como começar no ${niche} sem desperdício`,
    `O que mudou no ${niche} em 2026`,
    `Frameworks práticos pra ${niche}`,
    `Tendências e contra-tendências em ${niche}`,
    `Estudos de caso: ${niche} que deu certo`,
    `Mitos do ${niche} desmontados em 1 carrossel`,
    `Os 3 KPIs que importam em ${niche}`,
    `Antes vs depois: o que ${niche} entregou em 12 meses`,
    `A regra de 80/20 aplicada em ${niche}`,
  ];
  // Misturar com top_topics se houver
  const expanded = [
    ...seeds,
    ...snapshot.topTopics.flatMap((t) => [
      `Por que "${t}" virou commodity (e o que fazer agora)`,
      `${t}: o playbook que funciona em 2026`,
    ]),
  ];
  return expanded.slice(0, count);
}

function buildPrompt(
  snapshot: BrandSnapshot,
  recentTitles: string[],
  count: number
): string {
  return `Você é um estrategista de conteúdo brasileiro. Gere exatamente ${count} temas pra carrosseis de Instagram/LinkedIn de um creator no nicho "${snapshot.niche}".

PERFIL DO CREATOR:
- Pilares de conteúdo: ${snapshot.contentPillars.join(", ") || "(não informado)"}
- Top topics: ${snapshot.topTopics.join(", ") || "(não informado)"}
- Audiência: ${snapshot.audience || "(não informado)"}
- Tom: ${snapshot.tone}

CARROSSEIS RECENTES (NÃO REPETIR esses ângulos):
${recentTitles.length > 0 ? recentTitles.map((t) => `- ${t}`).join("\n") : "(nenhum)"}

REGRAS DOS TEMAS:
- 5-12 palavras cada
- Direto, sem clickbait barato
- Mistura: ensino prático, observação contra-intuitiva, framework, case study, opinião editorial
- Português brasileiro, frases naturais
- NUNCA começar com "Como" todos seguidos — varie início (números, perguntas, declarações)
- Não usar emojis
- Não usar "10 dicas pra X" — substituir por ângulos mais específicos

Retorne APENAS um JSON array de strings, sem markdown, sem comentário:
["tema 1", "tema 2", ...]`;
}

export async function suggestThemes(
  sb: SupabaseClient,
  userId: string,
  count: number
): Promise<string[]> {
  if (count < 1) return [];
  const safeCount = Math.min(count, 30);

  const [snapshot, recentTitles] = await Promise.all([
    loadBrandSnapshot(sb, userId),
    loadRecentCarouselTitles(sb, userId, 20),
  ]);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[mass-gen.suggester] GEMINI_API_KEY ausente — usando fallback");
    return fallbackThemes(snapshot, safeCount);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const result = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(snapshot, recentTitles, safeCount),
        config: {
          responseMimeType: "application/json",
          temperature: 0.8,
          maxOutputTokens: 2000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () =>
          reject(new Error("suggestThemes timeout"))
        )
      ),
    ]);
    clearTimeout(timeout);

    const text = (result as { text?: string }).text || "";
    if (!text.trim()) return fallbackThemes(snapshot, safeCount);

    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return fallbackThemes(snapshot, safeCount);

    const themes = parsed
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length >= 5 && t.length <= 200)
      .slice(0, safeCount);

    if (themes.length < safeCount) {
      // Completa com fallback se Gemini gerou menos que pedido
      const fallback = fallbackThemes(snapshot, safeCount - themes.length);
      themes.push(...fallback);
    }

    return themes.slice(0, safeCount);
  } catch (err) {
    console.warn("[mass-gen.suggester] gemini falhou — fallback:", err);
    return fallbackThemes(snapshot, safeCount);
  }
}
