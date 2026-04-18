/**
 * Proxy de imagens same-origin com CORS permissivo.
 *
 * html-to-image / toPng falha (canvas tainted) quando tenta capturar <img>
 * de domínios sem CORS. Este endpoint busca a imagem server-side e devolve
 * com `Access-Control-Allow-Origin: *`, permitindo o canvas exportar.
 *
 * Uso:
 *   <img src={`/api/img-proxy?url=${encodeURIComponent(remoteUrl)}`} />
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_CONTENT_TYPE = /^image\//i;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^(10|127)\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return new Response("missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    return new Response("protocol not allowed", { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return new Response("host not allowed", { status: 400 });
  }

  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Sequência Viral/1.0 img-proxy)",
      Accept: "image/*,*/*;q=0.5",
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });

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
