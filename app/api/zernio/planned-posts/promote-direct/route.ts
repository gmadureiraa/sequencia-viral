/**
 * POST /api/zernio/planned-posts/promote-direct
 *
 * Atalho usado pelo modal "Novo no calendário" no modo "Agendar publicação
 * automática" (Max). Combina:
 *   1. Cria entry status='planned' (igual /api/zernio/planned-posts)
 *   2. Imediatamente promove pra 'scheduled' via Zernio real (igual
 *      /api/zernio/planned-posts/[id]/promote)
 *
 * Usa o user_id pra resolver `accountIds` automaticamente (1 conta active
 * por plataforma alvo). User não precisa escolher conta — o sistema
 * pega a única conectada por plataforma. Se houver múltiplas, seleciona
 * a mais recente (`connected_at` desc).
 *
 * Auth: só Max (admin OR business). Pro NÃO pode chamar — usa
 * /api/zernio/planned-posts (sem promoção).
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
export const maxDuration = 60;

interface CreateBody {
  content?: string;
  scheduledFor?: string;
  timezone?: string;
  platforms?: string[];
  carouselId?: string;
}

const ALLOWED_PLATFORMS = new Set(["instagram", "linkedin"]);
const DEFAULT_TZ = "America/Sao_Paulo";

export async function POST(request: Request) {
  // Só Max (admin ou business). Pro precisa usar /planned-posts (sem
  // promoção) e fazer upgrade pra agendar real.
  const gate = await requireAdminOrPlan(request, ["business"]);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
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
  const targetPlatforms = (body.platforms ?? []).filter((p) =>
    ALLOWED_PLATFORMS.has(p)
  );
  if (targetPlatforms.length === 0) {
    return Response.json(
      { error: "Selecione pelo menos 1 plataforma (instagram, linkedin)." },
      { status: 400 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // 1. Garante profile Zernio real (não placeholder local). Promote precisa
  //    de profile real porque vai chamar Zernio API. Substitui placeholder
  //    se for o caso.
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

  let profileLocalId: string;
  try {
    const profile = await ensureUserHasZernioProfile(sb, user);
    profileLocalId = profile.localId;
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

  // 2. Resolve 1 account active por plataforma (pega a mais recente).
  const { data: accountRows, error: accErr } = await sb
    .from("zernio_accounts")
    .select("zernio_account_id, platform, status, connected_at, handle")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("platform", targetPlatforms)
    .order("connected_at", { ascending: false });

  if (accErr) {
    return Response.json({ error: accErr.message }, { status: 500 });
  }

  const accountByPlatform = new Map<string, { zernio_account_id: string; handle: string | null }>();
  for (const a of accountRows ?? []) {
    if (!accountByPlatform.has(a.platform)) {
      accountByPlatform.set(a.platform, {
        zernio_account_id: a.zernio_account_id,
        handle: a.handle,
      });
    }
  }

  const missing = targetPlatforms.filter((p) => !accountByPlatform.has(p));
  if (missing.length > 0) {
    return Response.json(
      {
        error: `Sem conta ${missing.join("/")} conectada via Zernio. Conecte em /app/zernio antes de agendar publicação automática.`,
        code: "no_accounts",
        missingPlatforms: missing,
      },
      { status: 400 }
    );
  }

  const platforms: ZernioPostPlatformTarget[] = targetPlatforms.map((p) => ({
    platform: p as ZernioPlatform,
    accountId: accountByPlatform.get(p)!.zernio_account_id,
  }));

  // 3. Cria post no Zernio
  let zernioPost;
  try {
    zernioPost = await createZernioPost({
      content,
      scheduledFor: body.scheduledFor,
      timezone: body.timezone || DEFAULT_TZ,
      platforms,
    });
  } catch (err) {
    if (err instanceof ZernioConfigError) {
      return Response.json(
        { error: "ZERNIO_API_KEY ausente no servidor." },
        { status: 503 }
      );
    }
    if (err instanceof ZernioApiError) {
      return Response.json(
        { error: `Zernio: ${err.message}`, code: err.code },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    return Response.json(
      { error: "Falha ao criar post no Zernio." },
      { status: 500 }
    );
  }

  // 4. Persiste localmente como 'scheduled'
  const platformsJson = platforms.map((p) => ({
    platform: p.platform,
    accountId: p.accountId,
  }));
  const { data: row, error: insErr } = await sb
    .from("zernio_scheduled_posts")
    .insert({
      user_id: user.id,
      profile_id: profileLocalId,
      carousel_id: body.carouselId ?? null,
      zernio_post_id: zernioPost._id,
      status: "scheduled",
      content,
      platforms: platformsJson,
      scheduled_for: body.scheduledFor,
      timezone: body.timezone || DEFAULT_TZ,
      source: "manual",
      raw: zernioPost,
    })
    .select("*")
    .single();

  if (insErr) {
    // Zernio já criou o post, log do divergence é o que importa.
    console.error("[promote-direct] DB insert err após Zernio create:", {
      zernioId: zernioPost._id,
      err: insErr.message,
    });
    return Response.json(
      {
        post: { zernio_post_id: zernioPost._id, raw: zernioPost },
        warning: `Criado no Zernio mas falhou no DB: ${insErr.message}`,
      },
      { status: 201 }
    );
  }

  return Response.json({ post: row }, { status: 201 });
}
