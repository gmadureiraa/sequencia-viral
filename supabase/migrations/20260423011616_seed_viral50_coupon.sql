-- ──────────────────────────────────────────────────────────────────
-- SEED: cupom VIRAL50 — Last Chance Coupon
-- Associado ao cron `/api/cron/last-chance-coupon`, disparado quando
-- user free esgota os 5 carrosséis após 7+ dias.
--
-- Regras:
--   - 50% off primeiro mês
--   - Limitado aos primeiros 50 usuários (max_uses = 50)
--   - Sem expires_at (controle vem via cron + max_uses)
--   - Escopo: apenas plano `pro` (Creator)
--   - Idempotente via ON CONFLICT
-- ──────────────────────────────────────────────────────────────────

insert into public.coupons
  (code, discount_pct, discount_amount_cents, currency, max_uses, used_count, expires_at, active, plan_scope, notes)
values
  (
    'VIRAL50',
    50,
    null,
    'BRL',
    50,
    0,
    null,
    true,
    array['pro']::text[],
    'Last Chance Coupon — 50% off primeiro mês Creator. Disparado via /api/cron/last-chance-coupon quando user free esgota limite + D+7.'
  )
on conflict (code) do nothing;
