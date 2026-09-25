
create or replace function public.buklod_bsoc_lookup_context_v1(
  p_query text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  q text := upper(trim(coalesce(p_query,'')));
  limit_rows integer := greatest(1, least(coalesce(p_limit,50),200));
  support_rows jsonb;
  event_rows jsonb;
  incident_rows jsonb;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if q = '' or length(q) > 80 then
    raise exception 'Lookup value is required';
  end if;

  select coalesce(jsonb_agg(x.row_data order by x.created_at desc),'[]'::jsonb)
  into support_rows
  from (
    select
      uf.created_at,
      jsonb_build_object(
        'id', uf.id,
        'reference', upper(substr(uf.id::text,1,8)),
        'user_id', uf.user_id,
        'category', uf.category,
        'title', uf.title,
        'status', uf.status,
        'app_version', uf.app_version,
        'app_environment', uf.app_environment,
        'support_code', upper(coalesce(uf.diagnostics->>'support_code', uf.diagnostics->>'error_code')),
        'route', coalesce(uf.diagnostics->>'route', uf.diagnostics->>'screen'),
        'platform', uf.diagnostics->>'platform',
        'error_category', uf.diagnostics->>'error_category',
        'created_at', uf.created_at,
        'updated_at', uf.updated_at
      ) as row_data
    from public.user_feedback uf
    where upper(substr(uf.id::text,1,8)) = q
       or upper(coalesce(uf.diagnostics->>'support_code', uf.diagnostics->>'error_code')) = q
    order by uf.created_at desc
    limit limit_rows
  ) x;

  select coalesce(jsonb_agg(x.row_data order by x.occurred_at desc),'[]'::jsonb)
  into event_rows
  from (
    select
      e.occurred_at,
      jsonb_build_object(
        'id', e.id,
        'user_id', e.user_id,
        'event_type', e.event_type,
        'error_category', e.error_category,
        'support_code', e.support_code,
        'app_id', e.app_id,
        'app_version', e.app_version,
        'build', e.build,
        'platform', e.platform,
        'route', e.route,
        'recovery_attempted', e.recovery_attempted,
        'recovery_success', e.recovery_success,
        'support_case_id', e.support_case_id,
        'incident_id', e.incident_id,
        'occurred_at', e.occurred_at
      ) as row_data
    from public.bsoc_feedback_events e
    where upper(coalesce(e.support_code,'')) = q
       or upper(substr(e.id::text,1,8)) = q
    order by e.occurred_at desc
    limit limit_rows
  ) x;

  select coalesce(jsonb_agg(x.row_data order by x.opened_at desc),'[]'::jsonb)
  into incident_rows
  from (
    select
      pi.opened_at,
      jsonb_build_object(
        'id', pi.id,
        'severity', pi.severity,
        'status', pi.status,
        'area', pi.area,
        'title', pi.title,
        'environment', pi.environment,
        'app_id', pi.app_id,
        'app_version', pi.app_version,
        'build', pi.build,
        'platform', pi.platform,
        'route', pi.route,
        'error_category', pi.error_category,
        'support_code', pi.support_code,
        'linked_feedback_id', pi.linked_feedback_id,
        'opened_at', pi.opened_at,
        'updated_at', pi.updated_at
      ) as row_data
    from public.pilot_incidents pi
    where upper(coalesce(pi.support_code,'')) = q
       or upper(substr(pi.id::text,1,8)) = q
    order by pi.opened_at desc
    limit limit_rows
  ) x;

  return jsonb_build_object(
    'query', q,
    'generated_at', now(),
    'support_cases', support_rows,
    'feedback_events', event_rows,
    'incidents', incident_rows
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_lookup_context_v1(text,integer)
  from public, anon;
grant execute on function public.buklod_bsoc_lookup_context_v1(text,integer)
  to authenticated;

create or replace function public.buklod_bsoc_recurring_errors_v1(
  p_hours integer default 24,
  p_limit integer default 50
)
returns table(
  app_id text,
  route text,
  platform text,
  error_category text,
  support_code text,
  occurrence_count bigint,
  support_open_count bigint,
  recovery_success_count bigint,
  abandonment_count bigint,
  first_seen timestamptz,
  last_seen timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  since_at timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_hours,24),720)));
  limit_rows integer := greatest(1, least(coalesce(p_limit,50),200));
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  return query
  select
    e.app_id,
    e.route,
    e.platform,
    coalesce(e.error_category,'UNKNOWN_ERROR'),
    e.support_code,
    count(*) filter (where e.event_type='error_shown') as occurrence_count,
    count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) as support_open_count,
    count(*) filter (where e.event_type='recovery_success') as recovery_success_count,
    count(*) filter (where e.event_type='user_abandoned_after_error') as abandonment_count,
    min(e.occurred_at) as first_seen,
    max(e.occurred_at) as last_seen
  from public.bsoc_feedback_events e
  where e.occurred_at >= since_at
  group by
    e.app_id,e.route,e.platform,coalesce(e.error_category,'UNKNOWN_ERROR'),e.support_code
  having count(*) filter (where e.event_type='error_shown') > 0
  order by
    count(*) filter (where e.event_type='error_shown') desc,
    count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) desc,
    max(e.occurred_at) desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_recurring_errors_v1(integer,integer)
  from public, anon;
grant execute on function public.buklod_bsoc_recurring_errors_v1(integer,integer)
  to authenticated;
