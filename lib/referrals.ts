/**
 * Sistema de referral — helpers server-side.
 *
 * Mecanica:
 *   - Pro referido (quem e convidado): cupom Stripe AMIGOPRO30 (30% off 1o mes).
 *     O cupom em si vive no Stripe Dashboard como `promotion_code` e/ou na
 *     tabela `coupons` se quisermos amarrar local — aqui apenas registramos
 *     a indicacao. O desconto aplicado e responsabilidade do checkout flow.
 *   - Pro referrer (quem indicou): 1 mês grátis de Pro em customer.balance no
 *     Stripe (= valor do Pro mensal) quando o referido paga primeira fatura.
 *     Abate auto na próxima cobrança. Acumula sem limite.
 *
 * Todas as funcoes recebem o supabaseAdmin (service role) explicitamente
 * porque sao chamadas de webhooks/API routes que ja tem o client em scope.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { fireResendEvent } from "@/lib/integrations/resend/events";
import { sendReferralConverted } from "@/lib/email/dispatch";
import { PLANS } from "@/lib/pricing";

/**
 * Recompensa = preço cheio de 1 mês do Pro. Importado direto de
 * PLANS.pro.priceMonthly pra ficar sempre em sync. Quando o Pro mudar de
 * preço, o reward acompanha automaticamente.
 *
 * UI mostra "1 mês grátis de Pro" — credit BRL é só o mecanismo Stripe.
 */
export const REFERRAL_REWARD_CENTS: number = PLANS.pro.priceMonthly;
export const REFERRAL_REWARD_LABEL = "1 mês grátis de Pro" as const;

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
 * Aplica recompensa quando o referido paga. Chamado no webhook de
 * checkout.session.completed. Idempotente — se a linha ja foi marcada
 * `reward_applied`, nao credita de novo.
 *
 * Steps:
 *  1) Acha a linha referrals pelo referredUserId (status signup ou pending).
 *  2) Busca stripe_customer_id do referrer.
 *  3) Cria customer.balanceTransaction de -2500 BRL (negativo = credito).
 *  4) Marca referral como converted + reward_applied=true.
 *  5) Incrementa profiles.referral_credits_cents do referrer (info).
 *  6) Dispara evento Resend e email transacional.
 */
export async function applyReferralReward(args: {
  referredUserId: string;
  stripeSessionId?: string | null;
  supabaseAdmin: SupabaseClient;
}): Promise<{ ok: boolean; reason?: string }> {
  const { referredUserId, stripeSessionId, supabaseAdmin } = args;

  const { data: referral, error: refErr } = await supabaseAdmin
    .from("referrals")
    .select("id, referrer_user_id, reward_applied, status")
    .eq("referred_user_id", referredUserId)
    .in("status", ["pending", "signup"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (refErr) {
    console.warn("[referrals] applyReferralReward select erro:", refErr.message);
    return { ok: false, reason: refErr.message };
  }
  if (!referral) {
    // Nao tem indicacao pra esse user — fluxo normal, nao e erro.
    return { ok: false, reason: "no_referral" };
  }
  if (referral.reward_applied) {
    return { ok: false, reason: "already_applied" };
  }

  const referrerUserId = referral.referrer_user_id as string;

  const { data: referrerProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name, stripe_customer_id, referral_credits_cents")
    .eq("id", referrerUserId)
    .maybeSingle();

  if (!referrerProfile?.stripe_customer_id) {
    console.warn(
      "[referrals] referrer sem stripe_customer_id — registrando indicacao mas sem credito Stripe imediato:",
      referrerUserId
    );
    // Marca converted mas reward_applied=false; admin pode reprocessar manualmente
    // depois quando o referrer fizer checkout (e ganhar customer_id).
    await supabaseAdmin
      .from("referrals")
      .update({
        status: "converted",
        conversion_at: new Date().toISOString(),
        stripe_session_id: stripeSessionId || null,
        reward_amount_cents: REFERRAL_REWARD_CENTS,
      })
      .eq("id", referral.id);
    return { ok: false, reason: "referrer_no_stripe_customer" };
  }

  // Aplica credito no Stripe customer balance.
  // Negative amount em customer balance = credito (Stripe paga o user).
  // Doc: https://stripe.com/docs/api/customer_balance_transactions/create
  try {
    await stripe.customers.createBalanceTransaction(
      referrerProfile.stripe_customer_id as string,
      {
        amount: -REFERRAL_REWARD_CENTS, // negativo = credito (debit do balance)
        currency: "brl",
        description: `Indique e ganhe — recompensa por indicacao paga (referral ${referral.id})`,
        metadata: {
          referralId: referral.id as string,
          referrerUserId,
          referredUserId,
          source: "sv_referral_program",
        },
      }
    );
  } catch (err) {
    console.error("[referrals] falha criando balanceTransaction Stripe:", err);
    return { ok: false, reason: "stripe_balance_tx_failed" };
  }

  // Marca referral como converted.
  const { error: updErr } = await supabaseAdmin
    .from("referrals")
    .update({
      status: "converted",
      conversion_at: new Date().toISOString(),
      stripe_session_id: stripeSessionId || null,
      reward_amount_cents: REFERRAL_REWARD_CENTS,
      reward_applied: true,
      reward_applied_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  if (updErr) {
    console.error("[referrals] update referral falhou apos credito:", updErr.message);
    // O credito ja foi aplicado no Stripe; deixa fluxo seguir mesmo assim.
  }

  // Atualiza acumulador (info) no profile do referrer.
  const newTotal =
    (referrerProfile.referral_credits_cents as number | null ?? 0) +
    REFERRAL_REWARD_CENTS;
  await supabaseAdmin
    .from("profiles")
    .update({ referral_credits_cents: newTotal })
    .eq("id", referrerUserId);

  // Email transacional + evento Resend (fire-and-forget).
  if (referrerProfile.email) {
    await sendReferralConverted(
      { email: referrerProfile.email as string, name: (referrerProfile.name as string) || undefined },
      {
        rewardCents: REFERRAL_REWARD_CENTS,
        totalCreditCents: newTotal,
      }
    );
    await fireResendEvent("sv.referral.converted", {
      email: referrerProfile.email,
      user_id: referrerUserId,
      reward_cents: REFERRAL_REWARD_CENTS,
      total_credit_cents: newTotal,
      referred_user_id: referredUserId,
    });
  }

  return { ok: true };
}
