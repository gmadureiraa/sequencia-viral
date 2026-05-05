/**
 * GET  /api/zernio/profiles  → lista profiles do admin (DB local)
 * POST /api/zernio/profiles  → cria profile no Zernio + persiste no DB local
 *
 * Admin-only. Cada profile = 1 marca/cliente (Madureira, Defiverso, DSEC...).
 * Profiles são containers que agrupam contas sociais — o Zernio recomenda
 * 1 profile por marca pra não misturar credenciais.
 */

import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { requireAdminOrPlan } from "@/lib/server/plan-gate";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  createZernioProfile,
  ZernioApiError,
  ZernioConfigError,
} from "@/lib/server/zernio";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CreateProfileBody {
  name?: string;
  description?: string;
}

export async function GET(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const sb = createServiceRoleSupabaseClient();
  if (!sb) {
    return Response.json({ error: "DB indisponível." }, { status: 503 });
  }

  const { data, error } = await sb
    .from("zernio_profiles")
    .select("*")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[zernio/profiles GET]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ profiles: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireAdminOrPlan(request);
  if (!gate.ok) return gate.response;
  const { user } = gate;

  // Profile creation é caro (1 round-trip Zernio + 1 DB) — cap 30/h por admin
  // pra evitar runaway loops em UI bugada.
  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-profile-create", user.id),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  let body: CreateProfileBody;
  try {
    body = (await request.json()) as CreateProfileBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const description = body.description?.trim() || undefined;
  if (name.length < 2 || name.length > 80) {
    return Response.json(
      { error: "Nome do profile precisa ter 2-80 chars." },
      { status: 400 }
    );
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Cria primeiro no Zernio — se DB insert falhar depois, vamos ter um
  // profile órfão lá, mas isso é melhor que ter um row no DB sem
  // contraparte real (= bug silencioso quando user tentar conectar).
  let zernioProfile;
  try {
    zernioProfile = await createZernioProfile({ name, description });
  } catch (err) {
    if (err instanceof ZernioConfigError) {
      return Response.json(
        { error: "ZERNIO_API_KEY ausente no servidor." },
        { status: 503 }
      );
    }
    if (err instanceof ZernioApiError) {
      console.error("[zernio/profiles POST] zernio api err:", err.status, err.message);
      return Response.json(
        { error: `Zernio: ${err.message}` },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    console.error("[zernio/profiles POST] unknown:", err);
    return Response.json({ error: "Falha ao criar profile no Zernio." }, { status: 500 });
  }

  const { data, error } = await sb
    .from("zernio_profiles")
    .insert({
      user_id: user.id,
      zernio_profile_id: zernioProfile._id,
      name,
      description,
      raw: zernioProfile,
    })
    .select("*")
    .single();

  if (error) {
    // Profile órfão no Zernio — log pra cleanup manual depois.
    console.error(
      "[zernio/profiles POST] DB insert failed após Zernio create",
      { zernioId: zernioProfile._id, err: error.message }
    );
    return Response.json(
      { error: `Profile criado no Zernio mas falhou no DB: ${error.message}` },
      { status: 500 }
    );
  }

  return Response.json({ profile: data }, { status: 201 });
}
