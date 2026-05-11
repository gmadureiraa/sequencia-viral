import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CreationMode,
  type DesignTemplateId,
  type ImagePeopleMode,
  normalizeDesignTemplate,
  normalizeImagePeopleMode,
} from "@/lib/carousel-templates";
import type { TemplateId as VisualTemplateId } from "@/components/app/templates/types";

const VISUAL_TEMPLATE_IDS = [
  "manifesto",
  "futurista",
  "autoral",
  "twitter",
  "ambitious",
  "blank",
  "bohdan",
] as const;

function normalizeVisualTemplate(raw: unknown): VisualTemplateId | undefined {
  if (typeof raw !== "string") return undefined;
  return (VISUAL_TEMPLATE_IDS as readonly string[]).includes(raw)
    ? (raw as VisualTemplateId)
    : undefined;
}

export type CarouselSlide = {
  heading: string;
  body: string;
  imageQuery: string;
  imageUrl?: string;
  /** Variante de layout — definida pela IA ou pelo usuário no editor. */
  variant?:
    | "cover"
    | "headline"
    | "photo"
    | "quote"
    | "split"
    | "cta"
    | "solid-brand"
    | "text-only"
    | "full-photo-bottom";
  /** Cor de fundo custom (sobrescreve slideStyle). */
  bgColor?: string;
  /** Camadas visíveis no render (title/body/bg). */
  layers?: { title: boolean; body: boolean; bg: boolean };
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
  /** Template visual v2 — qual tratamento dos 4 (manifesto/futurista/autoral/twitter). */
  visualTemplate?: VisualTemplateId;
  /** quick vs guided Content Machine (persisted in carousels.style JSON) */
  creationMode?: CreationMode;
  /** Pares de fonte editorial (`title_font` / `body_font` no JSON style) */
  titleFontId?: string;
  bodyFontId?: string;
  /** Avaliação e comentário (MVP: JSON em `style.feedback`) */
  feedback?: CarouselFeedback;
  /** Preferência de pessoas nas fotos (persistido em `style.image_people_mode`) */
  imagePeopleMode?: ImagePeopleMode;
  /** Override da cor de destaque do template visual (persistido em `style.accent_override`). */
  accentOverride?: string;
  /** Fonte display override (CSS font-family). Persistido em `style.display_font`. */
  displayFont?: string;
  /** Multiplicador de tamanho do texto. Persistido em `style.text_scale`. Range 0.8–1.3. */
  textScale?: number;
  /** Tags livres (nicho, tema, campanha). Persistido em `style.tags[]`. */
  tags?: string[];
  /** Legenda gerada (ou editada) pro post final. Persistido em `style.caption`. */
  caption?: string;
  /** Hashtags sugeridas pela IA. Persistido em `style.caption_hashtags[]`. */
  captionHashtags?: string[];
  /**
   * Prompt enviado à IA pra gerar este carrossel (systemPrompt + userMessage).
   * Persistido na coluna `prompt_used` (migration 20260422160000). Visível só
   * pra admin no editor, via painel Debug IA. Pra carrosséis legados é null.
   */
  promptUsed?: string | null;
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
  prompt_used?: string | null;
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
  // Quando vem do fetch LIST (CAROUSEL_LIST_FIELDS), `slides` não existe.
  // Em vez disso vem `heading`, `body`, `imageUrl` flat (do primeiro slide).
  // Reconstruímos um slide sintético pra manter compatibilidade com a UI
  // (dashboard renderiza carousel.slides[0]).
  let slides: CarouselSlide[];
  if (Array.isArray(row.slides)) {
    slides = row.slides as CarouselSlide[];
  } else {
    const flatRow = row as unknown as {
      heading?: string;
      body?: string;
      imageUrl?: string;
    };
    if (flatRow.heading || flatRow.body) {
      slides = [
        {
          heading: flatRow.heading ?? "",
          body: flatRow.body ?? "",
          imageUrl: flatRow.imageUrl ?? "",
        } as CarouselSlide,
      ];
    } else {
      slides = [];
    }
  }
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

  const visualTemplate = normalizeVisualTemplate(styleObj.visual_template);

  const accentOverride =
    typeof styleObj.accent_override === "string"
      ? styleObj.accent_override
      : undefined;
  const displayFont =
    typeof styleObj.display_font === "string"
      ? styleObj.display_font
      : undefined;
  const rawScale = styleObj.text_scale;
  const textScale =
    typeof rawScale === "number" && Number.isFinite(rawScale)
      ? Math.max(0.6, Math.min(1.6, rawScale))
      : undefined;

  const rawTags = styleObj.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 20)
    : undefined;

  const caption =
    typeof styleObj.caption === "string" ? styleObj.caption : undefined;
  const rawCaptionHashtags = styleObj.caption_hashtags;
  const captionHashtags = Array.isArray(rawCaptionHashtags)
    ? rawCaptionHashtags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 12)
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
    visualTemplate,
    creationMode,
    titleFontId,
    bodyFontId,
    feedback,
    imagePeopleMode,
    accentOverride,
    displayFont,
    textScale,
    tags,
    caption,
    captionHashtags,
    promptUsed:
      typeof row.prompt_used === "string" ? row.prompt_used : null,
  };
}

