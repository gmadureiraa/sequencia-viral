-- 20260508140000_referrals_carousels_bonus.sql
-- Reescreve mecânica do programa Indique-e-Ganhe.
--
-- ANTES (deprecated): referrer ganhava R$ 25 (== preço de 1 mês Pro) em
-- customer.balance Stripe que abatia automaticamente na próxima fatura.
-- Cupom genérico AMIGOPRO30 (sem rastreio do referrer — buraco de metadata).
--
-- AGORA: referrer ganha **+10 carrosséis** no `usage_limit` do mês corrente.
-- Cupom dinâmico Stripe POR REFERRER (`MAD-X8K2-...`) com metadata
-- `referrer_user_id` pra garantir rastreio mesmo se localStorage não tiver
-- código no checkout. AMIGOPRO30 vira deprecated.
--
-- Idempotente — todas as alterações usam IF NOT EXISTS / DROP IF EXISTS.

-- ============================================================
-- REFERRAL_CREDITS — log auditável de carrosséis bônus creditados
-- ============================================================
create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid references auth.users(id) on delete cascade not null,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  type text not null default 'carousels_bonus'
    check (type in ('carousels_bonus')),
  amount int not null check (amount > 0),
  stripe_subscription_id text,
  stripe_session_id text,
  created_at timestamptz default now()
);

create index if not exists idx_referral_credits_referrer
  on public.referral_credits(referrer_user_id);

create index if not exists idx_referral_credits_referred
  on public.referral_credits(referred_user_id);

-- Idempotency hard guard: cada (referred_user, subscription, type) só pode
-- creditar UMA vez. Se webhook chegar duplicado, INSERT estoura unique
-- violation e a function retorna sem incrementar usage_limit.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'referral_credits_idempotency_unique'
  ) then
    create unique index referral_credits_idempotency_unique
      on public.referral_credits (referred_user_id, coalesce(stripe_subscription_id, ''), type);
  end if;
end$$;

alter table public.referral_credits enable row level security;

drop policy if exists "users see own credits" on public.referral_credits;
create policy "users see own credits"
  on public.referral_credits for select
  using (auth.uid() = referrer_user_id);

-- ============================================================
-- RPC: grant_referral_carousels_bonus
-- Atomic — incrementa profiles.usage_limit do referrer + insere log
-- na referral_credits NA MESMA TRANSAÇÃO. Race-safe contra webhooks
-- concorrentes (2 amigos pagam ao mesmo tempo).
--
-- Retorna { ok, applied, reason }. `applied=true` se de fato creditou,
-- `applied=false` + reason='already_credited' se já estava creditado
-- (idempotência via unique key).
-- ============================================================
create or replace function public.grant_referral_carousels_bonus(
  p_referrer_user_id uuid,
  p_referred_user_id uuid,
  p_amount int,
  p_referral_id uuid default null,
  p_stripe_subscription_id text default null,
  p_stripe_session_id text default null
)
returns table(ok boolean, applied boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted public.referral_credits%rowtype;
begin
  -- Insert do log com unique constraint. Se já existe pra esse
  -- (referred, subscription, type), unique violation ⇒ idempotente.
  begin
    insert into public.referral_credits (
      referrer_user_id,
      referred_user_id,
      referral_id,
      type,
      amount,
      stripe_subscription_id,
      stripe_session_id
    ) values (
      p_referrer_user_id,
      p_referred_user_id,
      p_referral_id,
      'carousels_bonus',
      p_amount,
      p_stripe_subscription_id,
      p_stripe_session_id
    )
    returning * into v_inserted;
  exception when unique_violation then
    return query select true, false, 'already_credited'::text;
    return;
  end;

  -- Incrementa usage_limit atomicamente. UPDATE single-row é atomic em
  -- Postgres, sem race vs outros UPDATE concorrentes.
  update public.profiles
     set usage_limit = coalesce(usage_limit, 0) + p_amount,
         updated_at = now()
   where id = p_referrer_user_id;

  return query select true, true, 'credited'::text;
end;
$$;

grant execute on function public.grant_referral_carousels_bonus(
  uuid, uuid, int, uuid, text, text
) to service_role;

-- ============================================================
-- DEPRECATED: AMIGOPRO30
-- Desativa o cupom genérico — agora cada referrer tem cupom dinâmico
-- único (MAD-X8K2-...) criado on-demand no checkout. Mantém a row
-- pra preservar histórico de redemptions.
-- ============================================================
update public.coupons
   set active = false,
       notes = coalesce(notes, '') || ' [deprecated 2026-05-08: substituído por cupom dinâmico por referrer]'
 where lower(code) = 'amigopro30'
   and active = true;
