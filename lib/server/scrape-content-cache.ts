/**
 * Cache de extração de conteúdo (Instagram, URLs, YouTube) com TTL.
 *
 * Por que: scrape do Apify pra um post IG demora 15-25s (cold start +
 * download de imagens + Gemini Vision OCR de cada slide). Sem cache, o
 * mesmo IG ref re-scraped infinitas vezes — o user testa o briefing
 * algumas vezes pra ajustar tom/template e cada teste paga 20s+ de
 * scrape.
 *
 * Backend:
 *   - Upstash Redis quando UPSTASH_REDIS_REST_* setadas
 *   - In-memory Map como fallback (dev local; em prod pega 1 cold-start
 *     por cada λ instance, mesmo assim 50%+ hit rate)
 *
 * Não cacheia conteúdo de fontes que dependem de auth do user (NER de
 * doc privado, etc.). Aqui só fontes públicas: IG posts, URLs HTTP,
 * YouTube com transcript público.
 */

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

type Cached = {
  content: string;
  cachedAt: number;
};

const memoryStore = new Map<string, { v: Cached; expiresAt: number }>();
const MAX_MEMORY_ENTRIES = 500;

function evictMemoryIfNeeded() {
  if (memoryStore.size <= MAX_MEMORY_ENTRIES) return;
  // Remove os 50 mais antigos. Map iteração é insertion order.
  let removed = 0;
  for (const key of memoryStore.keys()) {
    if (removed >= 50) break;
    memoryStore.delete(key);
    removed++;
  }
}

let cachedRedis: Redis | null = null;
let redisInitTried = false;

function getRedis(): Redis | null {
  if (redisInitTried) return cachedRedis;
  redisInitTried = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    cachedRedis = new Redis({ url, token });
    return cachedRedis;
  } catch (err) {
    console.warn("[scrape-cache] Upstash init falhou, fallback in-memory:", err);
    return null;
  }
}

function makeKey(prefix: string, raw: string): string {
  const h = createHash("sha256").update(raw).digest("hex").slice(0, 24);
  return `sv:scrape:${prefix}:${h}`;
}

export interface ScrapeCacheOptions {
  /** Identifier do tipo de fonte (ex: "ig", "url", "yt"). */
  prefix: string;
  /** Chave bruta — URL completa. Hashed pra evitar key gigante. */
  rawKey: string;
  /** TTL em segundos. Default 24h. */
  ttlSec?: number;
}

/**
 * Tenta ler do cache. Retorna null em miss ou TTL expirado.
 */
export async function readScrapeCache(
  opts: ScrapeCacheOptions,
): Promise<string | null> {
  const key = makeKey(opts.prefix, opts.rawKey);

  // 1) Memory hit primeiro (mais rápido — 0ms)
  const mem = memoryStore.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.v.content;
  }
  if (mem) memoryStore.delete(key); // expirou

  // 2) Redis hit
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<Cached>(key);
      if (raw && typeof raw === "object" && typeof raw.content === "string") {
        // Promove pra memory pra próximas reads
        memoryStore.set(key, {
          v: raw,
          expiresAt: Date.now() + (opts.ttlSec ?? 86_400) * 1000,
        });
        evictMemoryIfNeeded();
        return raw.content;
      }
    } catch (err) {
      console.warn(
        "[scrape-cache] Redis read falhou:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return null;
}

/**
 * Grava no cache. Best-effort: nunca lança. Falha do cache não pode
 * derrubar o request.
 */
export async function writeScrapeCache(
  opts: ScrapeCacheOptions,
  content: string,
): Promise<void> {
  const key = makeKey(opts.prefix, opts.rawKey);
  const ttlSec = opts.ttlSec ?? 86_400; // 24h
  const value: Cached = { content, cachedAt: Date.now() };

  // Memory primeiro (sempre)
  memoryStore.set(key, { v: value, expiresAt: Date.now() + ttlSec * 1000 });
  evictMemoryIfNeeded();

  // Redis async (não bloqueia)
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSec });
    } catch (err) {
      console.warn(
        "[scrape-cache] Redis write falhou:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

/**
 * Wrapper: tenta cache, executa fetcher em miss, persiste resultado.
 * Helper preferido em vez de read+write manual.
 */
export async function withScrapeCache<T extends string>(
  opts: ScrapeCacheOptions,
  fetcher: () => Promise<T>,
): Promise<{ content: T; fromCache: boolean }> {
  const cached = await readScrapeCache(opts);
  if (cached !== null) {
    return { content: cached as T, fromCache: true };
  }
  const fresh = await fetcher();
  // Só guarda se vier conteúdo razoável (evita cachear erro/empty)
  if (fresh && typeof fresh === "string" && fresh.length > 50) {
    await writeScrapeCache(opts, fresh);
  }
  return { content: fresh, fromCache: false };
}
