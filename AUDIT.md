# Audit — Sequência Viral

_Gerado em 2026-04-21_

Aplicação em produção (https://viral.kaleidos.com.br) com users ativos. Auditoria read-only — nenhuma alteração de código foi feita.

- **Stack:** Next.js 16.2.3 (Turbopack) + React 19.2.4 + Tailwind 4 + Supabase (auth + DB) + Stripe + Anthropic + Gemini + Resend + PostHog.
- **Último deploy prod:** `dpl_5fnTsgUE3FeJ7568NgsB97p868nw` (23h atrás, Ready) em `iad1`.
- **Aliases:** `viral.kaleidos.com.br`, `sequencia-viral.vercel.app` — ambos servindo HTTP/2 200, apontam pro mesmo deploy.

---

## 1. Build health

- `bun run build` — **OK**, Compiled successfully em **6.3s** (Turbopack). TypeScript check do Next passa em 3.8s. 76 páginas estáticas geradas.
- `bunx tsc --noEmit` — **exit 0**, zero erros de tipo.
- **Warnings:**
  - `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` — Next 16 deprecou `middleware.ts` em favor de `proxy.ts` (rename + alguns ajustes).
  - `⚠ Using edge runtime on a page currently disables static generation for that page` — alguma rota com `runtime = "edge"` está desabilitando SSG silenciosamente.
- **Bundle:** `.next/static/chunks` ≈ **3.1 MB** (razoável). `.next/server` ≈ 51 MB. Cada função λ da API reporta ~865 KB no Vercel (Fluid-ish).
- **Rotas:** 76 no total. 38 rotas API (`ƒ` dynamic), 6 cron jobs registrados no `vercel.json`, 11 slugs SSG do blog.

## 2. Deploy health

- `vercel ls sequencia-viral` — últimos 15 deploys **Ready**, nenhum erro recente.
- `curl -I https://viral.kaleidos.com.br` → **HTTP/2 200**, HSTS presente (`max-age=63072000; includeSubDomains; preload`), CSP completo, `x-vercel-cache: HIT` na home.
- `curl -I https://sequencia-viral.vercel.app` → **HTTP/2 200**, mesmo content-hash/etag (`f93facb937127e588647856cb005b66b`) — domínio custom resolve e serve o mesmo deploy.
- `/sitemap.xml` e `/robots.txt` respondem 200, robots.txt bloqueia `/app/` e `/api/` (correto).
- Branch padrão `main` limpo, `origin` aponta pra `github.com/gmadureiraa/postflow.git`. Há remote secundário `sv` → `gmadureiraa/sequencia-viral.git` (possível repo duplicado/antigo — conferir).
- Auto-deploy disparando: últimos commits batem com deploys dos últimos 1–3 dias.

## 3. Integrações

- **Auth:** Supabase (`@supabase/supabase-js` 2.103) — Google OAuth + email/senha + guest mode (localStorage). **Não** usa `@supabase/ssr`, singleton browser-only em `lib/supabase.ts`; cliente server-side via service role em `lib/server/auth.ts`.
- **Clerk:** NÃO é usado (zero matches por `@clerk/nextjs` no código).
- **Neon:** NÃO é usado (zero matches por `DATABASE_URL`/`@neondatabase`). A ocorrência de `postgres` em `lib/server/gemini-retry.ts` é só retry logic.
- **Banco:** Supabase Postgres (projeto `lyjvzpfjeeyaeviwqvls.supabase.co`). Migrations em `supabase/migrations/` + `schema.sql`.
- **Stripe:** keys `sk_live_*` e webhook secret `we_*` configurados; checkout + portal + webhook rotas implementadas. Webhook em `app/api/stripe/webhook/route.ts` **exige** `constructEvent` com signature em produção — só aceita sem assinatura se `ALLOW_UNVERIFIED_STRIPE_WEBHOOK=true` E `NODE_ENV !== production`. Correto.
- **Gemini (Imagen 4 + geração de imagem):** SDK `@google/genai`, key configurada.
- **Anthropic:** SDK via `fetch`, key configurada, retorno 503 em prod sem key (conforme README).
- **Resend:** transacional via `news.kaleidos.com.br`.
- **PostHog:** client init em `instrumentation-client.ts` com `capture_exceptions: true`. Rewrite `/ingest/*` → PostHog US.
- **Serper / Apify / Supadata:** configurados.

## 4. Env vars

### Esperadas (código + `.env.example` + `.env.local`)

Públicas (`NEXT_PUBLIC_*`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`, `GA_MEASUREMENT_ID`, `STRIPE_PUBLISHABLE_KEY`, `PAYMENT_WALLET`.

Secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SERPER_API_KEY`, `APIFY_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPADATA_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `CRON_SECRET`.

Opcionais/documentadas mas ausentes em prod: `DISCORD_WEBHOOK_URL`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `GEMINI_IMAGE_MODEL`, `ALLOW_UNVERIFIED_STRIPE_WEBHOOK`, `TEST_USER_EMAIL`.

### `vercel env ls production` — 20 vars configuradas

Presentes: todas as obrigatórias acima. **Diff com `.env.example` + código:**

- `NEXT_PUBLIC_APP_URL` está só em **Development, Preview, Production** — OK.
- **Ausente em prod:** `DISCORD_WEBHOOK_URL` (apenas `console.warn` como fallback — não breaking).
- **Ausente em prod:** `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` — usados pelo webhook `customer.subscription.updated` para sincronizar planos em mid-cycle upgrade/downgrade via portal Stripe. **Funcionalidade degradada**: se user trocar plano pelo Stripe Portal, o webhook não vai conseguir mapear o novo price → plano local.
- `NEXT_PUBLIC_PAYMENT_WALLET` existe em prod, mas não está em `.env.example`. Sincronizar.

## 5. SEO

- `metadata` completo no `layout.tsx` root: title, description, keywords, metadataBase, canonical, openGraph, twitter, robots (index/follow).
- **JSON-LD:** 2 blocos inline — `SoftwareApplication` (com 3 Offers: Free/Pro/Business e featureList) + `FAQPage` (a partir de `LANDING_FAQ`). Ambos no `<head>` do root layout.
- **Sitemap:** `app/sitemap.ts` — home + blog + blog/[slug] × 11 + privacy + terms + roadmap. Todos com `lastModified: new Date()` (vai regenerar a cada build — fora do ideal para stable pages; Google penaliza sitemaps com lastmod sempre atual).
- **Robots:** `app/robots.ts` bloqueia `/app/` e `/api/`. Middleware também seta `X-Robots-Tag: noindex, nofollow` em `/app/*` e `/landing/v\d+` (ótimo).
- **OG/Twitter images:** `app/opengraph-image.tsx` + `app/twitter-image.tsx` + `app/apple-icon.png` — dinâmicos.
- **Canonical:** só a home tem `alternates.canonical`. Páginas do blog, `/privacy`, `/terms`, `/roadmap` **não têm canonical explícita** — Next gera default, mas vale adicionar pra evitar duplicidade com `sequencia-viral.vercel.app`.
- Landing V2–V5 indexáveis só se forem explicitamente chamadas — middleware bloqueia via X-Robots-Tag.

## 6. Performance

- Bundle estático 3.1 MB para uma app com 9 fontes Google (`Plus_Jakarta_Sans`, `Instrument_Serif`, `JetBrains_Mono`, `DM_Serif_Display`, `Playfair_Display`, `Outfit`, `Inter`, `Source_Sans_3`, `Literata`) — **muitas fontes carregadas no root layout**, provável impacto em LCP. Avaliar lazy-loading por rota (usar só 2–3 no landing).
- `next/image` usado em apenas 3 arquivos (`middleware`, `hero-flow-animation`, docs). Landing usa `<img>` raw nos componentes. Verificar pela saída da Lighthouse.
- `public/` ≈ 24 MB — inclui `postflow-carousel-preview.png`, `postflow-hero.png`, `postflow-empty.png`, `postflow-og.png`. Sem conversão para AVIF/WebP explícita no código.
- `skipTrailingSlashRedirect: true` ativo.
- Cron jobs: 6 registrados, `maxDuration 60` onde precisa (generate, scraper, brand-analysis, crons). OK.
- **Cache agressivo em `/app/*`:** `Cache-Control: no-store, must-revalidate` + `CDN-Cache-Control: no-store` para evitar HTML shell antigo — faz sentido no contexto pós-mudança, mas custa cold starts. Reavaliar depois que os deploys estabilizarem.

## 7. Accessibility

- Landing tem `aria-label`/`role=` em apenas 2 componentes (`welcome-popup`, `top-nav`). Outros CTAs só usam texto + ícone — **faltam `aria-label` em botões icon-only**.
- `alt=` presente em 4 arquivos da landing (13 ocorrências) — bom onde tem imagem, mas `<img>` sem alt não foi detectado como issue em texto rápido. Fazer sweep visual.
- Contraste: paleta `--sv-ink` em `--sv-paper` (dark em cream) — visualmente OK, mas botões accent laranja `#FF5842` com texto branco em fundo claro precisa validar AA (4.5:1). Rodar axe-core.
- Focus states: componentes Radix herdam OK. Botões custom da landing usam `shadow-[4px_4px_0_0_#0A0A0A]` mas não têm `:focus-visible` explícito visível na leitura rápida.
- `lang="pt-BR"` no `<html>` ✅.

## 8. Security

- **Secrets no repo:** `.gitignore` cobre `.env*` corretamente. `git ls-files | grep env` → vazio. **NENHUM `.env.local`/secret commitado**.
  - ⚠️ **Porém**: o arquivo `.env.local` local contém chaves `sk_live_*`, `sb_secret_*`, `STRIPE_WEBHOOK_SECRET`, tokens Apify/Serper/Supadata/Resend/PostHog em plain text. Proteger backup local do vault, não compartilhar dumps.
- `lib/stripe.ts` tem fallback `"sk_test_missing"` se env ausente — OK em dev, serve como placeholder para evitar crash.
- **Rate limit:** `lib/server/rate-limit.ts` (in-memory per-instance, não compartilhado entre cold starts) aplicado em **22 rotas** da API (generate, images, voice-ingest, scraper, upload, brand, checkout, data import/export, etc). **Limitação conhecida**: em Vercel serverless com múltiplas instâncias, o limite é por instância — bypass via requests paralelos em instâncias diferentes. Para produção madura, migrar para Upstash Redis ou Vercel KV (já comentado no código).
- **Webhook Stripe:** signature verification obrigatória em prod. Bom.
- **CORS:** middleware whitelist 6 origens (viral.kaleidos, www.viral, sequencia-viral.vercel, localhost × 3). Correto.
- **Security headers:** X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (camera/mic/geo bloqueadas), HSTS 2 anos + preload, CSP restritiva. **Sólido.**
- **CSP:** permite `'unsafe-inline'` em `script-src` e `style-src` — necessário para Next inline scripts e Tailwind, mas mitigar com nonces no futuro.
- `/api/debug` bloqueado em produção via middleware (retorna 404). ✅
- SSRF protection na extração por URL (declarado no README) — confirmar em `url-extractor.ts` se valida IP privado / IPv6 link-local.
- Auth bearer obrigatório em `/api/generate`, `/api/images`. `/api/profile-scraper` aceita sem login com rate limit menor. Documentado.

## 9. UX

- **Error boundary:** `app/global-error.tsx` (fallback hardcoded HTML/CSS sem dependências) + `app/app/error.tsx` (mais rico, com digest + PostHog capture + CTA). ✅
- **404 custom:** **AUSENTE** — não existe `app/not-found.tsx`. Usuário cai no `_not-found` default do Next. **P1.**
- **Loading states:** **AUSENTE** — não existe nenhum `loading.tsx` em qualquer segmento da app. React Suspense não está sendo usado via file convention. Em app real com chamadas Anthropic (30–60s), falta de skeleton/loading pode transmitir “travado”. Verificar se as páginas tratam loading inline via `isLoading` state (checklist mostra 14 arquivos com esse padrão — OK, mas streaming UX via `loading.tsx` está no chão).
- **Empty states:** `postflow-empty.png` existe (provavelmente no `/app/carousels`). Verificar cobertura em gallery, templates, etc.
- Redirects legacy (`/app/create`, `/app/create-v2`, `/app/create/legacy` → `/app/create/new`) configurados no `next.config.ts`. ✅

## 10. Docs

- `README.md` customizado, **sem boilerplate Next/Lovable**, cobre setup, env vars, scripts, segurança, autenticação. ✅
- `.env.example` existe e documenta todas as vars obrigatórias + opcionais. Falta só: `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_PAYMENT_WALLET`, `TEST_USER_EMAIL` (estão no `.env.local` mas não no example).
- `AGENTS.md` / `CLAUDE.md` alinhados (`CLAUDE.md` → include `AGENTS.md`). O AGENTS.md avisa que Next 16 tem breaking changes — boa prática.
- `docs/` bem organizado: `product/`, `technical/`, `design/`, `marketing/`, `audit/`, `research/`.

---

## Top 5 recomendações

1. **Renomear `middleware.ts` → `proxy.ts`** para alinhar com Next 16 e remover o warning do build. O convention foi deprecado oficialmente; quando o Next 17 vier, esse warning vira breaking.
2. **Adicionar `app/not-found.tsx`** (P1 de UX/SEO) e `loading.tsx` nas rotas críticas (`/app/create/new`, `/app/create/[id]/*`, `/blog/[slug]`) pra transmitir estado durante awaits de 30–60s do Anthropic.
3. **Migrar rate limit para Upstash Redis ou Vercel KV.** In-memory per-instance é bypass trivial em produção escalada — especialmente com 22 rotas de API expostas, algumas delas pagando Anthropic/Gemini por request. Risco financeiro real em abuso.
4. **Configurar `STRIPE_PRICE_PRO` e `STRIPE_PRICE_BUSINESS` em prod** para que o webhook `customer.subscription.updated` consiga sincronizar planos quando user troca de plano pelo Stripe Customer Portal. Hoje há bug silencioso de sync.
5. **Consolidar fontes Google** — 9 famílias Google Fonts no root layout é exagero para LCP. Mover fontes do dashboard/editor pro layout de `/app/*` e deixar só 2–3 no landing (`Plus_Jakarta_Sans` + `Instrument_Serif`). Ganho direto em Web Vitals.

## Issues por severidade

### P0 (breaking)
- Nenhum P0 ativo. App em produção saudável.

### P1 (degrading)
- **Sem `not-found.tsx` customizado** — 404 genérico do Next impacta marca e SEO de links quebrados.
- **Sem `loading.tsx`** em rotas que fazem chamadas longas (generate, scraper, brand-analysis) — UX pior que necessário.
- **Rate limit in-memory** em 22 rotas pagas (Anthropic/Gemini) — bypass trivial em escala, risco de bill shock.
- **`STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS` ausentes em prod** — webhook não sincroniza mid-cycle upgrades via portal.
- **Warning Next 16:** `middleware` deprecado em favor de `proxy`.
- **Sitemap com `lastModified: new Date()` para páginas estáveis** — ruim pra sinal SEO (Google desconfia de lastmod sempre atual).

### P2 (polish)
- 9 fontes Google no root — otimização de LCP.
- Falta `aria-label` em botões icon-only da landing.
- `<img>` raw na landing em vez de `next/image` — perde AVIF/lazy automático.
- `.env.example` desatualizado: falta 6 vars públicas que o código consome.
- Remote `sv` paralelo (`sequencia-viral.vercel.app` repo) — duplicação de origem, confirmar se ainda faz sentido.
- Canonical explícita ausente em `/blog/*`, `/privacy`, `/terms`, `/roadmap`.
- `public/*.png` sem AVIF/WebP — 24 MB de PNG no static.
- Edge runtime warning: alguma rota usa `runtime = "edge"` e perde SSG silencioso — localizar e decidir.
- `.env.local` com `sk_live_*` em plain text — garantir backups locais do vault estão criptografados.
- CSP com `'unsafe-inline'` — migrar para nonces quando possível.
