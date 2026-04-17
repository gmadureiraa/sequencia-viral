# PostFlow — Mega Task List

> Documento vivo. Tudo que falta, organizado por prioridade, com contexto suficiente pra
> qualquer agente (ou você) continuar sem precisar recarregar a conversa.
> Atualizado: 2026-04-15

---

## 🗺️ Mapa do projeto

```
postflow/
├── app/                          # Next.js App Router (Next 16, React 19, Tailwind v4)
│   ├── page.tsx                  # Landing (849 linhas, estado: pivot kree8-ish em andamento)
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # 615 linhas — tokens editoriais + soft-3d + brand
│   ├── roadmap/page.tsx          # Sticky-notes, 9 itens (ver item 09 "Múltiplos perfis")
│   ├── blog/                     # Blog estático (NÃO MEXER)
│   └── app/                      # Área logada
│       ├── layout.tsx            # Sidebar + onboarding guard
│       ├── page.tsx              # Dashboard (editorial serif hero, stats, quick actions)
│       ├── login/page.tsx        # Supabase auth (Google + email + guest)
│       ├── onboarding/page.tsx   # Social-first, nicho free-form, PT
│       ├── create/page.tsx       # ~1100 linhas — gerador de carrossel (editor funcional)
│       ├── carousels/page.tsx    # Biblioteca (Supabase + guest)
│       └── settings/page.tsx     # Perfil editável, upgrade Stripe
├── app/api/                      # Route Handlers (Fluid Compute)
│   ├── generate/route.ts         # Anthropic Claude gen de slides
│   ├── images/route.ts           # Gemini / Serper busca e gen
│   ├── profile-scraper/route.ts  # Apify pra puxar IG/X
│   └── stripe/
│       ├── checkout/route.ts     # Checkout session (pro + business)
│       └── webhook/route.ts      # Ativa plano após pagamento
├── components/
│   ├── app/
│   │   ├── carousel-slide.tsx    # Slide visual (profile header + heading + body + img)
│   │   └── carousel-preview.tsx
│   ├── marketing/
│   │   └── landing-hero-carousel.tsx
│   └── kokonutui/
│       ├── bento-grid.tsx        # Instalado
│       ├── spotlight-cards.tsx   # Instalado
│       └── tweet-card.tsx        # Instalado (falta: loader, ai-text-loading)
├── lib/
│   ├── auth-context.tsx          # Supabase auth + profile CRUD + guest mode
│   ├── carousel-storage.ts       # Unificado: Supabase pra users / localStorage pra guest
│   ├── stripe.ts                 # PLANS = { pro, business }, PlanId, limites
│   ├── supabase.ts               # Client singleton
│   ├── profile-scraper.ts        # Apify helpers
│   ├── url-extractor.ts          # Extrai texto de URL pra gen
│   ├── youtube-transcript.ts     # Transcrição YT
│   ├── api-auth-headers.ts       # jsonWithAuth(session) helper
│   ├── utils.ts                  # cn() pra shadcn
│   └── server/
│       ├── auth.ts               # Server-side auth verify
│       └── rate-limit.ts         # Rate limit das APIs
├── public/brand/                 # 13+ imagens Gemini (hero-bloom, bento-*, etc.)
├── scripts/gen-brand-images.mjs  # Reaproveitável — prompts UI-style
├── PLAN.md                       # Plano antigo (pode deletar)
├── TASKS.md                      # ← ESTE ARQUIVO
└── .env.local                    # GEMINI, ANTHROPIC, SUPABASE, STRIPE, APIFY, SERPER
```

---

## 🎨 Estética visual (lock final, parar de pivotar)

Depois de várias tentativas (editorial kree8, soft-3d apple), a direção alinhada é:

- **Referência mãe:** `https://www.kree8.studio` — layout, rítmo, tipografia, mistura gray+black
- **Paleta:** laranja `#EC6000` primário, `#FF8534` light, `#D45500` dark, fundo `#F5F5F5`/`#FAFAF8`
- **Tipografia:**
  - Headlines: SF Pro Display / Inter 800 (classe `display-sans`), misturar black com light-gray (`headline-gradient` + `headline-muted`)
  - Corpo: Inter regular/medium, cor `#6A6A6A`
  - Serif só em último caso (`editorial-serif` ainda existe mas usar com moderação)
