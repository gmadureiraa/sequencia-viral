-- ──────────────────────────────────────────────────────────────────
-- Migration: cores do branding personalizadas por usuário.
-- Array de strings hex (ou CSS colors) que o editor de carrossel usa
-- como "cores de destaque" disponíveis. Vazio por padrão.
-- ──────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists brand_colors jsonb default '[]'::jsonb;
