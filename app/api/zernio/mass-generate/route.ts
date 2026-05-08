/**
 * POST /api/zernio/mass-generate
 *   Cria 1 mass_generation_job + N mass_generation_items.
 *   Se config.themesMode='auto-suggest', chama suggestThemes() pra preencher.
 *   Se config.autoSchedule, calcula scheduled_at via computeScheduleSpread().
 *
 * GET  /api/zernio/mass-generate
 *   Lista jobs do user (recent first, limit 20).
 */

import { NextResponse, after } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import { suggestThemes } from "@/lib/server/mass-generation/theme-suggester";
import { computeScheduleSpread } from "@/lib/server/mass-generation/scheduler";
import {
  MAX_BATCH_SIZE,
  type MassGenerationConfig,
  type Cadence,
} from "@/lib/server/mass-generation/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CreateJobBody {
  totalCount?: number;
  themesMode?: "explicit" | "auto-suggest";
  themes?: string[];
  refs?: string[];
  autoSchedule?: boolean;
  cadence?: Cadence;
  intervalDays?: number;
  publishHour?: number;
  publishMinute?: number;
  timezone?: string;
  designTemplate?: "twitter" | "manifesto";
  editorialLine?: string;
  niche?: string;
  tone?: string;
  language?: string;
  targetPlatforms?: ("instagram" | "linkedin")[];
}

const URL_PATTERN = /^https?:\/\/(www\.)?(instagram|twitter|x|threads|tiktok|linkedin)\.com\//i;

