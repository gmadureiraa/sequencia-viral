# Referência visual — editorial (BrandsDecoded)

O produto usa um **único template** (`editorial`): fundo escuro ou claro, destaque laranja (~`#FF5500`), imagens em cartão com cantos ~16px, tipografia de revista e componente `EditorialSlide` no preview e no export PNG/PDF.

## Conta de referência (Instagram)

- Perfil: [instagram.com/brandsdecoded__](https://www.instagram.com/brandsdecoded__/)

## Coletar imagens de referência com Apify

O repositório já usa **Apify** em:

- `app/api/profile-scraper/route.ts` — perfil + posts recentes (actor `apify~instagram-profile-scraper`)
- `lib/instagram-extractor.ts` — post por URL

**Requisito:** variável de ambiente `APIFY_API_KEY` (Console Apify → Settings → Integrations → API token).

Fluxo sugerido para análise de referência (time / design):

1. Configure `APIFY_API_KEY` no `.env.local`.
2. Chame o endpoint interno de scraping de perfil (onboarding ou API) com handle `brandsdecoded__` **ou** use o painel Apify e o actor **Instagram Profile Scraper** com `usernames: ["brandsdecoded__"]` e `resultsLimit` maior para trazer mais mídias.
3. Use as URLs de mídia retornadas só como **referência de composição e ritmo** — não copie assets proprietários em produção.

## Imagens no app

- **Busca:** Serper + `/api/images` com prompts alinhados ao editorial (cinematográfico, sem texto na foto).
- **IA:** modo `generate` no mesmo endpoint (Gemini Imagen), com o mesmo contexto de nicho/tom/template.
