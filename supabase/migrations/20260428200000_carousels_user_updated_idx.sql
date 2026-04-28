-- Índice composto pra query quente em /api/generate.
--
-- O writer carrega os 40 carrosseis mais recentes do user pra
-- montar feedback context (route.ts ~linha 449). Query padrão:
--   SELECT ... FROM carousels
--   WHERE user_id = $1
--   ORDER BY updated_at DESC
--   LIMIT 40
--
-- Sem este índice, postgres faz seq scan filtrando por user_id e
-- depois ordena em memória. Em users com 100+ carrosseis, isso
-- contribui ~50-150ms ao tempo de geração. O índice composto
-- (user_id, updated_at DESC) faz a query virar index-only scan
-- com ordenação implícita.
--
-- Referenciado: audit completo SV 28/04 (P1 mudança 7).

CREATE INDEX IF NOT EXISTS idx_carousels_user_updated_at
  ON carousels (user_id, updated_at DESC);

-- O índice antigo `idx_carousels_user_id` (definido em migration
-- inicial) fica como cobertura pra queries que só filtram sem
-- ordenar (ex: count). Postgres prefere o composto pra ORDER BY.
