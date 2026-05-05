/**
 * GET /api/zernio/connect/:platform
 *
 * v2: profile interno é auto-criado no primeiro connect — UI não precisa
 * mais selecionar profile. Cada user tem 1 profile Zernio que agrupa
 * IG + LinkedIn + outras (contar de cada tipo: 1 active por plataforma,
 * garantido pela UNIQUE partial index em zernio_accounts).
 *
 * Retorna `{ authUrl }` que o front abre. Quando user autoriza, Zernio
 * redireciona pra `/app/admin/zernio/connected` que dispara sync.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { ensureUserHasZernioProfile } from "@/lib/server/zernio-default-profile";
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

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Auto-create profile (idempotente). Esconde o conceito de "profile" da UI.
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
        { error: `Zernio: ${err.message}` },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    console.error("[zernio/connect] ensure profile err:", err);
    return Response.json(
      { error: "Falha ao garantir profile Zernio." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/$/, "");
  const redirectUrl = `${appUrl}/app/admin/zernio/connected?platform=${encodeURIComponent(platform)}`;

  try {
    const { authUrl } = await getZernioConnectUrl({
      platform,
      profileId: zernioProfileId,
      redirectUrl,
    });
    return Response.json({ authUrl });
  } catch (err) {
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
