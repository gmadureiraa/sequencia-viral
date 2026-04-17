# PostFlow — Plano de execução (2026-04-15)

## ✅ Entregue nesta sessão

- **Brand kree8 editorial** em `globals.css` (card-offset, editorial-serif, tag-pill, grain, hero-kree8-bg)
- **13 imagens Gemini** em `public/brand/` (hero-bloom, bento-*, empty-*, icon-*, etc.)
- **Landing `/`** — Hero, SocialProof, BentoFeatures (6 cards), HowItWorks, Testimonials, Pricing, FAQ, FinalCTA, Footer — tudo editorial com offset
- **`/roadmap`** — sticky-notes 8 itens (link na NavBar da landing)
- **`/app` layout** — sidebar nova + plan card upgrade + topbar mobile
- **`/app` dashboard** — hero editorial, stats, quick actions, empty state
- **`/app/carousels`** — lista + filtros editoriais
- **`/app/settings`** — cards migrados pra `card-offset`
- **`/app/onboarding`** — **reescrito 100%**
  - Fluxo novo: Redes → Perfil → Preferências → Começar
  - Social-first: usuário cola @ → auto-pull via `/api/profile-scraper` → preenche nome/foto/nicho
  - Nicho **free-form**: input + chips removíveis + sugestões rápidas
  - Tudo em português
- **Deploy Vercel**: protection desligada via API, env vars pushed, produção READY

---

## 🎯 Backlog pendente (prioridade → baixa)

### P0 — Funcional crítico

- [ ] **Create page funcional end-to-end**
  - Verificar se `/app/create` gera carrossel via Anthropic API (já existe — 1091 linhas)
  - Garantir que export funciona (html-to-image já instalado)
  - Rodar local, testar fluxo real: input → gera → edita → export
- [ ] **Settings funcional** — perfil editável de verdade
  - Verificar se `updateProfile` (auth-context) persiste no Supabase
  - Testar save
- [ ] **Upgrade pro Pro funcional**
  - Stripe já está configurado (secret + webhook + publishable key no .env)
  - Verificar rota `/api/stripe/*` ou criar se não existe
  - Botão "Upgrade" em settings + plan card sidebar → checkout session
- [ ] **Limite de 1 perfil por usuário** — clarificar no UI (agora não há multi-profile,
  só garantir que settings reflita isso)

### P1 — Visual / copy

- [ ] **Hero menor** — headline max ~6rem, min-h-screen caber em 1 viewport
- [ ] **Hero carousel** — re-integrar `HeroCarousel` component (já existe, só foi removido)
  com slides meta explicando PostFlow em formato carrossel
- [ ] **Bento editorial com demos vivos** — adaptar kokonutui pattern:
  - card 01 (large): typing code mostrando "gerando carrossel…" + preview animado
  - card 02: stats animados (carrosseis gerados, tempo médio, engajamento)
  - card 03: logos redes (IG/X/LI) com hover
  - card 04: timeline "como funciona"
  - card 05: mini dashboard preview
  - 3D tilt em todos
- [ ] **Traduzir inglês remanescente** no `/app/create` (muitas strings ainda em EN)
- [ ] **Landing copy pass** — headlines mais afiadas (hook → claim → prova)
- [ ] **Adicionar nota "Múltiplos perfis — em breve"** no roadmap
- [ ] **Verificar link /roadmap** — está no NavBar mas pode estar invisível em mobile

### P2 — SEO / polish

- [ ] Meta tags + OG image de cada rota (blog post format)
- [ ] sitemap já existe, revisar
- [ ] Performance: lazy load das imagens Gemini (next/image já faz)
- [ ] Dark mode: globals.css já tem classes `.dark` mas não testei nas novas seções

---

## 📦 O que NÃO vou mexer

- Editor interno do `/app/create` (1091 linhas, lógica Anthropic/imagens funciona)
- `lib/auth-context.tsx` (lógica de auth/profile, não é design)
- `app/api/*` rotas (funcionam, não é escopo de design)
- Blog `/blog` (usuário pediu pra deixar)

---

## ⏱ Ordem de execução HOJE

1. **Adicionar "breve: múltiplos perfis" no roadmap** (2 min)
2. **Traduzir strings EN no /app/create** (10 min)
3. **Settings funcional** — garantir save + adicionar botão upgrade (15 min)
4. **Hero menor + re-integrar carousel** (15 min)
5. **Bento com 1 demo vivo** (exemplo: typing code) + tilt (20 min)
6. **Deploy + smoke test** (5 min)
