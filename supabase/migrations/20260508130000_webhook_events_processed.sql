-- ──────────────────────────────────────────────────────────────────
-- Tabela genérica de dedup pra webhooks de terceiros (Resend, Zernio,
-- etc). Mesma ideia da `stripe_events_processed` (UNIQUE event_id) mas
-- com `provider` pra namespace separar (Resend usa `svix-id`, Zernio
-- usa `payload.id`, ambos podem colidir hipoteticamente).
--
-- Aplicação: handler captura ID do header (svix-id, x-zernio-event-id,
-- etc), tenta INSERT com `provider+event_id`. Conflito = replay → 200.
--
-- Defesa contra **replay attack** quando combinada com window de
-- `svix-timestamp`/`x-zernio-timestamp` < 5min. Sem isso, atacante
-- captura request via MITM/log-leak e replay infinito (mesmo HMAC, vai
-- passar a verificação).
-- ──────────────────────────────────────────────────────────────────

create table if not exists public.webhook_events_processed (
  provider text not null,
  event_id text not null,
  received_at timestamptz default now(),
  primary key (provider, event_id)
);

create index if not exists idx_webhook_events_received
  on public.webhook_events_processed(received_at desc);

-- RLS habilitado apenas pra seguir padrão. Service role bypassa.
alter table public.webhook_events_processed enable row level security;
