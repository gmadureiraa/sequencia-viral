# Sequência Viral — Auditoria completa da landing

Data: 2026-04-22
Escopo: landing pública (`/`) + metadata/SEO + páginas institucionais linkadas + variantes em `app/landing/*`.
Leitura pareada: `docs/planning/AUDIT-APP-2026-04-22.md` (auditoria do app logado).

---

## 1. Overview

- **URL produção:** https://viral.kaleidos.com.br (apelido `sequencia-viral.vercel.app`).
- **Rotas da landing pública:**
  - `/` — home canônica (`app/page.tsx`)
  - `/landing` — índice de variantes (`app/landing/page.tsx`) com 6 links de teste A/B
  - `/landing/chatsheet` — re-export da home (`app/landing/chatsheet/page.tsx`, 7 linhas)
  - `/landing/v2` — variante "velocidade" (`app/landing/v2/page.tsx`, 537 linhas, ativa)
  - `/landing/v3`, `/landing/v4`, `/landing/v5`, `/landing/v5-neobrutal` — redirect 301 pra `/` (6 linhas cada)
  - `/roadmap`, `/blog`, `/blog/[slug]`, `/privacy`, `/terms`, `/account/data-deletion`
- **Stack:**
  - Next 16 App Router, React Server Components + `"use client"` nos componentes com estado
  - Tailwind v4 inline + utilities custom `.sv-*` em `app/globals.css` (1.264 linhas)
  - Fontes Google: `Plus_Jakarta_Sans`, `Instrument_Serif`, `JetBrains_Mono` + 3 fontes locais (`Atelier.ttf`, `Gridlite.otf`, `Inter.ttf` via `@font-face`)
  - `framer-motion` pra reveal/scroll anims
  - `@vercel/analytics`, `@vercel/speed-insights`, `@next/third-parties/google` (GA)
  - PostHog via `LpVariantTracker` nas variantes
- **Números da home (`app/page.tsx`):**
  - 11 seções renderizadas + popup de boas-vindas
  - ~3.779 linhas totais nos 16 componentes de `components/landing/*`
  - 11 imagens PNG em `public/brand/landing/` (~6.8 MB no total, todas raster)
  - 2 logos usadas (`logo-sv-full.png` em nav + footer)
  - CTAs primários: 5 visíveis diretos na home (nav topo, hero, pricing×3, final CTA) + 1 secundário "Ver roadmap"

---

## 2. Mapa de seções (em ordem de aparição)

### 2.1 TopNav — `components/landing/top-nav.tsx` (161 linhas)

**Intenção:** ancorar navegação sticky, mostrar logo e oferecer CTA primário permanente.

**Copy transcrita:**
```
Logo: /brand/logo-sv-full.png (alt="Sequência Viral")
Links: Como funciona · Exemplos · Features · Pricing · FAQ
CTA secundário: "Entrar"          → /app/login (só pra não logado)
CTA primário:   "Criar grátis →"   → /app/login (não logado)
                "Ir pro app →"     → /app (logado)
```

**Design:**
- Sticky top, `z-50`, background `color-mix(sv-paper 90%, transparent)` + `backdrop-filter: blur(10px)`
- Border-bottom 1px preto
- Max-width 1240px, padding 6 em x / 3 em y
- Logo animado com `sv-anim-float-slow` (flutuação constante)
- Links mono em uppercase com hover `background: var(--sv-green)` e letter-spacing 0.16em
- Mobile: menu hamburger com `AnimatePresence`

**Imagens:** 1 — `/brand/logo-sv-full.png` (202 KB, `<img>` sem `next/image`)

**CTA destino:** Dinâmico via `useLandingSession()` — `/app/login` ou `/app`.

**Responsive:** Desktop mostra links + CTAs; mobile esconde atrás de hamburger.

**Issues:**
- **P1** — `<img>` cru em vez de `next/image` no logo (linha 37) mata otimização automática. Alt correto mas sem `width`/`height`, causa layout shift.
- **P1** — Logo PNG de 202 KB pra um mark que poderia ser SVG (já existe `kaleidos-logo.svg` em `/brand`, mas não há `logo-sv.svg`).
- **P2** — Link âncora "Exemplos" (`#exemplos`) **não existe** na home (só `#dor`, `#como`, `#features`, `#compare`, `#pricing`, `#faq`, `#demo`). Click scroll não encontra alvo — some trava em topo.
- **P2** — Botão primário `fontSize: 9.5` em mono uppercase é extremamente pequeno (~9.5px); acessibilidade ruim em mobile sem zoom.
- **P2** — `aria-label="Abrir menu"` no botão hamburger não muda pra "Fechar menu" quando `open` é true.

---

### 2.2 Hero — `components/landing/hero.tsx` (541 linhas)

**Intenção:** capturar o visitante em 3s com promessa clara + visual caótico editorial + CTA único.

**Copy transcrita:**
```
Eyebrow: "De ideia a post em 1 minuto"

H1 (3 linhas):
  Carrossel pronto
  antes do café esfriar.

Subtítulo:
  Cola o link, escolhe o template, gera. A IA escreve no seu tom,
  monta os slides e deixa tudo pronto pra postar — em menos tempo
  do que você levaria pra abrir o Canva.

CTA primário:  "Criar primeiro grátis" → /app/login
                "Ir pro app →"          → /app (logado)

Trust pills (3):
  ✦ Sem cartão
  ✦ 5 carrosséis grátis
  ✦ Pronto pra postar

Badge topo-direito:  ✦ Em 60 seg (verde, rotacionado 6deg)
Badge canto-baixo:   Seu conteúdo · seu ritmo (pink, rotacionado -5deg)

Mockup phone — typewriter rodando 4 briefs em loop:
  "faz um post sobre o novo algoritmo do Instagram..."
  "carrossel sobre por que ninguém salva meus posts..."
  "3 hooks pro meu reel sobre produtividade real..."
  "quebra esse artigo do Bloomberg em 8 slides..."
```

**Design:**
- Background `--sv-paper`, padding responsivo `clamp(28px, 4.2vw, 56px)` em y
- Grid 2 colunas (1.05fr / 0.95fr) até 860px, cola em 1 coluna
- Max-width 1240px
- H1 usa `font-family: var(--sv-display)` (Atelier / Instrument Serif fallback), `font-size: clamp(36px, 4.8vw, 64px)`, `line-height: 1.02`, com `<em>` em itálico e highlight inline `.sv-splash` (verde) + `.sv-under` (sublinhado pink translúcido)
- Visual collage: 6 imagens PNG com animações (`float`, `float-slow`, `drift`, `spin-slow`)
- Phone mockup rotacionado -4deg, `aspect-ratio: 9/16`, largura 54% do container
- Cursor piscando `.sv-cursor` dentro do textarea simulado

**Imagens (todas em `/brand/landing/`):**
- `hero-mandala.png` (183 KB) — decoração `top:8% left:8%`, opacity 0.12, spin-slow
- `hero-mouth.png` (850 KB) ⚠️ — canto superior esquerdo, `fetchPriority="high"`, flutuando -8deg
- `hero-brain.png` (1.2 MB) ⚠️⚠️ — top-right, flutua 12deg
- `hero-ear.png` (174 KB) — bottom-left, drift -10deg
- `hero-hand.png` (371 KB) — bottom-right, flutua 6deg
- `hero-megaphone.png` (177 KB) — mid-right, flutua 14deg
- `star-lg.png` (53 KB) + `star-sm.png` (56 KB) — estrelinhas girando

**CTA destino:** `/app/login` (ou `/app`).

**Responsive:** `@media (max-width: 860px)` cola grid em 1 coluna, visual centraliza 420px.

**Issues:**
- **P0** — Peso total de imagens no hero: **~3.0 MB** de PNGs decorativos carregados (mesmo com `loading="lazy"`, `hero-mouth.png` tem `fetchPriority="high"` e é 850 KB). Isso é o maior red flag de LCP/CLS.
- **P0** — Todas as 6 imagens do hero são `aria-hidden` + `alt=""`. Pra SEO + acessibilidade, tudo bem (são decorativas), **mas não há nenhuma imagem semântica/screenshot do produto real** no hero. A promessa "carrossel em 60s" não é provada visualmente — o phone mockup é um CSS-mockup, não um screenshot.
- **P1** — H1 usa serif display Atelier (font local) — ótimo pra voz, mas `font-display: swap` causa flash se Atelier não pre-carrega. Sem `<link rel="preload">`.
- **P1** — CTA único no hero ("Criar primeiro grátis"). Não há CTA secundário tipo "Ver exemplo" que reduza fricção de quem ainda duvida.
- **P1** — Typewriter (`setTimeout` 42ms) roda em client. Em safari iOS com reduced motion ativado, a animação continua sem checar `prefers-reduced-motion`.
- **P1** — CTA button `fontSize: 11.5` — abaixo do floor recomendado de 14px para ação primária.
- **P2** — Phone mockup tá dentro de `absolute` com `transform rotate(-4deg)` + `translate(-50%, -50%)`. Em mobile < 420px ele transborda do container.
- **P2** — Subtítulo tem `<b>` com cor e peso 600 inline — funciona mas aumenta specificity inline ruído.

