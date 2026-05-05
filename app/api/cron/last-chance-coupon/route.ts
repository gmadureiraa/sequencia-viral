import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";
import { sendLastChanceCoupon } from "@/lib/email/dispatch";

export const maxDuration = 60;

const COUPON_CODE = "VIRAL50";

/**
 * Last Chance Coupon — D+7 + limite gasto.
 *
 * Gatilho: user com `plan = 'free'`, `usage_count >= usage_limit` e
 * `created_at <= now() - 7 days`. Dispara uma vez via flag idempotente
 * `last_chance_coupon_sent_at` em `profiles.brand_analysis.__lifecycle`.
 *
 * Objetivo: entregar cupom VIRAL50 (50% off primeiro mês Creator) pra
 * quem ESGOTOU o free tier e ainda não assinou. Contexto de alto sinal.
 *
 * Schedule: diário — ver vercel.json.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("last-chance-coupon")) return cronSkipped("last-chance-coupon");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 3600_000,
  ).toISOString();

  // Supabase não suporta comparar duas colunas direto no .filter sem RPC,
  // então pegamos candidatos com `plan = free` criados há 7+ dias e
  // filtramos `usage_count >= usage_limit` em memória.
  const { data: candidates, error } = await sb
    .from("profiles")
    .select("id,name,email,brand_analysis,plan,usage_count,usage_limit,created_at")
    .eq("plan", "free")
    .lte("created_at", sevenDaysAgo)
    .limit(500);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const p of candidates || []) {
    const used = p.usage_count ?? 0;
    const limit = p.usage_limit ?? 5;

    // Só dispara pra quem realmente esgotou o free tier.
    if (limit <= 0 || used < limit) {
      skipped += 1;
      continue;
    }

    const lifecycle =
      ((p.brand_analysis as Record<string, unknown> | null)?.__lifecycle as
        | Record<string, string>
        | undefined) || {};

    if (lifecycle.last_chance_coupon_sent_at) {
      skipped += 1;
      continue;
    }

    if (!p.email) {
      skipped += 1;
      continue;
    }

    const id = await sendLastChanceCoupon(
      { email: p.email, name: p.name },
      { couponCode: COUPON_CODE },
    );

    if (id) {
      const prev =
        p.brand_analysis && typeof p.brand_analysis === "object"
          ? { ...(p.brand_analysis as Record<string, unknown>) }
          : {};
      prev.__lifecycle = {
        ...lifecycle,
        last_chance_coupon_sent_at: new Date().toISOString(),
      };
      await sb.from("profiles").update({ brand_analysis: prev }).eq("id", p.id);
      sent += 1;
    } else {
      skipped += 1;
    }
  }

  return Response.json({
    ok: true,
    candidates: candidates?.length ?? 0,
    sent,
    skipped,
  });
}
