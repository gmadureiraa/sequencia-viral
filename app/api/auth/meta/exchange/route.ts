/**
 * POST /api/auth/meta/exchange
 *
 * Recebe o short-lived access token que o FB JS SDK devolveu no browser,
 * troca por long-lived (60d) no server-side (precisa APP_SECRET que NAO pode
 * ir pro front), resolve a Instagram Business Account do user, salva em
 * meta_connections e retorna um snapshot de perfil no mesmo shape do
 * profile-scraper Apify — pro onboarding seguir o mesmo flow.
 *
 * Body: { accessToken: string, userID: string }
 */

import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { cacheImages } from "@/lib/server/scrape-cache";

export const maxDuration = 30;
export const runtime = "nodejs";

const GRAPH = "https://graph.facebook.com/v21.0";

interface ExchangeBody {
  accessToken: string;
  userID: string;
}

interface LongLivedTokenRes {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function graphFetch(url: string): Promise<any> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`graph ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "meta-exchange", user.id),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[meta/exchange] missing FB credentials");
    return Response.json(
      { error: "Meta integration not configured on server." },
      { status: 503 }
    );
  }

  let body: ExchangeBody;
  try {
    body = (await request.json()) as ExchangeBody;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.accessToken || !body.userID) {
    return Response.json(
      { error: "accessToken e userID obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // 1. Trocar short-lived → long-lived (60d)
    const llRes = (await graphFetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${encodeURIComponent(
        appSecret
      )}&fb_exchange_token=${encodeURIComponent(body.accessToken)}`
    )) as LongLivedTokenRes;

    const longLived = llRes.access_token;
    const expiresIn = llRes.expires_in ?? 60 * 24 * 60 * 60; // 60d default
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 2. Pegar debug do token (valida + lista scopes granted)
    const debug = await graphFetch(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(
        longLived
      )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
    );
    const grantedScopes: string[] = debug?.data?.scopes ?? [];

    // 3. Listar pages do user — IG Business conta é vinculada a uma Page.
    const pages = await graphFetch(
      `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count,biography}&access_token=${encodeURIComponent(
        longLived
      )}`
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageWithIg = (pages.data ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.instagram_business_account?.id
    );

    let igAccount: {
      id: string;
      username: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
      media_count?: number;
      biography?: string;
    } | null = null;
    let recentMedia: Array<{
      imageUrl: string | null;
      text: string;
      likes: number;
      comments: number;
      permalink: string | null;
      timestamp: string | null;
      isCarousel: boolean;
      slideUrls: string[];
    }> = [];

    if (pageWithIg?.instagram_business_account) {
      igAccount = pageWithIg.instagram_business_account;
      // 4. Pegar últimos 20 medias do IG Business.
      const mediaRes = await graphFetch(
        `${GRAPH}/${igAccount!.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_url,media_type}&limit=20&access_token=${encodeURIComponent(
          longLived
        )}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentMedia = (mediaRes.data ?? []).map((m: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children = (m.children?.data ?? []) as any[];
        const slideUrls = children
          .map((c) => c.media_url)
          .filter((u): u is string => typeof u === "string");
        const isCarousel = m.media_type === "CAROUSEL_ALBUM";
        const primary =
          m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
        return {
          imageUrl: primary ?? slideUrls[0] ?? null,
          text: m.caption ?? "",
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
          permalink: m.permalink ?? null,
          timestamp: m.timestamp ?? null,
          isCarousel,
          slideUrls: isCarousel ? slideUrls : [],
        };
      });
    }

    // 5. Cachear imagens no Supabase (mesma camada do Apify scrape).
    const urls: string[] = [];
    if (igAccount?.profile_picture_url) urls.push(igAccount.profile_picture_url);
    for (const m of recentMedia) {
      if (m.imageUrl) urls.push(m.imageUrl);
      for (const s of m.slideUrls) urls.push(s);
    }
    const cached = urls.length > 0 ? await cacheImages(user.id, urls) : new Map();

    const avatarUrl = igAccount?.profile_picture_url
      ? (cached.get(igAccount.profile_picture_url) ??
        igAccount.profile_picture_url)
      : null;

    const recentPosts = recentMedia.map((m) => ({
      ...m,
      imageUrl: m.imageUrl ? (cached.get(m.imageUrl) ?? m.imageUrl) : null,
      slideUrls: m.slideUrls.map((s) => cached.get(s) ?? s),
    }));

    // 6. Salvar conexão (upsert por user_id+meta_user_id).
    const sb = createServiceRoleSupabaseClient();
    if (sb) {
      await sb
        .from("meta_connections")
        .upsert(
          {
            user_id: user.id,
            meta_user_id: body.userID,
            ig_business_id: igAccount?.id ?? null,
            ig_username: igAccount?.username ?? null,
            ig_account_type: igAccount ? "BUSINESS" : null,
            access_token: longLived,
            token_expires_at: expiresAt,
            granted_scopes: grantedScopes,
            raw_profile: {
              ig: igAccount,
              page_id: pageWithIg?.id ?? null,
              page_name: pageWithIg?.name ?? null,
            },
            updated_at: new Date().toISOString(),
            revoked_at: null,
          },
          { onConflict: "user_id,meta_user_id" }
        );
    }

    // Retorna no mesmo shape do profile-scraper pra onboarding reusar a view.
    return Response.json({
      handle: igAccount?.username ?? "",
      platform: "instagram",
      name: igAccount?.name ?? null,
      bio: igAccount?.biography ?? null,
      avatarUrl,
      followers: igAccount?.followers_count ?? null,
      following: null,
      niche: null,
      recentPosts,
      partial: !igAccount,
      meta: {
        connected: true,
        ig_business_id: igAccount?.id ?? null,
        granted_scopes: grantedScopes,
        token_expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error("[meta/exchange] error:", err);
    const msg = err instanceof Error ? err.message : "exchange failed";
    return Response.json({ error: msg.slice(0, 200) }, { status: 502 });
  }
}
