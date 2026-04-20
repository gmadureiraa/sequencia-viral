/**
 * Planos e limites — seguro para import em Client Components.
 * (stripe.ts inicializa o SDK e valida STRIPE_SECRET_KEY só no servidor.)
 *
 * Moeda: USD (Stripe opera com centavos de USD quando currency: "usd").
 * Público-alvo brasileiro, mas cobrança internacional — cartões BR fazem
 * conversão automática. Essa é a estratégia de lançamento.
 *
 * Preços de LANÇAMENTO (promo pra primeiros 500 assinantes):
 *   Pro:     $9.90/mês   (preço normal planejado: $19.90)
 *   Agência: $29.90/mês  (preço normal planejado: $39.90)
 *
 * Anual: sempre −20% sobre mensal equivalente.
 */

export const PLAN_CURRENCY = "usd" as const;

export const PLANS = {
  pro: {
    name: "Pro",
    priceMonthly: 990, // $9.90 em cents
    priceAnnual: 9504, // $95.04/ano (20% off sobre $9.90 × 12 = $118.80)
    priceAnchor: 1990, // $19.90 — preço "normal" depois da promo de lançamento
    carouselsPerMonth: 30,
    features: [
      "30 carrosséis/mês",
      "Todas as origens (YouTube, blog, Instagram, ideia)",
      "Sem marca d'água",
      "Estilos claro e escuro",
      "Todos os 4 templates editoriais",
      "Export PNG pronto pra postar",
      "1 perfil de voz/marca",
      "Referências visuais (IA aprende sua estética)",
      "Suporte por email",
    ],
  },
  business: {
    name: "Agência",
    priceMonthly: 2990, // $29.90
    priceAnnual: 28704, // $287.04/ano (20% off sobre $29.90 × 12 = $358.80)
    priceAnchor: 3990, // $39.90 preço normal planejado
    carouselsPerMonth: -1, // unlimited
    features: [
      "Carrosséis ilimitados",
      "Todas as origens (YouTube, blog, Instagram, ideia)",
      "Sem marca d'água",
      "Todos os 4 templates editoriais",
      "Export PNG pronto pra postar",
      "1 perfil de voz/marca",
      "Referências visuais (IA aprende sua estética)",
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
  priceMonthly: 499, // $4.99 em cents
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
 * Valor cobrado em USD (decimal, não centavos) para registro em
 * `payments.amount_usd`. Com currency="usd" no Stripe, isso bate direto
 * com o valor em dólar pago pelo usuário.
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

/** Formata centavos USD pra string "$9.90". */
export function formatUsd(cents: number): string {
  const v = cents / 100;
  return `$${v.toFixed(2)}`;
}

/** Alias retrocompat — usado em alguns lugares que chamavam formatBrl. */
export const formatBrl = formatUsd;

/** Calcula desconto anual em % pra badges. */
export function annualDiscountPct(planId: PlanId): number {
  const m = PLANS[planId].priceMonthly * 12;
  const y = PLANS[planId].priceAnnual;
  if (m === 0) return 0;
  return Math.round(((m - y) / m) * 100);
}
