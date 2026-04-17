# PostFlow — Neo-brutal (shell do app)

Referência visual: sidebar do app autenticado (`app/app/layout.tsx`). Use este documento para manter **landing v4**, protótipos e futuros componentes de marketing alinhados ao produto.

## Princípios

- Alto contraste: preto estrutural + laranja marca + fundo creme.
- Sombras **sólidas deslocadas** (não blur) simulam cartão recortado / estampa.
- Bordas pretas explícitas; poucos degradês (exceto cards de destaque laranja).
- Hierarquia: **serif** em marca e títulos de destaque; **sans** em UI; **mono** em labels secundários.

## Paleta

| Token | Hex | Uso |
|--------|-----|-----|
| `nb-bg` | `#FFFDF9` | Fundo sidebar / superfícies claras |
| `nb-bg-page` | `#FAFAF8` | Fundo página (grain opcional) |
| `nb-ink` | `#0A0A0A` | Texto principal, bordas fortes |
| `nb-accent` | `#EC6000` | CTA, logo mark, item ativo |
| `nb-accent-light` | `#FF8534` | Hover / gradientes curtos |
| `nb-accent-dark` | `#D45500` | Pressed |
| `nb-muted` | `#71717A` | Texto secundário |
| `nb-border-soft` | `rgba(10,10,10,0.1)` | Divisores leves |

Alinhar com `:root` em `app/globals.css` (`--accent`, `--foreground`, etc.).

## Sombras e bordas

- **Offset padrão (controles, logo mark):** `box-shadow: 3px 3px 0 0 #0A0A0A`
- **Offset médio (cards, botões grandes):** `4px 4px 0 0 #0A0A0A` ou `6px 6px 0 0 #0A0A0A`
- **Borda:** `border: 2px solid #0A0A0A` em separadores fortes; `1px solid` + opacidade para listras internas.
- **Raio:** `rounded-xl` (12px) itens de menu; `rounded-2xl` (16px) cards; logo mark `rounded-xl`.

## Tipografia

- **Marca / títulos hero:** `editorial-serif` / `Instrument Serif` (variável `--font-serif`).
- **Navegação e corpo:** `Plus Jakarta Sans` (`--font-sans`).
- **Labels (“MENU PRINCIPAL”, plano):** `font-mono`, `10px`, `uppercase`, `tracking-widest`, cor `muted`.

## Componentes recorrentes

### Logo mark

- Quadrado `h-10 w-10`, `bg-[var(--accent)]`, `border border-[#0A0A0A]`, sombra `3px 3px 0 0 #0A0A0A`.
- Ícone branco (layers / fluxo).

### Wordmark

- `PostFlow` + ponto laranja: `PostFlow<span class="text-[var(--accent)}">.</span>`

### Item de menu ativo

- `bg-[var(--accent)]`, texto branco, `border border-[#0A0A0A]`, sombra `3px 3px 0 0 #0A0A0A`.

### Item de menu inativo

- Texto `ink` com opacidade; hover: fundo branco + borda suave.

### Botão primário (landing)

- Fundo accent, texto branco, borda preta 2px, sombra offset; hover: leve `translate` ou escurecer accent.

### Card CTA laranja (“Plano free / Upgrade”)

- Fundo gradiente accent → accent-light ou classe `card-offset-orange` do projeto.
- Título em serif branco; label mono branca com opacidade; subbotão semi-transparente branco.

### Avatar / inicial

- Círculo com borda preta; fundo accent se sem foto.

## Acessibilidade

- Contraste texto preto sobre creme: OK; branco sobre laranja: verificar tamanho mínimo 14px em CTAs.
- `:focus-visible`: anel 2px offset (ex.: `ring-2 ring-[var(--accent)] ring-offset-2`).

## Referências externas (inspiração)

- [Brillance SaaS (v0)](https://v0.app/templates/brillance-saas-landing-page-zdiN8dHwaaT) — clareza e seções limpas.
- [Optimus (v0)](https://v0.app/templates/optimus-the-ai-platform-to-build-and-ship-LHv4frpA7Us) — hero moderno / confiança técnica.
- [Nexus SaaS AI (v0)](https://v0.app/templates/nexus-saas-ai-platform-C8lIjeSzBZr) — dark / plataforma IA.

---

*Última atualização: alinhado ao shell em `app/app/layout.tsx`.*
