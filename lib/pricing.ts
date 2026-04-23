/**
 * Planos e limites — seguro para import em Client Components.
 * (stripe.ts inicializa o SDK e valida STRIPE_SECRET_KEY só no servidor.)
 *
 * Moeda: BRL (migracao 2026-04-22). Publico 100% brasileiro — sem spread
 * cambial, Stripe BR aceita BRL nativo, PIX recorrente possivel.
 *
 * IMPORTANTE: precisa criar novos Price IDs em BRL no Stripe Dashboard
 * (Products → Cada plano → Add price). Substituir STRIPE_PRICE_ID_*
 * env vars com os novos IDs antes de abrir checkout em prod.
 *
 * Precos BRL:
 *   Creator:  R$ 99,90/mes   (anchor: R$ 149)    — cupom VIRAL50 50% off = R$ 49,90 no 1° mes
 *   Pro:      R$ 199,90/mes  (anchor: R$ 299,90) — cupom VIRAL50 50% off = R$ 99,90 no 1° mes
 * Anual: sempre -20% sobre mensal × 12.
 */

export const PLAN_CURRENCY = "brl" as const;

/**
 * Estrutura 3 planos: Free / Creator / Pro.
 *
 * Migracao 2026-04-22: removido plano "Agência" (business). IDs no banco
 * permanecem 'pro' e 'business' pra nao quebrar users legados — mas o
 * DISPLAY NAME mudou:
 *   - DB key 'pro'      → mostrado como "Creator" (entry pago)
 *   - DB key 'business' → mostrado como "Pro" (top tier)
 *   - DB key 'free'     → inalterado
 *
 * Novo preço-alvo pos-promo alinhado com a economia real (imagens Imagen
 * sao o driver de custo, ~$0.04/imagem, 50% dos slides tem imagem).
 */
export const PLANS = {
  pro: {
    name: "Creator",
    priceMonthly: 9990, // R$ 99,90 em centavos BRL (cupom VIRAL50 50% off = R$ 49,95 no 1° mes)
    priceAnnual: 95904, // R$ 959,04/ano (20% off sobre 99,90×12=1198,80)
    priceAnchor: 14900, // R$ 149 preco riscado
    // Product ID do Stripe — criado manualmente no dashboard. DB key 'pro'
    // mapeia pro produto cujo display name e "Creator" (confuso mas legado).
    stripeProductId: "prod_UNrg0hsyOm447P",
    carouselsPerMonth: 10,
    features: [
      "10 carrosséis/mês",
      "Carrosséis de até 12 slides",
      "Todas as origens (YouTube, blog, Instagram, ideia)",
      "Sem marca d'água",
      "Templates Futurista + Twitter",
      "Export PNG pronto pra postar",
      "1 perfil de voz/marca",
      "Imagens IA (Imagen 4) + busca (stock)",
      "Suporte por email",
    ],
  },
  business: {
    name: "Pro",
    priceMonthly: 19990, // R$ 199,90 em centavos BRL (cupom VIRAL50 50% off = R$ 99,95 no 1° mes)
    priceAnnual: 191904, // R$ 1.919,04/ano (20% off sobre 199,90×12=2398,80)
    priceAnchor: 29990, // R$ 299,90 preco riscado
    // Product ID do Stripe. DB key 'business' mapeia pro produto "Pro".
    stripeProductId: "prod_UNrgO9pSZYSveR",
    carouselsPerMonth: 30,
    features: [
      "30 carrosséis/mês",
      "Carrosséis de até 12 slides",
      "Todas as origens",
      "Sem marca d'água",
      "Templates Futurista + Twitter",
      "Export PNG + PDF",
      "Perfis de voz/marca (múltiplos, em breve)",
      "Imagens IA + stock + cache inteligente por tema",
      "Agendamento + publicação automática (em breve)",
      "Suporte prioritário",
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
  priceMonthly: 2490, // R$ 24,90 em centavos BRL
  description:
    "Publica direto em Instagram, X e LinkedIn. Agendamento + fila + re-post inteligente.",
} as const;

/** Limite mensal do plano gratuito (alinha com `profiles.usage_limit` padrão). */
export const FREE_PLAN_USAGE_LIMIT = 5;

export function isPaidPlanId(id: string): id is PlanId {
  return id === "pro" || id === "business";
}

export function usageLimitForPaidPlan(planId: PlanId): number {
  if (planId === "business") return PLANS.business.carouselsPerMonth;
  return PLANS.pro.carouselsPerMonth;
}

/**
 * Valor cobrado em BRL (decimal, nao centavos) pra registro em `payments`.
 * A coluna `amount_usd` mantem o nome por legado, mas agora guarda BRL.
 * Quando relatorio precisar de USD real, converte via USD_BRL_RATE do env.
 */
export function stripePaymentAmount(
  planId: PlanId,
  interval: BillingInterval = "month"
): number {
  const cents =
    interval === "year" ? PLANS[planId].priceAnnual : PLANS[planId].priceMonthly;
  return cents / 100;
}

/** Alias historico — mantido pra nao quebrar imports antigos. */
export const stripePaymentAmountUsd = stripePaymentAmount;

/**
 * Formata centavos BRL pra string "R$ 49,00".
 * Usa Intl pra vírgula decimal e separador de milhar (R$ 1.234,56).
 */
export function formatBrl(cents: number): string {
  const v = cents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/**
 * Alias legacy — codigo antigo chamava formatUsd. Agora redireciona pra
 * formatBrl (moeda do projeto mudou pra BRL). Quando nada mais importar
 * formatUsd, deletar esse alias.
 */
export const formatUsd = formatBrl;

/** Calcula desconto anual em % pra badges. */
export function annualDiscountPct(planId: PlanId): number {
  const m = PLANS[planId].priceMonthly * 12;
  const y = PLANS[planId].priceAnnual;
  if (m === 0) return 0;
  return Math.round(((m - y) / m) * 100);
}
