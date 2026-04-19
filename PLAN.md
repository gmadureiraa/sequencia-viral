# PLAN.md — Sequência Viral (by Kaleidos Digital)

> Plano completo para levar o produto a estado "primeira venda real".
> Estado atual: rebrand brutalist aplicado, 62 rotas compilando, deploy em `viral.kaleidos.com.br`.
> Alvo: **10 clientes pagantes em 60 dias**.

---

## 0. Princípios

- **Não subtrair, sempre unir**: features do handoff + features atuais. Nunca remover sem substituir algo melhor.
- **Brutalist editorial Kaleidos** como identidade não-negociável.
- **Toda geração sempre salva** — perder carrossel é perder confiança.
- **Toda tela sticky bar de save/ação** — user nunca fica perdido sem próximo passo.
- **PT-BR natural sempre**.

---

## 1. Frontend — telas públicas

### 1.1 Landing (`/`)
- [x] Rebrand v3 aplicado (hero collage + manifest + bento + pricing + FAQ + footer)
- [ ] **Hero**: reduzir texto, iPhone mockup real com carrossel rotacionando 3-4 slides de exemplo (em andamento)
- [ ] **Above-the-fold**: garantir que o CTA principal cabe em 1 scroll no desktop comum 1366×768
- [ ] **Cases / Social Proof**: substituir tweet-cards fictícios por print de 3 carrosséis reais do @madureira0x (esperando Gabriel publicar)
- [ ] **Comparativo**: validar que a tabela `SV vs Canva vs ChatGPT vs Manual` destaca o diferencial real (velocidade 15s + voz da marca)
- [ ] **Gallery**: 4 feed posts reais renderizados via TemplateRenderer em escala pequena, não placeholder
- [ ] **FAQ**: 8 perguntas que eliminem objeção de compra (ver `lib/landing-faq.ts`)
- [ ] **Metatags / OG**: verificar que `app/layout.tsx` tem OG image renderizando com o novo logo
- [ ] **Performance**: Lighthouse ≥ 90 mobile, ≥ 95 desktop (Vercel Insights)
- [ ] **SEO**: sitemap inclui blog + roadmap + pricing âncora + `/app/plans`

### 1.2 Blog (`/blog` + `/blog/[slug]`)
- [ ] Revisar os 8 posts existentes — atualizar datas + cover images com novo brand
- [ ] Adicionar 3 posts novos focados em conversão:
  - "Por que seu carrossel não engaja (e como o algoritmo IG 2026 trata isso)"
  - "Sua voz da marca ≠ template do Canva: como aparece nos seus posts"
  - "Como eu fiz 47 carrosséis em uma semana usando Sequência Viral"
- [ ] Cada post com CTA pra `/app/login` no final
- [ ] Tags/categorias visuais

### 1.3 Roadmap (`/roadmap`)
- [ ] Estado "Em produção" / "Próximo" / "Depois" — claro
- [ ] Pedido de feature via `mailto:madureira@kaleidosdigital.com?subject=Feature%20request`

### 1.4 Privacy / Terms
- [ ] Revisar texto com termos reais (DPO, dados coletados, retenção, LGPD)
- [ ] Adicionar data de última atualização

---

## 2. Frontend — área logada

### 2.1 App shell (`app/app/layout.tsx`)
- [x] Sidebar preta 240px + topbar creme com breadcrumb
- [x] NAV_ITEMS com **Criar v2** (beta) e **Assinar** (Pro)
- [ ] Indicador de uso no sidebar (barra "X/Y carrosséis este ciclo") com cor verde→amarelo→vermelho
- [ ] Atalho teclado: `⌘K` abre search de carrosséis

### 2.2 Dashboard (`/app`)
- [x] Stat row 4 tiles (carrosséis criados, ciclo atual, plano, rascunhos)
- [x] Seções "Rascunhos" / "Publicados" / "Ideias sugeridas"
- [x] **"Ideias sugeridas"** real: `/api/suggestions` com Gemini, cache 24h em `brand_analysis.__suggestions`, fallback p/ deck mock
- [ ] Card de "onboarding pendente" se `!profile.brand_analysis` ou `!profile.niche?.length`

