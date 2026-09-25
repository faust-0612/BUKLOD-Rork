
drop policy if exists "bsoc_feedback_events_admin_read"
  on public.bsoc_feedback_events;
create policy "bsoc_feedback_events_admin_read"
  on public.bsoc_feedback_events
  for select
  to authenticated
  using ((select public.buklod_is_system_admin()));

drop policy if exists "bsoc_support_action_audit_admin_read"
  on public.bsoc_support_action_audit;
create policy "bsoc_support_action_audit_admin_read"
  on public.bsoc_support_action_audit
  for select
  to authenticated
  using ((select public.buklod_is_system_admin()));

create or replace function public.buklod_bsoc_preview_support_case_action_v1(
  p_feedback_id uuid,
  p_status public.feedback_status,
  p_resolution text default null,
  p_assigned_to uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  current_row public.user_feedback%rowtype;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  select *
  into current_row
  from public.user_feedback
  where id = p_feedback_id;

  if not found then
    raise exception 'Feedback record not found';
  end if;

  return jsonb_build_object(
    'feedback_id', current_row.id,
    'expected_updated_at', current_row.updated_at,
    'current', jsonb_build_object(
      'status', current_row.status,
      'assigned_to', current_row.assigned_to,
      'resolution', current_row.resolution
    ),
    'proposed', jsonb_build_object(
      'status', p_status,
      'assigned_to', p_assigned_to,
      'resolution', nullif(trim(coalesce(p_resolution,'')), '')
    ),
    'requires_confirmation', true,
    'will_audit', true
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_preview_support_case_action_v1(
  uuid,public.feedback_status,text,uuid
) from public, anon;
grant execute on function public.buklod_bsoc_preview_support_case_action_v1(
  uuid,public.feedback_status,text,uuid
) to authenticated;

create or replace function public.buklod_bsoc_apply_support_case_action_v1(
  p_feedback_id uuid,
  p_expected_updated_at timestamptz,
  p_status public.feedback_status,
  p_resolution text default null,
  p_assigned_to uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  current_row public.user_feedback%rowtype;
  after_row public.user_feedback%rowtype;
  audit_id uuid;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'Reason is required';
  end if;

  select *
  into current_row
  from public.user_feedback
  where id = p_feedback_id
  for update;

  if not found then
    raise exception 'Feedback record not found';
  end if;

  if current_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'Support case changed after preview. Refresh and preview again.';
  end if;

  perform public.resolve_user_feedback(
    p_feedback_id,
    p_status,
    p_resolution,
    p_assigned_to
  );

  select *
  into after_row
  from public.user_feedback
  where id = p_feedback_id;

  audit_id := public.buklod_bsoc_record_support_action_audit_v1(
    'SUPPORT_CASE_UPDATE',
    trim(p_reason),
    'applied',
    after_row.user_id,
    after_row.id,
    null,
    coalesce(after_row.app_environment, 'support'),
    jsonb_build_object(
      'from_status', current_row.status,
      'to_status', after_row.status,
      'from_assigned_to', current_row.assigned_to,
      'to_assigned_to', after_row.assigned_to,
      'updated_at', after_row.updated_at
    )::text
  );

  return jsonb_build_object(
    'feedback_id', after_row.id,
    'status', after_row.status,
    'assigned_to', after_row.assigned_to,
    'resolution', after_row.resolution,
    'updated_at', after_row.updated_at,
    'audit_id', audit_id
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_apply_support_case_action_v1(
  uuid,timestamptz,public.feedback_status,text,uuid,text
) from public, anon;
grant execute on function public.buklod_bsoc_apply_support_case_action_v1(
  uuid,timestamptz,public.feedback_status,text,uuid,text
) to authenticated;

create or replace function public.buklod_bsoc_preview_incident_update_v1(
  p_incident_id uuid,
  p_status public.incident_status,
  p_owner_id uuid default null,
  p_resolution text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  current_row public.pilot_incidents%rowtype;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  select *
  into current_row
  from public.pilot_incidents
  where id = p_incident_id;

  if not found then
    raise exception 'Incident not found';
  end if;

  return jsonb_build_object(
    'incident_id', current_row.id,
    'expected_updated_at', current_row.updated_at,
    'current', jsonb_build_object(
      'status', current_row.status,
      'owner_id', current_row.owner_id,
      'resolution', current_row.resolution
    ),
    'proposed', jsonb_build_object(
      'status', p_status,
      'owner_id', p_owner_id,
      'resolution', nullif(trim(coalesce(p_resolution,'')), '')
    ),
    'requires_confirmation', true,
    'will_audit', true
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_preview_incident_update_v1(
  uuid,public.incident_status,uuid,text
) from public, anon;
grant execute on function public.buklod_bsoc_preview_incident_update_v1(
  uuid,public.incident_status,uuid,text
) to authenticated;

create or replace function public.buklod_bsoc_apply_incident_update_v1(
  p_incident_id uuid,
  p_expected_updated_at timestamptz,
  p_status public.incident_status,
  p_owner_id uuid default null,
  p_resolution text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  current_row public.pilot_incidents%rowtype;
  after_row public.pilot_incidents%rowtype;
  audit_id uuid;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'Reason is required';
  end if;

  select *
  into current_row
  from public.pilot_incidents
  where id = p_incident_id
  for update;

  if not found then
    raise exception 'Incident not found';
  end if;

  if current_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'Incident changed after preview. Refresh and preview again.';
  end if;

  perform public.update_pilot_incident(
    p_incident_id,
    p_status,
    p_owner_id,
    p_resolution
  );

  select *
  into after_row
  from public.pilot_incidents
  where id = p_incident_id;

  audit_id := public.buklod_bsoc_record_support_action_audit_v1(
    'INCIDENT_UPDATE',
    trim(p_reason),
    'applied',
    null,
    after_row.linked_feedback_id,
    after_row.id,
    coalesce(after_row.environment, 'incident'),
    jsonb_build_object(
      'from_status', current_row.status,
      'to_status', after_row.status,
      'from_owner_id', current_row.owner_id,
      'to_owner_id', after_row.owner_id,
      'updated_at', after_row.updated_at
    )::text
  );

  return jsonb_build_object(
    'incident_id', after_row.id,
    'status', after_row.status,
    'owner_id', after_row.owner_id,
    'resolution', after_row.resolution,
    'updated_at', after_row.updated_at,
    'audit_id', audit_id
  );
end;
$function$;

revoke execute on function public.buklod_bsoc_apply_incident_update_v1(
  uuid,timestamptz,public.incident_status,uuid,text,text
) from public, anon;
grant execute on function public.buklod_bsoc_apply_incident_update_v1(
  uuid,timestamptz,public.incident_status,uuid,text,text
) to authenticated;

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
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'Reason is required';
  end if;

  incident_id := public.create_pilot_incident(
    p_severity,
    p_area,
    p_title,
    p_description,
    p_environment,
    p_app_version,
    p_platform,
    p_linked_feedback_id
  );

  update public.pilot_incidents
  set
    app_id = nullif(left(trim(coalesce(p_app_id,'')),80),''),
    build = nullif(left(trim(coalesce(p_build,'')),80),''),
    route = nullif(left(trim(coalesce(p_route,'')),240),''),
    error_category = nullif(left(trim(coalesce(p_error_category,'')),80),''),
    support_code = nullif(left(upper(trim(coalesce(p_support_code,''))),80),'')
  where id = incident_id;

  audit_id := public.buklod_bsoc_record_support_action_audit_v1(
    'INCIDENT_CREATE',
    trim(p_reason),
    'created',
    null,
    p_linked_feedback_id,
    incident_id,
    coalesce(p_environment,'production'),
    jsonb_build_object(
      'severity', p_severity,
      'area', p_area,
      'app_id', p_app_id,
      'platform', p_platform,
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

create or replace function public.buklod_bsoc_correlate_known_incidents_v1(
  p_app_id text default null,
  p_app_version text default null,
  p_platform text default null,
  p_route text default null,
  p_error_category text default null,
  p_support_code text default null,
  p_limit integer default 10
)
returns table(
  incident_id uuid,
  severity text,
  status text,
  title text,
  app_id text,
  app_version text,
  platform text,
  route text,
  error_category text,
  support_code text,
  opened_at timestamptz,
  match_score integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  limit_rows integer := greatest(1, least(coalesce(p_limit,10),50));
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  return query
  select
    pi.id,
    pi.severity::text,
    pi.status::text,
    pi.title,
    pi.app_id,
    pi.app_version,
    pi.platform,
    pi.route,
    pi.error_category,
    pi.support_code,
    pi.opened_at,
    (
      case when p_support_code is not null and upper(coalesce(pi.support_code,'')) = upper(p_support_code) then 50 else 0 end +
      case when p_app_id is not null and coalesce(pi.app_id,'') = p_app_id then 20 else 0 end +
      case when p_route is not null and coalesce(pi.route,'') = p_route then 15 else 0 end +
      case when p_platform is not null and coalesce(pi.platform,'') = p_platform then 5 else 0 end +
      case when p_app_version is not null and coalesce(pi.app_version,'') = p_app_version then 5 else 0 end +
      case when p_error_category is not null and coalesce(pi.error_category,'') = p_error_category then 5 else 0 end
    )::integer as match_score
  from public.pilot_incidents pi
  where pi.status not in ('closed'::public.incident_status,'accepted'::public.incident_status)
    and (
      (p_support_code is not null and upper(coalesce(pi.support_code,'')) = upper(p_support_code)) or
      (p_app_id is not null and coalesce(pi.app_id,'') = p_app_id) or
      (p_route is not null and coalesce(pi.route,'') = p_route) or
      (p_platform is not null and coalesce(pi.platform,'') = p_platform) or
      (p_app_version is not null and coalesce(pi.app_version,'') = p_app_version) or
      (p_error_category is not null and coalesce(pi.error_category,'') = p_error_category)
    )
  order by match_score desc, pi.opened_at desc
  limit limit_rows;
end;
$function$;

revoke execute on function public.buklod_bsoc_correlate_known_incidents_v1(
  text,text,text,text,text,text,integer
) from public, anon;
grant execute on function public.buklod_bsoc_correlate_known_incidents_v1(
  text,text,text,text,text,text,integer
) to authenticated;
