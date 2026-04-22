/**
 * Adapter Apify (`apify~instagram-profile-scraper`). Padrao primario — ja
 * esta rodando em prod ha meses.
 */

import {
  InstagramScraper,
  ProfileData,
  RecentPost,
  ScraperError,
} from "./types";
import { inferNiche } from "./common";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-profile-scraper";
const TIMEOUT_SECS = 30;

function buildInput(handle: string) {
  return {
    usernames: [handle.replace(/^@/, "")],
    resultsLimit: 1,
    addParentData: false,
    includePostDetails: true,
    postsLimit: 24,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(item: any, handle: string): ProfileData {
  const recentPosts: RecentPost[] = [];

  const posts: unknown[] =
    item.latestPosts ?? item.posts ?? item.recentPosts ?? [];

  for (const p of posts.slice(0, 20)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = p as any;
    const children: unknown[] = post.childPosts ?? post.children ?? [];
    const slideUrls = children
      .map((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ch = c as any;
        return ch.displayUrl ?? ch.imageUrl ?? ch.url ?? null;
      })
      .filter((u): u is string => !!u);
    const primaryImage: string | null =
      post.displayUrl ??
      post.imageUrl ??
      post.thumbnailUrl ??
      slideUrls[0] ??
      null;
    const isCarousel =
      post.type === "Sidecar" ||
      post.productType === "carousel_container" ||
      slideUrls.length > 1;

    recentPosts.push({
      text: post.caption ?? post.text ?? "",
      likes: post.likesCount ?? post.likes ?? 0,
      comments: post.commentsCount ?? post.comments ?? 0,
      imageUrl: primaryImage,
      slideUrls: isCarousel ? slideUrls : [],
      isCarousel,
      permalink: post.url ?? post.permalink ?? null,
      timestamp: post.timestamp ?? post.taken_at_timestamp ?? null,
    });
  }

  const bio: string | null = item.biography ?? item.bio ?? null;

  const avatarUrl: string | null =
    item.profilePicUrl ??
    item.profilePicture ??
    item.avatarUrl ??
    null;

  return {
    handle,
    platform: "instagram",
    name: item.fullName ?? item.name ?? null,
    bio,
    avatarUrl,
    followers: item.followersCount ?? item.followers ?? null,
    following:
      item.followsCount ?? item.following ?? item.followingCount ?? null,
    niche: inferNiche(bio),
    recentPosts,
    partial: false,
  };
}

export class ApifyInstagramScraper implements InstagramScraper {
  id = "apify";

  async scrape(handle: string): Promise<ProfileData> {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) throw new ScraperError("APIFY_API_KEY missing", "apify", false);

    const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=${TIMEOUT_SECS}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildInput(handle)),
        signal: AbortSignal.timeout(35_000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      throw new ScraperError(msg, "apify", true);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const retryable = res.status >= 500 || res.status === 429;
      throw new ScraperError(
        `apify ${res.status}: ${text.slice(0, 120)}`,
        "apify",
        retryable
      );
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    if (items.length === 0) {
      throw new ScraperError("apify returned 0 items", "apify", true);
    }
    return normalize(items[0], handle);
  }
}
