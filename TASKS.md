# PostFlow — Mega Task List

> Documento vivo. Prioridades e contexto para continuar sem recarregar conversa.  
> **Atualizado: 2026-04-17** (reconciliado com template único thread + `EditorialSlide`)

---

## Estado atual do produto (fonte da verdade)

- **Template visual:** único — formato **thread (Twitter/X)**, `DesignTemplateId = "twitter"` em [`lib/carousel-templates.ts`](lib/carousel-templates.ts). Preview e export PNG/PDF usam [`components/app/editorial-slide.tsx`](components/app/editorial-slide.tsx) (ver também [`docs/product/REFERENCIA-EDITORIAL-BRANDSDECODED.md`](docs/product/REFERENCIA-EDITORIAL-BRANDSDECODED.md)).
- **Auth:** apenas **Supabase** (Google, email, etc.). **Sem modo convidado**; `lib/auth-context.tsx` só limpa storage legado de guest.
- **Persistência:** usuários logados → Supabase (`lib/carousel-storage.ts`). APIs principais: `generate`, `generate-v2`, `images`, `upload`, Stripe, `profile-scraper`.
- **Lint:** `packages/**` ignorado no ESLint (landings experimentais não importadas pelo app principal). App principal em `eslint` sem erros (warnings residuais ok).

---

## Checklist de release (antes de deploy)

- [ ] `npm run build` + `npm test` + `npm run lint` (no diretório do app).
- [ ] Variáveis em produção na Vercel: `NEXT_PUBLIC_*`, `GEMINI_*`, `ANTHROPIC_*`, `SUPABASE_*`, `STRIPE_*`, `APIFY`/`SERPER` conforme rotas usadas.
- [ ] **Supabase produção:** aplicar migrações em ordem em [`supabase/migrations/`](supabase/migrations/) e alinhar com [`supabase/schema.sql`](supabase/schema.sql).
- [ ] **Stripe:** smoke com cupom 100% ou modo test — webhook atualiza `profiles.plan` após checkout (ver [`app/api/stripe/webhook/route.ts`](app/api/stripe/webhook/route.ts)).

---

## Mapa do projeto

```
postflow/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing
│   ├── layout.tsx          # Root + SEO
│   ├── globals.css         # Tokens (card-soft, card-offset, editorial, etc.)
│   └── app/                # Área logada — layout sidebar PT + onboarding guard
│       ├── create/page.tsx # Gerador (EditorialSlide)
│       ├── carousels/      # Biblioteca Supabase
│       └── settings/       # Perfil + Stripe
├── components/app/
│   ├── editorial-slide.tsx # Preview/export thread
│   ├── carousel-preview.tsx
│   └── carousel-slide.tsx  # Legado / usos pontuais; thread principal = editorial
├── lib/
│   ├── auth-context.tsx
│   ├── carousel-templates.ts
│   ├── carousel-storage.ts
│   └── stripe.ts
├── supabase/migrations/    # Aplicar em prod ao liberar features que dependem de colunas
├── docs/product/           # Guias e referência editorial
└── TASKS.md                # ← este arquivo
```

---

## Estética visual (direção)

- Referência de produto/app: **kree8-ish** + tokens em `globals.css` — `card-soft`, `pill-primary`, `hero-kree8-bg`, laranja marca.
- **Slides:** thread estilo X — implementado em `EditorialSlide` (não reabrir checklist “Defiverso em `carousel-slide.tsx`” como se fosse o preview principal; era doc antigo).

---

## P0 — Funcionalidade crítica (backlog real)

### P0.1 — Editor e persistência
- [ ] Revisar UX de edição em [`app/app/create/page.tsx`](app/app/create/page.tsx) (inline, imagens, debounce → `upsertUserCarousel`).
- [ ] Upload de imagens: [`app/api/upload/route.ts`](app/api/upload/route.ts) + Storage — validar bucket e fluxo end-to-end.

### P0.2 — Imagens e geração
- [ ] Qualidade `/api/images` (Serper + Gemini), fallbacks e prompts contextuais aos slides.

### P0.3 — Conteúdo (Claude)
- [ ] Modelo e prompt em [`app/api/generate/route.ts`](app/api/generate/route.ts) — voz do perfil (`niche`, `tone`, handles) e formato numerado.

### P0.4 — Onboarding
- [ ] Scraper Apify, preview e loaders (KokonutUI opcional).

### P0.5 — Stripe
- [x] Checkout + URLs de retorno (base).
- [ ] Smoke produção com pagamento testável.

---

## P1 — Polimento (landing + app)

### P1.1 — Landing (`app/page.tsx`)
- [ ] Hero, pricing alinhado a [`lib/stripe.ts`](lib/stripe.ts), 100% PT onde ainda houver inglês.

### P1.2 — App shell (`app/app/layout.tsx`)
- [x] Labels principais em PT (Criar, Meus carrosséis, Ajustes, Guia, etc.).
- [x] Rótulos de plano em PT (Grátis / Pro / Business) e card de plano com `card-soft` (release 2026-04-17).

### P1.3 — Dashboard (`app/app/page.tsx`)
- [x] Cards principais migrados para `card-soft` onde aplicável (release 2026-04-17).
- [ ] Thumbnail real / empty state ilustrado (melhorias futuras).

### P1.4 — Lista de carrosséis (`app/app/carousels/page.tsx`)
- [x] Cards de lista / empty com `card-soft` (release 2026-04-17).
- [ ] Bulk actions, filtros extra.

### P1.5 — Settings
- [ ] Avatar upload, re-import scraper, export JSON, barra de uso.

---

## P2 — Nice-to-have

- RSS, publicação direta, multi-brand, analytics, API pública, múltiplos perfis, dark mode completo, blog unificado, i18n EN/ES, Sentry/PostHog.

---

## P3 — Dívida técnica

- Quebrar `app/page.tsx` e `app/create/page.tsx` em componentes menores; limpar tokens CSS não usados; regerar assets de marca se necessário.
- `docs/product/PLAN.md` — histórico de sessão; não substitui este TASKS.

---

## P4 — Segurança e ops

- Rate limit consistente em `/api/*`, Zod nas routes, RLS Supabase, assinatura webhook Stripe, CSP, proteção de preview Vercel conforme política do time.

---

## Histórico de decisões

- **2026-04-17:** Template visual único thread + `EditorialSlide`; TASKS reconciliado; ESLint ignora `packages/**`; gate build/test/lint documentado; shell PT + `card-soft` no app logado.
- **2026-04-15:** Pivot visual kree8, plans pro/business, onboarding social-first (ver histórico anterior no git).