/**
 * Atualiza apenas as tags (`style.tags[]`) de um carrossel, preservando todo
 * o resto do JSON `style`. Usado pela biblioteca pra adicionar/remover tags
 * sem mexer em slides/variation/designTemplate.
 */
export async function updateCarouselTags(
  client: SupabaseClient,
  userId: string,
  carouselId: string,
  tags: string[]
): Promise<void> {
  const cleaned = Array.from(
    new Set(
      tags
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 32)
    )
  ).slice(0, 20);

  const { data: current, error: fetchErr } = await client
    .from("carousels")
    .select("style")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr || !current) {
    throw fetchErr || new Error("Carrossel não encontrado");
  }
  const style =
    current.style && typeof current.style === "object"
      ? { ...(current.style as Record<string, unknown>) }
      : {};
  style.tags = cleaned;
  const { error } = await client
    .from("carousels")
    .update({ style })
    .eq("id", carouselId)
    .eq("user_id", userId);
  if (error) throw error;
}

// Pra FETCH individual (edit/preview) — inclui slides completos.
const CAROUSEL_DETAIL_FIELDS =
  "id,title,slides,style,status,created_at,updated_at,export_assets,thumbnail_url,prompt_used";
const CAROUSEL_DETAIL_FIELDS_FALLBACK =
  "id,title,slides,style,status,created_at,updated_at,thumbnail_url";

// Pra FETCH em LISTA (dashboard, /carousels) — mínimo absoluto.
// NÃO inclui slides, NÃO inclui JSON path (postgrest faz parse extra custoso).
// Só metadata pra renderizar card colorido com título + template badge + data.
// O preview do primeiro slide foi descontinuado — cards mostram bloco sólido
// com cor do template (igual Linear/Notion) em vez de render de slide real.
const CAROUSEL_LIST_FIELDS =
  "id,title,style,status,created_at,updated_at,export_assets,thumbnail_url";
const CAROUSEL_LIST_FIELDS_FALLBACK =
  "id,title,style,status,created_at,updated_at,thumbnail_url";

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
  return (data || []).map((row) =>
    rowToSavedCarousel(row as unknown as CarouselRow)
  );
}

export async function fetchUserCarousel(
  client: SupabaseClient,
  id: string
): Promise<SavedCarousel | null> {
  // SELECT DETAIL: edit page precisa dos slides completos.
  let { data, error } = await client
    .from("carousels")
    .select(CAROUSEL_DETAIL_FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    const retry = await client
      .from("carousels")
      .select(CAROUSEL_DETAIL_FIELDS_FALLBACK)
      .eq("id", id)
      .maybeSingle();
    data = (retry.data as unknown) as typeof data;
    error = retry.error;
  }

  if (error || !data) return null;
  return rowToSavedCarousel(data as unknown as CarouselRow);
}

/**
 * Remove campos runtime-only do slide antes de persistir no DB.
 * - `imageFailed`: flag UX (editor), não deve ir pro banco.
 */
