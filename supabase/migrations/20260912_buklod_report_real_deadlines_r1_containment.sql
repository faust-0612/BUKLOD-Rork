-- Containment for BUKLOD Report real-deadline reminder dispatch.
-- Only assignments explicitly created by the real deadline publisher are eligible.

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
  select a.assignee_user_id,
    'Report due within 24 hours',
    d.title || ' · due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM'),
    'report_due',
    jsonb_build_object(
      'route','/reports',
      'scope_id',a.scope_id,
      'report_definition_id',a.report_definition_id,
      'report_period_id',a.report_period_id,
      'report_assignment_id',a.id,
      'deadline_at',a.deadline_at,
      'event','report_due',
      'offset_minutes',1440
    )
  from public.buklod_report_assignments a
  join public.buklod_report_definitions d on d.id = a.report_definition_id
  where a.assignee_user_id is not null
    and a.assignment_status <> 'SUBMITTED'
    and a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
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
  select a.assignee_user_id,
    'Report due soon',
    d.title || ' · due ' || to_char(a.deadline_at at time zone 'Asia/Manila', 'HH12:MI AM'),
    'report_due_soon',
    jsonb_build_object(
      'route','/reports',
      'scope_id',a.scope_id,
      'report_definition_id',a.report_definition_id,
      'report_period_id',a.report_period_id,
      'report_assignment_id',a.id,
      'deadline_at',a.deadline_at,
      'event','report_due_soon',
      'offset_minutes',180
    )
  from public.buklod_report_assignments a
  join public.buklod_report_definitions d on d.id = a.report_definition_id
  where a.assignee_user_id is not null
    and a.assignment_status <> 'SUBMITTED'
    and a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
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
  select a.assignee_user_id,
    'Report deadline passed',
    d.title || ' is overdue. You can still submit it for late reporting.',
    'report_expired',
    jsonb_build_object(
      'route','/reports',
      'scope_id',a.scope_id,
      'report_definition_id',a.report_definition_id,
      'report_period_id',a.report_period_id,
      'report_assignment_id',a.id,
      'deadline_at',a.deadline_at,
      'event','report_expired'
    )
  from public.buklod_report_assignments a
  join public.buklod_report_definitions d on d.id = a.report_definition_id
  where a.assignee_user_id is not null
    and a.assignment_status <> 'SUBMITTED'
    and a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
    and a.deadline_at <= now()
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.assignee_user_id
        and n.kind = 'report_expired'
        and n.data ->> 'report_assignment_id' = a.id::text
    );
  get diagnostics v_overdue_count = row_count;

  return jsonb_build_object(
    'report_due',v_due_count,
    'report_due_soon',v_soon_count,
    'report_overdue',v_overdue_count
  );
end;
$function$;

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