---

### 2.3 Ticker — `components/landing/shared.tsx` (linhas 91-113)

**Intenção:** social proof numérica tipo manchete de jornal, movimento constante.

**Copy transcrita:**
```
2.143        carrosséis gerados
~60s         por carrossel
4 origens    · YouTube · Blog · Reel · Ideia
30 posts     /mês no Pro
```

**Design:**
- Fundo preto (`--sv-ink`), texto creme (`--sv-paper`), border-top/bottom ink
- Padding 14px em y
- Marquee `animation: sv-marquee-x 40s linear infinite`
- Cada item tem `.sv-hl` verde itálico no número + separador ✦ girando (estrela verde em círculo)

**Imagens:** 0.

**Issues:**
- **P0** — "2.143 carrosséis gerados" é **número hardcoded**. Se não é real ou não está vivo via API, vira claim vazio. Pior: número estático que nunca sobe passa sensação de produto morto (se user voltar duas semanas depois e ver mesmo número).
- **P2** — Ticker não respeita `prefers-reduced-motion`. CSS keyframe `sv-marquee-x` roda sempre.

---

### 2.4 PainSection — `components/landing/pain-section.tsx` (278 linhas)

**Intenção:** provocar identificação ("isso sou eu") antes de apresentar solução.

**Copy transcrita:**
```
SectionHead:
  01 — A dor antes da cura · tag "Familiar?"
  Título: "Você tem ideia. O que falta é tempo pra virar post."

4 cards:
  Sintoma 01 — Escrever um carrossel bom leva 3h.
    "Você grava o vídeo, escreve o artigo, tem a ideia. Aí passa a
    tarde inteira brigando com Canva pra transformar aquilo em 6 slides.
    O conteúdo nasce cansado."
    cross: "Produtividade zerada"

  Sintoma 02 — O ChatGPT devolve texto sem cara.
    "Você pede um carrossel e vem aquele copy genérico que qualquer
    creator do nicho poderia postar. Emoji demais, bullet demais,
    adjetivo demais. Parece IA."
    cross: "Identidade diluída"

  Sintoma 03 — Arrastar texto no Canva é produção, não criação.
    "Cada slide vira 20 minutos de alinhar caixa, escolher cor, revisar
    fonte. Você achou que ia ter ideia — só tá operando ferramenta. A
    energia some antes do 3º slide."
    cross: "Execução cansa criação"

  Sintoma 04 — Consistência vira pressão em vez de hábito.
    "Começa a semana prometendo 5 posts. Posta 2 na segunda e some até
    sexta. O algoritmo pune a pausa, você pune o ego. O ciclo se repete."
    cross: "Reach despencando"

Banner verde "O plot twist":
  "O conteúdo já existe na sua cabeça, no seu YouTube, no seu blog.
   O que falta é uma ferramenta que termine o trabalho."
  Caption: "Desliza pra baixo — é a cura ↓"
```

**Design:**
- Background `--sv-soft` (cinza-creme), border top/bottom ink 1px
- Padding 96px em y
- Grid `repeat(auto-fit, minmax(260px, 1fr))` — 4 cards
- Cada card: branco, border 1.5px preto, shadow `4px 4px 0 0 ink` (brutalist offset), padding 26px/24px, minHeight 240px
- Label mono "SINTOMA NN" + x pink no canto
- H3 serif 22px + body muted 13.5px
- Footer: "cross" em mono pink com dash-border superior
- Banner verde final ocupa largura total, `padding 28px`, box-shadow brutalist

**Imagens:** 0 (só ícones Unicode × e ↓).

**Issues:**
- **P2** — Emojis `×` nos cards renderizados como glyphs — sem `aria-hidden`, lidos por screen reader como "multiplication sign".
- **P2** — Plot twist e "desliza pra baixo" usam seta que em iOS pode não renderizar dependendo da fonte mono.
- **P2** — Copy dos 4 sintomas é forte mas **4 é demais**. Testar corte pra 3 pode subir legibilidade mobile (grid empilha tudo).

---

### 2.5 HowItWorks — `components/landing/how-it-works.tsx` (168 linhas)

**Intenção:** desmistificar o produto em 3 passos simples.

**Copy transcrita:**
```
SectionHead:
  02 — Como funciona · tag "Manual"
  Título: "Três passos. Nenhum deles envolve editar no Canva."

Step 01 — Cole a fonte.
  "Link de YouTube, artigo de blog, post do Instagram, PDF ou só uma
  ideia em uma frase. A IA escuta e entende."

Step 02 — A IA pensa.
  "A IA lê sua fonte, aprende seu tom pelo DNA das suas redes e monta
  um carrossel completo com imagens próprias em ~60 segundos."

Step 03 — Edite. Exporte. Poste.
  "Ajuste texto e imagem inline. Exporta PNG 1080×1350 pixel-perfect.
  Abre no celular, posta. Acabou."
```

**Design:**
- Padding 96px em y, sem background
- Grid 3 colunas, border top/bottom ink 1.5px, border-right entre colunas
- Cada step: número 64px display itálico + imagem (78×78) rotacionada -6deg + título serif 22 + body muted
- Hover: card inteiro fica verde (`hover:bg-[var(--sv-green)]`), imagem rotaciona +4deg
- `<style>` inline com media query mobile (cola em 1 coluna)

**Imagens (em `/brand/landing/`):**
- Step 01: `hero-ear.png` (174 KB) — orelha
- Step 02: `step-typewriter.png` (295 KB) — typewriter
- Step 03: `hero-megaphone.png` (177 KB) — megafone

**Issues:**
- **P1** — Step 02 afirma "com imagens próprias em ~60 segundos" — claim de tempo preciso. Se pipeline real de imagens (Imagen + Serper) às vezes passa de 60s em picos, isso cria decepção no primeiro uso.
- **P2** — Step 01 menciona "PDF" como entrada aceita, **mas** em `app/app/create/new/page.tsx` o `detectSource()` detecta só YouTube/link/Instagram/ideia. PDF não é suportado no fluxo atual — claim falso.
- **P2** — Imagens reusadas do hero (`hero-ear.png` + `hero-megaphone.png`). Repetição reduz sensação de "cada passo tem sua identidade".

---

### 2.6 FeaturesSection — `components/landing/features-section.tsx` (461 linhas)

**Intenção:** mostrar features do produto num bento grid.

**Copy transcrita:**
```
SectionHead:
  03 — Features · tag "Produto"
  Título: "Um editor que pensa, não só um gerador que preenche."

Card 01 (span 6) — "Brief engine":
  Título: "Um editor que pensa, não só um gerador."
  Body:   "Escreve o briefing e a IA processa contexto, voz e referências
          — antes de virar slide."
  Mock animado rodando 4 briefs em loop (mesmos do Hero)
  Status labels: Digitando · Lendo briefing · Processando voz + estética
                · Carrossel pronto · Limpando

Card 02 (span 6) — "Voz da IA":
  Título: "O tom é seu, não do ChatGPT."
  Body:   "Configure pilares, audiência, tabus, exemplos de posts.
          A IA escreve dentro dessas regras."
  Input box: "@meuperfil · 30 posts + regras"
  Output box (verde): "Carrossel com o seu tom"
```

**Design:**
- Padding 96px em y
- Bento grid 12 colunas, apenas 2 cards ativos (ambos `span 6`), `gridAutoRows: minmax(140px, auto)`
- `.sv-card` — branco, border preto, shadow offset 4px brutalist, hover lift
- Mock interno com border 1.5px, shadow 3px, padding 10px, minHeight 100px
- Status pill muda cor conforme fase (pink=thinking, verde=ready)

**Imagens:** 0.

