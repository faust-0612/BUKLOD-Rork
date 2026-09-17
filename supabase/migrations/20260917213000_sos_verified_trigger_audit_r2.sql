-- BUKLOD SOS Verified Trigger Audit R2
-- Backward-compatible: keeps the existing RPC signature while recording
-- authenticated-session identity plus client trigger/auth assurance metadata.

alter table public.buklod_help_requests
  add column if not exists trigger_source text null,
  add column if not exists identity_verification text null,
  add column if not exists client_platform text null,
  add column if not exists device_installation_hash text null,
  add column if not exists location_accuracy_m double precision null;

comment on column public.buklod_help_requests.trigger_source is
  'Client-declared source of the SOS initiation. Server identity remains auth.uid().';
comment on column public.buklod_help_requests.identity_verification is
  'Client device-auth assurance used immediately before SOS dispatch. Not a server biometric artifact.';
comment on column public.buklod_help_requests.device_installation_hash is
  'One-way pseudonymous hash of the device-local installation identifier for abuse review and trace continuity.';

create or replace function public.buklod_help_create_request(
  p_kind text,
  p_category text,
  p_message text,
  p_latitude double precision,
  p_longitude double precision
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_kind text := upper(trim(coalesce(p_kind,'')));
  v_category text := upper(trim(coalesce(p_category,'')));
  v_headers jsonb := '{}'::jsonb;
  v_trigger_source text := 'IN_APP';
  v_identity_verification text := 'SESSION_ONLY';
  v_client_platform text := null;
  v_installation_id text := null;
  v_location_accuracy double precision := null;
  v_accuracy_raw text := null;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_kind not in ('HELP','EMERGENCY') then raise exception 'INVALID_KIND'; end if;
  if v_category not in ('GENERAL','MEDICAL','FIRE','ACCIDENT','SAFETY','DISASTER','MISSING_PERSON','OTHER') then raise exception 'INVALID_CATEGORY'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'INVALID_LOCATION'; end if;

  begin
    v_headers := coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  if v_kind = 'EMERGENCY' then
    v_trigger_source := upper(trim(coalesce(v_headers->>'x-buklod-emergency-trigger-source','IN_APP')));
    if v_trigger_source not in ('IN_APP','QUICK_TILE','LOCKSCREEN_ACTION','APP_SHORTCUT','DEEP_LINK','UNKNOWN') then
      v_trigger_source := 'UNKNOWN';
    end if;

    v_identity_verification := upper(trim(coalesce(v_headers->>'x-buklod-emergency-verification','SESSION_ONLY')));
    if v_identity_verification not in ('LOCAL_DEVICE_AUTH','DEVICE_AUTH_UNAVAILABLE','SESSION_ONLY') then
      v_identity_verification := 'SESSION_ONLY';
    end if;

    v_client_platform := left(nullif(trim(coalesce(v_headers->>'x-buklod-client-platform','')), ''), 32);
    v_installation_id := left(nullif(trim(coalesce(v_headers->>'x-buklod-installation-id','')), ''), 160);
    v_accuracy_raw := trim(coalesce(v_headers->>'x-buklod-location-accuracy-m',''));

    if v_accuracy_raw ~ '^[0-9]+([.][0-9]+)?$' then
      v_location_accuracy := least(100000.0, greatest(0.0, v_accuracy_raw::double precision));
    end if;
  end if;

  if v_kind='EMERGENCY' and exists(
    select 1 from public.buklod_help_requests
    where creator_id=auth.uid() and kind='EMERGENCY' and status='ACTIVE' and expires_at>now()
  ) then raise exception 'ACTIVE_EMERGENCY_EXISTS'; end if;

  if exists(
    select 1 from public.buklod_help_requests
    where creator_id=auth.uid() and created_at > now() - interval '20 seconds'
  ) then raise exception 'PLEASE_WAIT_BEFORE_SENDING_AGAIN'; end if;

  insert into public.buklod_help_requests(
    creator_id,
    kind,
    category,
    message,
    latitude,
    longitude,
    radius_km,
    expires_at,
    trigger_source,
    identity_verification,
    client_platform,
    device_installation_hash,
    location_accuracy_m
  ) values(
    auth.uid(),
    v_kind,
    v_category,
    left(coalesce(p_message,''),500),
    p_latitude,
    p_longitude,
    case when v_kind='EMERGENCY' then 5.0 else 3.0 end,
    now() + case when v_kind='EMERGENCY' then interval '2 hours' else interval '12 hours' end,
    case when v_kind='EMERGENCY' then v_trigger_source else null end,
    case when v_kind='EMERGENCY' then v_identity_verification else null end,
    case when v_kind='EMERGENCY' then v_client_platform else null end,
    case
      when v_kind='EMERGENCY' and v_installation_id is not null
        then md5(v_installation_id)
      else null
    end,
    case when v_kind='EMERGENCY' then v_location_accuracy else null end
  ) returning id into v_id;

  perform public.buklod_help_update_presence(p_latitude,p_longitude,true);
  return v_id;
end;
$$;

revoke all on function public.buklod_help_create_request(text,text,text,double precision,double precision) from public;
revoke all on function public.buklod_help_create_request(text,text,text,double precision,double precision) from anon;
grant execute on function public.buklod_help_create_request(text,text,text,double precision,double precision) to authenticated;