- **Elementos:**
  - Cards: `card-soft` (branco gradient, borda 6% black, rounded 32px, sombra suave laranja)
  - Botões: `pill-primary` (laranja gradient com glow) ou `pill-soft` (branco com icon colorido)
  - Icon squares 3D: `icon-square` (laranja gradient rounded 14px)
  - Highlighter: `.highlighter-orange` (background gradient + underline 88%)
- **3D bolhas** apenas no CTA final (FinalCTA) como accents
- **Grain sutil** só no fundo do hero principal
- **NUNCA** mais usar: hard offset shadow (card-offset), fundos cinza escuros no corpo da página

### Carrossel (referência Defiverso)

Os slides devem seguir EXATAMENTE o padrão dos prints que você mandou:

```
┌────────────────────────────────────┐
│  [avatar]  Defiverso               │ ← Header tweet-style, nome BOLD
│            @Defiverso_             │    handle gray
│                                    │
│  1. Queda contínua dos Juros       │ ← Título numerado, ~28-32px bold
│     (FED)                          │
│                                    │
│  Com juros altos, a renda fixa     │ ← Body ~17px, line-height 1.55,
│  "suga" a liquidez. Precisamos     │    wrap natural
│  de cortes reais para que o...     │
│                                    │
│  ┌──────────────────────────┐     │ ← Chart/image com framing
│  │   [chart CME FedWatch]    │     │    sutil (cream bg ou borda 1px)
│  └──────────────────────────┘     │
└────────────────────────────────────┘
```

Diferenças atuais do `components/app/carousel-slide.tsx`:
- Atual usa serif DM Display — Defiverso usa sans bold
- Font sizes muito pequenos (21-24px vs 28-32px na ref)
- Accent color hardcoded em `#7C3AED` (roxo) — trocar pra `#EC6000` (laranja)
- Avatar circle — ok
- Slide pagination dots no footer — manter
- Título precisa ser numerado quando houver posição (1. 2. 3.)

---

## 🔥 P0 — Bloqueadores / funcionalidade crítica

### P0.1 — Carrossel editável end-to-end
- [ ] **Refatorar `components/app/carousel-slide.tsx`** pro padrão Defiverso:
  - Font sans bold, tamanhos 28-32/17px
  - Cor accent laranja
  - Header maior (avatar 44px, nome 18px bold, handle 15px)
  - Imagem/chart com framing sutil (cream bg + border)
- [ ] **`app/app/create/page.tsx`** — editor inline já existe mas falta:
  - Editar título do slide clicando direto (contentEditable ou double-click → input)
  - Editar body inline
  - Trocar imagem: botão "Substituir imagem" → upload ou buscar no banco Gemini/Serper novamente
  - Drag-and-drop de imagem do desktop
  - Reordenar slides (já existe? verificar)
- [ ] **Persistência**: qualquer edit deve chamar `upsertUserCarousel` com debounce 1s
- [ ] **Upload de imagem custom**: endpoint novo `/api/upload` usando Supabase Storage bucket `carousel-images`

### P0.2 — Geração de imagens melhor
- [ ] **Busca de imagens** (`/api/images` via Serper) — testar e verificar qualidade dos resultados
- [ ] **Geração de imagens com Gemini 3 Pro Image** — prompts devem ser contextuais ao título/body do slide, não genéricos
- [ ] **Charts específicos**: quando o conteúdo for financeiro/estatístico, priorizar buscar gráfico via Serper em vez de gerar
- [ ] **Fallback cascade**: tentar Serper → se < 3 resultados decentes → Gemini gen → se falhar → placeholder

### P0.3 — Geração de conteúdo (Claude)
- [ ] Verificar se `/api/generate/route.ts` está usando Claude Opus 4.6 (modelo mais forte)
- [ ] Prompt deve forçar formato: "1. Título numerado bold" + body curto (3-5 linhas) + sugestão de `imageQuery`
- [ ] Aprender da voz do usuário: incluir `profile.niche`, `tone`, `bio`, `twitter_handle`/`instagram_handle` no system prompt
- [ ] Temperature 0.7 pra variação sem alucinar

