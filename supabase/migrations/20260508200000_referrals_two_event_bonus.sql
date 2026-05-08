-- 20260508200000_referrals_two_event_bonus.sql
--
-- Programa Indique-e-Ganhe agora tem DOIS gatilhos de bônus pro referrer:
--   1) ATIVAÇÃO (novo): amigo cria o PRIMEIRO carrossel → +5 carrosséis
--   2) PAGAMENTO (já existia): amigo paga primeira fatura → +20 (era +10)
--
-- Ambos creditam atomicamente em `profiles.usage_limit` via mesma RPC,
-- diferenciados por `type` em `referral_credits`. Idempotência mantida pelo
-- unique index existente (referred_user_id, subscription_id, type).
--
-- Decisão: usamos `usage_limit` como veículo (consistente com a v1 atual),
-- não `customer.balance` Stripe. Aluno do referrer ganha mais headroom no
-- mês corrente — ele decide se cria mais carrosséis ou estoca.

-- ============================================================
-- 1) Expande type check pra aceitar os dois eventos novos
-- ============================================================
-- Mantemos 'carousels_bonus' como valor permitido pra não quebrar idempotência
-- de credits antigos. O backfill (20260508210000) reescreve esses pra
-- 'paid_bonus' e dropa o valor legado depois.
alter table public.referral_credits
  drop constraint if exists referral_credits_type_check;

alter table public.referral_credits
  add constraint referral_credits_type_check
  check (type in ('activation_bonus', 'paid_bonus', 'carousels_bonus'));

-- ============================================================
-- 2) RPC com p_type (nova assinatura)
--    Default 'paid_bonus' pra backwards-compat — chamadas antigas sem
--    o param continuam creditando o bônus de pagamento.
-- ============================================================
drop function if exists public.grant_referral_carousels_bonus(uuid, uuid, int, uuid, text, text);

create or replace function public.grant_referral_carousels_bonus(
  p_referrer_user_id uuid,
  p_referred_user_id uuid,
  p_amount int,
  p_referral_id uuid default null,
  p_stripe_subscription_id text default null,
  p_stripe_session_id text default null,
  p_type text default 'paid_bonus'
)
returns table(ok boolean, applied boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted public.referral_credits%rowtype;
begin
  if p_type not in ('activation_bonus', 'paid_bonus') then
    return query select false, false, ('invalid_type:' || p_type)::text;
    return;
  end if;

  -- Insert do log com unique constraint. Como o unique inclui `type`,
  -- mesmo referee pode receber 2 créditos (um activation + um paid).
  -- Ativação não tem subscription_id (NULL → '' no unique), então só
  -- pode acontecer 1x por referee — guard de race.
  begin
    insert into public.referral_credits (
      referrer_user_id,
      referred_user_id,
      referral_id,
      type,
      amount,
      stripe_subscription_id,
      stripe_session_id
    ) values (
      p_referrer_user_id,
      p_referred_user_id,
      p_referral_id,
      p_type,
      p_amount,
      p_stripe_subscription_id,
      p_stripe_session_id
    )
    returning * into v_inserted;
  exception when unique_violation then
    return query select true, false, 'already_credited'::text;
    return;
  end;

  -- Incrementa usage_limit atomicamente (single-row UPDATE = atomic em PG).
  update public.profiles
     set usage_limit = coalesce(usage_limit, 0) + p_amount,
         updated_at = now()
   where id = p_referrer_user_id;

  return query select true, true, 'credited'::text;
end;
$$;

grant execute on function public.grant_referral_carousels_bonus(
  uuid, uuid, int, uuid, text, text, text
) to service_role;
