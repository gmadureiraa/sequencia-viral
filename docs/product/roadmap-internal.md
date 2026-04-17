# Roadmap interno (eng + produto)

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
