# PostFlow

PostFlow é um app web para gerar carrosséis com IA para Instagram, LinkedIn e X, com foco em creators e times.

## Documentação

- **Guia do carrossel (perfil, tema, link como inspiração, export):** [`docs/product/guia-carrossel-postflow.md`](docs/product/guia-carrossel-postflow.md) — também disponível no app em **`/app/help`**.
- Índice geral: [`docs/README.md`](docs/README.md).

## Stack

- `Next.js 16` + `React 19` + `TypeScript`
- `Tailwind CSS 4`
- `Supabase` (auth + banco)
- `Stripe` (assinaturas)

## Setup local

1. Instale dependências:

```bash
bun install
```

2. Crie `.env.local` com base em `.env.example`.

3. Rode em desenvolvimento:

```bash
bun run dev
```

4. Abra `http://localhost:3000`.

## Variáveis de ambiente

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, obrigatório para webhook Stripe)
- `ANTHROPIC_API_KEY`
- `APIFY_API_KEY`
- `SERPER_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ALLOW_UNVERIFIED_STRIPE_WEBHOOK` (opcional, apenas desenvolvimento: `true` para aceitar webhook sem assinatura — **nunca** em produção)

## Scripts

- `bun run dev` inicia ambiente local
- `bun run build` build de produção
- `bun run start` executa build
- `bun run lint` valida padrão de código
- `bun run test` roda testes com Vitest
- `bun run assets:landing` gera PNGs em `public/brand/landing/` via **Imagen** (Gemini API); precisa de `GEMINI_API_KEY` no `.env.local`. Opcional: `GEMINI_IMAGE_MODEL` para outro modelo Imagen suportado pelo SDK.

## Planos e limites (fonte única)

- `free`: 5 carrosséis/mês
- `pro`: 30 carrosséis/mês
- `business`: ilimitado

Stripe usa os mesmos IDs de plano (`pro`, `business`) para manter consistência entre UI, checkout e webhook.

## Segurança implementada na auditoria

- Webhook Stripe exige assinatura verificada **ou** `ALLOW_UNVERIFIED_STRIPE_WEBHOOK=true` (somente testes locais).
- Webhook usa `SUPABASE_SERVICE_ROLE_KEY` (não usa chave pública).
- Checkout não confia em `userId` enviado pelo cliente.
- Rate limit básico nas rotas de API mais custosas.
- Rotas `/api/generate` e `/api/images` exigem `Authorization: Bearer <access_token>`. `/api/profile-scraper` aceita chamadas **sem login** (onboarding só com @), com rate limit menor por IP; com Bearer, o limite é por usuário.
- Proteção SSRF na extração de conteúdo por URL (HTTP(S) público, bloqueio de IPs privados e IPv6 local).
- Em produção, sem `ANTHROPIC_API_KEY`, a rota `/api/generate` retorna HTTP 503 em vez de dados mock.

## Autenticação e modos de uso

1. **Google OAuth** — botão “Continuar com Google” na tela de login (`/app/login`).
2. **E-mail e senha** — cadastro confirma por e-mail; login redireciona para o app.
3. **Convidado** — “Pular e testar sem conta”: perfil e rascunhos ficam no **navegador** (localStorage). Geração com IA e checkout Stripe exigem **sessão** autenticada.

Detalhes de produto, scraper sem login e roadmap de PDF/publicação direta estão em [`docs/product/roadmap-internal.md`](docs/product/roadmap-internal.md).

## Estrutura de documentação

O material de suporte do projeto está centralizado em `docs/README.md`.
