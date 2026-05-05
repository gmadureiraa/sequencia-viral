/**
 * GET /api/zernio/accounts?profileId=<uuid>
 *
 * Lista contas conectadas. Se `profileId` (DB local) presente, filtra por
 * aquele profile; senão retorna todas do admin.
 *
 * NÃO chama Zernio em real-time — leitura é DB-only pra ser rápida. Pra
 * ressincronizar com Zernio (após OAuth ou se algo dessincronizou), usar
 * POST /api/zernio/accounts/sync.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const url = new URL(request.url);
  const profileIdLocal = url.searchParams.get("profileId");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  let query = sb
    .from("zernio_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });

  if (profileIdLocal) {
    query = query.eq("profile_id", profileIdLocal);
  }

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ accounts: data ?? [] });
}
