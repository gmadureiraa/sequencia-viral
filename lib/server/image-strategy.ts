/**
 * Cache tematico de imagens geradas. TTL 30d, isolado por user.
 *
 * 2026-05-08: a função `planSlideImages` (alternava search/generate par/ímpar)
 * foi REMOVIDA. Hoje todo slide é decidido individualmente pelo `image-decider`
 * (lib/server/image-decider.ts) que usa Gemini Flash 2.5 pra escolher prompt
 * cinematográfico estruturado. Sem busca online no auto-flow.
 *
 * Cache tematico (TTL 30d):
 *  - Hash sha256(userId::mode::query) → image_theme_cache
 *  - Chave inclui userId para evitar vazamento de imagens entre usuarios:
 *    User A gera "bitcoin chart" → User B com mesma query NAO recebe a
 *    imagem cacheada do A. Cada usuario tem seu proprio espaco de cache.
 *  - Caches antigos (sem userId na chave) viram orphans no DB — expiram
 *    naturalmente via TTL 30d sem necessidade de limpeza manual.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────────────────
// Cache tematico
// ──────────────────────────────────────────────────────────────────────────

const CACHE_TABLE = "image_theme_cache";
// TTL 30d (antes 7d). Aumento agressivo pra maximizar cache hit em users que
// fazem muitos carrosseis do mesmo nicho. Imagens IA nao envelhecem rapido —
// um tema como 'crypto chart' ou 'creator trabalhando' pode ser reusado por
// meses sem perder qualidade. Se user reclamar de repeticao visual, reduz.
const CACHE_TTL_DAYS = 30;

/**
 * Gera a chave de cache incluindo userId para garantir isolamento entre
 * usuarios. Sem user_id na chave, um usuario poderia receber imagens
 * geradas no contexto de outro (ex: imagens com identidade de marca
 * diferente, personas, nichos distintos).
 *
 * userId pode ser vazio string em contextos sem auth (fallback seguro:
 * nenhum hit de cache sera retornado pois a chave sera diferente).
 */
function themeHash(
  query: string,
  mode: "generate" | "search" | "stock",
  userId: string
): string {
  const normalized = query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 300);
  // Chave: userId::mode::query — userId garante isolamento por usuario
  return createHash("sha256")
    .update(`${userId}::${mode}::${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

export async function getCachedThemeImage(
  supabase: SupabaseClient,
  query: string,
  mode: "generate" | "search" | "stock",
  userId: string
): Promise<string | null> {
  if (!query.trim() || !userId) return null;
  const key = themeHash(query, mode, userId);
  const cutoff = new Date(
    Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  try {
    const { data } = await supabase
      .from(CACHE_TABLE)
      .select("url, created_at")
      .eq("theme_key", key)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.url ?? null;
  } catch {
    return null;
  }
}

export async function recordThemeImage(
  supabase: SupabaseClient,
  query: string,
  mode: "generate" | "search" | "stock",
  url: string,
  userId: string
): Promise<void> {
  if (!query.trim() || !url || !userId) return;
  const key = themeHash(query, mode, userId);
  try {
    await supabase.from(CACHE_TABLE).insert({
      theme_key: key,
      query_text: query.slice(0, 300),
      mode,
      url,
      // user_id gravado para auditoria e futuras queries filtradas
      user_id: userId,
    });
  } catch {
    /* cache e best-effort — falha nao quebra fluxo */
  }
}
