import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://viral.kaleidos.com.br",
  "https://www.viral.kaleidos.com.br",
  "https://sequencia-viral.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]);

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
