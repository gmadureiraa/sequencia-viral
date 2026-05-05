import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_EMAILS } from "./lib/admin-emails";

const ALLOWED_ORIGINS = new Set([
  "https://viral.kaleidos.com.br",
  "https://www.viral.kaleidos.com.br",
  "https://sequencia-viral.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]);

/**
 * Decodifica payload JWT sem validar assinatura — pra gate de UX no edge,
 * onde validação completa via Supabase fetch adicionaria latência em todo
 * request. Backend continua validando JWT real em cada /api/* via
 * lib/server/auth.ts::requireAuthenticatedUser (faz `auth.getUser(token)`
 * server-side, rejeita revogados/banidos).
 *
 * Tradeoff explícito: edge gate é defesa em profundidade (não principal),
 * fácil de bypassar editando JWT, mas backend pega tudo. Vale pelo zero
 * latência adicional + UX (página `/app/admin/*` nunca renderiza pra
 * não-admin nem mesmo brevemente).
 */
export function decodeJwtEmail(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64 pra atob
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const payload = JSON.parse(json) as { email?: string; exp?: number };
    if (typeof payload.email !== "string") return null;
    // Token expirado → trata como inválido
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.email.toLowerCase().trim();
  } catch {
    return null;
  }
}

/**
 * Lê cookie de sessão Supabase. Formatos suportados:
 *  - `sb-<projectRef>-auth-token` único (sessão pequena)
 *  - `sb-<projectRef>-auth-token.0`, `.1`, `.2`... (chunked quando JWT
 *    + refresh excedem o tamanho do cookie ~4KB). Concatenamos os chunks
 *    em ordem antes do parse.
 *
 * Valor (já concatenado) é JSON com access_token, ou string com prefixo
 * `base64-` que envolve o JSON.
 *
 * Implementação espelha @supabase/ssr/dist/main/utils.js::combineChunks
 * pra paridade com o storage do Supabase JS no cliente.
 */
export function getSupabaseSessionEmail(request: NextRequest): string | null {
  // 1. Agrupa cookies sb-*-auth-token (e seus chunks .0/.1/...) por base name.
  // Match: cookie.name começa com "sb-" e contém "-auth-token", com ou sem
  // sufixo ".<digit>". Captura: `base` = parte antes de qualquer sufixo `.N`.
  const chunkPattern = /^(sb-.+-auth-token)(?:\.(\d+))?$/;
  const groups = new Map<string, Array<{ index: number; value: string }>>();

  for (const cookie of request.cookies.getAll()) {
    const m = cookie.name.match(chunkPattern);
    if (!m) continue;
    const base = m[1];
    const index = m[2] !== undefined ? Number(m[2]) : -1; // -1 = não-chunked (cookie único)
    const arr = groups.get(base) ?? [];
    arr.push({ index, value: cookie.value });
    groups.set(base, arr);
  }

  // 2. Pra cada base name, monta o valor completo (concatenando chunks em
  // ordem), parseia e tenta extrair o access_token.
  for (const chunks of groups.values()) {
    let combined: string;
    if (chunks.length === 1 && chunks[0].index === -1) {
      // Cookie único, sem chunking
      combined = chunks[0].value;
    } else {
      // Ordena por index e concatena. -1 (cookie único) tem prioridade — se
      // existir, usa só ele em vez dos chunks (defesa contra estado misto).
      const single = chunks.find((c) => c.index === -1);
      if (single) {
        combined = single.value;
      } else {
        combined = chunks
          .filter((c) => c.index >= 0)
          .sort((a, b) => a.index - b.index)
          .map((c) => c.value)
          .join("");
      }
    }

    try {
      let raw = combined;
      if (raw.startsWith("base64-")) {
        raw = atob(raw.slice("base64-".length));
      }
      const parsed = JSON.parse(raw);
      const accessToken: string | undefined = Array.isArray(parsed)
        ? parsed[0]
        : parsed?.access_token;
      if (!accessToken) continue;
      const email = decodeJwtEmail(accessToken);
      if (email) return email;
    } catch {
      // Cookie corrompido, JSON inválido após concat, ou base64 ruim — pula.
    }
  }
  return null;
}

const ADMIN_EMAILS_LOWER = new Set(ADMIN_EMAILS.map((e) => e.toLowerCase()));

/**
 * Next 16 renomeou `middleware.ts` para `proxy.ts` (nome atual da
 * convenção de arquivo). API é a mesma — exportar uma função `proxy`
 * (ou default) que recebe `NextRequest` e devolve `NextResponse`. O
 * matcher continua igual via `export const config = { matcher: [...] }`.
 *
 * Ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Edge gate: /app/admin/* só pra admin. Validação real (JWT + revogação)
  // continua em cada API route via requireAdmin — esse middleware só corta
  // página antes de renderizar pra não-admin (zero flash + reduz superfície
  // de informação vazada).
  //
  // /app/admin/login etc. não existem hoje, mas se virarem público no
  // futuro adicionar exceção aqui.
  if (pathname.startsWith("/app/admin")) {
    const email = getSupabaseSessionEmail(request);
    if (!email || !ADMIN_EMAILS_LOWER.has(email)) {
      // Sem cookie: manda pro login. Com cookie mas não admin: manda /app.
      const target = email ? "/app" : "/app/login";
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Audit P1: handler dedicado pra OPTIONS preflight. Antes,
  // preflight era roteado pra rota real e podia falhar antes de
  // setar CORS headers, quebrando requisições cross-origin do browser.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Device-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Block /api/debug in production
  if (pathname === "/api/debug" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const response = NextResponse.next();

  // Security headers for all responses
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  // HSTS — força HTTPS por 2 anos + subdomínios. preload permite Google
  // Chrome HSTS preload list (precisa submit manual em hstspreload.org
  // depois de validar que todos os subdomínios suportam HTTPS).
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Content Security Policy — protects against XSS from AI-generated content.
  // Em DEV: React precisa de 'unsafe-eval' pra hot-reload + stack traces
  // (sem isso a página trava em loop infinito). Prod mantém policy estrita.
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://www.googletagmanager.com https://www.google-analytics.com"
    : "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live https://www.googletagmanager.com https://www.google-analytics.com";
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://generativelanguage.googleapis.com https://google.serper.dev https://api.apify.com https://*.vercel-insights.com https://*.vercel-analytics.com https://vercel.live https://www.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://us.i.posthog.com https://us-assets.i.posthog.com",
      "frame-src 'self' https://js.stripe.com https://vercel.live",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Prevent search engines from indexing app and landing test routes
  if (pathname.startsWith("/app") || /^\/landing\/v\d+/.test(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // CORS for API routes
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    if (ALLOWED_ORIGINS.has(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
