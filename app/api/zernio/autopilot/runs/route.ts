/**
 * Lista runs do autopilot v2. Antes era filtro por recipeId; agora aceita
 * triggerId. Retorna campos novos do schema (trigger_id, fired_at, fired_by,
 * trigger_payload).
 */
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const url = new URL(request.url);
  const triggerId = url.searchParams.get("triggerId");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  let q = sb
    .from("zernio_autopilot_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("fired_at", { ascending: false })
    .limit(limit);
  if (triggerId) q = q.eq("trigger_id", triggerId);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ runs: data ?? [] });
}