### 2.3 Onboarding (`/app/onboarding`)
- [x] 3 passos (nicho, redes, voz)
- [ ] Passo 2: scraper Apify deve mostrar preview real com avatar + últimas 3 posts
- [ ] Passo 3: 4 opções de voz — adicionar preview de "carrossel de exemplo" com cada voz aplicada
- [ ] Permitir reabrir via `/app/settings` → Refazer onboarding
- [ ] `onboarding_save_failed` PostHog event ativo — monitorar

### 2.4 Fluxo Criar — v1 legacy (`/app/create`)
- [x] Mantido como "Criar" no menu (fallback)
- [ ] Banner amigável no topo: "Quer testar a nova versão? → /app/create/new"

### 2.5 Fluxo Criar v2 (`/app/create/new` → `[id]/templates` → `[id]/edit` → `[id]/preview`)
- [x] Páginas criadas
- [ ] **Bug fix**: controles de cor/fonte/tamanho plumados nos 4 templates
- [ ] **Imagens default por template**: ao escolher template, pré-popular `slides[].imageUrl` com curadoria adequada
- [ ] **Trocar imagem por slide**: buscar (Serper) / gerar (Gemini Imagen) / upload / remover
- [ ] **Auto-save** debounced 1200ms — garantir que funciona sem dataloss
- [ ] **Breadcrumb steps**: "Nº 01 Ideia → Nº 02 Template → Nº 03 Editar → Nº 04 Preview" no topo
- [ ] **Preview**: iPhone mockup premium, não placeholder
- [ ] **Export**: PNG individual + PDF single + clipboard + ZIP (TODO)
- [ ] **Publicação IG**: botão que abre OAuth Graph API + agendamento (P1, pós-MVP)

### 2.6 Biblioteca (`/app/carousels`)
- [x] Grid brutalist com filtros + search
- [x] **Bulk actions**: checkbox por card + barra sticky com Duplicar / Exportar JSON / Excluir
- [x] **Pastas/tags** por carrossel (nicho, tema, campanha) — persistido em `style.tags[]` via `updateCarouselTags`; UI inline no card + chips na barra de filtros
- [ ] **Preview expandido**: hover no card mostra todos os slides (carousel embed)

### 2.7 Plans (`/app/plans`)
- [x] 3 cards (Grátis / Pro / Agência)
- [ ] Toggle anual com 20% desconto (quando tiver plano anual Stripe)
- [ ] Comparativo tabela "feature × plano"
- [ ] Depoimentos curtos por plano (social proof contextual)

### 2.8 Checkout (`/app/checkout`)
- [x] Funcional com Stripe live
- [ ] **Cupom de desconto** input
- [ ] **Garantia 7 dias** destacada
- [ ] Fallback se Stripe falhar: formulário para contato via email

### 2.9 Settings (`/app/settings`)
- [x] 7 abas (Perfil, Branding, Redes, Voz IA, Notificações, Plano, Segurança)
- [x] **Avatar upload** real (não só URL) — usa `/api/upload` com file input nativo
- [x] **Export JSON** de todos carrosséis + profile + metrics (LGPD) — `/api/data-export`
- [x] **Import**: uploader de JSON — `/api/data-import` (valida shape, importa como rascunho)
- [ ] **Audit log**: últimas 20 ações (login, edição, export) — se plan ≥ pro

---

## 3. Backend — APIs

### 3.1 Auth (`/api/auth/*`)
- [x] `DELETE /api/auth/delete` — cascata correta + Stripe cancel
- [ ] `POST /api/auth/reset-password` — fluxo próprio (se Supabase default não servir)
- [ ] `POST /api/auth/resend-confirmation`

