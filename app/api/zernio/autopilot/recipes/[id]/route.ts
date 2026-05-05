/**
 * PATCH  /api/zernio/autopilot/recipes/:id  → atualiza recipe
 * DELETE /api/zernio/autopilot/recipes/:id  → deleta recipe
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Whitelist de campos editáveis pra não permitir overwrite de user_id, profile_id, etc.
  const updates: Record<string, unknown> = {};
  const allowed = [
    "name",
    "is_active",
    "themes",
    "editorial_line",
    "niche",
    "tone",
    "language",
    "design_template",
    "publish_hour",
    "publish_minute",
    "timezone",
    "target_account_ids",
    "publish_mode",
  ];
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nada a atualizar." }, { status: 400 });
  }

  const { data, error } = await sb
    .from("zernio_autopilot_recipes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Recipe não encontrado." }, { status: 404 });

  return Response.json({ recipe: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;
  const { id } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { error } = await sb
    .from("zernio_autopilot_recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
