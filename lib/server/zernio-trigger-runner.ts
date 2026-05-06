/**
 * Runner unificado de triggers do Piloto Auto.
 *
 * Entry point: `processTrigger({ trigger, firedBy, explicitTheme?, payload? })`.
 *
 * Pipeline (igual pros 3 tipos de trigger):
 *   1. Cria zernio_autopilot_runs (status=generating).
 *   2. Decide tema:
 *      - explicitTheme passado → usa
 *      - else → sorteia de trigger.themes
 *   3. Resolve contas active do user pra plataformas alvo (filtro IG/LI).
 *   4. Carrega brand context do user.
 *   5. runGeneration() → carrossel.
 *   6. upsertUserCarousel().
 *   7. Renderiza N PNGs server-side (next/og).
 *   8. Upload Storage → mediaUrls públicas.
 *   9. createZernioPost (mode=publishNow ou scheduled ou draft).
 *   10. Persiste zernio_scheduled_posts + atualiza run.
 *
 * Caller mete o `firedBy` apropriado:
 *   - "cron":    o cron schedule disparou
 *   - "rss":     RSS poller achou nova entrada
 *   - "webhook": fire endpoint chamado externamente
 *   - "manual":  user clicou "rodar agora" na UI
 */

import { createHash, randomBytes } from "node:crypto";
import { createServiceRoleSupabaseClient } from "./auth";
import { runGeneration, type Variation } from "./generate-carousel";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { loadBrandContextForUser } from "./brand-context";
import {
  createZernioPost,
  ZernioApiError,
  type ZernioPlatform,
  type ZernioPostPlatformTarget,
} from "./zernio";
import { renderSlideToPng, type RenderSlideOptions } from "./zernio-slide-renderer";
import type { DesignTemplateId } from "@/lib/carousel-templates";

const MAX_SLIDES_PER_POST = 10;

export interface Trigger {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  trigger_type: "schedule" | "rss" | "webhook";
  themes: string[];
  editorial_line: string;
  niche: string | null;
  tone: string;
  language: string;
  design_template: string;
  target_platforms: string[];
  publish_mode: "scheduled" | "draft" | "publish_now";
  // schedule
  cadence_type: "daily" | "every_n_days" | "weekly_dow" | "specific_dates" | null;
  interval_days: number | null;
  days_of_week: number[] | null;
  specific_dates: string[] | null;
  publish_hour: number;
  publish_minute: number;
  timezone: string;
  next_run_at: string | null;
  // rss
  rss_url: string | null;
  rss_check_interval_minutes: number;
  rss_last_checked_at: string | null;
  rss_processed_guids: string[];
  rss_max_items_per_check: number;
  // webhook
  webhook_secret: string | null;
}

export interface ProcessTriggerInput {
  trigger: Trigger;
  firedBy: "cron" | "rss" | "webhook" | "manual";
  /** Quando RSS ou webhook traz tema explícito. */
  explicitTheme?: string;
  /** JSONB salvo em runs.trigger_payload (ex: rss item, webhook body). */
  payload?: Record<string, unknown> | null;
}

export interface ProcessTriggerResult {
  status: "scheduled" | "no_accounts" | "no_platforms" | "gen_failed" | "render_failed" | "carousel_failed" | "zernio_failed" | "skipped" | "fatal";
  detail?: string;
  runId?: string;
}

/**
 * Roda o pipeline completo do trigger. NÃO atualiza next_run_at de schedules
 * — quem dispara (cron) cuida disso. Webhook/RSS não usam next_run_at.
 */
