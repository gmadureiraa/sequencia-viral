/**
 * DELETE /api/zernio/posts/:id  → cancela no Zernio + marca cancelled no DB.
 * PATCH  /api/zernio/posts/:id  → reagenda (scheduledFor + timezone) ou edita
 *                                 conteúdo.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import {
  deleteZernioPost,
  updateZernioPost,
  ZernioApiError,
} from "@/lib/server/zernio";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Pro pode editar/cancelar próprios posts planejados; Business + admin
  // têm acesso completo (incluindo posts agendados via Zernio).
  const gate = await requireAdminOrPlan(request, ["pro", "business"]);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: row } = await sb
    .from("zernio_scheduled_posts")
    .select("id, zernio_post_id, status, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return Response.json({ error: "Post não encontrado." }, { status: 404 });

  if (row.zernio_post_id) {
    try {
      await deleteZernioPost(row.zernio_post_id);
    } catch (err) {
      if (err instanceof ZernioApiError && err.status === 404) {
        // Já não existia no Zernio — segue.
      } else {
        console.warn("[zernio/posts DELETE] Zernio delete falhou — segue local", err);
      }
    }
  }

  const { error } = await sb
    .from("zernio_scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

interface PatchBody {
  content?: string;
  scheduledFor?: string;
  timezone?: string;
  title?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Pro pode editar/cancelar próprios posts planejados; Business + admin
  // têm acesso completo (incluindo posts agendados via Zernio).
  const gate = await requireAdminOrPlan(request, ["pro", "business"]);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: row } = await sb
    .from("zernio_scheduled_posts")
    .select("id, zernio_post_id, status, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return Response.json({ error: "Post não encontrado." }, { status: 404 });
  if (!row.zernio_post_id)
    return Response.json({ error: "Post sem zernio_post_id (estado inválido)." }, { status: 400 });
  if (row.status === "published" || row.status === "cancelled")
    return Response.json(
      { error: "Não dá pra editar post já publicado ou cancelado." },
      { status: 400 }
    );

  try {
    await updateZernioPost(row.zernio_post_id, {
      content: body.content,
      scheduledFor: body.scheduledFor,
      timezone: body.timezone,
      title: body.title,
    });
  } catch (err) {
    if (err instanceof ZernioApiError) {
      return Response.json(
        { error: `Zernio: ${err.message}` },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    return Response.json({ error: "Falha ao atualizar no Zernio." }, { status: 500 });
  }

  const update: Record<string, unknown> = {};
  if (body.content !== undefined) update.content = body.content;
  if (body.scheduledFor !== undefined) update.scheduled_for = body.scheduledFor;
  if (body.timezone !== undefined) update.timezone = body.timezone;
  if (Object.keys(update).length > 0) {
    const { error } = await sb
      .from("zernio_scheduled_posts")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
