# PostHog — Setup dos Dashboards do Sequência Viral

Guia passo-a-passo pra montar os dashboards essenciais do MVP no PostHog
usando **os eventos que já estão sendo capturados** pelo app.

Link do projeto: https://us.posthog.com → Sequência Viral

---

## 1. Eventos já disparados (pronto pra usar)

| Evento | Onde | Propriedades principais |
|---|---|---|
| `$pageview` | autocapture | `$current_url`, `$pathname` |
| `user_signed_up` | `/app/login` | `method` (email), `needs_confirmation` |
| `user_signed_in` | `/app/login` | `method` (email) |
| `user_signed_in_with_google` | `/app/login` | — |
| `onboarding_completed` | `/app/onboarding` | `mode`, `has_twitter`, `has_instagram`, `niche_count`, `tone`, `language` |
| `onboarding_save_failed` | `/app/onboarding` | `mode`, `error` |
| `carousel_generated` | `/api/generate` (server) | `source_type` (video/link/instagram/idea), `niche`, `tone`, `language`, `slide_count`, `variation_count`, `input_tokens`, `output_tokens` |
| `carousel_deleted` | `/app/carousels` | `carousel_id` |
| `carousel_exported` | `/api/carousel/exports` | `carousel_id`, `slide_count`, `has_pdf` |
| `checkout_initiated` | `/app/checkout` | `plan`, `with_bump` |
| `order_bump_toggled` | `/app/checkout` | `added`, `plan` |
| `subscription_confirmed` | Stripe webhook | `plan`, `amount_usd`, `stripe_customer_id`, `stripe_subscription_id` |
| `subscription_cancelled` | Stripe webhook | `downgraded_to` |
| `settings_saved` | `/app/settings` | `has_twitter`, `has_instagram`, `has_linkedin`, `niche_count`, `tone`, `language`, `carousel_style` |
| `account_deleted` | `/api/auth/delete` | `email` |
| `$exception` | error boundaries | `digest` + stack |

---

## 2. Dashboards pra criar (nessa ordem)

### 📈 A) Dashboard principal: "MVP overview"

Menu esquerdo → **Dashboards** → **New dashboard** → nome **"MVP Overview"**.

Adicione 4 **Insights** (clicar em "Add insight"):

#### A1. Funnel de ativação (MAIS IMPORTANTE)
- Tipo: **Funnel**
- Steps:
  1. `user_signed_up` OR `user_signed_in_with_google`
  2. `onboarding_completed`
  3. `carousel_generated`
  4. `carousel_exported`
- Período: **Last 30 days**, breakdown por dia
- Conversion window: 7 days
- Este é **O funnel** — onde o usuário cai entre signup e primeiro export.

#### A2. Funnel de receita
- Tipo: **Funnel**
- Steps:
  1. `carousel_generated` (qualquer, user ativado)
  2. `checkout_initiated`
  3. `subscription_confirmed`
- Período: **Last 30 days**
- Breakdown: `plan` (pro vs business)

#### A3. Carrosséis gerados por origem
- Tipo: **Trends** → série temporal
- Event: `carousel_generated`
- Breakdown by: `source_type`
- Gráfico: **stacked bar**, diário
- Útil pra ver se pessoas usam YouTube/blog/Instagram/ideia.

#### A4. Churn: subscription_cancelled
- Tipo: **Trends**
- Event: `subscription_cancelled`
- Gráfico: **number** (total do período) + delta
- Período: Last 30 days

---

### 📊 B) Dashboard: "Qualidade do produto"

#### B1. Exports por carrossel
- Event: `carousel_exported`
- Math: **median(slide_count)**
- Gráfico: **number**
- Pra saber se pessoas exportam carrosséis inteiros ou desistem no meio.

#### B2. Custo médio de geração (tokens)
- Event: `carousel_generated`
- Math: **avg(input_tokens + output_tokens)**
- Breakdown: `source_type`
- Útil pra modelar custo por origem.

#### B3. Taxa de onboarding_save_failed
- Event: `onboarding_save_failed`
- Gráfico: **number** (total) + Trends/dia
- Se subir, tem bug de save; se zero, saudável.

#### B4. Tempo médio signup → first carousel
- Tipo: **Paths** ou custom SQL (HogQL)
- Configurar "Path" entre `user_signed_up` → `carousel_generated`

---

### 🔁 C) Retention (gráfico built-in)

Menu esquerdo → **Insights** → **New** → **Retention**
- Cohortizing event: `user_signed_up`
- Returning event: `carousel_generated`
- Period: **Daily** (primeira semana) + **Weekly**

---

## 3. Session Replay (já habilitado)

Menu **Session Replay** → filtrar por eventos:
- Users que receberam `onboarding_save_failed` (debug)
- Users que fizeram `checkout_initiated` mas não `subscription_confirmed` (abandono)
- Users com `$exception`

Recomendo configurar **3 playlists**:
- "🔥 Drop-offs no onboarding" — filtro: completou signup mas não `onboarding_completed`
- "💸 Abandono de checkout" — `checkout_initiated` sem `subscription_confirmed` em 10min
- "🐛 Erros capturados" — `$exception` recentes

---

## 4. Feature Flags recomendadas (quando precisar)

Menu **Feature Flags**. Exemplos úteis:

- `enable_imagen_hd` — rollout gradual do Imagen 4.0 (mais caro) pra Business users
- `show_autopublish_bump` — liga/desliga orderbump de publicação automática
- `landing_variant_b` — A/B test da landing (v5-neobrutal vs atual)

---

## 5. Alertas (opcional, plano pago)

Menu **Alerts** → criar:
- `onboarding_save_failed` > 5/hora → Slack/email
- `subscription_confirmed` = 0 em 24h (em produção) → email
- `$exception` spike (> 2x média) → investigar

---

## 6. Identificação de usuários

Já implementado em `/app/login/page.tsx` via `posthog.identify(email, { email })`.

Pra enriquecer: adicionar `posthog.identify(userId, { email, plan, usage_count })` em `lib/auth-context.tsx` após `setProfile(p)`. Deixo anotado pra próxima rodada — não é bloqueador.

---

## Ações imediatas (checklist)

- [ ] Criar dashboard "MVP Overview" com os 4 insights (A1–A4)
- [ ] Criar as 3 playlists de Session Replay
- [ ] Validar que `user_signed_up` chega no PostHog fazendo 1 signup de teste
- [ ] Criar 2 feature flags placeholder (`enable_imagen_hd`, `landing_variant_b`)
