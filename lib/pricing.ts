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
 *   Pro: R$ 49,90/mes  (anchor: R$ 99,90)  — preço de lançamento (DB key 'pro')
 *   Max: R$ 97,90/mes  (anchor: R$ 199,90) — preço de lançamento (DB key 'business')
 * Anual: sempre -20% sobre mensal × 12.
 */

export const PLAN_CURRENCY = "brl" as const;

/**
 * Estrutura 3 planos: Free / Pro / Max.
 *
 * Migracao 2026-04-22: removido plano "Agência" (business). IDs no banco
 * permanecem 'pro' e 'business' pra nao quebrar users legados — mas o
 * DISPLAY NAME mudou (e migrou de novo em 2026-05-05 pra padronizar com
 * Radar Viral e Reels Viral):
 *   - DB key 'pro'      → mostrado como "Pro" (entry pago, antes "Creator")
 *   - DB key 'business' → mostrado como "Max" (top tier, antes "Pro")
 *   - DB key 'free'     → inalterado
 *
 * Padronização cross-app (5 mai/2026): 3 apps virais usam free/pro/max.
 * DB keys SV continuam 'pro'/'business' por legado — nunca renomeadas pra
 * não quebrar subs ativos no Stripe.
 *
 * Novo preço-alvo pos-promo alinhado com a economia real (imagens Imagen
 * sao o driver de custo, ~$0.04/imagem, 50% dos slides tem imagem).
 */
export const PLANS = {
  pro: {
    name: "Pro",
    priceMonthly: 4990, // R$ 49,90 em centavos BRL (preço de lançamento)
    priceAnnual: 47904, // R$ 479,04/ano (20% off sobre 49,90×12=598,80)
    priceAnchor: 9990, // R$ 99,90 preco riscado (anchor visual)
    // Product ID do Stripe — criado manualmente no dashboard. DB key 'pro'
    // mapeia pro produto cujo display name e "Creator" (confuso mas legado).
    stripeProductId: "prod_UNrg0hsyOm447P",
    carouselsPerMonth: 10,
    features: [
      "10 carrosséis/mês",
      "Carrosséis de até 12 slides",
      "Todas as origens (YouTube, blog, Instagram, ideia)",
      "Sem marca d'água",
      "Template Thread (X) + acesso antecipado a novos",
      "Export PNG pronto pra postar",
      "1 perfil de voz/marca",
      "Imagens IA (Imagen 4) + busca (stock)",
      "Suporte por email",
    ],
  },
  business: {
    name: "Max",
    priceMonthly: 9790, // R$ 97,90 em centavos BRL (preço de lançamento)
    priceAnnual: 93984, // R$ 939,84/ano (20% off sobre 97,90×12=1174,80)
    priceAnchor: 19990, // R$ 199,90 preco riscado (anchor visual)
    // Product ID do Stripe. DB key 'business' mapeia pro produto "Pro".
    stripeProductId: "prod_UNrgO9pSZYSveR",
    // Cap reduzido 100 → 30 em 2026-05-01: alinha promessa pública com a
    // economia real. 30 × ~R$ 0,85/carrossel = R$ 25,50 custo bruto vs
    // R$ 97,90 receita = ~74% margem. Cap 100 anterior fechava só ~13%.
    // Users existentes (free/pro/business) mantêm seu `usage_limit` atual
    // via grandfathering — só é mexido em `subscription.created` ou
    // `subscription.updated` no webhook Stripe. Histórico:
    //   • até 2026-04-28: 300/mês (margem negativa)
    //   • 2026-04-28 → 2026-05-01: 100/mês (margem ~13%)
    //   • 2026-05-01 →: 30/mês (margem ~74%)
    carouselsPerMonth: 30,
    features: [
      "30 carrosséis/mês",
      "Carrosséis de até 12 slides",
      "Todas as origens",
      "Sem marca d'água",
      "Template Thread (X) + acesso antecipado a novos",
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
