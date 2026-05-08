import {
  stripe,
  FREE_PLAN_USAGE_LIMIT,
  isPaidPlanId,
  stripePaymentAmountUsd,
  usageLimitForPaidPlan,
} from "@/lib/stripe";
import { PLANS } from "@/lib/pricing";
import type { PlanId } from "@/lib/pricing";
import { createServiceRoleSupabaseClient } from "@/lib/server/auth";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  sendPaymentSuccess,
  sendPaymentFailed,
  sendOwnerSubscriptionAlert,
} from "@/lib/email/dispatch";
import { fireResendEvent } from "@/lib/integrations/resend/events";
import { removeFromOnboardingAudience } from "@/lib/server/resend-audience";
import { applyReferralPaidReward } from "@/lib/referrals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import crypto from "node:crypto";

export async function POST(request: Request) {
  const admin = createServiceRoleSupabaseClient();
  if (!admin) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for webhook processing" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  const allowUnverified =
    !isProd && process.env.ALLOW_UNVERIFIED_STRIPE_WEBHOOK === "true";

  // Em produção: signing secret é OBRIGATÓRIO. Sem ele, falha fechada.
  // Em dev/preview: pode rodar sem signature só se a flag explícita estiver
  // setada (pra testes com stripe-cli offline).
  if (isProd && !webhookSecret) {
    console.error(
      "[stripe webhook] STRIPE_WEBHOOK_SECRET ausente em produção — refusing all events"
    );
    return Response.json(
      { error: "Webhook não configurado corretamente." },
      { status: 503 }
    );
  }

  if (webhookSecret && signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
      return handleEvent(event, admin);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  // Faltou signature/secret. Em produção, isso foi bloqueado acima pela
  // guard de secret ausente; aqui significa que o atacante mandou uma
  // request SEM o header `stripe-signature`. Recuse.
  if (isProd) {
    return Response.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  if (!allowUnverified) {
    return Response.json(
      {
        error:
          "Missing Stripe webhook signature or secret. For local testing only, set ALLOW_UNVERIFIED_STRIPE_WEBHOOK=true (NON-PROD ONLY)",
      },
      { status: 400 }
    );
  }

  console.warn(
    "[stripe webhook] Processing without signature verification (ALLOW_UNVERIFIED_STRIPE_WEBHOOK) — dev/preview only"
  );
  let parsed: Stripe.Event;
  try {
    parsed = JSON.parse(body) as Stripe.Event;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return handleEvent(parsed, admin);
}

async function handleEvent(event: Stripe.Event, supabaseAdmin: SupabaseClient) {
  // Dedup: Stripe retries agressivos geram o mesmo event.id várias vezes.
  // Sem guard, cada retry duplica emails e payments INSERT. Tenta inserir
  // o event.id — se der conflito (já processado), retorna 200 sem fazer
  // nada. Idempotência garantida.
  try {
    const { error } = await supabaseAdmin
      .from("stripe_events_processed")
      .insert({
        event_id: event.id,
        event_type: event.type,
      });
    if (error) {
      // Unique violation = já processado.
      if (error.code === "23505") {
        console.info("[stripe webhook] event já processado, skip:", event.id);
        return Response.json({ ok: true, deduped: true });
      }
      // Outro erro (ex: tabela não existe ainda em preview): loga mas
      // continua processando — não bloqueia negócio por falha de dedup.
      console.warn("[stripe webhook] dedup insert falhou, seguindo:", error.message);
    }
  } catch (err) {
    console.warn("[stripe webhook] dedup exception, seguindo:", err);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        metadata?: {
          userId?: string;
          planId?: string;
          svCouponCode?: string;
          referralCode?: string;
        };
        subscription?: string;
        customer?: string;
        customer_email?: string;
        id?: string;
      };

      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      const svCouponCode = session.metadata?.svCouponCode;
      const referralCode = session.metadata?.referralCode;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (userId && planId && isPaidPlanId(planId)) {
        const usageLimit = usageLimitForPaidPlan(planId);

        // Update user plan in Supabase
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: planId,
            usage_limit: usageLimit,
            usage_count: 0,
            ...(customerId ? { stripe_customer_id: customerId } : {}),
            ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
          })
          .eq("id", userId);

        if (error) {
          console.error("Failed to update profile plan:", error);
        }

        // Record payment
        const { error: payErr } = await supabaseAdmin.from("payments").insert({
          user_id: userId,
          amount_usd: stripePaymentAmountUsd(planId),
          currency: "USD",
          method: "stripe",
          status: "confirmed",
          plan: planId,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (payErr) {
          console.error("[stripe webhook] Failed to record payment:", payErr.message);
        }

        getPostHogClient().capture({
          distinctId: userId,
          event: "subscription_confirmed",
          properties: {
            plan: planId,
            amount_usd: stripePaymentAmountUsd(planId),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          },
        });

        // Se a sessão trouxe um svCouponCode, registra a redemption e
        // incrementa atomicamente o contador de uso. Não bloqueia upgrade se falhar.
        if (svCouponCode) {
          try {
            const { data: couponRow } = await supabaseAdmin
              .from("coupons")
              .select("id,discount_pct,discount_amount_cents")
              .ilike("code", svCouponCode)
              .maybeSingle();
            if (couponRow?.id) {
              await supabaseAdmin.rpc("increment_coupon_use", {
                coupon_id: couponRow.id,
              });
              await supabaseAdmin.from("coupon_redemptions").insert({
                coupon_id: couponRow.id,
                user_id: userId,
                code: svCouponCode,
                discount_pct: couponRow.discount_pct,
                discount_amount_cents: couponRow.discount_amount_cents,
                stripe_session_id: session.id,
              });
            }
          } catch (e) {
            console.warn("[stripe webhook] falha ao contabilizar cupom:", e);
          }
        }

        // Programa Indique-e-Ganhe v2 (2026-05-08) — referrer ganha
        // +N carrosséis no `usage_limit` do mês corrente (NÃO mais saldo
        // Stripe). Idempotente via unique key (referred_user, subscription,
        // type) na tabela `referral_credits`. Silencioso em qualquer falha
        // pra nao quebrar o webhook.
        //
        // Resolução do referrer (em ordem):
        //   1) Linha pending/signup em `referrals` (caso normal — user
        //      veio de ?ref= no signup).
        //   2) Fallback: `subscription.discount.coupon.metadata.referrer_user_id`
        //      — cobre o caso onde o cupom dinâmico foi usado mas o user
        //      pulou /track no signup (ex: criou conta antes, link no
        //      Whatsapp do amigo só virou checkout direto).
        if (userId) {
          let fallbackReferrerUserId: string | null = null;
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ["discount.coupon"],
              });
              const couponMeta = (
                sub as unknown as {
                  discount?: { coupon?: { metadata?: { referrer_user_id?: string } } };
                }
              )?.discount?.coupon?.metadata;
              if (couponMeta?.referrer_user_id) {
                fallbackReferrerUserId = couponMeta.referrer_user_id;
              }
            } catch (err) {
              console.warn(
                "[stripe webhook] falha lendo subscription.discount.coupon.metadata:",
                err
              );
            }
          }

          try {
            const result = await applyReferralPaidReward({
              referredUserId: userId,
              stripeSessionId: session.id,
              stripeSubscriptionId: subscriptionId,
              fallbackReferrerUserId,
              supabaseAdmin,
            });
            if (!result.ok && result.reason && result.reason !== "no_referral") {
              console.warn(
                "[stripe webhook] applyReferralPaidReward nao aplicado:",
                result.reason
              );
            }
          } catch (err) {
            console.error(
              "[stripe webhook] applyReferralPaidReward exception:",
              err
            );
          }
        }
        void referralCode; // legado — referralCode metadata mantido só pra debug

        // Email de confirmação (não bloqueia o webhook)
        const { data: profileRow } = await supabaseAdmin
          .from("profiles")
          .select("name,email")
          .eq("id", userId)
          .single();
        const recipientEmail = profileRow?.email || session.customer_email;
        if (recipientEmail) {
          const planMeta = PLANS[planId];
          const carouselsPerMonth: number = planMeta.carouselsPerMonth;
          await sendPaymentSuccess(
            { email: recipientEmail, name: profileRow?.name || undefined },
            { planName: planMeta.name, carouselsPerMonth }
          );

          // Lifecycle: dispara evento Resend pra Automations de upgrade.
          await fireResendEvent("sv.upgraded", {
            email: recipientEmail,
            user_id: userId,
            plan: planId,
            amount_usd: stripePaymentAmountUsd(planId),
            coupon: svCouponCode || null,
          });
        }

        // Owner alert — notifica o Gabriel de cada nova assinatura paga.
        // Helper já tem try/catch interno; nunca quebra o webhook.
        await sendOwnerSubscriptionAlert({
          email: profileRow?.email || session.customer_email || null,
          planName: PLANS[planId]?.name || planId,
          planId,
          amountBrl: stripePaymentAmountUsd(planId),
          userId,
          customerId,
          subscriptionId,
        });

        // Stop condition do drip onboarding — lead virou cliente pagante,
        // não faz sentido continuar recebendo "ative sua conta" + cupom
        // VIRAL50. Remove da audience SV (a automation `SV — Onboarding
        // completo` dispara em `contact.created` dentro dela; tirar o
        // contact pausa as próximas etapas). Não toca em outras audiences
        // (Kaleidos Leads, Madureira Newsletter). Helper tem try/catch
        // interno e nunca lança.
        const onboardingRemovalEmail =
          profileRow?.email || session.customer_email || null;
        if (onboardingRemovalEmail) {
          await removeFromOnboardingAudience({ email: onboardingRemovalEmail });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Subscription cancelled — downgrade to free
      const subscription = event.data.object as { metadata?: { userId?: string } };
      const userId = subscription.metadata?.userId;

      if (userId) {
        const { error: downgradeErr } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "free",
            usage_limit: FREE_PLAN_USAGE_LIMIT,
          })
          .eq("id", userId);
        if (downgradeErr) {
          console.error("[stripe webhook] Failed to downgrade user to free:", downgradeErr.message);
        }

        getPostHogClient().capture({
          distinctId: userId,
          event: "subscription_cancelled",
          properties: { downgraded_to: "free" },
        });

        // Lifecycle: dispara evento Resend pra Automation de cancel.
        // Handler atual só tem userId, então buscamos o email do profile.
        // Sem email, skip silencioso.
        const { data: cancelProfile } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        if (cancelProfile?.email) {
          await fireResendEvent("sv.canceled", {
            email: cancelProfile.email,
            user_id: userId,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      // Trata upgrade/downgrade mid-cycle e mudança de status (active ⇄ past_due).
      const subscription = event.data.object as Stripe.Subscription & {
        metadata?: { userId?: string; planId?: string };
      };
      let userId = subscription.metadata?.userId;
      const metadataPlanId = subscription.metadata?.planId;
      const status = subscription.status;

      // Fallback: mudanças via Stripe Billing Portal (user mexe no plano
      // pelo customer portal) NÃO carregam metadata.userId — só Checkout
      // popula isso. Resolvemos via stripe_customer_id buscando o profile
      // que tem esse customer linked. Sem fallback, upgrade/downgrade do
      // portal era silenciosamente ignorado.
      if (!userId) {
        const customerId = subscription.customer as string | undefined;
        if (customerId) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (profile?.id) {
            const resolvedUserId = String(profile.id);
            userId = resolvedUserId;
            // P3-3 audit 2026-05-08: log de userId+customerId rebaixado
            // pra hashes curtos. Suficiente pra correlacionar com event
            // por Sentry/Stripe dashboard sem ficar com PII em retention.
            const shortHash = (s: string) =>
              crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);
            console.log(
              "[stripe webhook] subscription.updated resolved via customer_id:",
              {
                customerHash: shortHash(customerId),
                userHash: shortHash(resolvedUserId),
              }
            );
          }
        }
      }

      if (!userId) {
        console.warn(
          "[stripe webhook] subscription.updated sem userId resolvable — ignorando",
          subscription.id
        );
        break;
      }

      // Deduz o plano atual a partir do price.id quando disponível (caso o user tenha trocado).
      let resolvedPlan: PlanId | null = null;
      try {
        const items = subscription.items?.data || [];
        for (const item of items) {
          const priceId = item.price?.id;
          if (!priceId) continue;
          if (priceId === process.env.STRIPE_PRICE_PRO) resolvedPlan = "pro";
          else if (priceId === process.env.STRIPE_PRICE_BUSINESS) resolvedPlan = "business";
        }
      } catch (e) {
        console.warn("[stripe webhook] falha ao ler items da subscription:", e);
      }

      if (!resolvedPlan && metadataPlanId && isPaidPlanId(metadataPlanId)) {
        resolvedPlan = metadataPlanId;
      }

      // Se cancelou no fim do período / past_due → mantém plano pago mas não força.
      // Se `cancel_at_period_end` for true, ainda é pago; só volta pra free no deleted.
      if (status === "unpaid" || status === "canceled" || status === "incomplete_expired") {
        const { error: downErr } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: "free",
            usage_limit: FREE_PLAN_USAGE_LIMIT,
          })
          .eq("id", userId);
        if (downErr) {
          console.error(
            "[stripe webhook] falha downgrade subscription.updated:",
            downErr.message
          );
        }
        getPostHogClient().capture({
          distinctId: userId,
          event: "subscription_updated",
          properties: { new_status: status, downgraded_to: "free" },
        });

        // Lifecycle: downgrade pra free → trata como cancel.
        const { data: downProfile } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        if (downProfile?.email) {
          await fireResendEvent("sv.canceled", {
            email: downProfile.email,
            user_id: userId,
          });
        }
      } else if (resolvedPlan) {
        const usageLimit = usageLimitForPaidPlan(resolvedPlan);
        const { error: upErr } = await supabaseAdmin
          .from("profiles")
          .update({
            plan: resolvedPlan,
            usage_limit: usageLimit,
            stripe_subscription_id: subscription.id,
          })
          .eq("id", userId);
        if (upErr) {
          console.error("[stripe webhook] falha sync plano:", upErr.message);
        }
        getPostHogClient().capture({
          distinctId: userId,
          event: "subscription_updated",
          properties: { new_status: status, plan: resolvedPlan },
        });

        // Lifecycle: upgrade/troca pra plano pago → fire upgrade event.
        const { data: upProfile } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        if (upProfile?.email) {
          await fireResendEvent("sv.upgraded", {
            email: upProfile.email,
            user_id: userId,
            plan: resolvedPlan,
          });

          // Stop condition do drip onboarding — cobre o caso edge de
          // upgrade direto via Stripe Billing Portal (sem checkout novo,
          // só troca de plano). Sem isso, lead que já tava na audience
          // continuaria recebendo o drip mesmo virando pagante.
          await removeFromOnboardingAudience({ email: upProfile.email });
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      // Cobrança recorrente falhou. Não downgrade imediato — Stripe tenta de novo.
      // Apenas notifica o user pra atualizar o cartão via portal.
      const invoice = event.data.object as Stripe.Invoice & {
        customer?: string;
      };
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) break;

      // Encontra o profile por stripe_customer_id
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id,name,email,plan,stripe_subscription_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (!profile?.email) {
        console.warn(
          "[stripe webhook] invoice.payment_failed: profile não achado para customer",
          customerId
        );
        break;
      }

      const planId = (profile.plan || "pro") as PlanId;
      const planMeta = PLANS[planId] ?? PLANS.pro;
      const amountUsd =
        typeof invoice.amount_due === "number"
          ? invoice.amount_due / 100
          : null;

      // Tenta criar um billing portal session pro user arrumar o cartão
      let portalUrl: string | undefined;
      try {
        const returnUrl = `${
          process.env.NEXT_PUBLIC_APP_URL || "https://sequencia-viral.vercel.app"
        }/app/settings`;
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        portalUrl = portal.url;
      } catch (e) {
        console.warn("[stripe webhook] billingPortal session falhou:", e);
      }

      // Registra tentativa falha em payments
      await supabaseAdmin.from("payments").insert({
        user_id: profile.id,
        amount_usd: amountUsd ?? 0,
        currency: (invoice.currency || "usd").toUpperCase(),
        method: "stripe",
        status: "failed",
        plan: planId,
      });

      getPostHogClient().capture({
        distinctId: profile.id,
        event: "payment_failed",
        properties: {
          amount_usd: amountUsd,
          plan: planId,
          attempt_count: invoice.attempt_count,
        },
      });

      // Email ao user (não bloqueia)
      await sendPaymentFailed(
        { email: profile.email, name: profile.name || undefined },
        {
          planName: planMeta.name,
          amountUsd,
          portalUrl,
        }
      );

      // Lifecycle: dispara evento Resend pra Automation de dunning.
      await fireResendEvent("sv.payment.failed", {
        email: profile.email,
        user_id: profile.id,
        plan: planId,
        amount_usd: amountUsd,
        attempt_count: invoice.attempt_count,
      });
      break;
    }
  }

  return Response.json({ received: true });
}
