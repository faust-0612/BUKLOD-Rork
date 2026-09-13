-- BUKLOD Community Help / Emergency SOS R1
-- Public Community Wall safety layer. Exact coordinates stay server-side.

create table if not exists public.buklod_help_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  safety_alerts_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_help_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('HELP','EMERGENCY')),
  category text not null check (category in ('GENERAL','MEDICAL','FIRE','ACCIDENT','SAFETY','DISASTER','MISSING_PERSON','OTHER')),
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RESOLVED','CANCELLED','EXPIRED')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_km double precision not null default 5 check (radius_km > 0 and radius_km <= 25),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz null
);
create index if not exists buklod_help_requests_active_idx
  on public.buklod_help_requests(status, created_at desc);
create index if not exists buklod_help_requests_creator_idx
  on public.buklod_help_requests(creator_id, status, created_at desc);

create table if not exists public.buklod_help_responses (
  request_id uuid not null references public.buklod_help_requests(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  response_type text not null check (response_type in ('CAN_HELP','ON_MY_WAY','CONFIRM_INCIDENT','CANNOT_HELP','FALSE_ALERT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (request_id, responder_id)
);
create index if not exists buklod_help_responses_request_idx
  on public.buklod_help_responses(request_id, updated_at desc);

-- Service-role-only ledger. It prevents accidental duplicate SOS fan-out.
create table if not exists public.buklod_help_alert_dispatches (
  request_id uuid primary key references public.buklod_help_requests(id) on delete cascade,
  radius_km double precision not null check (radius_km in (1,3,5)),
  status text not null default 'PROCESSING' check (status in ('PROCESSING','SENT','FAILED')),
  recipients_count integer not null default 0 check (recipients_count >= 0),
  pushes_count integer not null default 0 check (pushes_count >= 0),
  last_error text null,
  updated_at timestamptz not null default now(),
  dispatched_at timestamptz null
);

create table if not exists public.buklod_help_alert_deliveries (
  request_id uuid not null references public.buklod_help_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  distance_km double precision not null check (distance_km >= 0),
  push_sent_at timestamptz null,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists buklod_help_alert_deliveries_user_idx
  on public.buklod_help_alert_deliveries(user_id, created_at desc);

alter table public.buklod_help_presence enable row level security;
alter table public.buklod_help_requests enable row level security;
alter table public.buklod_help_responses enable row level security;
alter table public.buklod_help_alert_dispatches enable row level security;
alter table public.buklod_help_alert_deliveries enable row level security;

-- Raw location is readable only by its owner. Nearby discovery is RPC-only.
drop policy if exists buklod_help_presence_own on public.buklod_help_presence;
create policy buklod_help_presence_own on public.buklod_help_presence
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A creator may inspect only their own raw request row. Nearby users use the safe RPC below.
drop policy if exists buklod_help_requests_creator_select on public.buklod_help_requests;
create policy buklod_help_requests_creator_select on public.buklod_help_requests
  for select to authenticated using (creator_id = auth.uid());
drop policy if exists buklod_help_requests_creator_insert on public.buklod_help_requests;
create policy buklod_help_requests_creator_insert on public.buklod_help_requests
  for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists buklod_help_requests_creator_update on public.buklod_help_requests;
create policy buklod_help_requests_creator_update on public.buklod_help_requests
  for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists buklod_help_responses_own_select on public.buklod_help_responses;
create policy buklod_help_responses_own_select on public.buklod_help_responses
  for select to authenticated using (responder_id = auth.uid());
drop policy if exists buklod_help_responses_own_write on public.buklod_help_responses;
create policy buklod_help_responses_own_write on public.buklod_help_responses
  for all to authenticated using (responder_id = auth.uid()) with check (responder_id = auth.uid());

-- No authenticated client policy is created for dispatch/delivery ledgers.
-- They are intentionally service-role-only.

create or replace function public.buklod_help_distance_km(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
) returns double precision
language sql immutable parallel safe
as $$
  select 6371.0 * 2.0 * asin(
    least(1.0, sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2.0), 2) +
      cos(radians(p_lat1)) * cos(radians(p_lat2)) *
      power(sin(radians(p_lon2 - p_lon1) / 2.0), 2)
    ))
  );
$$;

create or replace function public.buklod_help_update_presence(
  p_latitude double precision,
  p_longitude double precision,
  p_enabled boolean default true
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'INVALID_LOCATION';
  end if;
  insert into public.buklod_help_presence(user_id, latitude, longitude, safety_alerts_enabled, updated_at)
  values(auth.uid(), p_latitude, p_longitude, coalesce(p_enabled,true), now())
  on conflict(user_id) do update set
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    safety_alerts_enabled=excluded.safety_alerts_enabled,
    updated_at=now();
end;
$$;

create or replace function public.buklod_help_disable_presence()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.buklod_help_presence where user_id=auth.uid();
end;
$$;

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
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_kind not in ('HELP','EMERGENCY') then raise exception 'INVALID_KIND'; end if;
  if v_category not in ('GENERAL','MEDICAL','FIRE','ACCIDENT','SAFETY','DISASTER','MISSING_PERSON','OTHER') then raise exception 'INVALID_CATEGORY'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'INVALID_LOCATION'; end if;

  if v_kind='EMERGENCY' and exists(
    select 1 from public.buklod_help_requests
    where creator_id=auth.uid() and kind='EMERGENCY' and status='ACTIVE' and expires_at>now()
  ) then raise exception 'ACTIVE_EMERGENCY_EXISTS'; end if;
  if exists(
    select 1 from public.buklod_help_requests
    where creator_id=auth.uid() and created_at > now() - interval '20 seconds'
  ) then raise exception 'PLEASE_WAIT_BEFORE_SENDING_AGAIN'; end if;

  insert into public.buklod_help_requests(
    creator_id,kind,category,message,latitude,longitude,radius_km,expires_at
  ) values(
    auth.uid(),v_kind,v_category,left(coalesce(p_message,''),500),p_latitude,p_longitude,
    case when v_kind='EMERGENCY' then 5.0 else 3.0 end,
    now() + case when v_kind='EMERGENCY' then interval '2 hours' else interval '12 hours' end
  ) returning id into v_id;

  perform public.buklod_help_update_presence(p_latitude,p_longitude,true);
  return v_id;
end;
$$;

create or replace function public.buklod_help_list_nearby(
  p_limit integer default 12
) returns table(
  id uuid,
  creator_id uuid,
  kind text,
  category text,
  message text,
  status text,
  distance_km double precision,
  created_at timestamptz,
  expires_at timestamptz,
  can_help_count bigint,
  on_my_way_count bigint,
  confirm_count bigint,
  my_response text
)
language plpgsql security definer set search_path = public
as $$
declare
  v_lat double precision;
  v_lon double precision;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.latitude,p.longitude into v_lat,v_lon
  from public.buklod_help_presence p
  where p.user_id=auth.uid()
    and p.safety_alerts_enabled=true
    and p.updated_at > now()-interval '60 minutes';
  if v_lat is null then return; end if;

  return query
  with nearby as (
    select r.*,
      public.buklod_help_distance_km(v_lat,v_lon,r.latitude,r.longitude) as d
    from public.buklod_help_requests r
    where r.status='ACTIVE' and r.expires_at>now()
  )
  select n.id,n.creator_id,n.kind,n.category,n.message,n.status,
    round(n.d::numeric,1)::double precision as distance_km,n.created_at,n.expires_at,
    count(*) filter(where rr.response_type='CAN_HELP'),
    count(*) filter(where rr.response_type='ON_MY_WAY'),
    count(*) filter(where rr.response_type='CONFIRM_INCIDENT'),
    max(rr.response_type) filter(where rr.responder_id=auth.uid())
  from nearby n
  left join public.buklod_help_responses rr on rr.request_id=n.id
  where n.creator_id=auth.uid() or n.d <= n.radius_km
  group by n.id,n.creator_id,n.kind,n.category,n.message,n.status,n.d,n.created_at,n.expires_at
  order by (n.kind='EMERGENCY') desc,n.created_at desc
  limit greatest(1,least(coalesce(p_limit,12),30));
end;
$$;

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
  if v_type not in ('CAN_HELP','ON_MY_WAY','CONFIRM_INCIDENT','CANNOT_HELP','FALSE_ALERT') then raise exception 'INVALID_RESPONSE'; end if;

  select * into v_request from public.buklod_help_requests
  where id=p_request_id and status='ACTIVE' and expires_at>now();
  if not found then raise exception 'REQUEST_NOT_ACTIVE'; end if;
  if v_request.creator_id=auth.uid() then raise exception 'CREATOR_CANNOT_RESPOND'; end if;

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
  on conflict(request_id,responder_id) do update set response_type=excluded.response_type,updated_at=now();
end;
$$;

create or replace function public.buklod_help_resolve(
  p_request_id uuid,
  p_status text default 'RESOLVED'
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_status text := upper(trim(coalesce(p_status,'RESOLVED')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_status not in ('RESOLVED','CANCELLED') then raise exception 'INVALID_STATUS'; end if;
  update public.buklod_help_requests set status=v_status,resolved_at=now()
  where id=p_request_id and creator_id=auth.uid() and status='ACTIVE';
  if not found then raise exception 'REQUEST_NOT_FOUND_OR_NOT_OWNER'; end if;
end;
$$;

revoke all on function public.buklod_help_update_presence(double precision,double precision,boolean) from public;
revoke all on function public.buklod_help_disable_presence() from public;
revoke all on function public.buklod_help_create_request(text,text,text,double precision,double precision) from public;
revoke all on function public.buklod_help_list_nearby(integer) from public;
revoke all on function public.buklod_help_respond(uuid,text) from public;
revoke all on function public.buklod_help_resolve(uuid,text) from public;
grant execute on function public.buklod_help_update_presence(double precision,double precision,boolean) to authenticated;
grant execute on function public.buklod_help_disable_presence() to authenticated;
grant execute on function public.buklod_help_create_request(text,text,text,double precision,double precision) to authenticated;
grant execute on function public.buklod_help_list_nearby(integer) to authenticated;
grant execute on function public.buklod_help_respond(uuid,text) to authenticated;
grant execute on function public.buklod_help_resolve(uuid,text) to authenticated;
