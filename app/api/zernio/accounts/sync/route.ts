/**
 * POST /api/zernio/accounts/sync?profileId=<uuid>
 *
 * Faz pull das contas do Zernio e reconcilia com nosso DB:
 *   - novas no Zernio       → INSERT em zernio_accounts
 *   - existem aqui mas sumiram do Zernio → marca status='disconnected'
 *   - encontradas em ambos  → atualiza handle/display_name/raw
 *
 * Chamada quando o user volta do redirect do OAuth (`/app/admin/zernio/connected`)
 * e periodicamente pelo botão "Atualizar contas" na UI.
 *
 * Se profileId presente, sync escopa àquele profile (passa profileId pro Zernio
 * pra reduzir payload). Sem profileId, sincroniza tudo do admin.
 */

import { requireAdmin, createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { rateLimit, getRateLimitKey } from "@/lib/server/rate-limit";
import {
  listZernioAccounts,
  ZernioApiError,
  ZernioConfigError,
} from "@/lib/server/zernio";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  const { user } = admin;

  const limiter = await rateLimit({
    key: getRateLimitKey(request, "zernio-accounts-sync", user.id),
    limit: 60,
    windowMs: 5 * 60 * 1000,
  });
  if (!limiter.allowed) {
    return Response.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfterSec) } }
    );
  }

  const url = new URL(request.url);
  const profileIdLocal = url.searchParams.get("profileId");

  const sb = createServiceRoleSupabaseClient();
  if (!sb) return Response.json({ error: "DB indisponível." }, { status: 503 });

  // Resolve profileId externo (do Zernio) a partir do local, se presente.
  // Mapping inteiro {externo → local} pro reconcile.
  let profileFilter: { externalId: string; localId: string } | null = null;
  const { data: allProfiles, error: pListErr } = await sb
    .from("zernio_profiles")
    .select("id, zernio_profile_id")
    .eq("user_id", user.id)
    .is("archived_at", null);
  if (pListErr) return Response.json({ error: pListErr.message }, { status: 500 });

  const externalToLocal = new Map<string, string>();
  for (const p of allProfiles ?? []) {
    externalToLocal.set(p.zernio_profile_id, p.id);
  }

  if (profileIdLocal) {
    const target = (allProfiles ?? []).find((p) => p.id === profileIdLocal);
    if (!target) {
      return Response.json({ error: "Profile não encontrado." }, { status: 404 });
    }
    profileFilter = { externalId: target.zernio_profile_id, localId: target.id };
  }

  let zernioAccounts;
  try {
    zernioAccounts = await listZernioAccounts({
      profileId: profileFilter?.externalId,
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
        { error: `Zernio: ${err.message}` },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 }
      );
    }
    console.error("[zernio/accounts/sync] unknown:", err);
    return Response.json({ error: "Falha ao listar contas Zernio." }, { status: 500 });
  }

  // Filtra só contas que pertencem a profiles do nosso DB. Defesa contra
  // contas órfãs (profile no Zernio que não está no DB) e contra leak entre
  // tenants (se 1 key Zernio mostrar coisas de outras keys, descartamos).
  const seenZernioIds = new Set<string>();
  let upserted = 0;
  for (const acc of zernioAccounts) {
    const externalProfileId = (acc.profileId as string | undefined) ?? null;
    if (!externalProfileId) continue;
    const localProfileId = externalToLocal.get(externalProfileId);
    if (!localProfileId) continue;

    const handle = (acc.username as string | undefined) ?? null;
    const displayName = (acc.displayName as string | undefined) ?? null;
    const status = (acc.status as string | undefined) ?? "active";

    seenZernioIds.add(acc._id);

    // Upsert por zernio_account_id (UNIQUE constraint)
    const { error: upErr } = await sb.from("zernio_accounts").upsert(
      {
        user_id: user.id,
        profile_id: localProfileId,
        zernio_account_id: acc._id,
        platform: acc.platform,
        handle,
        display_name: displayName,
        status,
        raw: acc,
        // connected_at fica como default NOW() no INSERT, mantém o mesmo no UPDATE
      },
      { onConflict: "zernio_account_id" }
    );

    if (upErr) {
      console.error("[zernio/accounts/sync] upsert err:", upErr.message);
      continue;
    }
    upserted++;
  }

  // Marca como disconnected as contas locais que SUMIRAM do Zernio (o admin
  // desconectou direto na UI do Zernio ou o token expirou e Zernio derrubou).
  // Escopo do mark-disconnected: profile específico se passado; senão tudo.
  let disconnectedCount = 0;
  let staleQuery = sb
    .from("zernio_accounts")
    .select("id, zernio_account_id")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (profileFilter) staleQuery = staleQuery.eq("profile_id", profileFilter.localId);

  const { data: localActive, error: staleErr } = await staleQuery;
  if (!staleErr && localActive) {
    const stale = localActive.filter((a) => !seenZernioIds.has(a.zernio_account_id));
    if (stale.length > 0) {
      const { error: updErr } = await sb
        .from("zernio_accounts")
        .update({
          status: "disconnected",
          disconnected_at: new Date().toISOString(),
        })
        .in(
          "id",
          stale.map((s) => s.id)
        );
      if (!updErr) disconnectedCount = stale.length;
    }
  }

  return Response.json({
    ok: true,
    synced: upserted,
    disconnected: disconnectedCount,
  });
}
