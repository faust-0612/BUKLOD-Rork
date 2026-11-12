-- BUKLOD Backend Capacity Monitor V1
-- Backward-compatible, low-frequency sampling; no client writes, no upgrade action.
-- CPU/RAM/provider limits are NOT available from this SQL and must not be guessed.
create table if not exists private.buklod_backend_capacity_samples_v1 (
  sampled_at timestamptz primary key,
  connections_total integer not null,
  connections_active integer not null,
  connections_max integer not null,
  idle_in_transaction integer not null,
  waiting_locks integer not null,
  database_bytes bigint not null
);
alter table private.buklod_backend_capacity_samples_v1 enable row level security;
revoke all on table private.buklod_backend_capacity_samples_v1 from public, anon, authenticated;

create or replace function private.buklod_record_backend_capacity_v1()
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  v_hour timestamptz := date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC';
begin
  -- A stable hour bucket makes overlapping cron/manual execution idempotent.
  insert into private.buklod_backend_capacity_samples_v1 (
    sampled_at, connections_total, connections_active, connections_max,
    idle_in_transaction, waiting_locks, database_bytes
  )
  select v_hour,
    (select count(*)::integer from pg_catalog.pg_stat_activity),
    (select count(*)::integer from pg_catalog.pg_stat_activity where state = 'active'),
    current_setting('max_connections')::integer,
    (select count(*)::integer from pg_catalog.pg_stat_activity where state = 'idle in transaction'),
    (select count(*)::integer from pg_catalog.pg_locks where not granted),
    pg_catalog.pg_database_size(current_database())
  on conflict (sampled_at) do nothing;

  delete from private.buklod_backend_capacity_samples_v1
  where sampled_at < now() - interval '60 days';
end;
$function$;
revoke all on function private.buklod_record_backend_capacity_v1() from public, anon, authenticated;

create or replace function public.buklod_admin_backend_capacity_v1()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_total integer;
  v_active integer;
  v_idle_tx integer;
  v_max integer;
  v_waiting integer;
  v_size bigint;
  v_cache_hit numeric;
  v_samples integer := 0;
  v_recent_samples integer := 0;
  v_recent_high integer := 0;
  v_recent_watch integer := 0;
  v_high_7d numeric;
  v_size_first bigint;
  v_size_last bigint;
  v_history jsonb := '[]'::jsonb;
  v_status text := 'collecting';
  v_reason text := 'Gathering hourly baseline. No upgrade recommendation without provider CPU/RAM and peak-time evidence.';
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System administrator access required' using errcode = '42501';
  end if;

  select count(*)::integer,
         count(*) filter (where state = 'active')::integer,
         count(*) filter (where state = 'idle in transaction')::integer
    into v_total, v_active, v_idle_tx
    from pg_catalog.pg_stat_activity;
  v_max := current_setting('max_connections')::integer;
  select count(*)::integer into v_waiting from pg_catalog.pg_locks where not granted;
  v_size := pg_catalog.pg_database_size(current_database());

  select round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2)
    into v_cache_hit
    from pg_catalog.pg_stat_database where datname = current_database();

  select count(*)::integer, max(round(100.0 * connections_total / nullif(connections_max, 0), 1))
    into v_samples, v_high_7d
    from private.buklod_backend_capacity_samples_v1
    where sampled_at >= now() - interval '7 days';

  select count(*)::integer,
         count(*) filter (where 100.0 * connections_total / nullif(connections_max, 0) >= 80)::integer,
         count(*) filter (where 100.0 * connections_total / nullif(connections_max, 0) >= 65)::integer
    into v_recent_samples, v_recent_high, v_recent_watch
    from (
      select connections_total, connections_max
      from private.buklod_backend_capacity_samples_v1
      where sampled_at >= now() - interval '12 hours'
      order by sampled_at desc limit 6
    ) recent;

  if v_recent_samples >= 6 and v_recent_high = 6 then
    v_status := 'review';
    v_reason := 'Connection slots >=80% for six hourly samples. Investigate pooling and queries; confirm CPU/RAM before scaling.';
  elsif v_recent_samples >= 6 and v_recent_watch = 6 then
    v_status := 'watch';
    v_reason := 'Connection slots >=65% for six hourly samples. Review peak traffic, pooling and client reconnections.';
  elsif v_samples >= 6 then
    v_status := 'normal';
    v_reason := 'No sustained connection-slot alert in the latest six hourly samples. Other resource headroom remains unverified.';
  end if;

  select (select database_bytes from private.buklod_backend_capacity_samples_v1
          where sampled_at >= now() - interval '7 days' order by sampled_at asc limit 1),
         (select database_bytes from private.buklod_backend_capacity_samples_v1
          where sampled_at >= now() - interval '7 days' order by sampled_at desc limit 1)
    into v_size_first, v_size_last;

  select coalesce(jsonb_agg(jsonb_build_object(
    'day', d.day, 'peak_connection_pct', d.peak_pct, 'database_bytes', d.latest_bytes
  ) order by d.day), '[]'::jsonb)
    into v_history
    from (
      select (sampled_at at time zone 'Asia/Manila')::date as day,
             round(max(100.0 * connections_total / nullif(connections_max, 0)), 1) as peak_pct,
             (array_agg(database_bytes order by sampled_at desc))[1] as latest_bytes
      from private.buklod_backend_capacity_samples_v1
      where sampled_at >= now() - interval '7 days'
      group by 1
    ) d;

  return jsonb_build_object(
    'sampled_at', now(),
    'status', v_status,
    'status_reason', v_reason,
    'connections', jsonb_build_object(
      'used', v_total, 'active', v_active, 'idle_in_transaction', v_idle_tx,
      'max_configured', v_max, 'waiting_locks', v_waiting
    ),
    'database', jsonb_build_object(
      'bytes', v_size, 'cache_hit_percent', v_cache_hit,
      'growth_7d_bytes', case when v_size_first is null or v_size_last is null
          then null else v_size_last - v_size_first end
    ),
    'trend', jsonb_build_object(
      'samples_7d', v_samples, 'peak_connection_pct_7d', v_high_7d,
      'daily', v_history
    ),
    'cpu_percent', null,
    'memory_percent', null,
    'disk_capacity_percent', null,
    'upgrade_recommended', false,
    'upgrade_policy', 'Requires sustained pressure, measured CPU/RAM and verified optimization. No automatic upgrade.'
  );
end;
$function$;
revoke all on function public.buklod_admin_backend_capacity_v1() from public, anon, authenticated;
grant execute on function public.buklod_admin_backend_capacity_v1() to authenticated;

-- Small, fixed-cost sample each hour; do not repurpose the existing uptime
-- workflow (owner deliberately paused it). No notifications are sent by SQL.
select private.buklod_record_backend_capacity_v1();
select cron.schedule(
  'buklod-backend-capacity-hourly-v1',
  '17 * * * *',
  'select private.buklod_record_backend_capacity_v1()'
);
