# Sequência Viral — Documento Canônico de Regras

> Fonte única de verdade do produto. Qualquer divergência entre este doc e o código deve ser corrigida aqui OU lá, mas nunca sobreviver. Atualizado: 2026-04-22.

---

## 1. Resumo Executivo

**Sequência Viral** (SV) é um estúdio de criação de carrosséis editoriais com IA, focado em Instagram, LinkedIn e X. O usuário cola um link (YouTube, blog, post do Instagram, post do X) ou descreve uma ideia livre, e a IA entrega 3 variações completas em ~60 segundos: headings, body, imagens geradas/buscadas, e export em PNG pronto pra postar.

A proposta de valor é comprimir 3 horas de diagramação em ~1 minuto, mantendo voz da marca e ancorando cada slide em fatos extraídos da fonte (sem alucinação). SV é um produto da Kaleidos Digital. O público atual é criadores, agências e founders brasileiros que postam de 2 a 7 vezes por semana.

- **Stack**: Next.js 16 (Turbopack) + Supabase (Postgres/Auth/Storage) + Gemini 2.5 Pro/Flash + Imagen 4 + Gemini 3.1 Flash Image + Claude Sonnet 4.6 (brand-analysis) + Stripe (BRL) + Resend + Apify + Serper
- **Package manager**: Bun
- **URL prod**: https://viral.kaleidos.com.br
- **GitHub**: gmadureiraa/postflow
- **Projeto Vercel que importa**: `sequencia-viral` (ignorar `postflow` legado)

---

## 2. Planos e Preços

Fonte única: `lib/pricing.ts`. Se divergir de qualquer UI, UI está errada.

| Plano | Mensal | Anual (equivalente/mês) | Total anual | Anchor | Carrosséis/mês | Slides máx | Marca d'água | Stripe Product ID | DB key |
|---|---|---|---|---|---|---|---|---|---|
| Free | R$ 0 | — | — | — | 5 | 12 | Sim | — | `free` |
| Creator | R$ 99,90 | R$ 79,92/mês | R$ 959,04/ano | R$ 149 | 10 | 12 | Não | `prod_UNrg0hsyOm447P` | `pro` |
| Pro | R$ 199,90 | R$ 159,92/mês | R$ 1.919,04/ano | R$ 299,90 | 30 | 12 | Não | `prod_UNrgO9pSZYSveR` | `business` |

**Regras importantes**:

- Moeda: BRL nativo (Stripe BR). Não usamos USD internamente para cobrança.
- Desconto anual: 20% sobre `mensal × 12`.
- `FREE_PLAN_USAGE_LIMIT = 5` (seed do `profiles.usage_limit` em novos signups).
- `usageLimitForPaidPlan('pro') = 10` e `('business') = 30`.
- DB keys `pro` / `business` são legadas e não devem ser renomeadas. UI mostra "Creator" e "Pro". `business` como nome público é chamado de **Pro** (top tier).
- Plano "Agência" (antigo business R$ 29,90/mês, 150 carrosséis/mês) foi **removido na migração 2026-04-22**. Não usar em nenhum texto público.
- `formatBrl(cents)`: helper canônico para formatar (ex.: `9990` → `R$ 99,90`).

**Order bump (desativado)**: `AUTOPUBLISH_BUMP` existe em `lib/pricing.ts` (R$ 24,90/mês, id `autopublish`), mas checkout NÃO oferece atualmente (comentários "desativado" em `app/api/stripe/checkout/route.ts`). Piloto automático aparece no roadmap em `lib/roadmap-data.ts` e no nav `/app/layout.tsx` como item futuro.

---

## 3. Cupons

Fonte: tabela `public.coupons` no Supabase + migrations em `supabase/migrations/*coupon*.sql`.

| Código | % Off | Max uses | Used | Plan scope | Expira | Status em prod | Distribuição |
|---|---|---|---|---|---|---|---|
| `VIRAL50` | 50% | 10 | 0 | `pro`, `business` | Nunca | **Ativo** (no DB) | email last-chance + popup in-app + welcome popup landing |
| `BETA50` | 50% | 100 | — | qualquer | 2026-06-30 | **Não aplicado em prod** (migration rodou mas seed não chegou no DB) | — |
| `BEMVINDO30` | 30% | 10.000 | — | qualquer | 2026-07-31 | **Não aplicado em prod** (aposentado pelo VIRAL50) | popup `/app/login?coupon=BEMVINDO30` referenciado ainda em código |

