-- ROOT CAUSE FIX: bucket `carousel-images` nunca foi criado como migration,
-- so era referenciado em comentarios ("mesmo padrao de carousel-images").
-- Uploads falhavam silenciosamente com "Bucket not found" e getPublicUrl
-- devolvia URL formalmente valida mas 404 no browser.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carousel-images',
  'carousel-images',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura publica (URLs publicas Supabase).
drop policy if exists "Public read carousel images" on storage.objects;
create policy "Public read carousel images"
  on storage.objects for select
  using (bucket_id = 'carousel-images');

-- Inserts/updates/deletes: restrito a service role (ja e o padrao sem policy
-- INSERT/UPDATE/DELETE). Client side so consome via getPublicUrl.
