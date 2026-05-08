/**
 * Sistema de referral — helpers server-side.
 *
 * Mecânica (refeita 2026-05-08, 2 eventos):
 *   - Pro REFERIDO (quem é convidado): 30% off no primeiro mês via cupom
 *     Stripe DINÂMICO criado por referrer (`MAD-X8K2-...`). O cupom carrega
 *     `metadata.referrer_user_id` pra garantir rastreio no webhook mesmo
 *     se o `referralCode` do localStorage tiver sumido entre signup e
 *     checkout.
 *   - Pro REFERRER (quem indicou) — DOIS gatilhos somáveis:
 *       1) ATIVAÇÃO — amigo cria PRIMEIRO carrossel ⇒ +5 carrosséis
 *          (`REFERRAL_BONUS_ACTIVATION`, default 5)
 *       2) PAGAMENTO — amigo paga primeira fatura ⇒ +20 carrosséis
 *          (`REFERRAL_BONUS_PAID`, default 20)
 *     Ambos somam diretamente em `profiles.usage_limit` (mês corrente).
 *     **Sem mexer em customer.balance Stripe.**
 *
 * Atomicity / idempotency:
 *   - RPC `grant_referral_carousels_bonus(p_type=...)` (Postgres) faz INSERT
 *     em `referral_credits` com unique key (referred_user_id, subscription_id,
 *     type) + UPDATE atômico em `profiles.usage_limit` na mesma transação.
 *     - paid_bonus: dedup por subscription_id (1 crédito por sub).
 *     - activation_bonus: dedup por referee (subscription_id NULL,
 *       só pode acontecer 1× por amigo).
 *
 * Todas as funções recebem o supabaseAdmin (service role) explicitamente
 * porque são chamadas de webhooks/API routes que já têm o client em scope.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { fireResendEvent } from "@/lib/integrations/resend/events";
import {
  sendReferralConverted,
  sendReferralActivation,
} from "@/lib/email/dispatch";

/**
 * Bônus quando o amigo cria o PRIMEIRO carrossel (ativação).
 * Default 5 — override via env var `REFERRAL_BONUS_ACTIVATION`.
 */
export const REFERRAL_BONUS_ACTIVATION: number = (() => {
  const raw = Number(process.env.REFERRAL_BONUS_ACTIVATION || "");
  if (!Number.isFinite(raw) || raw <= 0) return 5;
  return Math.floor(raw);
})();

/**
 * Bônus quando o amigo paga a primeira fatura (conversão).
 * Default 20 — override via env var `REFERRAL_BONUS_PAID`.
 *
 * `REFERRAL_CAROUSELS_BONUS` é mantido como alias deprecado pra UI/email
 * antigos enquanto os call-sites são atualizados.
 */
export const REFERRAL_BONUS_PAID: number = (() => {
  const raw = Number(process.env.REFERRAL_BONUS_PAID || "");
  if (!Number.isFinite(raw) || raw <= 0) return 20;
  return Math.floor(raw);
})();

/** @deprecated usar REFERRAL_BONUS_PAID. Mantido até remover todos call-sites. */
export const REFERRAL_CAROUSELS_BONUS: number = REFERRAL_BONUS_PAID;

/**
 * Desconto aplicado ao convidado no primeiro mês. Hard-coded pra alinhar
 * com a copy pública. Ajustar aqui + na page de referrals se mudar.
 */
export const REFERRAL_FRIEND_DISCOUNT_PCT = 30 as const;

/**
 * Gera codigo de referral baseado no nome.
 *   "Gabriel Madureira" -> "GABRIEL-X8K2"
 *   ""                  -> "USER-X8K2"
 *
 * Slug: primeira palavra do nome em uppercase, ASCII-only, max 12 chars.
 * Sufixo: 4 chars random alfa-num (sem 0/1/O/I pra evitar confusao visual).
 */
const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
}

