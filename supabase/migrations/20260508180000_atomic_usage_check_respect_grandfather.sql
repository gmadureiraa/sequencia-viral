-- Atualiza try_increment_usage_count: usa GREATEST em vez de LEAST
-- pra respeitar usage_limit do DB quando for MAIOR que plan_cap.
--
-- Motivação (2026-05-08):
--   Gabriel reportou bug — UI mostrava "10/55" mas API bloqueou em 10.
--   profiles.usage_limit=55 (admin override / grandfathered) era ignorado
--   porque LEAST capava em 10 (plan='pro' = Creator).
--
-- Decisão: usage_limit do DB é fonte de verdade quando for >= plan_cap.
-- Casos cobertos:
--   - Grandfathering (cap antigo 100/300 vs cap novo 30/10): respeita
--   - Admin grant manual (gf.madureiraa com 55): respeita
--   - Bonus de referral (somado em usage_limit): respeita (será usado
--     pelo refactor de referral em curso)
--   - User com cap anormalmente baixo (usage_limit < plan_cap): plan_cap
--     vira floor, protege user contra bug de admin
--
-- Mudança: LEAST → GREATEST. Resto da lógica mantida (idempotente).

drop function if exists public.try_increment_usage_count(uuid);

create or replace function public.try_increment_usage_count(uid uuid)
returns table (
  out_allowed boolean,
  out_new_count int,
  out_usage_limit int,
  out_plan text
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_count int;
  v_limit int;
  v_plan text;
  v_plan_cap int;
  v_effective_limit int;
begin
  select p.usage_count, p.usage_limit, p.plan
    into v_count, v_limit, v_plan
    from public.profiles p
   where p.id = uid;

  if not found then
    out_allowed := false;
    out_new_count := 0;
    out_usage_limit := 5;
    out_plan := 'free';
    return next;
    return;
  end if;

  v_plan_cap := case coalesce(v_plan, 'free')
                  when 'business' then 30
                  when 'pro'      then 10
                  else 5
                end;
  -- GREATEST: respeita usage_limit do DB quando for >= plan_cap.
  -- plan_cap funciona como floor (proteção contra cap acidentalmente baixo).
  v_effective_limit := greatest(coalesce(v_limit, 5), v_plan_cap);

  update public.profiles p
     set usage_count = p.usage_count + 1,
         updated_at = now()
   where p.id = uid
     and p.usage_count < v_effective_limit
  returning p.usage_count
    into v_count;

  if found then
    out_allowed := true;
    out_new_count := v_count;
    out_usage_limit := v_effective_limit;
    out_plan := coalesce(v_plan, 'free');
    return next;
  else
    out_allowed := false;
    out_new_count := coalesce(v_count, 0);
    out_usage_limit := v_effective_limit;
    out_plan := coalesce(v_plan, 'free');
    return next;
  end if;
end;
$$;

grant execute on function public.try_increment_usage_count(uuid) to authenticated, service_role;
