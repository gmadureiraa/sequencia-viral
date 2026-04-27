# Auditoria Completa - Sequencia Viral

Data: 2026-04-27  
Escopo: auditoria tecnica e de produto end-to-end do projeto `sequencia-viral`, com revisao por frentes (arquitetura, backend, frontend, seguranca, dados, operacao, qualidade, performance, DX e documentacao).

---

## 1) Resumo executivo

O projeto esta estavel em runtime, com build e testes passando, mas com um gap relevante de qualidade estatica (lint) e com debito tecnico concentrado em UI client-side (hooks), paginas administrativas e acervo legado que ainda entra no fluxo de validacao.

Status atual:

- Build de producao: OK
- Testes automatizados: OK (30/30)
- Lint: FALHANDO (199 problemas, sendo 83 erros e 116 warnings)
- APIs: malha robusta (46 rotas), com separacao de dominios e area admin protegida
- Risco principal de curto prazo: lint quebrado reduz confianca de evolucao e mascara regressao real

Classificacao geral: **Amarelo**

- Operacao: Verde
- Qualidade de codigo: Amarelo/Vermelho
- Seguranca: Amarelo
- Performance: Amarelo
- Produto/UX: Amarelo

---

## 2) Metodologia e evidencias

Checks executados:

- `npm run build` -> sucesso (Next 16.2.3)
- `npm run test` -> sucesso (5 arquivos, 30 testes)
- `npm run lint` -> falha com 199 problemas

Leituras de referencia:

- `README.md`
- `AUDIT.md` (observado como parcialmente desatualizado)
- `docs/technical/ARCHITECTURE.md`
- amostragem de arquivos criticos em `app/`, `components/`, `lib/`

Inventario estrutural:

- 46 rotas de API (`app/api/**/route.ts`)
- 8 rotas administrativas (`/api/admin/*`)
- 7 rotas de cron (`/api/cron/*`)
- 21 paginas em `app/app/*`
- 16 componentes de landing em `components/landing/*`

---

## 3) Saude da aplicacao e runtime

Pontos positivos:

- Build de producao compila sem erro.
- Suite de testes atual passa integralmente.
- Estrutura App Router consolidada.
- Projeto sobe com stack moderna (Next 16, React 19, TS, Supabase, Stripe, Gemini).

Pontos de atencao:

- Build trouxe aviso de edge runtime desabilitando SSG em pelo menos uma rota.
- `AUDIT.md` antigo nao representa mais 100% do estado atual (ex: aponta falta de `not-found.tsx`, mas o arquivo existe).

Conclusao da frente:

- Runtime e deploy estao bons; fonte de risco nao esta na execucao imediata, e sim na sustentacao e governanca de codigo.

---

## 4) Qualidade de codigo (lint, padrao, manutencao)

Diagnostico:

- `npm run lint` retorna 199 problemas (83 erros, 116 warnings).
- Parte significativa vem de `_archive/landing-packages/*` (codigo legado nao produtivo) sendo lintado junto.
- Ainda existem erros reais em codigo ativo.

Padroes de erro mais criticos no codigo ativo:

1. `react-hooks/set-state-in-effect` em componentes/paginas relevantes:
   - `components/landing/hero.tsx`
   - `components/landing/features-section.tsx`
   - `components/landing/welcome-popup.tsx`
   - `lib/use-landing-session.ts`
   - `app/app/create/[id]/preview/page.tsx`
   - `app/app/onboarding/page.tsx`
   - `app/app/layout.tsx`

2. `react/no-unescaped-entities` concentrado em:
   - `app/app/admin/regras/page.tsx`
   - `app/app/settings/page.tsx`

3. Ruido de manutencao:
   - muitos `unused vars`
   - `eslint-disable` sem efeito
   - mistura de warnings de areas ativas e legado

Impacto:

- Queda de signal/noise no lint.
- Maior custo de review e de onboarding de dev.
- Regressao real pode passar despercebida em meio a centenas de alertas.

Conclusao da frente:

- Esta e a principal frente de debito atual.

---

## 5) Frontend e UX

Pontos positivos:

- Landing e app shell bem segmentados.
- Componentizacao consistente (`components/app`, `components/landing`, `components/ui`).
- Fluxo de onboarding e criacao com escopo amplo e varios estados de uso.

Pontos de atencao:

- Varios efeitos com `setState` sincrono podem gerar rerender cascata e comportamento dificil de depurar.
- Uso recorrente de `<img>` em vez de `next/image` em partes da landing/admin.
- Alto numero de warnings de higiene em paginas de admin e create/edit/preview.

Risco UX:

- Em cenarios de interacao longa, esses efeitos podem causar flicker, estados intermediarios inconsistentes e manutencao mais cara.

Conclusao da frente:

- Produto visualmente rico, mas precisa estabilizar a base reativa em hooks para ganhar previsibilidade.

---

## 6) Backend e APIs

Pontos positivos:

- Malha de API robusta (46 rotas), com separacao por dominios (generate, images, stripe, admin, cron, auth, feedback).
- Area administrativa usa `requireAdmin` de forma consistente nas rotas auditadas.
- Fluxos sensiveis (Stripe webhook) possuem protecoes de assinatura com excecao restrita a nao-producao.

Pontos de atencao:

