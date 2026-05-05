/**
 * GET /api/zernio/render-slide
 *
 * Renderiza 1 slide como PNG via next/og. Usado pra preview no admin
 * (e debug). O cron usa diretamente `renderSlideToPng()` (sem HTTP).
 *
 * Query params:
 *   heading       (string, required)
 *   body          (string, required)
 *   imageUrl      (string, optional)
 *   slideNumber   (number, default 1)
 *   totalSlides   (number, default 1)
 *   variant       (cover | text-only | full-photo-bottom | cta | headline)
 *   accentColor   (hex, optional)
 *   profileName   (string, optional)
 */

import { requireAdmin } from "@/lib/server/auth";
import {
  renderSlideToPng,
  type RenderSlideOptions,
} from "@/lib/server/zernio-slide-renderer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;

  const url = new URL(request.url);
  const heading = url.searchParams.get("heading") ?? "";
  const body = url.searchParams.get("body") ?? "";
  if (!heading) return new Response("heading required", { status: 400 });

  const opts: RenderSlideOptions = {
    heading: heading.slice(0, 240),
    body: body.slice(0, 600),
    imageUrl: url.searchParams.get("imageUrl") || null,
    slideNumber: Math.max(1, Number(url.searchParams.get("slideNumber") ?? 1)),
    totalSlides: Math.max(1, Number(url.searchParams.get("totalSlides") ?? 1)),
    variant:
      (url.searchParams.get("variant") as RenderSlideOptions["variant"]) ??
      "headline",
    accentColor: url.searchParams.get("accentColor") || undefined,
    profileName: url.searchParams.get("profileName") || undefined,
  };

  return renderSlideToPng(opts);
}
