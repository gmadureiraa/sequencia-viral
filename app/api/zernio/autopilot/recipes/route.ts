/**
 * GET  /api/zernio/autopilot/recipes  → lista recipes do admin
 * POST /api/zernio/autopilot/recipes  → cria recipe
 *
 * Recipe = "gere conteúdo sobre estes temas, com esta linha editorial,
 * nesta cadência, pros profile X + accounts Y[], agendando às HH:MM
 * timezone Z". O cron diário lê e dispara.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

type CadenceType = "daily" | "every_n_days" | "weekly_dow" | "specific_dates";

interface CreateRecipeBody {
  profileId?: string;
  name?: string;
  themes?: string[];
  editorialLine?: string;
  niche?: string;
  tone?: string;
  language?: string;
  designTemplate?: string;
  cadenceType?: CadenceType;
  intervalDays?: number;
  daysOfWeek?: number[];
  specificDates?: string[];
  publishHour?: number;
  publishMinute?: number;
  timezone?: string;
  targetAccountIds?: string[];
  publishMode?: "scheduled" | "draft";
  isActive?: boolean;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data, error } = await sb
    .from("zernio_autopilot_recipes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ recipes: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  let body: CreateRecipeBody;
  try {
    body = (await request.json()) as CreateRecipeBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!body.profileId) return Response.json({ error: "profileId obrigatório." }, { status: 400 });
  if (!body.name?.trim()) return Response.json({ error: "name obrigatório." }, { status: 400 });
  const themes = (body.themes ?? []).map((t) => t.trim()).filter((t) => t.length > 0);
  if (themes.length === 0)
    return Response.json({ error: "Adicione ao menos 1 tema." }, { status: 400 });

  const cadenceType: CadenceType = body.cadenceType ?? "every_n_days";
  const intervalDays =
    cadenceType === "every_n_days" || cadenceType === "daily"
      ? Math.max(1, Math.min(60, Number(body.intervalDays ?? (cadenceType === "daily" ? 1 : 3))))
      : null;
  const daysOfWeek =
    cadenceType === "weekly_dow"
      ? (body.daysOfWeek ?? []).filter((d) => d >= 0 && d <= 6)
      : null;
  const specificDates =
    cadenceType === "specific_dates"
      ? (body.specificDates ?? []).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
      : null;

  if (cadenceType === "weekly_dow" && (daysOfWeek?.length ?? 0) === 0) {
    return Response.json(
      { error: "weekly_dow exige daysOfWeek." },
      { status: 400 }
    );
  }
  if (cadenceType === "specific_dates" && (specificDates?.length ?? 0) === 0) {
    return Response.json(
      { error: "specific_dates exige array de datas YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Confirma que o profileId pertence ao user
  const { data: profile } = await sb
    .from("zernio_profiles")
    .select("id")
    .eq("id", body.profileId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return Response.json({ error: "Profile inválido." }, { status: 404 });

  const publishHour = clamp(Number(body.publishHour ?? 9), 0, 23);
  const publishMinute = clamp(Number(body.publishMinute ?? 0), 0, 59);
  const nextRunAt = computeNextRunAt({
    cadenceType,
    intervalDays,
    daysOfWeek,
    specificDates,
    publishHour,
    publishMinute,
    timezone: body.timezone || "America/Sao_Paulo",
    fromDate: new Date(),
  });

  const { data, error } = await sb
    .from("zernio_autopilot_recipes")
    .insert({
      user_id: user.id,
      profile_id: body.profileId,
      name: body.name.trim().slice(0, 120),
      is_active: body.isActive ?? true,
      themes,
      editorial_line: (body.editorialLine ?? "").trim().slice(0, 1500),
      niche: body.niche?.trim() || null,
      tone: body.tone || "editorial",
      language: body.language || "pt-br",
      design_template: body.designTemplate || "twitter",
      cadence_type: cadenceType,
      interval_days: intervalDays,
      days_of_week: daysOfWeek,
      specific_dates: specificDates,
      publish_hour: publishHour,
      publish_minute: publishMinute,
      timezone: body.timezone || "America/Sao_Paulo",
      target_account_ids: body.targetAccountIds ?? [],
      publish_mode: body.publishMode === "draft" ? "draft" : "scheduled",
      next_run_at: nextRunAt.toISOString(),
    })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ recipe: data }, { status: 201 });
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Calcula próxima execução baseada em cadência. Implementação simples — não
 * tenta lidar com DST de forma perfeita; usa offset fixo de Sao_Paulo (-3h)
 * pra MVP. Quando precisar de exatidão, plugar `Intl.DateTimeFormat` ou
 * date-fns-tz.
 */
