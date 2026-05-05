import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { fireResendEvent } from "@/lib/integrations/resend/events";

export const maxDuration = 60;

const POWER_THRESHOLD = 10;
const BATCH = 200;

/**
 * power-user — dispara `sv.power_user` quando user atinge 10+ carrosséis
 * no mês corrente.
 *
 * `usage_count` mora em `profiles` e é zerado dia 1 (cron usage-reset).
 * Logo `usage_count >= 10` já significa "10+ no mês corrente".
 *
 * Idempotência por mês:
 *   - registramos `last_power_user_email_at` em `profiles`
 *   - dispara apenas se `last_power_user_email_at` for null OU pertencer a
 *     mês anterior (year-month diferente do atual em UTC).
 *
 * Schedule diário — ver vercel.json.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("power-user")) return cronSkipped("power-user");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const { data: profiles, error } = await sb
    .from("profiles")
    .select("id,email,usage_count,last_power_user_email_at,plan")
    .gte("usage_count", POWER_THRESHOLD)
    .limit(BATCH);

  if (error) {
    console.error("[cron/power-user] query falhou:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const ymNow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let dispatched = 0;
  let skipped = 0;

  for (const p of profiles ?? []) {
    if (!p.email) {
      skipped += 1;
      continue;
    }
    if (p.last_power_user_email_at) {
      const last = new Date(p.last_power_user_email_at as string);
      const ymLast = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}`;
      if (ymLast === ymNow) {
        skipped += 1;
        continue;
      }
    }

    await fireResendEvent("sv.power_user", {
      email: p.email,
      user_id: p.id,
      usage_count: p.usage_count,
      plan: p.plan,
      month: ymNow,
    });

    const { error: upErr } = await sb
      .from("profiles")
      .update({ last_power_user_email_at: new Date().toISOString() })
      .eq("id", p.id);
    if (upErr) {
      console.warn("[cron/power-user] update falhou:", p.id, upErr.message);
    }
    dispatched += 1;
  }

  return Response.json({
    ok: true,
    candidates: profiles?.length ?? 0,
    dispatched,
    skipped,
  });
}