function stripRuntimeSlideFields(slides: CarouselSlide[]): CarouselSlide[] {
  return slides.map((s) => {
    const cleaned = { ...s } as CarouselSlide & { imageFailed?: boolean };
    delete cleaned.imageFailed;
    return cleaned;
  });
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
    visualTemplate?: VisualTemplateId;
    creationMode?: CreationMode;
    titleFontId?: string;
    bodyFontId?: string;
    imagePeopleMode?: ImagePeopleMode;
    accentOverride?: string;
    displayFont?: string;
    textScale?: number;
    caption?: string;
    captionHashtags?: string[];
    /**
     * Prompt completo enviado ao Gemini (systemPrompt + userMessage). Opcional.
     * Quando presente, é gravado na coluna `prompt_used` pra auditoria admin.
     */
    promptUsed?: string | null;
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
  if (payload.visualTemplate) {
    style.visual_template = payload.visualTemplate;
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
  if (payload.accentOverride) {
    style.accent_override = payload.accentOverride;
  }
  if (payload.displayFont) {
    style.display_font = payload.displayFont;
  }
  if (typeof payload.textScale === "number") {
    style.text_scale = payload.textScale;
  }
  if (typeof payload.caption === "string") {
    style.caption = payload.caption;
  }
  if (Array.isArray(payload.captionHashtags)) {
    style.caption_hashtags = payload.captionHashtags
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 12);
  }

  if (payload.id) {
    const { data: existingRow } = await client
      .from("carousels")
      .select("style")
      .eq("id", payload.id)
      .eq("user_id", userId)
      .maybeSingle();

    // Se payload.id veio mas o carrossel NÃO existe no DB (onboarding
    // cria ID client-side antes de persistir), cai pro INSERT com id
    // explícito em vez de tentar UPDATE de linha inexistente (PGRST116).
    if (!existingRow) {
      const insertWithId: Record<string, unknown> = {
        id: payload.id,
        user_id: userId,
        title: payload.title,
        slides: payload.slides,
        style,
        status: payload.status,
      };
      if (typeof payload.promptUsed === "string") {
        insertWithId.prompt_used = payload.promptUsed;
      }
      if (payload.imagePeopleMode) {
        (insertWithId.style as Record<string, unknown>).image_people_mode =
          payload.imagePeopleMode;
      }
      let { data: insData, error: insErr } = await client
        .from("carousels")
        .insert(insertWithId)
        .select(CAROUSEL_LIST_FIELDS)
        .single();
      if (insErr && isMissingColumnError(insErr)) {
        const fb = { ...insertWithId };
        delete fb.prompt_used;
        const retry = await client
          .from("carousels")
          .insert(fb)
          .select(CAROUSEL_DETAIL_FIELDS_FALLBACK)
          .single();
        insData = (retry.data as unknown) as typeof insData;
        insErr = retry.error;
      }
      if (insErr) {
        console.error(
          "[upsertUserCarousel] insert-with-id error:",
          insErr.message,
          insErr.details,
          insErr.hint
        );
        throw insErr;
      }
      return { row: insData as unknown as CarouselRow, inserted: true };
    }

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
    // Preservar visual_template se não foi enviado neste update.
    if (!payload.visualTemplate) {
      const prevVt = normalizeVisualTemplate(prev.visual_template);
      if (prevVt) style.visual_template = prevVt;
    }
    // Preservar accent / display_font / text_scale se não foram enviados.
    if (!payload.accentOverride && typeof prev.accent_override === "string") {
      style.accent_override = prev.accent_override;
    }
    if (!payload.displayFont && typeof prev.display_font === "string") {
      style.display_font = prev.display_font;
    }
    if (
      typeof payload.textScale !== "number" &&
      typeof prev.text_scale === "number"
    ) {
      style.text_scale = prev.text_scale;
    }
    // Preservar caption / caption_hashtags se não foram enviados neste update.
    if (typeof payload.caption !== "string" && typeof prev.caption === "string") {
      style.caption = prev.caption;
    }
    if (!Array.isArray(payload.captionHashtags) && Array.isArray(prev.caption_hashtags)) {
      style.caption_hashtags = prev.caption_hashtags;
    }
    // Preservar tags se não foram enviadas.
    if (Array.isArray(prev.tags) && style.tags === undefined) {
      style.tags = prev.tags;
    }

    const updatePayload: Record<string, unknown> = {
      title: payload.title,
      slides: stripRuntimeSlideFields(payload.slides),
      style,
      status: payload.status,
    };
    if (typeof payload.promptUsed === "string") {
      updatePayload.prompt_used = payload.promptUsed;
    }

    let { data, error } = await client
      .from("carousels")
      .update(updatePayload)
      .eq("id", payload.id)
      .eq("user_id", userId)
      .select(CAROUSEL_DETAIL_FIELDS)
      .single();

    if (error && isMissingColumnError(error)) {
      // Coluna prompt_used ainda não aplicada — tenta sem ela.
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.prompt_used;
      const retry = await client
        .from("carousels")
        .update(fallbackPayload)
        .eq("id", payload.id)
        .eq("user_id", userId)
        .select(CAROUSEL_DETAIL_FIELDS_FALLBACK)
        .single();
      data = (retry.data as unknown) as typeof data;
      error = retry.error;
    }

    if (error) {
      console.error("[upsertUserCarousel] update error:", error.message, error.details, error.hint);
      throw error;
    }
    return { row: data as unknown as CarouselRow, inserted: false };
  }

  if (payload.imagePeopleMode) {
    style.image_people_mode = payload.imagePeopleMode;
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    title: payload.title,
    slides: payload.slides,
    style,
    status: payload.status,
  };
  if (typeof payload.promptUsed === "string") {
    insertPayload.prompt_used = payload.promptUsed;
  }

  let { data, error } = await client
    .from("carousels")
    .insert(insertPayload)
    .select(CAROUSEL_LIST_FIELDS)
    .single();

  if (error && isMissingColumnError(error)) {
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.prompt_used;
    const retry = await client
      .from("carousels")
      .insert(fallbackPayload)
      .select(CAROUSEL_DETAIL_FIELDS_FALLBACK)
      .single();
    data = (retry.data as unknown) as typeof data;
    error = retry.error;
  }

  if (error) {
    console.error("[upsertUserCarousel] insert error:", error.message, error.details, error.hint);
    throw error;
  }
  return { row: data as unknown as CarouselRow, inserted: true };
}

