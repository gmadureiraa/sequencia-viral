# Checklist pós-deploy

> Baseado no Audit Antigravity 2026-04-27. Verificar no painel Vercel → Settings → Environment Variables (ambiente: Production).

---

## Env vars críticas (Vercel prod)

### Stripe (sync de plano)
- [ ] `STRIPE_PRICE_PRO` — sem isso, webhook `subscription.updated` não mapeia upgrade/downgrade pra tier Pro
- [ ] `STRIPE_PRICE_BUSINESS` — idem para tier Business (300 carrosséis/mês)
- [ ] `STRIPE_SECRET_KEY` — usar chave **live** (`sk_live_...`), nunca test em prod
- [ ] `STRIPE_WEBHOOK_SECRET` — validação de assinatura dos eventos do Stripe (impede spoofing)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe.js no browser; sem isso, checkout não abre

### Rate limit distribuído (Upstash Redis)
- [ ] `UPSTASH_REDIS_REST_URL` — sem isso, rate limit cai pra in-memory (por instância, contorna em cold starts)
- [ ] `UPSTASH_REDIS_REST_TOKEN` — autenticação do cliente Upstash; obrigatório junto com a URL

### Telemetria
- [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` — Google Analytics 4; sem ele, sem dados de tráfego
- [ ] `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` — PostHog analytics de produto (funil, feature flags)
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` — endpoint PostHog (padrão: `https://us.i.posthog.com`)

### Banco e migrações
- [ ] Migration `20260427120000_fix_generations_provider_check_and_brl.sql` aplicada no banco prod
- [ ] Migration `20260427000000_image_cache_user_isolation.sql` aplicada (confirmado em staging)

---

## Verificações funcionais em prod

### Autenticação e autorização
- [ ] `/api/scripts` retorna `401` sem token de autenticação
- [ ] `/api/adapt-reel` valida payload e retorna `400` em input inválido
- [ ] Login (email + senha) funciona sem erro de redirect
- [ ] Signup cria usuário no Supabase Auth e redireciona pro `/app`

### Geração de carrossel
- [ ] Geração completa (brief → carrossel) termina sem timeout (< 55s)
- [ ] Imagens geradas são salvas no bucket `carousel-images` do Supabase Storage
- [ ] Usuário free não ultrapassa cap mensal (guard em `/api/generate`)
- [ ] Usuário Business respeita cap de 300 carrosséis/mês

### CORS e preflight
- [ ] Chamadas cross-origin de `viral.kaleidos.com.br` → `/api/*` funcionam sem erro CORS
- [ ] `OPTIONS` preflight retorna `204` com headers corretos

### Webhooks Stripe
- [ ] Evento `customer.subscription.created` atualiza plano no banco
- [ ] Evento `customer.subscription.updated` sincroniza upgrade/downgrade corretamente
- [ ] Evento `customer.subscription.deleted` reverte usuário para plano free

### Infraestrutura
- [ ] Domínio `viral.kaleidos.com.br` apontado para o projeto `sequencia-viral` no Vercel (não `postflow`)
- [ ] Crons configurados no `vercel.json` estão ativos no painel Vercel → Crons
- [ ] `CRON_SECRET` setado para endpoints `/api/cron/*`

---

## Pontos opcionais mas recomendados

- [ ] `SENTRY_DSN` configurado para captura de erros em prod
- [ ] `DISCORD_WEBHOOK_URL` para alertas do healthcheck
- [ ] `NEXT_PUBLIC_FACEBOOK_APP_ID` se fluxo OAuth Instagram estiver ativo
- [ ] `SUPADATA_API_KEY` e `SUPADATA_API_KEY_BACKUP` para transcrições de vídeo

---

*Gerado em 2026-04-27 — Audit Antigravity P1/P2*
