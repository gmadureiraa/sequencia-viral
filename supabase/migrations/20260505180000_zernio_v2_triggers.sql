-- Zernio v2 — modelo simplificado + triggers (gatilhos).
--
-- Mudanças:
--   1. zernio_accounts ganha UNIQUE partial index (user_id, platform) WHERE
--      status='active'. Cada user só pode ter 1 IG ativo + 1 LinkedIn ativo.
--      Histórico de desconectadas mantido sem unique.
--   2. zernio_autopilot_recipes/runs DROPADAS. Substituídas por
--      zernio_autopilot_triggers + zernio_autopilot_runs (recriado).
--   3. Triggers tem 3 tipos: schedule (tempo), rss (poll feed), webhook
--      (fire externo).
--
-- Migration drop+recreate é safe porque schema v1 ainda não tem dados
-- em prod (subiu hoje, ninguém usou autopilot ainda).

-- ============================================================
-- 1. Constraint 1-conta-por-plataforma-por-user
-- ============================================================
-- Partial index: só conta active. User pode ter histórico de N contas
-- desconectadas da mesma plataforma sem violar.
CREATE UNIQUE INDEX IF NOT EXISTS zernio_accounts_one_active_per_platform
  ON public.zernio_accounts (user_id, platform)
  WHERE status = 'active';

-- ============================================================
-- 2. Drop autopilot v1
-- ============================================================
DROP TABLE IF EXISTS public.zernio_autopilot_runs CASCADE;
DROP TABLE IF EXISTS public.zernio_autopilot_recipes CASCADE;

-- ============================================================
-- 3. zernio_autopilot_triggers (v2)
-- ============================================================
-- Trigger = gatilho que dispara geração + agendamento automático.
-- Tipos:
--   - 'schedule':   cadência baseada em tempo (every_n_days, weekly_dow,
--                   specific_dates). Cron diário processa.
--   - 'rss':        poll URL de RSS. Quando aparece nova entrada (guid
--                   não está em processed_guids), dispara geração com o
--                   título/conteúdo da entrada como tema.
--   - 'webhook':    endpoint público /api/zernio/triggers/[id]/fire que
--                   aceita POST com tema + secret na URL. Permite Zapier/
--                   Make/n8n disparar geração manualmente.
CREATE TABLE IF NOT EXISTS public.zernio_autopilot_triggers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type        TEXT NOT NULL CHECK (trigger_type IN ('schedule', 'rss', 'webhook')),

  -- Configuração editorial (comum aos 3 tipos)
  themes              TEXT[] NOT NULL DEFAULT '{}',     -- pool quando trigger não traz tema próprio
  editorial_line      TEXT NOT NULL DEFAULT '',
  niche               TEXT,
  tone                TEXT NOT NULL DEFAULT 'editorial',
  language            TEXT NOT NULL DEFAULT 'pt-br',
  design_template     TEXT NOT NULL DEFAULT 'twitter',

  -- Plataformas alvo (quais redes posta) — array porque user pode escolher
  -- IG e LinkedIn ao mesmo tempo no mesmo trigger.
  target_platforms    TEXT[] NOT NULL DEFAULT '{instagram,linkedin}',

  -- Modo de publicação
  publish_mode        TEXT NOT NULL DEFAULT 'scheduled' CHECK (publish_mode IN ('scheduled', 'draft', 'publish_now')),

  -- Schedule type: campos específicos
  cadence_type        TEXT,                              -- daily | every_n_days | weekly_dow | specific_dates
  interval_days       INTEGER,
  days_of_week        INTEGER[],
  specific_dates      DATE[],
  publish_hour        INTEGER NOT NULL DEFAULT 9,
  publish_minute      INTEGER NOT NULL DEFAULT 0,
  timezone            TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  next_run_at         TIMESTAMPTZ,

  -- RSS type: campos específicos
  rss_url             TEXT,
  rss_check_interval_minutes INTEGER NOT NULL DEFAULT 60,
  rss_last_checked_at TIMESTAMPTZ,
  rss_processed_guids TEXT[] NOT NULL DEFAULT '{}',     -- IDs de itens já processados (cap 200)
  rss_max_items_per_check INTEGER NOT NULL DEFAULT 1,   -- quantos novos items disparam por check (1 = sempre o mais recente)

  -- Webhook type: campos específicos
  webhook_secret      TEXT,                              -- token gerado no insert. URL: /api/zernio/triggers/{id}/fire?secret={...}

  last_fired_at       TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zernio_triggers_user_id_idx ON public.zernio_autopilot_triggers(user_id);
CREATE INDEX IF NOT EXISTS zernio_triggers_active_type_idx
  ON public.zernio_autopilot_triggers(is_active, trigger_type)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS zernio_triggers_schedule_next_run_idx
  ON public.zernio_autopilot_triggers(next_run_at)
  WHERE is_active = TRUE AND trigger_type = 'schedule' AND next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS zernio_triggers_rss_check_idx
  ON public.zernio_autopilot_triggers(rss_last_checked_at)
  WHERE is_active = TRUE AND trigger_type = 'rss';

ALTER TABLE public.zernio_autopilot_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_triggers_self_all" ON public.zernio_autopilot_triggers;
CREATE POLICY "zernio_triggers_self_all"
  ON public.zernio_autopilot_triggers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS zernio_triggers_touch ON public.zernio_autopilot_triggers;
CREATE TRIGGER zernio_triggers_touch
  BEFORE UPDATE ON public.zernio_autopilot_triggers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 4. zernio_autopilot_runs (v2 — FK pra triggers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.zernio_autopilot_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id          UUID NOT NULL REFERENCES public.zernio_autopilot_triggers(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fired_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fired_by            TEXT NOT NULL,                     -- 'cron' | 'webhook' | 'manual' (run-now)
  trigger_payload     JSONB,                              -- ex RSS: {guid, title, link}, webhook: body do POST
  status              TEXT NOT NULL,                      -- pending | generating | scheduled | failed
  theme_chosen        TEXT,
  carousel_id         UUID REFERENCES public.carousels(id) ON DELETE SET NULL,
  scheduled_post_id   UUID REFERENCES public.zernio_scheduled_posts(id) ON DELETE SET NULL,
  error               TEXT,
  finished_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS zernio_runs_trigger_id_idx ON public.zernio_autopilot_runs(trigger_id);
CREATE INDEX IF NOT EXISTS zernio_runs_user_id_idx ON public.zernio_autopilot_runs(user_id);
CREATE INDEX IF NOT EXISTS zernio_runs_status_idx ON public.zernio_autopilot_runs(status);
CREATE INDEX IF NOT EXISTS zernio_runs_fired_at_idx ON public.zernio_autopilot_runs(fired_at DESC);

ALTER TABLE public.zernio_autopilot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zernio_runs_self_all" ON public.zernio_autopilot_runs;
CREATE POLICY "zernio_runs_self_all"
  ON public.zernio_autopilot_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