**Issues:**
- **P0** — Section declara `grid-template-columns: repeat(12, 1fr)` com 2 cards ocupando `span 6`. **Resultado visual = grid de 2 colunas**. Sem outros 3 cards (editorCard, imageCard, aestheticCard) que as props declaram — toda estrutura de props é **dead code**. São 461 linhas de file pra 2 cards funcionais.
- **P1** — Título da section e título do Card 01 são **idênticos** ("Um editor que pensa, não só um gerador"). Redundância visual.
- **P1** — Card "Brief engine" replica EXATAMENTE o typewriter já visto no Hero. Mesma copy de briefs. Usuário já viu isso há 3 seções atrás.
- **P1** — Section promete várias features (mesa de mix com "pilares, audiência, tabus, exemplos") mas não mostra nenhuma screenshot real dessas telas (settings/voz IA existe de fato em `/app/settings`).
- **P2** — `FeatKicker`, `FeatTitle`, `FeatBody`, `VoiceBox`, `ExportRow` — 5 componentes helper declarados; apenas 3 usados. `ExportRow` nunca é renderizado. Dead code.
- **P2** — Todas as props opcionais (`bigCard`, `aestheticCard`, `editorCard`, `imageCard`, `voiceCard`) nunca são consumidas pela home. Só voiceCard é usado e mesmo assim com defaults.

---

### 2.7 CompareSection — `components/landing/compare-section.tsx` (133 linhas)

**Intenção:** tabela comparativa honesta Sequência Viral × Canva × ChatGPT × Manual.

**Copy transcrita:**
```
SectionHead:
  04 — Sem vs Com · tag "Honesto"
  Título: "Com Sequência Viral vs. sem."

Colunas: Sequência Viral | Canva | ChatGPT | Manual

Linhas (9):
  Tempo por carrossel      | ~60 segundos              | 45–60 min          | 20 min + edição    | 2–3 horas
  Transcreve YouTube       | ✦ Automático              | ✕                  | Copia/cola         | Manual
  Lê legenda de IG/X       | ✦ Com OCR dos slides      | ✕                  | Parcial            | Manual
  Escreve com a SUA voz    | ✦ Voz configurável por DNA| ✕                  | Depende do prompt  | Precisa revisar
  Referências visuais      | ✦ 3 imagens → paleta/mood | Manual             | ✕                  | Manual
  Imagem por slide         | ✦ Cinemática contextual   | Stock photo        | ✕                  | Manual
  Export pronto pra postar | ✦ 1 clique                | Manual             | ✕                  | Manual
  Preview real (WYSIWYG)   | ✦ Sim                     | ✓                  | ✕                  | ✓
  Preço pra postar todo dia| $9.90/mês                 | $15/mês            | $20/mês            | Seu tempo
```

**Design:**
- Padding bottom 96px
- Tabela dentro de wrapper branco com border 1.5px e shadow 5px brutalist
- Primeira linha (nome): fonte display 18px, bg `--sv-soft`, primeira coluna vazia, coluna SV em verde
- Células SV têm `fontWeight: 600` + bg `color-mix(sv-green 22%, sv-white)`
- Células "✕" renderizadas pink com fontWeight 700
- `overflow-x-auto` com minWidth 720px (scroll horizontal no mobile)
- Linhas com `motion.tr` stagger por 0.05s

**Imagens:** 0.

**Issues:**
- **P0** — **Preço SV em USD ("$9.90/mês") conflita com PricingSection logo embaixo que mostra R$ 49/mês, R$ 97/mês.** Contradição numérica direta pra usuário.
- **P0** — "Preço pra postar todo dia" vs os R$ 49 do Creator (10/mês = 1 a cada 3 dias) vs R$ 97 do Pro (30/mês = 1/dia) — a tabela diz "postar todo dia" mas pra isso precisa do Pro (R$ 97), não do preço exibido.
- **P1** — "Com OCR dos slides" — feature que deveria ser verificada; o pipeline faz vision do slide IG mas a palavra "OCR" pode confundir (não é OCR clássico).
- **P1** — "Imagens por slide: cinemática contextual" é bastante subjetivo/vago pro campo.
- **P2** — "Canva: 45-60 min" é claim sem fonte. Crível mas sem link.
- **P2** — Minwidth 720 com scroll horizontal em mobile é UX ruim. Alternativa: re-layout em cards.

---

### 2.8 PricingSection — `components/landing/pricing-section.tsx` (352 linhas)

**Intenção:** apresentar 3 planos com toggle mensal/anual.

**Copy transcrita:**
```
SectionHead:
  05 — Pricing · tag "Preço de lançamento"
  Título: "Preço honesto. Em real, sem pegadinha."

Toggle: Mensal | Anual −20%

Card Grátis:
  Ribbon: "Pra experimentar"
  Preço: R$ 0
  Features:
    ✦ 5 carrosséis grátis pra testar
    ✦ Até 12 slides por carrossel
    ✦ Export PNG em alta
    ✦ Modo rápido + avançado
    ✦ Templates Futurista + Twitter
  CTA: "Começar agora" → /app/login

Card Creator (featured, preto):
  Ribbon: "Mais popular"
  Tag: "Pra criador solo"
  Preço mensal: R$ 49/mês (anchor R$ 79)
  Preço anual: R$ 39,20/mês (cobrado R$ 470,40/ano)
  Features:
    ✦ 10 carrosséis/mês
    ✦ Até 12 slides por carrossel
    ✦ Voz da IA configurável
    ✦ Export PNG pronto pra postar
    ✦ Templates Futurista + Twitter
    ✦ 1 perfil de marca
    ✦ Transcrição de vídeos
  CTA: "Assinar Creator →" → /app/checkout?plan=pro

Card Pro:
  Ribbon: "Pra criador avançado"
  Preço mensal: R$ 97/mês (anchor R$ 149)
  Preço anual: R$ 77,60/mês (cobrado R$ 931,20/ano)
  Features:
    ✦ 30 carrosséis/mês
    ✦ Tudo que o Creator tem
    ✦ Acesso antecipado a novos templates
    ✦ Agendamento + publicação (em breve)
    ✦ Export PNG + PDF
    ✦ Suporte prioritário
  CTA: "Assinar Pro" → /app/checkout?plan=business
```

**Design:**
- Padding bottom 96px
- Grid 1-col mobile / 3-col desktop, gap 16px
- Card featured: fundo preto, texto creme, shadow verde brutalist, translateY -8px
- Preços em display italic 44px, anchor riscado mono 10px
- Toggle pill com bg ink quando ativo
- Media query mobile anula translateY pra não quebrar grid

**Imagens:** 0.

**Issues:**
- **P0** — Plano Creator mapeia pra `/app/checkout?plan=pro` (URL confuso) e plano Pro pra `/app/checkout?plan=business`. Naming do URL **não bate** com naming exibido. Vai gerar bugs em tracking/analytics (evento `checkout_started` com `plan=pro` quando user viu "Creator").
- **P0** — CompareSection diz `$9.90/mês` em USD, Pricing diz R$ 49/mês. Schema JSON-LD em `layout.tsx` declara Free/Pro ($9.99)/Business ($29.99) em USD. **3 preços diferentes em 3 lugares.**
- **P0** — Feature "Agendamento + publicação (em breve)" no plano Pro — user paga R$ 97/mês por algo que não existe. Tecnicamente "em breve" é disclosure, mas anuncia benefício como se fosse diferencial do plano.
- **P1** — Tag "Preço de lançamento" dá sensação de urgência sem cronômetro. Se for preço permanente, claim questionável.
- **P1** — Não há comparação visual clara entre features do Creator vs Pro — user tem que ler duas listas. Uma tabela feature-by-feature lateral (como CompareSection) é mais honesto.
- **P1** — Schema JSON-LD em `layout.tsx` (linha 99-123) anuncia planos como **"Free", "Pro" ($9.99), "Business" ($29.99)** em USD — totalmente desalinhado com a UI em R$. Google Search vai puxar os números do schema e mostrar valor errado no rich result.
- **P2** — Anchor prices (R$ 79 e R$ 149) sem explicação. Pode passar por fake anchor.

---

### 2.9 TestimonialsSection — `components/landing/testimonials-section.tsx` (200 linhas)

**Intenção:** social proof textual (3 "tweets" de creators).

**Copy transcrita:**
```
SectionHead:
  06 — Quem já usa · tag "Creators"
  Título: "Criador posta mais. Porque parou de brigar com Canva."

⚠️ Notice banner pink pulsante (acima dos cards):
  ● Exemplos ilustrativos · depoimentos reais chegam em breve

Tweet 01 — Ana Escala (@ana.escala):
  "Testei 6 ferramentas de carrossel com IA. Sequência Viral é a única
  que não devolve copy cheirando a ChatGPT. Colei uma transcrição de
  40 min de podcast e saiu um carrossel que parecia escrito por mim,
  num domingo, com café."
  Role: Criadora solo · SaaS

Tweet 02 — Lucas Onchain (@lucas.onchain):
  "Cola o link do meu vídeo, recebe 3 ângulos editados. O insano é que
  a IA capturou as 2 gírias que eu mais uso ("thesis off", "alpha barato")
  sem eu ter pedido. Isso é que eu chamo de voz."
  Role: Analista cripto · 22k

Tweet 03 — Dra. Mariana (@dra.mariana.sono):
  "Uso pra virar artigos científicos em carrossel pra leigos. Antes: 2h
  pra traduzir e diagramar. Agora: 6 minutos. Triplicou meu ritmo sem
  precisar contratar social media."
  Role: Medicina do sono · educadora
```

