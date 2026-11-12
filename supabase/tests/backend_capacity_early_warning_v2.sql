-- Read-only, rollback-safe contract. Never inject synthetic warning samples.
begin;
do $test$
declare body text;
begin
 if has_function_privilege('anon','public.buklod_admin_backend_capacity_alert_v2()','EXECUTE') then
   raise exception 'Alert information exposed to anonymous users';
 end if;
 if has_table_privilege('authenticated','private.buklod_backend_capacity_alert_state_v2','SELECT')
   or has_function_privilege('authenticated','private.buklod_backend_capacity_check_alerts_v2()','EXECUTE') then
   raise exception 'Private warning state or scheduler is exposed to clients';
 end if;
 if not exists(select 1 from cron.job
   where jobname='buklod-backend-capacity-hourly-v1' and active
   and schedule='17 * * * *'
   and command = 'select private.buklod_backend_capacity_hourly_v4()') then
   raise exception 'Single hourly warning job missing';
 end if;
 select pg_get_functiondef('private.buklod_backend_capacity_check_alerts_v2()'::regprocedure) into body;
 if position('v_last6 = 6 and v_high6 = 6' in body)=0
   or position('v_last3 = 3 and v_low3 = 3' in body)=0
   or position('OFFICIAL_SYSTEM_ADMIN' in body)=0
   or position('buklod_queue_notification_once_v1' in body)=0 then
   raise exception 'Early warning, recovery, official recipient or dedupe logic missing';
 end if;
 if position('''route'',''/admin/backend-capacity''' in body)=0 then
   raise exception 'Notification deep-link route missing';
 end if;
 if (select count(*) from private.buklod_backend_capacity_alert_state_v2 where id=1)<>1 then
   raise exception 'Alert singleton missing';
 end if;
 raise notice 'Backend capacity early-warning contract PASS';
end $test$;
rollback;