**Regras**:

- Copy nunca expõe `max_uses = 10`. Só fala "limitado aos primeiros assinantes".
- `VIRAL50` dispara automaticamente via `/api/cron/last-chance-coupon` (18:00 UTC diário) para users free com `usage_count >= usage_limit` e conta com D+7.
- Popup in-app (`components/app/discount-popup.tsx`) e popup landing (`components/landing/welcome-popup.tsx`) também expõem `VIRAL50`.
- Redenção registrada em `public.coupon_redemptions`. Função RPC `increment_coupon_use(coupon_id)` atomiza uso.
- Checkout (`app/app/checkout/page.tsx:415`) mostra `BETA50` como placeholder do input — bug menor, deveria mostrar `VIRAL50`.

---

## 4. Pipeline de Criação de Carrosséis

Fluxo padrão (single-shot):

1. **Input**: URL (YouTube / blog / Instagram / X) OU texto livre. Rota `/app/create/new`.
2. **Source detection**: `detectSource()` decide extrator.
3. **Extração**:
   - YouTube → transcript (Supadata fallback)
   - Blog → scrape HTML
   - Instagram → Apify (primário) + ScrapeCreators (fallback) + Facebook Login opt-in
   - X → scrape
   - Texto → skip extração
4. **NER pre-processing** (`lib/server/source-ner.ts`): Gemini 2.5 Flash com `thinkingBudget: 0`. Extrai:
   - `summary` (3-5 bullets)
   - `keyPoints` (10-18 frases completas com contexto — ground truth do writer)
   - `entities` (pessoas, empresas, produtos)
   - `dataPoints` (números, datas, %)
   - `quotes` (máx 80 chars)
   - `arguments`
   - Custo: ~$0.0005. Silent-fail se falhar.
5. **Writer** (`app/api/generate/route.ts::writerPrompt` linha 675): Gemini 2.5 Pro. Persona BrandsDecoded + Morning Brew + Paul Graham. Gera 3 variações (data/story/provocative) de 6-10 slides cada. Regras em §5.
6. **Concepts** (só modo avançado): Gemini Flash sugere 4 conceitos antes do writer.
7. **Image decider** (por slide, `lib/server/image-decider.ts`):
   - Gemini 2.5 Flash lê heading+body+NER+brandAesthetic
   - Decide `search` (entidade nomeada famosa → Serper Google Images) ou `generate` (abstrato/metáfora → Imagen 4 OU Gemini 3.1 Flash Image, JSON `StructuredImagePrompt`)
   - Capa (slide 1) sempre `generate`
   - Inner slides default: Flash Image ($0.008/imagem)
   - Custo: ~$0.0003/slide (decider) + $0.008-0.04/imagem (geração)
8. **Editor**: `/app/create/[id]/edit` — WYSIWYG, troca texto inline, regenera imagem isolada, troca template/variante.
9. **Preview**: render exato com html-to-image.
10. **Export**: PNG (html-to-image), ZIP (JSZip) ou PDF (jsPDF).
11. **Feedback modal** pós-download: `components/app/FeedbackModal.tsx` captura texto livre, classifier (§9) extrai regras e grava em `carousel_feedback` + `profiles.brand_analysis.__generation_memory`.

**Custo total médio** (carrossel 8 slides, mix de search/generate):

| Etapa | Custo USD |
|---|---|
| NER | ~$0.001 |
| Writer (Gemini 2.5 Pro) | ~$0.02 |
| Image decider (8 slides × Flash) | ~$0.0024 |
| Imagens (mix Serper + Flash Image) | ~$0.015-0.04 |
| Feedback classifier (opcional) | ~$0.0003 |
| **Total** | **$0.03-0.07 USD (≈ R$ 0,15-0,35)** |

---

## 5. Regras de Conteúdo (Writer)

Copiado/parafraseado do `writerPrompt` em `app/api/generate/route.ts:675`.

### Persona
> "Senior editorial director of BrandsDecoded meets Morning Brew meets Paul Graham. You make any topic feel urgent, specific, impossible to scroll past. Every slide is a scene that earns the next swipe."

