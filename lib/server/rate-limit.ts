/**
 * Rate limiter — Upstash Redis quando configurado, fallback in-memory.
 *
 * Backends:
 *   - Upstash REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`):
 *     distributed sliding window, compartilhado entre cold starts. Esse
 *     é o modo de produção.
 *   - In-memory: per-instance Map. Usado em dev local quando as env vars
 *     não estão setadas. NÃO é seguro em prod com múltiplas λ — bypass
 *     trivial via requests paralelas em instâncias diferentes.
 *
 * APIs:
 *   - `rateLimit({ key, limit, windowMs })` → async, escolhe backend automaticamente.
 *   - `checkRateLimit(...)` → alias síncrono in-memory only (compatível com rotas legadas).
 *
 * Migração: rotas novas devem usar `await rateLimit(...)`. Rotas legadas
 * que não dão pra esperar (ex: handlers já dentro de transações longas)
 * podem manter `checkRateLimit`.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, LimitEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }
}

type LimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Unix epoch ms quando a janela atual reseta. */
  reset: number;
  /** Segundos restantes até liberar (Retry-After header). */
  retryAfterSec: number;
};

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
    console.warn("[rate-limit] falha inicializando Upstash Redis, usando in-memory:", err);
    return null;
  }
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(scope: string, limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${scope}:${limit}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const seconds = Math.max(1, Math.round(windowMs / 1000));
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
    analytics: false,
    prefix: "sv:rl",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

function inMemoryCheck({ key, limit, windowMs }: LimitOptions): RateLimitResult {
  cleanupExpired();
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, limit - fresh.count),
      reset: fresh.resetAt,
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  memoryStore.set(key, existing);

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetAt,
    retryAfterSec,
  };
}

/**
 * Async rate limit. Usa Upstash quando env vars setadas, in-memory caso
 * contrário. Retorna {allowed, remaining, reset, retryAfterSec}.
 */
export async function rateLimit(opts: LimitOptions): Promise<RateLimitResult> {
  const scope = opts.key.split(":")[0] || "default";
  const limiter = getLimiter(scope, opts.limit, opts.windowMs);
  if (!limiter) {
    return inMemoryCheck(opts);
  }
  try {
    const res = await limiter.limit(opts.key);
    const now = Date.now();
    const retryAfterSec = res.success
      ? 0
      : Math.max(1, Math.ceil((res.reset - now) / 1000));
    return {
      allowed: res.success,
      remaining: res.remaining,
      reset: res.reset,
      retryAfterSec,
    };
  } catch (err) {
    console.warn("[rate-limit] Upstash falhou, fallback in-memory:", err);
    return inMemoryCheck(opts);
  }
}

/**
 * Alias síncrono — só backend in-memory. Mantido para rotas legadas
 * que não querem `await`. Para rate limit distribuído, use `rateLimit`.
 */
export function checkRateLimit(opts: LimitOptions): RateLimitResult {
  return inMemoryCheck(opts);
}

export function getRequestIp(request: Request) {
  // Vercel sets this header and it cannot be spoofed by clients
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const first = vercelIp.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "unknown-ip";
}

export function getRateLimitKey(request: Request, scope: string, userId?: string | null) {
  const identity = userId || getRequestIp(request);
  return `${scope}:${identity}`;
}
