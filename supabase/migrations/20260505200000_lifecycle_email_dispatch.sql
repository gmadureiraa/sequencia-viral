-- ============================================================
-- 2026-05-05 — Tracking de disparos de email lifecycle (Resend events)
-- ============================================================
-- Colunas idempotentes em profiles pra cada cron lifecycle não duplicar
-- envio. Cada cron escreve seu próprio timestamp; lógica de "já enviei?"
-- mora no handler do cron (app/api/cron/<nome>/route.ts).
--
-- - last_idle_5d_email_at         → cron idle-5d (sv.idle_5d)
-- - last_power_user_email_at      → cron power-user (sv.power_user, 1x/mês)
-- - last_referral_reminder_at     → cron referral-reminder (sv.referral.reminder, one-shot)
-- - last_annual_offer_at          → cron annual-offer (sv.annual_offer, one-shot)
--
-- Idempotente — pode rodar várias vezes.

alter table public.profiles
  add column if not exists last_idle_5d_email_at timestamptz,
  add column if not exists last_power_user_email_at timestamptz,
  add column if not exists last_referral_reminder_at timestamptz,
  add column if not exists last_annual_offer_at timestamptz;
