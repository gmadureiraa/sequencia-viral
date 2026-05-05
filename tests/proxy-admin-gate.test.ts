/**
 * Testes do middleware Edge gate de /app/admin/*.
 *
 * Cobre:
 *  - decodeJwtEmail: JWT válido com email, expirado, malformado, sem email
 *  - getSupabaseSessionEmail: cookie array, object, base64-encoded, ausente
 *
 * NÃO testa o handler `proxy()` end-to-end — isso é melhor com Playwright
 * E2E (ainda não temos infra). Backend valida JWT real em cada API call,
 * o middleware é defesa em profundidade pra UX (sem flash).
 */

import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { decodeJwtEmail, getSupabaseSessionEmail } from "../proxy";

// ──────────────────────────────────────────────────────────────
// Helpers pra forjar JWT (sem assinatura válida — só o payload)
// ──────────────────────────────────────────────────────────────

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = base64UrlEncode("fake-signature");
  return `${header}.${body}.${sig}`;
}

// ──────────────────────────────────────────────────────────────
// Mock NextRequest com cookies
// ──────────────────────────────────────────────────────────────

function mockRequestWithCookies(
  cookies: Array<{ name: string; value: string }>
): NextRequest {
  return {
    cookies: {
      getAll: () => cookies,
    },
  } as unknown as NextRequest;
}

// ──────────────────────────────────────────────────────────────
// decodeJwtEmail
// ──────────────────────────────────────────────────────────────

