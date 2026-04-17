// ---------------------------------------------------------------------------
// Client-side helper for the profile scraper API
// ---------------------------------------------------------------------------

import type { Session } from "@supabase/supabase-js";
import { jsonWithAuth } from "@/lib/api-auth-headers";

export type Platform = "twitter" | "instagram";

export interface RecentPost {
  text: string;
  likes: number;
  comments: number;
}

export interface ProfileData {
  handle: string;
  platform: Platform;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  niche: string | null;
  recentPosts: RecentPost[];
  /** true when Apify failed and only the handle is known */
  partial: boolean;
}

/**
 * Scrapes a social media profile via the Sequência Viral API.
 * `session` opcional: com token, conta para rate limit por usuário; sem token, por IP (onboarding convidado).
 */
export async function scrapeProfile(
  platform: Platform,
  handle: string,
  session: Session | null = null
): Promise<ProfileData> {
  const res = await fetch("/api/profile-scraper", {
    method: "POST",
    headers: jsonWithAuth(session),
    body: JSON.stringify({ platform, handle }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error ?? `Failed to scrape profile (${res.status})`;
    throw new Error(msg);
  }

  return res.json();
}
