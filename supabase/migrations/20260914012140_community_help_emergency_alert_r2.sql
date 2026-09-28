-- BUKLOD Community Help / Emergency SOS R2
-- Source-synced to the already-applied production migration version 20260914012140.
-- Additive emergency-alert layer over the locked R1 baseline.
-- Existing emergencies are grandfathered; reminder delivery starts disabled.

create table if not exists private.buklod_help_emergency_alert_r2_state (
  singleton boolean primary key default true check (singleton),
  activated_at timestamptz not null default now(),
  reminders_enabled boolean not null default false
);

insert into private.buklod_help_emergency_alert_r2_state(singleton,activated_at,reminders_enabled)
values(true,now(),false)
on conflict(singleton) do nothing;

revoke all on table private.buklod_help_emergency_alert_r2_state from public;
revoke all on table private.buklod_help_emergency_alert_r2_state from anon;
revoke all on table private.buklod_help_emergency_alert_r2_state from authenticated;

alter table public.device_tokens
  add column if not exists emergency_alert_mode_version integer not null default 1;

alter table public.device_tokens
  drop constraint if exists device_tokens_emergency_alert_mode_version_check;
alter table public.device_tokens
  add constraint device_tokens_emergency_alert_mode_version_check
  check (emergency_alert_mode_version >= 1);

