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

  if p_assignee_user_id is not null and not exists (
    select 1
    from public.buklod_scope_memberships m
    where m.scope_id = p_scope_id
      and m.user_id = p_assignee_user_id
      and m.membership_status = 'ACTIVE'
  ) then
    raise exception 'Action assignee must be an active member of this scope';
  end if;

  if p_submission_id is not null and not exists (
    select 1
    from public.buklod_report_submissions s
    where s.id = p_submission_id
      and s.scope_id = p_scope_id
  ) then
    raise exception 'Submission does not belong to this scope';
  end if;

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
  values (
    p_scope_id,
    v_actor,
    case when p_action_id is null then 'REPORT_ACTION_CREATED' else 'REPORT_ACTION_UPDATED' end,
    'REPORT_ACTION',
    v_row.id,
    jsonb_build_object(
      'action_type', v_row.action_type,
      'status', v_row.status,
      'assignee_user_id', v_row.assignee_user_id,
      'submission_id', v_row.submission_id
    )
  );

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
      'id', a.id,
      'scope_id', a.scope_id,
      'submission_id', a.submission_id,
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
      'created_at', a.created_at,
      'updated_at', a.updated_at
    ) order by case when a.status = 'DONE' then 1 else 0 end, a.due_at nulls last, a.created_at desc)
    from public.buklod_report_actions a
    where a.assignee_user_id = v_user
      and (p_scope_id is null or a.scope_id = p_scope_id)
      and a.status <> 'CANCELLED'
      and a.action_type not in ('REASSIGNMENT_REVIEW','SUSPENSION_REVIEW','DISMISSAL_REVIEW')
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
  if v_status not in ('ACKNOWLEDGED','IN_PROGRESS','DONE') then
    raise exception 'Only acknowledgement, in-progress, or done updates are allowed';
  end if;

  update public.buklod_report_actions
  set status = v_status,
      started_at = case when v_status in ('IN_PROGRESS','DONE') then coalesce(started_at, now()) else started_at end,
      completed_at = case when v_status = 'DONE' then coalesce(completed_at, now()) else completed_at end,
      completed_by = case when v_status = 'DONE' then v_user else completed_by end,
      outcome = case when p_outcome is null then outcome else nullif(btrim(p_outcome), '') end,
      updated_at = now()
  where id = p_action_id
    and assignee_user_id = v_user
    and status <> 'CANCELLED'
    and action_type not in ('REASSIGNMENT_REVIEW','SUSPENSION_REVIEW','DISMISSAL_REVIEW')
  returning * into v_row;

  if not found then raise exception 'Assigned action not found or requires supervisor-only review'; end if;

  insert into public.buklod_report_audit_log(scope_id, actor_user_id, action, target_type, target_id, details)
  values (
    v_row.scope_id,
    v_user,
    'REPORT_ACTION_SELF_UPDATED',
    'REPORT_ACTION',
    v_row.id,
    jsonb_build_object('status', v_row.status)
  );

  return to_jsonb(v_row);
end;
$function$;

revoke all on function public.buklod_report_upsert_action_v1(uuid, text, text, uuid, uuid, text, timestamptz, text, text, uuid, text, text, text) from public, anon;
revoke all on function public.buklod_report_my_actions_v1(uuid) from public, anon;
revoke all on function public.buklod_report_update_my_action_v1(uuid, text, text) from public, anon;

grant execute on function public.buklod_report_upsert_action_v1(uuid, text, text, uuid, uuid, text, timestamptz, text, text, uuid, text, text, text) to authenticated;
grant execute on function public.buklod_report_my_actions_v1(uuid) to authenticated;
grant execute on function public.buklod_report_update_my_action_v1(uuid, text, text) to authenticated;
