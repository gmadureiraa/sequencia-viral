/**
 * Adapter ScrapeCreators (https://scrapecreators.com). Fallback do Apify —
 * 1 credito por chamada (profile + posts) e payload espelha a API interna
 * do Instagram (`edge_followed_by`, `carousel_media`, `image_versions2`).
 *
 * Dois endpoints:
 *  - GET /v1/instagram/profile?handle=xxx           -> dados do perfil
 *  - GET /v2/instagram/user/posts?handle=xxx        -> ultimos ~12 posts
 *
 * Nao ha endpoint combinado, entao chamamos em paralelo via Promise.all.
 * Se a chave `SCRAPECREATORS_API_KEY` nao estiver setada, o adapter nao
 * deve ser instanciado (ver `index.ts`) — mas por precaucao ele throw
 * `ScraperError("key missing", ..., false)` nao-retryable se alguem pular
 * a checagem.
 */

import {
  InstagramScraper,
  ProfileData,
  RecentPost,
  ScraperError,
} from "./types";
import { inferNiche } from "./common";

const BASE = "https://api.scrapecreators.com";
const TIMEOUT_MS = 20_000;

type Json = Record<string, unknown>;

async function callEndpoint(path: string, handle: string, apiKey: string): Promise<Json> {
  const url = `${BASE}${path}?handle=${encodeURIComponent(handle.replace(/^@/, ""))}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    throw new ScraperError(
      `scrapecreators network error on ${path}: ${msg}`,
      "scrapecreators",
      true
    );
  }

  if (res.status === 429) {
    throw new ScraperError(
      `scrapecreators 429 on ${path} (rate limited)`,
      "scrapecreators",
      true
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryable = res.status >= 500;
    throw new ScraperError(
      `scrapecreators ${res.status} on ${path}: ${text.slice(0, 120)}`,
      "scrapecreators",
      retryable
    );
  }

  const json = (await res.json().catch(() => null)) as Json | null;
  if (!json) {
    throw new ScraperError(
      `scrapecreators returned invalid JSON on ${path}`,
      "scrapecreators",
      true
    );
  }
  return json;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBestImage(candidates: any[]): string | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  // Candidates normalmente vem ordenados por resolucao desc. Pegamos o
  // primeiro que for uma URL valida.
  for (const c of candidates) {
    const url = c?.url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPrimaryImage(post: any): string | null {
  // image_versions2.candidates -> shape novo IG
  const fromCandidates = pickBestImage(post?.image_versions2?.candidates ?? []);
  if (fromCandidates) return fromCandidates;
  return (
    post?.display_uri ??
    post?.display_url ??
    post?.thumbnail_url ??
    null
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCarouselUrls(post: any): string[] {
  const children: unknown[] =
    post?.carousel_media ?? post?.carousel_media_v2 ?? [];
  if (!Array.isArray(children) || children.length === 0) return [];
  const urls: string[] = [];
  for (const c of children) {
    const img = extractPrimaryImage(c);
    if (img) urls.push(img);
  }
  return urls;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(post: any): RecentPost {
  const slideUrls = extractCarouselUrls(post);
  // media_type: 1 = image, 2 = video, 8 = carousel
  const mediaType = post?.media_type;
  const isCarousel = mediaType === 8 || slideUrls.length > 1;

  const primary =
    extractPrimaryImage(post) ??
    slideUrls[0] ??
    null;

  const code: string | undefined = post?.code ?? post?.shortcode;
  const permalink = code ? `https://www.instagram.com/p/${code}/` : null;

  const takenAt: number | undefined = post?.taken_at;
  const timestamp = takenAt ? new Date(takenAt * 1000).toISOString() : null;

  return {
    text: post?.caption?.text ?? post?.caption ?? "",
    likes: post?.like_count ?? 0,
    comments: post?.comment_count ?? 0,
    imageUrl: primary,
    slideUrls: isCarousel ? slideUrls : [],
    isCarousel,
    permalink,
    timestamp,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUserObject(profileJson: any): any | null {
  // Schema documentado: { success, status, data: { user: {...} } }
  // Alguns retornos legacy tem o user no topo. Cobrimos ambos.
  if (profileJson?.data?.user) return profileJson.data.user;
  if (profileJson?.user) return profileJson.user;
  if (profileJson?.data) return profileJson.data;
  return profileJson ?? null;
}

export class ScrapeCreatorsScraper implements InstagramScraper {
  id = "scrapecreators";

  async scrape(handle: string): Promise<ProfileData> {
    const apiKey = process.env.SCRAPECREATORS_API_KEY;
    if (!apiKey) {
      throw new ScraperError(
        "SCRAPECREATORS_API_KEY missing",
        "scrapecreators",
        false
      );
    }

    const cleanHandle = handle.replace(/^@/, "");

    const [profileJson, postsJson] = await Promise.all([
      callEndpoint("/v1/instagram/profile", cleanHandle, apiKey),
      callEndpoint("/v2/instagram/user/posts", cleanHandle, apiKey),
    ]);

    const user = extractUserObject(profileJson);
    if (!user) {
      throw new ScraperError(
        "scrapecreators profile empty",
        "scrapecreators",
        true
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = user as any;

    const bio: string | null = u.biography ?? u.bio ?? null;
    const avatarUrl: string | null =
      u.profile_pic_url_hd ??
      u.profile_pic_url ??
      u.profilePicUrl ??
      null;

    const followers: number | null =
      u.edge_followed_by?.count ??
      u.follower_count ??
      u.followersCount ??
      null;
    const following: number | null =
      u.edge_follow?.count ??
      u.following_count ??
      u.followsCount ??
      null;
    const name: string | null = u.full_name ?? u.fullName ?? u.name ?? null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pj = postsJson as any;
    const items: unknown[] = pj?.items ?? pj?.data?.items ?? [];
    const recentPosts: RecentPost[] = items.slice(0, 20).map((p) => mapPost(p));

    return {
      handle: cleanHandle,
      platform: "instagram",
      name,
      bio,
      avatarUrl,
      followers,
      following,
      niche: inferNiche(bio),
      recentPosts,
      partial: false,
    };
  }
}
