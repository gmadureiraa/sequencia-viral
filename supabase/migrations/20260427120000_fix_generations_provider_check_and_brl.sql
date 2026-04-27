-- Audit P0 (Antigravity, 2026-04-27): dois problemas críticos.
--
-- Problema 1: `generations.provider` tem CHECK constraint só com
-- ('anthropic', 'google', 'openai') mas o código loga 7 providers
-- adicionais (perplexity, firecrawl, unsplash, serper, apify,
-- scrapecreators, supadata). Cada INSERT desses falha silenciosamente
-- via console.warn em recordGeneration — admin perde visibilidade
-- de custos reais (Apify ~$0.02/call, Serper, Firecrawl, etc).
--
-- Fix: dropa a CHECK e adiciona uma nova com a lista completa.
-- Não usei ENUM pq adicionar valores requer migration toda vez —
-- TEXT + CHECK é mais flexível pra MVP.
--
-- Problema 2: `payments.currency` default 'USD' mas a coluna
-- `amount_usd` agora guarda BRL desde a migração de moeda em abril/2026
-- (ver lib/pricing.ts:111). Resultado: relatórios financeiros que
-- assumem USD calculam errado. Não dá pra renomear `amount_usd`
-- agora sem quebrar código (legado), mas pelo menos corrigimos o
-- default da currency pra BRL — assim novos pagamentos têm flag
-- correta e queries com WHERE currency='USD' não pegam BRL falso.

-- ── Fix #1: providers em generations ──
ALTER TABLE public.generations
  DROP CONSTRAINT IF EXISTS generations_provider_check;

ALTER TABLE public.generations
  ADD CONSTRAINT generations_provider_check
  CHECK (provider IN (
    -- LLMs
    'anthropic', 'google', 'openai', 'perplexity',
    -- Scrape / Search
    'firecrawl', 'serper', 'apify', 'scrapecreators',
    -- Image / Stock
    'unsplash',
    -- Transcription
    'supadata'
  ));

-- ── Fix #2: currency default em payments ──
ALTER TABLE public.payments
  ALTER COLUMN currency SET DEFAULT 'BRL';

-- Atualiza linhas históricas inseridas após a migração de moeda mas
-- com currency='USD' por causa do default antigo. Heurística: pagamentos
-- depois de 2026-04-22 (data oficial do switch BRL) com currency='USD'
-- e amount > 49 (preços PRO/BUSINESS em BRL passariam de R$49 facilmente,
-- enquanto USD legados eram <$30) são re-marcados como BRL.
UPDATE public.payments
  SET currency = 'BRL'
  WHERE currency = 'USD'
    AND created_at >= '2026-04-22'
    AND amount_usd >= 30;

-- Comentários documentando o gotcha pra próximo dev:
COMMENT ON COLUMN public.payments.amount_usd IS
  'LEGADO: nome diz USD mas guarda BRL desde 2026-04-22 (migração de moeda). Veja lib/pricing.ts. Não renomeei a coluna pra não quebrar código existente. Quando precisar de USD real, converter via USD_BRL_RATE.';

COMMENT ON COLUMN public.payments.currency IS
  'Moeda do pagamento. Default BRL desde 2026-04-27. Pagamentos antes de 2026-04-22 podem ainda ter ''USD'' real.';