### Regra de linguagem (obrigatória)
Frases curtas (máx 18 palavras). Zero jargão corporativo. Substituir "ecossistema / narrativa / ruptura / paradigma / sinergia / disrupção" por equivalente direto ("galera", "quebra", "padrão", "jeito certo"). Exceção: tom analítico editorial pode usar 1-2 termos técnicos do nicho quando o leitor da bolha reconhece.

### Fórmula macro
Surface reading → friction → reframe → mechanism → proof → implication → closing específico.

### Antídoto a genérico (regra dura)
- **Proibido** abrir slide 1 com pergunta retórica ("Você já se perguntou...", "Já parou pra pensar...").
- **Proibido** usar verbos-zumbi: "descubra", "entenda", "aprenda", "domine", "desvende", "revelado", "destrave".
- **Proibido** fechar slide com clichê: "o céu é o limite", "o resto é história", "tudo mudou", "a revolução chegou".
- **Cada slide 2+ DEVE CONTRADIZER** a expectativa do slide anterior. Se só "continua a ideia", falhou.

### Capa (slide 1)
- Fórmula: "Afirmação contraintuitiva + pergunta de aprofundamento"
- 12-25 palavras. CAIXA ALTA. Dispositivos válidos: hipérbole, paradoxo, informação privilegiada, contraste extremo.
- Máx 8 palavras se arquétipo compacto (DATA SHOCK / CONFESSION / ENEMY NAMING).

### Estrutura 3 atos (tópicos analíticos)
- Slide 2 (SETUP): "o cenário antigo" — status quo conhecido
- Slide 3 (RUPTURA): "o que mudou" — ponto de virada
- Slides 4+ (NOVA REALIDADE): consequências, evidências, aplicação
- Slide final: CTA específico

### CM5.4 — 4 pilares
1. **Triagem narrativa**: transformação + fricção central + ângulo dominante + âncoras observáveis (3-6 fatos verificáveis).
2. **Headline como mecanismo**: interrupção + relevância + clareza + tensão. Bi-linha: L1 captura, L2 ancora.
3. **10 naturezas de abordagem**: reenquadramento, conflito oculto, implicação sistêmica, contradição, ameaça/oportunidade, nomeação, diagnóstico cultural, inversão, ambição de mercado, mecanismo social. As 3 variações usam 3 naturezas + 3 arquétipos diferentes.
4. **Espinha dorsal em 6 partes**: (1) hook · (2) mecanismo · (3) prova · (4) aplicação · (5) implicação maior · (6) direção.

### Ground truth (inegociável)
NUNCA inventar números, percentuais, empresas, valores, datas, fontes, citações. Sem dado no source → (a) número derivável com caveat, (b) anedota, (c) especificidade qualitativa.

### Specificity gradient (slides 2-3)
**Obrigatório**: 1 dado numérico + 1 nome próprio em cada slide 2 e 3. Puxar primeiro de NER facts, depois grounding, só depois knowledge geral.

### 12 hook archetypes
Data shock · Confession · Enemy naming · Forbidden knowledge · Anti-guru · Specific loss · Time compression · Before/after · Ritual exposé · Meta-critique · Status game · Question de ruptura.

### Story arc check
Depois de escrever, perguntar: "se removo o slide N, o próximo ainda faz sentido?". Se sim, slide N é desperdício — reescrever pra carregar peso (contradição, exceção, dado novo). Aplica a cada slide do meio (3-7).

### Closing ritual (CTA específico)
- Fecha o loop do slide 1 (callback por tema, não paráfrase literal)
- Uma ação específica ao conteúdo — algo que só faz sentido depois de ler ESSE carrossel
- **Proibido** CTA genérico: "salva esse carrossel", "me siga para mais", "comenta aqui", "o que você acha?"
- Teste: troca o tema → CTA ainda serve? Se sim, falhou.

