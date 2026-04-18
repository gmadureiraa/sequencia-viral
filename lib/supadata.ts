/**
 * Cliente Supadata — transcrição universal de vídeo (YouTube, Instagram, TikTok, X).
 *
 * Quando o video não tem legenda manual e o innertube/apify bloqueia, Supadata
 * extrai o texto via ASR. Requer env `SUPADATA_API_KEY`.
 *
 * Docs: https://supadata.ai/documentation
 */

const BASE = "https://api.supadata.ai/v1";

export type SupadataTranscriptResult = {
  content: string;
  lang: string;
  availableLangs: string[];
};

export function isSupadataConfigured(): boolean {
  return Boolean(process.env.SUPADATA_API_KEY);
}

/**
 * Busca transcript de qualquer URL suportada (YouTube/Instagram/TikTok/X/arquivo).
 * Retorna `null` quando a API está desconfigurada — nunca lança por conta disso.
 * Lança `Error` para 4xx/5xx reais (rate limit, video not found, etc.).
 */
export async function fetchSupadataTranscript(
  url: string,
  options: { lang?: string; timeoutMs?: number; mode?: "auto" | "native" | "generate" } = {}
): Promise<SupadataTranscriptResult | null> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) return null;

  const qs = new URLSearchParams({
    url,
    text: "true",
    mode: options.mode ?? "auto",
  });
  if (options.lang) qs.set("lang", options.lang);

  const totalTimeout = options.timeoutMs ?? 55_000;
  const res = await fetch(`${BASE}/transcript?${qs.toString()}`, {
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 404) {
    throw new Error("Supadata: vídeo não encontrado.");
  }
  if (res.status === 429) {
    throw new Error("Supadata: rate limit atingido.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supadata HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: string | { text?: string }[];
    lang?: string;
    availableLangs?: string[];
    jobId?: string;
  };

  if (data.jobId) {
    return await pollJob(data.jobId, totalTimeout);
  }

  const content =
    typeof data.content === "string"
      ? data.content
      : Array.isArray(data.content)
        ? data.content.map((c) => c?.text || "").join(" ")
        : "";
  if (!content.trim()) return null;

  return {
    content: content.trim(),
    lang: data.lang || "",
    availableLangs: data.availableLangs || [],
  };
}

const PENDING_STATUSES = new Set([
  "queued",
  "processing",
  "active",
  "waiting",
  "pending",
]);

async function pollJob(
  jobId: string,
  overallTimeoutMs: number
): Promise<SupadataTranscriptResult | null> {
  const apiKey = process.env.SUPADATA_API_KEY!;
  const deadline = Date.now() + overallTimeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    const wait = Math.min(2000 * attempt, 6000);
    await new Promise((r) => setTimeout(r, wait));

    const res = await fetch(`${BASE}/transcript/${jobId}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) continue;
    const data = (await res.json()) as {
      status?: string;
      content?: string | { text?: string }[];
      lang?: string;
      availableLangs?: string[];
      error?: string;
    };
    if (data.status && PENDING_STATUSES.has(data.status)) continue;
    if (data.status === "failed" || data.error) {
      throw new Error(`Supadata job falhou: ${data.error || data.status}`);
    }
    const content =
      typeof data.content === "string"
        ? data.content
        : Array.isArray(data.content)
          ? data.content.map((c) => c?.text || "").join(" ")
          : "";
    if (!content) return null;
    return {
      content: content.trim(),
      lang: data.lang || "",
      availableLangs: data.availableLangs || [],
    };
  }
  throw new Error("Supadata: timeout no polling do job");
}
