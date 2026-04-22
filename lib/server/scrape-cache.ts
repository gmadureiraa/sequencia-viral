import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "./auth";

/**
 * Baixa imagens do Apify/IG CDN server-side e sobe pro bucket
 * `carousel-images` com prefix `onboarding-scrape/{userId}/{hash}.ext`.
 *
 * Por que:
 *  - IG CDN (scontent-xxx.cdninstagram.com / fbcdn.net) rejeita hotlink
 *    de browser: mesmo com img-proxy, o fetch funciona no primeiro load
 *    mas expira em ~1h (token de assinatura embutido na URL).
 *  - Pegar uma vez, subir no Supabase, e usar URL público estável resolve
 *    de vez: não depende mais de token IG, cache infinito no CDN.
 *
 * Trade-off:
 *  - +3-8s no onboarding (20 imagens × ~400kb paralelas). Fica dentro do
 *    maxDuration=60 da route.
 *  - Storage: 20 imgs × ~300kb ≈ 6MB por user. Ok pro tier free Supabase.
 */

const BUCKET = "carousel-images";
const PREFIX = "onboarding-scrape";
const MAX_IMG_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
const CONCURRENCY = 6;

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

function extFromContentType(ct: string): string {
  const t = ct.toLowerCase();
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  return "jpg";
}

async function downloadImage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
} | null> {
  try {
    // SEM User-Agent nem Referer: KAI (projeto irmao que funciona) faz fetch
    // direto sem headers. Referer instagram.com ativa hotlink-block do IG CDN.
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(
        `[scrape-cache] download ${res.status} for ${url.slice(0, 80)}`
      );
      return null;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMG_BYTES) return null;
    return { bytes: buf, contentType: ct };
  } catch (err) {
    console.warn(
      `[scrape-cache] download error for ${url.slice(0, 80)}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function uploadToBucket(
  supabase: SupabaseClient,
  userId: string,
  url: string
): Promise<string | null> {
  const downloaded = await downloadImage(url);
  if (!downloaded) return null;
  const hash = hashUrl(url);
  const ext = extFromContentType(downloaded.contentType);
  const path = `${PREFIX}/${userId}/${hash}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, downloaded.bytes, {
      contentType: downloaded.contentType,
      upsert: true,
      cacheControl: "31536000",
    });
  if (error) {
    const msg = error.message ?? "";
    // upsert:true deveria evitar "already exists" — se aparecer, algo tá
    // estranho mas a URL existente funciona. Retorna ela nesse caso.
    if (msg.toLowerCase().includes("already exists")) {
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return pub?.publicUrl ?? null;
    }
    // Qualquer outro erro (bucket not found, policy, quota, etc.): NAO
    // retornar URL. Front vai receber null e mostrar placeholder em vez de
    // renderizar <img> com 404.
    console.warn("[scrape-cache] upload failed:", msg);
    return null;
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub?.publicUrl ?? null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit = CONCURRENCY
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }).map(
    async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await worker(items[idx]);
      }
    }
  );
  await Promise.all(runners);
  return out;
}

/**
 * Cacheia um batch de URLs em paralelo. URLs que falham viram null
 * (chamador mantém URL original ou esconde). Mapa em-memória dedupa
 * mesma URL aparecendo em vários posts (carrossel → slide).
 */
export async function cacheImages(
  userId: string,
  urls: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = Array.from(new Set(urls.filter(Boolean)));
  if (unique.length === 0) return out;

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    console.warn("[scrape-cache] no supabase service role — skipping cache");
    return out;
  }

  const results = await runWithConcurrency(unique, (url) =>
    uploadToBucket(supabase, userId, url)
  );

  unique.forEach((u, idx) => {
    out.set(u, results[idx] ?? null);
  });

  return out;
}
