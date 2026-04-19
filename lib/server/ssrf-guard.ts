/**
 * SSRF guards reusáveis — evita que fetches server-side sejam usados pra
 * tocar IPs privados da rede interna (AWS/GCP metadata, cluster services,
 * etc). Toda rota que faz fetch de URL fornecida pelo cliente deve passar
 * por `assertSafeUrl(raw)` + `await assertResolvedIpIsSafe(hostname)`.
 *
 * Pattern extraído de lib/url-extractor.ts (que já rodava sozinho) e
 * compartilhado agora com /api/img-proxy e /api/brand-aesthetic.
 */

export function assertSafeUrl(rawUrl: string): URL {
  const parsedUrl = new URL(rawUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed");
  }

  let hostname = parsedUrl.hostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Localhost URLs are not allowed");
  }

  if (
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    /^fe80:/i.test(hostname) ||
    /^fc00:/i.test(hostname) ||
    /^fd00:/i.test(hostname)
  ) {
    throw new Error("Non-public URLs are not allowed");
  }

  const ipv4Match = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (ipv4Match && isPrivateIpv4(hostname)) {
    throw new Error("Private network URLs are not allowed");
  }

  return parsedUrl;
}

export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc00:") || lower.startsWith("fd00:")) return true;
  if (lower === "::") return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mapped)) {
      return isPrivateIpv4(mapped);
    }
  }
  return false;
}

/**
 * Resolve DNS e rejeita se qualquer A/AAAA record aponta pra IP privado.
 * Evita DNS rebinding (`evil.com` → 169.254.169.254) e vazamento pra rede
 * interna quando o hostname passa no check inicial.
 */
export async function assertResolvedIpIsSafe(hostname: string): Promise<void> {
  const dns = await import("node:dns/promises");
  try {
    const ips = await dns.resolve4(hostname);
    for (const ip of ips) {
      if (isPrivateIpv4(ip)) {
        throw new Error(
          `DNS rebinding detected: ${hostname} resolves to private IP ${ip}`
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("DNS rebinding")) throw err;
  }
  try {
    const ipv6s = await dns.resolve6(hostname);
    for (const ip of ipv6s) {
      if (isPrivateIpv6(ip)) {
        throw new Error(
          `DNS rebinding detected: ${hostname} resolves to private IPv6 ${ip}`
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("DNS rebinding")) throw err;
  }
}

/**
 * Conveniência: valida e resolve num só go. Throw em qualquer falha.
 */
export async function assertSafeAndResolve(rawUrl: string): Promise<URL> {
  const parsed = assertSafeUrl(rawUrl);
  await assertResolvedIpIsSafe(parsed.hostname);
  return parsed;
}
