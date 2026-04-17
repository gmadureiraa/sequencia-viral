import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/server/rate-limit";

describe("rate-limit", () => {
  it("permite até o limite e bloqueia após exceder", () => {
    const key = `unit-${Date.now()}`;
    const first = checkRateLimit({ key, limit: 2, windowMs: 30_000 });
    const second = checkRateLimit({ key, limit: 2, windowMs: 30_000 });
    const third = checkRateLimit({ key, limit: 2, windowMs: 30_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });
});
