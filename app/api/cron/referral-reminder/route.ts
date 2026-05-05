import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { fireResendEvent } from "@/lib/integrations/resend/events";

export const maxDuration = 60;

const BATCH = 200;

/**
 * referral-reminder — dispara `sv.referral.reminder` pra users criados há
 * 45+ dias que ainda não indicaram ninguém E nunca receberam esse reminder.
 *
 * Critérios:
 *   - `profiles.created_at <= now - 45d`
 *   - `last_referral_reminder_at` IS NULL (one-shot)
 *   - Nenhuma linha em `referrals` onde `referrer_user_id = profile.id` com
 *     status in ('signup', 'converted'). Status `pending` (link gerado mas
 *     ninguém usou) também conta como "não indicou de verdade".
 *
 * Schedule diário — ver vercel.json.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("referral-reminder")) return cronSkipped("referral-reminder");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86400_000).toISOString();

  const { data: candidates, error } = await sb
    .from("profiles")
    .select("id,email,created_at,last_referral_reminder_at")
    .lte("created_at", fortyFiveDaysAgo)
    .is("last_referral_reminder_at", null)
    .limit(BATCH);

  if (error) {
    console.error("[cron/referral-reminder] query falhou:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let dispatched = 0;
  let skipped = 0;

  for (const p of candidates ?? []) {
    if (!p.email) {
      skipped += 1;
      continue;
    }

    // Verifica se já indicou alguém efetivamente (signup ou converted).
    const { count: refCount } = await sb
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", p.id)
      .in("status", ["signup", "converted"]);

    if ((refCount ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    await fireResendEvent("sv.referral.reminder", {
      email: p.email,
      user_id: p.id,
      created_at: p.created_at,
    });

    const { error: upErr } = await sb
      .from("profiles")
      .update({ last_referral_reminder_at: new Date().toISOString() })
      .eq("id", p.id);
    if (upErr) {
      console.warn("[cron/referral-reminder] update falhou:", p.id, upErr.message);
    }
    dispatched += 1;
  }

  return Response.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    dispatched,
    skipped,
  });
}