**Design:**
- Padding bottom 96px
- Notice banner: bg pink, border ink, shadow 3px brutalist, bolinha ink pulsante
- Grid 1-col mobile / 3-col desktop
- Cada card: branco, border 1.5px, shadow 4px brutalist, padding 22
- Avatar: círculo 38×38 com inicial do nome, cores rotativas (verde/pink/ink)
- Role em mono pequeno uppercase na base, com dash-border-top

**Imagens:** 0 (só avatars com iniciais).

**Issues:**
- **P0** — Banner admitindo "exemplos ilustrativos" é **honesto** (ponto positivo), **mas** a seção inteira perde função CRO: 3 depoimentos falsos rotulados não convertem — convertem menos que 1 depoimento real. Ou remove, ou substitui por cases reais (mesmo que 1).
- **P0** — Handles `@ana.escala`, `@lucas.onchain`, `@dra.mariana.sono` parecem reais — se user googlar e não achar, fica com impressão de fraude. Piora mesmo com notice.
- **P1** — Role "22k" é ambíguo (seguidores? views?). Contextualizar.
- **P1** — Avatar só com inicial soa improvisado. Dá pra gerar 3 avatars stock ou usar ilustração.
- **P2** — Terceiro tweet "Dra. Mariana" tem handle `@dra.mariana.sono` — uso de `@dra.` em perfil X não é convencional.

---

### 2.10 FAQSection — `components/landing/faq-section.tsx` (194 linhas)

**Intenção:** responder objeções antes do pricing.

**Copy transcrita (9 perguntas):**
```
01 — A IA copia o meu estilo?
  "Não copia. Aprende. Você cola seu @ e escolhe até 10 posts que
  representam sua voz. A IA extrai padrões (vocabulário, ritmo, tipo de
  abertura, tabus) e usa isso como restrição. Você pode ainda adicionar
  regras manuais tipo 'não uso hashtag', 'nunca começo com pergunta
  retórica', 'evito emoji'. O resultado é um carrossel que passa pelo
  teste do 'parece algo que eu escreveria'."

02 — A IA inventa coisas no carrossel?
  "Não. A IA trabalha exclusivamente em cima da fonte que você colou:
  transcrição de vídeo, artigo ou sua nota. Se não estiver na fonte,
  não entra no carrossel. No modo avançado você ainda revisa os
  ângulos antes da IA escrever — duas camadas de controle. Nada de
  alucinação."

03 — Posso usar os carrosséis comercialmente?
  "Sim, todo conteúdo gerado é seu. Textos, imagens geradas, PNGs
  exportados: uso pessoal, cliente, agência, venda, não importa. Não
  cobramos royalty e não reclamamos autoria. A única coisa que pedimos
  é não republicar a ferramenta em si como se fosse sua."

04 — E se eu não gostar da imagem gerada?
  "Três opções. Uma: regenera a imagem daquele slide específico (não
  re-gera o carrossel todo). Duas: troca pro modo 'sem imagem' — fica
  só texto editorial, e é rápido. Três: faz upload da sua própria
  foto/ilustração e a IA reajusta o layout em volta. Nenhuma dessas
  opções custa geração extra."

05 — Como as referências visuais funcionam?
  "Você sobe 3 imagens que representam a estética da sua marca (post
  antigo, moodboard, foto de produto). A IA extrai paleta, textura,
  densidade e linguagem visual. A partir disso, toda imagem gerada é
  uma extensão coerente — o carrossel de cripto do @lucas.onchain não
  parece o carrossel de design do @kaleidos.studio, mesmo usando o
  mesmo template."

06 — Funciona com qualquer canal do YouTube?
  "Qualquer vídeo público com áudio audível. Transcrevemos em português,
  inglês e espanhol. Vídeos acima de 2h podem levar alguns minutos
  extras. Lives e podcasts longos funcionam — rodamos transcrição em
  background enquanto você trabalha em outra coisa."

07 — Os carrosséis podem ser editados depois?
  "Sim, tudo é editável inline: texto, tamanho da fonte, cor, template,
  ordem dos slides, variante do layout (capa, headline, foto, quote,
  split, CTA). Você pode reutilizar um carrossel antigo como base pra
  um novo e só trocar a fonte de conteúdo. Rolê usado por agências pra
  padronizar entrega."

08 — Posso cancelar quando quiser?
  "Sem fidelidade. Cancela pelo painel em 2 cliques. Se cancelar no
  mesmo mês que assinou, devolvemos integral, sem perguntar. No plano
  Agência, rateio proporcional pros dias usados."

09 — Quem tá por trás do Sequência Viral?
  "Sequência Viral é um produto da Kaleidos Digital, agência brasileira
  de marketing de conteúdo que atende criadores, fintechs e projetos
  cripto/web3. A gente cansou de ver copy genérica dominando o feed e
  fez a ferramenta que queríamos usar com os nossos clientes."
```

**Design:**
- Padding bottom 96px
- Container max-width 880
- Border top/bottom ink 1.5px delimita FAQ
- Cada item: button full-width, padding 22px 0, border-bottom ink 1px
- Pergunta em display italic 22px com `<em>` inline
- Ícone + em quadrado 28×28, preenche verde + rotate 45deg ao abrir
- Answer: muted 14px, max-height 500 animada, padding-right 48
- `openIdx` default = 0 (primeira pergunta já aberta)

**Imagens:** 0.

**Issues:**
- **P0** — FAQ da landing tem **9 perguntas** mas o JSON-LD `faqJsonLd` em `layout.tsx` puxa de `LANDING_FAQ` em `lib/landing-faq.ts` que tem **outras 9 perguntas diferentes**. São dois FAQs desconectados. Google vai indexar as 9 do LIB (diferentes do que está na página) e trigger "Perguntas e respostas" rich result com conteúdo que não existe na página.
- **P0** — FAQ 08 menciona "No plano Agência, rateio proporcional" — **plano Agência não existe** nos 3 planos mostrados (Grátis/Creator/Pro). Contradição direta.
- **P1** — FAQ 05 menciona "@kaleidos.studio" e "@lucas.onchain" como exemplos — refere-se ao tom do creator das testimonials que user acabou de ler. Coerência boa, mas handles inexistentes.
- **P1** — FAQ 01 menciona "cola seu @ e escolhe até 10 posts". No onboarding atual, é scrape automático de 20 posts, não escolha manual.
- **P1** — FAQ 02 menciona "modo avançado" — existe (`mode: writer/layout-only`) mas a descrição de "revisar ângulos" parece falar de um fluxo de concepts que foi desdeprecado (`/app/create/[id]/concepts` é legado).
- **P1** — FAQ 07 lista variantes "(capa, headline, foto, quote, split, CTA)" — variantes reais são `cover/solid-brand/full-photo-bottom/text-only/cta`. Nome divergente.
- **P2** — Primeira pergunta já aberta por default — acessibilidade ok, mas carrega DOM inteiro.
- **P2** — `max-height: 500` corta respostas longas. FAQ 01 passa de 500px em mobile (texto + paddings).

---

### 2.11 FinalCTA — `components/landing/final-cta.tsx` (214 linhas)

**Intenção:** fechar com CTA escuro e quase-tela cheia.

**Copy transcrita:**
```
Eyebrow: ● Pronto pro primeiro post?

H2 (2 linhas):
  Seu primeiro carrossel
  em 30 segundos.  (italic verde)

Subtítulo:
  "Cole um link, um texto ou uma ideia. A IA faz o resto, com a sua voz."

CTAs:
  "Criar carrossel grátis →"  → /app/login (não logado)
  "Ir pro app →"              → /app (logado)
  "Ver roadmap"                → /roadmap

Trust pills:
  ✦ Sem cartão
  ✦ 5 carrosséis grátis
  ✦ Cancele quando quiser
```

