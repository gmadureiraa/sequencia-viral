/**
 * GET  /api/zernio/posts?profileId=&status=&limit=  → lista do DB local
 * POST /api/zernio/posts                            → cria no Zernio + DB
 *
 * Cria post no Zernio em 1 dos 3 modos:
 *   - schedule: scheduledFor + timezone (default)
 *   - publishNow: publica imediatamente
 *   - draft: salva rascunho (sem scheduledFor nem publishNow)
 *
 * Body:
 *   {
 *     profileId: string,                // UUID local (zernio_profiles.id)
 *     accountIds: string[],             // UUIDs locais (zernio_accounts.id)
 *     content: string,
 *     mediaUrls?: string[],             // URLs públicas (Supabase Storage etc.)
 *     mode: 'schedule' | 'publishNow' | 'draft',
 *     scheduledFor?: string,            // ISO sem TZ. Required em mode=schedule.
 *     timezone?: string,                // default America/Sao_Paulo
 *     title?: string,                   // YouTube/Pinterest
 *     carouselId?: string,              // FK opcional pra ligar com carrossel SV
 *     source?: 'manual' | 'autopilot',  // default 'manual'
 *   }
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  createZernioPost,
  ZernioApiError,
  ZernioConfigError,
  type ZernioPlatform,
  type ZernioPostPlatformTarget,
} from "@/lib/server/zernio";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CreatePostBody {
  profileId?: string;
  accountIds?: string[];
  content?: string;
  mediaUrls?: string[];
  mode?: "schedule" | "publishNow" | "draft";
  scheduledFor?: string;
  timezone?: string;
  title?: string;
  carouselId?: string;
  source?: "manual" | "autopilot";
}

const DEFAULT_TZ = "America/Sao_Paulo";

export async function GET(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const url = new URL(request.url);
  const profileId = url.searchParams.get("profileId");
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  let q = sb
    .from("zernio_scheduled_posts")
    .select("*")
    .eq("user_id", user.id)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (profileId) q = q.eq("profile_id", profileId);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ posts: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-post-create", user.id),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: CreatePostBody;
  try {
    body = (await request.json()) as CreatePostBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const profileId = body.profileId;
  const accountIds = body.accountIds ?? [];
  const content = (body.content ?? "").trim();
  const mode = body.mode ?? "schedule";
  const tz = body.timezone || DEFAULT_TZ;
  const source = body.source === "autopilot" ? "autopilot" : "manual";

  if (!profileId) return Response.json({ error: "profileId obrigatório." }, { status: 400 });
  if (accountIds.length === 0)
    return Response.json({ error: "Selecione ao menos 1 conta." }, { status: 400 });
  if (content.length === 0)
    return Response.json({ error: "Conteúdo vazio." }, { status: 400 });
  if (mode === "schedule" && !body.scheduledFor)
    return Response.json(
      { error: "scheduledFor obrigatório em mode=schedule." },
      { status: 400 }
    );

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Resolve profile + accounts: confirma que pertencem ao user e estão active.
  const { data: profile } = await sb
    .from("zernio_profiles")
    .select("id, zernio_profile_id")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return Response.json({ error: "Profile inválido." }, { status: 404 });

  const { data: accountRows, error: aErr } = await sb
    .from("zernio_accounts")
    .select("id, zernio_account_id, platform, status")
    .eq("user_id", user.id)
    .eq("profile_id", profileId)
    .in("id", accountIds);
  if (aErr) return Response.json({ error: aErr.message }, { status: 500 });
  if (!accountRows || accountRows.length !== accountIds.length) {
    return Response.json({ error: "1+ accountId inválido." }, { status: 400 });
  }
  const inactive = accountRows.filter((a) => a.status !== "active");
  if (inactive.length > 0) {
    return Response.json(
      {
        error: `Contas inativas selecionadas: ${inactive.map((a) => a.platform).join(", ")}. Reconecte antes.`,
      },
      { status: 400 }
    );
  }

  const platforms: ZernioPostPlatformTarget[] = accountRows.map((a) => ({
    platform: a.platform as ZernioPlatform,
    accountId: a.zernio_account_id,
  }));

  // Cria no Zernio
  let zernioPost;
  try {
    zernioPost = await createZernioPost({
      content,
      mediaUrls: body.mediaUrls && body.mediaUrls.length > 0 ? body.mediaUrls : undefined,
      title: body.title,
      timezone: mode === "draft" ? undefined : tz,
      scheduledFor: mode === "schedule" ? body.scheduledFor : undefined,
      publishNow: mode === "publishNow" ? true : undefined,
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
      console.error("[zernio/posts POST] zernio err:", err.status, err.message, err.body);
      return Response.json(
        { error: `Zernio: ${err.message}`, code: err.code },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    console.error("[zernio/posts POST] unknown:", err);
    return Response.json({ error: "Falha ao criar post no Zernio." }, { status: 500 });
  }

  // Persiste localmente
  const localStatus =
    mode === "draft"
      ? "draft"
      : mode === "publishNow"
        ? "publishing"
        : "scheduled";

  const { data: row, error: insErr } = await sb
    .from("zernio_scheduled_posts")
    .insert({
      user_id: user.id,
      profile_id: profileId,
      carousel_id: body.carouselId ?? null,
      zernio_post_id: zernioPost._id,
      status: localStatus,
      content,
      platforms,
      scheduled_for: mode === "schedule" ? body.scheduledFor : null,
      timezone: tz,
      source,
      raw: zernioPost,
    })
    .select("*")
    .single();

  if (insErr) {
    console.error("[zernio/posts POST] DB insert err após Zernio create:", {
      zernioId: zernioPost._id,
      err: insErr.message,
    });
    // Não falha a request — Zernio já tem o post, log do divergence é o que importa.
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
