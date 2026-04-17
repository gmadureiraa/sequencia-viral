/**
 * In-memory rate limiter. Works per-instance in serverless — not shared across
 * cold starts. For production at scale, migrate to Upstash Redis or Vercel KV.
 * Good enough for MVP / low-medium traffic.
 */

type LimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, LimitEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

type LimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function checkRateLimit({ key, limit, windowMs }: LimitOptions) {
  cleanupExpired();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    store.set(key, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, limit - fresh.count),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  store.set(key, existing);

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec,
  };
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
