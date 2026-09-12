-- BUKLOD Report R1: real deadline publication, frozen member assignments,
-- in-app notifications, push-trigger rows, and due/overdue reminder dispatch.
--
-- Stability contract:
-- - does not remove or rename existing report tables/functions
-- - publication is idempotent per definition + due timestamp
-- - membership is snapshotted only on first publication; retries never silently
--   add newly joined members to an already-published deadline

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
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_definition_id is null then
    raise exception 'Report definition is required';
  end if;

  if p_due_at is null then
    raise exception 'Deadline is required';
  end if;

  select *
    into v_definition
  from public.buklod_report_definitions d
  where d.id = p_definition_id;

  if not found then
    raise exception 'Report definition not found';
  end if;

  perform public.buklod_report_assert_definition_admin_v1(v_definition.scope_id);

  if v_definition.status = 'ARCHIVED' then
    raise exception 'Archived report definitions cannot be published';
  end if;

  select *
    into v_scope
  from public.buklod_scopes s
  where s.id = v_definition.scope_id
    and upper(s.scope_type::text) in ('ORGANIZATION', 'CLUSTER')
    and coalesce(s.status::text, 'ACTIVE') not in ('DELETED', 'ARCHIVED');

  if not found then
    raise exception 'Organization or Cluster scope not found';
  end if;

  if p_due_at <= now() then
    raise exception 'Deadline must be in the future';
  end if;

  if v_opens_at > p_due_at then
    raise exception 'Open time cannot be after the deadline';
  end if;

  if p_closes_at is not null and p_closes_at < p_due_at then
    raise exception 'Close time cannot be before the deadline';
  end if;

  select count(distinct m.user_id)::integer
    into v_eligible_count
  from public.buklod_scope_memberships m
  where m.scope_id = v_definition.scope_id
    and m.membership_status = 'ACTIVE'
    and m.user_id is not null
    and m.left_at is null;

  if v_eligible_count < 1 then
    raise exception 'No active members are available in this scope';
  end if;

  -- A deterministic key makes publish safe against double-taps/retries.
  v_period_key := 'MANUAL_' || to_char(p_due_at at time zone 'UTC', 'YYYYMMDD_HH24MISS');

  insert into public.buklod_report_periods (
    report_definition_id,
    scope_id,
    period_key,
    title,
    opens_at,
    due_at,
    closes_at,
    status,
    metadata
  )
  values (
    v_definition.id,
    v_definition.scope_id,
    v_period_key,
    coalesce(nullif(btrim(p_title), ''), v_definition.title),
    v_opens_at,
    p_due_at,
    p_closes_at,
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
    select *
      into v_period
    from public.buklod_report_periods p
    where p.report_definition_id = v_definition.id
      and p.period_key = v_period_key
    limit 1;
  end if;

  -- IMPORTANT: only the first publication snapshots members. A retry against
  -- the same period never changes the denominator or silently includes joiners.
  if v_period_created then
    insert into public.buklod_report_assignments (
      report_definition_id,
      report_period_id,
      scope_id,
      assignee_user_id,
      assignment_status,
      deadline_at,
      original_deadline_at,
      metadata
    )
    select
      v_definition.id,
      v_period.id,
      v_definition.scope_id,
      m.user_id,
      'OPEN',
      p_due_at,
      p_due_at,
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
      scope_id,
      assignment_id,
      assigned_user_id,
      created_by,
      reminder_kind,
      title,
      body,
      due_at,
      priority,
      status,
      metadata
    )
    select
      a.scope_id,
      a.id,
      a.assignee_user_id,
      v_actor,
      'DEADLINE',
      v_definition.title || ' deadline',
      'Due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.',
      a.deadline_at,
      'NORMAL',
      'ACTIVE',
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
      v_definition.title || ' · due ' ||
        to_char(a.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'),
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
        select 1
        from public.notifications n
        where n.user_id = a.assignee_user_id
          and n.kind = 'report_assigned'
          and n.data ->> 'report_assignment_id' = a.id::text
      );

    get diagnostics v_notification_count = row_count;

    update public.buklod_report_definitions
    set status = 'ACTIVE',
        updated_by = v_actor,
        updated_at = now()
    where id = v_definition.id
      and status in ('DRAFT', 'PAUSED');

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
    select count(*)::integer
      into v_assignment_count
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

grant execute on function public.buklod_report_publish_deadline_v1(uuid, timestamptz, timestamptz, timestamptz, text) to authenticated;

