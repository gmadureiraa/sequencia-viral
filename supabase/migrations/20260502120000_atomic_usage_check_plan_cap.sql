-- Defense in depth pra cap evasion (2026-05-02): a versao anterior da RPC
-- so comparava `usage_count < usage_limit`. Users grandfathered com
-- usage_limit antigo (300, 100) bypassavam o cap atual de 30 do plano
-- business porque a RPC ainda permitia o increment. O fix em
-- app/api/generate/route.ts ja faz o pre-check, mas adicionamos aqui o
-- cap por plano direto na RPC pra garantir que qualquer caminho de
-- chamada (presente ou futuro) respeite o limite real do pricing.ts.
--
-- Caps espelhados de lib/pricing.ts em 2026-05-02:
--   business → 30
--   pro      → 10
--   free     → 5
-- Quando esses valores mudarem, atualizar essa funcao tambem (manter SQL
-- e TS em sync e parte do checklist de mudanca de pricing).

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
  v_plan_cap int;
  v_effective_limit int;
begin
  -- Carrega plano e cap atual antes de tentar o update.
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

  -- Cap do plano (espelha lib/pricing.ts). Se o profile tiver
  -- usage_limit maior que o cap (legado/grandfathered), usa o cap.
  v_plan_cap := case coalesce(v_plan, 'free')
                  when 'business' then 30
                  when 'pro'      then 10
                  else 5
                end;
  v_effective_limit := least(coalesce(v_limit, 5), v_plan_cap);

  -- Update condicional: so incrementa se ainda esta dentro do cap real.
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
    -- Bloqueado pelo cap real. Devolve o cap efetivo (nao o usage_limit
    -- bruto) pra que o front mostre a mensagem certa.
    out_allowed := false;
    out_new_count := coalesce(v_count, 0);
    out_usage_limit := v_effective_limit;
    out_plan := coalesce(v_plan, 'free');
    return next;
  end if;
end;
$$;

grant execute on function public.try_increment_usage_count(uuid) to authenticated, service_role;
