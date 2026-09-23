
create index if not exists idx_user_feedback_support_code
  on public.user_feedback (
    upper(coalesce(diagnostics->>'support_code', diagnostics->>'error_code'))
  )
  where coalesce(diagnostics->>'support_code', diagnostics->>'error_code') is not null;

create or replace function public.buklod_bsoc_feedback_metrics_v1(
  p_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  hours_window integer := greatest(1, least(coalesce(p_hours,24), 720));
  since_at timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_hours,24),720)));
  error_events bigint := 0;
  recovery_attempts bigint := 0;
  recovery_success bigint := 0;
  support_opened bigint := 0;
  abandonment bigint := 0;
  known_matches bigint := 0;
  open_cases bigint := 0;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  select
    count(*) filter (where event_type='error_shown'),
    count(*) filter (where event_type='recovery_attempted'),
    count(*) filter (where event_type='recovery_success'),
    count(*) filter (where event_type in ('support_opened_after_error','error_to_ticket')),
    count(*) filter (where event_type='user_abandoned_after_error'),
    count(*) filter (where event_type='known_incident_matched')
  into
    error_events,
    recovery_attempts,
    recovery_success,
    support_opened,
    abandonment,
    known_matches
  from public.bsoc_feedback_events
  where occurred_at >= since_at;

  select count(*)
  into open_cases
  from public.user_feedback
  where status not in ('resolved'::public.feedback_status,'closed'::public.feedback_status);

  return jsonb_build_object(
    'generated_at', now(),
    'hours', hours_window,
    'open_support_cases', open_cases,
    'error_events', error_events,
    'recovery_attempts', recovery_attempts,
    'recovery_success', recovery_success,
    'support_opened_after_error', support_opened,
    'abandonment_after_error', abandonment,
    'known_incident_matches', known_matches,
    'self_heal_success_rate',
      case when recovery_attempts=0 then null
           else round((recovery_success::numeric / recovery_attempts::numeric) * 100, 2)
      end,
    'error_to_support_rate',
      case when error_events=0 then null
           else round((support_opened::numeric / error_events::numeric) * 100, 2)
      end
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_feedback_metrics_v1(integer) from public, anon;
grant execute on function public.buklod_bsoc_feedback_metrics_v1(integer) to authenticated;

create or replace function public.buklod_bsoc_top_error_routes_v1(
  p_hours integer default 24,
  p_limit integer default 20
)
returns table(
  app_id text,
  platform text,
  route text,
  error_count bigint,
  support_open_count bigint,
  abandonment_count bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  since_at timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_hours,24),720)));
  limit_rows integer := greatest(1, least(coalesce(p_limit,20),100));
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  return query
  select
    e.app_id,
    e.platform,
    e.route,
    count(*) filter (where e.event_type='error_shown') as error_count,
    count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) as support_open_count,
    count(*) filter (where e.event_type='user_abandoned_after_error') as abandonment_count
  from public.bsoc_feedback_events e
  where e.occurred_at >= since_at
    and e.route is not null
  group by e.app_id, e.platform, e.route
  having count(*) filter (where e.event_type='error_shown') > 0
  order by
    count(*) filter (where e.event_type='error_shown') desc,
    count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_top_error_routes_v1(integer,integer) from public, anon;
grant execute on function public.buklod_bsoc_top_error_routes_v1(integer,integer) to authenticated;

create or replace function public.buklod_bsoc_support_lookup_v1(
  p_query text
)
returns table(
  feedback_id uuid,
  reference text,
  user_id uuid,
  category text,
  title text,
  status text,
  app_version text,
  app_environment text,
  support_code text,
  route text,
  platform text,
  error_category text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  q text := upper(trim(coalesce(p_query,'')));
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if q = '' or length(q) > 80 then
    return;
  end if;

  return query
  select
    uf.id,
    upper(substr(uf.id::text,1,8)),
    uf.user_id,
    uf.category::text,
    uf.title,
    uf.status::text,
    uf.app_version,
    uf.app_environment,
    upper(coalesce(uf.diagnostics->>'support_code', uf.diagnostics->>'error_code')),
    coalesce(uf.diagnostics->>'route', uf.diagnostics->>'screen'),
    uf.diagnostics->>'platform',
    uf.diagnostics->>'error_category',
    uf.created_at
  from public.user_feedback uf
  where upper(substr(uf.id::text,1,8)) = q
     or upper(coalesce(uf.diagnostics->>'support_code', uf.diagnostics->>'error_code')) = q
  order by uf.created_at desc
  limit 20;
end;
$function$;

revoke execute on function public.buklod_bsoc_support_lookup_v1(text) from public, anon;
grant execute on function public.buklod_bsoc_support_lookup_v1(text) to authenticated;