### 15 quality gates (check antes de emitir JSON)
1. Escada: lendo só headings em sequência, a história fecha?
2. Remoção / story arc: remove cada slide do meio — o próximo ainda faz sentido?
3. Especificidade slides 2-3: 1 dado + 1 nome próprio cada?
4. Invenção: todo número/empresa existe no source, é anedota, ou tem caveat?
5. CTA específico: cita algo do próprio carrossel? Troca o tema → quebra?
6. Arquétipos + naturezas: 3 variações, 3 arquétipos, 3 naturezas diferentes?
7. Slide 2 contradiz slide 1 (segundo golpe, não expansão)?
8. Variants: nenhum repetido 2× seguidas; slide 1 = cover, último = cta.
9. Voz: se voice_samples disponível, ≥2 tiques de linguagem no output.
10. Jargão: nenhum verbo-zumbi, cliffhanger clichê, fechamento clichê, pergunta retórica no slide 1.
11. Fricção identificável por variação (não é resumo do tema).
12. 6 papéis CM5.4 presentes (hook/mecanismo/prova/aplicação/implicação/direção).
13. Headline não-genérica: troca o tema → headline quebra?
14. Abstração fria: cada headline evoca cena ou stake na 1ª leitura.
15. Burocratês: zero "um olhar sobre", "análise de", "aspectos importantes", "estudo de caso".

### Feedback loop
`__generation_memory.text_rules` (cap 20, FIFO) é injetado no writer como "DIRETRIZES APRENDIDAS" com peso alto. Se contradizer regra genérica, feedback vence.

---

## 6. Regras de Imagens (Decider)

Fonte: `lib/server/image-decider.ts`.

### Quando SEARCH (Serper → Google Images)
- Entidade nomeada famosa: "Anthropic", "Satoshi", "Tesla", "Elon Musk"
- Evento real datado
- Pessoa pública
- Produto físico específico

### Quando GENERATE (Imagen 4 ou Gemini 3.1 Flash Image)
- Conceito abstrato
- Metáfora
- Princípio / emoção
- Cena hipotética
- **Capa (slide 1): sempre generate** (cinematográfica)

### StructuredImagePrompt (JSON injetado no gerador)
```
{
  subject: string,        // "founder sitting alone at laptop at dusk"
  composition: string,    // "rule of thirds, subject upper third"
  lighting: string,       // "blue hour + amber practicals, rim light on face"
  mood: string,           // "cinematic thriller, uneasy tension"
  palette: string[],      // ["navy blue", "amber", "charcoal"]
  camera: string,         // "35mm prime, shallow DoF, film grain"
  textures: string,       // "skin pores, wool fabric, scratched desk"
  negative: string,       // "no text, no letters, no UI"
  aspectRatio: "1:1"      // sempre 1:1 (IG carousel)
}
```

### Negative prompt padrão
`"no text, no letters, no readable UI, no chart numbers, no stock photo cliches"`

### Feedback loop
`__generation_memory.image_rules` (cap 20, FIFO) é injetado como "USER IMAGE RULES" com peso alto.

---

## 7. Templates Visuais

Renderer: `components/app/templates/index.tsx::TemplateRenderer`.

| ID (DB) | Nome UI | Arquivo | Status | Notas |
|---|---|---|---|---|
| `manifesto` | **Futurista** | `template-manifesto.tsx` | **Ativo** (default no picker) | Editorial BrandsDecoded-style. Paleta `--sv-*`. Fontes: Instrument Serif + Gridlite/JetBrains mono |
| `twitter` | **Twitter v2** | `template-twitter.tsx` | **Ativo** | Screenshot de tweet: avatar, handle, body, bordas |
| `futurista` | Futurista (arquivo) | `template-futurista.tsx` | **LEGACY** (não aparece no picker) | Mantido só por compatibilidade de dados antigos |
| `autoral` | Autoral | `template-autoral.tsx` | **LEGACY** | Mantido só por compatibilidade |

**Confusão legada**: O ID `manifesto` no DB renderiza o que chamamos de **Futurista** na UI. Não renomear (quebraria carrosséis salvos).

`TEMPLATE_ORDER = ["manifesto", "twitter"]` em `app/app/create/[id]/templates/page.tsx:59` controla o picker.