### P0.4 — Onboarding 100% funcional
- [ ] `profile-scraper` via Apify — testar com @madureira e @defiverso de verdade
- [ ] Depois do pull, mostrar preview: foto, nome, bio, últimos 5 posts extraídos
- [ ] User pode rejeitar o auto-pull ("não é meu perfil") e digitar manual
- [ ] Usar o `@kokonutui/loader` + `@kokonutui/ai-text-loading` no estado scraping com textos tipo ["Buscando seu perfil…", "Lendo seus últimos posts…", "Entendendo seu nicho…", "Preparando tudo pra você…"]

### P0.5 — Upgrade Stripe
- [ ] Settings `handleUpgrade(planId)` → `POST /api/stripe/checkout` ✅ (já feito)
- [ ] Webhook `/api/stripe/webhook` — verificar se atualiza `profile.plan = "pro"|"business"` no Supabase após `checkout.session.completed`
- [ ] Success URL volta pra `/app/settings?payment=success&plan=pro` ✅
- [ ] Cancel URL ✅
- [ ] **Testar de verdade**: criar um cupom Stripe 100% off pra smoke test

---

## 🎯 P1 — Polimento crítico (landing + app)

### P1.1 — Landing page (`app/page.tsx`)
- [ ] Instalar `@kokonutui/loader` e `@kokonutui/ai-text-loading` (ainda faltam)
- [ ] Hero: reduzir altura pra caber em 1 viewport (hoje vaza)
- [ ] Hero: re-integrar o `LandingHeroCarousel` (já existe em `components/marketing/`)
- [ ] Bento com demos vivos usando `@kokonutui/bento-grid` (typing code, metrics animados, timeline)
- [ ] Spotlight cards section usando `@kokonutui/spotlight-cards` com 6 features PostFlow
- [ ] Testimonials: trocar cards genéricos por `@kokonutui/tweet-card` (visual de tweet do X)
- [ ] Pricing: alinhar com `PLANS` de `lib/stripe.ts` (pro $9.99, business $29.99) — hoje tem placeholder
- [ ] Seção poética estilo kree8: 5 linhas centradas, última palavra com highlighter laranja
- [ ] Footer minimalista
- [ ] Sidebar esquerda fixa desktop (opcional, só se quiser MESMO clone kree8)
- [ ] **100% português**, zero inglês

### P1.2 — App shell (`app/app/layout.tsx`)
- [ ] Labels do sidebar ainda estão em inglês — trocar:
  - "Dashboard" → "Dashboard" (ok)
  - "Create" → "Criar"
  - "My Carousels" → "Meus Carrosseis"
  - "Roadmap" → "Roadmap" (ok)
  - "Settings" → "Ajustes"
- [ ] Plan labels: "Free Plan" / "Pro Plan" / "Business" — traduzir
- [ ] Botão "Sair" ✅ já em PT
- [ ] Estilo da sidebar pode migrar pro soft (usar `card-soft` no plan card ao invés de `card-offset-orange`)

### P1.3 — Dashboard (`app/app/page.tsx`)
- [ ] Hero editorial-serif ainda — ok por enquanto
- [ ] Quick action cards usam `card-offset-orange` / `card-offset` — migrar pra `card-soft` + `pill-primary`
- [ ] Recent carousels mostrar thumbnail real do slide (não só "N slides" bloco)
- [ ] Empty state: usar Gemini image gerada OU ilustração UI-style

### P1.4 — Carousels lista (`app/app/carousels/page.tsx`)
- [ ] Migrar visual pra soft (hoje usa `card-offset` hard shadow)
- [ ] Thumbnail do slide 1 renderizado de verdade (reusar `<CarouselSlide>`)
- [ ] Filter chips maiores, mais legíveis
- [ ] Bulk actions: selecionar múltiplos → deletar/duplicar em massa

### P1.5 — Settings (`app/app/settings/page.tsx`)
- [ ] Componente já tem upgrade pro+business ✅
- [ ] Avatar upload (não só URL)
- [ ] Botão "Re-importar perfil de rede" que re-dispara o scraper
- [ ] Exibir uso atual: progress bar mensal
- [ ] Exportar dados (JSON de todos carrosseis) — botão simples

---

## 📦 P2 — Nice-to-have / futuro

