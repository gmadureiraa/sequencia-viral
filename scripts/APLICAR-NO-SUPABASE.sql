-- ============================================================
-- SEQUÊNCIA VIRAL — Migrações pendentes
-- Rodar no SQL Editor do Supabase (projeto lyjvzpfjeeyaeviwqvls)
-- https://supabase.com/dashboard/project/lyjvzpfjeeyaeviwqvls/sql/new
--
-- Essas migrações estão em supabase/migrations/ no repo, mas nunca
-- foram aplicadas na prod. Sem elas:
--   1) Lista de carrosséis quebra (coluna export_assets não existe)
--   2) Exportação para nuvem (PNG/PDF) não salva metadados
-- ============================================================

-- --- 20260415120000_carousel_export_assets ---

alter table public.carousels
  add column if not exists export_assets jsonb default '{}'::jsonb;

comment on column public.carousels.export_assets is
  'Metadados de export: { pngUrls: string[], pdfUrl?: string, exportedAt: string, slideCount: number }';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carousel-exports',
  'carousel-exports',
  true,
  52428800,
  array['image/png', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read carousel exports" on storage.objects;
create policy "Public read carousel exports"
  on storage.objects for select
  using (bucket_id = 'carousel-exports');

-- Confirma:
select
  column_name,
  data_type
from information_schema.columns
where table_name = 'carousels' and column_name = 'export_assets';
-- Deve retornar: export_assets | jsonb


-- ============================================================
-- 2026-05-05 — Sistema de referral (R$ 25 credit por indicação convertida)
-- ============================================================
-- Mecânica: convidado entra com 30% off via cupom AMIGOPRO30 (já seedado em
-- public.coupons). Referrer ganha R$ 25 em customer.balance da Stripe quando
-- o convidado paga a primeira fatura. Acumula sem limite.
-- Arquivo original em supabase/migrations/20260505140000_referrals_system.sql
-- Idempotente — pode rodar várias vezes.

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

drop policy if exists "service role insert" on public.referrals;
create policy "service role insert"
  on public.referrals for insert
  with check (false);

-- Confirma:
select count(*) as referrals_table_exists
from information_schema.tables
where table_schema = 'public' and table_name = 'referrals';
-- Deve retornar: 1

select column_name
from information_schema.columns
where table_name = 'profiles'
  and column_name in ('referral_code', 'referral_credits_cents');
-- Deve retornar 2 linhas