**Design:**
- Padding 108px em y
- Fundo ink (`#0A0A0A`), texto creme
- Background decorativo: `repeating-conic-gradient` verde rodando 180s
- 3 imagens PNG com `filter: invert(1)` (megafone top-right, typewriter bottom-left, star-lg top-left)
- H2 `font-size: clamp(40px, 5.6vw, 80px)` serif
- Motion stagger de ~0.1s entre elementos

**Imagens:**
- `hero-megaphone.png` (177 KB) — invertida
- `step-typewriter.png` (295 KB) — invertida
- `star-lg.png` (53 KB)

**Issues:**
- **P1** — Hero promete "60s" (badge), HowItWorks promete "60s", FinalCTA promete "30 segundos". Promessa de tempo inconsistente.
- **P1** — Duas imagens reutilizadas com `invert(1)` — ainda carrega o PNG color original (300+ KB) pra depois inverter via CSS. Melhor ter versões white nativamente.
- **P1** — Background animation `repeating-conic-gradient` rodando 180s infinito — custo de GPU constante, não respeita reduced motion.
- **P2** — "Ver roadmap" é CTA secundário fraco. Pode ser substituído por "Ver exemplos" (mas a seção exemplos não existe).

---

### 2.12 Footer — `components/landing/footer.tsx` (181 linhas)

**Intenção:** ancorar footer com links legais, produto, suporte.

**Copy transcrita:**
```
Logo: /brand/logo-sv-full.png (120px altura)
Tagline: "Cole um link. Publique um carrossel. Em minutos, não em horas.
         Um braço da Kaleidos Digital."

Col "Produto":
  - Criar carrossel → /app/login
  - Pricing → #pricing
  - Roadmap → /roadmap
  - Blog → /blog

Col "Kaleidos":
  - kaleidos.com.br → https://kaleidos.com.br (external)
  - Manifesto → #manifesto
  - WhatsApp suporte → https://wa.me/5512936180547

Col "Legal":
  - Privacidade → /privacy
  - Termos → /terms
  - WhatsApp suporte → https://wa.me/5512936180547

Bottom bar:
  "Sequência Viral — Todos os direitos reservados"
  "By Kaleidos Digital"  (link italic)
```

**Design:**
- Background paper, border-top ink 1.5px
- Padding 56px top / 24px bottom
- Grid 4 colunas (1.4fr / 1fr×3), colapsa em 2 colunas < 700px
- Logo footer bem grande (120px altura)
- Links em hover: `bg var(--sv-green)`
- Bottom bar: flex space-between com copyright + "By Kaleidos"

**Imagens:** 1 — `/brand/logo-sv-full.png` (202 KB).

**Issues:**
- **P0** — Link "Manifesto" aponta pra `#manifesto` que **não existe na home** (seção foi escondida conforme comentário em `app/page.tsx:15`). Link morto.
- **P1** — WhatsApp duplicado em 2 colunas (Kaleidos + Legal).
- **P1** — Falta link pra `/roadmap` (tem) mas não pra `/blog` na coluna Legal ou Kaleidos. Blog só aparece em Produto — ok, mas pode estar mais visível.
- **P1** — Footer não tem link pra `/account/data-deletion` (obrigação Meta/Facebook App review).
- **P1** — Logo 120px altura × 202 KB PNG — ~50% do peso do footer por 1 imagem. Transformar em SVG cortaria 95% do peso.
- **P2** — Em mobile `<700px` o grid vira 2 colunas — tagline com logo fica comprimida e some legibilidade.

---

### 2.13 WelcomePopup — `components/landing/welcome-popup.tsx` (282 linhas)

**Intenção:** oferta 30% off no primeiro pagamento via cupom `BEMVINDO30` com disparo 12s ou exit-intent.

**Copy transcrita:**
```
Eyebrow: ✦ Oferta de boas-vindas

H2: "30% off no seu primeiro mês."

Body:
  "Cria conta grátis agora. Quando decidir ir pro Pro ou Agência, usa o
  código abaixo no checkout e tira 30% do primeiro pagamento. Sem
  pegadinha, sem fidelidade."

Cupom box: BEMVINDO30 (copiável)

CTAs:
  "Resgatar 30% →" → /app/login?coupon=BEMVINDO30
  "Depois"         (fecha popup)

Disclaimer: "Por tempo limitado"
```

**Design:**
- Overlay fullscreen ink 55% opacity + backdrop-blur 4px
- Card 460px max-width, paper, border 1.5px, shadow 8px brutalist
- Botão X no canto top-right
- Cupom em box com `border: 1.5px dashed ink`, copiável via `navigator.clipboard`
- Aparece 12s após load OU exit-intent (mouse sai pela borda top)
- `localStorage.sv_welcome_popup_seen_v1` persiste visibilidade

**Imagens:** 0.

**Issues:**
- **P1** — Menciona "Pro ou Agência" como planos — só existem "Creator" e "Pro" na pricing. Naming inconsistente (de novo).
- **P1** — `FIRST_DELAY_MS = 12_000` é curto. Se user ainda tá lendo o hero, 12s interrompe UX sem ter dado chance de entender o produto.
- **P1** — Copyar o cupom na área de transferência **não confirma visualmente** (sem toast). User clica e acha que não funcionou.
- **P2** — Exit-intent só desktop (`matchMedia: min-width 768px`) — correto. Mas mobile não tem triggers além dos 12s.
- **P2** — Popup não tem `role="dialog"` com focus trap explícito — clicar fora fecha via `onClick dismiss`, mas keyboard (Tab) pode escapar.

---

## 3. Assets & Imagens — catálogo

Todas em `/Users/gabrielmadureira/GOS/02 - PROJETOS PESSOAIS/036 - POSTFLOW/postflow/public/`.

| Path | Tamanho | Uso | Alt | Otimização | Placeholder? |
|---|---|---|---|---|---|
| `brand/logo-sv-full.png` | 202 KB | nav + footer (44px + 120px) | "Sequência Viral" | `<img>` cru, não usa `next/image`, sem width/height | Real — logo definitivo |
| `brand/logo-sv-mark.png` | 497 KB | `app/icon.png` + `app/apple-icon.png` | Auto (Next) | PNG raw, sem resize explícito | Real |
| `app/favicon.ico` | 538 B | Favicon | — | OK | Real |
| `brand/landing/hero-mandala.png` | 183 KB | Hero — decorativo opacity 0.12 | `""` aria-hidden | `loading="lazy"` ok, sem `next/image` | Real ilustração |
| `brand/landing/hero-mouth.png` | 850 KB ⚠️ | Hero — foco visual | `""` aria-hidden | `fetchPriority="high"` sem lazy (crítico LCP) | Real |
| `brand/landing/hero-brain.png` | 1.2 MB ⚠️⚠️ | Hero | `""` aria-hidden | `loading="lazy"` | Real |
| `brand/landing/hero-ear.png` | 174 KB | Hero + HowItWorks step 01 | `""` aria-hidden | lazy | Real |
| `brand/landing/hero-hand.png` | 371 KB | Hero | `""` aria-hidden | lazy | Real |
| `brand/landing/hero-megaphone.png` | 177 KB | Hero + HowItWorks step 03 + FinalCTA (invertida) | `""` aria-hidden | lazy | Real |
| `brand/landing/star-lg.png` | 53 KB | Hero + FinalCTA | `""` aria-hidden | lazy | Real |
| `brand/landing/star-sm.png` | 56 KB | Hero | `""` aria-hidden | lazy | Real |
| `brand/landing/step-typewriter.png` | 295 KB | HowItWorks step 02 + FinalCTA (invertida) | `""` aria-hidden | lazy | Real |
| `brand/landing/demo-cutout.png` | 528 KB | DemoSection (não usada na home atual) | `""` aria-hidden | lazy | Real — órfão |
| `brand/landing/manifest-cutout.png` | 470 KB | Manifesto (seção escondida) | — | N/A | Real — órfão |
| `brand/landing/hero.png` | 1.2 MB ⚠️ | **Nenhum uso na home atual** | — | N/A | Real — órfão |
| `brand/landing/process-spot.png` | 995 KB ⚠️ | **Nenhum uso na home atual** | — | N/A | Real — órfão |
| `brand/landing/sv-logo.png` | 90 KB | Legado | — | N/A | Real — órfão |

**Peso efetivo carregado no hero (primeira dobra):** ~3.0 MB de PNGs decorativos.
**Peso total da pasta `/brand/landing/`:** ~6.8 MB (≈40% disso é órfão).
**Nenhuma imagem WebP/AVIF.** Nenhuma imagem com `next/image`. Nenhum `<picture>` responsive.

---

## 4. Design tokens

Definidos em `app/globals.css:60-118`.

