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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Content Security Policy — protects against XSS from AI-generated content
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://generativelanguage.googleapis.com https://google.serper.dev https://api.apify.com https://*.vercel-insights.com https://*.vercel-analytics.com https://vercel.live",
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
