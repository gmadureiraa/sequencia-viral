/**
 * GET  /api/zernio/triggers      → lista triggers do admin
 * POST /api/zernio/triggers      → cria trigger (3 tipos: schedule, rss, webhook)
 *
 * Trigger = "gatilho que dispara geração + post no Zernio".
 *
 * Tipos:
 *   - schedule: cadência baseada em tempo (mesmas opções do recipe v1).
 *               Cron diário processa.
 *   - rss:      poll de URL RSS. Quando aparece nova entrada (guid não
 *               está em rss_processed_guids), dispara geração com o título
 *               como tema. Cron checa em rss_check_interval_minutes.
 *   - webhook:  endpoint público fire endpoint com secret na URL. Permite
 *               disparo via Zapier/Make/n8n/etc.
 */

import { randomBytes } from "node:crypto";
import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

type TriggerType = "schedule" | "rss" | "webhook";
type CadenceType = "daily" | "every_n_days" | "weekly_dow" | "specific_dates";

interface CreateTriggerBody {
  name?: string;
  triggerType?: TriggerType;
  // Editorial config (comum)
  themes?: string[];
  editorialLine?: string;
  niche?: string;
  tone?: string;
  language?: string;
  designTemplate?: string;
  targetPlatforms?: string[];
  publishMode?: "scheduled" | "draft" | "publish_now";

  // Schedule fields
  cadenceType?: CadenceType;
  intervalDays?: number;
  daysOfWeek?: number[];
  specificDates?: string[];
  publishHour?: number;
  publishMinute?: number;
  timezone?: string;

  // RSS fields
  rssUrl?: string;
  rssCheckIntervalMinutes?: number;
  rssMaxItemsPerCheck?: number;

  // is_active default true
  isActive?: boolean;
}

const ALLOWED_PLATFORMS = new Set(["instagram", "linkedin"]);

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data, error } = await sb
    .from("zernio_autopilot_triggers")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ triggers: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-trigger-create", user.id),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: CreateTriggerBody;
  try {
    body = (await request.json()) as CreateTriggerBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const triggerType = body.triggerType;
  if (!triggerType || !["schedule", "rss", "webhook"].includes(triggerType)) {
    return Response.json(
      { error: "triggerType inválido. Use schedule | rss | webhook." },
      { status: 400 }
    );
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "name obrigatório." }, { status: 400 });
  }
  const themes = (body.themes ?? []).map((t) => t.trim()).filter(Boolean);

  // RSS pode disparar sem temas (usa o título do feed). Schedule e webhook
  // PRECISAM de pelo menos 1 tema (já que não trazem tema próprio sempre).
  if (triggerType !== "rss" && themes.length === 0) {
    return Response.json(
      { error: "Adicione pelo menos 1 tema (schedule e webhook usam pool)." },
      { status: 400 }
    );
  }

  const targetPlatforms = (body.targetPlatforms ?? ["instagram", "linkedin"])
    .filter((p) => ALLOWED_PLATFORMS.has(p));
  if (targetPlatforms.length === 0) {
    return Response.json(
      { error: "Escolha pelo menos 1 plataforma (instagram, linkedin)." },
      { status: 400 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const insertRow: Record<string, unknown> = {
    user_id: user.id,
    name: body.name.trim().slice(0, 120),
    is_active: body.isActive ?? true,
    trigger_type: triggerType,
    themes,
    editorial_line: (body.editorialLine ?? "").trim().slice(0, 1500),
    niche: body.niche?.trim() || null,
    tone: body.tone || "editorial",
    language: body.language || "pt-br",
    design_template: body.designTemplate || "twitter",
    target_platforms: targetPlatforms,
    publish_mode: body.publishMode || "scheduled",
  };

  // Configuração específica por tipo
  if (triggerType === "schedule") {
    const cadenceType = (body.cadenceType ?? "every_n_days") as CadenceType;
    insertRow.cadence_type = cadenceType;
    insertRow.interval_days =
      cadenceType === "daily"
        ? 1
        : cadenceType === "every_n_days"
          ? Math.max(1, Math.min(60, body.intervalDays ?? 3))
          : null;
    insertRow.days_of_week =
      cadenceType === "weekly_dow"
        ? (body.daysOfWeek ?? []).filter((d) => d >= 0 && d <= 6)
        : null;
    insertRow.specific_dates =
      cadenceType === "specific_dates"
        ? (body.specificDates ?? []).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
        : null;
    insertRow.publish_hour = clamp(body.publishHour ?? 9, 0, 23);
    insertRow.publish_minute = clamp(body.publishMinute ?? 0, 0, 59);
    insertRow.timezone = body.timezone || "America/Sao_Paulo";
    insertRow.next_run_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  } else if (triggerType === "rss") {
    if (!body.rssUrl || !/^https?:\/\//i.test(body.rssUrl)) {
      return Response.json(
        { error: "rssUrl obrigatório (http/https)." },
        { status: 400 }
      );
    }
    insertRow.rss_url = body.rssUrl;
    insertRow.rss_check_interval_minutes = clamp(
      body.rssCheckIntervalMinutes ?? 60,
      15,
      24 * 60
    );
    insertRow.rss_max_items_per_check = clamp(body.rssMaxItemsPerCheck ?? 1, 1, 5);
  } else if (triggerType === "webhook") {
    insertRow.webhook_secret = randomBytes(24).toString("hex");
  }

  const { data, error } = await sb
    .from("zernio_autopilot_triggers")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ trigger: data }, { status: 201 });
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
