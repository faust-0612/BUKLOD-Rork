-- Canonical production migration version 20261112021134.
-- The only notification recipients are protected active official System Admin identities.
-- Sustained alert thresholds are informational and cannot resize compute.
create table if not exists private.buklod_backend_capacity_alert_state_v2 (
 id integer primary key check (id = 1),
 level text not null default 'normal' check (level in ('normal','watch','review')),
 episode_id uuid not null default gen_random_uuid(),
 changed_at timestamptz not null default now(),
 last_notified_at timestamptz
);
alter table private.buklod_backend_capacity_alert_state_v2 enable row level security;
revoke all on private.buklod_backend_capacity_alert_state_v2 from public, anon, authenticated;
insert into private.buklod_backend_capacity_alert_state_v2 (id) values (1) on conflict (id) do nothing;

CREATE OR REPLACE FUNCTION private.buklod_backend_capacity_check_alerts_v2()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_hour timestamptz := date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC';
 v_last6 integer;
 v_high6 integer;
 v_watch6 integer;
 v_last3 integer;
 v_low3 integer;
 v_new text := 'unchanged';
 v_old text;
 v_episode uuid;
 v_affected integer;
 v_pct numeric;
 v_admin uuid;
begin
 select count(*)::integer,
        count(*) filter (where (100.0 * connections_total / nullif(connections_max,0)) >= 80)::integer,
        count(*) filter (where (100.0 * connections_total / nullif(connections_max,0)) >= 65)::integer
 into v_last6,v_high6,v_watch6
 from private.buklod_backend_capacity_samples_v1
 where sampled_at between v_hour - interval '5 hours' and v_hour;
 select count(*)::integer,
        count(*) filter (where (100.0 * connections_total / nullif(connections_max,0)) < 55)::integer
 into v_last3,v_low3
 from private.buklod_backend_capacity_samples_v1
 where sampled_at between v_hour - interval '2 hours' and v_hour;

 if v_last6 = 6 and v_high6 = 6 then v_new := 'review';
 elsif v_last6 = 6 and v_watch6 = 6 then v_new := 'watch';
 elsif v_last3 = 3 and v_low3 = 3 then v_new := 'normal';
 end if;
 if v_new = 'unchanged' then return v_new; end if;

 insert into private.buklod_backend_capacity_alert_state_v2 (id)
 values (1) on conflict (id) do nothing;
 select level into v_old
 from private.buklod_backend_capacity_alert_state_v2 where id=1 for update;
 if v_new = v_old then return v_new; end if;

 v_episode := gen_random_uuid();
 update private.buklod_backend_capacity_alert_state_v2
 set level=v_new,episode_id=v_episode,changed_at=now(),
     last_notified_at=case when v_new in ('watch','review') then now()
                           else last_notified_at end
 where id=1;

 if v_new in ('watch','review') and
    (v_old = 'normal' or (v_old='watch' and v_new='review')) then
   select connections_total * 100.0 / nullif(connections_max,0)
     into v_pct
     from private.buklod_backend_capacity_samples_v1
     where sampled_at=v_hour;
   for v_admin in
      select pp.user_id
      from public.buklod_foundation_protected_principals pp
      join public.profiles pr on pr.id=pp.user_id
      where pp.principal_key='OFFICIAL_SYSTEM_ADMIN'
      and pp.protected=true and pr.is_active=true
   loop
     perform public.buklod_queue_notification_once_v1(
       v_admin,
       case when v_new='review' then 'BUKLOD backend capacity review' else 'BUKLOD backend capacity watch' end,
       format('Connection slots stayed at %s or higher for six hourly samples (latest %s%%). Review pooling and queries before considering paid compute.',
         case when v_new='review' then '80%' else '65%' end,
         round(coalesce(v_pct,0),1)),
       'admin_backend_capacity',
       jsonb_build_object('path','/admin/backend-capacity','screen','backend-capacity','level',v_new,'sampled_hour',v_hour),
       'backend-capacity-v2:'||v_episode::text||':'||v_new
     );
   end loop;
 end if;
 return v_new;
end;
$function$

revoke all on function private.buklod_backend_capacity_check_alerts_v2() from public,anon,authenticated;

select cron.schedule(
 'buklod-backend-capacity-hourly-v1','17 * * * *',
 'select private.buklod_record_backend_capacity_v1(), private.buklod_backend_capacity_check_alerts_v2()'
);

CREATE OR REPLACE FUNCTION public.buklod_admin_backend_capacity_alert_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_state jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
   raise exception 'System administrator access required' using errcode='42501';
 end if;
 select jsonb_build_object('level',level,'changed_at',changed_at,
                         'last_notified_at',last_notified_at)
 into v_state from private.buklod_backend_capacity_alert_state_v2 where id=1;
 return coalesce(v_state, jsonb_build_object('level','normal'));
end;
$function$

revoke all on function public.buklod_admin_backend_capacity_alert_v2() from public,anon,authenticated;
grant execute on function public.buklod_admin_backend_capacity_alert_v2() to authenticated;
