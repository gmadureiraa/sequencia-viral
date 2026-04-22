/**
 * Proxy de imagens same-origin com CORS permissivo.
 *
 * html-to-image / toPng falha (canvas tainted) quando tenta capturar <img>
 * de domínios sem CORS. Este endpoint busca a imagem server-side e devolve
 * com `Access-Control-Allow-Origin: *`, permitindo o canvas exportar.
 *
 * Hardening pós security audit:
 *  - Exige usuário autenticado (era rota aberta → qualquer um usava como
 *    web proxy grátis).
 *  - Valida URL com SSRF guard (assertSafeUrl + assertResolvedIpIsSafe)
 *    ANTES do fetch, fechando a janela de DNS rebinding.
 *  - Limita redirects a 3 (antes era "follow" ilimitado).
 *  - Valida IP novamente após cada redirect.
 *
 * Uso no cliente (com header Authorization vindo do client-side do Supabase):
 *   <img src={`/api/img-proxy?url=${encodeURIComponent(remoteUrl)}`} />
 *   (o cliente tem sessão via cookies do Supabase — quando a sessão cair,
 *    a imagem simplesmente não carrega e o fallback do html-to-image roda).
 */

import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  assertSafeUrl,
  assertResolvedIpIsSafe,
} from "@/lib/server/ssrf-guard";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPE = /^image\//i;

/**
 * Hosts publicos permitidos sem auth — sao CDNs de redes sociais/Apify
 * cujo conteudo ja e publico de origem. Browser <img src> nao consegue
 * mandar Bearer token, entao essa whitelist permite que avatars/posts do
 * onboarding renderizem diretamente. Qualquer URL fora dessa lista ainda
 * exige auth.
 */
const PUBLIC_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "twimg.com",
  "pbs.twimg.com",
  "licdn.com",
  "media.licdn.com",
  "googleusercontent.com",
  "ytimg.com",
  "apify.com",
  "apifyusercontent.com",
];

function hostAllowedPublic(host: string): boolean {
  const h = host.toLowerCase();
  return PUBLIC_HOST_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith(`.${suffix}`)
  );
}

export const runtime = "nodejs";

async function fetchWithSafeRedirects(
  initialUrl: URL,
  depth = 0
): Promise<Response> {
  if (depth > MAX_REDIRECTS) {
    throw new Error("too many redirects");
  }
  const response = await fetch(initialUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Sequência Viral/1.0 img-proxy)",
      Accept: "image/*,*/*;q=0.5",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return response;
    // Resolve relativo, valida antes de seguir.
    const nextUrl = new URL(location, initialUrl);
    assertSafeUrl(nextUrl.toString());
    await assertResolvedIpIsSafe(nextUrl.hostname);
    return fetchWithSafeRedirects(nextUrl, depth + 1);
  }

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return new Response("missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = assertSafeUrl(raw);
    await assertResolvedIpIsSafe(target.hostname);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid url";
    return new Response(msg, { status: 400 });
  }

  // Publico apenas para CDNs conhecidas (imagens ja publicas de origem).
  // URLs fora da whitelist ainda exigem Bearer token.
  if (!hostAllowedPublic(target.hostname)) {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
  }

  let upstream: Response;
  try {
    upstream = await fetchWithSafeRedirects(target);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upstream error";
    return new Response(msg.slice(0, 200), { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, {
      status: upstream.status,
    });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPE.test(contentType)) {
    return new Response("not an image", { status: 400 });
  }

  const lengthHeader = upstream.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BYTES) {
    return new Response("image too large", { status: 413 });
  }

  const arrayBuffer = await upstream.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return new Response("image too large", { status: 413 });
  }

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
