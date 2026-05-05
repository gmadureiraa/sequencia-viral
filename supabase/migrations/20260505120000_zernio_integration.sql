-- Zernio integration (admin-only feature).
-- Zernio é scheduler unified pra Twitter/IG/LinkedIn/FB/etc. (https://docs.zernio.com)
--
-- Modelo:
--   zernio_profiles      → 1 por marca/cliente (Madureira, Defiverso, DSEC...).
--                          Cada profile agrupa N contas sociais.
--   zernio_accounts      → conta social conectada via OAuth Zernio.
--   zernio_scheduled_posts → log local dos posts criados via /v1/posts. Liga
--                          carousel_id (SV) ↔ zernio_post_id (Zernio).
--   zernio_autopilot_recipes → receita de geração automática (temas + linha
--                          editorial + cadência). O cron lê isso pra gerar
--                          carrossel + agendar via Zernio sem intervenção.
--   zernio_autopilot_runs → histórico de execuções (idempotência + debug).
--
-- Acesso: gating de admin é no application layer (lib/server/auth.ts::requireAdmin
-- + lib/admin-emails.ts). RLS aqui só isola usuários entre si — qualquer user
-- autenticado podia ler suas próprias linhas, mas as rotas /api/zernio/* só
-- aceitam admin email. Defesa em profundidade.

-- ============================================================
-- 1. zernio_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zernio_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zernio_profile_id   TEXT NOT NULL UNIQUE,  -- prof_abc123 do Zernio
  name                TEXT NOT NULL,         -- "Madureira", "Defiverso", "DSEC"
  description         TEXT,
  autopilot_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  raw                 JSONB,                 -- snapshot da resposta do Zernio
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS zernio_profiles_user_id_idx ON public.zernio_profiles(user_id);
CREATE INDEX IF NOT EXISTS zernio_profiles_zernio_id_idx ON public.zernio_profiles(zernio_profile_id);

ALTER TABLE public.zernio_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_profiles_self_all" ON public.zernio_profiles;
CREATE POLICY "zernio_profiles_self_all"
  ON public.zernio_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. zernio_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zernio_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES public.zernio_profiles(id) ON DELETE CASCADE,
  zernio_account_id   TEXT NOT NULL UNIQUE,  -- acc_xyz789 do Zernio
  platform            TEXT NOT NULL,         -- twitter, instagram, linkedin, ...
  handle              TEXT,                  -- @ogmadureira (sem o @)
  display_name        TEXT,
  status              TEXT NOT NULL DEFAULT 'active',  -- active | disconnected | needs_reauth
  raw                 JSONB,
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS zernio_accounts_user_id_idx ON public.zernio_accounts(user_id);
CREATE INDEX IF NOT EXISTS zernio_accounts_profile_id_idx ON public.zernio_accounts(profile_id);
CREATE INDEX IF NOT EXISTS zernio_accounts_platform_idx ON public.zernio_accounts(platform);

ALTER TABLE public.zernio_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_accounts_self_all" ON public.zernio_accounts;
CREATE POLICY "zernio_accounts_self_all"
  ON public.zernio_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. zernio_scheduled_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zernio_scheduled_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES public.zernio_profiles(id) ON DELETE CASCADE,
  carousel_id         UUID REFERENCES public.carousels(id) ON DELETE SET NULL,
  zernio_post_id      TEXT UNIQUE,           -- post_abc123 do Zernio
  status              TEXT NOT NULL,         -- draft | scheduled | publishing | published | failed | cancelled
  content             TEXT NOT NULL,         -- texto da legenda
  platforms           JSONB NOT NULL,        -- [{platform, accountId}, ...]
  scheduled_for       TIMESTAMPTZ,           -- null se draft ou publishNow
  timezone            TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  published_at        TIMESTAMPTZ,
  failure_reason      TEXT,
  source              TEXT NOT NULL DEFAULT 'manual',  -- manual | autopilot | api
  autopilot_run_id    UUID,                  -- FK soft (sem CHECK pra evitar circular dep com autopilot_runs)
  raw                 JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zernio_scheduled_posts_user_id_idx ON public.zernio_scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS zernio_scheduled_posts_profile_id_idx ON public.zernio_scheduled_posts(profile_id);
CREATE INDEX IF NOT EXISTS zernio_scheduled_posts_carousel_id_idx ON public.zernio_scheduled_posts(carousel_id);
CREATE INDEX IF NOT EXISTS zernio_scheduled_posts_scheduled_for_idx ON public.zernio_scheduled_posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS zernio_scheduled_posts_status_idx ON public.zernio_scheduled_posts(status);

ALTER TABLE public.zernio_scheduled_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_scheduled_posts_self_all" ON public.zernio_scheduled_posts;
CREATE POLICY "zernio_scheduled_posts_self_all"
  ON public.zernio_scheduled_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. zernio_autopilot_recipes
-- ============================================================
-- Receita = "gere conteúdo sobre estes temas, com esta linha editorial,
--            nesta cadência, pros profiles X+Y, agendando entre Z e W horário".
-- O cron diário (/api/cron/zernio-autopilot) escaneia recipes ativos com
-- next_run_at <= NOW() e dispara a geração + agendamento.
CREATE TABLE IF NOT EXISTS public.zernio_autopilot_recipes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES public.zernio_profiles(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  themes              TEXT[] NOT NULL DEFAULT '{}',     -- pool de temas que a IA escolhe
  editorial_line      TEXT NOT NULL DEFAULT '',         -- diretriz de voz/ângulo
  niche               TEXT,
  tone                TEXT NOT NULL DEFAULT 'editorial',
  language            TEXT NOT NULL DEFAULT 'pt-br',
  design_template     TEXT NOT NULL DEFAULT 'twitter',
  -- Cadência:
  --   'daily'        → gera todo dia (interval_days=1)
  --   'every_n_days' → interval_days controla
  --   'weekly_dow'   → days_of_week=[1,3,5] = seg/qua/sex
  --   'specific_dates' → specific_dates é array de datas ISO no futuro
  cadence_type        TEXT NOT NULL DEFAULT 'every_n_days',
  interval_days       INTEGER,                           -- usado em daily/every_n_days
  days_of_week        INTEGER[],                         -- 0=dom, 1=seg, ..., 6=sab
  specific_dates      DATE[],                            -- datas absolutas (próximas)
  publish_hour        INTEGER NOT NULL DEFAULT 9,        -- 0-23, hora local
  publish_minute      INTEGER NOT NULL DEFAULT 0,        -- 0-59
  timezone            TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  target_account_ids  TEXT[] NOT NULL DEFAULT '{}',      -- zernio_account_ids das contas alvo
  publish_mode        TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | draft (admin revisa antes)
  next_run_at         TIMESTAMPTZ,                       -- próximo disparo do cron
  last_run_at         TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zernio_autopilot_recipes_user_id_idx ON public.zernio_autopilot_recipes(user_id);
CREATE INDEX IF NOT EXISTS zernio_autopilot_recipes_profile_id_idx ON public.zernio_autopilot_recipes(profile_id);
CREATE INDEX IF NOT EXISTS zernio_autopilot_recipes_active_next_run_idx
  ON public.zernio_autopilot_recipes(is_active, next_run_at)
  WHERE is_active = TRUE;

ALTER TABLE public.zernio_autopilot_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_autopilot_recipes_self_all" ON public.zernio_autopilot_recipes;
CREATE POLICY "zernio_autopilot_recipes_self_all"
  ON public.zernio_autopilot_recipes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. zernio_autopilot_runs
-- ============================================================
-- Histórico de execuções do cron pra cada recipe. Idempotência: cron
-- usa (recipe_id, run_date) como chave única pra evitar duplo disparo
-- quando o cron rodar mais de uma vez no mesmo dia (ex: retry do Vercel).
CREATE TABLE IF NOT EXISTS public.zernio_autopilot_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL REFERENCES public.zernio_autopilot_recipes(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_date            DATE NOT NULL,                      -- chave de idempotência diária
  status              TEXT NOT NULL,                      -- pending | generating | scheduled | failed
  theme_chosen        TEXT,                               -- tema sorteado da pool
  carousel_id         UUID REFERENCES public.carousels(id) ON DELETE SET NULL,
  scheduled_post_id   UUID REFERENCES public.zernio_scheduled_posts(id) ON DELETE SET NULL,
  error               TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  UNIQUE(recipe_id, run_date)
);

CREATE INDEX IF NOT EXISTS zernio_autopilot_runs_recipe_id_idx ON public.zernio_autopilot_runs(recipe_id);
CREATE INDEX IF NOT EXISTS zernio_autopilot_runs_user_id_idx ON public.zernio_autopilot_runs(user_id);
CREATE INDEX IF NOT EXISTS zernio_autopilot_runs_status_idx ON public.zernio_autopilot_runs(status);

ALTER TABLE public.zernio_autopilot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_autopilot_runs_self_all" ON public.zernio_autopilot_runs;
CREATE POLICY "zernio_autopilot_runs_self_all"
  ON public.zernio_autopilot_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- updated_at trigger (reaproveita pattern do meta_connections)
-- ============================================================
-- Função genérica de touch — se já existe, não recria.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS zernio_profiles_touch ON public.zernio_profiles;
CREATE TRIGGER zernio_profiles_touch
  BEFORE UPDATE ON public.zernio_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS zernio_accounts_touch ON public.zernio_accounts;
CREATE TRIGGER zernio_accounts_touch
  BEFORE UPDATE ON public.zernio_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS zernio_scheduled_posts_touch ON public.zernio_scheduled_posts;
CREATE TRIGGER zernio_scheduled_posts_touch
  BEFORE UPDATE ON public.zernio_scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS zernio_autopilot_recipes_touch ON public.zernio_autopilot_recipes;
CREATE TRIGGER zernio_autopilot_recipes_touch
  BEFORE UPDATE ON public.zernio_autopilot_recipes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
