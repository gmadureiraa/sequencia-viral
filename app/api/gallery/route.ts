import {
  requireAuthenticatedUser,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";
import { checkRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { saveToUserGallery, touchUserImage } from "@/lib/server/user-images";

export const maxDuration = 15;

interface GalleryItem {
  id: string;
  url: string;
  source: "generated" | "uploaded" | "unsplash" | "search";
  title: string | null;
  description: string | null;
  tags: string[] | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

/**
 * GET /api/gallery?source=all|generated|uploaded&limit=50
 * Lista imagens da galeria do user autenticado, ordenadas por created_at desc.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = checkRateLimit({
    key: getRateLimitKey(request, "gallery-list", user.id),
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json({ error: "Rate limit" }, { status: 429 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "Supabase indisponível" }, { status: 503 });

  const url = new URL(request.url);
  const source = url.searchParams.get("source") ?? "all";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  let query = sb
    .from("user_images")
    .select("id,url,source,title,description,tags,usage_count,last_used_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (source === "generated" || source === "uploaded" || source === "unsplash" || source === "search") {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ images: (data ?? []) as GalleryItem[] });
}

/**
 * POST /api/gallery
 * Body: { url, source, title?, description?, tags?, carouselId?, slideIndex?, prompt? }
 * Registra uma imagem na galeria. Usado quando upload é feito client-side
 * direto em Supabase Storage (modo avançado em /create/new).
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const limiter = checkRateLimit({
    key: getRateLimitKey(request, "gallery-insert", user.id),
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json({ error: "Rate limit" }, { status: 429 });
  }

  let body: {
    url?: string;
    source?: string;
    title?: string;
    description?: string;
    tags?: string[];
    carouselId?: string | null;
    slideIndex?: number | null;
    prompt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string" || body.url.length > 2000) {
    return Response.json({ error: "URL obrigatória e <= 2000 chars" }, { status: 400 });
  }
  const source = body.source;
  if (source !== "uploaded" && source !== "generated" && source !== "unsplash" && source !== "search") {
    return Response.json({ error: "source inválido" }, { status: 400 });
  }

  await saveToUserGallery({
    userId: user.id,
    url: body.url,
    source,
    title: body.title?.slice(0, 200),
    description: body.description?.slice(0, 1000),
    prompt: body.prompt?.slice(0, 2000),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map((t) => String(t).slice(0, 48)) : undefined,
    carouselId: body.carouselId ?? null,
    slideIndex: typeof body.slideIndex === "number" ? body.slideIndex : null,
  });

  return Response.json({ ok: true });
}

/**
 * DELETE /api/gallery?id=<uuid>
 * Remove imagem da galeria. Só deleta do DB — não apaga do storage (seguro
 * manter o blob caso esteja em uso em outro carrossel).
 */
export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "Supabase indisponível" }, { status: 503 });

  const { error } = await sb
    .from("user_images")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLS extra — garante dono

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/**
 * PATCH /api/gallery?id=<uuid>
 * Marca imagem como usada (incrementa usage_count + updated_at).
 */
export async function PATCH(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const url = new URL(request.url);
  const imageUrl = url.searchParams.get("url");
  if (!imageUrl) return Response.json({ error: "url obrigatória" }, { status: 400 });

  await touchUserImage({ userId: user.id, url: imageUrl });
  return Response.json({ ok: true });
}