### Paleta (CSS custom properties)
| Token | Valor | Papel |
|---|---|---|
| `--sv-ink` | `#0A0A0A` | Preto principal (texto, bordas) |
| `--sv-paper` | `#F7F5EF` | Creme de jornal (fundo padrão) |
| `--sv-white` | `#FFFFFF` | Branco puro (cards) |
| `--sv-soft` | `#EFEDE6` | Cinza-creme (sections alternadas) |
| `--sv-line` | `#0A0A0A` | Alias de `--sv-ink` (border) |
| `--sv-muted` | `#6B6960` | Cinza médio (texto secundário) |
| `--sv-green` | `#7CF067` | Verde lime Kaleidos (accent primário, CTA) |
| `--sv-pink` | `#D262B2` | Pink Kaleidos (accent secundário) |
| `--sv-orange` | `#FF4A1C` | CTA quente opcional (não usado na home) |
| `--sv-yellow` | `#F5C518` | Não usado |
| `--sv-blue` | `#2B5FFF` | Não usado |
| `--sv-navy` | `#0B0F1E` | Template Futurista (não landing) |

### Fontes
| Token | Valor | Uso |
|---|---|---|
| `--sv-display` | `"Atelier", "Instrument Serif", "Times New Roman", Georgia, serif` | H1, H2, H3 |
| `--sv-display-alt` | `"Instrument Serif", Georgia, serif` | — |
| `--sv-sans` | `"SVInter", "Inter", system-ui, ...` | Body |
| `--sv-mono` | `"Gridlite", "JetBrains Mono", "Courier New", monospace` | Kickers, CTAs, labels |

Fontes locais carregadas via `@font-face`:
- `/fonts/Atelier.ttf` (display 400)
- `/fonts/Gridlite.otf` (variable 100-900)
- `/fonts/Inter.ttf` (variable 100-900)

Fontes Google via Next/Font (em `layout.tsx`):
- Plus_Jakarta_Sans
- Instrument_Serif
- JetBrains_Mono

**Nota:** Há **redundância de fontes sans**: `--sv-sans` usa `SVInter` (local TTF) enquanto `layout.tsx` também carrega Plus_Jakarta_Sans como `--font-sans`. Os componentes de landing usam `var(--sv-sans)` consistentemente — Jakarta basicamente não é usada na landing, mas é carregada sempre.

### Spacing
Sem escala formal declarada — uso ad-hoc de px e rem direto nos styles inline. Padrão observado: 4 · 6 · 8 · 10 · 14 · 18 · 22 · 28 · 40 · 56 · 96px.

### Border radius
`--radius: 0` global (brutalist). Cards redondos explícitos têm border-radius inline (phone mockup `22px`, welcome popup border `1.5px`, avatar `50%`).

### Shadows
Padrão brutalist offset sem blur: `Npx Npx 0 0 var(--sv-ink)` com N entre 2 e 8.

Principais:
- `2px 2px 0 0` — elementos pequenos (badges, chips)
- `3px 3px 0 0` — botões, inputs
- `4px 4px 0 0` — cards principais
- `5px 5px 0 0` — tabela compare, pricing
- `6px 6px 0 0` — phone mockup
- `8px 8px 0 0` — popup modal

---

## 5. SEO & Metadata

Fonte: `app/layout.tsx:41-88` + `app/opengraph-image.tsx` + `app/robots.ts` + `app/sitemap.ts`.

### Home metadata
```
title:       "Sequência Viral — Carrosséis com IA para Instagram, LinkedIn e X"
description: "Carrossel pronto em ~60 segundos. Cola um link, a IA escreve no seu
              tom, monta os slides e entrega pra postar. Templates Futurista + Twitter."
metadataBase: https://viral.kaleidos.com.br
canonical:    https://viral.kaleidos.com.br
robots:       index + follow, googleBot max-snippet: -1, max-image-preview: large
```

### Keywords (9)
```
gerador de carrossel · carrossel instagram ia · criar carrossel instagram
carousel maker · linkedin carousel · conteúdo redes sociais ia · thread visual
sequencia-viral · export png carrossel
```

### OpenGraph
```
title:       "Sequência Viral — Carrosséis com IA em um fluxo só"
description: "Cola um link, a IA escreve com a sua voz, monta os slides e exporta
              PNG. Instagram, LinkedIn e X em um fluxo só."
type:        website
url:         https://viral.kaleidos.com.br
siteName:    Sequência Viral
locale:      pt_BR
image:       opengraph-image.tsx (edge, ImageResponse, 1200×630)
```

### Twitter card
```
card:        summary_large_image
title:       "Sequência Viral — Carrosséis com IA"
site/creator:@sequencia-viral  ⚠️ (handle com hífen não existe no X)
```

