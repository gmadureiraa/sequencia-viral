<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Convenções renomeadas no Next 16

- `middleware.ts` → `proxy.ts` (raiz do projeto). Função exportada `proxy(request)` em vez de `middleware(request)`. Matcher continua via `export const config = { matcher: [...] }`. Doc canônica: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

## Rate limit

- `lib/server/rate-limit.ts` é a fachada — `rateLimit({ key, limit, windowMs })` retorna `{ allowed, remaining, reset, retryAfterSec }`. Usa Upstash Redis quando `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` estão setados; cai pra in-memory quando ausentes (modo dev).
- `checkRateLimit` segue exportado como alias síncrono pra rotas legadas que não querem `await`. Mas isso só usa o backend in-memory — pra ser distributed-safe, migrar pro `await rateLimit(...)`.

## Sentry

- Inicializa em `instrumentation.ts` via `Sentry.init` quando `SENTRY_DSN` está setado. Helpers em `lib/server/sentry.ts` (`captureRouteError`) — usar nos `try/catch` de endpoints críticos (geração, webhooks, scrapers).

## Plano `business` cap

- `business` é o tier topo (DB key, mostrado como "Pro"). Cap mensal de **100 carrosséis** declarado em `lib/pricing.ts` (`PLANS.business.carouselsPerMonth = 100`). Antes era 300 — reduzido em 28/04/2026 após audit de custos mostrar margem negativa (300 × ~R$ 0,85 custo = R$ 255 vs R$ 97,90 receita). Users existentes mantêm cap antigo via grandfathering (`usage_limit` não é mexido em mudanças de cap, só em subscription.updated do Stripe). O guard explícito está em `app/api/generate/route.ts` antes do increment atomic — qualquer mudança de cap precisa atualizar `PLANS` + webhook stripe.
