/**
 * Despachos de email — funções de alto nível usadas por APIs, webhooks e crons.
 * Todo dispatch é tageado com `project:sequencia-viral` para isolar do resto
 * da conta Kaleidos Digital (blog leads, outras ferramentas, etc.) — permite
 * filtrar no dashboard Resend, rotear supression lists, e separar métricas.
 */

import { sendEmail } from "./send";
import { WelcomeEmail } from "./templates/welcome";
import { ActivationNudgeEmail } from "./templates/activation-nudge";
import { FirstCarouselEmail } from "./templates/first-carousel";
import { PaymentSuccessEmail } from "./templates/payment-success";
import { PlanLimitEmail } from "./templates/plan-limit";
import { ReEngagementEmail } from "./templates/re-engagement";

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
    subject: "Cola um link e sai com carrossel em 15s",
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
  args: { planName: string; carouselsPerMonth: number | "ilimitado" }
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
