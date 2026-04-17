import type { SupabaseClient } from "@supabase/supabase-js";

export type CarouselSlide = {
  heading: string;
  body: string;
  imageQuery: string;
  imageUrl?: string;
};

export type CarouselVariationMeta = {
  title: string;
  style: string;
};

/** Metadados persistidos após upload em `carousel-exports` (API /api/carousel/exports). */
export type CarouselExportAssets = {
  pngUrls: string[];
  pdfUrl?: string | null;
  exportedAt?: string;
  slideCount?: number;
};

export type SavedCarousel = {
  id: string;
  title: string;
  slides: CarouselSlide[];
  style: string;
  savedAt: string;
  status?: string;
  variation?: CarouselVariationMeta;
  exportAssets?: CarouselExportAssets;
  thumbnailUrl?: string | null;
};

const GUEST_STORAGE_KEY = "sequencia-viral_carousels";

export function isCarouselUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

type CarouselRow = {
  id: string;
  title: string | null;
  slides: unknown;
  style: unknown;
  status: string | null;
  updated_at: string;
  created_at: string;
  export_assets?: unknown;
  thumbnail_url?: string | null;
};

function parseExportAssets(raw: unknown): CarouselExportAssets | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const pngUrls = Array.isArray(o.pngUrls)
    ? o.pngUrls.filter((x): x is string => typeof x === "string")
    : [];
  const pdfUrl = typeof o.pdfUrl === "string" ? o.pdfUrl : null;
  const exportedAt = typeof o.exportedAt === "string" ? o.exportedAt : undefined;
  const slideCount = typeof o.slideCount === "number" ? o.slideCount : undefined;
  if (pngUrls.length === 0 && !pdfUrl) return undefined;
  return { pngUrls, pdfUrl: pdfUrl ?? undefined, exportedAt, slideCount };
}

export function rowToSavedCarousel(row: CarouselRow): SavedCarousel {
  const slides = Array.isArray(row.slides)
    ? (row.slides as CarouselSlide[])
    : [];
  const styleObj =
    row.style && typeof row.style === "object"
      ? (row.style as Record<string, unknown>)
      : {};
  const slideStyle =
    typeof styleObj.slideStyle === "string" ? styleObj.slideStyle : "white";
  const rawVar = styleObj.variation;
  const variation =
    rawVar && typeof rawVar === "object"
      ? {
          title: String((rawVar as { title?: string }).title ?? ""),
          style: String((rawVar as { style?: string }).style ?? ""),
        }
      : undefined;

  return {
    id: row.id,
    title: row.title || slides[0]?.heading || "Sem título",
    slides,
    style: slideStyle,
    savedAt: row.updated_at || row.created_at,
    status: row.status || "draft",
    variation,
    exportAssets: parseExportAssets(row.export_assets),
    thumbnailUrl: row.thumbnail_url ?? null,
  };
}

const CAROUSEL_LIST_FIELDS =
  "id,title,slides,style,status,created_at,updated_at,export_assets,thumbnail_url";

export async function fetchUserCarousels(
  client: SupabaseClient
): Promise<SavedCarousel[]> {
  const { data, error } = await client
    .from("carousels")
    .select(CAROUSEL_LIST_FIELDS)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => rowToSavedCarousel(row as CarouselRow));
}

export async function fetchUserCarousel(
  client: SupabaseClient,
  id: string
): Promise<SavedCarousel | null> {
  const { data, error } = await client
    .from("carousels")
    .select(CAROUSEL_LIST_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToSavedCarousel(data as CarouselRow);
}

export async function upsertUserCarousel(
  client: SupabaseClient,
  userId: string,
  payload: {
    id?: string | null;
    title: string;
    slides: CarouselSlide[];
    slideStyle: "white" | "dark";
    variation?: CarouselVariationMeta | null;
    status: "draft" | "published" | "archived";
  }
): Promise<{ row: CarouselRow; inserted: boolean }> {
  const style = {
    slideStyle: payload.slideStyle,
    variation: payload.variation
      ? { title: payload.variation.title, style: payload.variation.style }
      : undefined,
  };

  if (payload.id) {
    const { data, error } = await client
      .from("carousels")
      .update({
        title: payload.title,
        slides: payload.slides,
        style,
        status: payload.status,
      })
      .eq("id", payload.id)
      .eq("user_id", userId)
      .select(CAROUSEL_LIST_FIELDS)
      .single();

    if (error) throw error;
    return { row: data as CarouselRow, inserted: false };
  }

  const { data, error } = await client
    .from("carousels")
    .insert({
      user_id: userId,
      title: payload.title,
      slides: payload.slides,
      style,
      status: payload.status,
    })
    .select(CAROUSEL_LIST_FIELDS)
    .single();

  if (error) throw error;
  return { row: data as CarouselRow, inserted: true };
}

export async function deleteUserCarousel(
  client: SupabaseClient,
  userId: string,
  id: string
) {
  const { error } = await client
    .from("carousels")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function bumpCarouselUsage(
  client: SupabaseClient,
  userId: string
) {
  const { data: prof, error: readErr } = await client
    .from("profiles")
    .select("usage_count")
    .eq("id", userId)
    .single();

  if (readErr) return;

  const next = (prof?.usage_count ?? 0) + 1;
  await client.from("profiles").update({ usage_count: next }).eq("id", userId);
}

export function readGuestCarousels(): SavedCarousel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedCarousel[];
  } catch {
    // ignore
  }
  return [];
}

export function writeGuestCarousels(items: SavedCarousel[]) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(items));
}

export function upsertGuestCarousel(draft: SavedCarousel) {
  const existing = readGuestCarousels();
  const idx = existing.findIndex((c) => c.id === draft.id);
  if (idx >= 0) {
    const next = [...existing];
    next[idx] = draft;
    writeGuestCarousels(next);
  } else {
    writeGuestCarousels([draft, ...existing]);
  }
  localStorage.setItem("sequencia-viral-draft", JSON.stringify(draft));
}

export function duplicateGuestCarousel(carousel: SavedCarousel): SavedCarousel {
  return {
    ...carousel,
    id: `carousel-${Date.now()}`,
    title: `${carousel.title || "Sem título"} (cópia)`,
    savedAt: new Date().toISOString(),
    status: "draft",
  };
}