describe("decodeJwtEmail", () => {
  it("extrai email lowercased de JWT válido não expirado", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const jwt = makeJwt({ email: "Admin@Example.com", exp: future });
    expect(decodeJwtEmail(jwt)).toBe("admin@example.com");
  });

  it("rejeita JWT expirado", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const jwt = makeJwt({ email: "user@x.com", exp: past });
    expect(decodeJwtEmail(jwt)).toBeNull();
  });

  it("aceita JWT sem exp (campo opcional)", () => {
    const jwt = makeJwt({ email: "noexp@x.com" });
    expect(decodeJwtEmail(jwt)).toBe("noexp@x.com");
  });

  it("rejeita JWT sem email no payload", () => {
    const jwt = makeJwt({ sub: "user-123" });
    expect(decodeJwtEmail(jwt)).toBeNull();
  });

  it("rejeita string que não é JWT (sem 3 partes)", () => {
    expect(decodeJwtEmail("not.a.jwt.token.too.many")).toBeNull();
    expect(decodeJwtEmail("only-one-part")).toBeNull();
    expect(decodeJwtEmail("")).toBeNull();
  });

  it("rejeita JWT com payload base64 corrompido", () => {
    expect(decodeJwtEmail("aaa.@@@notbase64.bbb")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// getSupabaseSessionEmail
// ──────────────────────────────────────────────────────────────

describe("getSupabaseSessionEmail", () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  const validJwt = makeJwt({ email: "session@test.com", exp: future });

  it("retorna null quando não há cookie sb-*-auth-token", () => {
    const req = mockRequestWithCookies([{ name: "other-cookie", value: "x" }]);
    expect(getSupabaseSessionEmail(req)).toBeNull();
  });

  it("retorna null quando não há cookies", () => {
    const req = mockRequestWithCookies([]);
    expect(getSupabaseSessionEmail(req)).toBeNull();
  });

  it("extrai email de cookie array format [token, refresh]", () => {
    // Supabase recente: array de 4 items, primeiro é access_token
    const value = JSON.stringify([validJwt, "refresh-token", null, null]);
    const req = mockRequestWithCookies([
      { name: "sb-abcdef-auth-token", value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("extrai email de cookie object format { access_token }", () => {
    // Supabase legado: objeto com access_token
    const value = JSON.stringify({
      access_token: validJwt,
      refresh_token: "refresh",
    });
    const req = mockRequestWithCookies([
      { name: "sb-projref-auth-token", value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("decodifica cookie com prefixo base64-", () => {
    const arrayValue = JSON.stringify([validJwt, "refresh", null, null]);
    const base64Value = "base64-" + Buffer.from(arrayValue, "utf8").toString("base64");
    const req = mockRequestWithCookies([
      { name: "sb-x-auth-token", value: base64Value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("ignora cookies que não começam com sb- ou não terminam em -auth-token", () => {
    const value = JSON.stringify([validJwt]);
    const req = mockRequestWithCookies([
      { name: "supabase-something", value },
      { name: "sb-other", value },
      { name: "auth-token", value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBeNull();
  });

  it("pula cookie corrompido (JSON inválido) sem crashar", () => {
    const req = mockRequestWithCookies([
      { name: "sb-x-auth-token", value: "not-json-{{{" },
    ]);
    expect(getSupabaseSessionEmail(req)).toBeNull();
  });

  it("pula cookie com access_token expirado", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const expiredJwt = makeJwt({ email: "old@x.com", exp: past });
    const value = JSON.stringify([expiredJwt]);
    const req = mockRequestWithCookies([
      { name: "sb-x-auth-token", value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBeNull();
  });

  it("encontra cookie auth-token quando há múltiplos sb-* cookies", () => {
    const value = JSON.stringify([validJwt]);
    const req = mockRequestWithCookies([
      { name: "sb-projref-other", value: "ignored" },
      { name: "sb-projref-auth-token", value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("concatena chunks .0 .1 .2 (cookies grandes do Supabase JS)", () => {
    // Cookie chunked: o Supabase JS divide JSON grande em pedaços
    // sb-x-auth-token.0, .1, .2... Cada pedaço é uma fatia do JSON original.
    const fullValue = JSON.stringify([validJwt, "refresh-tok", null, null]);
    // Simula chunking: divide em 3 pedaços iguais
    const chunkSize = Math.ceil(fullValue.length / 3);
    const chunk0 = fullValue.slice(0, chunkSize);
    const chunk1 = fullValue.slice(chunkSize, chunkSize * 2);
    const chunk2 = fullValue.slice(chunkSize * 2);
    const req = mockRequestWithCookies([
      // ordem aleatória pra garantir que o sort por index funciona
      { name: "sb-x-auth-token.2", value: chunk2 },
      { name: "sb-x-auth-token.0", value: chunk0 },
      { name: "sb-x-auth-token.1", value: chunk1 },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("concatena chunks com prefixo base64- depois do join", () => {
    const arrayValue = JSON.stringify([validJwt, "refresh", null, null]);
    const fullValue = "base64-" + Buffer.from(arrayValue, "utf8").toString("base64");
    const half = Math.ceil(fullValue.length / 2);
    const req = mockRequestWithCookies([
      { name: "sb-x-auth-token.0", value: fullValue.slice(0, half) },
      { name: "sb-x-auth-token.1", value: fullValue.slice(half) },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("se há cookie único E chunks, prefere o cookie único (estado misto)", () => {
    const goodValue = JSON.stringify([validJwt]);
    // Chunks com email diferente — não deveriam ser usados se há single
    const otherJwt = makeJwt({ email: "should-not-use@x.com", exp: future });
    const chunkedValue = JSON.stringify([otherJwt]);
    const req = mockRequestWithCookies([
      { name: "sb-x-auth-token.0", value: chunkedValue.slice(0, 5) },
      { name: "sb-x-auth-token.1", value: chunkedValue.slice(5) },
      { name: "sb-x-auth-token", value: goodValue },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });

  it("suporta múltiplos project refs (escolhe o que tem JWT válido)", () => {
    const value = JSON.stringify([validJwt]);
    const req = mockRequestWithCookies([
      { name: "sb-other-auth-token", value: "{ corrompido}" },
      { name: "sb-mainref-auth-token", value },
    ]);
    expect(getSupabaseSessionEmail(req)).toBe("session@test.com");
  });
});
