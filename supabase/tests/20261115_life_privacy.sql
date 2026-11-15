-- Run after the LIFE privacy migration in a non-production Supabase test DB.
-- READ ONLY checks; fail closed if legacy v1 notification disclosure returns.
begin;
do $life_privacy$
declare
  v_stage text;
  v_impact text;
begin
  if to_regprocedure('public.buklod_life_mark_my_stage_v1(text)') is null
    or to_regprocedure('public.get_my_buklod_life_impact_v1()') is null then
    raise exception 'LIFE privacy RPC missing';
  end if;
  select lower(pg_get_functiondef(to_regprocedure('public.buklod_life_mark_my_stage_v1(text)'))) into v_stage;
  select lower(pg_get_functiondef(to_regprocedure('public.get_my_buklod_life_impact_v1()'))) into v_impact;
  if position('insert into public.notifications' in v_stage) > 0 then
    raise exception 'LIFE legacy notification leak still active';
  end if;
  if position('backwards-compatible no-op' in v_stage) = 0 then
    raise exception 'LIFE legacy stage writer was not neutralized';
  end if;
  if position('jesus_shared_at' in v_impact) > 0
    or position('walking_together_at' in v_impact) > 0 then
    raise exception 'LIFE inviter impact still infers third-party faith behavior';
  end if;
  if has_function_privilege('anon', 'public.buklod_life_mark_my_stage_v1(text)', 'execute') then
    raise exception 'LIFE stage writer callable by anon';
  end if;
  if has_function_privilege('anon', 'public.get_my_buklod_life_impact_v1()', 'execute') then
    raise exception 'LIFE impact RPC callable by anon';
  end if;
end;
$life_privacy$;
rollback;