export async function GET(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return NextResponse.json({ error: "DB indisponível." }, { status: 503 });

  const { data, error } = await sb
    .from("mass_generation_jobs_with_progress")
    .select(
      "id, status, total_count, completed_count, failed_count, progress_pct, config, error, created_at, started_at, finished_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "mass-generate-create", user.id),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Você criou muitos jobs em sequência. Aguarde 1h." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const totalCount = Math.floor(body.totalCount ?? 0);
  if (totalCount < 1 || totalCount > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `totalCount deve estar entre 1 e ${MAX_BATCH_SIZE}.` },
      { status: 400 }
    );
  }

  const themesMode = body.themesMode === "auto-suggest" ? "auto-suggest" : "explicit";
  const themesInput = (body.themes ?? [])
    .map((t) => (t || "").trim())
    .filter((t) => t.length >= 3 && t.length <= 200);

  if (themesMode === "explicit" && themesInput.length === 0) {
    return NextResponse.json(
      { error: "Adicione pelo menos 1 tema ou marque 'IA escolhe' pra geração automática." },
      { status: 400 }
    );
  }

  // Refs precisam ser URLs válidas
  const refs = (body.refs ?? [])
    .map((r) => (r || "").trim())
    .filter((r) => r.length > 0 && URL_PATTERN.test(r))
    .slice(0, 10);

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return NextResponse.json({ error: "DB indisponível." }, { status: 503 });

  // Verifica cap mensal: usage_count + totalCount não pode exceder usage_limit
  const { data: prof } = await sb
    .from("profiles")
    .select("usage_count, usage_limit, plan")
    .eq("id", user.id)
    .single();

  if (prof) {
    const remaining = (prof.usage_limit ?? 0) - (prof.usage_count ?? 0);
    if (totalCount > remaining) {
      return NextResponse.json(
        {
          error: `Você tem ${remaining} carrosseis restantes no plano ${prof.plan}. Reduza a quantidade ou faça upgrade.`,
          remaining,
          plan: prof.plan,
        },
        { status: 402 }
      );
    }
  }

  // Resolve themes (auto-suggest se necessário)
  let resolvedThemes: string[];
  if (themesMode === "auto-suggest") {
    try {
      resolvedThemes = await suggestThemes(sb, user.id, totalCount);
    } catch (err) {
      console.warn("[mass-generate] suggestThemes falhou:", err);
      return NextResponse.json(
        { error: "Não foi possível sugerir temas automaticamente. Tente novamente ou adicione manualmente." },
        { status: 502 }
      );
    }
  } else {
    // Modo explicit: se temas < total, repete o último até completar
    resolvedThemes = themesInput.slice(0, totalCount);
    while (resolvedThemes.length < totalCount) {
      resolvedThemes.push(themesInput[resolvedThemes.length % themesInput.length]);
    }
  }

  // Config final
  const config: MassGenerationConfig = {
    themesMode,
    themes: resolvedThemes,
    refs,
    autoSchedule: Boolean(body.autoSchedule),
    cadence: body.cadence ?? "daily",
    intervalDays: body.intervalDays,
    publishHour: clampInt(body.publishHour, 0, 23, 9),
    publishMinute: clampInt(body.publishMinute, 0, 59, 0),
    timezone: body.timezone || "America/Sao_Paulo",
    designTemplate: body.designTemplate === "manifesto" ? "manifesto" : "twitter",
    editorialLine: body.editorialLine?.slice(0, 1500),
    niche: body.niche?.slice(0, 60),
    tone: body.tone?.slice(0, 60),
    language: body.language?.slice(0, 12) || "pt-br",
    targetPlatforms: (body.targetPlatforms ?? ["instagram", "linkedin"]).filter((p) =>
      ["instagram", "linkedin"].includes(p)
    ) as ("instagram" | "linkedin")[],
  };

  // Calcula spread se autoSchedule
  let scheduleDates: Date[] = [];
  if (config.autoSchedule) {
    scheduleDates = computeScheduleSpread({
      count: totalCount,
      cadence: config.cadence,
      intervalDays: config.intervalDays,
      publishHour: config.publishHour,
      publishMinute: config.publishMinute,
      timezone: config.timezone,
    });
  }

  // Cria job
  const { data: jobRow, error: jobErr } = await sb
    .from("mass_generation_jobs")
    .insert({
      user_id: user.id,
      status: "running", // já vai pro running pra worker pegar
      total_count: totalCount,
      config,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    return NextResponse.json(
      { error: jobErr?.message ?? "Falha ao criar job." },
      { status: 500 }
    );
  }

  // Cria items
  const itemRows = resolvedThemes.map((theme, idx) => ({
    job_id: jobRow.id,
    user_id: user.id,
    item_index: idx,
    theme,
    status: "pending" as const,
    scheduled_at: config.autoSchedule ? scheduleDates[idx]?.toISOString() ?? null : null,
  }));

  const { error: itemsErr } = await sb.from("mass_generation_items").insert(itemRows);
  if (itemsErr) {
    // Rollback do job
    await sb.from("mass_generation_jobs").delete().eq("id", jobRow.id);
    return NextResponse.json(
      { error: `Falha ao criar items: ${itemsErr.message}` },
      { status: 500 }
    );
  }

  // Trigger imediato após response retornar. `after()` do Next 16 garante
  // execução pós-response sem ser cortada pela serverless function (diferente
  // de `void (async () => ...)` que pode ser interrompido).
  //
  // Vercel Hobby plan limita crons a 1×/dia, então não dá pra contar com cron
  // 5/5min como antes. Estratégia: processa AQUI quando job é criado +
  // cron diário 8h UTC como safety net pra recuperar items travados.
  //
  // maxItems = MAX_BATCH_SIZE pra cobrir job inteiro; concurrency 2 evita
  // sobrecarga simultânea no Gemini/Imagen.
  after(async () => {
    try {
      const { processPendingItems } = await import(
        "@/lib/server/mass-generation/job-runner"
      );
      await processPendingItems({ maxItems: MAX_BATCH_SIZE, concurrency: 2 });
    } catch (err) {
      console.warn("[mass-generate] after() kickoff falhou:", err);
    }
  });

  return NextResponse.json({
    ok: true,
    jobId: jobRow.id,
    totalCount,
    themes: resolvedThemes,
    autoSchedule: config.autoSchedule,
    scheduleDates: config.autoSchedule
      ? scheduleDates.map((d) => d.toISOString())
      : [],
  });
}

function clampInt(v: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}
