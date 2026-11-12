-- Preserve strict write-before-check order for each 60-minute capacity sample.
create or replace function private.buklod_backend_capacity_hourly_v4()
returns void language plpgsql security definer set search_path=''
as $body$
begin
  perform private.buklod_record_backend_capacity_v1();
  perform private.buklod_backend_capacity_check_alerts_v2();
end;
$body$;
revoke all on function private.buklod_backend_capacity_hourly_v4() from public,anon,authenticated;
select cron.schedule('buklod-backend-capacity-hourly-v1','17 * * * *',
  'select private.buklod_backend_capacity_hourly_v4()');
