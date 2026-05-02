# Planos e Pricing

## Fonte única de verdade

Os IDs de plano válidos do produto e billing são:

- `free`
- `pro`
- `business`

## Limites operacionais

- `free`: 5 carrosséis por mês
- `pro` (Creator): 10 carrosséis por mês
- `business` (Pro): 30 carrosséis por mês

## Stripe

- `pro`: `USD 9.99/mês`
- `business`: `USD 29.99/mês`
- IDs enviados para checkout/webhook: `pro` e `business`

## Arquivos de referência

- `lib/stripe.ts` — `PLANS`, `FREE_PLAN_USAGE_LIMIT`, `usageLimitForPaidPlan`, `stripePaymentAmountUsd`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/layout.tsx`
- `app/app/settings/page.tsx`
