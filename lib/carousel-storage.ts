import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CreationMode,
  type DesignTemplateId,
  type ImagePeopleMode,
  normalizeDesignTemplate,
  normalizeImagePeopleMode,
} from "@/lib/carousel-templates";

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

/** Feedback do cliente por carrossel (persistido em `carousels.style.feedback`). */
export type CarouselFeedback = {
  sentiment: "up" | "down" | null;
  comment: string;
  updatedAt?: string;
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
  /** Visual / Figma template (persisted in carousels.style JSON) */
  designTemplate?: DesignTemplateId;
  /** quick vs guided Content Machine (persisted in carousels.style JSON) */
  creationMode?: CreationMode;
  /** Pares de fonte editorial (`title_font` / `body_font` no JSON style) */
  titleFontId?: string;
  bodyFontId?: string;
  /** Avaliação e comentário (MVP: JSON em `style.feedback`) */
  feedback?: CarouselFeedback;
  /** Preferência de pessoas nas fotos (persistido em `style.image_people_mode`) */
  imagePeopleMode?: ImagePeopleMode;
};

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

  const dt = styleObj.design_template;
  const cm = styleObj.creation_mode;
  const designTemplate: DesignTemplateId = normalizeDesignTemplate(
    typeof dt === "string" ? dt : undefined
  );
  const creationMode: CreationMode | undefined =
    cm === "quick" || cm === "guided" ? cm : undefined;

  const titleFontId =
    typeof styleObj.title_font === "string" ? styleObj.title_font : undefined;
  const bodyFontId =
    typeof styleObj.body_font === "string" ? styleObj.body_font : undefined;

  let feedback: CarouselFeedback | undefined;
  const fb = styleObj.feedback;
  if (fb && typeof fb === "object") {
    const o = fb as Record<string, unknown>;
    const s = o.sentiment;
    const sentiment = s === "up" || s === "down" ? s : null;
    feedback = {
      sentiment,
      comment: typeof o.comment === "string" ? o.comment : "",
      updatedAt: typeof o.updated_at === "string" ? o.updated_at : undefined,
    };
  }

  const rawIpm = styleObj.image_people_mode;
  const imagePeopleMode: ImagePeopleMode | undefined =
    typeof rawIpm === "string"
      ? normalizeImagePeopleMode(rawIpm)
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
    designTemplate,
    creationMode,
    titleFontId,
    bodyFontId,
    feedback,
    imagePeopleMode,
  };
}

const CAROUSEL_LIST_FIELDS =
  "id,title,slides,style,status,created_at,updated_at,export_assets,thumbnail_url";
const CAROUSEL_LIST_FIELDS_FALLBACK =
  "id,title,slides,style,status,created_at,updated_at,thumbnail_url";

function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? "";
  return code === "42703" || /column .* does not exist/i.test(message);
}

export async function fetchUserCarousels(
  client: SupabaseClient
): Promise<SavedCarousel[]> {
  let { data, error } = await client
    .from("carousels")
    .select(CAROUSEL_LIST_FIELDS)
    .order("updated_at", { ascending: false });

  if (error && isMissingColumnError(error)) {
    console.warn(
      "[fetchUserCarousels] export_assets column missing — falling back to base fields. Apply migration 20260415120000_carousel_export_assets.sql to restore cloud-export metadata."
    );
    const retry = await client
      .from("carousels")
      .select(CAROUSEL_LIST_FIELDS_FALLBACK)
      .order("updated_at", { ascending: false });
    data = (retry.data as unknown) as typeof data;
    error = retry.error;
  }

  if (error) {
    console.error("[fetchUserCarousels] error:", error.message, error.details, error.hint);
    throw error;
  }
  return (data || []).map((row) => rowToSavedCarousel(row as CarouselRow));
}