function computeNextRunAt(args: {
  cadenceType: CadenceType;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  specificDates: string[] | null;
  publishHour: number;
  publishMinute: number;
  timezone: string;
  fromDate: Date;
}): Date {
  const { cadenceType, intervalDays, daysOfWeek, specificDates } = args;
  const startUtc = new Date(args.fromDate);
  // Aplica HH:MM como hora local do timezone alvo. Pra Sao_Paulo (UTC-3),
  // hora local 9h = 12h UTC. Vamos guardar o intent em UTC adicionando offset
  // simples: getTimezoneOffset usa o LOCAL do servidor, então a melhor
  // estimativa em runtime serverless (UTC) é compor manualmente.
  const sign = -1; // Sao_Paulo: UTC-3
  const tzOffsetMin = 180; // minutos pra Sao_Paulo
  const tzMs = sign * tzOffsetMin * 60 * 1000;

  function nextOnDay(daysAhead: number): Date {
    // Constrói a data alvo em UTC equivalente a HH:MM local Sao_Paulo
    const candidate = new Date(startUtc);
    candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
    candidate.setUTCHours(args.publishHour, args.publishMinute, 0, 0);
    // Ajusta pelo offset pra hora HH ser interpretada como Sao_Paulo
    return new Date(candidate.getTime() - tzMs);
  }

  if (cadenceType === "daily") {
    let d = nextOnDay(0);
    if (d.getTime() <= startUtc.getTime()) d = nextOnDay(1);
    return d;
  }

  if (cadenceType === "every_n_days" && intervalDays) {
    let d = nextOnDay(0);
    if (d.getTime() <= startUtc.getTime()) d = nextOnDay(intervalDays);
    return d;
  }

  if (cadenceType === "weekly_dow" && daysOfWeek && daysOfWeek.length > 0) {
    // Procura o próximo dia da semana que está na lista (0..6 onde 0=domingo).
    // getUTCDay() de hoje em Sao_Paulo: usamos a aproximação UTC mesmo (pra
    // MVP — pode dar 1 dia de atraso em borda HH<3 UTC mas é tolerável).
    const today = startUtc.getUTCDay();
    for (let i = 0; i < 8; i++) {
      const dow = (today + i) % 7;
      if (daysOfWeek.includes(dow)) {
        const candidate = nextOnDay(i);
        if (candidate.getTime() > startUtc.getTime()) return candidate;
      }
    }
    return nextOnDay(7); // fallback
  }

  if (cadenceType === "specific_dates" && specificDates && specificDates.length > 0) {
    // Próxima data ISO >= hoje. Se passou, retorna a 1ª (será descartada na
    // próxima execução do cron porque past dates não fazem sentido — o
    // handler do cron vê e marca recipe como inactive ou pula).
    const futureDates = specificDates
      .map((s) => {
        const [y, m, d] = s.split("-").map((n) => Number(n));
        const dt = new Date(Date.UTC(y, m - 1, d, args.publishHour, args.publishMinute));
        return new Date(dt.getTime() - tzMs);
      })
      .filter((dt) => dt.getTime() > startUtc.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    if (futureDates.length > 0) return futureDates[0];
    // Sem datas futuras → coloca daqui a 1 ano (vai expirar a recipe na UI).
    const far = new Date(startUtc);
    far.setUTCFullYear(far.getUTCFullYear() + 1);
    return far;
  }

  // Default safe: 1h no futuro
  return new Date(startUtc.getTime() + 60 * 60 * 1000);
}

export { computeNextRunAt };
