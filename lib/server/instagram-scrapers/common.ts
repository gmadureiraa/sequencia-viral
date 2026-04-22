/**
 * Helpers compartilhados entre os adapters de IG scraper.
 */

export function inferNiche(bio: string | null): string | null {
  if (!bio) return null;
  const lower = bio.toLowerCase();

  const nicheKeywords: Record<string, string[]> = {
    "crypto / web3": [
      "crypto",
      "web3",
      "blockchain",
      "defi",
      "nft",
      "bitcoin",
      "ethereum",
      "solana",
    ],
    "finance / investing": [
      "finance",
      "invest",
      "trading",
      "stocks",
      "fintech",
      "wealth",
    ],
    "marketing / growth": [
      "marketing",
      "growth",
      "ads",
      "brand",
      "agency",
      "seo",
      "content",
    ],
    "tech / engineering": [
      "developer",
      "engineer",
      "coding",
      "software",
      "programming",
      "devops",
      "fullstack",
    ],
    "design / creative": [
      "design",
      "ux",
      "ui",
      "creative",
      "artist",
      "illustrat",
    ],
    "ai / machine learning": [
      "ai",
      "artificial intelligence",
      "machine learning",
      "llm",
      "gpt",
      "deep learning",
    ],
    education: ["teacher", "professor", "education", "learn", "mentor", "coach"],
    "health / fitness": [
      "fitness",
      "health",
      "wellness",
      "gym",
      "nutrition",
      "yoga",
    ],
    gaming: ["gaming", "gamer", "esports", "twitch", "streamer"],
    "music / entertainment": [
      "music",
      "musician",
      "artist",
      "producer",
      "dj",
      "entertainment",
    ],
  };

  for (const [niche, keywords] of Object.entries(nicheKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return niche;
    }
  }
  return null;
}

export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(
      /^https?:\/\/(www\.)?(twitter\.com|x\.com|instagram\.com)\//i,
      ""
    )
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
}