### OG Image (opengraph-image.tsx)
1200×630 gerado por `ImageResponse`. Design: cream (#FFFDF9) com border 10px ink, gradiente laranja no ícone quadrado, texto "Sequência Viral" 56px + descrição 38px + URL pill.

**Problema**: a OG image usa identidade **laranja brutalist antiga** (linear-gradient `#FF8534 → #EC6000`) — **não bate com a identidade atual verde/pink/paper Kaleidos**. Artefato de versão anterior.

### Structured Data (JSON-LD)
2 blocos em `<head>` via `dangerouslySetInnerHTML`:

1. **SoftwareApplication** (layout.tsx:90-133):
   - Declara 3 ofertas: Free ($0), Pro ($9.99/mo), Business ($29.99/mo) **em USD**
   - **Preços totalmente desalinhados com a UI (R$ 49 / R$ 97)**
   - `featureList` tem 7 features (ok)

2. **FAQPage** (layout.tsx:135-143):
   - Puxa de `LANDING_FAQ` (`lib/landing-faq.ts`) — **9 perguntas diferentes das da `FAQSection` renderizada**
   - Rich result do Google vai mostrar perguntas/respostas que não aparecem na página — **penalidade SEO** ou no mínimo confusão

### robots.ts
```
user-agent: *
allow: /
disallow: /app/ · /api/
sitemap: https://viral.kaleidos.com.br/sitemap.xml
```

### sitemap.ts
URLs listadas:
- `/` (weekly, priority 1)
- `/blog` (weekly, 0.8)
- `/privacy` (yearly, 0.3)
- `/terms` (yearly, 0.3)
- `/roadmap` (monthly, 0.5)
- `/blog/[slug]` × N (monthly, 0.7) — puxa de `POSTS_META`

**Faltam:** `/account/data-deletion` (obrigação Meta, deveria estar listado com `disallow` no robots? Ou indexável mas priority 0.1).

### Hreflang
Só `/blog` declara `languages: { "pt-BR": ... }`. Home **não** declara hreflang — se único locale é pt-BR, ok, mas faltou declaração explícita.

---

## 6. Performance red flags (análise estática)

### Imagens
- **P0** — **3.0 MB de PNGs decorativos no hero**. Nenhum usa `next/image`. Alguns (hero-brain 1.2 MB, hero-mouth 850 KB) deveriam ser WebP/AVIF responsive.
- **P0** — `hero-mouth.png` com `fetchPriority="high"` é 850 KB — esse sozinho domina o LCP da rota.
- **P0** — 4 PNGs órfãos em `/brand/landing/` (hero.png 1.2 MB, process-spot.png 995 KB, manifest-cutout.png 470 KB, sv-logo.png 90 KB) nunca referenciados — totais ~2.7 MB de arquivo morto.
- **P1** — Logo SV-full (202 KB) em nav **e** footer — mesma imagem sempre carregada duas vezes em 2 tamanhos diferentes. Renderiza 2 `<img>` tags.

### Fontes
- **P1** — 3 fontes locais TTF/OTF (Atelier, Gridlite, Inter) + 3 Google Fonts (Jakarta, Instrument Serif, JetBrains Mono). **6 famílias no total** — duplicidade (SVInter vs Jakarta, Gridlite vs JetBrains, Atelier vs Instrument Serif).
- **P1** — Nenhuma fonte tem `<link rel="preload">`. Todas têm `font-display: swap` — causa FOUT.
- **P1** — `Atelier.ttf` é o hero H1 principal; sem preload o hero faz swap visível pro Instrument Serif fallback (mudança de tamanho de letra).

### JavaScript
- **P1** — Todos os 13 componentes da landing são `"use client"`. Framer-motion bundle sai inteiro para cliente. Muito disso poderia ser RSC + CSS transitions.
- **P1** — `framer-motion` importado em 11 componentes, carrega ~50KB gzip só pra reveal on scroll (que CSS `@starting-style` faz nativo agora).
- **P2** — `Menu, X` do `lucide-react` importado em `top-nav.tsx` — tree-shaking geralmente ok, mas adiciona ~2-3KB por ícone.

### Scripts third-party
- `@vercel/analytics` — ~8KB
- `@vercel/speed-insights` — ~10KB
- `@next/third-parties/google` GA — ~30KB (só se `NEXT_PUBLIC_GA_MEASUREMENT_ID` setado)
- PostHog em `LpVariantTracker` nas variantes `/landing/v2` (não no `/`)
- `instrumentation-client.ts` também inicializa algo (não verificado)
- Script inline pre-head `try{if(localStorage.getItem("sequencia-viral_theme")==="dark")...}` — FOUC prevention mas bloqueia render ~2ms.

### Hidrations desnecessárias
- **P1** — `TopNav` precisa de client (menu mobile, auth state) — ok.
- **P1** — `Hero` seria server-render-friendly se typewriter mockup virasse imagem/animação CSS ou se extraísse só o typewriter pra client island.
- **P2** — `CompareSection`, `PricingSection`, `FAQSection` são client só pra `motion.tr` stagger e `useState` do toggle — tudo isso cabe em CSS `@starting-style` + forms não controlados.

---

## 7. Accessibility audit

### Contraste
Paleta geralmente segura:
- `--sv-ink` #0A0A0A vs `--sv-paper` #F7F5EF → contrast ratio ~18:1 ✓
- `--sv-ink` vs `--sv-green` #7CF067 → ~11:1 ✓
- `--sv-muted` #6B6960 vs `--sv-paper` #F7F5EF → ~4.5:1 ✓ (no limite AA para 14px body)
- Texto branco (`--sv-paper`) sobre `--sv-pink` #D262B2 → ~3.9:1 ✗ falha AA pra body

### Alt text
- ✓ Todas imagens decorativas do hero com `alt=""` + `aria-hidden` (correto).
- ✓ Logo em nav/footer com alt "Sequência Viral".
- ✗ Imagens de `HowItWorks` (orelha/typewriter/megafone) com `alt=""` — elas **têm significado** (ilustram cada passo), deveriam ter alt descritivo.

### Heading hierarchy
- H1 único (em Hero) ✓
- H2 por section (SectionHead em pain, how, features, compare, pricing, testimonials, faq + h2 em final-cta + h2 no welcome popup) — ok exceto popup (dentro de dialog é aceitável)
- H3 dentro de cards (pain cards, how-it-works, features) — ok
- H4 só no footer (column titles) ✓

### Landmarks semânticos
- `<main>` na home ✓
- `<nav>` em TopNav ✓
- `<header>` no Hero ✓
- `<footer>` ✓
- `<section>` em cada bloco com id âncora ✓

### Focus states
- CSS global `button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` ✓
- `.sv-btn` não tem focus-state custom — herda do global ✓

### Buttons vs links
- ✓ FAQ accordion é `<button type="button">` (correto)
- ✓ CTAs que mudam página são `<Link>` (correto)
- ✗ IntervalToggle `<button>` em `pricing-section.tsx:216` não tem `aria-pressed`

### Reduced motion
- **P1** — `@media (prefers-reduced-motion: reduce)` **não existe** em `globals.css`. Animações `sv-float`, `sv-spin-slow`, `sv-marquee-x`, typewriter setInterval — tudo ignora preferência do sistema.

### Outros
- **P1** — Welcome popup não tem focus trap explícito. Tab pode escapar do dialog.
- **P1** — Botão hamburger do mobile não tem `aria-expanded`.
- **P2** — Avatares de testimonials com inicial como texto funcionam, mas não têm `role="img"` + `aria-label="Avatar da Ana Escala"`.

---

## 8. Conversão & CRO

### CTAs visíveis
1. **Hero** — "Criar primeiro grátis" (primário, único)
2. **Nav** — "Criar grátis →" permanente sticky (duplica hero)
3. **Pricing** — 3 CTAs (Grátis / Creator / Pro)
4. **Final CTA** — "Criar carrossel grátis →" + "Ver roadmap"
5. **Welcome popup** — "Resgatar 30% →"
6. **Footer** — "Criar carrossel" na coluna Produto

**Total:** 8-9 CTAs (sem contar Entrar secundário). Todos apontam pra `/app/login` ou `/app/checkout`. Fluxo linear e claro.

### Above the fold
Hero tem eyebrow + H1 + subtitle + 1 CTA + 3 trust pills. **Sim**, CTA "Criar primeiro grátis" é visível sem scroll (em viewport 1440×900).

### Social proof
- **Ticker** com 4 números → hardcoded ("2.143 carrosséis") e sem explicação.
- **Testimonials** com 3 cards → rotulados como "exemplos ilustrativos".
- **Zero logos de clientes / parceiros / veículos.**
- **Zero case study concreto.**
- **Nenhum video demo.**

Avaliação: praticamente sem social proof crível.

### Urgência/escassez
- **WelcomePopup** promete "30% off por tempo limitado" **sem timer ou data** — urgência falsa.
- **Pricing** tag "Preço de lançamento" — mesma lógica, sem timer.
- Sem notificações "X pessoas se cadastraram nas últimas 24h" (que seria honesto se real).

### Pricing visível na home
- Sim, secção PricingSection entre FAQ e CompareSection — posição razoável (após 7 seções).
- Ausência de calculator ROI / comparação de economia (tempo × dinheiro).

### FAQ
- 9 perguntas tocam em: estilo da IA, alucinação, uso comercial, imagem, voz, YouTube, editor, cancelamento, sobre quem faz.
- **Falta**: "Meus dados ficam salvos?", "Funciona offline?", "API disponível?", "Quantos minutos transcreve no Free?", "Serve pra agência?" (embora aparece meio implícito no 08).

### Footer
Todos links essenciais presentes (privacy, terms, contato WhatsApp) — exceto `/account/data-deletion` (requerido pela Meta App Review).

### Falta na landing
- Sem vídeo demo (hero mockup é CSS).
- Sem GIF/loop de produto real.
- Sem seção "Antes e depois" com exemplos de carrosséis gerados.
- Sem logos de imprensa / mídia.
- Sem case de criador que saiu de X pra Y (ROI concreto).
- Sem breadcrumb / jornada clara "se não estiver pronto, faça isso".

---

## 9. Variantes em app/landing/*

| Rota | Status | O que testa | Linhas | Recomendação |
|---|---|---|---|---|
| `/landing` | Ativa (índice) | Lista das variantes pra comparação interna | 38 | **Mover pra rota privada** (ou `/admin/landings`). Se publicada, expõe A/B interno. |
| `/landing/chatsheet` | Ativa | Re-export da home (alias pra preview/gravação) | 7 | Manter, útil pra A/B test URL sem canonical mudar. |
| `/landing/v2` | **Ativa em A/B** | Angle "velocidade" — hero "3h no Canva · 15s aqui" — integra `LpVariantTracker` | 537 | Manter (é teste ativo com PostHog tracking). |
| `/landing/v3` | Redirect 301 → `/` | Descontinuada | 6 | Remover e adicionar redirect em `next.config.ts`. |
| `/landing/v4` | Redirect 301 → `/` | Descontinuada | 6 | Idem. |
| `/landing/v5` | Redirect 301 → `/` | Descontinuada | 6 | Idem. |
| `/landing/v5-neobrutal` | Redirect 301 → `/` | Descontinuada | 6 | Idem. |

Índice `/landing/page.tsx` lista 6 variantes mas **quatro delas** (v3/v4/v5/v5-neobrutal) redirecionam imediatamente pra `/` — user clica na "Nexus (dark)", volta na home. Índice perde função real, menos como lembrete interno.

---

## 10. Páginas linkadas

### `/blog` (681 linhas, `app/blog/page.tsx`)
- **Status:** existe, server component, usa `POSTS_META` (`lib/blog-posts-meta.ts` — 210 linhas).
- **Conteúdo:** blog editorial completo com metadata, JSON-LD, capa tipográfica (`CoverBlock`), categorias.
- **Issues:** Falta verificar se `POSTS_META` tem posts reais (`bun dev` pra checar). O sitemap puxa diretamente esse meta — se tiver apenas placeholder, sitemap polui com URLs vazias.

### `/privacy` (198 linhas, `app/privacy/page.tsx`)
- **Status:** completa, server, usa classes Tailwind + `editorial-serif`.
- **Conteúdo:** 10+ sections (quem somos, dados, uso, compartilhamento, retenção, direitos, cookies, menores, alterações, contato).
- **Metadata:** ok.
- **Issues:** usa classes Tailwind antigas (`bg-[#FAFAF8]`, `text-[#0A0A0A]`, `editorial-serif`) — não usa tokens `--sv-*` da landing. **Design visual desalinhado** do resto da landing.

### `/terms` (38 linhas)
- **Status:** esqueleto mínimo — 1 parágrafo + 3 bullets.
- **Issues:** P0 — **conteúdo placeholder**. Texto genérico de 3 linhas, sem cláusulas reais (IP, suspensão, jurisdição, etc).

### `/roadmap` (196 linhas)
- **Status:** completa, server component, delega pra `RoadmapBoardBrutalist` + `RoadmapLegend`.
- **Issues:** Nav back "Voltar pra Sequência Viral" em topo, ok. Página reusa componentes brutalist da identidade principal.

### `/account/data-deletion` (40+ linhas)
- **Status:** completa, trata callback Meta App Review com `?code=`.
- **Issues:** Não linkada em lugar nenhum (footer deveria linkar). Quando user faz delete no Facebook Settings, volta pra essa rota — exibe status ok.

---

## 11. Top 15 issues priorizados

| # | Seção | Issue | Severidade | Fix sugerido |
|---|---|---|---|---|
| 1 | Pricing + Compare + JSON-LD | **3 preços diferentes em 3 lugares** (CompareSection $9.90, PricingSection R$ 49, JSON-LD $9.99/$29.99) | P0 | Unificar: UI em R$, JSON-LD em BRL; remover linha de preço da tabela compare ou usar mesmo valor. |
| 2 | FAQ + JSON-LD | `FAQSection` renderiza 9 perguntas; `faqJsonLd` puxa `lib/landing-faq.ts` com outras 9 diferentes | P0 | Mover `DEFAULT_FAQ_ITEMS` de `faq-section.tsx` pra `lib/landing-faq.ts` e consumir dos 2 lados. |
| 3 | Hero | 3 MB de PNG decorativos na primeira dobra (hero-brain 1.2 MB, hero-mouth 850 KB com fetchPriority high) | P0 | Converter tudo pra WebP + `next/image` com sizes + preload só o crítico; cortar hero-brain/mouth em 50% de tamanho. |
| 4 | Ticker | "2.143 carrosséis gerados" é número hardcoded estático | P0 | Ou puxar via API (`generation_logs count`), ou trocar por claim verificável (ex: "Gerados em 48 países", "Suporta YouTube + Blog + IG"). |
| 5 | Testimonials | 3 depoimentos falsos rotulados "ilustrativos" — zero social proof real | P0 | Substituir por 1-3 depoimentos reais (mesmo que apenas do Gabriel + Kaleidos) ou remover a section até ter reais. |
| 6 | CompareSection | Preço SV em USD vs Pricing em BRL + claim "preço pra postar todo dia" conflita com Creator (10/mês) | P0 | Unificar moeda. Ajustar linha pra "Preço pra postar 30×/mês" = R$ 77,60 (Pro anual). |
| 7 | FAQ 08 | Menciona "plano Agência" que não existe nos 3 planos exibidos | P0 | Reescrever pra mencionar Creator/Pro + remover rateio Agência. |
| 8 | Footer | Link "Manifesto" → `#manifesto` quebrado (seção escondida) | P0 | Remover link ou recriar section. |
| 9 | Pricing | CTA Creator → `/app/checkout?plan=pro`; CTA Pro → `?plan=business` (naming URL ≠ UI) | P0 | Renomear slugs pra `plan=creator` e `plan=pro` pra bater com UI + tracking. |
| 10 | FeaturesSection | 461 linhas de código pra 2 cards (props + helpers mortos) | P1 | Enxugar: remover `ExportRow`, props não-usadas, e decidir entre 2 ou 4 cards reais. |
| 11 | HowItWorks | Claim "PDF" como entrada aceita — não suportado no fluxo real | P1 | Remover PDF do bullet OU implementar PDF no `detectSource()`. |
| 12 | Tempo promessa | Hero diz "60s" (badge), FinalCTA diz "30s" — inconsistência | P1 | Padronizar em 60s (conservador) ou 45s. |
| 13 | TopNav | Link "Exemplos" (`#exemplos`) no menu não tem target na home | P1 | Remover link ou criar section "Exemplos" (que seria ótima pro CRO). |
| 14 | OG Image | Identidade laranja antiga, não bate com verde/pink atual | P1 | Regenerar `opengraph-image.tsx` com paleta `--sv-green` + `--sv-pink` + `--sv-paper`. |
| 15 | Terms | Conteúdo placeholder de 3 linhas sem cláusulas formais | P1 | Escrever T&C completo (jurisdição, IP, cancelamento, responsabilidade). |

---

## 12. Quick wins (<5 min cada)

1. **Remover linha "Preço pra postar todo dia" da CompareSection** — resolve P0 conflito de preço em 30 segundos.
2. **Corrigir FAQ 08**: trocar "No plano Agência, rateio proporcional" por "Se cancelar no plano Pro, rateio proporcional pros dias usados."
3. **Remover link "Manifesto" do footer** (coluna Kaleidos) ou apontar pra `https://kaleidos.com.br/manifesto`.
4. **Remover link "Exemplos" da TopNav** (`NAV_ITEMS` em `top-nav.tsx:12`) — 1 linha deletada.
5. **Adicionar alt descritivos nas 3 imagens do HowItWorks** (`alt="Ouvindo"`, `alt="Pensando"`, `alt="Anunciando"`).
6. **Unificar tempo em "~60 segundos"**: trocar `em 30 segundos.` do FinalCTA por `em 60 segundos.` (1 linha).
7. **Adicionar link `/account/data-deletion`** no Footer coluna Legal (obrigação Meta).
8. **Trocar keyword da meta** `"sequencia-viral"` por `"sequencia viral"` (sem hífen, melhor match de busca).
9. **Adicionar `aria-expanded`** no botão hamburger do TopNav (3 linhas).
10. **Atualizar JSON-LD em layout.tsx:99-123**: preços pra BRL, naming Creator/Pro coerente com UI.

---

## 13. Recomendações estratégicas

### R1. Substituir os 3 depoimentos fake por prova visual real
Nenhum creator cético confia em "Ana Escala @ana.escala". Melhor opção pra short-term: 1 depoimento longo do Gabriel (founder) + 2 screenshots de carrosséis reais gerados pelo produto em nichos diferentes (ex: um de finanças, um de cripto) com nome do criador e métrica ("12k views orgânicos"). Se ainda não tem cliente real, publicar sobre o processo em 1 post no Twitter e capturar reply positivo = proof.

### R2. Adicionar seção "Exemplos reais" entre HowItWorks e FeaturesSection
Hoje a landing promete mas não mostra. User não vê **nenhum** carrossel gerado de verdade — só mockups CSS. Uma galeria com 6-9 carrosséis reais (3 nichos, 3 estilos) quebra mais objeção do que qualquer copy. Link único da home também tem perfil (`GallerySection` importada e comentada em `app/page.tsx:15` — **já existe o componente**, só falta reativar + popular).

### R3. Reduzir peso do hero em 80%
Atual: 3.0 MB de PNG. Alvo: 600 KB. Caminho:
- Converter hero-brain, hero-mouth, hero-hand pra WebP com sizes responsivos
- Remover hero-mandala (opacity 0.12, praticamente invisível) OU reduzir pra 40 KB
- Usar `next/image` com `priority` só no hero-mouth
- Mover 3 imagens decorativas secundárias pra `loading="lazy"` com `sizes="(max-width: 860px) 0px, 28vw"`

### R4. Consolidar FAQ numa fonte única + ampliar
Hoje FAQ tem 2 arquivos (`faq-section.tsx` + `lib/landing-faq.ts`) com conteúdos diferentes. Problema SEO imediato. Além de consolidar, ampliar pra 12-15 perguntas cobrindo objeções que faltam (dados, API, volumes Free, suporte, rate limit, linguagens).

### R5. Rebuild do pricing com clareza radical
O combo atual (3 preços discordantes + naming URL inconsistente + tag "lançamento" sem data + "em breve" dentro de plano pago) mina credibilidade. Proposta: reescrever pricing com uma única fonte (`lib/pricing.ts` exporta valores + slugs), remover feature "em breve" do Pro (ou move pra nota de rodapé honesta), e colocar tabela comparativa side-by-side em vez de 3 cards independentes. Isso resolve issues 1, 6, 9 de uma vez.

---

*Arquivo gerado em 2026-04-22. Próximo passo: escolher 3-5 fixes do Top 15 + 1 recomendação estratégica pra executar no próximo ciclo de polimento. Não modifique nada da landing enquanto este documento não for revisado.*