export async function processTrigger(
  input: ProcessTriggerInput
): Promise<ProcessTriggerResult> {
  const { trigger, firedBy, explicitTheme, payload } = input;
  const sb = createServiceRoleSupabaseClient();
  if (!sb) throw new Error("DB indisponível");

  // 1. Cria run
  const { data: runRow, error: runErr } = await sb
    .from("zernio_autopilot_runs")
    .insert({
      trigger_id: trigger.id,
      user_id: trigger.user_id,
      fired_by: firedBy,
      trigger_payload: payload ?? null,
      status: "generating",
    })
    .select("id")
    .single();
  if (runErr) throw new Error(`run insert: ${runErr.message}`);
  const runId = runRow.id;

  // 2. Tema
  const theme =
    explicitTheme && explicitTheme.length > 0
      ? explicitTheme
      : trigger.themes.length > 0
        ? trigger.themes[Math.floor(Math.random() * trigger.themes.length)]
        : null;

  if (!theme) {
    await markRunFailed(runId, trigger.id, "Sem tema (explícito ou pool vazia).");
    return { status: "fatal", detail: "no_theme", runId };
  }

  await sb
    .from("zernio_autopilot_runs")
    .update({ theme_chosen: theme })
    .eq("id", runId);

  // 3. Resolve contas active das plataformas alvo (1 por plataforma graças
  //    à UNIQUE partial index).
  const targetPlatforms = trigger.target_platforms.filter((p) =>
    ["instagram", "linkedin"].includes(p)
  );
  if (targetPlatforms.length === 0) {
    await markRunFailed(runId, trigger.id, "Trigger sem plataformas alvo válidas.");
    return { status: "no_platforms", runId };
  }

  const isDraftMode = trigger.publish_mode === "draft";

  const { data: accountRows } = await sb
    .from("zernio_accounts")
    .select("zernio_account_id, platform, status, raw")
    .eq("user_id", trigger.user_id)
    .eq("status", "active")
    .in("platform", targetPlatforms);

  const platforms: ZernioPostPlatformTarget[] = (accountRows ?? []).map((a) => ({
    platform: a.platform as ZernioPlatform,
    accountId: a.zernio_account_id,
  }));

  // RASCUNHO não precisa de conta Zernio conectada — só salva carrossel +
  // entry no scheduled_posts pra user revisar na timeline. Quando user
  // promover pra "scheduled", aí valida conta. Bug fix 2026-05-06: trigger
  // RSS em modo draft estava falhando "Sem contas active" mesmo só gerando
  // rascunho. Regra do produto: Pro/Free pode planejar/rascunhar sem Zernio,
  // só Max em auto-publish (publish_now/scheduled) precisa de conta.
  if (platforms.length === 0 && !isDraftMode) {
    await markRunFailed(
      runId,
      trigger.id,
      `Sem contas active nas plataformas alvo (${targetPlatforms.join(", ")}). Conecte na tela inicial ou troque o trigger pra modo "Salvar rascunho".`
    );
    return { status: "no_accounts", runId };
  }

  // Em draft sem conta conectada, ainda precisamos das plataformas alvo
  // declarativas pro registro do scheduled_post (mesmo sem accountId real).
  // Usamos um placeholder pra rastreabilidade — quando user conectar e
  // promover, o accountId real entra no momento do agendamento.
  const platformsForRecord: ZernioPostPlatformTarget[] =
    platforms.length > 0
      ? platforms
      : targetPlatforms.map((p) => ({
          platform: p as ZernioPlatform,
          accountId: "",
        }));

  // 4. Brand context
  const { brandContext, feedbackContext } = await loadBrandContextForUser(
    sb,
    trigger.user_id
  );

  // 5. Geração
  const editorialAsContext = trigger.editorial_line
    ? `LINHA EDITORIAL DO PROFILE: ${trigger.editorial_line}\n\nMantenha essa voz/ângulo em todos os slides.`
    : undefined;

  // 2026-05-06: piloto auto SEMPRE usa template "twitter".
  // Os outros templates (manifesto/futurista/autoral) ainda não estão
  // prontos pra renderização sem revisão humana — twitter é o único
  // que funciona ponta a ponta sem edição. Forçar aqui evita gerar
  // carrossel quebrado se o banco tiver design_template legado.
  const generation = await runGeneration({
    topic: theme,
    sourceType: "idea",
    niche: trigger.niche || "marketing",
    tone: trigger.tone,
    language: trigger.language,
    designTemplate: "twitter" as DesignTemplateId,
    brandContext,
    feedbackContext,
    advanced: { extraContext: editorialAsContext },
  });

  if (!generation.variations?.length) {
    await markRunFailed(runId, trigger.id, "Generation devolveu 0 variations.");
    return { status: "gen_failed", runId };
  }
  const variation = generation.variations[0];

  // 6. Persiste carousel
  let carouselId: string;
  try {
    const { row } = await upsertUserCarousel(sb, trigger.user_id, {
      title: variation.title || theme.slice(0, 60),
      slides: variation.slides,
      slideStyle: "white",
      variation: { title: variation.title, style: variation.style },
      status: "draft",
      designTemplate: "twitter" as DesignTemplateId,
    });
    carouselId = row.id;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await markRunFailed(runId, trigger.id, `carousel insert: ${detail}`);
    return { status: "carousel_failed", detail, runId };
  }

  await sb
    .from("zernio_autopilot_runs")
    .update({ carousel_id: carouselId })
    .eq("id", runId);

  // 7. Renderiza + upload slides
  let mediaUrls: string[];
  try {
    mediaUrls = await renderAndUploadSlides({
      userId: trigger.user_id,
      carouselId,
      slides: variation.slides.slice(0, MAX_SLIDES_PER_POST),
      totalSlides: Math.min(variation.slides.length, MAX_SLIDES_PER_POST),
      profileName: trigger.name,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await markRunFailed(runId, trigger.id, `render/upload: ${detail}`);
    return { status: "render_failed", detail, runId };
  }

  // 8. Caption + agendamento
  const content = buildCaption(variation);
  const isPublishNow =
    trigger.publish_mode === "publish_now" || firedBy === "webhook";
  const isDraft = trigger.publish_mode === "draft";

  let scheduledFor: string | undefined;
  if (!isPublishNow && !isDraft) {
    // Schedule: usa next_run_at do trigger se disponível; senão, +1h.
    scheduledFor = trigger.next_run_at
      ? trigger.next_run_at.slice(0, 19)
      : new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19);
  }

  // DRAFT mode: não chama Zernio API. Só persiste local com status=draft
  // pra user revisar / promover depois. Não precisa de conta Zernio.
  let zernioPost: { _id: string } & Record<string, unknown> = {
    _id: `local-draft-${runId}`,
  };
  if (!isDraft) {
    try {
      zernioPost = await createZernioPost({
        content,
        mediaUrls,
        timezone: trigger.timezone,
        scheduledFor,
        publishNow: isPublishNow ? true : undefined,
        platforms,
      });
    } catch (err) {
      const detail =
        err instanceof ZernioApiError
          ? `Zernio ${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      await markRunFailed(runId, trigger.id, detail);
      return { status: "zernio_failed", detail, runId };
    }
  }

  // 9. Persiste scheduled_post. Em modo draft, zernio_post_id fica null
  // (a coluna aceita null). raw guarda info útil pro debug.
  const { data: schedRow } = await sb
    .from("zernio_scheduled_posts")
    .insert({
      user_id: trigger.user_id,
      // profile_id: pega o profile do user (auto-criado). Buscamos rapidamente.
      profile_id: await resolveProfileId(trigger.user_id),
      carousel_id: carouselId,
      zernio_post_id: isDraft ? null : zernioPost._id,
      status: isDraft ? "draft" : isPublishNow ? "publishing" : "scheduled",
      content,
      platforms: platformsForRecord,
      scheduled_for: !isPublishNow && !isDraft ? scheduledFor : null,
      timezone: trigger.timezone,
      source: "autopilot",
      raw: isDraft ? { mode: "local-draft", media_urls: mediaUrls } : zernioPost,
    })
    .select("id")
    .single();

  await sb
    .from("zernio_autopilot_runs")
    .update({
      status: "scheduled",
      scheduled_post_id: schedRow?.id ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  await sb
    .from("zernio_autopilot_triggers")
    .update({
      last_fired_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", trigger.id);

  return { status: "scheduled", runId };
}

async function resolveProfileId(userId: string): Promise<string | null> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return null;
  const { data } = await sb
    .from("zernio_profiles")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function markRunFailed(
  runId: string,
  triggerId: string,
  error: string
): Promise<void> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return;
  await sb
    .from("zernio_autopilot_runs")
    .update({
      status: "failed",
      error: error.slice(0, 500),
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  await sb
    .from("zernio_autopilot_triggers")
    .update({
      last_error: error.slice(0, 500),
      last_fired_at: new Date().toISOString(),
    })
    .eq("id", triggerId);
}

function buildCaption(variation: Variation): string {
  const slide1 = variation.slides[0];
  const heading = (slide1?.heading || variation.title || "").trim();
  const body = (slide1?.body || "").trim();
  const lead = heading && body ? `${heading}\n\n${body}` : heading || body;

  let extra = "";
  if (lead.length < 800 && variation.slides.length > 1) {
    const middle = variation.slides
      .slice(1, 4)
      .map((s) => (s.heading || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (middle.length > 0) extra = `\n\n— ${middle.join(" · ")}`;
  }
  const full = `${lead}${extra}`.trim();
  if (full.length <= 2000) return full;
  return full.slice(0, 1997) + "...";
}

interface RenderSlidesArgs {
  userId: string;
  carouselId: string;
  slides: Variation["slides"];
  totalSlides: number;
  profileName?: string;
}

async function renderAndUploadSlides(args: RenderSlidesArgs): Promise<string[]> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) throw new Error("DB indisponível");

  const BUCKET = "carousel-images";
  const PREFIX = `zernio-autopilot/${args.userId}/${args.carouselId}`;

  // randomBytes pra invalidação simples se mesmo carrossel for re-rendered.
  // Nome final = slide-NN-{contentHash}.png pra dedupe entre runs idênticos.
  void randomBytes; // (mantido pra futuro se precisar nonce)

  const urls: string[] = [];
  for (let i = 0; i < args.slides.length; i++) {
    const slide = args.slides[i];
    const slideNumber = i + 1;
    const renderOpts: RenderSlideOptions = {
      heading: (slide.heading || "").trim().slice(0, 240) || `Slide ${slideNumber}`,
      body: (slide.body || "").trim().slice(0, 600),
      imageUrl: slide.imageUrl || null,
      slideNumber,
      totalSlides: args.totalSlides,
      variant: mapVariantForRenderer(slide.variant, slideNumber, args.totalSlides),
      profileName: args.profileName,
    };

    const response = renderSlideToPng(renderOpts);
    const pngBuffer = await response.arrayBuffer();

    const hash = createHash("sha256")
      .update(new Uint8Array(pngBuffer))
      .digest("hex")
      .slice(0, 12);
    const path = `${PREFIX}/slide-${String(slideNumber).padStart(2, "0")}-${hash}.png`;

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
      throw new Error(`upload slide ${slideNumber}: ${upErr.message}`);
    }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) {
      throw new Error(`publicUrl indisponível pro slide ${slideNumber}`);
    }
    urls.push(pub.publicUrl);
  }
  return urls;
}

function mapVariantForRenderer(
  generated: string | undefined,
  slideNumber: number,
  totalSlides: number
): RenderSlideOptions["variant"] {
  if (slideNumber === 1) return "cover";
  if (slideNumber === totalSlides) return "cta";
  if (generated === "full-photo-bottom") return "full-photo-bottom";
  if (generated === "text-only") return "text-only";
  return "headline";
}
