/**
 * GET /api/cron/zernio-autopilot
 *
 * Cron a cada 30min (Vercel) que dispara recipes ativos do Piloto Auto.
 *
 * Pipeline pra cada recipe vencido (next_run_at <= NOW + buffer):
 *   1. Cria/upserta zernio_autopilot_runs (recipe_id, run_date) — UNIQUE
 *      garante idempotência se o cron rodar 2x no mesmo dia.
 *   2. Sorteia 1 tema da pool `themes[]`.
 *   3. Chama `runGeneration(...)` com tema + editorial_line como
 *      extraContext pra criar o carrossel.
 *   4. Persiste o carousel em `carousels` via upsertUserCarousel.
 *   5. RENDERIZA cada slide como PNG server-side via next/og.
 *   6. Sobe os PNGs no bucket `carousel-images` → URLs públicas.
 *   7. Cria post no Zernio com mediaUrls — IG/LinkedIn aceitam carrossel
 *      de até 10 imagens.
 *   8. Atualiza recipe.next_run_at = computeNextRunAt(...).
 *
 * Plataformas suportadas: instagram, linkedin (escopo definido pelo user).
 * Outras platforms são silenciosamente filtradas pra evitar enviar carrossel
 * pra rede que não suporta o formato.
 *
 * Failure mode: erro num recipe NÃO bloqueia os outros — log + run.error +
 * pula próximo. Recipe.last_error fica visível na UI.
 */

import { createHash } from "node:crypto";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { runGeneration, type Variation } from "@/lib/server/generate-carousel";
import { upsertUserCarousel } from "@/lib/carousel-storage";
import { loadBrandContextForUser } from "@/lib/server/brand-context";
import {
  createZernioPost,
  ZernioApiError,
  type ZernioPlatform,
  type ZernioPostPlatformTarget,
} from "@/lib/server/zernio";
import { computeNextRunAt } from "@/app/api/zernio/autopilot/recipes/route";
import type { DesignTemplateId } from "@/lib/carousel-templates";
import {
  renderSlideToPng,
  type RenderSlideOptions,
} from "@/lib/server/zernio-slide-renderer";

/** Carrossel de IG aceita 2-10 mídias; LinkedIn aceita até ~9. Cap em 10. */
const MAX_SLIDES_PER_POST = 10;

/** Plataformas que aceitam carrossel-com-imagens via Zernio. */
const CAROUSEL_PLATFORMS = new Set<ZernioPlatform>(["instagram", "linkedin"]);

export const runtime = "nodejs";
export const maxDuration = 300; // 5min — geração + Zernio podem somar

export interface Recipe {
  id: string;
  user_id: string;
  profile_id: string;
  name: string;
  is_active: boolean;
  themes: string[];
  editorial_line: string;
  niche: string | null;
  tone: string;
  language: string;
  design_template: string;
  cadence_type: "daily" | "every_n_days" | "weekly_dow" | "specific_dates";
  interval_days: number | null;
  days_of_week: number[] | null;
  specific_dates: string[] | null;
  publish_hour: number;
  publish_minute: number;
  timezone: string;
  target_account_ids: string[];
  publish_mode: "scheduled" | "draft";
  next_run_at: string | null;
}

