create or replace function public.buklod_report_publish_deadline_v1(
  p_definition_id uuid,
  p_due_at timestamptz,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_definition public.buklod_report_definitions%rowtype;
  v_scope public.buklod_scopes%rowtype;
  v_period public.buklod_report_periods%rowtype;
  v_opens_at timestamptz := coalesce(p_opens_at, now());
  v_period_key text;
  v_period_created boolean := false;
  v_eligible_count integer := 0;
  v_assignment_count integer := 0;
  v_notification_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_definition_id is null then raise exception 'Report definition is required'; end if;
  if p_due_at is null then raise exception 'Deadline is required'; end if;

  select * into v_definition
  from public.buklod_report_definitions d
  where d.id = p_definition_id;
  if not found then raise exception 'Report definition not found'; end if;

  perform public.buklod_report_assert_definition_admin_v1(v_definition.scope_id);
  if v_definition.status = 'ARCHIVED' then
    raise exception 'Archived report definitions cannot be published';
  end if;

  if coalesce(v_definition.content_requirements ->> 'template_key', '') <> 'MZB_MINISTERIAL_REPORT_V1'
     and coalesce(v_definition.content_requirements ->> 'schema', '') <> 'BUKLOD_QUICK_WEEKLY_V1'
  then
    if jsonb_typeof(v_definition.content_requirements -> 'fields') is distinct from 'array'
       or jsonb_array_length(coalesce(v_definition.content_requirements -> 'fields', '[]'::jsonb)) < 1
    then
      raise exception 'Report template has no configured fields. Review the Organization/Cluster template before publishing.';
    end if;
  end if;

  select * into v_scope
  from public.buklod_scopes s
  where s.id = v_definition.scope_id
    and upper(s.scope_type::text) in ('ORGANIZATION', 'CLUSTER')
    and coalesce(s.status::text, 'ACTIVE') not in ('DELETED', 'ARCHIVED');
  if not found then raise exception 'Organization or Cluster scope not found'; end if;

  if p_due_at <= now() then raise exception 'Deadline must be in the future'; end if;
  if v_opens_at > p_due_at then raise exception 'Open time cannot be after the deadline'; end if;
  if p_closes_at is not null and p_closes_at < p_due_at then
    raise exception 'Close time cannot be before the deadline';
  end if;

  select count(distinct m.user_id)::integer into v_eligible_count
  from public.buklod_scope_memberships m
  where m.scope_id = v_definition.scope_id
    and m.membership_status = 'ACTIVE'
    and m.user_id is not null
    and m.left_at is null;
  if v_eligible_count < 1 then raise exception 'No active members are available in this scope'; end if;

  v_period_key := 'MANUAL_' || to_char(p_due_at at time zone 'UTC', 'YYYYMMDD_HH24MISS');

  insert into public.buklod_report_periods (
    report_definition_id, scope_id, period_key, title,
    opens_at, due_at, closes_at, status, metadata
  ) values (
    v_definition.id, v_definition.scope_id, v_period_key,
    coalesce(nullif(btrim(p_title), ''), v_definition.title),
    v_opens_at, p_due_at, p_closes_at,
    case when v_opens_at > now() then 'SCHEDULED' else 'OPEN' end,
    jsonb_build_object(
      'source', 'BUKLOD_REPORT_REAL_DEADLINE_R1',
      'published_by', v_actor,
      'published_at', now(),
      'membership_snapshot', true,
      'eligible_member_count', v_eligible_count,
      'timezone', 'Asia/Manila'
    )
  )
  on conflict (report_definition_id, period_key) do nothing
  returning * into v_period;

  if found then
    v_period_created := true;
  else
    select * into v_period
    from public.buklod_report_periods p
    where p.report_definition_id = v_definition.id
      and p.period_key = v_period_key
    limit 1;
  end if;

  if v_period_created then
    insert into public.buklod_report_assignments (
      report_definition_id, report_period_id, scope_id, assignee_user_id,
      assignment_status, deadline_at, original_deadline_at, metadata
    )
    select
      v_definition.id, v_period.id, v_definition.scope_id, m.user_id,
      'OPEN', p_due_at, p_due_at,
      jsonb_build_object(
        'source', 'BUKLOD_REPORT_REAL_DEADLINE_R1',
        'published_by', v_actor,
        'published_at', now(),
        'scope_type', upper(v_scope.scope_type::text),
        'scope_name', v_scope.name,
        'membership_snapshot', jsonb_build_object(
          'membership_id', m.id,
          'membership_status', m.membership_status,
          'joined_at', m.joined_at
        )
      )
    from public.buklod_scope_memberships m
    where m.scope_id = v_definition.scope_id
      and m.membership_status = 'ACTIVE'
      and m.user_id is not null
      and m.left_at is null
    on conflict (report_definition_id, report_period_id, assignee_user_id) do nothing;
    get diagnostics v_assignment_count = row_count;

    insert into public.buklod_report_reminders (
      scope_id, assignment_id, assigned_user_id, created_by,
      reminder_kind, title, body, due_at, priority, status, metadata
    )
    select
      a.scope_id, a.id, a.assignee_user_id, v_actor,
      'DEADLINE', v_definition.title || ' deadline',
      'Due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.',
      a.deadline_at, 'NORMAL', 'ACTIVE',
      jsonb_build_object(
        'source', 'BUKLOD_REPORT_REAL_DEADLINE_R1',
        'report_period_id', v_period.id,
        'reminder_offsets_minutes', jsonb_build_array(1440, 180)
      )
    from public.buklod_report_assignments a
    where a.report_period_id = v_period.id
      and a.assignee_user_id is not null
    on conflict (assignment_id, assigned_user_id, reminder_kind)
      where assignment_id is not null and reminder_kind = 'DEADLINE'
    do nothing;

    insert into public.notifications (user_id, title, body, kind, data)
    select
      a.assignee_user_id,
      'New report assigned',
      v_definition.title || ' · due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'),
      'report_assigned',
      jsonb_build_object(
        'route', '/reports',
        'scope_id', a.scope_id,
        'report_definition_id', a.report_definition_id,
        'report_period_id', a.report_period_id,
        'report_assignment_id', a.id,
        'deadline_at', a.deadline_at,
        'event', 'report_assigned'
      )
    from public.buklod_report_assignments a
    where a.report_period_id = v_period.id
      and a.assignee_user_id is not null
      and not exists (
        select 1 from public.notifications n
        where n.user_id = a.assignee_user_id
          and n.kind = 'report_assigned'
          and n.data ->> 'report_assignment_id' = a.id::text
      );
    get diagnostics v_notification_count = row_count;

    update public.buklod_report_definitions
    set status = 'ACTIVE', updated_by = v_actor, updated_at = now()
    where id = v_definition.id and status in ('DRAFT', 'PAUSED');

    perform public.buklod_report_audit_v1(
      v_definition.scope_id,
      'DEADLINE_PUBLISHED',
      'REPORT_PERIOD',
      v_period.id,
      v_actor,
      jsonb_build_object(
        'report_definition_id', v_definition.id,
        'deadline_at', p_due_at,
        'assigned_count', v_assignment_count,
        'notification_count', v_notification_count,
        'membership_snapshot', true
      )
    );
  else
    select count(*)::integer into v_assignment_count
    from public.buklod_report_assignments a
    where a.report_period_id = v_period.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_published', not v_period_created,
    'scope_id', v_definition.scope_id,
    'scope_name', v_scope.name,
    'scope_type', upper(v_scope.scope_type::text),
    'report_definition_id', v_definition.id,
    'report_period_id', v_period.id,
    'period_title', v_period.title,
    'opens_at', v_period.opens_at,
    'deadline_at', v_period.due_at,
    'closes_at', v_period.closes_at,
    'assigned_count', v_assignment_count,
    'notification_count', v_notification_count,
    'membership_snapshot', true
  );
end;
$function$;
