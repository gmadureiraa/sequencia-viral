/**
 * Despachos de email — funções de alto nível usadas por APIs, webhooks e crons.
 * Todo dispatch é tageado com `project:sequencia-viral` para isolar do resto
 * da conta Kaleidos Digital (blog leads, outras ferramentas, etc.) — permite
 * filtrar no dashboard Resend, rotear supression lists, e separar métricas.
 */

import { createElement } from "react";
import { sendEmail } from "./send";
import { WelcomeEmail } from "./templates/welcome";
import { ActivationNudgeEmail } from "./templates/activation-nudge";
import { FirstCarouselEmail } from "./templates/first-carousel";
import { PaymentSuccessEmail } from "./templates/payment-success";
import { PlanLimitEmail } from "./templates/plan-limit";
import { ReEngagementEmail } from "./templates/re-engagement";
import { OnboardingHowItWorksEmail } from "./templates/onboarding-how-it-works";
import { OnboardingFirstCaseEmail } from "./templates/onboarding-first-case";
import { OnboardingWhyUpgradeEmail } from "./templates/onboarding-why-upgrade";
import { PaymentFailedEmail } from "./templates/payment-failed";
import { LastChanceCouponEmail } from "./templates/last-chance-coupon";
import { ReferralConvertedEmail } from "./templates/referral-converted";

import { APP_URL } from "@/lib/app-url";

const PROJECT_TAG = { name: "project", value: "sequencia-viral" };
const ENV_TAG = {
  name: "env",
  value: process.env.NODE_ENV === "production" ? "prod" : "dev",
};

function lifecycleTag(value: string) {
  return { name: "lifecycle", value };
}

type Recipient = {
  email: string;
  name?: string;
};

export async function sendWelcome(user: Recipient) {
  return sendEmail({
    to: user.email,
    subject: "Bem-vindo ao Sequência Viral — estúdio pronto",
    react: WelcomeEmail({ name: user.name, appUrl: APP_URL }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("welcome")],
  });
}

export async function sendActivationNudge(user: Recipient) {
  return sendEmail({
    to: user.email,
    subject: "Cola um link e sai com carrossel em 60s",
    react: ActivationNudgeEmail({ name: user.name, appUrl: APP_URL }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("activation-nudge")],
  });
}