### Variantes por slide (template Manifesto/Futurista)
- `cover` — full-bleed image + handle pill + título CAPS no terço inferior. Abre (slide 1) e fecha.
- `solid-brand` — cor sólida + título CAPS topo + imagem quadrada center + body bottom.
- `full-photo-bottom` — full-bleed + gradient bottom 40% + título + body no terço inferior. Cinemático.
- `text-only` — fundo escuro + kicker mono topo + 2-3 parágrafos center. Máx 1× por carrossel.
- `cta` — último slide. Accent button + handle.
- Legacy (aceitos, preferir novos): `headline`, `photo`, `quote`, `split`.

### Ritmo forçado (exemplo 8 slides)
cover → solid-brand → full-photo-bottom → solid-brand → full-photo-bottom → solid-brand (ou text-only se denso) → full-photo-bottom → cta.

Regras duras: slide 1 sempre `cover`; último sempre `cta`; nunca 2 iguais seguidos; `text-only` máx 1×; `solid-brand` domina meio (2-4); `full-photo-bottom` quebra ritmo (1-3).

---

## 8. Emails Transacionais/Lifecycle

Fonte: `lib/email/templates/*.tsx` + dispatchers `lib/email/dispatch.ts` + crons `app/api/cron/*`.

| # | Email | Trigger | Cron/Endpoint | Condição | Flag idempotência |
|---|---|---|---|---|---|
| 1 | Welcome | D+0 signup confirmado | client call | todos novos | `welcome_sent_at` |
| 2 | Activation Nudge | D+2 sem geração | `/api/cron/activation-nudge` diário 15 UTC | `usage_count=0` + created 48-72h | `activation_nudge_sent_at` |
| 3 | First Carousel | após 1ª geração | inline em `/api/generate` | primeira geração | `first_carousel_sent_at` |
| 4 | Onboarding How It Works | D+1 | `/api/cron/onboarding-drip` 14 UTC | todos | `onboarding_how_it_works_sent_at` |
| 5 | Onboarding First Case | D+3 | onboarding-drip | todos | `onboarding_first_case_sent_at` |
| 6 | Onboarding Why Upgrade | D+7 | onboarding-drip | **só free** | `onboarding_why_upgrade_sent_at` |
| 7 | Plan Limit | cron 16 UTC diário | `/api/cron/plan-limit` | ≥80% ciclo, **só free** | `plan_limit_sent_at:YYYY-MM` |
| 8 | Re-Engagement | terça 17 UTC | `/api/cron/re-engagement` | dormente 7+ dias + throttle 45d | `re_engagement_sent_at` |
| 9 | Payment Success | webhook Stripe | `/api/stripe/webhook` | `checkout.session.completed` | — |
| 10 | Payment Failed | webhook Stripe | `/api/stripe/webhook` | `invoice.payment_failed` | — |
| 11 | Last Chance Coupon | cron 18 UTC diário | `/api/cron/last-chance-coupon` | free + `usage_count >= usage_limit` + D+7 | `last_chance_coupon_sent_at` |

### Padrões de layout
- Componentes: `lib/email/templates/_layout.tsx` (`EmailLayout`, `EmailHeadline`, `EmailText`, `EmailButton`, `EmailKicker`, `BRAND`)
- Tipografia: Georgia serif (display) + fallback system sans
- Cores: accent `#FF5842`, fg `#0A0A0A`, bg `#FFFDF9`, muted `#5F5C54`, border `#E9E4DA`
- Domínio: `EMAIL_FROM` env var, fallback `Sequência Viral <onboarding@resend.dev>` (ver §14 — risco de spam)
- Tags Resend: `project:sequencia-viral` + `env:prod|dev` + `lifecycle:<nome>`

---

## 9. Sistema de Feedback + Memória IA

### Tabela `carousel_feedback`
Schema (migração `20260423011704_carousel_feedback.sql`):
```
user_id uuid → auth.users
carousel_id uuid
raw_text text (não nulo)
classified_buckets text[] — ["text"|"image"|"both"]
text_rules text[] — regras imperativas extraídas
image_rules text[]
classifier_model text
classifier_cost_usd numeric
created_at timestamptz
```
RLS: service role full; authenticated lê só própria linha.

### Classifier
`lib/server/feedback-classify.ts` → Gemini 2.5 Flash (`thinkingBudget: 0`). Sistema prompt extrai 0-3 regras por bucket, em português, imperativas, máx 120 chars. Custo: ~$0.0003.