-- Member Action Center: past-due open assignments are displayed as EXPIRED/
-- overdue without making them un-submittable. This preserves late submission.
create or replace function public.buklod_report_my_assignments_v1(
  p_scope_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'assignments', coalesce(jsonb_agg(to_jsonb(q) order by q.deadline_at asc), '[]'::jsonb)
  )
  from (
    select
      a.id as report_assignment_id,
      a.report_definition_id,
      a.report_period_id,
      a.scope_id,
      sc.name as scope_label,
      d.title as report_title,
      coalesce(p.title, p.period_key) as period_label,
      a.deadline_at,
      a.assignment_status,
      s.submission_status,
      case
        when a.assignment_status = 'SUBMITTED' then 'SUBMITTED'
        when a.deadline_at < now() then 'EXPIRED'
        when a.deadline_at <= now() + interval '24 hours' then 'DUE_SOON'
        else 'DUE'
      end as home_status,
      s.id as submission_id,
      false as has_unread_remarks
    from public.buklod_report_assignments a
    join public.buklod_report_definitions d on d.id = a.report_definition_id
    join public.buklod_report_periods p on p.id = a.report_period_id
    join public.buklod_scopes sc on sc.id = a.scope_id
    left join public.buklod_report_submissions s on s.assignment_id = a.id
    where a.assignee_user_id = auth.uid()
      and (p_scope_id is null or a.scope_id = p_scope_id)
      and a.assignment_status in ('OPEN', 'DUE', 'DUE_SOON', 'EXPIRED', 'SUBMITTED')
    order by a.deadline_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) q;
$function$;

grant execute on function public.buklod_report_my_assignments_v1(uuid, integer) to authenticated;

-- Called by pg_cron. Inserts canonical notifications only once; the existing
-- public.notifications webhook -> push Edge Function handles physical push.
create or replace function public.buklod_report_dispatch_due_notifications_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_due_count integer := 0;
  v_soon_count integer := 0;
  v_overdue_count integer := 0;
begin
  insert into public.notifications (user_id, title, body, kind, data)
  select
    a.assignee_user_id,
    'Report due within 24 hours',
    d.title || ' · due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'),
    'report_due',
    jsonb_build_object(
      'route', '/reports',
      'scope_id', a.scope_id,
      'report_definition_id', a.report_definition_id,
      'report_period_id', a.report_period_id,
      'report_assignment_id', a.id,
      'deadline_at', a.deadline_at,
      'event', 'report_due',
      'offset_minutes', 1440
    )
  from public.buklod_report_assignments a
  join public.buklod_report_definitions d on d.id = a.report_definition_id
  where a.assignee_user_id is not null
    and a.assignment_status <> 'SUBMITTED'
    and a.deadline_at > now() + interval '3 hours'
    and a.deadline_at <= now() + interval '24 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.assignee_user_id
        and n.kind = 'report_due'
        and n.data ->> 'report_assignment_id' = a.id::text
        and n.data ->> 'offset_minutes' = '1440'
    );
  get diagnostics v_due_count = row_count;

  insert into public.notifications (user_id, title, body, kind, data)
  select
    a.assignee_user_id,
    'Report due soon',
    d.title || ' · due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'HH12:MI AM'),
    'report_due_soon',
    jsonb_build_object(
      'route', '/reports',
      'scope_id', a.scope_id,
      'report_definition_id', a.report_definition_id,
      'report_period_id', a.report_period_id,
      'report_assignment_id', a.id,
      'deadline_at', a.deadline_at,
      'event', 'report_due_soon',
      'offset_minutes', 180
    )
  from public.buklod_report_assignments a
  join public.buklod_report_definitions d on d.id = a.report_definition_id
  where a.assignee_user_id is not null
    and a.assignment_status <> 'SUBMITTED'
    and a.deadline_at > now()
    and a.deadline_at <= now() + interval '3 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.assignee_user_id
        and n.kind = 'report_due_soon'
        and n.data ->> 'report_assignment_id' = a.id::text
        and n.data ->> 'offset_minutes' = '180'
    );
  get diagnostics v_soon_count = row_count;

  insert into public.notifications (user_id, title, body, kind, data)
  select
    a.assignee_user_id,
    'Report deadline passed',
    d.title || ' is overdue. You can still submit it for late reporting.',
    'report_expired',
    jsonb_build_object(
      'route', '/reports',
      'scope_id', a.scope_id,
      'report_definition_id', a.report_definition_id,
      'report_period_id', a.report_period_id,
      'report_assignment_id', a.id,
      'deadline_at', a.deadline_at,
      'event', 'report_expired'
    )
  from public.buklod_report_assignments a
  join public.buklod_report_definitions d on d.id = a.report_definition_id
  where a.assignee_user_id is not null
    and a.assignment_status <> 'SUBMITTED'
    and a.deadline_at <= now()
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.assignee_user_id
        and n.kind = 'report_expired'
        and n.data ->> 'report_assignment_id' = a.id::text
    );
  get diagnostics v_overdue_count = row_count;

  return jsonb_build_object(
    'report_due', v_due_count,
    'report_due_soon', v_soon_count,
    'report_overdue', v_overdue_count
  );
end;
$function$;

revoke all on function public.buklod_report_dispatch_due_notifications_v1() from public, anon, authenticated;
grant execute on function public.buklod_report_dispatch_due_notifications_v1() to service_role;

-- Idempotent scheduler registration. Existing report scheduler with this name
-- is retained if already present.
do $block$
begin
  if not exists (
    select 1 from cron.job where jobname = 'buklod-report-deadline-push-r1'
  ) then
    perform cron.schedule(
      'buklod-report-deadline-push-r1',
      '*/15 * * * *',
      'select public.buklod_report_dispatch_due_notifications_v1();'
    );
  end if;
end;
$block$;