create or replace function public.mark_device_emergency_alert_mode_r2(
  p_expo_push_token text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := nullif(btrim(p_expo_push_token), '');
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_token is null then raise exception 'PUSH_TOKEN_REQUIRED'; end if;

  update public.device_tokens
  set emergency_alert_mode_version=greatest(coalesce(emergency_alert_mode_version,1),2),
      updated_at=now()
  where expo_push_token=v_token
    and user_id=v_user_id;

  if not found then raise exception 'DEVICE_TOKEN_NOT_OWNED'; end if;
end;
$$;

revoke all on function public.mark_device_emergency_alert_mode_r2(text) from public;
revoke all on function public.mark_device_emergency_alert_mode_r2(text) from anon;
grant execute on function public.mark_device_emergency_alert_mode_r2(text) to authenticated;

alter table public.buklod_help_responses
  drop constraint if exists buklod_help_responses_response_type_check;

alter table public.buklod_help_responses
  add constraint buklod_help_responses_response_type_check
  check (response_type in (
    'ACKNOWLEDGED',
    'CAN_HELP',
    'ON_MY_WAY',
    'CONFIRM_INCIDENT',
    'CANNOT_HELP',
    'FALSE_ALERT'
  ));

create or replace function public.buklod_help_respond(
  p_request_id uuid,
  p_response_type text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_type text := upper(trim(coalesce(p_response_type,'')));
  v_request public.buklod_help_requests%rowtype;
  v_lat double precision;
  v_lon double precision;
  v_distance double precision;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_type not in ('ACKNOWLEDGED','CAN_HELP','ON_MY_WAY','CONFIRM_INCIDENT','CANNOT_HELP','FALSE_ALERT') then
    raise exception 'INVALID_RESPONSE';
  end if;

  select * into v_request from public.buklod_help_requests
  where id=p_request_id and status='ACTIVE' and expires_at>now();
  if not found then raise exception 'REQUEST_NOT_ACTIVE'; end if;
  if v_request.creator_id=auth.uid() then raise exception 'CREATOR_CANNOT_RESPOND'; end if;

  -- ACKNOWLEDGED confirms receipt/opening only. It never claims current
  -- proximity and never downgrades an existing stronger responder state.
  if v_type='ACKNOWLEDGED' then
    insert into public.buklod_help_responses(request_id,responder_id,response_type,created_at,updated_at)
    values(p_request_id,auth.uid(),v_type,now(),now())
    on conflict(request_id,responder_id) do update
      set response_type=case
            when public.buklod_help_responses.response_type in ('CAN_HELP','ON_MY_WAY','CONFIRM_INCIDENT','CANNOT_HELP','FALSE_ALERT')
              then public.buklod_help_responses.response_type
            else excluded.response_type
          end,
          updated_at=now();
    return;
  end if;

  -- All active-response claims retain the locked R1 fresh-presence/proximity rule.
  select p.latitude,p.longitude into v_lat,v_lon
  from public.buklod_help_presence p
  where p.user_id=auth.uid()
    and p.safety_alerts_enabled=true
    and p.updated_at>now()-interval '60 minutes';
  if v_lat is null then raise exception 'FRESH_LOCATION_REQUIRED'; end if;

  v_distance := public.buklod_help_distance_km(v_lat,v_lon,v_request.latitude,v_request.longitude);
  if v_distance>v_request.radius_km then raise exception 'NOT_WITHIN_ALERT_RADIUS'; end if;

  insert into public.buklod_help_responses(request_id,responder_id,response_type,created_at,updated_at)
  values(p_request_id,auth.uid(),v_type,now(),now())
  on conflict(request_id,responder_id) do update
    set response_type=excluded.response_type,updated_at=now();
end;
$$;

revoke all on function public.buklod_help_respond(uuid,text) from public;
revoke all on function public.buklod_help_respond(uuid,text) from anon;
grant execute on function public.buklod_help_respond(uuid,text) to authenticated;

create index if not exists buklod_help_notifications_request_step_r2_idx
  on public.notifications ((data->>'help_request_id'), (data->>'emergency_reminder_step'))
  where kind='community_emergency';

create or replace function private.buklod_help_enqueue_emergency_reminders_r2()
returns integer
language plpgsql
set search_path = public, private
as $$
declare
  v_inserted integer := 0;
  v_activated_at timestamptz;
  v_reminders_enabled boolean := false;
begin
  select activated_at,reminders_enabled
  into v_activated_at,v_reminders_enabled
  from private.buklod_help_emergency_alert_r2_state
  where singleton=true;

  if not coalesce(v_reminders_enabled,false) then
    return 0;
  end if;

  with due as (
    select
      d.request_id,
      d.user_id,
      d.distance_km,
      r.category,
      case
        when d.created_at <= now() - interval '5 minutes' then 2
        else 1
      end as reminder_step
    from public.buklod_help_alert_deliveries d
    join public.buklod_help_requests r
      on r.id=d.request_id
    left join public.buklod_help_responses rr
      on rr.request_id=d.request_id
     and rr.responder_id=d.user_id
    where r.kind='EMERGENCY'
      and r.status='ACTIVE'
      and r.expires_at>now()
      and r.created_at >= v_activated_at
      and d.created_at <= now() - interval '2 minutes'
      and rr.request_id is null
  ), ready as (
    select due.*
    from due
    where not exists (
      select 1
      from public.notifications n
      where n.user_id=due.user_id
        and n.kind='community_emergency'
        and n.data->>'help_request_id'=due.request_id::text
        and n.data->>'emergency_reminder_step'=due.reminder_step::text
    )
  )
  insert into public.notifications(user_id,title,body,kind,data)
  select
    ready.user_id,
    'EMERGENCY STILL ACTIVE · ' || replace(ready.category,'_',' '),
    'No acknowledgement yet · approximately '
      || round(ready.distance_km::numeric,1)::text
      || ' km away. Open BUKLOD to acknowledge or respond.',
    'community_emergency',
    jsonb_build_object(
      'kind','community_emergency',
      'help_request_id',ready.request_id,
      'category',ready.category,
      'distance_km',round(ready.distance_km::numeric,1),
      'emergency_alert_mode','R2',
      'emergency_reminder_step',ready.reminder_step
    )
  from ready;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function private.buklod_help_enqueue_emergency_reminders_r2() from public;
revoke all on function private.buklod_help_enqueue_emergency_reminders_r2() from anon;
revoke all on function private.buklod_help_enqueue_emergency_reminders_r2() from authenticated;

-- Scheduler is installed now but function returns 0 until reminders_enabled is
-- explicitly enabled after the R2 client OTA has been verified. activated_at
-- permanently excludes emergencies that were already active at R2 cutover.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='buklod-help-emergency-reminders-r2'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'buklod-help-emergency-reminders-r2',
    '* * * * *',
    'select private.buklod_help_enqueue_emergency_reminders_r2();'
  );
end;
$$;