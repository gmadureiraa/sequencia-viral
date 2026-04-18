import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url || !key) {
  if (typeof window !== "undefined") {
    console.warn(
      "[supabase] Client is null — missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "All Supabase operations will be skipped. Auth, saves, and profile updates will not work."
    );
  }
}

/**
 * Singleton do client do browser.
 *
 * Guardado em `globalThis` para sobreviver ao HMR do Next em dev e para não
 * criar mais de uma instância por página (rotas client-side trocam o módulo
 * em alguns edge cases). Duas instâncias competindo pelo mesmo localStorage
 * causam logout aleatório.
 */
type GlobalWithSb = typeof globalThis & {
  __svSupabase?: SupabaseClient | null;
};
const g = globalThis as GlobalWithSb;

function buildClient(): SupabaseClient | null {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "sv-auth",
    },
  });
}

export const supabase: SupabaseClient | null =
  g.__svSupabase ?? (g.__svSupabase = buildClient());
