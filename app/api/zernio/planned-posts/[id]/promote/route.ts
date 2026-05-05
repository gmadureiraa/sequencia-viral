/**
 * POST /api/zernio/planned-posts/:id/promote
 *
 * Pega uma entry com status='planned' (sem zernio_post_id) e PROMOVE pra
 * publicação real via Zernio API. Cria post no Zernio com mediaUrls (se
 * carouselId vinculado), atualiza status pra 'scheduled', amarra
 * zernio_post_id.
 *
 * Use cases:
 *  - User Pro planejou conteúdos → upgrade pra Max → quer ativar
 *    planejamento como agendamento real
 *  - User Max criou planejado primeiro pra revisar → decide publicar
 *
 * Auth: só Max (admin OR business).
 *
 * NÃO aceita Body — usa o conteúdo já gravado no DB.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import { ensureUserHasZernioProfile } from "@/lib/server/zernio-default-profile";
import {
  createZernioPost,
  ZernioApiError,
  ZernioConfigError,
  type ZernioPlatform,
  type ZernioPostPlatformTarget,
} from "@/lib/server/zernio";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminOrPlan(request, ["business"]);
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const { id } = await params;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: planned } = await sb
    .from("zernio_scheduled_posts")
    .select(
      "id, status, content, scheduled_for, timezone, platforms, zernio_post_id, profile_id"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!planned) {
    return Response.json({ error: "Entry não encontrada." }, { status: 404 });
  }
  if (planned.status !== "planned") {
    return Response.json(
      {
        error: `Só posts 'planned' podem ser promovidos. Status atual: ${planned.status}.`,
      },
      { status: 400 }
    );
  }
  if (planned.zernio_post_id) {
    return Response.json(
      { error: "Já tem zernio_post_id — não é planejado." },
      { status: 400 }
    );
  }

  // Garante profile real Zernio (não placeholder local). User Pro que
  // promove pode ter só profile placeholder. Se for o caso, ensureUserHasZernioProfile
  // detecta e cria um real (substitui placeholder).
  // Estratégia: o ensure helper retorna o existente se válido. Pra placeholder
  // ("local-XXX"), arquivamos e criamos novo real.
  const placeholderPattern = /^local-/;
  const { data: existingProfile } = await sb
    .from("zernio_profiles")
    .select("id, zernio_profile_id")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .maybeSingle();

  if (existingProfile && placeholderPattern.test(existingProfile.zernio_profile_id)) {
    await sb
      .from("zernio_profiles")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", existingProfile.id);
  }

  let zernioProfileId: string;
  try {
    const profile = await ensureUserHasZernioProfile(sb, user);
    zernioProfileId = profile.zernioProfileId;
  } catch (err) {
    if (err instanceof ZernioConfigError) {
      return Response.json(
        { error: "ZERNIO_API_KEY ausente no servidor." },
        { status: 503 }
      );
    }
    if (err instanceof ZernioApiError) {
      return Response.json(
        { error: `Zernio profile: ${err.message}` },
        { status: 502 }
      );
    }
    return Response.json(
      { error: "Falha ao garantir profile Zernio." },
      { status: 500 }
    );
  }
  void zernioProfileId;

  // Resolve accounts active das plataformas alvo
  const targetPlatforms = (
    planned.platforms as Array<{ platform: string }> | null
  )
    ?.map((p) => p.platform)
    .filter((p) => ["instagram", "linkedin"].includes(p)) ?? [];
  if (targetPlatforms.length === 0) {
    return Response.json(
      { error: "Entry não tem plataformas IG/LI configuradas." },
      { status: 400 }
    );
  }

  const { data: accountRows } = await sb
    .from("zernio_accounts")
    .select("zernio_account_id, platform, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("platform", targetPlatforms);

  const platforms: ZernioPostPlatformTarget[] = (accountRows ?? []).map((a) => ({
    platform: a.platform as ZernioPlatform,
    accountId: a.zernio_account_id,
  }));

  if (platforms.length === 0) {
    return Response.json(
      {
        error: `Nenhuma conta ${targetPlatforms.join("/")} conectada. Conecte em Ajustes antes de promover.`,
        code: "no_accounts",
      },
      { status: 400 }
    );
  }

  // Cria post real no Zernio
  let zernioPost;
  try {
    zernioPost = await createZernioPost({
      content: planned.content,
      scheduledFor: planned.scheduled_for ?? undefined,
      timezone: planned.timezone || "America/Sao_Paulo",
      platforms,
    });
  } catch (err) {
    const detail =
      err instanceof ZernioApiError
        ? `Zernio ${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "unknown";
    return Response.json({ error: detail }, { status: 502 });
  }

  // Atualiza entry: status='scheduled', amarra zernio_post_id, refresh
  // platforms com accountId real (planejado tinha "" como accountId).
  const { error: updErr } = await sb
    .from("zernio_scheduled_posts")
    .update({
      status: "scheduled",
      zernio_post_id: zernioPost._id,
      platforms,
      raw: zernioPost,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    zernio_post_id: zernioPost._id,
    status: "scheduled",
  });
}
