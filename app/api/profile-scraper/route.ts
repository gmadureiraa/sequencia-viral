/**
 * MVP: aceita chamadas sem sessão (onboarding só com @). Quando login/anti-abuso
 * estiverem maduros, restringir a usuários autenticados — ver
 * `docs/product/roadmap-internal.md`.
 */
export const maxDuration = 60;
import { getAuthenticatedUser } from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = "twitter" | "instagram";

interface ScrapeRequest {
  platform: Platform;
  handle: string;
}

interface RecentPost {
  text: string;
  likes: number;
  comments: number;
}

interface ProfileData {
  handle: string;
  platform: Platform;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  niche: string | null;
  recentPosts: RecentPost[];
  partial: boolean;
}

// ---------------------------------------------------------------------------
// Apify config
// ---------------------------------------------------------------------------

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_TIMEOUT_SECS = 30;

// Reliable, well-maintained Apify actors (2025/2026)
const ACTORS: Record<Platform, { id: string; buildInput: (handle: string) => Record<string, unknown> }> = {
  twitter: {
    // apidojo/twitter-user-scraper — fast profile + tweets extraction
    id: "apidojo~twitter-user-scraper",
    buildInput: (handle: string) => ({
      twitterHandles: [handle.replace(/^@/, "")],
      maxItems: 1,
    }),
  },
  instagram: {
    // apify/instagram-profile-scraper — official Apify actor
    id: "apify~instagram-profile-scraper",
    buildInput: (handle: string) => ({
      usernames: [handle.replace(/^@/, "")],
      resultsLimit: 1,
    }),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeHandle(raw: string): string {
  // Strip @, whitespace, and common URL prefixes
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com|instagram\.com)\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
}

function inferNiche(bio: string | null): string | null {
  if (!bio) return null;
  const lower = bio.toLowerCase();

  const nicheKeywords: Record<string, string[]> = {
    "crypto / web3": ["crypto", "web3", "blockchain", "defi", "nft", "bitcoin", "ethereum", "solana"],
    "finance / investing": ["finance", "invest", "trading", "stocks", "fintech", "wealth"],
    "marketing / growth": ["marketing", "growth", "ads", "brand", "agency", "seo", "content"],
    "tech / engineering": ["developer", "engineer", "coding", "software", "programming", "devops", "fullstack"],
    "design / creative": ["design", "ux", "ui", "creative", "artist", "illustrat"],
    "ai / machine learning": ["ai", "artificial intelligence", "machine learning", "llm", "gpt", "deep learning"],
    "education": ["teacher", "professor", "education", "learn", "mentor", "coach"],
    "health / fitness": ["fitness", "health", "wellness", "gym", "nutrition", "yoga"],
    "gaming": ["gaming", "gamer", "esports", "twitch", "streamer"],
    "music / entertainment": ["music", "musician", "artist", "producer", "dj", "entertainment"],
  };

  for (const [niche, keywords] of Object.entries(nicheKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return niche;
    }
  }
  return null;
}

function fallbackProfile(handle: string, platform: Platform): ProfileData {
  return {
    handle,
    platform,
    name: null,
    bio: null,
    avatarUrl: null,
    followers: null,
    following: null,
    niche: null,
    recentPosts: [],
    partial: true,
  };
}

// ---------------------------------------------------------------------------
// Apify call
// ---------------------------------------------------------------------------

async function callApify(platform: Platform, handle: string): Promise<unknown[]> {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) throw new Error("APIFY_API_KEY is not configured");

  const actor = ACTORS[platform];
  const url = `${APIFY_BASE}/acts/${actor.id}/run-sync-get-dataset-items?timeout=${APIFY_TIMEOUT_SECS}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(actor.buildInput(handle)),
    signal: AbortSignal.timeout(35_000), // slightly above Apify timeout
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// Normalizers — extract a uniform ProfileData from each actor's output
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTwitter(item: any, handle: string): ProfileData {
  const recentPosts: RecentPost[] = [];

  // apidojo/twitter-user-scraper returns tweets in `tweets` or the user may
  // appear at top-level with tweet fields. We handle both shapes.
  const tweets: unknown[] = item.tweets ?? item.latestTweets ?? [];
  for (const tw of tweets.slice(0, 5)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = tw as any;
    recentPosts.push({
      text: t.text ?? t.full_text ?? t.tweet ?? "",
      likes: t.likeCount ?? t.favoriteCount ?? t.likes ?? 0,
      comments: t.replyCount ?? t.comments ?? 0,
    });
  }

  const bio: string | null = item.description ?? item.bio ?? item.rawDescription ?? null;

  return {
    handle,
    platform: "twitter",
    name: item.name ?? item.displayName ?? item.userName ?? null,
    bio,
    avatarUrl: item.profilePicture ?? item.profileImageUrl ?? item.avatar ?? item.profileImageUrlHttps ?? null,
    followers: item.followers ?? item.followersCount ?? item.followerCount ?? null,
    following: item.following ?? item.friendsCount ?? item.followingCount ?? null,
    niche: inferNiche(bio),
    recentPosts,
    partial: false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeInstagram(item: any, handle: string): ProfileData {
  const recentPosts: RecentPost[] = [];

  const posts: unknown[] = item.latestPosts ?? item.posts ?? item.recentPosts ?? [];
  for (const p of posts.slice(0, 5)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = p as any;
    recentPosts.push({
      text: post.caption ?? post.text ?? "",
      likes: post.likesCount ?? post.likes ?? 0,
      comments: post.commentsCount ?? post.comments ?? 0,
    });
  }

  const bio: string | null = item.biography ?? item.bio ?? null;

  return {
    handle,
    platform: "instagram",
    name: item.fullName ?? item.name ?? null,
    bio,
    avatarUrl: item.profilePicUrl ?? item.profilePicUrlHD ?? item.avatarUrl ?? item.profilePic ?? null,
    followers: item.followersCount ?? item.followers ?? null,
    following: item.followsCount ?? item.following ?? item.followingCount ?? null,
    niche: inferNiche(bio),
    recentPosts,
    partial: false,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { error: "Authentication required. Send Authorization: Bearer <token>." },
        { status: 401 }
      );
    }

    const limiter = checkRateLimit({
      key: getRateLimitKey(request, "profile-scraper", user.id),
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });
    if (!limiter.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSec),
          },
        }
      );
    }

    const body: ScrapeRequest = await request.json();
    const { platform, handle: rawHandle } = body;

    // Validate
    if (!platform || !["twitter", "instagram"].includes(platform)) {
      return Response.json({ error: "Invalid platform. Use 'twitter' or 'instagram'." }, { status: 400 });
    }

    const handle = sanitizeHandle(rawHandle ?? "");
    if (!handle) {
      return Response.json({ error: "Handle is required." }, { status: 400 });
    }

    // Call Apify
    let profile: ProfileData;

    try {
      const items = await callApify(platform, handle);

      if (items.length === 0) {
        // No data returned — return fallback
        profile = fallbackProfile(handle, platform);
      } else {
        const item = items[0];
        profile =
          platform === "twitter"
            ? normalizeTwitter(item, handle)
            : normalizeInstagram(item, handle);
      }
    } catch (apifyError) {
      console.error("[profile-scraper] Apify error:", apifyError);
      // Fallback: return partial data with just the handle
      profile = fallbackProfile(handle, platform);
    }

    return Response.json(profile);
  } catch (error) {
    console.error("[profile-scraper] Unexpected error:", error);
    return Response.json(
      { error: "Internal server error while scraping profile." },
      { status: 500 }
    );
  }
}