### Memória injetada
`profiles.brand_analysis.__generation_memory.{text_rules, image_rules}` (cap 20 cada, FIFO case-insensitive). Lida pelo writer (§5 última regra) e pelo image decider (§6 última regra).

### API endpoints
- `POST /api/feedback/carousel` — salva feedback + roda classifier + atualiza memória
- `GET /app/admin/feedback` — view admin de todas as linhas

---

## 10. Crons + Schedules

Fonte: `vercel.json`. Todos autenticados via `CRON_SECRET` (header `Authorization: Bearer <CRON_SECRET>`, check em `lib/server/cron-auth.ts`).

| Path | Schedule UTC | maxDuration | Função |
|---|---|---|---|
| `/api/cron/activation-nudge` | `0 15 * * *` | 60s | Email #2 |
| `/api/cron/plan-limit` | `0 16 * * *` | 60s | Email #7 |
| `/api/cron/re-engagement` | `0 17 * * 2` (terça) | 60s | Email #8 |
| `/api/cron/onboarding-drip` | `0 14 * * *` | 60s | Emails #4/5/6 |
| `/api/cron/last-chance-coupon` | `0 18 * * *` | 60s | Email #11 |
| `/api/cron/usage-reset` | `0 0 1 * *` | 60s | Reset mensal de `usage_count` |
| `/api/cron/healthcheck` | `0 12 * * *` | 30s | Ping monitoria |

---

## 11. Env Vars Obrigatórias (Produção)

| Var | Uso | Source of truth |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (crons, admin, webhooks) | Supabase dashboard |
| `SUPABASE_URL` | Server fallback | Supabase dashboard |
| `GEMINI_API_KEY` | Writer + NER + decider + classifier + brand-aesthetic + imagens Flash | Google AI Studio |
| `ANTHROPIC_API_KEY` | Brand analysis (Claude Sonnet 4.6) | Anthropic console |
| `STRIPE_SECRET_KEY` | Checkout + subscriptions | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook auth | Stripe dashboard (webhook endpoint) |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Checkout plano Creator mensal | Stripe products |
| `STRIPE_PRICE_ID_PRO_YEARLY` | Creator anual | Stripe |
| `STRIPE_PRICE_ID_BUSINESS_MONTHLY` | Pro mensal | Stripe |
| `STRIPE_PRICE_ID_BUSINESS_YEARLY` | Pro anual | Stripe |
| `RESEND_API_KEY` | Envio de emails | Resend dashboard |
| `EMAIL_FROM` | Sender (`Sequência Viral <viral@kaleidos.com.br>`) | Produção manual |
| `SERPER_API_KEY` | Busca de imagens stock | Serper dashboard |
| `APIFY_API_TOKEN` / `APIFY_API_KEY` | Scraping Instagram | Apify console |
| `SCRAPECREATORS_API_TOKEN` | Fallback IG scraper | ScrapeCreators |
| `SUPADATA_API_KEY` | Transcrição fallback | Supadata |
| `META_APP_ID` | FB Login opt-in | Meta developers |
| `CRON_SECRET` | Auth dos endpoints de cron | Gerado manualmente |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics (opcional) | GA4 |
| `GEMINI_IMAGE_MODEL` | Override modelo imagem (default `imagen-4.0-generate-001`) | Opcional |

---

## 12. Domínios e Deploys

- **Prod**: `viral.kaleidos.com.br` (CNAME → Vercel)
- **Alias Vercel**: `sequencia-viral.vercel.app`
- **Projeto Vercel que importa**: `sequencia-viral`
- **Projeto Vercel legacy**: `postflow` (ignorar — não deployar aqui)
- **Deploy**: push em `main` → auto-deploy. Manual: `vercel --prod --yes` da raiz.
- **GitHub**: `gmadureiraa/postflow`, branch `main`

---

## 13. Referências Rápidas

### Admin emails (acesso ao `/app/admin/*`)
Fonte: `lib/admin-emails.ts::ADMIN_EMAILS`.
- `gf.madureiraa@gmail.com`
- `gf.madureira@hotmail.com`

Gate server-side: `lib/server/auth.ts::requireAdmin`.

### Paths críticos

