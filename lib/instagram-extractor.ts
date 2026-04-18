/**
 * Extractor de post/reel/carrossel do Instagram.
 *
 * Fluxo:
 *   1. Apify (`apify~instagram-scraper`) → caption + metadados (likes, hashtags, owner).
 *   2. Supadata (`/v1/transcript`) → ASR do áudio do reel/vídeo.
 *   3. Compõe um contexto rico combinando caption + transcript + metadados.
 *
 * Se o post é puramente imagem sem caption, retorna erro instruindo o usuário
 * a colar a ideia manualmente.
 */

import { fetchSupadataTranscript, isSupadataConfigured } from "./supadata";

const APIFY_BASE = "https://api.apify.com/v2";
const APIFY_TIMEOUT_SECS = 45;
// Actor ID: apify~instagram-scraper (público, gratuito com limites)
const ACTOR_ID = "apify~instagram-scraper";

type InstagramKind = "post" | "reel" | "profile";

function parseInstagramUrl(url: string): { kind: InstagramKind; id: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("instagram.com")) return null;
    // /p/<shortcode>/, /reel/<shortcode>/, /reels/<shortcode>/
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const kind: InstagramKind = m[1] === "p" ? "post" : "reel";
      return { kind, id: m[2] };
    }
    // /username/
    const profileMatch = u.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (profileMatch) {
      return { kind: "profile", id: profileMatch[1] };
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractInstagramContent(url: string): Promise<string> {
  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    throw new Error(
      "APIFY_API_KEY não configurado no servidor. Contate o suporte."
    );
  }

  const parsed = parseInstagramUrl(url);
  if (!parsed) {
    throw new Error(
      "URL do Instagram inválida. Use um link de post (/p/...) ou reel (/reel/...)."
    );
  }

  // Apify actor input — usa `directUrls` pra ir direto no shortcode.
  const runInput = {
    directUrls: [url],
    resultsType: "details",
    resultsLimit: 1,
    addParentData: false,
  };

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apifyKey}&timeout=${APIFY_TIMEOUT_SECS}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runInput),
      signal: AbortSignal.timeout((APIFY_TIMEOUT_SECS + 10) * 1000),
    }
  );

  if (!runRes.ok) {
    const errBody = await runRes.text().catch(() => "");
    throw new Error(
      `Apify ${runRes.status}: ${errBody.slice(0, 200) || "falha no scraping"}`
    );
  }

  const data = (await runRes.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      "Instagram não retornou nada. Post pode ser privado, deletado ou a URL está errada."
    );
  }

  const first = data[0] as {
    caption?: string;
    text?: string;
    ownerUsername?: string;
    videoViewCount?: number;
    videoPlayCount?: number;
    videoDuration?: number;
    likesCount?: number;
    commentsCount?: number;
    type?: string;
    hashtags?: string[];
    mentions?: string[];
    images?: Array<{ displayUrl?: string }>;
    childPosts?: Array<{ caption?: string; displayUrl?: string }>;
    videoUrl?: string;
  };

  const caption = (first.caption || first.text || "").trim();
  const isVideo =
    first.type === "Video" ||
    parsed.kind === "reel" ||
    Boolean(first.videoUrl) ||
    typeof first.videoDuration === "number";

  // Se não tem caption E é vídeo → tenta Supadata (áudio → texto).
  let supadataTranscript: string | null = null;
  if (isVideo && isSupadataConfigured()) {
    try {
      const sup = await fetchSupadataTranscript(url, { mode: "auto" });
      supadataTranscript = sup?.content || null;
    } catch (err) {
      console.warn(
        "[ig] Supadata fallback falhou:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  if (!caption && !supadataTranscript) {
    throw new Error(
      "Post sem legenda e sem áudio transcrevível. Cole a ideia no modo 'Minha ideia'."
    );
  }

  // Monta um bloco de contexto rico que vai direto no prompt do Claude
  const lines: string[] = [];
  lines.push(`Fonte: Instagram ${parsed.kind} (@${first.ownerUsername || "desconhecido"})`);
  if (first.type) lines.push(`Tipo: ${first.type}`);
  if (first.likesCount) lines.push(`Curtidas: ${first.likesCount}`);
  if (first.commentsCount) lines.push(`Comentários: ${first.commentsCount}`);
  const views = first.videoViewCount ?? first.videoPlayCount;
  if (views) lines.push(`Views: ${views}`);
  if (first.videoDuration) lines.push(`Duração: ${Math.round(first.videoDuration)}s`);
  if (first.hashtags && first.hashtags.length > 0) {
    lines.push(`Hashtags: ${first.hashtags.slice(0, 10).join(", ")}`);
  }

  if (caption) {
    lines.push("");
    lines.push("Legenda original:");
    lines.push(caption);
  }

  if (supadataTranscript) {
    lines.push("");
    lines.push("Transcrição do áudio:");
    lines.push(
      supadataTranscript.length > 4000
        ? supadataTranscript.slice(0, 4000) + "…"
        : supadataTranscript
    );
  }

  // Se for carrossel, adiciona as legendas dos child posts
  if (first.childPosts && first.childPosts.length > 0) {
    const childCaptions = first.childPosts
      .map((child, i) => (child.caption ? `${i + 1}. ${child.caption}` : null))
      .filter((x): x is string => Boolean(x));
    if (childCaptions.length > 0) {
      lines.push("");
      lines.push("Slides do carrossel:");
      lines.push(...childCaptions);
    }
  }

  return lines.join("\n");
}