function nameSlug(name: string | null | undefined): string {
  const raw = (name || "").trim().split(/\s+/)[0] || "USER";
  // Remove acentos e caracteres nao-ASCII, mantem so [A-Z0-9].
  const ascii = raw
    .normalize("NFD")
    // Remove combining diacritical marks (U+0300–U+036F) — uso \p{M}
    // pra evitar problemas com encoding do source file.
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (ascii || "USER").slice(0, 12);
}

export function generateReferralCode(name: string | null | undefined): string {
  return `${nameSlug(name)}-${randomSuffix()}`;
}

/**
 * Busca/gera o codigo do user. Garante unicidade tentando ate 5x — colisao
 * em codigo random de ~33^4 (~1.2M) com base de users <100k e
 * extremamente improvavel, mas o loop fecha o caso degenerado.
 *
 * Race-safe: faz UPDATE ... where referral_code is null, entao se 2
 * requests rodarem em paralelo so 1 vence e o outro re-le o profile.
 */
export async function getOrCreateReferralCode(
  userId: string,
  supabaseAdmin: SupabaseClient
): Promise<string | null> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("referral_code, name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[referrals] getOrCreateReferralCode select failed:", error.message);
    return null;
  }
  if (!profile) {
    console.warn("[referrals] profile nao encontrado:", userId);
    return null;
  }

  if (profile.referral_code) return profile.referral_code as string;

  // Tenta gerar codigo unico (max 5 tentativas).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode((profile.name as string) || null);
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("referral_code", code)
      .maybeSingle();
    if (existing) continue;

    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId)
      .is("referral_code", null);

    if (updErr) {
      console.warn("[referrals] update referral_code falhou, retry:", updErr.message);
      continue;
    }

    // Re-le pra cobrir race onde outro request setou o codigo entre o select e o update.
    const { data: reread } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();
    return (reread?.referral_code as string) || code;
  }

  console.error("[referrals] falha gerando codigo unico apos 5 tentativas");
  return null;
}

/**
 * Resolve o userId do referrer a partir de um codigo. Case-insensitive.
 * Retorna null se nao encontrou.
 */
export async function findReferrerByCode(
  code: string,
  supabaseAdmin: SupabaseClient
): Promise<{ userId: string; email: string | null; name: string | null } | null> {
  if (!code || !code.trim()) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name")
    .ilike("referral_code", code.trim())
    .maybeSingle();
  if (error || !data) return null;
  return {
    userId: data.id as string,
    email: (data.email as string) || null,
    name: (data.name as string) || null,
  };
}

/**
 * Cria (ou reusa) um cupom dinâmico no Stripe atrelado ao referrer.
 *   - 30% off, duration: once (só primeiro mês)
 *   - metadata.referrer_user_id = ID do indicador
 *   - id estável: `ref_<REFERRAL_CODE_LOWER>` — chamadas repetidas
 *     reusam o mesmo cupom (idempotente). Permite múltiplos amigos
 *     usarem o mesmo cupom (multi-use), todos rastreiam o mesmo referrer.
 *
 * Retorna o coupon.id pra passar no `discounts` do Checkout.
 */
export async function getOrCreateReferralStripeCoupon(args: {
  referrerUserId: string;
  referralCode: string;
}): Promise<string | null> {
  const { referrerUserId, referralCode } = args;
  const cleanCode = referralCode.trim();
  if (!cleanCode) return null;

  // Stripe coupon ID: max 64 chars, [A-Za-z0-9_]. Lower + replace `-` por `_`.
  const couponId = `ref_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, "_")}`.slice(0, 64);

  try {
    // Tenta reusar.
    const existing = await stripe.coupons.retrieve(couponId).catch(() => null);
    if (existing && (existing as { id?: string }).id) {
      return existing.id;
    }

    const created = await stripe.coupons.create({
      id: couponId,
      name: `Indique e ganhe — ${cleanCode}`,
      duration: "once",
      percent_off: REFERRAL_FRIEND_DISCOUNT_PCT,
      metadata: {
        referrer_user_id: referrerUserId,
        referral_code: cleanCode,
        source: "sv_referral_program_v2",
      },
    });
    return created.id;
  } catch (err) {
    console.warn("[referrals] getOrCreateReferralStripeCoupon falhou:", err);
    return null;
  }
}