// Lookahead window: disparar recipes cujo next_run_at é nas próximas 24h.
// Vercel Hobby permite só cron diário, então o cron roda 1x e processa
// TODOS os recipes do dia inteiro de uma vez. O scheduledFor que vai pro
// Zernio é o horário correto (lido de next_run_at), então Zernio publica
// no minuto certo mesmo com cron de madrugada.
//
// Se um dia subir pra Pro e voltar a cron */30min, dá pra reduzir esse buffer
// de volta pra 10min sem mudança de lógica.
const TRIGGER_BUFFER_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const nowIso = new Date(Date.now() + TRIGGER_BUFFER_MS).toISOString();
  const { data: recipes, error } = await sb
    .from("zernio_autopilot_recipes")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", nowIso)
    .limit(50);

  if (error) {
    console.error("[zernio-autopilot] query err:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results: { recipeId: string; status: string; detail?: string }[] = [];
  for (const recipe of (recipes as Recipe[]) ?? []) {
    try {
      const r = await processRecipe(recipe);
      results.push({ recipeId: recipe.id, status: r.status, detail: r.detail });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[zernio-autopilot] recipe ${recipe.id} FAIL:`, err);
      results.push({ recipeId: recipe.id, status: "fatal", detail });
      // Marca last_error mas não desativa — admin decide.
      await sb
        .from("zernio_autopilot_recipes")
        .update({ last_error: detail.slice(0, 500), last_run_at: new Date().toISOString() })
        .eq("id", recipe.id);
      // Notifica Discord — fatal NO try/catch externo significa que o
      // pipeline quebrou ANTES do markRunFailed dentro de processRecipe
      // (ex: erro lendo brand_analysis, erro no upsert do run row, etc).
      // Esses casos não têm run row, então notificamos direto.
      await notifyDiscordOnce(recipe, detail);
    }
  }

  return Response.json({
    ok: true,
    processed: results.length,
    results,
    checkedAt: new Date().toISOString(),
  });
}

export async function processRecipe(
  recipe: Recipe
): Promise<{ status: string; detail?: string }> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) throw new Error("DB indisponível");

  const today = new Date();
  const runDate = today.toISOString().slice(0, 10);

  // 1. Cria/upserta run (idempotência via UNIQUE recipe_id+run_date)
  const { data: runRow, error: runErr } = await sb
    .from("zernio_autopilot_runs")
    .upsert(
      {
        recipe_id: recipe.id,
        user_id: recipe.user_id,
        run_date: runDate,
        status: "generating",
      },
      { onConflict: "recipe_id,run_date" }
    )
    .select("*")
    .single();
  if (runErr) throw new Error(`run upsert: ${runErr.message}`);
  if (!runRow) throw new Error("run row null");

  // Se já está scheduled, pula (cron rodou 2x no mesmo dia)
  if (runRow.status === "scheduled") {
    return { status: "skipped", detail: "já scheduled hoje" };
  }

  // 2. Sorteia tema
  const theme = recipe.themes[Math.floor(Math.random() * recipe.themes.length)];
  await sb
    .from("zernio_autopilot_runs")
    .update({ theme_chosen: theme })
    .eq("id", runRow.id);

  // 3. Resolve contas target → mapeia pra platform+accountId externo
  const { data: accountRows, error: aErr } = await sb
    .from("zernio_accounts")
    .select("id, zernio_account_id, platform, status")
    .eq("user_id", recipe.user_id)
    .eq("profile_id", recipe.profile_id)
    .in("zernio_account_id", recipe.target_account_ids);
  if (aErr) throw new Error(`accounts: ${aErr.message}`);
  const validAccounts = (accountRows ?? []).filter((a) => a.status === "active");
  if (validAccounts.length === 0) {
    await markRunFailed(recipe, runRow.id, "Nenhuma conta active no profile.");
    return { status: "no_accounts" };
  }

  // 4. Carrega brand context do owner do recipe (voice DNA + content pillars
  // + memory rules) pra carrossel autopilot soar igual aos manuais. Sem isso
  // a geração ficava genérica.
  const { brandContext, feedbackContext } = await loadBrandContextForUser(
    sb,
    recipe.user_id
  );

  const editorialAsContext = recipe.editorial_line
    ? `LINHA EDITORIAL DO PROFILE: ${recipe.editorial_line}\n\nMantenha essa voz/ângulo em todos os slides.`
    : undefined;

  const generation = await runGeneration({
    topic: theme,
    sourceType: "idea",
    niche: recipe.niche || "marketing",
    tone: recipe.tone,
    language: recipe.language,
    designTemplate: recipe.design_template as DesignTemplateId,
    brandContext,
    feedbackContext,
    advanced: {
      extraContext: editorialAsContext,
    },
  });

  if (!generation.variations?.length) {
    await markRunFailed(recipe, runRow.id, "Generation devolveu 0 variations.");
    return { status: "gen_failed" };
  }

  const variation = generation.variations[0];

  // 5. Persiste carousel via helper canonical (mantém shape consistente
  //    com carrosseis criados pelo path manual /api/generate).
  let carouselId: string;
  try {
    const { row } = await upsertUserCarousel(sb, recipe.user_id, {
      title: variation.title || theme.slice(0, 60),
      slides: variation.slides,
      slideStyle: "white",
      variation: { title: variation.title, style: variation.style },
      status: "draft",
      designTemplate: recipe.design_template as DesignTemplateId,
    });
    carouselId = row.id;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await markRunFailed(recipe, runRow.id, `carousel insert: ${detail}`);
    return { status: "carousel_failed", detail };
  }

  await sb
    .from("zernio_autopilot_runs")
    .update({ carousel_id: carouselId })
    .eq("id", runRow.id);

  // 6. Filtra contas pra IG/LinkedIn (carrossel de mídia). Outras plataformas
  // são silenciosamente ignoradas — admin que quiser Twitter/Bluesky/etc usa
  // agendamento manual no preview do carrossel.
  const platforms: ZernioPostPlatformTarget[] = validAccounts
    .filter((a) => CAROUSEL_PLATFORMS.has(a.platform as ZernioPlatform))
    .map((a) => ({
      platform: a.platform as ZernioPlatform,
      accountId: a.zernio_account_id,
    }));

  if (platforms.length === 0) {
    await markRunFailed(
      recipe,
      runRow.id,
      "Recipe não tem conta IG/LinkedIn ativa. Conecte uma e tente de novo."
    );
    return { status: "no_carousel_accounts" };
  }

  // 7. Renderiza slides como PNG server-side via next/og + sobe pro Storage.
  // Cap em 10 slides (limite IG carrossel; LinkedIn aceita até ~9).
  const profileNameForFooter = await getProfileNameById(recipe.profile_id, recipe.user_id);
  const renderableSlides = variation.slides.slice(0, MAX_SLIDES_PER_POST);

  let mediaUrls: string[];
  try {
    mediaUrls = await renderAndUploadSlides({
      userId: recipe.user_id,
      carouselId,
      slides: renderableSlides,
      totalSlides: renderableSlides.length,
      profileName: profileNameForFooter,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await markRunFailed(recipe, runRow.id, `render/upload: ${detail}`);
    return { status: "render_failed", detail };
  }

  if (mediaUrls.length === 0) {
    await markRunFailed(recipe, runRow.id, "Nenhuma imagem subida — render vazio.");
    return { status: "no_media" };
  }

  // 8. Caption: usa heading + body do slide 1 como copy, com trim pra 2200
  // (limite IG). LinkedIn aceita ~3000.
  const content = buildCaption(variation);

  const scheduledFor = recipe.next_run_at
    ? recipe.next_run_at.slice(0, 19) // ISO sem TZ
    : new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19);

  let zernioPost;
  try {
    zernioPost = await createZernioPost({
      content,
      mediaUrls,
      timezone: recipe.publish_mode === "draft" ? undefined : recipe.timezone,
      scheduledFor: recipe.publish_mode === "draft" ? undefined : scheduledFor,
      platforms,
    });
  } catch (err) {
    const detail =
      err instanceof ZernioApiError
        ? `Zernio ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    await markRunFailed(recipe, runRow.id, detail);
    return { status: "zernio_failed", detail };
  }

  // 7. Persiste scheduled_post local
  const { data: schedRow } = await sb
    .from("zernio_scheduled_posts")
    .insert({
      user_id: recipe.user_id,
      profile_id: recipe.profile_id,
      carousel_id: carouselId,
      zernio_post_id: zernioPost._id,
      status: recipe.publish_mode === "draft" ? "draft" : "scheduled",
      content,
      platforms,
      scheduled_for: recipe.publish_mode === "draft" ? null : scheduledFor,
      timezone: recipe.timezone,
      source: "autopilot",
      autopilot_run_id: runRow.id,
      raw: zernioPost,
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
    .eq("id", runRow.id);

  // 8. Avança next_run_at do recipe
  const nextRun = computeNextRunAt({
    cadenceType: recipe.cadence_type,
    intervalDays: recipe.interval_days,
    daysOfWeek: recipe.days_of_week,
    specificDates: recipe.specific_dates,
    publishHour: recipe.publish_hour,
    publishMinute: recipe.publish_minute,
    timezone: recipe.timezone,
    fromDate: new Date(),
  });
  await sb
    .from("zernio_autopilot_recipes")
    .update({
      last_run_at: new Date().toISOString(),
      last_error: null,
      next_run_at: nextRun.toISOString(),
    })
    .eq("id", recipe.id);

  return { status: "scheduled" };
}

/**
 * Caption pra IG/LinkedIn — usa heading + body do slide 1 como copy,
 * concatenado com 1-2 frases dos slides do meio pra contexto. Cap em 2000
 * pra ficar dentro dos limites das duas plataformas (IG: 2200, LI: ~3000).
 */
function buildCaption(variation: Variation): string {
  const slide1 = variation.slides[0];
  const heading = (slide1?.heading || variation.title || "").trim();
  const body = (slide1?.body || "").trim();
  const lead = heading && body ? `${heading}\n\n${body}` : heading || body;

  // Linha-resumo do meio do carrossel (slides 2-4) pra dar contexto extra
  // sem repetir tudo. Pula se o lead já está grande.
  let extra = "";
  if (lead.length < 800 && variation.slides.length > 1) {
    const middle = variation.slides
      .slice(1, 4)
      .map((s) => (s.heading || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (middle.length > 0) {
      extra = `\n\n— ${middle.join(" · ")}`;
    }
  }

  const full = `${lead}${extra}`.trim();
  if (full.length <= 2000) return full;
  return full.slice(0, 1997) + "...";
}

/**
 * Renderiza cada slide como PNG via next/og e sobe pro bucket
 * `carousel-images` em paths previsíveis. Devolve URLs públicas na ordem
 * dos slides (mediaUrls do Zernio respeita ordem).
 */
async function renderAndUploadSlides(args: {
  userId: string;
  carouselId: string;
  slides: Variation["slides"];
  totalSlides: number;
  profileName?: string;
}): Promise<string[]> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) throw new Error("DB indisponível pro upload");

  const BUCKET = "carousel-images";
  const PREFIX = `zernio-autopilot/${args.userId}/${args.carouselId}`;

  const urls: string[] = [];
  // Sequencial — next/og em paralelo é pesado e Vercel pode cap memória.
  // 10 slides × ~1s render = ~10s, dentro do maxDuration=300.
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

    let pngBuffer: ArrayBuffer;
    try {
      const response = renderSlideToPng(renderOpts);
      pngBuffer = await response.arrayBuffer();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`render slide ${slideNumber}: ${detail}`);
    }

    // Hash determinístico do conteúdo pra path estável (rerruns sobrescrevem).
    const hash = createHash("sha256")
      .update(new Uint8Array(pngBuffer))
      .digest("hex")
      .slice(0, 12);
    const path = `${PREFIX}/slide-${String(slideNumber).padStart(2, "0")}-${hash}.png`;

    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(pngBuffer), {
        contentType: "image/png",
        upsert: true,
        cacheControl: "31536000",
      });
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

async function getProfileNameById(
  profileId: string,
  userId: string
): Promise<string | undefined> {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return undefined;
  const { data } = await sb
    .from("zernio_profiles")
    .select("name")
    .eq("id", profileId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.name;
}

async function markRunFailed(recipe: Recipe, runId: string, error: string) {
  const sb = createServiceRoleSupabaseClient();
  if (!sb) return;
  await sb
    .from("zernio_autopilot_runs")
    .update({ status: "failed", error: error.slice(0, 500), finished_at: new Date().toISOString() })
    .eq("id", runId);
  await sb
    .from("zernio_autopilot_recipes")
    .update({ last_error: error.slice(0, 500), last_run_at: new Date().toISOString() })
    .eq("id", recipe.id);

  // Discord alert — best-effort, não bloqueia. Reusa DISCORD_WEBHOOK_URL do
  // healthcheck (já configurado em prod). Cap 1 alerta por recipe por dia
  // pra evitar floodar canal quando o mesmo recipe quebra repetidamente
  // (idempotência via run_date — se já notificamos hoje, skip).
  await notifyDiscordOnce(recipe, error);
}

/**
 * Manda 1 mensagem Discord por recipe-quebrado-por-dia. Idempotência leve:
 * usa zernio_autopilot_runs (recipe_id + run_date + status=failed) — se já
 * tem 1 run failed hoje pra esse recipe, presumimos que já notificamos.
 *
 * No-op se DISCORD_WEBHOOK_URL não setado (dev local).
 */
async function notifyDiscordOnce(recipe: Recipe, error: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return;

  const today = new Date().toISOString().slice(0, 10);
  // Conta runs failed do recipe hoje. Esse mesmo run que acabou de ser marcado
  // como failed conta — count >= 2 significa "já existia outro failed antes",
  // então pulamos. count == 1 = é o primeiro do dia, notificamos.
  const { count } = await sb
    .from("zernio_autopilot_runs")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", recipe.id)
    .eq("run_date", today)
    .eq("status", "failed");

  if ((count ?? 0) > 1) return; // já notificamos hoje

  const content = [
    `**Sequência Viral · Zernio Autopilot quebrou** 🤖`,
    `Recipe: \`${recipe.name}\` (${recipe.id.slice(0, 8)})`,
    `Profile: \`${recipe.profile_id.slice(0, 8)}\``,
    `Erro: \`\`\`${error.slice(0, 800)}\`\`\``,
    `Painel: <https://viral.kaleidos.com.br/app/admin/zernio/autopilot>`,
  ].join("\n");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("[zernio-autopilot] Discord notify falhou:", err);
  }
}
