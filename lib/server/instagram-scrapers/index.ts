/**
 * Strategy com fallback automatico. Tentamos os providers em ordem e o
 * primeiro que responder OK ganha. Se um provider retornar
 * `ScraperError` nao-retryable, pulamos pro proximo sem re-tentar.
 *
 * Ordem atual:
 *  1. Apify (`apify~instagram-profile-scraper`) — primario. Robusto,
 *     caro (~$0.003 por run), pode travar em IG rate limit.
 *  2. ScrapeCreators (`api.scrapecreators.com`) — fallback. 1 credit por
 *     chamada (profile + posts = 2 credits). So entra na fila se a env
 *     `SCRAPECREATORS_API_KEY` estiver setada.
 *
 * Como adicionar um 3o provider:
 *  1. Criar `lib/server/instagram-scrapers/<nome>.ts` implementando a
 *     interface `InstagramScraper`.
 *  2. Instanciar aqui (com guard de env var, se necessario).
 */

import { ApifyInstagramScraper } from "./apify";
import { ScrapeCreatorsScraper } from "./scrapecreators";
import { InstagramScraper, ProfileData, ScraperError } from "./types";

export { ScraperError } from "./types";
export type { ProfileData, RecentPost, InstagramScraper } from "./types";

function buildProviderChain(): InstagramScraper[] {
  const chain: InstagramScraper[] = [new ApifyInstagramScraper()];

  if (process.env.SCRAPECREATORS_API_KEY) {
    chain.push(new ScrapeCreatorsScraper());
  } else {
    console.log(
      "[scraper] SCRAPECREATORS_API_KEY not set — skipping fallback adapter"
    );
  }

  return chain;
}

export async function scrapeInstagram(handle: string): Promise<ProfileData> {
  const providers = buildProviderChain();
  const errors: string[] = [];

  for (const p of providers) {
    try {
      console.log(`[scraper] trying ${p.id} for @${handle}`);
      const profile = await p.scrape(handle);
      console.log(
        `[scraper] ${p.id} succeeded (${profile.recentPosts.length} posts)`
      );
      return profile;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[scraper] ${p.id} failed: ${msg}`);
      errors.push(`${p.id}: ${msg}`);
      if (err instanceof ScraperError && !err.retryable) {
        continue;
      }
      continue;
    }
  }

  throw new Error(`All scrapers failed. ${errors.join(" | ")}`);
}
