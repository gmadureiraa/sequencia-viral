import {
  requireAdmin,
  createServiceRoleSupabaseClient,
} from "@/lib/server/auth";

export const maxDuration = 15;

/**
 * Retorna um carrossel COMPLETO pra inspeção no admin. Inclui os slides
 * inteiros (heading, body, imageUrl, variant), visualTemplate, caption,
 * style e metadados. Gated por requireAdmin — RLS do banco não rege
 * admin pois usa service role.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return Response.json({ error: "id inválido" }, { status: 400 });
    }

    const sb = createServiceRoleSupabaseClient();
    if (!sb) {
      return Response.json(
        { error: "Service role key ausente." },
        { status: 503 }
      );
    }

    const { data, error } = await sb
      .from("carousels")
      .select(
        "id,user_id,title,status,style,slides,thumbnail_url,source_url,source_text,created_at,updated_at"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return Response.json(
        { error: error?.message || "Carrossel não encontrado." },
        { status: 404 }
      );
    }

    return Response.json({ carousel: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/carousels/:id] error:", msg);
    return Response.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}
