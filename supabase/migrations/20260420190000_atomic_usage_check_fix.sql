-- Fix: OUT params colidiam com nomes de coluna (usage_limit, plan) dentro
-- do UPDATE/SELECT, disparando "column reference is ambiguous". Renomeio
-- pra prefixo `out_` e qualifico as referências de coluna com alias.

drop function if exists public.try_increment_usage_count(uuid);

create or replace function public.try_increment_usage_count(uid uuid)
returns table(
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
begin
  update public.profiles p
     set usage_count = p.usage_count + 1,
         updated_at = now()
   where p.id = uid
     and p.usage_count < p.usage_limit
  returning p.usage_count, p.usage_limit, p.plan
    into v_count, v_limit, v_plan;

  if found then
    out_allowed := true;
    out_new_count := v_count;
    out_usage_limit := v_limit;
    out_plan := v_plan;
    return next;
  else
    select p.usage_count, p.usage_limit, p.plan
      into v_count, v_limit, v_plan
      from public.profiles p
     where p.id = uid;
    out_allowed := false;
    out_new_count := coalesce(v_count, 0);
    out_usage_limit := coalesce(v_limit, 5);
    out_plan := coalesce(v_plan, 'free');
    return next;
  end if;
end;
$$;

grant execute on function public.try_increment_usage_count(uuid) to authenticated, service_role;
