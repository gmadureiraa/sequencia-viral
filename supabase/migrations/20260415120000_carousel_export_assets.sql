-- Export assets (URLs públicas de PNG/PDF gerados no app) + bucket de storage.
-- Rode no SQL Editor do Supabase se não usar CLI de migrações.

alter table public.carousels
  add column if not exists export_assets jsonb default '{}'::jsonb;

comment on column public.carousels.export_assets is
  'Metadados de export: { pngUrls: string[], pdfUrl?: string, exportedAt: string, slideCount: number }';

-- Bucket para arquivos exportados (mesmo padrão de carousel-images: público para leitura direta).
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

-- Leitura pública dos objetos (URLs getPublicUrl).
drop policy if exists "Public read carousel exports" on storage.objects;
create policy "Public read carousel exports"
  on storage.objects for select
  using (bucket_id = 'carousel-exports');