### 3.2 Geração (`/api/generate`, `/api/generate-concepts`, `/api/generate-v2`)
- [x] Rate limit 50/h por user
- [x] Usage count incrementa
- [ ] **Log estruturado**: tempo de geração, tokens, tema, source_type — grava em `generations` para dashboard interno
- [x] **Retry automático** em 502/503 do Gemini com backoff exponencial (até 3x) — `lib/server/gemini-retry.ts`
- [ ] **Prompt engineering**: validar com 10 temas reais (marketing, cripto, finanças, tech, saúde, educação, design, produtividade, negócios, IA) — ajustar system prompt até taxa de "copy aproveitável sem edição" ≥ 70%

### 3.3 Imagens (`/api/images`)
- [x] Serper (busca) + Gemini Imagen (geração)
- [x] `img-proxy` pra CORS
- [ ] **Cache**: imagens já geradas/buscadas ficam em Supabase Storage com hash da query → evita repetir chamada paga
- [ ] **Seleção inteligente**: ordenar resultados Serper por aspect ratio 4:5 primeiro (ideal pra slide)
- [ ] **Imagens padrão por template**: `lib/create/default-images.ts` com 4×10 URLs curadas

### 3.4 Upload (`/api/upload`)
- [x] Supabase Storage
- [ ] **Validação**: max 10MB, MIME image/*, dimensões mín 400×500
- [ ] **Thumbnail**: gerar server-side + salvar URL alt
- [ ] **GC**: cron mensal que deleta uploads órfãos (não linkados a nenhum carrossel há 60+ dias)

### 3.5 Export (`/api/carousel/exports`)
- [x] Bulk PNG + PDF → Supabase Storage `carousel-exports`
- [x] **ZIP**: client-side com `jszip` — `lib/export-zip.ts` + botão "Baixar ZIP" (PNGs + PDF + manifest)
- [x] **Watermark**: se plan=free, marca discreta "feito em sequenciaviral.com" no rodapé do slide no export (prop `watermark` no `CarouselSlide`)
- [ ] **Formatos adicionais**: 1:1 (stories IG), 16:9 (LinkedIn nativo)

### 3.6 Stripe (`/api/stripe/*`)
- [x] Checkout + webhook + portal
- [x] **Webhook**: `invoice.payment_failed` → email user + cria billing portal link (retry fica com Stripe Smart Retries)
- [x] **Webhook**: `customer.subscription.updated` → sincroniza plano via price.id + downgrade se past_due/unpaid/canceled
- [ ] **Proration**: habilitar no checkout.subscription_update
- [x] **Cupons**: tabela `coupons` local + API `/api/coupons/validate` (valida antes de criar session Stripe — wiring no checkout fica pra integração)

### 3.7 Email (`/api/email/*` + crons)
- [x] Welcome, activation, payment-success, plan-limit, re-engagement
- [ ] **Weekly digest**: cron semanal domingo 10:00 → email com "N carrosséis criados, M views geradas" (stub até ter analytics IG)
- [x] **Onboarding drip**: D+0 welcome + D+1 "como funciona" + D+3 "primeiro case" + D+7 "por que upgrade" — cron `/api/cron/onboarding-drip`
- [ ] **Churn save**: cron diário — se plan pago cancelou no Stripe, email "volte com 30% off 3 meses"

### 3.8 Crons (`vercel.json` + `/api/cron/*`)
- [x] activation-nudge, plan-limit, re-engagement
- [x] **usage-reset**: 1° dia do mês 00:00 → reseta `usage_count` via RPC `reset_monthly_usage`
- [x] **healthcheck**: 15min → pinga Supabase + Gemini + Stripe + Resend → alerta Discord (DISCORD_WEBHOOK_URL) se quebra
- [ ] **storage-gc**: mensal → remove uploads órfãos, logs antigos de `generations`

### 3.9 PostHog / Analytics / Observabilidade
- [x] PostHog integrado + 17 eventos
- [ ] **Sentry**: capturar erros do backend (hoje só console.error)
- [ ] **Logflare ou Axiom**: drenar logs do Vercel pra search fora do dashboard
- [ ] **GA4** + **Vercel Analytics** ativos — criar funnel signup→generate→export no PostHog Insights

---

## 4. Schema / Migrations (Supabase)

### 4.1 Aplicadas
- [x] `profiles`, `carousels`, `generations`, `payments`
- [x] `export_assets` migration
- [x] RLS owner-only
- [x] `handle_new_user` trigger
- [x] `increment_usage_count` RPC

### 4.2 Pendentes
- [ ] **Tabela `subscriptions`** separada de `profiles.plan` (history de mudanças, proration)
- [x] **Tabela `coupons`** (code, discount_pct, expires_at, max_uses, used_count) + `coupon_redemptions` — migration `20260418120000_coupons_and_indexes.sql`
- [ ] **Tabela `brand_dna`** (para usuários que pedem DNA do próprio site automaticamente)
- [ ] **Tabela `email_log`** (auditoria: quem recebeu o quê e quando, pra evitar duplicar)
- [x] **Índices**: `carousels(user_id, status)`, `generations(user_id, created_at DESC)`, `payments(user_id, status)` — mesmo migration acima

---

## 5. Integrações externas

| Serviço | Status | Próxima ação |
|---|---|---|
| Supabase | ✅ prod | aplicar migrations pendentes |
| Stripe | ✅ live | smoke test com cupom 100% + configurar webhook `invoice.payment_failed` |
| Gemini | ✅ prod | otimizar prompts + adicionar retry |
| Anthropic | ✅ prod | usar apenas quando Gemini falha (fallback) |
| Serper | ✅ prod | cache de imagens |
| Apify | ✅ prod | melhorar resiliência do scraper onboarding |
| Supadata | ✅ prod | fallback YouTube funcionando |
| Resend | ✅ prod via `news.kaleidos.com.br` | criar audience separada p/ transacional vs marketing |
| PostHog | ✅ prod | criar 3 dashboards (MVP Overview, Qualidade, Retention) |
| GA4 | ✅ prod | ativar conversion goals |
| Sentry | ❌ | configurar (max 1h de setup) |
| Upstash Redis | ❌ | rate-limit distribuído (P2, quando >200 users/dia) |

---

## 6. Checklist de monetização — primeira venda

Em ordem de prioridade:
- [ ] `bun run build && bun test && bun run lint` tudo verde
- [ ] Smoke test Stripe com cupom 100% → confirma `profiles.plan = pro`
- [ ] Publicar **5 carrosséis reais** em `@madureira0x` com CTA pra sequenciaviral
- [ ] Página `/cases` com 3 before/after reais
- [ ] Sentry + Discord webhook alert
- [ ] Cupom `BETA50` com 50% off primeiro mês — ativo até 30/04
- [ ] Email onboarding drip ativo
- [ ] Copy da landing substituir "IA" genérica por benefícios concretos
- [ ] Lista de espera → outbound manual 50 pessoas X/LinkedIn
- [ ] Video 2min de demo em `/app/help` + link no email de boas-vindas

---

## 7. Fora de escopo (explícito — **NÃO FAZER**)
- Publicação automática IG/LinkedIn (depende OAuth, complexidade + risco) — P1 pós primeira venda
- App mobile nativo — P2
- Multi-seat / team management — P1 pós primeiros 20 clientes
- Template builder visual (user cria 5° template) — P2
- API pública pra devs — P2
- Integração Notion/Airtable — P3

---

## 8. Release checklist final (antes do launch público)

- [ ] Todos itens da seção 6 ✓
- [ ] Mobile testado em iPhone SE + Android budget
- [ ] Lighthouse mobile ≥ 85
- [ ] Web Vitals LCP < 2.5s, CLS < 0.1
- [ ] Nenhum erro vermelho no console em produção por 24h consecutivas
- [ ] `/api/debug` desabilitado em produção
- [ ] `.env.vercel.pull` e `.env.check` removidos do disco local (arquivos sensíveis)
- [ ] README no GitHub atualizado (não o do create-next-app)
- [ ] Anúncio: Twitter + LinkedIn + email base do Jornal Cripto

---

*Versão 1 — 2026-04-19. Atualizar conforme executar.*
