-- MANUAL RELEASE ACTIVATION ONLY.
-- Never run during DEV/RC preparation or before the exact Android OTA and Expo
-- web artifacts have been published and verified against this source.
-- Run with an authorized backend migration operator AFTER client rollout.
-- Database pg_cron schedule is UTC: 16:05 UTC => 00:05 Asia/Manila.
begin;

do $$
begin
  if to_regprocedure('public.buklod_living_generate_birthdays()') is null
    or to_regprocedure('public.buklod_living_dispatch_notifications(integer)') is null
    or to_regprocedure('public.buklod_living_generate_global_events()') is null
    or to_regprocedure('public.buklod_living_dispatch_global_notifications(integer)') is null then
    raise exception 'Living Community schema migration has not been applied';
  end if;
  if not exists (
    select 1 from pg_extension where extname='pg_cron'
  ) then
    raise exception 'pg_cron is unavailable; cannot activate celebrations';
  end if;
  perform cron.schedule('buklod-living-birthdays-r1',
    '5 16 * * *',
    'select public.buklod_living_generate_birthdays()');
  perform cron.schedule('buklod-living-notifications-r1',
    '* * * * *',
    'select public.buklod_living_dispatch_notifications(80)');
  perform cron.schedule('buklod-living-global-generator-r1',
    '*/5 * * * *',
    'select public.buklod_living_generate_global_events()');
  perform cron.schedule('buklod-living-global-delivery-r1',
    '* * * * *',
    'select public.buklod_living_dispatch_global_notifications(100)');
end $$;

-- Today's opt-in birthdays are queued immediately; the limited delivery
-- worker drains the queue asynchronously without blocking transactions.
select public.buklod_living_generate_birthdays();
select public.buklod_living_generate_global_events();

commit;

-- Post-activation verification (read-only):
-- select jobname,schedule,active from cron.job
--   where jobname like 'buklod-living-%-r1';
-- select count(*) from public.buklod_living_network_events
--   where occurred_at >= now() - interval '1 day';