| Path | Função |
|---|---|
| `lib/pricing.ts` | Preços, planos, limites (fonte única) |
| `lib/admin-emails.ts` | Lista admin UX gate |
| `lib/server/auth.ts` | Gate admin server-side + service role client |
| `lib/landing-faq.ts` | FAQ fonte única (UI + JSON-LD) |
| `app/layout.tsx` | SEO + JSON-LD SoftwareApplication |
| `app/api/generate/route.ts` | Writer principal (linha 675) |
| `lib/server/source-ner.ts` | NER pré-writer |
| `lib/server/image-decider.ts` | Decider de imagem por slide |
| `lib/server/feedback-classify.ts` | Classifier de feedback |
| `lib/server/generation-log.ts` | Pricing por modelo (cost calc) |
| `lib/email/templates/_layout.tsx` | Layout base dos emails |
| `lib/email/dispatch.ts` | Dispatchers de email |
| `app/app/admin/page.tsx` | Painel admin principal |
| `app/app/admin/regras/page.tsx` | Este documento em HTML |
| `vercel.json` | Crons + function timeouts |
| `supabase/migrations/` | Schema do banco |

---

## 14. Inconsistências Encontradas (Auditoria Cross-Environment)

Auditoria rodada em 2026-04-22. Ordenado por severidade.

### P0 — Bloqueante (corrigir imediatamente)

1. **Onboarding mostrava R$ 97 pra plano Pro** (`app/app/onboarding/page.tsx:3530`) — corrigido nesta PR para `R$ 199,90`. Era resquício dos preços pré-migração 2026-04-22.
2. **`tests/stripe-plans.test.ts` inteiro está defasado** (linhas 12-21): expecta `PLANS.pro.priceMonthly=990` (era R$ 9,90), `PLANS.business.priceMonthly=2990`, `usageLimitForPaidPlan("business")=150`, `stripePaymentAmountUsd("pro")=9.90`. Todos divergem de `lib/pricing.ts` atual. **Build passa porque vitest não roda no build**, mas o teste quebra se executado. Fix: atualizar valores esperados (`9990`, `19990`, `30`, `99.90`, `199.90`).

### P1 — Alto (corrigir em seguida)

3. **Tempo de promessa inconsistente** — produto diz "60s" em quase tudo, mas alguns pontos dizem "15s", "30s" ou ambos:
   - `app/landing/v2/page.tsx`: usa "15 segundos" e "~15s" em hero + trust pills + FinalCTA
   - `app/app/login/page.tsx:374`: "Comece a gerar carrosséis editoriais em 30 segundos."
   - `app/app/onboarding/page.tsx:1321`: "Leva uns 30 segundos."
   - `app/app/onboarding/page.tsx:3291`: "Leva uns 30-60 segundos por peça."
   - `lib/blog/posts-content.ts`: múltiplas menções a "30 segundos"
   - `lib/email/dispatch.ts:50`: subject "Cola um link e sai com carrossel em 15s"
   - Fix: padronizar em **~60s** (ou **<1 min**) em todo texto público. O valor real é 60s no fluxo completo (NER + writer + decider + imagens).
4. **Copy "Agência" resquício (baixo, mas bate contra regra)**: o tag footer `/roadmap/page.tsx` e `lib/blog/posts-content.ts` mencionam "agência" como público-alvo — ok, não é nome de plano. Nenhum match como NOME DE PLANO foi encontrado. **OK.**
5. **Cupom BEMVINDO30 referenciado na UI mas não está no DB prod** (`app/app/login/page.tsx:23` lê `?coupon=BEMVINDO30`). O cupom foi aposentado pelo VIRAL50 mas o handler ainda salva `BEMVINDO30` em localStorage. Fix: trocar para `VIRAL50` ou aceitar qualquer cupom válido.
6. **Checkout placeholder mostra `BETA50`** (`app/app/checkout/page.tsx:415`) — deveria mostrar `VIRAL50` que é o cupom ativo.
7. **Migrations no repo que NÃO estão aplicadas em prod** (verificado via PostgREST):
   - `20260419180000_welcome_coupon.sql` (BEMVINDO30) — seed não está no DB
   - `20260418120000_coupons_and_indexes.sql` seed `BETA50` — não está no DB
   - Tabelas **ausentes** em prod que deveriam existir pelas migrations:
     - `stripe_events_processed` (migration `20260419190000`)
     - `carousel_images` (migration `20260422130000`)
     - `user_images` (migration `20260420120000`)
     - `brand_image_refs` (migration `20260419160000`)
   - Tabelas presentes ok: `coupons`, `coupon_redemptions`, `carousel_feedback`, `meta_connections`, `image_theme_cache`.
   - Fix: rodar `bun scripts/apply-migrations.ts` (ou equivalente) contra o Supabase prod para alinhar. Até alinhar, crons/features que dependem das tabelas ausentes podem falhar silenciosamente.

