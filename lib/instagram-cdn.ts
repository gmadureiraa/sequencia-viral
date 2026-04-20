/**
 * URLs do CDN do Instagram (cdninstagram.com, fbcdn.net) vêm com tokens
 * de autorização (`oh=`, `oe=`, `_nc_sid=`) que expiram em ~1h e bloqueiam
 * hotlinking de origem diferente. Usar essas URLs como imageUrl persistente
 * resulta em imagens quebradas no dia seguinte.
 *
 * Sempre que o produto depender dessas URLs (avatar, foto de post), usar
 * esse helper pra detectar e fazer fallback (upload manual ou scrape
 * alternativo).
 */
const INSTAGRAM_CDN_HOSTS = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
];

export function isInstagramCdnUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return INSTAGRAM_CDN_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

/**
 * Filtra uma URL: se for CDN do Instagram, retorna null (o caller decide
 * o fallback). Caso contrário, retorna a URL original.
 */
export function scrubInstagramCdn(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  if (isInstagramCdnUrl(url)) return null;
  return url;
}
