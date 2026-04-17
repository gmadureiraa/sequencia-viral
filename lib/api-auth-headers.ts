import type { Session } from "@supabase/supabase-js";

/**
 * JSON + Bearer quando há sessão. Sem sessão, só `Content-Type` (ex.: onboarding convidado + scraper público).
 */
export function jsonWithAuth(session: Session | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}
