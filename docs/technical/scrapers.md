# Instagram Scrapers — Arquitetura com Fallback

## Por que dois scrapers

Instagram é a plataforma com maior risco de bloqueio transitório em produção. O scraper primário funciona na maior parte do tempo, mas o app não pode depender de um único fornecedor — se um onboarding falhar porque o Apify congelou em `rate limited`, o usuário perde a sessão e nunca mais volta.

A partir desta iteração o app tem uma _strategy_ com fallback automático: tenta providers na ordem e o primeiro que responder OK ganha.

## Ordem atual

1. **Apify (`apify~instagram-profile-scraper`)** — primário.
   - Custo: ~$0.003 por run (~24 posts + perfil numa chamada só).
   - Rodando em prod há meses, shape estável.
   - Pontos fracos: pode travar em IG rate limit (429 / timeout), ~10-15 s de latência.

2. **ScrapeCreators (`api.scrapecreators.com`)** — fallback.
   - Custo: 1 crédito por chamada. Profile (`/v1/instagram/profile`) + posts (`/v2/instagram/user/posts`) em paralelo = **2 créditos** por scrape.
   - Latência ~2-4 s (dois endpoints paralelos).
   - Shape espelha a API interna do IG (`edge_followed_by.count`, `carousel_media`, `image_versions2.candidates`).
   - Só entra no pool se `SCRAPECREATORS_API_KEY` estiver setada. Sem a chave, o adapter é _skipped_ silenciosamente na inicialização (log único).

## Como funciona a strategy

`lib/server/instagram-scrapers/index.ts` exporta `scrapeInstagram(handle)`:

```ts
export async function scrapeInstagram(handle: string): Promise<ProfileData> {
  const providers = buildProviderChain();
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await p.scrape(handle);
    } catch (err) {
      errors.push(`${p.id}: ${err.message}`);
      continue;
    }
  }
  throw new Error(`All scrapers failed. ${errors.join(" | ")}`);
}
```

Todos os adapters retornam o mesmo `ProfileData` — consumidor (`app/api/profile-scraper/route.ts`) não sabe qual provider respondeu. O cache de imagens via Supabase Storage (`cacheImages`) continua aplicado depois do scrape, independente da fonte.

## Como adicionar um terceiro adapter

1. Criar `lib/server/instagram-scrapers/<provider>.ts` implementando:
   ```ts
   export class FooScraper implements InstagramScraper {
     id = "foo";
     async scrape(handle: string): Promise<ProfileData> { ... }
   }
   ```
2. Quando for erro transitório (rede, 5xx, 429) jogar `new ScraperError(msg, "foo", true)`.
   Quando for erro definitivo (chave ausente, handle inválido) jogar `new ScraperError(msg, "foo", false)`.
3. Instanciar em `buildProviderChain()` no `index.ts`, com guard de env se precisar de API key.

## Custos aproximados (ref. abril 2026)

| Provider        | Custo por scrape | Chamadas   | Uso                |
|-----------------|------------------|------------|--------------------|
| Apify           | ~$0.003          | 1 actor    | Primário           |
| ScrapeCreators  | 2 créditos       | 2 GET      | Fallback           |

Se o Apify atingir o SLA (~98% de sucesso em prod histórico), o ScrapeCreators é usado em ~2% dos onboardings — custo marginal desprezível.

## Env vars

- `APIFY_API_KEY` — obrigatória (primário).
- `SCRAPECREATORS_API_KEY` — opcional. Sem ela, o app funciona normal com só o Apify. Para ativar o fallback em prod, setar no Vercel (`vercel env add SCRAPECREATORS_API_KEY production`).
