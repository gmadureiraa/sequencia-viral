/**
 * Extracts main content from a URL for AI processing.
 * Uses a simple fetch + regex approach (no heavy HTML parser dependency).
 */
export async function extractContentFromUrl(url: string): Promise<string> {
  try {
    const parsedUrl = assertSafeUrl(url);
    await assertResolvedIpIsSafe(parsedUrl.hostname);
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Sequência Viral/1.0; +https://viral.kaleidos.com.br)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";

    // Extract meta description
    const metaDescMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i
    );
    const metaDesc = metaDescMatch ? decodeEntities(metaDescMatch[1]) : "";

    // Extract og:image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([\s\S]*?)["']/i
    );
    const ogImage = ogImageMatch ? ogImageMatch[1] : "";

    // Extract og:title
    const ogTitleMatch = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([\s\S]*?)["']/i
    );
    const ogTitle = ogTitleMatch ? decodeEntities(ogTitleMatch[1]) : "";

    // Remove script, style, nav, footer, header tags
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "");

    // Try to find article or main content
    const articleMatch = cleaned.match(
      /<article[\s\S]*?>([\s\S]*?)<\/article>/i
    );
    const mainMatch = cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);

    const contentHtml = articleMatch?.[1] || mainMatch?.[1] || cleaned;

    // Strip HTML tags, decode entities, clean whitespace
    const text = decodeEntities(contentHtml.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();

    // Limit to ~3000 chars to avoid overly long prompts
    const truncated = text.length > 3000 ? text.slice(0, 3000) + "..." : text;

    const parts = [
      `URL: ${parsedUrl.toString()}`,
      title && `Title: ${title}`,
      ogTitle && ogTitle !== title && `OG Title: ${ogTitle}`,
      metaDesc && `Description: ${metaDesc}`,
      ogImage && `Image: ${ogImage}`,
      "",
      `Content:\n${truncated}`,
    ].filter(Boolean);

    return parts.join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract content from URL: ${message}`);
  }
}

function assertSafeUrl(rawUrl: string) {
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

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

async function assertResolvedIpIsSafe(hostname: string) {
  const dns = await import("node:dns/promises");
  try {
    const ips = await dns.resolve4(hostname);
    for (const ip of ips) {
      if (isPrivateIpv4(ip)) {
        throw new Error(`DNS rebinding detected: ${hostname} resolves to private IP ${ip}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("DNS rebinding")) throw err;
  }
  try {
    const ipv6s = await dns.resolve6(hostname);
    for (const ip of ipv6s) {
      if (isPrivateIpv6(ip)) {
        throw new Error(`DNS rebinding detected: ${hostname} resolves to private IPv6 ${ip}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("DNS rebinding")) throw err;
  }
}

function isPrivateIpv6(ip: string) {
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

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}
