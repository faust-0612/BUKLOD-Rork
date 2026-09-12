-- Enforce the reporting period window in the canonical submission RPC.
-- Existing Quick Weekly periods remain unaffected when already open and with
-- closes_at NULL. Real scheduled deadlines cannot be saved early or after an
-- explicit close time.

create or replace function public.buklod_report_submission_save_v1(
  p_assignment_id uuid,
  p_content jsonb,
  p_submit boolean default false,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_assignment public.buklod_report_assignments%rowtype;
  v_period public.buklod_report_periods%rowtype;
  v_submission public.buklod_report_submissions%rowtype;
  v_next_version integer := 1;
  v_now timestamptz := now();
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if p_assignment_id is null then raise exception 'Assignment is required'; end if;

  select * into v_assignment
  from public.buklod_report_assignments a
  where a.id=p_assignment_id;
  if not found then raise exception 'Report assignment not found'; end if;

  if v_assignment.assignee_user_id <> v_actor and not public.buklod_is_system_admin() then
    raise exception 'Not authorized for this report assignment';
  end if;

  select * into v_period
  from public.buklod_report_periods p
  where p.id=v_assignment.report_period_id;
  if not found then raise exception 'Report period not found'; end if;

  if v_period.opens_at is not null and v_now < v_period.opens_at then
    raise exception 'Report is not open yet';
  end if;

  if v_period.closes_at is not null and v_now > v_period.closes_at then
    raise exception 'Report is closed. Authorized admin must reopen or extend.';
  end if;

  if v_assignment.assignment_status='EXPIRED' then
    raise exception 'Report assignment expired. Authorized admin must extend or reopen.';
  end if;

  select * into v_submission
  from public.buklod_report_submissions s
  where s.assignment_id=p_assignment_id
  for update;

  if found and v_submission.submission_status not in ('DRAFT','NEEDS_REVISION','REJECTED') and not p_submit then
    return jsonb_build_object(
      'scope_id',v_submission.scope_id,
      'report_definition_id',v_submission.report_definition_id,
      'report_period_id',v_submission.report_period_id,
      'report_assignment_id',v_submission.assignment_id,
      'submission_id',v_submission.id,
      'assignment_status',v_assignment.assignment_status,
      'submission_status',v_submission.submission_status,
      'submitted_at',v_submission.submitted_at,
      'content',v_submission.content
    );
  end if;

  if found then
    v_next_version := case when p_submit then v_submission.current_version_no + 1 else v_submission.current_version_no end;
    update public.buklod_report_submissions
    set content=coalesce(p_content,'{}'::jsonb),
        submission_status=case when p_submit then 'SUBMITTED' else 'DRAFT' end,
        review_status=case when p_submit then 'SUBMITTED' else null end,
        current_version_no=v_next_version,
        idempotency_key=coalesce(nullif(btrim(p_idempotency_key),''),idempotency_key),
        submitted_at=case when p_submit then v_now else submitted_at end,
        updated_at=v_now,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('source','BUKLOD_REPORT','last_saved_by',v_actor)
    where id=v_submission.id
    returning * into v_submission;
  else
    insert into public.buklod_report_submissions (
      assignment_id, report_definition_id, report_period_id, scope_id,
      submitter_user_id, submission_status, review_status, content,
      current_version_no, idempotency_key, submitted_at, metadata
    ) values (
      v_assignment.id, v_assignment.report_definition_id, v_assignment.report_period_id,
      v_assignment.scope_id, v_actor,
      case when p_submit then 'SUBMITTED' else 'DRAFT' end,
      case when p_submit then 'SUBMITTED' else null end,
      coalesce(p_content,'{}'::jsonb),
      1,
      nullif(btrim(p_idempotency_key),''),
      case when p_submit then v_now else null end,
      jsonb_build_object('source','BUKLOD_REPORT','created_by',v_actor)
    ) returning * into v_submission;
    v_next_version := 1;
  end if;

  if p_submit then
    insert into public.buklod_report_submission_versions (
      submission_id, version_no, submission_status, content,
      extracted_metrics, submitted_by, submitted_at, metadata
    ) values (
      v_submission.id, v_next_version, 'SUBMITTED', v_submission.content,
      coalesce(v_submission.extracted_metrics,'{}'::jsonb), v_actor, v_now,
      jsonb_build_object('source','BUKLOD_REPORT')
    ) on conflict (submission_id,version_no) do nothing;

    update public.buklod_report_assignments
    set assignment_status='SUBMITTED', updated_at=v_now
    where id=v_assignment.id
    returning * into v_assignment;

    update public.buklod_report_reminders
    set status='DONE', completed_at=coalesce(completed_at,v_now), updated_at=v_now,
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('auto_closed_by_submission',v_submission.id)
    where assignment_id=v_assignment.id and assigned_user_id=v_actor and status='ACTIVE';

    insert into public.buklod_report_audit_log(scope_id,actor_user_id,action,target_type,target_id,details)
    values (v_assignment.scope_id,v_actor,'REPORT_SUBMITTED','REPORT_SUBMISSION',v_submission.id,
      jsonb_build_object('assignment_id',v_assignment.id,'period_id',v_assignment.report_period_id));
  end if;

  return jsonb_build_object(
    'scope_id',v_submission.scope_id,
    'report_definition_id',v_submission.report_definition_id,
    'report_period_id',v_submission.report_period_id,
    'report_assignment_id',v_submission.assignment_id,
    'submission_id',v_submission.id,
    'assignment_status',v_assignment.assignment_status,
    'submission_status',v_submission.submission_status,
    'submitted_at',v_submission.submitted_at,
    'content',v_submission.content
  );
end;
$function$;
