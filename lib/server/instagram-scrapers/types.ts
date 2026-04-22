/**
 * Shape unico que todos os adapters de scraper produzem. Mudanca de
 * provedor (Apify -> ScrapeCreators -> Meta Graph) nao afeta o consumidor.
 */

export type Platform = "twitter" | "instagram" | "linkedin" | "website";

export interface RecentPost {
  text: string;
  likes: number;
  comments: number;
  imageUrl: string | null;
  slideUrls: string[];
  isCarousel: boolean;
  permalink: string | null;
  timestamp: string | null;
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
  partial: boolean;
}

export interface InstagramScraper {
  id: string;
  scrape(handle: string): Promise<ProfileData>;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ScraperError";
  }
}
