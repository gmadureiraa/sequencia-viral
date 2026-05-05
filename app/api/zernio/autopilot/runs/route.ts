/**
 * Lista runs do autopilot v2. Antes era filtro por recipeId; agora aceita
 * triggerId. Retorna campos novos do schema (trigger_id, fired_at, fired_by,
 * trigger_payload).
 */
import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

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
