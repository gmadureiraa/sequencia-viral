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
 * @deprecated INSEGURO — não verifica assinatura. Use
 * `verifyJwtAndExtractEmail` em qualquer caminho que tome decisão de
 * autorização. Mantido apenas para diagnóstico em
 * `/api/zernio/debug-auth` (onde o objetivo é justamente inspecionar o
 * payload bruto) e para testes legados.
 *
 * Backend continua validando JWT real em cada /api/* via
 * `lib/server/auth.ts::requireAuthenticatedUser` (chama
 * `auth.getUser(token)` server-side, que rejeita revogados/banidos).
 *
 * Decodifica payload JWT sem validar assinatura. Atacante consegue
 * forjar claims (email, exp) trivialmente — qualquer gate baseado nessa
 * função é facilmente bypassável.
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
 * Converte string base64url em Uint8Array. Edge runtime tem `atob`
 * mas não `Buffer`.
 */
function base64UrlDecodeToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const TEXT_ENCODER = new TextEncoder();

/**
 * Verifica assinatura HMAC-SHA256 do JWT contra SUPABASE_JWT_SECRET e
 * extrai o email do payload. Supabase emite tokens HS256 por padrão —
 * o secret é o mesmo que aparece em Settings → API → JWT Secret.
 *
 * Usa Web Crypto API (nativo no edge runtime) — sem dependências.
 *
 * Retorna `null` em qualquer falha (secret ausente, formato inválido,
 * algoritmo inesperado, signature errada, expirado, sem email). Logging
 * é silencioso de propósito: se a verificação falhar em prod, o usuário
 * apenas não passa pelo gate — e o backend continua sendo a fonte da
 * verdade via `requireAuthenticatedUser`.
 */
export async function verifyJwtAndExtractEmail(
  token: string,
  secret: string
): Promise<string | null> {
  if (!secret) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Header: confere alg=HS256 (defesa contra "alg=none" downgrade).
    const headerJson = new TextDecoder().decode(
      base64UrlDecodeToBytes(headerB64)
    );
    const header = JSON.parse(headerJson) as { alg?: string; typ?: string };
    if (header.alg !== "HS256") return null;

    // Payload: extrai email + exp ANTES de verificar pra fail-fast em
    // tokens triviais (sem email/expirados). Mas a decisão final só
    // acontece após a verificação da signature abaixo.
    const payloadJson = new TextDecoder().decode(
      base64UrlDecodeToBytes(payloadB64)
    );
    const payload = JSON.parse(payloadJson) as {
      email?: string;
      exp?: number;
    };
    if (typeof payload.email !== "string") return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    // Verifica HMAC-SHA256 sobre `<headerB64>.<payloadB64>` usando o
    // secret raw (Supabase armazena como string UTF-8, não base64).
    const key = await crypto.subtle.importKey(
      "raw",
      TEXT_ENCODER.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = TEXT_ENCODER.encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecodeToBytes(signatureB64);
    // `crypto.subtle.verify` espera BufferSource sobre ArrayBuffer.
    // Os bytes vêm de `new Uint8Array(len)` em
    // `base64UrlDecodeToBytes`, então é seguro tratar como ArrayBuffer.
    // O cast contorna a inferência overly-broad do TS pra o type union
    // ArrayBuffer | SharedArrayBuffer.
    const sigBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength
    ) as ArrayBuffer;
    const ok = await crypto.subtle.verify("HMAC", key, sigBuffer, data);
    if (!ok) return null;

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
 *
 * **Verificação de assinatura:** quando `SUPABASE_JWT_SECRET` está
 * disponível no ambiente, valida o HMAC do token via
 * `verifyJwtAndExtractEmail`. Sem o secret (ex: edge runtime sem env
 * propagada), cai pra `decodeJwtEmail` (insecure) com warning — usado
 * apenas pra debug. Hoje essa função é exercida somente em
 * `/api/zernio/debug-auth` (admin-gated) e nos testes; o gate edge
 * `/app/admin/*` está desabilitado (ver comentário em `proxy()`).
 */
export async function getSupabaseSessionEmail(
  request: NextRequest
): Promise<string | null> {
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

      // Preferência: verificar HMAC quando `SUPABASE_JWT_SECRET` existe.
      // Atacante que forge claims (ex: troca email pra admin) não passa
      // sem o secret. Sem secret no ambiente, fallback insecure roda só
      // pra não quebrar dev local — mas com warning explícito.
      const secret = process.env.SUPABASE_JWT_SECRET;
      if (secret) {
        const email = await verifyJwtAndExtractEmail(accessToken, secret);
        if (email) return email;
        continue;
      }

      // Fallback inseguro (sem secret no ambiente).
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[proxy] SUPABASE_JWT_SECRET ausente — JWT não verificado " +
            "(claims forjáveis). Setar env var em prod pra fechar gap."
        );
      }
      const email = decodeJwtEmail(accessToken);
      if (email) return email;
    } catch {
      // Cookie corrompido, JSON inválido após concat, ou base64 ruim — pula.
    }
  }
  return null;
}

// Mantido pra compat futura — quando migrar pra @supabase/ssr e
// reativar gate edge, volta a ser usado em proxy().
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const { pathname, searchParams } = request.nextUrl;

  // A/B Tráfego pago — rewrite por utm_lp.
  // Tráfego do Meta com `?utm_lp=v2|v3` cai em /v2|/v3 mantendo URL visível
  // como `/?utm_lp=...` (não muda o que aparece pro user, só serve o
  // conteúdo certo). Mais limpo que redirect e preserva atribuição.
  // ATIVO durante teste KAL_SV_BR_LPV_ABO_v3_AB_2026-05-12.
  if (pathname === "/" && (searchParams.get("utm_lp") === "v2" || searchParams.get("utm_lp") === "v3")) {
    const target = searchParams.get("utm_lp");
    const url = request.nextUrl.clone();
    url.pathname = `/${target}`;
    return NextResponse.rewrite(url);
  }

  // Edge gate de /app/admin/* foi REMOVIDO em 05/05.
  //
  // Razão: SV usa @supabase/supabase-js direto (createClient) que persiste
  // sessão em LOCALSTORAGE (default), não em cookie. lib/supabase.ts tem
  // comentário explícito proibindo trocar storage porque invalida sessões
  // existentes de todos os users. Como localStorage não viaja pro server,
  // edge middleware nunca enxerga a sessão e redirecionava TODO mundo
  // (incluindo admin) → bug "pisca e volta pra Início".
  //
  // Defesa em profundidade preservada:
  //  1. Layout client guard (app/app/admin/layout.tsx): bloqueia render
  //     dos children até auth resolver, redireciona se não-admin.
  //  2. Backend requireAdmin (lib/server/auth.ts): valida JWT real em
  //     todas as rotas /api/zernio/* e /api/admin/* — source of truth.
  //  3. Sidebar conditional: links Planejamento/Piloto Auto só aparecem
  //     pra admin.
  //
  // Pra ter gate server-side real no futuro: migrar pra @supabase/ssr
  // (createBrowserClient + createServerClient) que persiste em cookie.
  // Refatoração não-trivial — fica como evolução.

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
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net"
    : "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net";
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://generativelanguage.googleapis.com https://google.serper.dev https://api.apify.com https://*.vercel-insights.com https://*.vercel-analytics.com https://vercel.live https://www.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://us.i.posthog.com https://us-assets.i.posthog.com https://connect.facebook.net https://*.facebook.com",
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