export async function fetchUserCarousel(
  client: SupabaseClient,
  id: string
): Promise<SavedCarousel | null> {
  let { data, error } = await client
    .from("carousels")
    .select(CAROUSEL_LIST_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    const retry = await client
      .from("carousels")
      .select(CAROUSEL_LIST_FIELDS_FALLBACK)
      .eq("id", id)
      .maybeSingle();
    data = (retry.data as unknown) as typeof data;
    error = retry.error;
  }

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
    designTemplate?: DesignTemplateId;
    creationMode?: CreationMode;
    titleFontId?: string;
    bodyFontId?: string;
    imagePeopleMode?: ImagePeopleMode;
  }
): Promise<{ row: CarouselRow; inserted: boolean }> {
  const style: Record<string, unknown> = {
    slideStyle: payload.slideStyle,
    variation: payload.variation
      ? { title: payload.variation.title, style: payload.variation.style }
      : undefined,
  };
  if (payload.designTemplate) {
    style.design_template = payload.designTemplate;
  }
  if (payload.creationMode) {
    style.creation_mode = payload.creationMode;
  }
  if (payload.titleFontId) {
    style.title_font = payload.titleFontId;
  }
  if (payload.bodyFontId) {
    style.body_font = payload.bodyFontId;
  }

  if (payload.id) {
    const { data: existingRow } = await client
      .from("carousels")
      .select("style")
      .eq("id", payload.id)
      .eq("user_id", userId)
      .maybeSingle();
    const prev =
      existingRow?.style && typeof existingRow.style === "object"
        ? (existingRow.style as Record<string, unknown>)
        : {};
    if (prev.feedback) {
      style.feedback = prev.feedback;
    }
    const ipm =
      payload.imagePeopleMode ??
      (typeof prev.image_people_mode === "string"
        ? normalizeImagePeopleMode(prev.image_people_mode)
        : undefined);
    if (ipm) {
      style.image_people_mode = ipm;
    }

    let { data, error } = await client
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

    if (error && isMissingColumnError(error)) {
      const retry = await client
        .from("carousels")
        .update({
          title: payload.title,
          slides: payload.slides,
          style,
          status: payload.status,
        })
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select(CAROUSEL_LIST_FIELDS_FALLBACK)
        .single();
      data = (retry.data as unknown) as typeof data;
      error = retry.error;
    }

    if (error) {
      console.error("[upsertUserCarousel] update error:", error.message, error.details, error.hint);
      throw error;
    }
    return { row: data as CarouselRow, inserted: false };
  }

  if (payload.imagePeopleMode) {
    style.image_people_mode = payload.imagePeopleMode;
  }

  let { data, error } = await client
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

  if (error && isMissingColumnError(error)) {
    const retry = await client
      .from("carousels")
      .insert({
        user_id: userId,
        title: payload.title,
        slides: payload.slides,
        style,
        status: payload.status,
      })
      .select(CAROUSEL_LIST_FIELDS_FALLBACK)
      .single();
    data = (retry.data as unknown) as typeof data;
    error = retry.error;
  }

  if (error) {
    console.error("[upsertUserCarousel] insert error:", error.message, error.details, error.hint);
    throw error;
  }
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

  if (error) {
    console.error("[deleteUserCarousel] error:", error.message, error.details, error.hint);
    throw error;
  }
}

export async function bumpCarouselUsage(
  client: SupabaseClient,
  userId: string
) {
  // Prefer atomic RPC — no race conditions between concurrent generates
  const { error: rpcErr } = await client.rpc("increment_usage_count", { uid: userId });
  if (!rpcErr) return;

  // Fallback: read-then-write (e.g. if RPC not deployed yet)
  console.warn("[bumpCarouselUsage] RPC failed, falling back to read-then-write:", rpcErr.message);
  const { data: prof, error: readErr } = await client
    .from("profiles")
    .select("usage_count")
    .eq("id", userId)
    .single();

  if (readErr) {
    console.error("[bumpCarouselUsage] Failed to read profile:", readErr.message);
    return;
  }

  const next = (prof?.usage_count ?? 0) + 1;
  const { error: updateErr } = await client
    .from("profiles")
    .update({ usage_count: next })
    .eq("id", userId);

  if (updateErr) {
    console.error("[bumpCarouselUsage] Failed to update usage_count:", updateErr.message);
  }
}

const MAX_FEEDBACK_COMMENT = 2000;

/** Salva ou atualiza feedback (joia / negativo / comentário) no JSON do carrossel. */
export async function upsertCarouselFeedback(
  client: SupabaseClient,
  userId: string,
  carouselId: string,
  patch: { sentiment: "up" | "down" | null; comment: string }
): Promise<void> {
  const { data: existing, error: fetchErr } = await client
    .from("carousels")
    .select("style")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !existing) {
    throw fetchErr ?? new Error("Carrossel não encontrado");
  }

  const base =
    existing.style && typeof existing.style === "object"
      ? { ...(existing.style as Record<string, unknown>) }
      : {};

  const trimmed = patch.comment.trim().slice(0, MAX_FEEDBACK_COMMENT);
  base.feedback = {
    sentiment: patch.sentiment,
    comment: trimmed,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from("carousels")
    .update({ style: base })
    .eq("id", carouselId)
    .eq("user_id", userId);

  if (error) throw error;
}
