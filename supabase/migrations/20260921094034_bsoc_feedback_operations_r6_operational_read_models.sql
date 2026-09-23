
create or replace function public.buklod_bsoc_support_queue_v1(
  p_status text default null,
  p_limit integer default 100,
  p_before timestamptz default null
)
returns table(
  feedback_id uuid,
  reference text,
  user_id uuid,
  user_name text,
  category text,
  title text,
  message text,
  status text,
  app_version text,
  app_environment text,
  support_code text,
  route text,
  platform text,
  error_category text,
  assigned_to uuid,
  resolution text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  limit_rows integer := greatest(1, least(coalesce(p_limit,100),500));
  status_filter text := nullif(lower(trim(coalesce(p_status,''))), '');
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if status_filter is not null and status_filter not in (
    'new','triaged','in_progress','resolved','closed'
  ) then
    raise exception 'Unsupported support case status';
  end if;

  return query
  select
    uf.id,
    upper(substr(uf.id::text,1,8)),
    uf.user_id,
    p.full_name,
    uf.category::text,
    uf.title,
    uf.message,
    uf.status::text,
    uf.app_version,
    uf.app_environment,
    upper(coalesce(uf.diagnostics->>'support_code', uf.diagnostics->>'error_code')),
    coalesce(uf.diagnostics->>'route', uf.diagnostics->>'screen'),
    uf.diagnostics->>'platform',
    uf.diagnostics->>'error_category',
    uf.assigned_to,
    uf.resolution,
    uf.created_at,
    uf.updated_at
  from public.user_feedback uf
  left join public.profiles p on p.id = uf.user_id
  where (status_filter is null or uf.status::text = status_filter)
    and (p_before is null or uf.created_at < p_before)
  order by uf.created_at desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_support_queue_v1(text,integer,timestamptz)
  from public, anon;
grant execute on function public.buklod_bsoc_support_queue_v1(text,integer,timestamptz)
  to authenticated;

create or replace function public.buklod_bsoc_incident_list_v1(
  p_open_only boolean default true,
  p_limit integer default 100
)
returns table(
  incident_id uuid,
  severity text,
  status text,
  area text,
  title text,
  description text,
  environment text,
  app_id text,
  app_version text,
  build text,
  platform text,
  route text,
  error_category text,
  support_code text,
  linked_feedback_id uuid,
  owner_id uuid,
  resolution text,
  opened_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  limit_rows integer := greatest(1, least(coalesce(p_limit,100),500));
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  return query
  select
    pi.id,
    pi.severity::text,
    pi.status::text,
    pi.area,
    pi.title,
    pi.description,
    pi.environment,
    pi.app_id,
    pi.app_version,
    pi.build,
    pi.platform,
    pi.route,
    pi.error_category,
    pi.support_code,
    pi.linked_feedback_id,
    pi.owner_id,
    pi.resolution,
    pi.opened_at,
    pi.updated_at
  from public.pilot_incidents pi
  where not coalesce(p_open_only,true)
     or pi.status not in ('closed'::public.incident_status,'accepted'::public.incident_status)
  order by pi.opened_at desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_incident_list_v1(boolean,integer)
  from public, anon;
grant execute on function public.buklod_bsoc_incident_list_v1(boolean,integer)
  to authenticated;

create or replace function public.buklod_bsoc_audit_list_v1(
  p_limit integer default 100,
  p_before timestamptz default null
)
returns table(
  audit_id uuid,
  actor_id uuid,
  occurred_at timestamptz,
  action_type text,
  target_user_id uuid,
  support_case_id uuid,
  incident_id uuid,
  scope text,
  reason text,
  result text,
  verification text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  limit_rows integer := greatest(1, least(coalesce(p_limit,100),500));
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  return query
  select
    a.id,
    a.actor_id,
    a.occurred_at,
    a.action_type,
    a.target_user_id,
    a.support_case_id,
    a.incident_id,
    a.scope,
    a.reason,
    a.result,
    a.verification
  from public.bsoc_support_action_audit a
  where p_before is null or a.occurred_at < p_before
  order by a.occurred_at desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_audit_list_v1(integer,timestamptz)
  from public, anon;
grant execute on function public.buklod_bsoc_audit_list_v1(integer,timestamptz)
  to authenticated;

create or replace function public.buklod_bsoc_version_platform_metrics_v1(
  p_hours integer default 24,
  p_limit integer default 50
)
returns table(
  app_id text,
  app_version text,
  build text,
  platform text,
  error_count bigint,
  recovery_success_count bigint,
  support_open_count bigint,
  abandonment_count bigint
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
    e.app_version,
    e.build,
    e.platform,
    count(*) filter (where e.event_type='error_shown') as error_count,
    count(*) filter (where e.event_type='recovery_success') as recovery_success_count,
    count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) as support_open_count,
    count(*) filter (where e.event_type='user_abandoned_after_error') as abandonment_count
  from public.bsoc_feedback_events e
  where e.occurred_at >= since_at
  group by e.app_id,e.app_version,e.build,e.platform
  order by
    count(*) filter (where e.event_type='error_shown') desc,
    count(*) filter (where e.event_type in ('support_opened_after_error','error_to_ticket')) desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_version_platform_metrics_v1(integer,integer)
  from public, anon;
grant execute on function public.buklod_bsoc_version_platform_metrics_v1(integer,integer)
  to authenticated;

create or replace function public.buklod_bsoc_source_freshness_v1()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  latest_feedback timestamptz;
  latest_event timestamptz;
  latest_incident timestamptz;
  latest_audit timestamptz;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  select max(updated_at) into latest_feedback from public.user_feedback;
  select max(occurred_at) into latest_event from public.bsoc_feedback_events;
  select max(updated_at) into latest_incident from public.pilot_incidents;
  select max(occurred_at) into latest_audit from public.bsoc_support_action_audit;

  return jsonb_build_object(
    'generated_at', now(),
    'support_cases', jsonb_build_object(
      'latest_at', latest_feedback,
      'state', case when latest_feedback is null then 'NO_DATA' else 'AVAILABLE' end
    ),
    'feedback_events', jsonb_build_object(
      'latest_at', latest_event,
      'state', case when latest_event is null then 'NO_DATA' else 'AVAILABLE' end
    ),
    'incidents', jsonb_build_object(
      'latest_at', latest_incident,
      'state', case when latest_incident is null then 'NO_DATA' else 'AVAILABLE' end
    ),
    'support_audit', jsonb_build_object(
      'latest_at', latest_audit,
      'state', case when latest_audit is null then 'NO_DATA' else 'AVAILABLE' end
    )
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_source_freshness_v1()
  from public, anon;
grant execute on function public.buklod_bsoc_source_freshness_v1()
  to authenticated;
