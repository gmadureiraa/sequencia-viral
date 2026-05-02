# Sequência Viral

Sequência Viral (ex-PostFlow) é um app web para gerar carrosséis de Instagram, LinkedIn e X com IA, partindo de um brief simples e com dois templates (Futurista + Twitter). Produzido pela Kaleidos, roda em produção em [viral.kaleidos.com.br](https://viral.kaleidos.com.br).

## Documentação

- **Guia do carrossel (perfil, tema, link como inspiração, export):** [`docs/product/guia-carrossel-sequencia-viral.md`](docs/product/guia-carrossel-sequencia-viral.md) — também disponível no app em **`/app/help`**.
- Índice geral: [`docs/README.md`](docs/README.md).
- Roadmap interno: [`docs/product/roadmap-internal.md`](docs/product/roadmap-internal.md).

## Stack

- `Next.js 16` + `React 19` + `TypeScript`
- `Tailwind CSS 4`
- `Supabase` (auth + banco + storage)
- `Gemini 2.5 Pro/Flash` + `Imagen 4.0` (geração de texto e imagem)
- `Anthropic Claude` (fallback de geração em rotas específicas)
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
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, obrigatório para webhook Stripe e para cachear imagens do IG no bucket)
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY` (geração de texto + imagem)
- `APIFY_API_KEY` (scraper primário do Instagram)
- `SCRAPECREATORS_API_KEY` (opcional — fallback automático de scraper Instagram quando Apify falha. Ver [`docs/technical/scrapers.md`](docs/technical/scrapers.md).)
- `NEXT_PUBLIC_FACEBOOK_APP_ID` (opcional — habilita Facebook Login opt-in; backend fica vivo mesmo sem ele)
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
- `bun scripts/create-buckets.ts` cria/atualiza o bucket `carousel-images` no Supabase de produção. Requer `.env.vercel.prod` (rodar `vercel env pull .env.vercel.prod` antes). Use para bootstrap de novos ambientes.

## Onboarding flow

O onboarding do app tem 9 passos sequenciais implementados em [`app/app/onboarding/page.tsx`](app/app/onboarding/page.tsx):

1. **about** — usuário informa nome, link principal e objetivo.
2. **connect** — conecta Instagram (handle opcional + Facebook Login opt-in quando `NEXT_PUBLIC_FACEBOOK_APP_ID` está setado).
3. **analyze** — backend roda o scraper, baixa posts recentes e faz análise de padrão (fases 0 → 6 com progresso visual).
4. **dna** — usuário edita o DNA gerado (nichos, tom, voz, público, pilares).
5. **photo** — upload/select de foto de avatar para usar nos carrosséis.
6. **visual** — escolhe estilo visual base (photo, ilustração, abstrato etc.).
7. **ideas** — recebe 3-5 ideias de posts sugeridas pela IA.
8. **generating** — geração paralela dos carrosséis selecionados (queued/running/done por slot).
9. **done** — resumo + CTA para a biblioteca.

O onboarding legado (antes era `/app/onboarding-v1`) foi descontinuado e removido em abril/2026 — a versão atual é a única em produção.

## Image handling

Imagens exibidas nos carrosséis e perfis vêm de duas fontes: uploads do usuário e imagens de posts do IG raspadas no onboarding. Para evitar hotlink (que o Instagram bloqueia por referer/UA), toda imagem raspada é **cacheada no bucket público `carousel-images` do Supabase Storage**:

- **Path pattern:** `onboarding-scrape/{userId}/{sha1(url)}.{ext}` — idempotente, se o hash já existe reusa.
- **Bootstrap do bucket:** `bun scripts/create-buckets.ts` (rodar uma vez por ambiente).
- **Limites:** 8 MB por arquivo; MIME types permitidos: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- **Fallback em runtime:** rota [`app/api/img-proxy/route.ts`](app/api/img-proxy/route.ts) serve de fallback para CDNs conhecidas (IG, Twitter, LinkedIn) quando o cache falha ou quando renderizamos preview antes do download concluir.

Arquitetura detalhada de cache: [`lib/server/scrape-cache.ts`](lib/server/scrape-cache.ts).

## Instagram scraping

Onboarding depende de dados de posts recentes do Instagram. Usamos chain de providers com fallback automático implementado em [`lib/server/instagram-scrapers/index.ts`](lib/server/instagram-scrapers/index.ts):

1. **Apify** (primário) — `apify~instagram-profile-scraper`. Robusto, caro (~$0.003/run), pode travar em rate limit do IG.
2. **ScrapeCreators** (fallback) — `api.scrapecreators.com`, 1 credit por chamada (profile + posts = 2 credits). Só entra na chain se `SCRAPECREATORS_API_KEY` estiver setado.
3. **Facebook Login opt-in** — quando o usuário conecta via Facebook (`NEXT_PUBLIC_FACEBOOK_APP_ID` setado), puxamos dados pela Meta Graph API direto, pulando o scraper. Endpoints de callback vivem em [`app/api/meta/`](app/api/meta/).

Detalhes: [`docs/technical/scrapers.md`](docs/technical/scrapers.md).

## Planos e limites (fonte única)

- `free`: 5 carrosséis/mês
- `pro` (Creator): 10 carrosséis/mês
- `business` (Pro): 30 carrosséis/mês

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

1. **Google OAuth** — botão "Continuar com Google" na tela de login (`/app/login`).
2. **E-mail e senha** — cadastro confirma por e-mail; login redireciona para o app.
3. **Convidado** — "Pular e testar sem conta": perfil e rascunhos ficam no **navegador** (localStorage). Geração com IA e checkout Stripe exigem **sessão** autenticada.

Detalhes de produto, scraper sem login e roadmap de PDF/publicação direta estão em [`docs/product/roadmap-internal.md`](docs/product/roadmap-internal.md).

## Deploy

Produção roda no projeto Vercel `sequencia-viral` com alias em `viral.kaleidos.com.br`. Deploy manual via `vercel --prod --yes` a partir da raiz do repo. O projeto Vercel `postflow` é legado e deve ser ignorado.

## Arquivo

Três packages de landing alternativa (`brillance-landing`, `nexus-landing`, `optimus-landing`) ficaram órfãos depois que a landing oficial foi finalizada em `app/page.tsx`. Eles estão preservados em `_archive/landing-packages/` como referência visual — não são buildados nem renderizados.

## Estrutura de documentação

O material de suporte do projeto está centralizado em `docs/README.md`.
