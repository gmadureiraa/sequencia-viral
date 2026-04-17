import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";

export const stripe = new Stripe(stripeSecretKey, {
  typescript: true,
});

export const PLANS = {
  pro: {
    name: "Pro",
    priceMonthly: 999, // $9.99 in cents
    priceAnchor: 1999, // $19.99 anchor (launch 50% off)
    carouselsPerMonth: 30,
    features: [
      "30 carrosséis/mês",
      "Sem marca d'água",
      "Estilos claro e escuro",
      "Export PNG (PDF em roadmap)",
      "1 perfil",
      "Imagens com IA / busca",
    ],
  },
  business: {
    name: "Business",
    priceMonthly: 2999, // $29.99 in cents
    priceAnchor: 4999, // $49.99 anchor (launch ~40% off)
    carouselsPerMonth: -1, // unlimited
    features: [
      "Carrosséis ilimitados",
      "API de integração",
      "3 seats inclusos",
      "Analytics avançado",
      "Custom branding",
      "Suporte prioritário",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * Orderbump: publicação automática nas redes (Instagram, X, LinkedIn).
 * Cobrado como line item adicional mensal no checkout.
 */
export const AUTOPUBLISH_BUMP = {
  id: "autopublish",
  name: "Publicação automática",
  priceMonthly: 499, // $4.99 in cents
  description:
    "Publique direto em Instagram, X e LinkedIn. Agendamento + fila + re-post inteligente.",
} as const;

/** Limite mensal do plano gratuito (alinha com `profiles.usage_limit` padrão). */
export const FREE_PLAN_USAGE_LIMIT = 5;

/**
 * Valor armazenado em `profiles.usage_limit` para plano Business (ilimitado na prática).
 * Mantém um número finito para compatibilidade com colunas integer.
 */
export const BUSINESS_USAGE_LIMIT_SENTINEL = 999_999;

export function isPaidPlanId(id: string): id is PlanId {
  return id === "pro" || id === "business";
}

export function usageLimitForPaidPlan(planId: PlanId): number {
  if (planId === "business") return BUSINESS_USAGE_LIMIT_SENTINEL;
  return PLANS.pro.carouselsPerMonth;
}

/** Valor em USD (não centavos) para registro em `payments.amount_usd`. */
export function stripePaymentAmountUsd(planId: PlanId): number {
  return PLANS[planId].priceMonthly / 100;
}
