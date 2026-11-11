-- Read-only production-safe contract test after buklod_today_public_dugtong_idle_rotation_v2.
begin;
do $test$
declare v_definition text;
begin
 if to_regclass('public.buklod_today_tip_cycles_v2') is null or
    to_regclass('public.buklod_today_tip_engagement_v2') is null then
  raise exception 'BUKLOD Today v2 tables missing';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.buklod_today_tip_engagement_v2'::regclass)
 then raise exception 'Dugtong RLS off';end if;
 if has_table_privilege('anon','public.buklod_today_tip_engagement_v2','SELECT') or
    has_table_privilege('authenticated','public.buklod_today_tip_engagement_v2','SELECT') or
    has_table_privilege('authenticated','public.buklod_today_tip_engagement_v2','INSERT') then
  raise exception 'Dugtong bypasses privacy-filtered RPC';
 end if;
 if has_function_privilege('anon','public.react_to_buklod_today_tip_v2(bigint,text,text,text)','EXECUTE') or
    has_function_privilege('anon','public.ensure_buklod_today_tip_cycle_v2()','EXECUTE') then
  raise exception 'Anonymous mutation privileges granted';
 end if;
 if not has_function_privilege('anon','public.get_buklod_today_tip_v2()','EXECUTE') or
    not has_function_privilege('authenticated','public.react_to_buklod_today_tip_v2(bigint,text,text,text)','EXECUTE') then
  raise exception 'Required read/write RPC grants missing';
 end if;
 select pg_get_functiondef('public.ensure_buklod_today_tip_cycle_v2()'::regprocedure) into v_definition;
 if position('72 hours' in v_definition)=0 or
    position('pg_advisory_xact_lock' in v_definition)=0 then
  raise exception 'Idle rotation or race lock missing';
 end if;
 select pg_get_functiondef('public.react_to_buklod_today_tip_v2(bigint,text,text,text)'::regprocedure)
  into v_definition;
 if position('on conflict (user_id, source_key) do nothing' in lower(v_definition))=0 and
    position('on conflict(user_id,source_key) do nothing' in lower(v_definition))=0 then
  raise exception 'Weekly BP ledger idempotency missing';
 end if;
 if exists(
  select 1 from public.buklod_today_tip_engagement_v2 e
    join public.buklod_today_tip_cycles_v2 c on c.id=e.cycle_id
    join public.buklod_weekly_tip_interactions_v1 old
     on old.user_id=e.user_id and old.tip_index=c.tip_index
      and old.dugtong=e.dugtong
   where old.dugtong is not null and e.visibility not in ('public','private')
 ) then raise exception 'Invalid migrated privacy';end if;
end;
$test$;
rollback;
