-- Biblioteca de carrosséis-referência (swipe file).
--
-- Espelha library_reels do Reels Viral, adaptado pra carrossel:
--   - capa = primeiro slide
--   - slides[] guarda transcrição+imagem de cada página
--   - categorias seguem taxonomia próxima ao RV (Tutorial, Lista, etc)
--
-- Seed inicial vem do swipe-collector (vault/99 - SISTEMA/biblioteca/
-- swipe-instagram/_disponiveis/). 187 carrosséis de 15 perfis (Filipe Viana
-- + Afonso Molina + samaestrello + etc).
--
-- Storage: imagens cacheadas em bucket public `library-carousels`,
-- chave `<short_code>/<idx>.jpg`.

CREATE TABLE IF NOT EXISTS public.library_carousels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- origem
  ig_url text NOT NULL UNIQUE,
  short_code text,
  author_handle text,
  caption text,
  posted_at timestamptz,

  -- visual
  cover_url text,
  slides_count int NOT NULL DEFAULT 0,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{idx, image_url, text}]

  -- métricas
  likes_count int,
  comments_count int,

  -- curadoria
  categories text[] DEFAULT ARRAY[]::text[],
  hook_pattern text,
  tags jsonb DEFAULT '[]'::jsonb,
  featured boolean NOT NULL DEFAULT false,

  -- timestamps
  added_at timestamptz NOT NULL DEFAULT now(),
  collected_at timestamptz,
  analyzed_at timestamptz,
  analysis_json jsonb
);

CREATE INDEX IF NOT EXISTS library_carousels_author_handle_idx
  ON public.library_carousels (author_handle);
CREATE INDEX IF NOT EXISTS library_carousels_added_at_idx
  ON public.library_carousels (added_at DESC);
CREATE INDEX IF NOT EXISTS library_carousels_categories_idx
  ON public.library_carousels USING GIN (categories);
CREATE INDEX IF NOT EXISTS library_carousels_featured_idx
  ON public.library_carousels (featured) WHERE featured = true;

-- RLS: leitura pública (biblioteca é compartilhada). Escrita só service_role.
ALTER TABLE public.library_carousels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_carousels_public_read" ON public.library_carousels;
CREATE POLICY "library_carousels_public_read"
  ON public.library_carousels
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- (sem policy de INSERT/UPDATE/DELETE — só service_role aceita)
