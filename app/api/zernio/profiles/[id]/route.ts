/**
 * DELETE /api/zernio/profiles/:id  → arquiva profile (soft delete) + tenta
 * deletar no Zernio. Soft-delete porque accounts/posts referenciam por FK
 * — perder histórico seria ruim. Marcamos archived_at e ocultamos da UI.
 *
 * GET    /api/zernio/profiles/:id → retorna 1 profile + suas contas conectadas.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import {
  deleteZernioProfile,
  ZernioApiError,
} from "@/lib/server/zernio";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: profile, error: pErr } = await sb
    .from("zernio_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });
  if (!profile) return Response.json({ error: "Profile não encontrado." }, { status: 404 });

  const { data: accounts, error: aErr } = await sb
    .from("zernio_accounts")
    .select("*")
    .eq("profile_id", id)
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });
  if (aErr) return Response.json({ error: aErr.message }, { status: 500 });

  return Response.json({ profile, accounts: accounts ?? [] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: row } = await sb
    .from("zernio_profiles")
    .select("id, zernio_profile_id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return Response.json({ error: "Profile não encontrado." }, { status: 404 });

  // Tenta deletar no Zernio. Falha do API não bloqueia soft-delete local —
  // se ficar órfão lá, lista admin mostra "ghost" e user limpa manual.
  try {
    await deleteZernioProfile(row.zernio_profile_id);
  } catch (err) {
    if (err instanceof ZernioApiError && err.status === 404) {
      // Já não existia no Zernio — segue.
    } else {
      console.warn(
        "[zernio/profiles DELETE] Zernio delete falhou — segue com soft-delete local",
        err
      );
    }
  }

  const { error } = await sb
    .from("zernio_profiles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
