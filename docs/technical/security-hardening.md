# Security Hardening

## Ajustes aplicados

1. `app/api/stripe/webhook/route.ts`
   - verificação de assinatura com `STRIPE_WEBHOOK_SECRET` quando o header `stripe-signature` está presente;
   - fallback **somente** com `ALLOW_UNVERIFIED_STRIPE_WEBHOOK=true` (desenvolvimento local; nunca em produção);
   - uso de `SUPABASE_SERVICE_ROLE_KEY` para escrita administrativa;
   - limites e valores de pagamento derivados de `lib/stripe.ts` (fonte única com checkout).

2. `app/api/stripe/checkout/route.ts`
   - autenticação obrigatória por token Bearer;
   - `userId` resolvido no backend (não no payload do cliente);
   - rate limit de tentativas de checkout.

3. `app/api/generate/route.ts`
   - em `NODE_ENV=production`, ausência de `ANTHROPIC_API_KEY` retorna 503 (sem resposta mock que mascare falha);
   - **autenticação obrigatória** (`requireAuthenticatedUser`): o cliente envia `Authorization: Bearer` (ver `lib/api-auth-headers.ts`).
4. `app/api/profile-scraper/route.ts`
   - **público** para onboarding com @ (sem login): rate limit menor por IP (12/hora). Com Bearer, limite maior por usuário (40/hora).
5. `app/api/images/route.ts`
   - autenticação obrigatória + rate limit por `userId`.

6. `lib/url-extractor.ts`
   - bloqueio de SSRF para `localhost`, `.local`, faixas IPv4 privadas, loopback IPv6 (`::1`) e prefixos IPv6 locais/ULA (`fe80:`, `fc00:`, `fd00:`).

## Próximos reforços recomendados

- Persistir rate limit em Redis/Upstash (o atual é memória local).
- Criar rotação de chaves e política formal de segredos por ambiente.
