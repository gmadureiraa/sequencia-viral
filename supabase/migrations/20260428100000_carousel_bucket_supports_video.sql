-- Audit Gabriel 2026-04-28: user pediu "subir vídeo em algumas páginas
-- do carrossel, não apenas imagens, e a página que tem vídeo sempre
-- salva como mp4".
--
-- Bucket carousel-images antes só aceitava image/* até 8MB. Agora aceita
-- video/mp4|webm|quicktime até 50MB.
--
-- Limit 50MB cobre Reels típicos (~10-15MB pra 60s 720p) com folga.
-- Vercel Functions têm 4.5MB no body do request por default, mas o
-- upload via Supabase Storage não passa por Vercel Function (vai direto
-- da rota /api/upload que aceita Form streamado), então o limite real
-- é o do bucket.

UPDATE storage.buckets
   SET file_size_limit = 52428800, -- 50MB
       allowed_mime_types = ARRAY[
         'image/png',
         'image/jpeg',
         'image/webp',
         'image/gif',
         'video/mp4',
         'video/webm',
         'video/quicktime'
       ]::text[]
 WHERE id = 'carousel-images';
