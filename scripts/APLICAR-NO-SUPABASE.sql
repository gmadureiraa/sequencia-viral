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
