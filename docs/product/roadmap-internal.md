# Roadmap interno (eng + produto)

_Atualizado 2026-04-22_

> **Nota (2026-04-22):** O onboarding legado `/app/onboarding-v1` foi removido do repo. O fluxo atual com 9 passos (`about → connect → analyze → dna → photo → visual → ideas → generating → done`) vive em [`app/app/onboarding/page.tsx`](../../app/app/onboarding/page.tsx) e é o único em produção. Rotas mortas (`onboarding-v2`, `create-v2`, `generate-v2`) também foram removidas junto com componentes de landing não renderizados (gallery/manifesto). Packages `brillance-landing`, `nexus-landing`, `optimus-landing` foram movidos para `_archive/landing-packages/` como referência visual.

Itens operacionais que não precisam aparecer no roadmap público, mas guiam prioridade.

## Curto prazo

- Consolidar fluxo de **login / conta** (e-mail, recuperação, sessão persistente).
- Revisar **limites de uso** (`usage_count` vs itens na biblioteca) na UI e nos webhooks.

## Médio prazo

- **Scraper de perfil (`/api/profile-scraper`)**  
  - *Hoje:* permitido **sem login** no onboarding (rate limit por IP), para reduzir fricção no MVP.  
  - *Futuro:* **exigir autenticação** (Bearer) e desativar o modo público, assim que login e políticas de abuso estiverem maduros.  
  - Ação: voltar `requireAuthenticatedUser` na rota + ajustar onboarding para só puxar @ após sessão.

## Métricas & analytics

- Integrar **métricas reais de posts** (APIs das redes ou parceiro) no dashboard — ver card “Métricas de publicação” no app e seção correspondente em `/roadmap`.
- Persistir eventos mínimos (geração, export, publicação) para embasar o primeiro painel.

## Referência pública

- Roadmap de produto (usuário): [`/roadmap`](../../app/roadmap/page.tsx) no site.
