-- Mass Generation Jobs — Piloto Automático em massa.
--
-- User entra em /app/zernio/autopilot, clica "Gerar em massa", configura:
--   - Quantidade (1..30, respeitando cap mensal)
--   - Temas explícitos OU autoSuggest baseado em brand_analysis + histórico
--   - Refs opcionais (URLs IG/Twitter como contexto compartilhado)
--   - Auto-agendar no calendário (cadência + hora)
--
-- Backend cria 1 generation_jobs row + N generation_job_items (1 por carrossel).
-- Worker /api/cron/process-mass-jobs processa pending em background (2 paralelo
-- por user pra não travar Gemini quota), respeita usage_limit do plano.
-- Reusa lib/server/zernio-trigger-runner.ts pra geração em si (mesmo pipeline:
-- Gemini → render → upload → opcional Zernio scheduled post).
--
-- RLS: user só vê seus próprios jobs/items.

-- ============================================================
-- 1. mass_generation_jobs (job principal)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mass_generation_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status global do job
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Contagens
  total_count         INTEGER NOT NULL CHECK (total_count > 0 AND total_count <= 30),
  completed_count     INTEGER NOT NULL DEFAULT 0,
  failed_count        INTEGER NOT NULL DEFAULT 0,

  -- Config completa do job (JSON com themes, refs, autoSchedule, cadence, hour, etc.)
  -- Estrutura esperada (ver lib/server/mass-generation/types.ts):
  --   {
  --     themesMode: 'explicit' | 'auto-suggest',
  --     themes: string[]      -- explicit OR generated
  --     refs: string[]        -- IG/Twitter URLs compartilhadas
  --     autoSchedule: boolean,
  --     cadence: 'daily' | 'alternating' | 'weekly' | 'custom',
  --     intervalDays?: number,
  --     publishHour: number (0-23),
  --     publishMinute: number (0-59),
  --     timezone: string,
  --     designTemplate: 'twitter' | 'manifesto',
  --     editorialLine?: string,
  --     niche?: string,
  --     tone?: string
  --   }
  config              JSONB NOT NULL DEFAULT '{}',

  -- Erro do job (se aplicável — ex: falha do worker, não de item individual)
  error               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mass_gen_jobs_user_id_idx
  ON public.mass_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS mass_gen_jobs_status_idx
  ON public.mass_generation_jobs(status)
  WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS mass_gen_jobs_user_recent_idx
  ON public.mass_generation_jobs(user_id, created_at DESC);

ALTER TABLE public.mass_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mass_gen_jobs_self_all" ON public.mass_generation_jobs;
CREATE POLICY "mass_gen_jobs_self_all"
  ON public.mass_generation_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS mass_gen_jobs_touch ON public.mass_generation_jobs;
CREATE TRIGGER mass_gen_jobs_touch
  BEFORE UPDATE ON public.mass_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2. mass_generation_items (1 row por carrossel a gerar)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mass_generation_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES public.mass_generation_jobs(id) ON DELETE CASCADE,
  -- user_id denormalizado pra RLS performance (evita join na policy)
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Posição no batch (0-indexed). Determina ordem de processamento + scheduling.
  item_index          INTEGER NOT NULL CHECK (item_index >= 0),

  -- Tema escolhido pra esse carrossel (resolvido na criação do job)
  theme               TEXT NOT NULL,

  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'completed', 'failed')),

  -- Resultados quando completed
  carousel_id         UUID REFERENCES public.carousels(id) ON DELETE SET NULL,
  scheduled_post_id   UUID REFERENCES public.zernio_scheduled_posts(id) ON DELETE SET NULL,
  -- Se config.autoSchedule=true, este é o horário calculado pra esse carrossel.
  -- Worker usa pra criar zernio_scheduled_posts ao concluir.
  scheduled_at        TIMESTAMPTZ,

  error               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS mass_gen_items_job_index_uniq
  ON public.mass_generation_items(job_id, item_index);
CREATE INDEX IF NOT EXISTS mass_gen_items_job_idx
  ON public.mass_generation_items(job_id);
CREATE INDEX IF NOT EXISTS mass_gen_items_user_idx
  ON public.mass_generation_items(user_id);
CREATE INDEX IF NOT EXISTS mass_gen_items_pending_idx
  ON public.mass_generation_items(status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.mass_generation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mass_gen_items_self_all" ON public.mass_generation_items;
CREATE POLICY "mass_gen_items_self_all"
  ON public.mass_generation_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Helper view pra dashboards (opcional, fácil polling)
-- ============================================================
CREATE OR REPLACE VIEW public.mass_generation_jobs_with_progress AS
SELECT
  j.*,
  CASE
    WHEN j.total_count = 0 THEN 0
    ELSE ROUND((j.completed_count::numeric / j.total_count::numeric) * 100, 0)::integer
  END AS progress_pct,
  (j.total_count - j.completed_count - j.failed_count) AS remaining_count
FROM public.mass_generation_jobs j;

-- View herda RLS da tabela base.

COMMENT ON TABLE public.mass_generation_jobs IS
  'Jobs de geração em massa do Piloto Automático SV. 1 job → N items, processados em background pelo cron worker.';
COMMENT ON TABLE public.mass_generation_items IS
  '1 carrossel a gerar dentro de um mass_generation_job. Worker pega em batches (status=pending) e chama runGeneration() reusando pipeline existente.';
