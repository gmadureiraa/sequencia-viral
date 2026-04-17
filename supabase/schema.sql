-- PostFlow Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  twitter_handle text,
  instagram_handle text,
  linkedin_url text,
  niche text[] default '{}',
  tone text default 'professional',
  language text default 'pt-br',
  carousel_style text default 'white',
  plan text default 'free' check (plan in ('free', 'pro', 'business')),
  usage_count int default 0,
  usage_limit int default 5,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CAROUSELS
-- ============================================================
create table if not exists public.carousels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text,
  slides jsonb default '[]',
  style jsonb default '{}',
  source_url text,
  source_text text,
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  thumbnail_url text,
  export_assets jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- GENERATIONS (AI usage tracking)
-- ============================================================
create table if not exists public.generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  carousel_id uuid references public.carousels(id) on delete set null,
  model text not null,
  provider text not null check (provider in ('anthropic', 'google', 'openai')),
  input_tokens int default 0,
  output_tokens int default 0,
  cost_usd numeric(10, 6) default 0,
  prompt_type text,
  created_at timestamptz default now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  amount_usd numeric(10, 2) not null,
  currency text default 'USD',
  method text check (method in ('crypto', 'stripe', 'pix')),
  tx_hash text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  plan text check (plan in ('pro', 'business')),
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_carousels_user_id on public.carousels(user_id);
create index if not exists idx_carousels_created_at on public.carousels(created_at desc);
create index if not exists idx_generations_user_id on public.generations(user_id);
create index if not exists idx_generations_created_at on public.generations(created_at desc);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_profiles_plan on public.profiles(plan);
create index if not exists idx_carousels_user_status on public.carousels(user_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can only read/update their own
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Carousels: users can CRUD their own
alter table public.carousels enable row level security;

create policy "Users can view own carousels"
  on public.carousels for select
  using (auth.uid() = user_id);

create policy "Users can create own carousels"
  on public.carousels for insert
  with check (auth.uid() = user_id);

create policy "Users can update own carousels"
  on public.carousels for update
  using (auth.uid() = user_id);

create policy "Users can delete own carousels"
  on public.carousels for delete
  using (auth.uid() = user_id);

-- Generations: users can view their own
alter table public.generations enable row level security;

create policy "Users can view own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Users can create own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

-- Payments: users can view their own
alter table public.payments enable row level security;

create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can create own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')
  );
  return new;
end;
$$;

-- Drop if exists then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

drop trigger if exists carousels_updated_at on public.carousels;
create trigger carousels_updated_at
  before update on public.carousels
  for each row execute function public.update_updated_at();

-- ============================================================
-- INCREMENT USAGE COUNT (atomic RPC for server-side calls)
-- ============================================================
create or replace function public.increment_usage_count(uid uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
    set usage_count = usage_count + 1,
        updated_at = now()
    where id = uid;
end;
$$;

-- ============================================================
-- MONTHLY USAGE RESET (run via pg_cron or Supabase cron)
-- Schedule: SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', $$SELECT public.reset_monthly_usage()$$);
-- ============================================================
create or replace function public.reset_monthly_usage()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
    set usage_count = 0,
        updated_at = now();
end;
$$;
