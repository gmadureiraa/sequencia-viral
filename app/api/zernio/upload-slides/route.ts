/**
 * POST /api/zernio/upload-slides
 *
 * Recebe PNGs dos slides em base64 (data URL) + carouselId, sobe pro bucket
 * `carousel-images` com prefix `zernio-posts/{userId}/{carouselId}/` e
 * devolve URLs públicas pra usar como `mediaUrls` no POST /api/zernio/posts.
 *
 * Por que server-side e não client direto:
 *  - Service role ignora RLS — admin pode subir em qualquer path sem regras
 *    extras de Storage policy.
 *  - Centralizado: 1 lugar pra mudar bucket/path, hash, content-type.
 *
 * Body: {
 *   carouselId: string,
 *   slides: { index: number; dataUrl: string }[]   // dataUrl = "data:image/png;base64,..."
 * }
 * Resposta: { urls: string[]  }                    // ordenadas por slides[].index
 */

import { createHash } from "node:crypto";
import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "carousel-images";
const PREFIX = "zernio-posts";
const MAX_BYTES_PER_SLIDE = 8 * 1024 * 1024; // 8MB cap por slide

interface SlideInput {
  index: number;
  dataUrl: string;
}

interface UploadBody {
  carouselId?: string;
  slides?: SlideInput[];
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  if (!contentType.startsWith("image/")) return null;
  try {
    const binary = Buffer.from(m[2], "base64");
    if (binary.byteLength === 0 || binary.byteLength > MAX_BYTES_PER_SLIDE) return null;
    return { bytes: new Uint8Array(binary), contentType };
  } catch {
    return null;
  }
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  return "png";
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  // 30 uploads/h por admin — cada upload sobe N slides (1 carrossel completo).
  // Cap é defensivo contra loop bug; uso normal não bate nem perto.
  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-upload-slides", user.id),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: UploadBody;
  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const carouselId = body.carouselId;
  const slides = body.slides ?? [];
  if (!carouselId) return Response.json({ error: "carouselId obrigatório." }, { status: 400 });
  if (slides.length === 0)
    return Response.json({ error: "Nenhum slide enviado." }, { status: 400 });
  if (slides.length > 20)
    return Response.json({ error: "Max 20 slides por upload." }, { status: 400 });

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Upload em paralelo (concorrência simples, lista pequena).
  const sorted = [...slides].sort((a, b) => a.index - b.index);
  const results = await Promise.all(
    sorted.map(async (slide) => {
      const decoded = dataUrlToBytes(slide.dataUrl);
      if (!decoded) {
        return { index: slide.index, error: "dataUrl inválido" };
      }
      const ext = extFromContentType(decoded.contentType);
      // Nome do arquivo: hash do conteúdo pra ser determinístico (mesma imagem
      // → mesma URL → cache-friendly).
      const hash = createHash("sha256").update(decoded.bytes).digest("hex").slice(0, 16);
      const path = `${PREFIX}/${user.id}/${carouselId}/slide-${String(slide.index).padStart(2, "0")}-${hash}.${ext}`;

      const { error } = await sb.storage.from(BUCKET).upload(path, decoded.bytes, {
        contentType: decoded.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
      if (error && !error.message.toLowerCase().includes("already exists")) {
        return { index: slide.index, error: error.message };
      }
      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
      if (!pub?.publicUrl) {
        return { index: slide.index, error: "publicUrl indisponível" };
      }
      return { index: slide.index, url: pub.publicUrl };
    })
  );

  const failures = results.filter((r) => "error" in r);
  if (failures.length > 0) {
    console.error("[zernio/upload-slides] failures:", failures);
    return Response.json(
      {
        error: `Falha no upload de ${failures.length}/${slides.length} slide(s).`,
        details: failures,
      },
      { status: 500 }
    );
  }

  // Retorna URLs ordenadas pelo index (já vieram ordenadas).
  const urls = results.map((r) => ("url" in r ? r.url : ""));
  return Response.json({ urls });
}
