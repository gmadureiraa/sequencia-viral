-- Feedback pós-download de carrossel, alimentando loop de aprendizado da IA.
-- Cada row guarda o texto bruto, a classificação (buckets text/image/both)
-- e as regras acionáveis que o classificador Gemini Flash extraiu.
-- A agregação desses rules vira profile.brand_analysis.__generation_memory
-- e é injetada no writer + image-decider como "DIRETRIZES DO USER".
create table if not exists carousel_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  carousel_id uuid,
  raw_text text not null,
  classified_buckets text[] not null default '{}',
  text_rules text[] default '{}',
  image_rules text[] default '{}',
  classifier_model text,
  classifier_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);

create index if not exists carousel_feedback_user_id_idx
  on carousel_feedback(user_id);
create index if not exists carousel_feedback_created_at_idx
  on carousel_feedback(created_at desc);

alter table carousel_feedback enable row level security;

-- Service role pode tudo (usada pela API).
drop policy if exists "service role full" on carousel_feedback;
create policy "service role full" on carousel_feedback
  for all to service_role using (true) with check (true);

-- User autenticado pode ler só os próprios.
drop policy if exists "user read own" on carousel_feedback;
create policy "user read own" on carousel_feedback
  for select to authenticated using (user_id = auth.uid());
