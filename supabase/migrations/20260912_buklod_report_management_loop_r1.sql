create table if not exists public.buklod_report_actions (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  submission_id uuid null references public.buklod_report_submissions(id) on delete set null,
  assignee_user_id uuid null references auth.users(id) on delete set null,
  action_type text not null,
  title text not null,
  rationale text null,
  status text not null default 'PLANNED',
  priority text not null default 'NORMAL',
  due_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  outcome text null,
  next_action text null,
  source_kind text not null default 'SUPERVISOR',
  created_by uuid not null references auth.users(id) on delete restrict,
  completed_by uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_report_actions_type_check check (action_type in (
    'FEEDBACK','FOLLOW_UP','MENTORING','COUNSELLING','VISITATION','LEADERSHIP_TRAINING',
    'SUPPORT','WARNING','REASSIGNMENT_REVIEW','SUSPENSION_REVIEW','DISMISSAL_REVIEW','OTHER'
  )),
  constraint buklod_report_actions_status_check check (status in (
    'SUGGESTED','PLANNED','ACKNOWLEDGED','IN_PROGRESS','DONE','CANCELLED'
  )),
  constraint buklod_report_actions_priority_check check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  constraint buklod_report_actions_source_check check (source_kind in ('AUTO_RULE','SUPERVISOR','SYSTEM'))
);

create index if not exists buklod_report_actions_scope_status_idx
  on public.buklod_report_actions(scope_id, status, created_at desc);
create index if not exists buklod_report_actions_assignee_idx
  on public.buklod_report_actions(assignee_user_id, status, due_at);
create index if not exists buklod_report_actions_submission_idx
  on public.buklod_report_actions(submission_id, created_at desc);

alter table public.buklod_report_actions enable row level security;

