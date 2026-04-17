/**
 * Extractor de post/reel/carrossel do Instagram.
 *
 * Instagram bloqueia scrapers simples, então usamos Apify (já temos API key)
 * com o actor `apify/instagram-scraper` que lida com autenticação, rotação de
 * proxy, etc. Em caso de falha, retornamos erro claro orientando o usuário a
 * colar a legenda manualmente no modo "Minha ideia".
 */

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
    likesCount?: number;
    commentsCount?: number;
    type?: string;
    hashtags?: string[];
    mentions?: string[];
    images?: Array<{ displayUrl?: string }>;
    childPosts?: Array<{ caption?: string; displayUrl?: string }>;
  };

  const caption = first.caption || first.text || "";
  if (!caption.trim()) {
    throw new Error(
      "Post sem legenda. Não deu pra extrair conteúdo textual — cole a ideia no modo 'Minha ideia'."
    );
  }

  // Monta um bloco de contexto rico que vai direto no prompt do Claude
  const lines: string[] = [];
  lines.push(`Fonte: Instagram ${parsed.kind} (@${first.ownerUsername || "desconhecido"})`);
  if (first.type) lines.push(`Tipo: ${first.type}`);
  if (first.likesCount) lines.push(`Curtidas: ${first.likesCount}`);
  if (first.commentsCount) lines.push(`Comentários: ${first.commentsCount}`);
  if (first.videoViewCount) lines.push(`Views: ${first.videoViewCount}`);
  if (first.hashtags && first.hashtags.length > 0) {
    lines.push(`Hashtags: ${first.hashtags.slice(0, 10).join(", ")}`);
  }
  lines.push("");
  lines.push("Legenda original:");
  lines.push(caption);

  // Se for carrossel, adiciona as legendas dos child posts
  if (first.childPosts && first.childPosts.length > 0) {
    lines.push("");
    lines.push("Slides do carrossel:");
    first.childPosts.forEach((child, i) => {
      if (child.caption) lines.push(`${i + 1}. ${child.caption}`);
    });
  }

  return lines.join("\n");
}
