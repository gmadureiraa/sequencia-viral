/**
 * GET /api/zernio/connect/:platform?profileId=<uuid>
 *
 * Inicia o OAuth handshake com Zernio. Retorna `{ authUrl }` que o front
 * abre numa nova janela. Quando user autoriza, Zernio redireciona pra
 * `redirect_url` (que apontamos pra /api/zernio/connect/callback).
 *
 * Plataformas válidas espelham as do Zernio:
 *   twitter, instagram, linkedin, tiktok, facebook, youtube, bluesky,
 *   threads, pinterest, reddit, snapchat, telegram, googlebusiness
 *
 * O `profileId` no query é o UUID do nosso DB (zernio_profiles.id), NÃO o
 * zernio_profile_id externo. Resolvemos pra externa antes de chamar Zernio.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import {
  getZernioConnectUrl,
  ZernioApiError,
  ZernioConfigError,
  type ZernioPlatform,
} from "@/lib/server/zernio";

export const runtime = "nodejs";
export const maxDuration = 15;

const VALID_PLATFORMS: ReadonlySet<ZernioPlatform> = new Set([
  "twitter",
  "instagram",
  "linkedin",
  "tiktok",
  "facebook",
  "youtube",
  "bluesky",
  "threads",
  "pinterest",
  "reddit",
  "snapchat",
  "telegram",
  "googlebusiness",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const { platform: platformRaw } = await params;
  const platform = platformRaw.toLowerCase() as ZernioPlatform;
  if (!VALID_PLATFORMS.has(platform)) {
    return Response.json(
      { error: `Plataforma '${platformRaw}' não suportada.` },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const profileIdLocal = url.searchParams.get("profileId");
  if (!profileIdLocal) {
    return Response.json({ error: "profileId obrigatório." }, { status: 400 });
  }

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  const { data: profile, error: pErr } = await sb
    .from("zernio_profiles")
    .select("zernio_profile_id, user_id")
    .eq("id", profileIdLocal)
    .eq("user_id", user.id)
    .maybeSingle();
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 });
  if (!profile) {
    return Response.json({ error: "Profile não encontrado." }, { status: 404 });
  }

  // redirectUrl: pra onde o Zernio manda o user APÓS autorizar. Apontamos
  // pra rota de retorno no SV (front-side) que chama /api/zernio/accounts/sync
  // pra puxar a conta nova do Zernio e persistir no DB.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/$/, "");
  const redirectUrl = `${appUrl}/app/admin/zernio/connected?profileId=${encodeURIComponent(
    profileIdLocal
  )}&platform=${encodeURIComponent(platform)}`;

  try {
    const { authUrl } = await getZernioConnectUrl({
      platform,
      profileId: profile.zernio_profile_id,
      redirectUrl,
    });
    return Response.json({ authUrl });
  } catch (err) {
    if (err instanceof ZernioConfigError) {
      return Response.json(
        { error: "ZERNIO_API_KEY ausente no servidor." },
        { status: 503 }
      );
    }
    if (err instanceof ZernioApiError) {
      return Response.json(
        { error: `Zernio: ${err.message}` },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    console.error("[zernio/connect] unknown:", err);
    return Response.json({ error: "Falha ao iniciar OAuth." }, { status: 500 });
  }
}
