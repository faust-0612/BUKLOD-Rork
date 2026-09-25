
create or replace function public.buklod_bsoc_create_incident_v1(
  p_severity public.incident_severity,
  p_area text,
  p_title text,
  p_description text,
  p_environment text default 'production',
  p_app_id text default null,
  p_app_version text default null,
  p_build text default null,
  p_platform text default null,
  p_route text default null,
  p_error_category text default null,
  p_support_code text default null,
  p_linked_feedback_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  incident_id uuid;
  audit_id uuid;
  safe_environment text := lower(trim(coalesce(p_environment,'production')));
  safe_platform text := nullif(lower(trim(coalesce(p_platform,''))), '');
  safe_error_category text := nullif(upper(trim(coalesce(p_error_category,''))), '');
  safe_support_code text := nullif(upper(trim(coalesce(p_support_code,''))), '');
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'Reason is required';
  end if;

  if safe_environment not in ('development','staging','production') then
    raise exception 'Environment must be development, staging, or production';
  end if;

  if safe_platform is not null and safe_platform not in (
    'android','ios','web','database','server','other'
  ) then
    raise exception 'Unsupported incident platform';
  end if;

  if safe_error_category is not null and safe_error_category not in (
    'VALIDATION_ERROR',
    'AUTH_ERROR',
    'PERMISSION_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONFLICT_ERROR',
    'NOT_FOUND',
    'RATE_LIMIT',
    'SERVICE_UNAVAILABLE',
    'RECOVERY_REQUIRED',
    'KNOWN_INCIDENT',
    'UNKNOWN_ERROR'
  ) then
    raise exception 'Unsupported error category';
  end if;

  if safe_support_code is not null
     and safe_support_code !~ '^[A-Z][A-Z0-9_]{1,15}-[A-Z0-9]{2,16}$' then
    raise exception 'Invalid support code format';
  end if;

  incident_id := public.create_pilot_incident(
    p_severity,
    p_area,
    p_title,
    p_description,
    safe_environment,
    p_app_version,
    safe_platform,
    p_linked_feedback_id
  );

  update public.pilot_incidents
  set
    app_id = nullif(left(trim(coalesce(p_app_id,'')),80),''),
    build = nullif(left(trim(coalesce(p_build,'')),80),''),
    route = nullif(left(trim(coalesce(p_route,'')),240),''),
    error_category = safe_error_category,
    support_code = safe_support_code
  where id = incident_id;

  audit_id := public.buklod_bsoc_record_support_action_audit_v1(
    'INCIDENT_CREATE',
    trim(p_reason),
    'created',
    null,
    p_linked_feedback_id,
    incident_id,
    safe_environment,
    jsonb_build_object(
      'severity', p_severity,
      'area', p_area,
      'app_id', p_app_id,
      'platform', safe_platform,
      'route', p_route
    )::text
  );

  return jsonb_build_object(
    'incident_id', incident_id,
    'audit_id', audit_id
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_create_incident_v1(
  public.incident_severity,text,text,text,text,text,text,text,text,text,text,text,uuid,text
) from public, anon;
grant execute on function public.buklod_bsoc_create_incident_v1(
  public.incident_severity,text,text,text,text,text,text,text,text,text,text,text,uuid,text
) to authenticated;

create or replace function public.buklod_bsoc_error_category_metrics_v1(
  p_hours integer default 24,
  p_limit integer default 20
)
returns table(
  error_category text,
  error_count bigint,
  recovery_attempt_count bigint,
  recovery_success_count bigint,
  support_open_count bigint,
  abandonment_count bigint,
  self_heal_success_rate numeric,
  error_to_support_rate numeric
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
  with grouped as (
    select
      coalesce(e.error_category,'UNKNOWN_ERROR') as category,
      count(*) filter (where e.event_type='error_shown') as errors,
      count(*) filter (where e.event_type='recovery_attempted') as recovery_attempts,
      count(*) filter (where e.event_type='recovery_success') as recovery_successes,
      count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) as support_opens,
      count(*) filter (where e.event_type='user_abandoned_after_error') as abandonments
    from public.bsoc_feedback_events e
    where e.occurred_at >= since_at
    group by coalesce(e.error_category,'UNKNOWN_ERROR')
  )
  select
    g.category,
    g.errors,
    g.recovery_attempts,
    g.recovery_successes,
    g.support_opens,
    g.abandonments,
    case when g.recovery_attempts=0 then null
         else round((g.recovery_successes::numeric/g.recovery_attempts::numeric)*100,2)
    end,
    case when g.errors=0 then null
         else round((g.support_opens::numeric/g.errors::numeric)*100,2)
    end
  from grouped g
  order by g.errors desc, g.support_opens desc, g.category
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_error_category_metrics_v1(integer,integer)
  from public, anon;
grant execute on function public.buklod_bsoc_error_category_metrics_v1(integer,integer)
  to authenticated;

create or replace function public.buklod_bsoc_user360_v1(
  p_user_id uuid,
  p_recent_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  limit_rows integer := greatest(1, least(coalesce(p_recent_limit,20),100));
  profile_data jsonb;
  support_data jsonb;
  event_data jsonb;
  incident_data jsonb;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'username', p.username,
    'role', p.role,
    'is_active', p.is_active,
    'is_verified', p.is_verified,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  into profile_data
  from public.profiles p
  where p.id = p_user_id;

  if profile_data is null then
    raise exception 'User profile not found';
  end if;

  select coalesce(jsonb_agg(x.row_data order by x.created_at desc),'[]'::jsonb)
  into support_data
  from (
    select
      uf.created_at,
      jsonb_build_object(
        'id', uf.id,
        'reference', upper(substr(uf.id::text,1,8)),
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
    where uf.user_id = p_user_id
    order by uf.created_at desc
    limit limit_rows
  ) x;

  select coalesce(jsonb_agg(x.row_data order by x.occurred_at desc),'[]'::jsonb)
  into event_data
  from (
    select
      e.occurred_at,
      jsonb_build_object(
        'id', e.id,
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
    where e.user_id = p_user_id
    order by e.occurred_at desc
    limit limit_rows
  ) x;

  select coalesce(jsonb_agg(x.row_data order by x.opened_at desc),'[]'::jsonb)
  into incident_data
  from (
    select
      pi.opened_at,
      jsonb_build_object(
        'id', pi.id,
        'severity', pi.severity,
        'status', pi.status,
        'title', pi.title,
        'app_id', pi.app_id,
        'app_version', pi.app_version,
        'platform', pi.platform,
        'route', pi.route,
        'error_category', pi.error_category,
        'support_code', pi.support_code,
        'opened_at', pi.opened_at,
        'updated_at', pi.updated_at
      ) as row_data
    from public.pilot_incidents pi
    join public.user_feedback uf on uf.id = pi.linked_feedback_id
    where uf.user_id = p_user_id
    order by pi.opened_at desc
    limit limit_rows
  ) x;

  return jsonb_build_object(
    'generated_at', now(),
    'profile', profile_data,
    'support_cases', support_data,
    'feedback_events', event_data,
    'linked_incidents', incident_data
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_user360_v1(uuid,integer)
  from public, anon;
grant execute on function public.buklod_bsoc_user360_v1(uuid,integer)
  to authenticated;
