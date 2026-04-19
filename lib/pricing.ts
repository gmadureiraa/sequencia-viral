/**
 * Planos e limites — seguro para import em Client Components.
 * (stripe.ts inicializa o SDK e valida STRIPE_SECRET_KEY só no servidor.)
 *
 * Moeda: BRL (Stripe opera com centavos de BRL quando currency: "brl").
 * Preços conferem com landing (pricing-section.tsx) e app/plans/page.tsx.
 */

export const PLAN_CURRENCY = "brl" as const;

export const PLANS = {
  pro: {
    name: "Pro",
    priceMonthly: 8900, // R$ 89,00 em centavos BRL
    priceAnnual: 85440, // R$ 854,40/ano (~20% off sobre R$ 89×12 = R$ 1068)
    priceAnchor: 14900, // R$ 149 — preço "de" pra mostrar desconto de lançamento
    carouselsPerMonth: 30,
    features: [
      "30 carrosséis/mês",
      "Todas as origens (YouTube, blog, Instagram, ideia)",
      "Sem marca d'água",
      "Estilos claro e escuro",
      "Todos os 4 templates editoriais",
      "Export PNG 1080×1350",
      "3 perfis de voz/marca",
      "Referências visuais (IA aprende sua estética)",
      "Suporte por email",
    ],
  },
  business: {
    name: "Agência",
    priceMonthly: 24900, // R$ 249,00 em centavos BRL
    priceAnnual: 239040, // R$ 2.390,40/ano (~20% off sobre R$ 249×12 = R$ 2988)
    priceAnchor: 39900, // R$ 399 — âncora "de"
    carouselsPerMonth: -1, // unlimited
    features: [
      "Carrosséis ilimitados",
      "10 perfis de voz/marca",
      "Workspace compartilhado (3 seats inclusos)",
      "Analytics avançado de carrossel",
      "Custom branding (white-label)",
      "API de integração",
      "Exports ZIP em batch",
      "Suporte prioritário (WhatsApp direto)",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type BillingInterval = "month" | "year";

/**
 * Orderbump: publicação automática nas redes (Instagram, X, LinkedIn).
 * Cobrado como line item adicional mensal no checkout.
 */
export const AUTOPUBLISH_BUMP = {
  id: "autopublish",
  name: "Publicação automática",
  priceMonthly: 2900, // R$ 29,00 em centavos BRL
  description:
    "Publica direto em Instagram, X e LinkedIn. Agendamento + fila + re-post inteligente.",
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

/**
 * Valor cobrado em BRL (decimal, não centavos) para registro em
 * `payments.amount_usd`. O nome da coluna é histórico — hoje armazena BRL.
 * Novos rows vão com `currency = "BRL"`.
 */
export function stripePaymentAmount(
  planId: PlanId,
  interval: BillingInterval = "month"
): number {
  const cents =
    interval === "year" ? PLANS[planId].priceAnnual : PLANS[planId].priceMonthly;
  return cents / 100;
}

/** Alias histórico mantido pra não quebrar imports existentes. */
export const stripePaymentAmountUsd = stripePaymentAmount;

/** Formata centavos BRL pra string "R$ 89,00". */
export function formatBrl(cents: number): string {
  const v = cents / 100;
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Calcula desconto anual em % pra badges. */
export function annualDiscountPct(planId: PlanId): number {
  const m = PLANS[planId].priceMonthly * 12;
  const y = PLANS[planId].priceAnnual;
  if (m === 0) return 0;
  return Math.round(((m - y) / m) * 100);
}
