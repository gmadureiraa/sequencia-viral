/**
 * Worker pra processar items de mass_generation_jobs.
 *
 * Pipeline (igual ao zernio-trigger-runner mas sem o gating do Trigger row):
 *   1. Marca item.status = 'generating', started_at
 *   2. runGeneration({ topic: item.theme, brandContext, refs })
 *   3. upsertUserCarousel
 *   4. renderAndUploadSlides
 *   5. Se config.autoSchedule: createZernioPost(scheduled) + insert em zernio_scheduled_posts
 *      Se !autoSchedule: salva como draft (zernio_post_id=null, status='draft')
 *   6. Marca item.status = 'completed' + atualiza job.completed_count
 *
 * Concorrência: chamado pelo cron route com Promise.all em batches limitados
 * (DEFAULT_CONCURRENCY=2 por user). Não trava — falha de 1 item não derruba os demais.
 */

import { createServiceRoleSupabaseClient } from "../auth";
import { runGeneration } from "../generate-carousel";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { loadBrandContextForUser } from "../brand-context";
import {
  createZernioPost,
  ZernioApiError,
  type ZernioPlatform,
  type ZernioPostPlatformTarget,
} from "../zernio";
import {
  buildCaption,
  renderAndUploadSlides,
} from "../zernio-trigger-runner";
import type { DesignTemplateId } from "@/lib/carousel-templates";
import type { MassGenerationConfig, MassGenerationItem } from "./types";

const MAX_SLIDES_PER_POST = 10;

interface ProcessItemResult {
  ok: boolean;
  carouselId?: string;
  scheduledPostId?: string;
  error?: string;
}

/**
 * Processa 1 item específico. Idempotente quanto a status — se já está
 * 'completed' ou 'failed', retorna no-op.
 */