- Muitas rotas com `console.warn`/`console.log` para eventos de erro e fallback; operacionalmente util, mas pede padronizacao de observabilidade.
- Varios caminhos de fallback podem dificultar diagnostico sem telemetria estruturada.

Conclusao da frente:

- Backend esta funcional e com boa cobertura de casos de negocio; proximo nivel e observabilidade estruturada e reducao de complexidade de fallback.

---

## 7) Seguranca

Pontos positivos:

- Arquivos `.env*` nao estao versionados.
- Webhook Stripe com validacao de assinatura em producao.
- Rotas admin protegidas.
- CORS e headers de seguranca parecem tratados no projeto.

Pontos de atencao:

- Dependencia de disciplina operacional para garantir que bypass de webhook (`ALLOW_UNVERIFIED_STRIPE_WEBHOOK`) nunca vaze para ambiente errado.
- Necessidade de revisar rotas com muitos fallbacks para garantir que nunca exponham detalhes sensiveis em logs.

Conclusao da frente:

- Seguranca em nivel bom para operacao atual, com recomendacao de hardening continuo e checklist de release.

---

## 8) Dados, autenticacao e pagamentos

Pontos positivos:

- Stack de auth e dados coerente com Supabase.
- Fluxos de checkout/portal/webhook integrados com Stripe.
- Logica de sessao e uso de perfil distribuida entre camadas de app e server.

Pontos de atencao:

- Necessario manter alinhamento estrito entre envs, mapeamento de plano e regras de sincronizacao de assinatura.
- Ponto tecnico observado: hooks client-side de sessao com padrao que hoje conflita com lint (set-state-in-effect), pedindo refino arquitetural.

Conclusao da frente:

- Fundacao de dados/pagamentos esta boa, mas com melhoria pendente na ergonomia de estado no cliente.

---

## 9) Testes e cobertura

Estado:

- 30 testes passando (5 suites).
- Cobertura presente em templates, geracao, rate limit, extracao de URL e planos Stripe.

Gap:

- Baixa visibilidade de testes para comportamento de UI complexa (hooks, efeitos, fluxos de preview/onboarding).
- Nao ha sinal de testes E2E aqui neste recorte.

Conclusao da frente:

- Testes atuais cobrem nucleos importantes de regra, mas ainda nao blindam bem os fluxos de interface mais sujeitos a regressao.

---

## 10) Documentacao e governanca tecnica

Pontos positivos:

- `README.md` e `docs/technical/ARCHITECTURE.md` estao robustos.
- Projeto tem historico de auditoria e planejamento documentado.

Pontos de atencao:

- `AUDIT.md` principal esta parcialmente desatualizado frente ao estado atual.
- Falta uma politica clara de "arquivo morto" para remover ruido de lint do codigo legado.

Conclusao da frente:

- Boa maturidade documental, com necessidade de sincronizacao e consolidacao de fonte de verdade.

---

## 11) Principais achados priorizados

### Criticos (P1)

1. Lint quebrado com alto volume de erro (83 erros).
2. Regras de hooks quebrando em arquivos ativos centrais.
3. Codigo legado `_archive` contaminando qualidade do projeto principal.

### Importantes (P2)

4. Paginas admin/settings com muitas entidades nao escapadas em JSX.
5. Excesso de warnings de higiene (unused vars, disables obsoletos).
6. Observabilidade muito baseada em logs manuais em rotas complexas.

### Melhorias (P3)

7. Conversao progressiva de `<img>` para `next/image` onde fizer sentido.
8. Reforco de testes para fluxos client-side (preview/onboarding).
9. Atualizacao e consolidacao do `AUDIT.md` legado.

---

## 12) Plano de acao recomendado

### Fase 1 - Estabilizacao de qualidade (1-2 dias)

- Ajustar `eslint.config.mjs` para excluir `_archive/**` do lint principal.
- Zerar erros em codigo ativo (foco em `set-state-in-effect` e `no-unescaped-entities`).
- Manter warnings para uma fase seguinte, sem bloquear entrega.

Meta de saida:

- `npm run lint` verde no escopo ativo.
- baseline limpa para novas PRs.

### Fase 2 - Hardening de frontend (2-4 dias)

- Refatorar efeitos com setState em `hero`, `features-section`, `welcome-popup`, `use-landing-session`, `preview`, `onboarding`.
- Revisar estados derivados para reduzir re-render cascata.
- Adicionar testes de comportamento para os fluxos mais sensiveis.

Meta de saida:

- previsibilidade de UI e menor risco de regressao silenciosa.

### Fase 3 - Operacao e observabilidade (2-3 dias)

- Padronizar logging estruturado por rota critica.
- Definir niveis (info/warn/error) e campos fixos (userId, route, provider, latency, fallbackUsed).
- Revisar alarmes para eventos de custo e falha de provider.

Meta de saida:

- troubleshooting rapido e confiavel em producao.

### Fase 4 - Performance e polimento (iterativo)

- Priorizar `next/image` em telas com maior impacto.
- Limpar warnings residuais de higiene.
- Revisar assets e carga de frontend de forma incremental.

---

## 13) Conclusao final

O Sequencia Viral esta operacionalmente forte e pronto para evolucao de produto, mas a camada de qualidade estatica e higiene de codigo precisa de um ciclo curto de saneamento para evitar acumulacao de risco tecnico.

Com um sprint objetivo de estabilizacao (lint + hooks + ruido de legado), o projeto volta para um estado de alta confianca para entrega continua.