export async function sendFirstCarousel(
  user: Recipient,
  args: { carouselTitle: string }
) {
  return sendEmail({
    to: user.email,
    subject: "Primeiro carrossel salvo 👌",
    react: FirstCarouselEmail({
      name: user.name,
      carouselTitle: args.carouselTitle,
      appUrl: APP_URL,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("first-carousel")],
  });
}

export async function sendPaymentSuccess(
  user: Recipient,
  args: { planName: string; carouselsPerMonth: number }
) {
  return sendEmail({
    to: user.email,
    subject: `Plano ${args.planName} ativo — bora criar`,
    react: PaymentSuccessEmail({
      name: user.name,
      planName: args.planName,
      carouselsPerMonth: args.carouselsPerMonth,
      appUrl: APP_URL,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("payment-success")],
  });
}

export async function sendPlanLimit(
  user: Recipient,
  args: { used: number; limit: number }
) {
  return sendEmail({
    to: user.email,
    subject:
      args.used >= args.limit
        ? "Você atingiu o limite do ciclo"
        : `Faltam ${Math.max(args.limit - args.used, 0)} carrosséis no seu plano`,
    react: PlanLimitEmail({
      name: user.name,
      used: args.used,
      limit: args.limit,
      appUrl: APP_URL,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("plan-limit")],
  });
}

export async function sendReEngagement(
  user: Recipient,
  args: { daysSinceLastUse: number }
) {
  return sendEmail({
    to: user.email,
    subject: "Cola 1 link, sai com 1 carrossel",
    react: ReEngagementEmail({
      name: user.name,
      appUrl: APP_URL,
      daysSinceLastUse: args.daysSinceLastUse,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("re-engagement")],
  });
}

/** D+1 — onboarding drip explicando os 3 modos. */
export async function sendOnboardingHowItWorks(user: Recipient) {
  return sendEmail({
    to: user.email,
    subject: "3 formas de gerar carrossel (escolhe a sua)",
    react: OnboardingHowItWorksEmail({ name: user.name, appUrl: APP_URL }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("onboarding-how-it-works")],
  });
}

/** D+3 — onboarding drip: voz da marca (IA genérica vs IA que soa como você). */
export async function sendOnboardingFirstCase(user: Recipient) {
  return sendEmail({
    to: user.email,
    subject: "A diferença entre IA genérica e IA que soa como você",
    react: OnboardingFirstCaseEmail({ name: user.name, appUrl: APP_URL }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("onboarding-first-case")],
  });
}

/** D+7 — onboarding drip: pitch do upgrade. */
export async function sendOnboardingWhyUpgrade(user: Recipient) {
  return sendEmail({
    to: user.email,
    subject: "Vale upgrade pro Pro? Matemática honesta",
    react: OnboardingWhyUpgradeEmail({ name: user.name, appUrl: APP_URL }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("onboarding-why-upgrade")],
  });
}

/**
 * D+7 com limite gasto — cupom VIRAL50 (50% off primeiro mês Creator).
 * Disparado pelo cron `last-chance-coupon` quando user free gastou os 5
 * carrosséis e já passou da janela de 7 dias sem upgrade.
 */
export async function sendLastChanceCoupon(
  user: Recipient,
  args: { couponCode: string }
) {
  return sendEmail({
    to: user.email,
    subject: "Seu cupom de 50% off — só hoje e amanhã",
    react: LastChanceCouponEmail({
      name: user.name,
      appUrl: APP_URL,
      couponCode: args.couponCode,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("last-chance-coupon")],
  });
}

/**
 * Programa Indique-e-Ganhe — referrer ganha credito quando o referido paga.
 * Disparado direto no webhook Stripe (instantaneo, nao depende de Automation).
 */
export async function sendReferralConverted(
  user: Recipient,
  args: { rewardCents: number; totalCreditCents: number }
) {
  return sendEmail({
    to: user.email,
    subject: "Você acabou de ganhar R$ 25 em crédito",
    react: ReferralConvertedEmail({
      name: user.name,
      rewardCents: args.rewardCents,
      totalCreditCents: args.totalCreditCents,
      appUrl: APP_URL,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("referral-converted")],
  });
}

/** Stripe `invoice.payment_failed` — cartão recusado, atualizar payment method. */
export async function sendPaymentFailed(
  user: Recipient,
  args: { planName: string; amountUsd?: number | null; portalUrl?: string }
) {
  return sendEmail({
    to: user.email,
    subject: "Falha na cobrança — atualize seu cartão",
    react: PaymentFailedEmail({
      name: user.name,
      planName: args.planName,
      amountUsd: args.amountUsd,
      portalUrl: args.portalUrl,
      appUrl: APP_URL,
    }),
    tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("payment-failed")],
  });
}

/**
 * Alerta interno pro owner — toda vez que um checkout vira assinatura paga,
 * dispara um email pra `OWNER_EMAIL` (ou fallback hardcoded). Texto puro,
 * sem template React, pra ficar leve e fácil de ler no celular.
 *
 * Falhas SÃO swallowed: webhook Stripe nunca pode quebrar por causa desse
 * email. Loga warn e segue.
 */
export async function sendOwnerSubscriptionAlert(args: {
  email: string | null | undefined;
  planName: string;
  planId: string;
  amountBrl: number;
  userId: string;
  customerId: string | null | undefined;
  subscriptionId: string | null | undefined;
}): Promise<void> {
  try {
    const ownerEmail =
      process.env.OWNER_EMAIL ||
      process.env.STRIPE_NOTIFY_EMAIL ||
      "gf.madureiraa@gmail.com";

    const adminUrl = `${APP_URL}/app/admin/users/${args.userId}`;
    const userEmail = args.email || "(email desconhecido)";
    const subject = `🎉 Nova assinatura SV — ${args.planName} (${userEmail})`;

    const amountFmt = `R$ ${args.amountBrl.toFixed(2).replace(".", ",")}`;
    const text = [
      `Nova assinatura paga no Sequência Viral.`,
      ``,
      `User: ${userEmail}`,
      `Plano: ${args.planName} (${args.planId})`,
      `Valor: ${amountFmt}/mês`,
      ``,
      `Admin: ${adminUrl}`,
      ``,
      `Stripe customer: ${args.customerId || "n/a"}`,
      `Stripe subscription: ${args.subscriptionId || "n/a"}`,
    ].join("\n");

    const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#0a0908">
<p><strong>Nova assinatura paga no Sequência Viral.</strong></p>
<ul style="padding-left:18px;margin:12px 0">
  <li><strong>User:</strong> ${userEmail}</li>
  <li><strong>Plano:</strong> ${args.planName} (<code>${args.planId}</code>)</li>
  <li><strong>Valor:</strong> ${amountFmt}/mês</li>
</ul>
<p><a href="${adminUrl}">→ Abrir perfil no admin</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
<p style="color:#666;font-size:12px">
  Stripe customer: <code>${args.customerId || "n/a"}</code><br />
  Stripe subscription: <code>${args.subscriptionId || "n/a"}</code>
</p>
</div>`;

    // sendEmail() exige um ReactElement. Como esse alerta não usa template
    // dedicado, montamos um div simples via createElement com o HTML inline.
    const reactElement = createElement("div", {
      dangerouslySetInnerHTML: { __html: html },
    });

    await sendEmail({
      to: ownerEmail,
      subject,
      react: reactElement,
      text,
      tags: [PROJECT_TAG, ENV_TAG, lifecycleTag("owner-new-subscription")],
    });
  } catch (err) {
    console.warn("[email] sendOwnerSubscriptionAlert falhou:", err);
  }
}