### P2 — Médio (cosmético / cleanup)

8. **`EMAIL_FROM` fallback aponta para Resend sandbox** (`lib/email/send.ts:6`): `onboarding@resend.dev`. Risco: se a var não estiver setada em prod, emails saem do domínio sandbox (pode spam). Garantir `EMAIL_FROM=Sequência Viral <viral@kaleidos.com.br>` na Vercel.
9. **Modelo Claude Sonnet 4.6 hardcoded** (`lib/server/generation-log.ts:40`): `claude-sonnet-4-6`. Confirmar se é o modelo canônico de brand-analysis ou se deveria ser um modelo mais novo. Decisão: manter até próximo passo de upgrade explícito.
10. **`scripts/analyze-brandsdecoded.ts` chama `gemini-2.5-pro` via REST** em vez do SDK. Script de análise — ok, não bloqueia.
11. **Docs em `docs/audit/UNIT-ECONOMICS-2026-04-19.md` e `docs/planning/LANDING-AUDIT-2026-04-22.md` / `AUDIT-APP-2026-04-22.md`** referenciam preços antigos ("R$ 49", "R$ 97") — docs históricos, não interferem em produto. Manter como registro de auditoria; criar nova revisão quando fizer sentido.
12. **DB key nomenclatura confusa**: `pro` = Creator, `business` = Pro. Causa ambiguidade em logs e admin. Sem plano de renomear (quebra users), mas documentar estrita consistência nas referências (§2).
13. **Arquivo `template-futurista.tsx` + `template-autoral.tsx` marcados LEGACY** mas ainda importados em `templates/index.tsx`. Safe pra remoção quando nenhum carrossel antigo tiver `template_id='futurista' | 'autoral'` (checar tabela `carousels`).
14. **`lib/blog/posts-content.ts`**: inclui múltiplas ocorrências de "R$ 49", "R$ 97" e "30 segundos" em conteúdo de blog posts antigos. Posts publicados — deixar e revisar manualmente ao republicar.
15. **`AUTOPUBLISH_BUMP` em `lib/pricing.ts`** ainda existe mas é dead code (checkout desativou). Manter enquanto não houver decisão de remover ou reativar.

### Healthy (verificado e consistente)

- **JSON-LD SoftwareApplication** em `app/layout.tsx:99-123` está alinhado: BRL, preços 0 / 99.90 / 199.90.
- **Pricing section** (`components/landing/pricing-section.tsx:263-271`) está alinhado com `lib/pricing.ts`.
- **Compare section** (`components/landing/compare-section.tsx:49`) mostra cupom corretamente.
- **Checkout page** (`app/app/checkout/page.tsx:39-49`) importa diretamente de `lib/pricing.ts`.
- **Email templates** que mencionam preço (last-chance, plan-limit, onboarding-why-upgrade) estão todos em R$ 99,90 / R$ 49,90 / R$ 199,90.
- **Terms page** (`app/terms/page.tsx:61-62`) lista planos vigentes corretamente.
- **Writer, NER, decider e classifier** usam modelos corretos (Gemini 2.5 Pro / 2.5 Flash / Imagen 4 / Flash Image).
- **Crons + schedules** em `vercel.json` batem com a tabela da §10.
- **Tabela `coupons` em prod** tem VIRAL50 com max_uses=10, plan_scope correto, active=true.

---

## Changelog deste doc

- **2026-04-22** — versão inicial. Auditoria cross-env cobriu preços, cupons, limites, modelos, tempo de promessa, rotas, env vars, migrations vs DB, feature flags. Corrigido resquício R$ 97 em `app/app/onboarding/page.tsx:3530`. Teste defasado `tests/stripe-plans.test.ts` documentado como P0 pendente.
