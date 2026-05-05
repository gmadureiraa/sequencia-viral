-- 20260505140000_referrals_system.sql
-- Sistema de referral: link único por user, recompensa fixa R$ 25 em
-- credito Stripe quando o referido paga primeira fatura. Cupom Stripe
-- AMIGOPRO30 (criado manualmente no dashboard) entrega 30% off no 1º mês
-- pro referido — controlado pela mecânica de coupon existente, não aqui.
--
-- Idempotente — todas as alterações usam IF NOT EXISTS / DROP IF EXISTS.

-- ============================================================
-- PROFILES — referral_code unico + acumulador de creditos
-- ============================================================
alter table public.profiles
  add column if not exists referral_code text;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'profiles_referral_code_unique'
  ) then
    create unique index profiles_referral_code_unique
      on public.profiles ((lower(referral_code)))
      where referral_code is not null;
  end if;
end$$;

alter table public.profiles
  add column if not exists referral_credits_cents int default 0;

-- ============================================================
-- REFERRALS — historico de cada indicacao
-- ============================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid references auth.users(id) on delete cascade not null,
  referred_email text not null,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'signup', 'converted', 'expired')),
  signup_at timestamptz,
  conversion_at timestamptz,
  stripe_session_id text,
  reward_amount_cents int default 0,
  reward_applied boolean default false,
  reward_applied_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_user_id);
create index if not exists idx_referrals_code on public.referrals(referral_code);
create index if not exists idx_referrals_status on public.referrals(status);
create index if not exists idx_referrals_referred_user on public.referrals(referred_user_id);

alter table public.referrals enable row level security;

drop policy if exists "users see own referrals" on public.referrals;
create policy "users see own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_user_id);

-- Service role sempre tem bypass de RLS, mas explicito a policy de insert
-- pra evitar 401 caso algum dia roteemos via anon (nao deveria, mas).
drop policy if exists "service role insert" on public.referrals;
create policy "service role insert"
  on public.referrals for insert
  with check (false); -- nunca via anon; service role bypassa