create or replace function public.buklod_report_scope_management_data_v1(
  p_scope_id uuid,
  p_from_at timestamptz default null,
  p_to_at timestamptz default null,
  p_definition_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_scope_id is null then raise exception 'Scope is required'; end if;
  perform public.buklod_report_assert_definition_admin_v1(p_scope_id);

  if p_definition_id is not null and not exists (
    select 1 from public.buklod_report_definitions d
    where d.id = p_definition_id and d.scope_id = p_scope_id
  ) then
    raise exception 'Report definition does not belong to this scope';
  end if;

  return jsonb_build_object(
    'scope', coalesce((
      select jsonb_build_object('id', s.id, 'name', s.name, 'scope_type', s.scope_type)
      from public.buklod_scopes s where s.id = p_scope_id
    ), '{}'::jsonb),
    'range', jsonb_build_object('from_at', p_from_at, 'to_at', p_to_at),
    'definitions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'code', d.code,
        'title', d.title,
        'recurrence_kind', d.recurrence_kind,
        'status', d.status,
        'content_requirements', d.content_requirements
      ) order by d.title)
      from public.buklod_report_definitions d
      where d.scope_id = p_scope_id
        and (p_definition_id is null or d.id = p_definition_id)
    ), '[]'::jsonb),
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'definition_id', p.report_definition_id,
        'definition_title', d.title,
        'title', p.title,
        'period_key', p.period_key,
        'opens_at', p.opens_at,
        'due_at', p.due_at,
        'closes_at', p.closes_at,
        'status', p.status,
        'assigned_count', (select count(*) from public.buklod_report_assignments a where a.report_period_id = p.id),
        'submitted_count', (select count(*) from public.buklod_report_assignments a where a.report_period_id = p.id and a.assignment_status = 'SUBMITTED'),
        'overdue_count', (select count(*) from public.buklod_report_assignments a where a.report_period_id = p.id and a.assignment_status <> 'SUBMITTED' and a.deadline_at < now())
      ) order by p.due_at desc)
      from public.buklod_report_periods p
      join public.buklod_report_definitions d on d.id = p.report_definition_id
      where p.scope_id = p_scope_id
        and (p_definition_id is null or p.report_definition_id = p_definition_id)
        and (p_from_at is null or p.due_at >= p_from_at)
        and (p_to_at is null or p.due_at < p_to_at)
    ), '[]'::jsonb),
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'submission_id', s.id,
        'assignment_id', s.assignment_id,
        'definition_id', s.report_definition_id,
        'definition_title', d.title,
        'period_id', s.report_period_id,
        'period_title', p.title,
        'period_key', p.period_key,
        'submitter_user_id', s.submitter_user_id,
        'submitter_name', coalesce(pr.full_name, pr.username, s.submitter_user_id::text),
        'submitter_username', pr.username,
        'submission_status', s.submission_status,
        'review_status', s.review_status,
        'submitted_at', s.submitted_at,
        'content', s.content,
        'extracted_metrics', s.extracted_metrics,
        'validation_summary', s.validation_summary
      ) order by p.due_at desc, coalesce(pr.full_name, pr.username, s.submitter_user_id::text))
      from public.buklod_report_submissions s
      join public.buklod_report_periods p on p.id = s.report_period_id
      join public.buklod_report_definitions d on d.id = s.report_definition_id
      left join public.profiles pr on pr.id = s.submitter_user_id
      where s.scope_id = p_scope_id
        and s.submission_status <> 'DRAFT'
        and (p_definition_id is null or s.report_definition_id = p_definition_id)
        and (p_from_at is null or p.due_at >= p_from_at)
        and (p_to_at is null or p.due_at < p_to_at)
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'name', x.name,
        'username', x.username,
        'assigned_count', x.assigned_count,
        'submitted_count', x.submitted_count,
        'pending_count', x.pending_count,
        'overdue_count', x.overdue_count,
        'last_deadline_at', x.last_deadline_at
      ) order by x.overdue_count desc, x.pending_count desc, x.name)
      from (
        select
          a.assignee_user_id as user_id,
          coalesce(pr.full_name, pr.username, a.assignee_user_id::text) as name,
          pr.username,
          count(*)::int as assigned_count,
          count(*) filter (where a.assignment_status = 'SUBMITTED')::int as submitted_count,
          count(*) filter (where a.assignment_status <> 'SUBMITTED')::int as pending_count,
          count(*) filter (where a.assignment_status <> 'SUBMITTED' and a.deadline_at < now())::int as overdue_count,
          max(a.deadline_at) as last_deadline_at
        from public.buklod_report_assignments a
        join public.buklod_report_periods p on p.id = a.report_period_id
        left join public.profiles pr on pr.id = a.assignee_user_id
        where a.scope_id = p_scope_id
          and (p_definition_id is null or a.report_definition_id = p_definition_id)
          and (p_from_at is null or p.due_at >= p_from_at)
          and (p_to_at is null or p.due_at < p_to_at)
        group by a.assignee_user_id, pr.full_name, pr.username
      ) x
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'scope_id', a.scope_id,
        'submission_id', a.submission_id,
        'assignee_user_id', a.assignee_user_id,
        'assignee_name', coalesce(pr.full_name, pr.username, a.assignee_user_id::text),
        'action_type', a.action_type,
        'title', a.title,
        'rationale', a.rationale,
        'status', a.status,
        'priority', a.priority,
        'due_at', a.due_at,
        'started_at', a.started_at,
        'completed_at', a.completed_at,
        'outcome', a.outcome,
        'next_action', a.next_action,
        'source_kind', a.source_kind,
        'metadata', a.metadata,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) order by case when a.status = 'DONE' then 1 else 0 end, a.due_at nulls last, a.created_at desc)
      from public.buklod_report_actions a
      left join public.profiles pr on pr.id = a.assignee_user_id
      left join public.buklod_report_submissions rs on rs.id = a.submission_id
      where a.scope_id = p_scope_id
        and (p_definition_id is null or rs.report_definition_id = p_definition_id or a.submission_id is null)
        and (p_from_at is null or coalesce(a.due_at, a.created_at) >= p_from_at)
        and (p_to_at is null or coalesce(a.due_at, a.created_at) < p_to_at)
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.buklod_report_upsert_action_v1(
  p_scope_id uuid,
  p_action_type text,
  p_title text,
  p_assignee_user_id uuid default null,
  p_submission_id uuid default null,
  p_rationale text default null,
  p_due_at timestamptz default null,
  p_priority text default 'NORMAL',
  p_status text default 'PLANNED',
  p_action_id uuid default null,
  p_outcome text default null,
  p_next_action text default null,
  p_source_kind text default 'SUPERVISOR'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_row public.buklod_report_actions%rowtype;
  v_type text := upper(coalesce(p_action_type, ''));
  v_status text := upper(coalesce(p_status, 'PLANNED'));
  v_priority text := upper(coalesce(p_priority, 'NORMAL'));
  v_source text := upper(coalesce(p_source_kind, 'SUPERVISOR'));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  perform public.buklod_report_assert_definition_admin_v1(p_scope_id);
  if nullif(btrim(p_title), '') is null then raise exception 'Action title is required'; end if;
  if v_type not in ('FEEDBACK','FOLLOW_UP','MENTORING','COUNSELLING','VISITATION','LEADERSHIP_TRAINING','SUPPORT','WARNING','REASSIGNMENT_REVIEW','SUSPENSION_REVIEW','DISMISSAL_REVIEW','OTHER') then raise exception 'Unsupported action type'; end if;
  if v_status not in ('SUGGESTED','PLANNED','ACKNOWLEDGED','IN_PROGRESS','DONE','CANCELLED') then raise exception 'Unsupported action status'; end if;
  if v_priority not in ('LOW','NORMAL','HIGH','URGENT') then raise exception 'Unsupported priority'; end if;
  if v_source not in ('AUTO_RULE','SUPERVISOR','SYSTEM') then raise exception 'Unsupported source kind'; end if;
  if p_submission_id is not null and not exists (select 1 from public.buklod_report_submissions s where s.id = p_submission_id and s.scope_id = p_scope_id) then raise exception 'Submission does not belong to this scope'; end if;

  if p_action_id is null then
    insert into public.buklod_report_actions (
      scope_id, submission_id, assignee_user_id, action_type, title, rationale,
      status, priority, due_at, source_kind, created_by, started_at,
      completed_at, completed_by, outcome, next_action
    ) values (
      p_scope_id, p_submission_id, p_assignee_user_id, v_type, btrim(p_title), nullif(btrim(coalesce(p_rationale, '')), ''),
      v_status, v_priority, p_due_at, v_source, v_actor,
      case when v_status = 'IN_PROGRESS' then now() else null end,
      case when v_status = 'DONE' then now() else null end,
      case when v_status = 'DONE' then v_actor else null end,
      nullif(btrim(coalesce(p_outcome, '')), ''), nullif(btrim(coalesce(p_next_action, '')), '')
    ) returning * into v_row;
  else
    update public.buklod_report_actions
    set action_type = v_type,
        title = btrim(p_title),
        assignee_user_id = p_assignee_user_id,
        submission_id = p_submission_id,
        rationale = nullif(btrim(coalesce(p_rationale, '')), ''),
        status = v_status,
        priority = v_priority,
        due_at = p_due_at,
        source_kind = v_source,
        started_at = case when v_status = 'IN_PROGRESS' and started_at is null then now() else started_at end,
        completed_at = case when v_status = 'DONE' then coalesce(completed_at, now()) else null end,
        completed_by = case when v_status = 'DONE' then coalesce(completed_by, v_actor) else null end,
        outcome = nullif(btrim(coalesce(p_outcome, '')), ''),
        next_action = nullif(btrim(coalesce(p_next_action, '')), ''),
        updated_at = now()
    where id = p_action_id and scope_id = p_scope_id
    returning * into v_row;
    if not found then raise exception 'Action was not found in this scope'; end if;
  end if;

  insert into public.buklod_report_audit_log(scope_id, actor_user_id, action, target_type, target_id, details)
  values (p_scope_id, v_actor, case when p_action_id is null then 'REPORT_ACTION_CREATED' else 'REPORT_ACTION_UPDATED' end,
          'REPORT_ACTION', v_row.id,
          jsonb_build_object('action_type', v_row.action_type, 'status', v_row.status, 'assignee_user_id', v_row.assignee_user_id, 'submission_id', v_row.submission_id));

  return to_jsonb(v_row);
end;
$function$;

create or replace function public.buklod_report_my_actions_v1(p_scope_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'scope_id', a.scope_id, 'submission_id', a.submission_id,
      'action_type', a.action_type, 'title', a.title, 'rationale', a.rationale,
      'status', a.status, 'priority', a.priority, 'due_at', a.due_at,
      'started_at', a.started_at, 'completed_at', a.completed_at,
      'outcome', a.outcome, 'next_action', a.next_action,
      'created_at', a.created_at, 'updated_at', a.updated_at
    ) order by case when a.status = 'DONE' then 1 else 0 end, a.due_at nulls last, a.created_at desc)
    from public.buklod_report_actions a
    where a.assignee_user_id = v_user
      and (p_scope_id is null or a.scope_id = p_scope_id)
      and a.status <> 'CANCELLED'
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.buklod_report_update_my_action_v1(
  p_action_id uuid,
  p_status text,
  p_outcome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_status text := upper(coalesce(p_status, ''));
  v_row public.buklod_report_actions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_status not in ('ACKNOWLEDGED','IN_PROGRESS','DONE') then raise exception 'Only acknowledgement, in-progress, or done updates are allowed'; end if;

  update public.buklod_report_actions
  set status = v_status,
      started_at = case when v_status in ('IN_PROGRESS','DONE') then coalesce(started_at, now()) else started_at end,
      completed_at = case when v_status = 'DONE' then coalesce(completed_at, now()) else completed_at end,
      completed_by = case when v_status = 'DONE' then v_user else completed_by end,
      outcome = case when p_outcome is null then outcome else nullif(btrim(p_outcome), '') end,
      updated_at = now()
  where id = p_action_id and assignee_user_id = v_user and status <> 'CANCELLED'
  returning * into v_row;
  if not found then raise exception 'Assigned action not found'; end if;

  insert into public.buklod_report_audit_log(scope_id, actor_user_id, action, target_type, target_id, details)
  values (v_row.scope_id, v_user, 'REPORT_ACTION_SELF_UPDATED', 'REPORT_ACTION', v_row.id, jsonb_build_object('status', v_row.status));
  return to_jsonb(v_row);
end;
$function$;

revoke all on table public.buklod_report_actions from anon, authenticated;
revoke all on function public.buklod_report_scope_management_data_v1(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.buklod_report_upsert_action_v1(uuid, text, text, uuid, uuid, text, timestamptz, text, text, uuid, text, text, text) from public, anon;
revoke all on function public.buklod_report_my_actions_v1(uuid) from public, anon;
revoke all on function public.buklod_report_update_my_action_v1(uuid, text, text) from public, anon;
grant execute on function public.buklod_report_scope_management_data_v1(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.buklod_report_upsert_action_v1(uuid, text, text, uuid, uuid, text, timestamptz, text, text, uuid, text, text, text) to authenticated;
grant execute on function public.buklod_report_my_actions_v1(uuid) to authenticated;
grant execute on function public.buklod_report_update_my_action_v1(uuid, text, text) to authenticated;
