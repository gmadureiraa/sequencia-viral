/**
 * Helper pra garantir que o user tem 1 profile Zernio (interno) — usado
 * pra esconder o conceito de "profile" da UI v2. Cada user no SV tem
 * EXATAMENTE 1 profile Zernio que agrupa suas contas IG + LinkedIn.
 *
 * Race-free: tenta SELECT primeiro, se não existe, INSERT. Em caso de
 * race condition (2 requests simultâneas tentam criar), o segundo INSERT
 * falha pela constraint única em zernio_profile_id; rollback + re-SELECT.
 *
 * Side-effect: cria também o profile no Zernio API (round-trip externo).
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createZernioProfile } from "./zernio";

export interface UserProfileResult {
  /** UUID local do row em zernio_profiles. */
  localId: string;
  /** ID externo do profile no Zernio. */
  zernioProfileId: string;
}

/**
 * Garante que o user tem 1 profile Zernio. Cria se não existir. Idempotente.
 */
/** Profile criado pelo planned-posts placeholder pattern. NÃO existe no Zernio. */
const PLACEHOLDER_PROFILE_PATTERN = /^local-/;

export async function ensureUserHasZernioProfile(
  sb: SupabaseClient,
  user: User
): Promise<UserProfileResult> {
  // 1. Verifica se user já tem profile não-arquivado
  const { data: existing } = await sb
    .from("zernio_profiles")
    .select("id, zernio_profile_id")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Bug fix 2026-05-06: profile placeholder (criado pelo /api/zernio/planned-posts
    // quando user Pro adicionou entrada no calendário sem nunca ter conectado
    // Zernio) tem zernio_profile_id="local-XXX" — fake, não existe no Zernio.
    // Se passarmos esse ID adiante (connect, list accounts), tudo quebra:
    // - getZernioConnectUrl envia profileId inválido ao Zernio
    // - sync nunca persiste contas porque externalToLocal não tem mapeamento
    // - settings/autopilot/calendar mostram "sem contas" mesmo após OAuth ok
    //
    // Fix: se for placeholder, arquiva e cai no path de criação real.
    if (!PLACEHOLDER_PROFILE_PATTERN.test(existing.zernio_profile_id)) {
      return {
        localId: existing.id,
        zernioProfileId: existing.zernio_profile_id,
      };
    }
    // Arquiva placeholder pra continuar pra criação do real
    await sb
      .from("zernio_profiles")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  // 2. Cria no Zernio API
  const name = (user.user_metadata?.name as string) || user.email?.split("@")[0] || "Profile";
  const description = `Auto-criado pra ${user.email ?? "user"}`;
  const zernioProfile = await createZernioProfile({ name, description });

  // 3. Persiste localmente
  const { data: row, error } = await sb
    .from("zernio_profiles")
    .insert({
      user_id: user.id,
      zernio_profile_id: zernioProfile._id,
      name,
      description,
      raw: zernioProfile,
    })
    .select("id, zernio_profile_id")
    .single();

  if (error) {
    // Race? Outro request pode ter criado. Tenta re-SELECT.
    const { data: retried } = await sb
      .from("zernio_profiles")
      .select("id, zernio_profile_id")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (retried) {
      // Outro request ganhou — descarta o profile órfão criado no Zernio
      // (best-effort delete; se falhar, log e segue)
      try {
        const { deleteZernioProfile } = await import("./zernio");
        await deleteZernioProfile(zernioProfile._id);
      } catch (delErr) {
        console.warn(
          "[ensureUserHasZernioProfile] orphan profile delete failed:",
          delErr instanceof Error ? delErr.message : delErr
        );
      }
      return {
        localId: retried.id,
        zernioProfileId: retried.zernio_profile_id,
      };
    }
    throw new Error(`profile insert failed: ${error.message}`);
  }

  return { localId: row.id, zernioProfileId: row.zernio_profile_id };
}
