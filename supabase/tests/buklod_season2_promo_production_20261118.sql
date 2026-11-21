-- Read-only focused regression for the approved Season 2 promotional campaign.
-- Run AFTER applying buklod_season2_production_promos_2026; no notification is sent.
do $test$
declare
  v_count integer;
  v_expected timestamptz[];
  v_actual timestamptz[];
begin
  select count(*), array_agg(scheduled_at order by scheduled_at)
  into v_count,v_actual
  from private.buklod_s2_promo_events_2026;
  v_expected:=array[
    timestamptz '2026-11-22 10:00+08',
    timestamptz '2026-11-29 10:00+08',
    timestamptz '2026-12-03 10:00+08',
    timestamptz '2026-12-05 10:00+08',
    timestamptz '2026-12-06 10:00+08'
  ];
  if v_count<>5 or v_actual is distinct from v_expected then
    raise exception 'Unexpected owner-approved Season2 announcement schedule';
  end if;
  if has_function_privilege('anon','private.buklod_s2_promo_tick_2026()','EXECUTE')
     or has_function_privilege('authenticated','private.buklod_s2_promo_tick_2026()','EXECUTE') then
    raise exception 'Season2 marketing scheduler is public';
  end if;
  if exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private'
      and c.relname in (
        'buklod_s2_promo_events_2026',
        'buklod_s2_promo_home_state_2026',
        'buklod_s2_promo_deliveries_2026'
      ) and not c.relrowsecurity
  ) then raise exception 'Season2 marketing private table lacks RLS';end if;
  if current_timestamp < timestamptz '2026-11-22 10:00+08' and
    exists(select 1 from private.buklod_s2_promo_events_2026 where published_at is not null) then
    raise exception 'Campaign prematurely published';
  end if;
  if current_timestamp < timestamptz '2026-12-08 10:00+08' and not exists(
    select 1 from cron.job where jobname='buklod-season2-production-promos-2026' and active=true
  ) then raise exception 'Expected enabled Season2 promo cron';end if;
end;
$test$;
