-- Adiciona a coluna `prompt_used` na table `carousels` para transparência
-- do prompt enviado à IA em cada carrossel gerado. Permite ao admin
-- auditar exatamente o systemPrompt + userMessage usados na geração.
--
-- Só Gabriel (admin) consegue visualizar no editor via UI gate.
-- Users regulares não veem o campo no app, mas ele é persistido no banco
-- pra análise interna (debug de geração ruim, fine-tuning de prompt).

ALTER TABLE public.carousels
  ADD COLUMN IF NOT EXISTS prompt_used text;

-- Sem default, sem NOT NULL — carrosséis antigos mantêm NULL.