export async function deleteUserCarousel(
  client: SupabaseClient,
  userId: string,
  id: string
) {
  // ── Limpeza de Storage: remove imagens geradas/uploaded do bucket antes
  //    de deletar o registro. Best-effort: falha no storage nao bloqueia o
  //    DELETE da row — apenas loga warning. Evita acumulo indefinido de
  //    arquivos orfaos em carousel-images/{userId}/{carouselId}/.
  try {
    const folderPrefix = `${userId}/${id}`;
    const { data: files, error: listError } = await client
      .storage
      .from("carousel-images")
      .list(folderPrefix, { limit: 100 });

    if (listError) {
      console.warn("[deleteUserCarousel] storage.list falhou (continuando delete):", listError.message);
    } else if (files && files.length > 0) {
      const paths = files.map((f) => `${folderPrefix}/${f.name}`);
      const { error: removeError } = await client
        .storage
        .from("carousel-images")
        .remove(paths);

      if (removeError) {
        console.warn("[deleteUserCarousel] storage.remove falhou (continuando delete):", removeError.message);
      } else {
        console.log(`[deleteUserCarousel] storage: ${paths.length} arquivo(s) removido(s) de ${folderPrefix}`);
      }
    }
  } catch (storageErr) {
    // Nunca bloqueia o delete da row por erro de storage
    console.warn("[deleteUserCarousel] erro inesperado no cleanup de storage:", storageErr);
  }

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

export interface BumpUsageResult {
  /** Se o increment foi permitido (false = user atingiu o cap mensal). */
  allowed: boolean;
  /** Contagem atual após increment (ou tentativa). */
  newCount: number;
  /** Cap efetivo (greatest do usage_limit do DB com o plan_cap). */
  usageLimit: number;
  /** Plano vigente. */
  plan: string;
}

/**
 * Incrementa atomicamente `profiles.usage_count` respeitando o cap mensal.
 *
 * Usa `try_increment_usage_count` (RPC SECURITY DEFINER) — single UPDATE com
 * `WHERE usage_count < cap` que garante atomicidade contra TOCTOU em chamadas
 * concorrentes (bulk duplicate, multi-tab, race com /api/generate).
 *
 * Audit 2026-05-11 (Gabriel): a RPC anterior `increment_usage_count` NÃO
 * existe no schema — toda chamada de bumpCarouselUsage caía no fallback
 * read-then-write non-atomic, e a duplicação não respeitava o cap mensal
 * (user free podia duplicar 50 mesmo com cap 5).
 *
 * Retorna `{ allowed, newCount, usageLimit, plan }` pro caller decidir UX
 * (toast de bloqueio quando allowed=false).
 */
export async function bumpCarouselUsage(
  client: SupabaseClient,
  userId: string
): Promise<BumpUsageResult> {
  type RpcRow = {
    out_allowed: boolean;
    out_new_count: number;
    out_usage_limit: number;
    out_plan: string;
  };
  const { data, error } = await client
    .rpc("try_increment_usage_count", { uid: userId })
    .returns<RpcRow[]>();

  if (error) {
    console.error("[bumpCarouselUsage] try_increment_usage_count error:", error.message);
    // Fail-open conservador: deixa passar mas loga. Backend (/api/generate)
    // tem o gate atomic real; aqui (duplicate) preferimos não travar UX em
    // bug transitório de RPC.
    return { allowed: true, newCount: 0, usageLimit: 0, plan: "free" };
  }

  const row = Array.isArray(data) ? data[0] : (data as RpcRow | null);
  if (!row) {
    console.error("[bumpCarouselUsage] empty RPC result");
    return { allowed: true, newCount: 0, usageLimit: 0, plan: "free" };
  }

  return {
    allowed: row.out_allowed,
    newCount: row.out_new_count,
    usageLimit: row.out_usage_limit,
    plan: row.out_plan,
  };
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
