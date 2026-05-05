import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { fireResendEvent } from "@/lib/integrations/resend/events";

export const maxDuration = 60;

const BATCH = 200;

/**
 * annual-offer — dispara `sv.annual_offer` pra users no plano `pro` (mensal)
 * com 3+ ciclos pagos (≈90 dias) que ainda não receberam a oferta anual.
 *
 * Critérios:
 *   - `plan = 'pro'`
 *   - `last_annual_offer_at IS NULL`
 *   - "subscription_started_at" derivado da `payments` mais antiga confirmada
 *     do user (`status = 'confirmed'`, `plan = 'pro'`) <= now-90d.
 *
 * Schedule semanal (segunda) — ver vercel.json.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("annual-offer")) return cronSkipped("annual-offer");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString();

  const { data: candidates, error } = await sb
    .from("profiles")
    .select("id,email,plan,last_annual_offer_at,stripe_subscription_id")
    .eq("plan", "pro")
    .is("last_annual_offer_at", null)
    .not("stripe_subscription_id", "is", null)
    .limit(BATCH);

  if (error) {
    console.error("[cron/annual-offer] query falhou:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let dispatched = 0;
  let skipped = 0;

  for (const p of candidates ?? []) {
    if (!p.email) {
      skipped += 1;
      continue;
    }

    // Pega primeira pagamento confirmado pra derivar quando assinatura começou.
    const { data: firstPayment } = await sb
      .from("payments")
      .select("created_at")
      .eq("user_id", p.id)
      .eq("status", "confirmed")
      .eq("plan", "pro")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!firstPayment?.created_at) {
      skipped += 1;
      continue;
    }
    if ((firstPayment.created_at as string) > ninetyDaysAgo) {
      // ainda não tem 90 dias de assinatura
      skipped += 1;
      continue;
    }

    await fireResendEvent("sv.annual_offer", {
      email: p.email,
      user_id: p.id,
      plan: p.plan,
      subscription_started_at: firstPayment.created_at,
    });

    const { error: upErr } = await sb
      .from("profiles")
      .update({ last_annual_offer_at: new Date().toISOString() })
      .eq("id", p.id);
    if (upErr) {
      console.warn("[cron/annual-offer] update falhou:", p.id, upErr.message);
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
