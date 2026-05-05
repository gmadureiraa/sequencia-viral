import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { cronForbidden, isValidCronRequest } from "@/lib/server/cron-auth";
import { cronSkipped, isCronEnabled } from "@/lib/server/cron-flag";

export const maxDuration = 60;

/**
 * Reset mensal de `usage_count` de todos usuários free/pro.
 * Business fica ilimitado mas zera mesmo assim (sentinel alto).
 *
 * Schedule: dia 1 às 00:00 UTC — ver vercel.json.
 *
 * Idempotência: se rodar 2x no mesmo dia, zera novamente sem estragar.
 */
export async function GET(request: Request) {
  if (!isValidCronRequest(request)) return cronForbidden();
  if (!isCronEnabled("usage-reset")) return cronSkipped("usage-reset");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "no supabase" }, { status: 503 });

  // 1. Tenta via RPC `reset_monthly_usage` (existe no schema.sql)
  const { error: rpcErr } = await sb.rpc("reset_monthly_usage");
  if (!rpcErr) {
    return Response.json({
      ok: true,
      method: "rpc",
      message: "usage_count zerado para todos os profiles.",
    });
  }

  console.warn("[cron/usage-reset] RPC falhou, usando fallback:", rpcErr.message);

  // 2. Fallback: update direto
  const { error: updateErr, count } = await sb
    .from("profiles")
    .update({ usage_count: 0 }, { count: "exact" })
    .gt("usage_count", 0);

  if (updateErr) {
    console.error("[cron/usage-reset] falhou:", updateErr);
    return Response.json(
      { error: `Reset falhou: ${updateErr.message}` },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    method: "fallback",
    reset: count ?? 0,
  });
}