/**
 * Registra signup com referral. Insere uma linha em `referrals` com
 * status='signup'. Idempotente por (referrer, referred_user_id):
 * se ja existe linha pro mesmo par, nao duplica.
 *
 * Auto-referral guard: se referrer == referred, retorna sem inserir.
 */
export async function recordReferralSignup(args: {
  referralCode: string;
  referredEmail: string;
  referredUserId: string;
  supabaseAdmin: SupabaseClient;
}): Promise<{ ok: boolean; referrerUserId?: string; reason?: string }> {
  const { referralCode, referredEmail, referredUserId, supabaseAdmin } = args;
  const referrer = await findReferrerByCode(referralCode, supabaseAdmin);
  if (!referrer) return { ok: false, reason: "referrer_not_found" };

  if (referrer.userId === referredUserId) {
    return { ok: false, reason: "self_referral_blocked" };
  }

  // Idempotencia: se ja existe linha pra esse referred_user, atualiza ao
  // inves de duplicar.
  const { data: existing } = await supabaseAdmin
    .from("referrals")
    .select("id, status")
    .eq("referrer_user_id", referrer.userId)
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "pending") {
      await supabaseAdmin
        .from("referrals")
        .update({ status: "signup", signup_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return { ok: true, referrerUserId: referrer.userId };
  }

  const { error: insErr } = await supabaseAdmin.from("referrals").insert({
    referrer_user_id: referrer.userId,
    referred_email: referredEmail.toLowerCase().trim(),
    referred_user_id: referredUserId,
    referral_code: referralCode.trim(),
    status: "signup",
    signup_at: new Date().toISOString(),
  });
  if (insErr) {
    console.error("[referrals] insert signup falhou:", insErr.message);
    return { ok: false, reason: insErr.message };
  }

  return { ok: true, referrerUserId: referrer.userId };
}

/**
 * Aplica recompensa de PAGAMENTO quando o referido paga primeira fatura.
 * Chamado no webhook de checkout.session.completed.
 *
 * Steps:
 *  1) Resolve o referrer: tenta primeiro pela coluna `referrals` (linha
 *     pending/signup pra esse referredUser). Se não encontrar mas a
 *     subscription tem `coupon.metadata.referrer_user_id`, usa esse.
 *  2) Chama RPC `grant_referral_carousels_bonus(p_type='paid_bonus')` —
 *     atomic INSERT em referral_credits + UPDATE em profiles.usage_limit.
 *     Idempotente por unique (referred, subscription, type).
 *  3) Marca referral como converted + reward_applied=true.
 *  4) Dispara evento Resend e email transacional.
 *
 * **Importante:** NÃO mexe em customer.balance Stripe. O bônus é local
 * (carrosséis adicionados ao usage_limit do mês corrente).
 */
export async function applyReferralPaidReward(args: {
  referredUserId: string;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
  /**
   * Se o webhook conseguiu extrair `referrer_user_id` do
   * `subscription.discount.coupon.metadata`, passar aqui pra resolver o
   * referrer mesmo sem linha em `referrals` (caso onde o user pulou o
   * track e foi direto pro checkout com cupom).
   */
  fallbackReferrerUserId?: string | null;
  supabaseAdmin: SupabaseClient;
}): Promise<{ ok: boolean; reason?: string; applied?: boolean }> {
  const {
    referredUserId,
    stripeSessionId,
    stripeSubscriptionId,
    fallbackReferrerUserId,
    supabaseAdmin,
  } = args;

  // 1) Tenta achar referral pendente pelo referredUser.
  const { data: referral, error: refErr } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_user_id, reward_applied, status")
    .eq("referred_user_id", referredUserId)
    .in("status", ["pending", "signup"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (refErr) {
    console.warn("[referrals] applyReferralPaidReward select erro:", refErr.message);
    return { ok: false, reason: refErr.message };
  }

  let referrerUserId: string | null = null;
  let referralId: string | null = null;

  if (referral) {
    if (referral.reward_applied) {
      return { ok: false, reason: "already_applied" };
    }
    referrerUserId = referral.referrer_user_id as string;
    referralId = referral.id as string;
  } else if (fallbackReferrerUserId) {
    // Fallback: cupom Stripe carregava metadata.referrer_user_id mas não
    // tinha linha em `referrals` (user pulou o /track). Cria a linha agora
    // pra preservar histórico + auditoria.
    if (fallbackReferrerUserId === referredUserId) {
      return { ok: false, reason: "self_referral_blocked" };
    }
    referrerUserId = fallbackReferrerUserId;
    const { data: createdRef } = await supabaseAdmin
      .from("referrals")
      .insert({
        referrer_user_id: fallbackReferrerUserId,
        referred_user_id: referredUserId,
        referred_email: "",
        referral_code: "via_coupon_metadata",
        status: "signup",
        signup_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    referralId = (createdRef?.id as string) || null;
  } else {
    // Nao tem indicacao pra esse user — fluxo normal, nao e erro.
    return { ok: false, reason: "no_referral" };
  }

  // 2) Chama RPC atomic. Idempotente via unique key.
  const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc(
    "grant_referral_carousels_bonus",
    {
      p_referrer_user_id: referrerUserId,
      p_referred_user_id: referredUserId,
      p_amount: REFERRAL_BONUS_PAID,
      p_referral_id: referralId,
      p_stripe_subscription_id: stripeSubscriptionId || null,
      p_stripe_session_id: stripeSessionId || null,
      p_type: "paid_bonus",
    }
  );

  if (rpcErr) {
    console.error("[referrals] RPC grant_referral_carousels_bonus falhou:", rpcErr.message);
    return { ok: false, reason: "rpc_failed" };
  }

  const rpcResult =
    Array.isArray(rpcRows) && rpcRows.length > 0
      ? (rpcRows[0] as { ok: boolean; applied: boolean; reason: string })
      : null;

  if (!rpcResult?.applied) {
    // Já creditado em chamada anterior — webhook duplicado, idempotente.
    if (referralId) {
      await supabaseAdmin
        .from("referrals")
        .update({
          status: "converted",
          conversion_at: new Date().toISOString(),
          stripe_session_id: stripeSessionId || null,
          reward_amount_cents: REFERRAL_BONUS_PAID, // reusa coluna pra exibir N
          reward_applied: true,
          reward_applied_at: new Date().toISOString(),
        })
        .eq("id", referralId);
    }
    return { ok: true, applied: false, reason: rpcResult?.reason || "already_credited" };
  }

  // 3) Marca referral como converted + reward_applied.
  if (referralId) {
    const { error: updErr } = await supabaseAdmin
      .from("referrals")
      .update({
        status: "converted",
        conversion_at: new Date().toISOString(),
        stripe_session_id: stripeSessionId || null,
        reward_amount_cents: REFERRAL_BONUS_PAID, // armazena N (pra UI)
        reward_applied: true,
        reward_applied_at: new Date().toISOString(),
      })
      .eq("id", referralId);
    if (updErr) {
      console.error("[referrals] update referral pos-credit falhou:", updErr.message);
      // Já creditou no usage_limit; não rollback.
    }
  }

  // 4) Email transacional + evento Resend (fire-and-forget).
  const { data: referrerProfile } = await supabaseAdmin
    .from("profiles")
    .select("email, name, usage_limit")
    .eq("id", referrerUserId)
    .maybeSingle();

  if (referrerProfile?.email) {
    await sendReferralConverted(
      {
        email: referrerProfile.email as string,
        name: (referrerProfile.name as string) || undefined,
      },
      {
        carouselsBonus: REFERRAL_BONUS_PAID,
        newUsageLimit: (referrerProfile.usage_limit as number | null) ?? null,
      }
    );
    await fireResendEvent("sv.referral.converted", {
      email: referrerProfile.email,
      user_id: referrerUserId,
      carousels_bonus: REFERRAL_BONUS_PAID,
      new_usage_limit: referrerProfile.usage_limit,
      referred_user_id: referredUserId,
    });
  }

  return { ok: true, applied: true };
}

/** @deprecated alias retrocompatível — usar `applyReferralPaidReward`. */
export const applyReferralReward = applyReferralPaidReward;

/**
 * Aplica recompensa de ATIVAÇÃO quando o referido cria seu PRIMEIRO
 * carrossel. Chamado de `app/api/generate/route.ts` no bloco que envia
 * o email "first carousel" (best-effort, não bloqueante).
 *
 * - Resolve referrer pelo `referrals` (qualquer status, exceto expired)
 *   onde referred_user_id = uid do criador do carrossel.
 * - Chama RPC com p_type='activation_bonus'. Idempotência via unique
 *   (referred_user_id, NULL subscription, 'activation_bonus') ⇒ só
 *   pode creditar 1× por referee.
 * - Email transacional pro referrer (sem affect no Resend Automation,
 *   evento separado pra reporting).
 *
 * **Não bloqueia** o caller — qualquer falha é logada e segue.
 */
export async function applyReferralActivationReward(args: {
  referredUserId: string;
  supabaseAdmin: SupabaseClient;
}): Promise<{ ok: boolean; reason?: string; applied?: boolean }> {
  const { referredUserId, supabaseAdmin } = args;

  // 1) Resolve referrer pela linha referrals desse referee.
  const { data: referral, error: refErr } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_user_id, status")
    .eq("referred_user_id", referredUserId)
    .in("status", ["pending", "signup", "converted"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (refErr) {
    console.warn("[referrals] applyReferralActivationReward select erro:", refErr.message);
    return { ok: false, reason: refErr.message };
  }
  if (!referral) {
    return { ok: false, reason: "no_referral" };
  }

  const referrerUserId = referral.referrer_user_id as string;
  const referralId = referral.id as string;

  if (referrerUserId === referredUserId) {
    return { ok: false, reason: "self_referral_blocked" };
  }

  // 2) RPC atomic. Idempotente — se rodar 2× pro mesmo referee, unique
  //    violation devolve {applied:false, reason:'already_credited'}.
  const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc(
    "grant_referral_carousels_bonus",
    {
      p_referrer_user_id: referrerUserId,
      p_referred_user_id: referredUserId,
      p_amount: REFERRAL_BONUS_ACTIVATION,
      p_referral_id: referralId,
      p_stripe_subscription_id: null,
      p_stripe_session_id: null,
      p_type: "activation_bonus",
    }
  );

  if (rpcErr) {
    console.error(
      "[referrals] RPC activation_bonus falhou:",
      rpcErr.message
    );
    return { ok: false, reason: "rpc_failed" };
  }

  const rpcResult =
    Array.isArray(rpcRows) && rpcRows.length > 0
      ? (rpcRows[0] as { ok: boolean; applied: boolean; reason: string })
      : null;

  if (!rpcResult?.applied) {
    return { ok: true, applied: false, reason: rpcResult?.reason || "already_credited" };
  }

  // 3) Email + evento (fire-and-forget).
  const { data: referrerProfile } = await supabaseAdmin
    .from("profiles")
    .select("email, name, usage_limit")
    .eq("id", referrerUserId)
    .maybeSingle();

  if (referrerProfile?.email) {
    try {
      await sendReferralActivation(
        {
          email: referrerProfile.email as string,
          name: (referrerProfile.name as string) || undefined,
        },
        {
          carouselsBonus: REFERRAL_BONUS_ACTIVATION,
          newUsageLimit: (referrerProfile.usage_limit as number | null) ?? null,
        }
      );
      await fireResendEvent("sv.referral.activated", {
        email: referrerProfile.email,
        user_id: referrerUserId,
        carousels_bonus: REFERRAL_BONUS_ACTIVATION,
        new_usage_limit: referrerProfile.usage_limit,
        referred_user_id: referredUserId,
      });
    } catch (err) {
      console.warn("[referrals] activation email/event falhou (não bloqueante):", err);
    }
  }

  return { ok: true, applied: true };
}