- [ ] **RSS + gatilhos** (roadmap item 02) — `/api/rss/ingest` + cron
- [ ] **Publicação direta** (item 03) — OAuth IG/X/LinkedIn + scheduling
- [ ] **Brand kits multi** (item 04) — por enquanto 1 perfil só
- [ ] **Repurpose engine** (item 05) — grafo pai→filhos
- [ ] **Analytics** (item 06) — métricas das redes + learning loop
- [ ] **Team/aprovação** (item 07) — multi-user workspace
- [ ] **API pública** (item 08) — OpenAPI + n8n node + MCP server
- [ ] **Múltiplos perfis** (item 09) — switcher no header
- [ ] Dark mode completo — já tem tokens, só falta QA em todas as telas
- [ ] Blog — migrar pro mesmo visual (hoje é estilo antigo)
- [ ] i18n — hoje hardcoded PT. Futuro: EN + ES
- [ ] Monitoramento: Sentry + PostHog events

---

## 🧹 P3 — Debt / limpeza

- [ ] Deletar `PLAN.md` (substituído por este arquivo)
- [ ] Deletar `MARKETING-AUDIT-POSTFLOW.md`, `BENCHMARK-COMPETITORS.md`, `CAROUSEL-RESEARCH.md`,
  `PROMPT-MASTER.md` se não forem mais úteis (ou mover pra `docs/`)
- [ ] Remover imports/variáveis unused do `app/page.tsx` (várias seções deprecated no arquivo)
- [ ] Consolidar tokens CSS: `globals.css` tem tanto kree8-editorial (card-offset, editorial-serif, tag-pill)
  quanto soft-3d (card-soft, pill-primary, display-sans). Decidir: deletar o conjunto que não vamos
  usar pra reduzir 615 → ~250 linhas
- [ ] `app/page.tsx` tem 849 linhas — quebrar em `components/landing/Hero.tsx`, `Features.tsx`, etc.
- [ ] `app/app/create/page.tsx` tem ~1100 linhas — quebrar em `InputStep`, `GeneratingStep`, `PickStep`, `EditStep`, `ExportStep`
- [ ] Imagens em `public/brand/` com prompts antigos (foto clay terracota) — regerar as 7 primeiras
  com prompts UI-style clean do novo `scripts/gen-brand-images.mjs`

---

## 🔒 P4 — Segurança e ops

- [ ] Rate limit todas as `/api/*` (rate-limit.ts existe, usar consistente)
- [ ] Validação de input em todas as routes (Zod)
- [ ] Supabase RLS: verificar policies nas tabelas `profiles` e `carousels`
- [ ] Stripe webhook signature verification
- [ ] Honeypot no form de contato (se houver)
- [ ] CSP headers no `next.config.ts`
- [ ] Preview deploys protection on (hoje está off — foi desligado via API pra você ver)

---

## 📋 Histórico de decisões importantes

- **2026-04-15**: Pivot de editorial (card-offset hard shadow) pra soft-3d apple. Ambos tokens
  coexistem em `globals.css` — decidir futuro.
- **2026-04-15**: shadcn inicializado, kokonutui bento/spotlight/tweet instalados.
- **2026-04-15**: Carousel storage unificado (Supabase + localStorage guest) em `lib/carousel-storage.ts`.
- **2026-04-15**: Plans renomeados: `creator/agency` → `pro/business` no `lib/stripe.ts`.
- **2026-04-15**: Onboarding reescrito: social-first, niche free-form, 100% PT.
- **2026-04-15**: Roadmap + item 09 "Múltiplos perfis em breve".
- **2026-04-15**: Deployment protection desligada via API pra URLs Vercel serem abertas.

---

## 🎬 O que fazer AGORA (próximas 3 horas de trabalho)

Ordem sugerida pra uma sessão focada:

1. **Atualizar `carousel-slide.tsx`** pro padrão Defiverso (accent laranja, sans bold, título numerado) — 20 min
2. **Adicionar edit inline** no `/app/create` pra título e body (contentEditable) — 30 min
3. **Endpoint upload imagem** + botão "Substituir imagem" no editor — 45 min
4. **Instalar loader + ai-text-loading** do kokonutui e plugar no onboarding scraping — 15 min
5. **Traduzir labels do sidebar** em `app/app/layout.tsx` — 5 min
6. **Type check + deploy** — 15 min

Total: ~2h10 → sobra buffer.
