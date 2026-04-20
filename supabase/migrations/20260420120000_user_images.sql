-- ============================================================
-- USER_IMAGES — galeria pessoal do usuário
-- ============================================================
-- Toda imagem que o user gerou (via Imagen) ou subiu (upload manual)
-- fica aqui pra ser reusada em carrosséis futuros. A IA também pode
-- consultar pra sugerir imagens compatíveis com o slide.
--
-- source:
--   - 'generated'  → gerada por Imagen 4 (prompt + URL no storage)
--   - 'uploaded'   → subida pelo user (foto própria)
--   - 'unsplash'   → salva de busca (raro)
-- ============================================================

create table if not exists public.user_images (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  source text not null check (source in ('generated', 'uploaded', 'unsplash', 'search')),
  title text,
  description text,
  tags text[] default '{}',
  -- Metadados opcionais
  prompt text, -- pra 'generated': prompt usado
  carousel_id uuid references public.carousels(id) on delete set null, -- carrossel de origem, se houver
  slide_index int, -- índice do slide de origem
  -- Uso
  usage_count int default 0, -- quantos carrosséis já usaram
  last_used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_user_images_user on public.user_images(user_id, created_at desc);
create index if not exists idx_user_images_source on public.user_images(user_id, source);

-- RLS
alter table public.user_images enable row level security;

create policy "Users can view own images"
  on public.user_images for select
  using (auth.uid() = user_id);

create policy "Users can insert own images"
  on public.user_images for insert
  with check (auth.uid() = user_id);

create policy "Users can update own images"
  on public.user_images for update
  using (auth.uid() = user_id);

create policy "Users can delete own images"
  on public.user_images for delete
  using (auth.uid() = user_id);
