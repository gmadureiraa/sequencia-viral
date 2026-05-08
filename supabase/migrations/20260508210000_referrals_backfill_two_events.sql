-- 20260508210000_referrals_backfill_two_events.sql
--
-- Backfill retroativo para o novo modelo de dois eventos:
--   - Eleva créditos antigos type='carousels_bonus' (10 carrosséis) → 'paid_bonus' (20)
--     diferença = +10 carrosséis no usage_limit de cada referrer afetado
--   - Cria credit type='activation_bonus' (5 carrosséis) para cada referee que
--     já criou pelo menos 1 carrossel (usage_count >= 1)
--
-- Idempotente — pode rodar múltiplas vezes sem efeito colateral:
--   - Após primeira execução, não existem mais rows 'carousels_bonus'
--   - Insert de activation_bonus respeita unique key
--     (referred_user_id, '', 'activation_bonus')

-- ============================================================
-- BACKFILL 1: Upgrade 'carousels_bonus' → 'paid_bonus'
--   Antigo bônus = 10 / Novo = 20 / Diff = +10 por crédito
-- ============================================================
do $$
declare
  v_old_credit record;
  v_diff int := 10; -- 20 (novo) - 10 (antigo)
  v_total_upgraded int := 0;
begin
  for v_old_credit in
    select id, referrer_user_id, amount
      from public.referral_credits
     where type = 'carousels_bonus'
  loop
    -- Adiciona diff ao usage_limit do referrer
    update public.profiles
       set usage_limit = coalesce(usage_limit, 0) + v_diff,
           updated_at = now()
     where id = v_old_credit.referrer_user_id;

    -- Promove credit pra novo type + amount = 20
    update public.referral_credits
       set type = 'paid_bonus',
           amount = 20
     where id = v_old_credit.id;

    v_total_upgraded := v_total_upgraded + 1;
  end loop;

  raise notice '[backfill] Upgrade carousels_bonus → paid_bonus: % rows. Cada referrer ganhou +% no usage_limit', v_total_upgraded, v_diff;
end$$;

-- ============================================================
-- BACKFILL 2: Activation bonus retroativo
--   Para cada referral pending/signup/converted onde o referee criou
--   ao menos 1 carrossel, gera credit type='activation_bonus' = 5
--   carrosséis e incrementa usage_limit do referrer.
-- ============================================================
do $$
declare
  v_ref record;
  v_amount int := 5;
  v_total_activated int := 0;
  v_inserted_id uuid;
begin
  for v_ref in
    select r.id as referral_id,
           r.referrer_user_id,
           r.referred_user_id
      from public.referrals r
      join public.profiles p on p.id = r.referred_user_id
     where r.referred_user_id is not null
       and r.referrer_user_id is not null
       and r.status in ('signup', 'converted')
       and coalesce(p.usage_count, 0) >= 1
       -- Garante que ainda não tem credit de ativação pra esse referee
       and not exists (
         select 1 from public.referral_credits c
          where c.referred_user_id = r.referred_user_id
            and c.type = 'activation_bonus'
       )
  loop
    -- Insert defensivo: se outra execução paralela inseriu primeiro, unique
    -- violation simplesmente pula esse referee.
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
        v_ref.referrer_user_id,
        v_ref.referred_user_id,
        v_ref.referral_id,
        'activation_bonus',
        v_amount,
        null,
        null
      )
      returning id into v_inserted_id;

      update public.profiles
         set usage_limit = coalesce(usage_limit, 0) + v_amount,
             updated_at = now()
       where id = v_ref.referrer_user_id;

      v_total_activated := v_total_activated + 1;
    exception when unique_violation then
      -- Já existia, segue
      null;
    end;
  end loop;

  raise notice '[backfill] Activation bonus retroativo: % credits criados (% carrosséis cada)', v_total_activated, v_amount;
end$$;
