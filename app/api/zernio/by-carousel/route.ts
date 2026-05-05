/**
 * GET /api/zernio/posts/by-carousel?carouselId=<uuid>
 *
 * Lista entradas (planejadas / agendadas / publicadas) vinculadas a um
 * carousel_id específico. Usado no preview do carrossel pra mostrar
 * status "N agendamentos" + lista compacta sem precisar carregar
 * /api/zernio/posts inteiro.
 *
 * Auth: pro + business + admin (qualquer um que possa usar calendar).
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdminOrPlan(request, ["pro", "business"]);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const url = new URL(request.url);
  const carouselId = url.searchParams.get("carouselId");
  if (!carouselId) {
    return Response.json({ error: "carouselId obrigatório." }, { status: 400 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data, error } = await sb
    .from("zernio_scheduled_posts")
    .select(
      "id, status, scheduled_for, published_at, platforms, source"
    )
    .eq("user_id", user.id)
    .eq("carousel_id", carouselId)
    .neq("status", "cancelled")
    .order("scheduled_for", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ posts: data ?? [] });
}
