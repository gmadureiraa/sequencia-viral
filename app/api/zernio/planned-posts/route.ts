/**
 * POST   /api/zernio/posts/planned       → cria post planejado (sem Zernio).
 * PATCH  /api/zernio/posts/planned/:id   → edita rascunho planejado.
 *                                          (Não vive aqui — está em /[id])
 *
 * Modelo:
 *  - Plano Pro pode adicionar entradas no calendário manualmente pra
 *    planejar conteúdo (ainda não programa publicação automática).
 *  - Status local 'planned' — sem zernio_post_id, sem chamada Zernio.
 *  - Quando user upgrade pra Max, esses 'planned' podem ser promovidos
 *    pra 'scheduled' (cria de fato no Zernio) via endpoint separado.
 *
 * Auth: qualquer plano pago (pro ou business). Free não tem acesso.
 *
 * Body:
 *   {
 *     content: string,             // legenda/texto do post
 *     scheduledFor: string,        // ISO sem TZ (YYYY-MM-DDTHH:MM)
 *     timezone?: string,
 *     platforms: string[],         // ['instagram'] | ['linkedin'] | ['instagram','linkedin']
 *     carouselId?: string,         // opcional: link pro carrossel SV
 *     title?: string,
 *   }
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";

export const runtime = "nodejs";

interface CreatePlannedBody {
  content?: string;
  scheduledFor?: string;
  timezone?: string;
  platforms?: string[];
  carouselId?: string;
  title?: string;
}

const ALLOWED_PLATFORMS = new Set(["instagram", "linkedin"]);
const DEFAULT_TZ = "America/Sao_Paulo";

export async function POST(request: Request) {
  // Pro + Business têm acesso ao planejamento manual. Free não.
  const gate = await requireAdminOrPlan(request, ["pro", "business"]);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let body: CreatePlannedBody;
  try {
    body = (await request.json()) as CreatePlannedBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (content.length === 0) {
    return Response.json({ error: "Conteúdo vazio." }, { status: 400 });
  }
  if (!body.scheduledFor) {
    return Response.json(
      { error: "scheduledFor obrigatório." },
      { status: 400 }
    );
  }
  const platforms = (body.platforms ?? []).filter((p) =>
    ALLOWED_PLATFORMS.has(p)
  );
  if (platforms.length === 0) {
    return Response.json(
      { error: "Selecione pelo menos 1 plataforma (instagram, linkedin)." },
      { status: 400 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Pra status 'planned' precisamos de profile_id válido. Se user não tem
  // profile (Pro nunca conectou Zernio), criamos um placeholder local
  // sem chamar a API externa — só pra satisfazer FK. Não é "profile real
  // do Zernio" — fica órfão até user upgrade pra Max.
  let { data: profile } = await sb
    .from("zernio_profiles")
    .select("id")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (!profile) {
    // Cria profile local placeholder — usa zernio_profile_id sintético
    // ("local-{uuid prefix}") pra não bater na UNIQUE constraint nem
    // confundir com profile real Zernio.
    const placeholderId = `local-${user.id.slice(0, 8)}-${Date.now()}`;
    const { data: created, error: createErr } = await sb
      .from("zernio_profiles")
      .insert({
        user_id: user.id,
        zernio_profile_id: placeholderId,
        name: "Planejamento (local)",
        description: "Profile local — sem conexão Zernio (pro plan)",
      })
      .select("id")
      .single();
    if (createErr) {
      return Response.json(
        { error: `Falha ao criar profile placeholder: ${createErr.message}` },
        { status: 500 }
      );
    }
    profile = created;
  }

  // Insere post planejado — sem zernio_post_id (null), status 'planned'
  const platformsArray = platforms.map((p) => ({ platform: p, accountId: "" }));
  const { data: row, error: insErr } = await sb
    .from("zernio_scheduled_posts")
    .insert({
      user_id: user.id,
      profile_id: profile!.id,
      carousel_id: body.carouselId ?? null,
      zernio_post_id: null,
      status: "planned",
      content,
      platforms: platformsArray,
      scheduled_for: body.scheduledFor,
      timezone: body.timezone || DEFAULT_TZ,
      source: "manual",
    })
    .select("*")
    .single();

  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 500 });
  }
  return Response.json({ post: row }, { status: 201 });
}
