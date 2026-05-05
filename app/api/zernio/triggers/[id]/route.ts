/**
 * PATCH  /api/zernio/triggers/:id   → atualiza trigger (whitelist de campos)
 * DELETE /api/zernio/triggers/:id   → deleta
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";

export const runtime = "nodejs";

const EDITABLE = new Set([
  "name",
  "is_active",
  "themes",
  "editorial_line",
  "niche",
  "tone",
  "language",
  "design_template",
  "target_platforms",
  "publish_mode",
  // schedule
  "cadence_type",
  "interval_days",
  "days_of_week",
  "specific_dates",
  "publish_hour",
  "publish_minute",
  "timezone",
  // rss
  "rss_url",
  "rss_check_interval_minutes",
  "rss_max_items_per_check",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (EDITABLE.has(k)) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nada a atualizar." }, { status: 400 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data, error } = await sb
    .from("zernio_autopilot_triggers")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Trigger não encontrado." }, { status: 404 });

  return Response.json({ trigger: data });
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

  const { error } = await sb
    .from("zernio_autopilot_triggers")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
