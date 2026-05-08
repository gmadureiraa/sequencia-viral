/**
 * POST /api/carousels/[id]/thumb
 *
 * Renderiza server-side o slide 0 do carrossel e popula thumbnail_url.
 *
 * Use case: flow single-shot (browser-side) NÃO renderiza PNGs no servidor.
 * Quando user salva o carrossel pela 1ª vez, faz fire-and-forget chamada
 * pra essa rota que gera 1 PNG (slide capa) + upload + UPDATE thumbnail_url.
 *
 * Idempotente: se thumbnail_url já existe, no-op (skip render).
 *
 * Custo: ~500ms (render via next/og + upload). Roda async, user nem percebe.
 */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import {
  renderSlideToPng,
  type RenderSlideOptions,
} from "@/lib/server/zernio-slide-renderer";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "carousel-images";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAuthenticatedUser(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const { id } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return NextResponse.json({ error: "DB indisponível." }, { status: 503 });

  // 1. Carrega carousel + verifica ownership
  const { data: carousel } = await sb
    .from("carousels")
    .select("id, user_id, slides, thumbnail_url, title")
    .eq("id", id)
    .single();

  if (!carousel) {
    return NextResponse.json({ error: "Carrossel não encontrado." }, { status: 404 });
  }
  if (carousel.user_id !== user.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  // 2. Idempotência — já tem thumb? skip
  if (carousel.thumbnail_url) {
    return NextResponse.json({ ok: true, thumbnailUrl: carousel.thumbnail_url, skipped: true });
  }

  const slides = (carousel.slides ?? []) as Array<{
    heading?: string;
    body?: string;
    imageUrl?: string | null;
    variant?: string;
  }>;
  if (slides.length === 0) {
    return NextResponse.json({ error: "Carrossel sem slides." }, { status: 400 });
  }

  // 3. Render slide 0
  const slide0 = slides[0];
  const renderOpts: RenderSlideOptions = {
    heading: (slide0.heading || "").trim().slice(0, 240) || (carousel.title as string) || "Capa",
    body: (slide0.body || "").trim().slice(0, 600),
    imageUrl: slide0.imageUrl || null,
    slideNumber: 1,
    totalSlides: slides.length,
    variant: "cover",
  };

  let pngBuffer: ArrayBuffer;
  try {
    const response = renderSlideToPng(renderOpts);
    pngBuffer = await response.arrayBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `render falhou: ${msg}` }, { status: 500 });
  }

  // 4. Upload em path dedicado pra thumb
  const hash = createHash("sha256")
    .update(new Uint8Array(pngBuffer))
    .digest("hex")
    .slice(0, 12);
  const path = `thumbnails/${user.id}/${id}-${hash}.png`;

  const { error: upErr } = await sb.storage.from(BUCKET).upload(
    path,
    new Uint8Array(pngBuffer),
    {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    }
  );
  if (upErr && !upErr.message.toLowerCase().includes("already exists")) {
    return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) {
    return NextResponse.json({ error: "publicUrl indisponível." }, { status: 500 });
  }

  // 5. UPDATE thumbnail_url
  const { error: updErr } = await sb
    .from("carousels")
    .update({ thumbnail_url: pub.publicUrl })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updErr) {
    return NextResponse.json({ error: `update: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, thumbnailUrl: pub.publicUrl });
}
