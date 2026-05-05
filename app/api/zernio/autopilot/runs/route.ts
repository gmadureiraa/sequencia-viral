/**
 * GET /api/zernio/autopilot/runs?recipeId=&limit=
 *
 * Histórico de execuções do cron por recipe. Sem query → todos do admin.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const url = new URL(request.url);
  const recipeId = url.searchParams.get("recipeId");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  let q = sb
    .from("zernio_autopilot_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (recipeId) q = q.eq("recipe_id", recipeId);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ runs: data ?? [] });
}
