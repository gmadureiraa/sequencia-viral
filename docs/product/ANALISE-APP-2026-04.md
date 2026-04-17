# Análise do app PostFlow — produto, UX e consistência

**Data:** 2026-04-15  
**Escopo:** área autenticada `/app/*`, fluxo de criação, armazenamento de carrosséis, documentação.

## Resumo executivo

O produto tem um fluxo claro (perfil → criar → editar → export) e uma identidade visual coerente (neo-brutal no shell). Os principais pontos de atrito eram **inconsistência entre perfil e tela de criação** (idioma e tom enviados à API não batiam com `profiles`) e **falta de um guia único** para usuários e time.

Correções aplicadas nesta rodada:

1. **Criar carrossel** — idioma alinhado à API (`pt-br`, `en`, `es`), tom alinhado ao onboarding (`professional`, `casual`, `provocative`, `educational`), sincronização inicial a partir do `profile`, tema claro/escuro herdado do perfil na primeira carga.
2. **UX em “Link”** — bloco explicando extração vs paywall vs uso só como inspiração.
3. **Textos** — placeholders e mensagens de export em português; títulos padrão “Sem título” / “(cópia)”.
4. **Documentação** — `docs/product/guia-carrossel-postflow.md` + rota in-app `/app/help` + item **Guia** no menu + link no dashboard.

## Mapa de rotas relevantes

| Rota | Função |
|------|--------|
| `/app` | Dashboard e atalhos |
| `/app/onboarding` | Primeiro preenchimento de perfil |
| `/app/settings` | Perfil, tom, idioma, estilo de slide, plano |
| `/app/create` | Geração e edição |
| `/app/carousels` | Biblioteca de rascunhos |
| `/app/help` | Guia do carrossel (conteúdo do markdown) |

## Achados de produto (antes)

- **Idioma na criação:** valores como `English` / `Portuguese` não correspondiam ao tratamento da API (`pt-br`, `en`, `es`), gerando risco de mistura de idioma no output.
- **Tom na criação:** opções como “bold” / “inspirational” não espelhavam o modelo de dados do perfil.
- **Perfil ignorado na primeira tela:** usuário completava onboarding e ainda via defaults genéricos na criação até alterar manualmente.
- **Onboarding vs guard:** código ainda mencionava “convidado” em fluxos legados; o guard atual exige login real em `/app` — mensagens antigas podem confundir (mitigação: copy já tende a login; revisar periodicamente).

## Recomendações seguintes (não bloqueantes)

1. **Instrumentação** — eventos `help_viewed`, `generate_started`, `export_completed` por `user_id` e tipo de fonte.
2. **CTA pós-export** — lembrete curto de legenda sugerida ou checklist de publicação.
3. **Tour guiado** — primeiro acesso ao `/app/create` com 3 tooltips (fonte, foco, variações).
4. **Testes e2e** — fluxo feliz: login → create → pick → export (Playwright).

## Referências

- Guia do usuário: [`guia-carrossel-postflow.md`](./guia-carrossel-postflow.md)
- Pesquisa de formato: [`CAROUSEL-RESEARCH.md`](./CAROUSEL-RESEARCH.md)
