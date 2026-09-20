-- BUKLOD_AD_OPERATIONAL_TELEMETRY_V1
-- Operational ad health only. No revenue, payout data, message content,
-- credentials, financial secrets, user ids or advertising identifiers.

create table if not exists private.buklod_ad_operational_events (
  event_key text primary key,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  placement_id text not null,
  event_type text not null check (
    event_type in (
      'ad_request',
      'ad_loaded',
      'ad_rendered',
      'ad_impression',
      'ad_failed',
      'ad_dismissed',
      'ad_opened'
    )
  ),
  provider text not null check (
    provider in ('ADMOB_NATIVE','ADSENSE_WEB','BUKLOD_SPONSOR')
  ),
  platform text not null,
  route text not null,
  app_version text,
  build_version text,
  runtime_version text,
  session_id text not null,
  error_category text,
  event_count integer not null default 1
    check (event_count between 1 and 1000),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_buklod_ad_ops_placement_time
  on private.buklod_ad_operational_events(
    placement_id,
    occurred_at desc
  );

create index if not exists idx_buklod_ad_ops_event_time
  on private.buklod_ad_operational_events(
    event_type,
    occurred_at desc
  );

create index if not exists idx_buklod_ad_ops_version_time
  on private.buklod_ad_operational_events(
    app_version,
    build_version,
    occurred_at desc
  );

create or replace function public.record_buklod_ad_operational_events_v1(
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_count integer:=0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_events)<>'array' then
    raise exception 'Event batch must be an array';
  end if;

  if jsonb_array_length(p_events)>25 then
    raise exception 'Event batch exceeds 25 aggregate rows';
  end if;

  insert into private.buklod_ad_operational_events(
    event_key,
    occurred_at,
    placement_id,
    event_type,
    provider,
    platform,
    route,
    app_version,
    build_version,
    runtime_version,
    session_id,
    error_category,
    event_count,
    metadata
  )
  select
    left(coalesce(nullif(btrim(e->>'event_key'),''),gen_random_uuid()::text),120),
    case
      when coalesce(e->>'occurred_at','') ~ '^20[0-9]{2}-'
        then (e->>'occurred_at')::timestamptz
      else now()
    end,
    left(coalesce(nullif(btrim(e->>'placement_id'),''),'unknown'),80),
    case
      when e->>'event_type' in (
        'ad_request','ad_loaded','ad_rendered','ad_impression',
        'ad_failed','ad_dismissed','ad_opened'
      ) then e->>'event_type'
      else 'ad_failed'
    end,
    case
      when e->>'provider' in ('ADMOB_NATIVE','ADSENSE_WEB','BUKLOD_SPONSOR')
        then e->>'provider'
      else 'ADMOB_NATIVE'
    end,
    left(coalesce(nullif(btrim(e->>'platform'),''),'unknown'),24),
    left(split_part(split_part(coalesce(e->>'route','/'),'?',1),'#',1),180),
    nullif(left(btrim(coalesce(e->>'app_version','')),40),''),
    nullif(left(btrim(coalesce(e->>'build_version','')),40),''),
    nullif(left(btrim(coalesce(e->>'runtime_version','')),80),''),
    left(coalesce(nullif(btrim(e->>'session_id'),''),'unknown'),100),
    nullif(left(btrim(coalesce(e->>'error_category','')),80),''),
    greatest(1,least(coalesce((e->>'event_count')::integer,1),1000)),
    coalesce(e->'metadata','{}'::jsonb)
      - 'user_id'
      - 'email'
      - 'mobile'
      - 'message'
      - 'password'
      - 'financial'
      - 'payout'
  from jsonb_array_elements(p_events) e
  on conflict (event_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

create or replace function public.admin_get_buklod_ad_health_v1(
  p_since timestamptz default (now()-interval '24 hours')
)
returns table(
  placement_id text,
  provider text,
  platform text,
  requests bigint,
  loaded bigint,
  rendered bigint,
  impressions bigint,
  failures bigint,
  show_rate_pct numeric,
  request_to_impression_pct numeric,
  legacy_traffic boolean
)
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  if not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  return query
  select
    e.placement_id,
    e.provider,
    e.platform,
    coalesce(sum(e.event_count) filter(where e.event_type='ad_request'),0)::bigint,
    coalesce(sum(e.event_count) filter(where e.event_type='ad_loaded'),0)::bigint,
    coalesce(sum(e.event_count) filter(where e.event_type='ad_rendered'),0)::bigint,
    coalesce(sum(e.event_count) filter(where e.event_type='ad_impression'),0)::bigint,
    coalesce(sum(e.event_count) filter(where e.event_type='ad_failed'),0)::bigint,
    round(
      case
        when coalesce(sum(e.event_count) filter(where e.event_type='ad_loaded'),0)=0
          then 0
        else 100.0*
          coalesce(sum(e.event_count) filter(where e.event_type='ad_impression'),0)/
          sum(e.event_count) filter(where e.event_type='ad_loaded')
      end,
      2
    ),
    round(
      case
        when coalesce(sum(e.event_count) filter(where e.event_type='ad_request'),0)=0
          then 0
        else 100.0*
          coalesce(sum(e.event_count) filter(where e.event_type='ad_impression'),0)/
          sum(e.event_count) filter(where e.event_type='ad_request')
      end,
      2
    ),
    e.placement_id='legacy_home_banner'
  from private.buklod_ad_operational_events e
  where e.occurred_at>=coalesce(p_since,now()-interval '24 hours')
  group by e.placement_id,e.provider,e.platform
  order by e.placement_id,e.provider,e.platform;
end
$function$;

revoke all on table private.buklod_ad_operational_events
  from public,anon,authenticated;

revoke execute on function public.record_buklod_ad_operational_events_v1(jsonb)
  from public,anon,authenticated;
grant execute on function public.record_buklod_ad_operational_events_v1(jsonb)
  to authenticated;

revoke execute on function public.admin_get_buklod_ad_health_v1(timestamptz)
  from public,anon,authenticated;
grant execute on function public.admin_get_buklod_ad_health_v1(timestamptz)
  to authenticated;
