/**
 * Estrategia de imagens por slide — decide quem recebe imagem e qual tecnologia.
 *
 * Regra (2026-04-22 v3 — TODOS slides com imagem):
 *  - Slide 0 (CAPA): SEMPRE Imagen 4 premium (scroll stopper, cinema)
 *  - Slides 1..N-1 (inner + CTA): TODOS recebem imagem. Alternam:
 *      - pos par   → Serper search (stock real, $0.008/img)
 *      - pos impar → Gemini 3.1 Flash Image (geracao simples, $0.008/img)
 *  - CTA tb tem imagem pq user reclamou de slide vazio
 *
 * Por que tudo tem imagem:
 *  - Template 'foto' tem espaco dedicado — sem imagem ficava vazio
 *  - Twitter template renderiza imagem se existir, texto puro fica magro
 *  - Gabriel prefere ate R\$ 1/carrossel do que slide vazio
 *
 * Custo estimado (6 slides):
 *  - 1 Imagen 4 capa: \$0.04
 *  - 3 Gemini Flash Image: 3 × \$0.008 = \$0.024
 *  - 2 Serper: 2 × \$0.008 = \$0.016
 *  - Total: ~\$0.08 = R\$ 0.45/carrossel (dentro do budget R\$ 1)
 *
 * Cache tematico (TTL 30d):
 *  - Hash sha256(mode::query) → image_theme_cache
 *  - Economia adicional em users que repetem temas do mesmo nicho
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImageAction = {
  slideIndex: number;
  /** "skip" = nao gera imagem, layout text-only. */
  mode: "generate" | "search" | "skip";
  /** Flag pro prompt Imagen ativar pipeline 2-pass cinematografico. */
  isCover: boolean;
  /** Razao da decisao — util pra log/debug. */
  reason: string;
};

export function planSlideImages(totalSlides: number): ImageAction[] {
  const actions: ImageAction[] = [];
  for (let i = 0; i < totalSlides; i++) {
    if (i === 0) {
      // Capa SEMPRE Imagen 4 — primeira impressao, scroll stopper.
      actions.push({
        slideIndex: i,
        mode: "generate",
        isCover: true,
        reason: "cover-imagen-4",
      });
      continue;
    }
    // Internos + CTA: TODOS tem imagem pra evitar slide vazio. Alternam
    // entre Serper stock e Gemini Flash Image (gen simples barata).
    const innerPos = i - 1;
    const useSearch = innerPos % 2 === 0;
    actions.push({
      slideIndex: i,
      mode: useSearch ? "search" : "generate",
      isCover: false,
      reason: useSearch ? "inner-stock" : "inner-flash-image",
    });
  }
  return actions;
}

// ──────────────────────────────────────────────────────────────────────────
// Cache tematico
// ──────────────────────────────────────────────────────────────────────────

const CACHE_TABLE = "image_theme_cache";
// TTL 30d (antes 7d). Aumento agressivo pra maximizar cache hit em users que
// fazem muitos carrosseis do mesmo nicho. Imagens IA nao envelhecem rapido —
// um tema como 'crypto chart' ou 'creator trabalhando' pode ser reusado por
// meses sem perder qualidade. Se user reclamar de repeticao visual, reduz.
const CACHE_TTL_DAYS = 30;

function themeHash(query: string, mode: "generate" | "search"): string {
  const normalized = query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 300);
  return createHash("sha256")
    .update(`${mode}::${normalized}`)
    .digest("hex")
    .slice(0, 32);
}

export async function getCachedThemeImage(
  supabase: SupabaseClient,
  query: string,
  mode: "generate" | "search"
): Promise<string | null> {
  if (!query.trim()) return null;
  const key = themeHash(query, mode);
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
  mode: "generate" | "search",
  url: string
): Promise<void> {
  if (!query.trim() || !url) return;
  const key = themeHash(query, mode);
  try {
    await supabase.from(CACHE_TABLE).insert({
      theme_key: key,
      query_text: query.slice(0, 300),
      mode,
      url,
    });
  } catch {
    /* cache e best-effort — falha nao quebra fluxo */
  }
}
