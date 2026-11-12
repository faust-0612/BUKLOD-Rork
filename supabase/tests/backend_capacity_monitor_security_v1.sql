-- BUKLOD capacity monitor security & sampling regression.
-- Run only after migration 20261112013654; transactional and rollback safe.
begin;
do $capacity_guard$
declare
  s integer;
  v_function text;
begin
  if has_function_privilege('anon','public.buklod_admin_backend_capacity_v1()','EXECUTE')
     or not has_function_privilege('authenticated','public.buklod_admin_backend_capacity_v1()','EXECUTE') then
    raise exception 'Admin capacity endpoint has unsafe grants';
  end if;
  if has_table_privilege('anon','private.buklod_backend_capacity_samples_v1','SELECT')
     or has_table_privilege('authenticated','private.buklod_backend_capacity_samples_v1','SELECT') then
    raise exception 'Capacity raw samples readable by app roles';
  end if;
  if not (select prosecdef from pg_proc
          where oid='public.buklod_admin_backend_capacity_v1()'::regprocedure) then
    raise exception 'Capacity endpoint is missing SECURITY DEFINER';
  end if;
  select pg_get_functiondef('public.buklod_admin_backend_capacity_v1()'::regprocedure)
    into v_function;
  if position('not public.is_system_admin()' in v_function)=0
     or position('auth.uid()' in v_function)=0 then
    raise exception 'Capacity endpoint is missing actor authorization';
  end if;
  if not exists (select 1 from cron.job where jobname='buklod-backend-capacity-hourly-v1'
    and active and schedule='17 * * * *') then
    raise exception 'Hourly capacity collection job missing';
  end if;
  select count(*) into s from private.buklod_backend_capacity_samples_v1
    where sampled_at = date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC';
  perform private.buklod_record_backend_capacity_v1();
  perform private.buklod_record_backend_capacity_v1();
  if (select count(*) from private.buklod_backend_capacity_samples_v1
      where sampled_at = date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC') != 1 then
    raise exception 'Hourly capacity collector is not idempotent';
  end if;
  raise notice 'BUKLOD backend capacity security, schedule and sample dedup PASS';
end $capacity_guard$;
rollback;