export async function processMassGenerationItem(
  itemId: string
): Promise<ProcessItemResult> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return { ok: false, error: "DB indisponível" };

  // 1. Carrega item + job
  const { data: item } = await sb
    .from("mass_generation_items")
    .select("*")
    .eq("id", itemId)
    .single();
  if (!item) return { ok: false, error: "item not found" };

  const typedItem = item as MassGenerationItem;
  if (typedItem.status === "completed" || typedItem.status === "failed") {
    return { ok: true, carouselId: typedItem.carousel_id ?? undefined };
  }

  const { data: job } = await sb
    .from("mass_generation_jobs")
    .select("config, user_id, status")
    .eq("id", typedItem.job_id)
    .single();
  if (!job) return await failItem(itemId, "job not found");
  if (job.status === "cancelled") {
    return await failItem(itemId, "job cancelled");
  }

  const config = job.config as MassGenerationConfig;
  const userId = job.user_id as string;

  // 2. Marca generating
  await sb
    .from("mass_generation_items")
    .update({
      status: "generating",
      started_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  // 3. Brand context (igual processTrigger)
  const { brandContext, feedbackContext } = await loadBrandContextForUser(
    sb,
    userId
  );

  // 4. Refs viram extra context compartilhado
  const refsContext =
    config.refs.length > 0
      ? `REFERÊNCIAS DE VOZ/ÂNGULO (URLs do user — só inspiração, não copie literal):\n${config.refs
          .map((r) => `- ${r}`)
          .join("\n")}`
      : undefined;

  const editorialContext = config.editorialLine
    ? `LINHA EDITORIAL DO PROFILE: ${config.editorialLine}\n\nMantenha essa voz/ângulo.`
    : undefined;

  const extraContext = [editorialContext, refsContext]
    .filter(Boolean)
    .join("\n\n");

  // 5. Geração — força template 'twitter' (único estável em piloto auto hoje,
  //    mesma decisão do zernio-trigger-runner.ts:197).
  const designTemplate: DesignTemplateId = "twitter";
  let variation;
  try {
    const generation = await runGeneration({
      topic: typedItem.theme,
      sourceType: "idea",
      niche: config.niche || "marketing",
      tone: config.tone || "editorial",
      language: config.language || "pt-br",
      designTemplate,
      brandContext,
      feedbackContext,
      advanced: extraContext ? { extraContext } : undefined,
    });
    if (!generation.variations?.length) {
      return await failItem(itemId, "Generation devolveu 0 variations");
    }
    variation = generation.variations[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return await failItem(itemId, `gen: ${msg}`);
  }

  // 6. Persiste carousel
  let carouselId: string;
  try {
    const { row } = await upsertUserCarousel(sb, userId, {
      title: variation.title || typedItem.theme.slice(0, 60),
      slides: variation.slides,
      slideStyle: "white",
      variation: { title: variation.title, style: variation.style },
      status: "draft",
      designTemplate,
    });
    carouselId = row.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return await failItem(itemId, `carousel: ${msg}`);
  }

  // 7. Render + upload
  let mediaUrls: string[];
  try {
    mediaUrls = await renderAndUploadSlides({
      userId,
      carouselId,
      slides: variation.slides.slice(0, MAX_SLIDES_PER_POST),
      totalSlides: Math.min(variation.slides.length, MAX_SLIDES_PER_POST),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return await failItem(itemId, `render: ${msg}`);
  }

  // 7.5. Thumb: usa mediaUrls[0] (slide capa). Browser cuida do resize via CSS
  // na lista de carrosseis. Fire-and-forget — não atrapalha flow se falhar.
  if (mediaUrls.length > 0) {
    sb.from("carousels")
      .update({ thumbnail_url: mediaUrls[0] })
      .eq("id", carouselId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn("[mass-gen] thumb update falhou:", error.message);
      });
  }

  // 8. Schedule (se autoSchedule) ou draft
  let scheduledPostId: string | null = null;
  const targetPlatforms = (config.targetPlatforms || ["instagram", "linkedin"]).filter((p) =>
    ["instagram", "linkedin"].includes(p)
  );

  if (config.autoSchedule && typedItem.scheduled_at && targetPlatforms.length > 0) {
    // Resolve contas Zernio active
    const { data: accountRows } = await sb
      .from("zernio_accounts")
      .select("zernio_account_id, platform")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("platform", targetPlatforms);

    const platforms: ZernioPostPlatformTarget[] = (accountRows ?? []).map((a) => ({
      platform: a.platform as ZernioPlatform,
      accountId: a.zernio_account_id,
    }));

    const platformsForRecord: ZernioPostPlatformTarget[] =
      platforms.length > 0
        ? platforms
        : targetPlatforms.map((p) => ({
            platform: p as ZernioPlatform,
            accountId: "",
          }));

    const content = buildCaption(variation);
    const scheduledFor = typedItem.scheduled_at.slice(0, 19);

    let zernioPost: { _id: string } & Record<string, unknown> = {
      _id: `local-draft-${itemId}`,
    };

    // Se tem conta conectada, manda pro Zernio. Sem conta, salva local-draft.
    if (platforms.length > 0) {
      try {
        zernioPost = await createZernioPost({
          content,
          mediaUrls,
          timezone: config.timezone || "America/Sao_Paulo",
          scheduledFor,
          platforms,
        });
      } catch (err) {
        const msg =
          err instanceof ZernioApiError
            ? `Zernio ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        // Não fail o item — registra como local-draft pra user reagendar manualmente
        console.warn(`[mass-gen] Zernio falhou pro item ${itemId}: ${msg}. Caindo pra local-draft.`);
      }
    }

    const { data: profileRow } = await sb
      .from("zernio_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const isLocalDraft = zernioPost._id.startsWith("local-draft-");
    const { data: schedRow } = await sb
      .from("zernio_scheduled_posts")
      .insert({
        user_id: userId,
        profile_id: profileRow?.id ?? null,
        carousel_id: carouselId,
        zernio_post_id: isLocalDraft ? null : zernioPost._id,
        status: isLocalDraft ? "draft" : "scheduled",
        content,
        platforms: platformsForRecord,
        scheduled_for: scheduledFor,
        timezone: config.timezone || "America/Sao_Paulo",
        source: "mass-autopilot",
        raw: isLocalDraft
          ? { mode: "local-draft", media_urls: mediaUrls, batch_item: itemId }
          : { ...zernioPost, batch_item: itemId },
      })
      .select("id")
      .single();
    scheduledPostId = schedRow?.id ?? null;
  }

  // 9. Marca completed
  await sb
    .from("mass_generation_items")
    .update({
      status: "completed",
      carousel_id: carouselId,
      scheduled_post_id: scheduledPostId,
      finished_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  await bumpJobCounter(typedItem.job_id, "completed");

  // Self-trigger: pega próximo item pending fire-and-forget. Acelera batch
  // sem depender só do cron de 5min. Worker isolado falha sem travar nada.
  void triggerNextPending();

  return { ok: true, carouselId, scheduledPostId: scheduledPostId ?? undefined };
}

async function triggerNextPending(): Promise<void> {
  try {
    const sb = createServiceRoleSupabaseClient();
    if (!sb) return;
    const { data: next } = await sb
      .from("mass_generation_items")
      .select("id, job_id, mass_generation_jobs!inner(status)")
      .eq("status", "pending")
      .eq("mass_generation_jobs.status", "running")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      // Fire-and-forget. Roda em paralelo ao retorno desta função.
      void processMassGenerationItem(next.id as string).catch((err) => {
        console.warn("[mass-gen] self-trigger falhou:", err);
      });
    }
  } catch (err) {
    console.warn("[mass-gen] triggerNextPending erro:", err);
  }
}

async function failItem(itemId: string, error: string): Promise<ProcessItemResult> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return { ok: false, error };

  const { data: item } = await sb
    .from("mass_generation_items")
    .select("job_id")
    .eq("id", itemId)
    .single();

  await sb
    .from("mass_generation_items")
    .update({
      status: "failed",
      error: error.slice(0, 1000),
      finished_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (item?.job_id) await bumpJobCounter(item.job_id as string, "failed");

  return { ok: false, error };
}

async function bumpJobCounter(
  jobId: string,
  which: "completed" | "failed"
): Promise<void> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return;

  // Lê estado atual e incrementa atomically com WHERE on row.
  // Não temos RPC pra atomic increment; usar select+update é ok porque
  // 2 paralelos no mesmo job em counters diferentes (completed vs failed)
  // não conflitam. Race entre 2 paralelos no MESMO counter → no pior caso
  // perde 1, mas eventually consistent (worker próxima rodada conta certo).
  const { data: job } = await sb
    .from("mass_generation_jobs")
    .select("total_count, completed_count, failed_count, status")
    .eq("id", jobId)
    .single();
  if (!job) return;

  const updates: Record<string, unknown> = {};
  if (which === "completed") {
    updates.completed_count = job.completed_count + 1;
  } else {
    updates.failed_count = job.failed_count + 1;
  }

  // Job termina quando completed + failed === total
  const newCompleted =
    which === "completed" ? job.completed_count + 1 : job.completed_count;
  const newFailed =
    which === "failed" ? job.failed_count + 1 : job.failed_count;
  if (newCompleted + newFailed >= job.total_count && job.status === "running") {
    updates.status = newFailed === job.total_count ? "failed" : "completed";
    updates.finished_at = new Date().toISOString();
  }

  await sb.from("mass_generation_jobs").update(updates).eq("id", jobId);
}

/**
 * Pega N items pendentes de jobs running e processa em paralelo.
 * Usado pelo cron worker. NÃO trava — falhas individuais reportadas no item.
 */
export async function processPendingItems(
  options: {
    maxItems?: number;
    concurrency?: number;
  } = {}
): Promise<{ processed: number; failed: number }> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return { processed: 0, failed: 0 };

  const maxItems = options.maxItems ?? 6;
  const concurrency = options.concurrency ?? 2;

  // 1. Atomic-ish: pega items pendentes de jobs running, ordenados por
  //    job created_at (FIFO entre jobs) + item_index (ordem dentro do job).
  const { data: items } = await sb
    .from("mass_generation_items")
    .select("id, job_id, mass_generation_jobs!inner(status)")
    .eq("status", "pending")
    .eq("mass_generation_jobs.status", "running")
    .order("created_at", { ascending: true })
    .limit(maxItems);

  if (!items || items.length === 0) return { processed: 0, failed: 0 };

  // 2. Roda em batches de `concurrency`
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((it) => processMassGenerationItem(it.id as string))
    );
    for (const r of results) {
      if (r.ok) processed++;
      else failed++;
    }
  }

  return { processed, failed };
}
