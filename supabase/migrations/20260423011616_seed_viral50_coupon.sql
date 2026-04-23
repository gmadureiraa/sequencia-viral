-- ──────────────────────────────────────────────────────────────────
-- SEED: cupom VIRAL50 — Last Chance Coupon
-- Associado ao cron `/api/cron/last-chance-coupon`, disparado quando
-- user free esgota os 5 carrosséis após 7+ dias.
--
-- Regras:
--   - 50% off primeiro mês
--   - Limitado aos primeiros 10 assinantes (max_uses = 10)
--   - Copy nunca expõe o número — só "limitado aos primeiros assinantes"
--   - Sem expires_at (controle vem via cron + max_uses)
--   - Escopo: QUALQUER plano pago (plan_scope vazio = sem restrição)
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
    10,
    0,
    null,
    true,
    array[]::text[],
    'Cupom VIRAL50 — 50% off primeiro mês em QUALQUER plano pago (Creator R$ 99,90→49,90 OU Pro R$ 199,90→99,90). Limitado aos primeiros 10 assinantes. Disparado via /api/cron/last-chance-coupon + popup in-app + popup welcome landing.'
  )
on conflict (code) do nothing;
