-- BUKLOD Report: keep live report assignments synchronized with ACTIVE org/cluster membership.
-- Backfills current live assignments for already-active members and prevents stale assignments
-- from surfacing after a member is no longer ACTIVE.

create or replace function public.buklod_report_sync_member_assignments_v1(
  p_scope_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_membership public.buklod_scope_memberships%rowtype;
  v_row record;
  v_count integer := 0;
begin
  if p_scope_id is null or p_user_id is null then
    return 0;
  end if;

  select * into v_membership
  from public.buklod_scope_memberships m
  where m.scope_id = p_scope_id
    and m.user_id = p_user_id
    and m.membership_status = 'ACTIVE'
    and m.left_at is null;
  if not found then
    return 0;
  end if;

  if not exists (
    select 1
    from public.buklod_scopes s
    where s.id = p_scope_id
      and upper(coalesce(s.scope_type::text, '')) in ('ORGANIZATION', 'CLUSTER')
      and coalesce(s.status::text, 'ACTIVE') not in ('DELETED', 'ARCHIVED')
  ) then
    return 0;
  end if;

  for v_row in
    insert into public.buklod_report_assignments (
      report_definition_id, report_period_id, scope_id, assignee_user_id,
      assignment_status, deadline_at, original_deadline_at, metadata
    )
    select
      d.id,
      p.id,
      p.scope_id,
      p_user_id,
      'OPEN',
      p.due_at,
      p.due_at,
      jsonb_build_object(
        'source', 'BUKLOD_REPORT_REAL_DEADLINE_R1',
        'assignment_origin', 'ACTIVE_MEMBERSHIP_SYNC_R1',
        'synced_at', now(),
        'published_by', p.metadata ->> 'published_by',
        'scope_type', upper(sc.scope_type::text),
        'scope_name', sc.name,
        'membership_snapshot', jsonb_build_object(
          'membership_id', v_membership.id,
          'membership_status', v_membership.membership_status,
          'joined_at', v_membership.joined_at
        )
      )
    from public.buklod_report_periods p
    join public.buklod_report_definitions d on d.id = p.report_definition_id
    join public.buklod_scopes sc on sc.id = p.scope_id
    where p.scope_id = p_scope_id
      and p.metadata ->> 'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
      and p.status in ('SCHEDULED', 'OPEN')
      and p.due_at >= now()
      and (p.closes_at is null or p.closes_at >= now())
      and coalesce(d.status::text, 'DRAFT') <> 'ARCHIVED'
    on conflict (report_definition_id, report_period_id, assignee_user_id) do nothing
    returning id, report_definition_id, report_period_id, scope_id, deadline_at
  loop
    v_count := v_count + 1;

    insert into public.buklod_report_reminders (
      scope_id, assignment_id, assigned_user_id, created_by,
      reminder_kind, title, body, due_at, priority, status, metadata
    )
    select
      v_row.scope_id,
      v_row.id,
      p_user_id,
      null,
      'DEADLINE',
      d.title || ' deadline',
      'Due ' || to_char(v_row.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.',
      v_row.deadline_at,
      'NORMAL',
      'ACTIVE',
      jsonb_build_object(
        'source', 'BUKLOD_REPORT_REAL_DEADLINE_R1',
        'assignment_origin', 'ACTIVE_MEMBERSHIP_SYNC_R1',
        'report_period_id', v_row.report_period_id,
        'reminder_offsets_minutes', jsonb_build_array(1440, 180)
      )
    from public.buklod_report_definitions d
    where d.id = v_row.report_definition_id
    on conflict (assignment_id, assigned_user_id, reminder_kind)
      where assignment_id is not null and reminder_kind = 'DEADLINE'
    do nothing;

    insert into public.notifications (user_id, title, body, kind, data)
    select
      p_user_id,
      'New report assigned',
      d.title || ' · due ' || to_char(v_row.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'),
      'report_assigned',
      jsonb_build_object(
        'route', '/reports',
        'scope_id', v_row.scope_id,
        'report_definition_id', v_row.report_definition_id,
        'report_period_id', v_row.report_period_id,
        'report_assignment_id', v_row.id,
        'deadline_at', v_row.deadline_at,
        'event', 'report_assigned',
        'assignment_origin', 'ACTIVE_MEMBERSHIP_SYNC_R1'
      )
    from public.buklod_report_definitions d
    where d.id = v_row.report_definition_id
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = p_user_id
          and n.kind = 'report_assigned'
          and n.data ->> 'report_assignment_id' = v_row.id::text
      );
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.buklod_report_sync_member_assignments_v1(uuid, uuid) from public, anon, authenticated;

create or replace function public.buklod_report_membership_assignment_sync_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.membership_status = 'ACTIVE' and new.left_at is null then
    if tg_op = 'INSERT' then
      perform public.buklod_report_sync_member_assignments_v1(new.scope_id, new.user_id);
    elsif old.membership_status is distinct from new.membership_status
       or old.left_at is distinct from new.left_at
       or old.scope_id is distinct from new.scope_id
       or old.user_id is distinct from new.user_id
    then
      perform public.buklod_report_sync_member_assignments_v1(new.scope_id, new.user_id);
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.buklod_report_membership_assignment_sync_trigger_v1() from public, anon, authenticated;

drop trigger if exists buklod_report_sync_membership_assignments on public.buklod_scope_memberships;
create trigger buklod_report_sync_membership_assignments
after insert or update on public.buklod_scope_memberships
for each row execute function public.buklod_report_membership_assignment_sync_trigger_v1();

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
      and exists (
        select 1
        from public.buklod_scope_memberships m
        where m.scope_id = a.scope_id
          and m.user_id = auth.uid()
          and m.membership_status = 'ACTIVE'
          and m.left_at is null
      )
      and upper(coalesce(sc.scope_type::text, '')) in ('ORGANIZATION', 'CLUSTER')
      and coalesce(d.status::text, 'DRAFT') <> 'ARCHIVED'
      and (p_scope_id is null or a.scope_id = p_scope_id)
      and a.assignment_status in ('OPEN', 'DUE', 'DUE_SOON', 'EXPIRED', 'SUBMITTED')
      and (
        a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
        or not exists (
          select 1
          from public.buklod_report_assignments real_a
          where real_a.assignee_user_id = a.assignee_user_id
            and real_a.scope_id = a.scope_id
            and real_a.assignment_status <> 'SUBMITTED'
            and real_a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
        )
      )
    order by
      case when a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1' then 0 else 1 end,
      a.deadline_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) q;
$function$;

do $backfill$
declare
  v_member record;
begin
  for v_member in
    select m.scope_id, m.user_id
    from public.buklod_scope_memberships m
    join public.buklod_scopes s on s.id = m.scope_id
    where m.membership_status = 'ACTIVE'
      and m.left_at is null
      and m.user_id is not null
      and upper(coalesce(s.scope_type::text, '')) in ('ORGANIZATION', 'CLUSTER')
      and coalesce(s.status::text, 'ACTIVE') not in ('DELETED', 'ARCHIVED')
  loop
    perform public.buklod_report_sync_member_assignments_v1(v_member.scope_id, v_member.user_id);
  end loop;
end;
$backfill$;
