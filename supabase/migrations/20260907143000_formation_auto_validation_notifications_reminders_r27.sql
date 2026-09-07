-- BUKLOD MAIN R27
-- Stability-first additive hardening for formation validation, notifications,
-- exact-scope review lifecycle, and scheduled reminders.
-- No env/auth/RLS/project switch. Existing exact-scope routing remains authoritative.

create or replace function public.buklod_queue_notification_once_v1(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_kind text,
  p_data jsonb,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_existing uuid;
  v_data jsonb := coalesce(p_data, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key);
begin
  if p_user_id is null or trim(coalesce(p_dedupe_key, '')) = '' then
    return null;
  end if;

  select n.id into v_existing
  from public.notifications n
  where n.user_id = p_user_id
    and n.data->>'dedupe_key' = p_dedupe_key
  order by n.created_at desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  return public.queue_notification(
    p_user_id,
    p_title,
    p_body,
    p_kind,
    v_data
  );
end;
$function$;

create or replace function public.buklod_scope_formation_approver_ids_v1(
  p_scope_id uuid
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path to ''
as $function$
  with scope_row as (
    select s.id, s.scope_type, s.organization_id, s.parent_scope_id
    from public.buklod_scopes s
    where s.id = p_scope_id
      and s.status not in ('SUSPENDED','DELETED')
  ),
  candidates as (
    select ra.user_id, 1 as priority
    from public.buklod_scope_role_assignments ra
    where ra.scope_id = p_scope_id
      and ra.status = 'ACTIVE'
      and ra.role_key in (
        'ADMIN','ORG_ADMIN','ORGANIZATION_ADMIN',
        'CLUSTER_ADMIN','CLUSTER_HEAD','PASTOR','MENTOR'
      )

    union all

    select a.user_id, 2 as priority
    from public.buklod_scope_member_functional_roles a
    join public.buklod_scope_functional_roles r on r.id = a.role_id
    where a.scope_id = p_scope_id
      and coalesce(r.is_active, true) = true
      and (
        coalesce(r.name, '') ilike '%pastor%'
        or coalesce(r.name, '') ilike '%mentor%'
        or coalesce(r.name, '') ilike '%cluster head%'
        or coalesce(r.name, '') ilike '%cluster admin%'
      )

    union all

    select ra.user_id, 3 as priority
    from scope_row s
    join public.buklod_scope_role_assignments ra
      on ra.scope_id = coalesce(s.organization_id, s.parent_scope_id)
    where s.scope_type = 'CLUSTER'
      and ra.status = 'ACTIVE'
      and ra.role_key in ('ADMIN','ORG_ADMIN','ORGANIZATION_ADMIN')
  ),
  ranked as (
    select c.user_id, min(c.priority) as priority
    from candidates c
    where c.user_id is not null
    group by c.user_id
  )
  select r.user_id
  from ranked r
  join public.profiles p on p.id = r.user_id and p.is_active = true
  where public.buklod_is_formation_scope_approver_v1(p_scope_id, r.user_id)
  order by r.priority, r.user_id;
$function$;

create or replace function public.buklod_notify_scope_formation_pending_v1(
  p_approval_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row record;
  v_admin uuid;
  v_label text;
begin
  select a.* into v_row
  from public.buklod_scope_formation_approvals_v2 a
  where a.id = p_approval_id;

  if v_row.id is null or v_row.status <> 'PENDING' then
    return;
  end if;

  v_label := case v_row.item_kind
    when 'DAILY_READING' then 'Daily Reading'
    when 'DAILY_DEVOTION' then 'Daily Devotion'
    when 'LESSON' then 'BUKLOD Lesson'
    else 'Formation submission'
  end;

  perform public.buklod_queue_notification_once_v1(
    v_row.learner_id,
    v_label || ' submitted',
    'Your response was submitted. We will notify you once it has been approved or if it needs improvement.',
    'formation_pending',
    jsonb_build_object(
      'approval_id', v_row.id,
      'scope_id', v_row.scope_id,
      'item_kind', v_row.item_kind,
      'item_id', v_row.item_id
    ),
    'formation:pending:user:' || v_row.id::text
  );

  for v_admin in
    select x.user_id
    from public.buklod_scope_formation_approver_ids_v1(v_row.scope_id) x
    where x.user_id <> v_row.learner_id
  loop
    perform public.buklod_queue_notification_once_v1(
      v_admin,
      v_label || ' needs review',
      'A submission is waiting in the exact scope where the learner submitted it.',
      'formation_approval_pending',
      jsonb_build_object(
        'approval_id', v_row.id,
        'scope_id', v_row.scope_id,
        'learner_id', v_row.learner_id,
        'item_kind', v_row.item_kind,
        'item_id', v_row.item_id
      ),
      'formation:pending:admin:' || v_row.id::text || ':' || v_admin::text
    );
  end loop;
end;
$function$;

create or replace function public.buklod_notify_scope_formation_outcome_v1(
  p_approval_id uuid,
  p_auto_approved boolean default false
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row record;
  v_admin uuid;
  v_label text;
  v_body text;
begin
  select a.* into v_row
  from public.buklod_scope_formation_approvals_v2 a
  where a.id = p_approval_id;

  if v_row.id is null or v_row.status not in ('APPROVED','REJECTED') then
    return;
  end if;

  v_label := case v_row.item_kind
    when 'DAILY_READING' then 'Daily Reading'
    when 'DAILY_DEVOTION' then 'Daily Devotion'
    when 'LESSON' then 'BUKLOD Lesson'
    else 'Formation submission'
  end;

  if v_row.status = 'APPROVED' then
    v_body := case when p_auto_approved
      then 'Your response met the BUKLOD quality standard and was approved automatically. Your eligible BUKLOD Points are posted by the existing reward flow.'
      else 'Your response has been approved. Your eligible BUKLOD Points are posted by the existing reward flow.'
    end;

    perform public.buklod_queue_notification_once_v1(
      v_row.learner_id,
      v_label || ' approved',
      v_body,
      'formation_approved',
      jsonb_build_object(
        'approval_id', v_row.id,
        'scope_id', v_row.scope_id,
        'item_kind', v_row.item_kind,
        'item_id', v_row.item_id,
        'auto_approved', p_auto_approved
      ),
      'formation:approved:user:' || v_row.id::text
    );
  else
    perform public.buklod_queue_notification_once_v1(
      v_row.learner_id,
      v_label || ' needs improvement',
      coalesce(
        nullif(trim(coalesce(v_row.remarks, '')), ''),
        'Please review the feedback, improve your response, and submit again.'
      ),
      'formation_needs_improvement',
      jsonb_build_object(
        'approval_id', v_row.id,
        'scope_id', v_row.scope_id,
        'item_kind', v_row.item_kind,
        'item_id', v_row.item_id
      ),
      'formation:rejected:user:' || v_row.id::text
    );
  end if;

  if p_auto_approved and v_row.status = 'APPROVED' then
    for v_admin in
      select x.user_id
      from public.buklod_scope_formation_approver_ids_v1(v_row.scope_id) x
      where x.user_id <> v_row.learner_id
    loop
      perform public.buklod_queue_notification_once_v1(
        v_admin,
        v_label || ' auto-approved',
        'BUKLOD quality validation approved this response automatically. No manual action is required; the exact-scope approval record remains available for audit.',
        'formation_auto_approved',
        jsonb_build_object(
          'approval_id', v_row.id,
          'scope_id', v_row.scope_id,
          'learner_id', v_row.learner_id,
          'item_kind', v_row.item_kind,
          'item_id', v_row.item_id
        ),
        'formation:auto-approved:admin:' || v_row.id::text || ':' || v_admin::text
      );
    end loop;
  end if;
end;
$function$;

create or replace function public.buklod_enqueue_scope_formation_approval_v2(
  p_scope_id uuid,
  p_learner_id uuid,
  p_item_kind text,
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_kind text := upper(trim(coalesce(p_item_kind, '')));
  v_created boolean := false;
begin
  if p_scope_id is null or p_learner_id is null or p_item_id is null then
    return null;
  end if;

  if v_kind not in ('DAILY_READING','DAILY_DEVOTION','LESSON') then
    raise exception 'Unsupported approval item';
  end if;

  if not public.buklod_user_is_active_scope_member(p_scope_id, p_learner_id) then
    raise exception 'Learner is not an ACTIVE member of the submission scope';
  end if;

  select a.id into v_id
  from public.buklod_scope_formation_approvals_v2 a
  where a.scope_id = p_scope_id
    and a.learner_id = p_learner_id
    and a.item_kind = v_kind
    and a.item_id = p_item_id
    and a.status in ('PENDING','APPROVED')
  order by a.created_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.buklod_scope_formation_approvals_v2 (
    scope_id, learner_id, item_kind, item_id, status
  ) values (
    p_scope_id, p_learner_id, v_kind, p_item_id, 'PENDING'
  )
  returning id into v_id;

  v_created := true;

  -- LESSON pending notifications are delayed until the automatic quality
  -- approval attempt finishes, so the user/admins do not receive contradictory
  -- pending + approved pushes seconds apart.
  if v_created and v_kind <> 'LESSON' then
    perform public.buklod_notify_scope_formation_pending_v1(v_id);
  end if;

  return v_id;
end;
$function$;

create or replace function public.buklod_lesson_ai_auto_approval_ready_v1(
  p_progress_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_lesson_id uuid;
  v_answers jsonb;
  v_reflection text;
  v_answer text;
  v_index integer := 0;
  v_question_id text;
  v_hash text;
  v_ttl integer := 6;
begin
  select lp.lesson_id
  into v_lesson_id
  from public.lesson_progress lp
  where lp.id = p_progress_id
    and lp.user_id = p_user_id
    and lp.submitted_for_validation_at is not null;

  if v_lesson_id is null then
    return false;
  end if;

  select r.question_answers, r.reflection_text
  into v_answers, v_reflection
  from public.learning_lesson_responses r
  where r.user_id = p_user_id
    and r.lesson_id = v_lesson_id
  order by r.updated_at desc
  limit 1;

  if v_answers is null
     or jsonb_typeof(v_answers) <> 'array'
     or jsonb_array_length(v_answers) <> 4
     or char_length(trim(coalesce(v_reflection, ''))) < 20 then
    return false;
  end if;

  v_ttl := coalesce(
    (public._buklod_ai_validation_config_v1()->>'attempt_ttl_hours')::integer,
    6
  );

  for v_answer in select value from jsonb_array_elements_text(v_answers)
  loop
    v_index := v_index + 1;
    v_question_id := 'lesson:' || v_lesson_id::text || ':generated:' || v_index::text;
    v_hash := public._buklod_ai_answer_hash_v1(v_answer);

    if not exists (
      select 1
      from public.buklod_ai_validation_attempts a
      where a.user_id = p_user_id
        and a.question_id = v_question_id
        and a.answer_hash = v_hash
        and a.created_at >= now() - make_interval(hours => v_ttl)
        and a.status = 'acceptable'
        and a.fail_open = false
        and coalesce(a.model, '') not in ('', 'rule-v1', 'disabled', 'edge-unavailable')
        and coalesce((a.scores->>'overall')::numeric, 0) >= 0.82
        and coalesce((a.scores->>'relevance')::numeric, 0) >= 0.78
        and coalesce((a.scores->>'depth')::numeric, 0) >= 0.72
      order by a.created_at desc
      limit 1
    ) then
      return false;
    end if;
  end loop;

  v_hash := public._buklod_ai_answer_hash_v1(v_reflection);
  if not exists (
    select 1
    from public.buklod_ai_validation_attempts a
    where a.user_id = p_user_id
      and a.question_id = 'lesson:' || v_lesson_id::text || ':reflection'
      and a.answer_hash = v_hash
      and a.created_at >= now() - make_interval(hours => v_ttl)
      and a.status = 'acceptable'
      and a.fail_open = false
      and coalesce(a.model, '') not in ('', 'rule-v1', 'disabled', 'edge-unavailable')
      and coalesce((a.scores->>'overall')::numeric, 0) >= 0.82
      and coalesce((a.scores->>'relevance')::numeric, 0) >= 0.78
      and coalesce((a.scores->>'depth')::numeric, 0) >= 0.72
    order by a.created_at desc
    limit 1
  ) then
    return false;
  end if;

  return true;
end;
$function$;

-- Preserve existing learner reward behavior while preventing an exact-scope
-- admin from receiving approver points for a review the AI completed itself.
create or replace function public.buklod_payout_learning_progress_rewards_v1(
  p_attempt_id uuid,
  p_learner_id uuid,
  p_lesson_id uuid,
  p_approver_id uuid,
  p_lesson_title text,
  p_approved_by uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    learner_points integer;
    approver_points integer;
    approver uuid := coalesce(p_approver_id, p_approved_by);
    learner_desc text;
    approver_desc text;
    attempt_rec record;
    learner_source_key text;
    approver_source_key text;
    repeat_rewards boolean := false;
begin
    if p_attempt_id is null or p_learner_id is null or p_lesson_id is null then
        return;
    end if;

    if coalesce(current_setting('buklod.auto_approval', true), '') = 'on' then
        approver := null;
    end if;

    select
        a.supersedes_attempt_id,
        a.repeat_request_id,
        a.attempt_number
    into attempt_rec
    from public.member_lesson_attempts a
    where a.id = p_attempt_id;

    if attempt_rec.supersedes_attempt_id is not null
       or attempt_rec.repeat_request_id is not null then
        repeat_rewards := public.buklod_formation_get_config_bool(
            'repeat_rewards_enabled',
            false
        );

        if not repeat_rewards then
            return;
        end if;

        learner_source_key :=
            'verification:learning:learner:repeat:'
            || p_learner_id::text || ':' || p_attempt_id::text;

        approver_source_key :=
            'verification:learning:approver:repeat:'
            || coalesce(approver, p_learner_id)::text
            || ':' || p_attempt_id::text;
    else
        learner_source_key :=
            'verification:learning:learner:'
            || p_learner_id::text || ':' || p_lesson_id::text;

        approver_source_key :=
            'verification:learning:approver:'
            || coalesce(approver, p_learner_id)::text
            || ':' || p_lesson_id::text;
    end if;

    learner_desc :=
        'Learning Progress approved: ' || coalesce(p_lesson_title, 'Lesson');

    approver_desc :=
        'Learning Progress verification: ' || coalesce(p_lesson_title, 'Lesson');

    if to_regclass('public.buklod_verification_rewards_config') is not null then
        select c.learner_points, c.approver_points
        into learner_points, approver_points
        from public.buklod_verification_rewards_config c
        where c.activity_code = 'learning_progress_verification'
          and c.is_active = true;
    end if;

    if learner_points is null then
        select r.base_points
        into learner_points
        from public.buklod_point_rules r
        where r.activity_type in (
            'learning_progress_verification',
            'formation_lesson'
        )
          and r.is_active = true
        order by case r.activity_type
            when 'learning_progress_verification' then 0
            else 1
        end
        limit 1;
    end if;

    if learner_points is null or learner_points <= 0 then
        learner_points := 5;
    end if;

    if approver_points is null or approver_points <= 0 then
        approver_points := learner_points;
    end if;

    perform public.buklod_award_verification_points_v1(
        p_learner_id,
        learner_points,
        'learning_progress_verification',
        learner_source_key,
        p_attempt_id,
        learner_desc,
        p_approved_by
    );

    if approver is not null and approver <> p_learner_id then
        perform public.buklod_award_verification_points_v1(
            approver,
            approver_points,
            'learning_progress_verification',
            approver_source_key,
            p_attempt_id,
            approver_desc,
            p_approved_by
        );
    end if;
end;
$function$;

create or replace function public.buklod_review_scope_formation_approval_v2(
  p_approval_id uuid,
  p_approve boolean,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_lesson_id uuid;
  v_existing_attempt uuid;
  v_result jsonb;
  v_auto boolean := coalesce(current_setting('buklod.auto_approval', true), '') = 'on';
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select a.* into v_row
  from public.buklod_scope_formation_approvals_v2 a
  where a.id = p_approval_id;

  if v_row.id is null then
    raise exception 'Approval not found';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Approval has already been decided';
  end if;
  if v_row.learner_id = v_actor then
    raise exception 'Members cannot approve their own submission';
  end if;
  if not public.buklod_is_formation_scope_approver_v1(v_row.scope_id, v_actor) then
    raise exception 'Exact-scope approval authority required';
  end if;
  if not public.buklod_user_is_active_scope_member(v_row.scope_id, v_row.learner_id) then
    raise exception 'Learner is no longer ACTIVE in this submission scope';
  end if;

  if p_approve and v_row.item_kind = 'LESSON' then
    select lp.lesson_id into v_lesson_id
    from public.lesson_progress lp
    where lp.id = v_row.item_id
      and lp.user_id = v_row.learner_id;

    if v_lesson_id is null then
      raise exception 'Formation learning progress not found';
    end if;

    select a.id into v_existing_attempt
    from public.member_lesson_attempts a
    where a.user_id = v_row.learner_id
      and a.lesson_id = v_lesson_id
      and a.review_status = 'approved'
      and a.reset_at is null
    order by a.attempt_number desc
    limit 1;

    if v_existing_attempt is not null then
      update public.buklod_scope_formation_approvals_v2
      set status = 'APPROVED',
          approver_id = v_actor,
          remarks = nullif(trim(coalesce(p_remarks, '')), ''),
          decided_at = now(),
          updated_at = now()
      where id = v_row.id
        and status = 'PENDING';

      v_result := jsonb_build_object(
        'ok', true,
        'approval_id', v_row.id,
        'scope_id', v_row.scope_id,
        'status', 'APPROVED',
        'lesson_attempt_id', v_existing_attempt,
        'reused_existing_completion', true
      );

      perform public.buklod_notify_scope_formation_outcome_v1(v_row.id, v_auto);
      return v_result;
    end if;
  end if;

  v_result := public.buklod_review_scope_formation_approval_core_r22b(
    p_approval_id,
    p_approve,
    p_remarks
  );

  perform public.buklod_notify_scope_formation_outcome_v1(p_approval_id, v_auto);
  return v_result;
end;
$function$;

create or replace function public.buklod_try_auto_approve_lesson_v1(
  p_approval_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_row record;
  v_auditor uuid;
  v_original_sub text := current_setting('request.jwt.claim.sub', true);
  v_result jsonb;
begin
  if v_caller is null then
    return jsonb_build_object('auto_approved', false, 'reason', 'not_authenticated');
  end if;

  select a.* into v_row
  from public.buklod_scope_formation_approvals_v2 a
  where a.id = p_approval_id
  for update;

  if v_row.id is null
     or v_row.status <> 'PENDING'
     or v_row.item_kind <> 'LESSON'
     or v_row.learner_id <> v_caller then
    return jsonb_build_object('auto_approved', false, 'reason', 'not_eligible');
  end if;

  if public.buklod_get_formation_entry_scope_v1('LESSON') is distinct from v_row.scope_id then
    return jsonb_build_object('auto_approved', false, 'reason', 'scope_context_mismatch');
  end if;

  if not public.buklod_lesson_ai_auto_approval_ready_v1(v_row.item_id, v_caller) then
    return jsonb_build_object('auto_approved', false, 'reason', 'quality_or_ai_threshold_not_met');
  end if;

  select x.user_id into v_auditor
  from public.buklod_scope_formation_approver_ids_v1(v_row.scope_id) x
  where x.user_id <> v_caller
  limit 1;

  if v_auditor is null then
    return jsonb_build_object('auto_approved', false, 'reason', 'no_scope_approver_for_audit');
  end if;

  begin
    perform set_config('buklod.auto_approval', 'on', true);
    perform set_config('request.jwt.claim.sub', v_auditor::text, true);

    v_result := public.buklod_review_scope_formation_approval_v2(
      v_row.id,
      true,
      'Automatically approved by BUKLOD AI quality validation. Exact-scope approvers notified; no manual action required.'
    );

    perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
    perform set_config('buklod.auto_approval', 'off', true);

    return coalesce(v_result, '{}'::jsonb)
      || jsonb_build_object('auto_approved', true, 'audit_approver_id', v_auditor);
  exception
    when others then
      perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
      perform set_config('buklod.auto_approval', 'off', true);
      raise warning 'BUKLOD lesson auto-approval fallback: %', sqlerrm;
      return jsonb_build_object('auto_approved', false, 'reason', 'auto_review_fallback');
  end;
end;
$function$;

revoke all on function public.buklod_try_auto_approve_lesson_v1(uuid) from public;
revoke all on function public.buklod_try_auto_approve_lesson_v1(uuid) from anon;
revoke all on function public.buklod_try_auto_approve_lesson_v1(uuid) from authenticated;

create or replace function public.submit_my_formation_lesson_for_validation_v1(
  p_enrollment_id uuid,
  p_lesson_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_progress_id uuid;
  v_answers jsonb;
  v_reflection text;
  v_answer text;
  v_answer_count integer := 0;
  v_scope uuid;
  v_approval_id uuid;
  v_auto_result jsonb := '{}'::jsonb;
  v_final_status text := 'pending_review';
begin
  if v_user is null then
    raise exception 'Kailangang mag-sign in muli bago magsumite.';
  end if;

  if p_enrollment_id is null or p_lesson_id is null then
    raise exception 'Kulang ang impormasyon ng aralin. Buksan muli ang lesson at subukang magsumite.';
  end if;

  if not exists (
    select 1
    from public.track_enrollments e
    join public.learning_lessons l on l.id = p_lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where e.id = p_enrollment_id
      and e.user_id = v_user
      and e.track_id = l.track_id
      and t.formation_program in ('ccp','discipleship','mentoring')
  ) then
    raise exception 'Ang araling ito ay hindi kabilang sa iyong kasalukuyang enrollment.';
  end if;

  select lp.id into v_progress_id
  from public.lesson_progress lp
  where lp.enrollment_id = p_enrollment_id
    and lp.lesson_id = p_lesson_id
    and lp.user_id = v_user
  limit 1;

  if v_progress_id is null then
    raise exception 'I-save muna ang study bago isumite para sa pagpapatunay.';
  end if;

  select r.question_answers, r.reflection_text
  into v_answers, v_reflection
  from public.learning_lesson_responses r
  where r.user_id = v_user
    and r.enrollment_id = p_enrollment_id
    and r.lesson_id = p_lesson_id
  order by r.updated_at desc
  limit 1;

  if v_answers is null or jsonb_typeof(v_answers) <> 'array' then
    raise exception 'Sagutan muna ang lahat ng 4 na tanong sa Quick Check bago isumite.';
  end if;

  v_answer_count := jsonb_array_length(v_answers);
  if v_answer_count <> 4 then
    raise exception 'Kumpletuhin ang lahat ng 4 na tanong. Sa ngayon, % lamang ang naka-save.', v_answer_count;
  end if;

  for v_answer in select value from jsonb_array_elements_text(v_answers)
  loop
    if char_length(btrim(coalesce(v_answer,''))) < 10 then
      raise exception 'Ayusin ang bawat sagot bago isumite. Lahat ng 4 na sagot ay kailangang kumpleto.';
    end if;
  end loop;

  if char_length(btrim(coalesce(v_reflection,''))) < 20 then
    raise exception 'Kumpletuhin ang Personal Reflection bago isumite.';
  end if;

  update public.lesson_progress lp
  set submitted_for_validation_at = now(),
      updated_at = now()
  where lp.id = v_progress_id
    and lp.user_id = v_user;

  v_scope := public.buklod_get_formation_entry_scope_v1('LESSON');

  if v_scope is not null then
    select a.id, a.status
    into v_approval_id, v_final_status
    from public.buklod_scope_formation_approvals_v2 a
    where a.scope_id = v_scope
      and a.learner_id = v_user
      and a.item_kind = 'LESSON'
      and a.item_id = v_progress_id
      and a.status in ('PENDING','APPROVED')
    order by a.created_at desc
    limit 1;
  end if;

  if v_approval_id is not null and upper(coalesce(v_final_status, '')) = 'APPROVED' then
    v_final_status := 'approved';
  elsif v_approval_id is not null then
    v_auto_result := public.buklod_try_auto_approve_lesson_v1(v_approval_id);

    if coalesce((v_auto_result->>'auto_approved')::boolean, false) then
      v_final_status := 'approved';
    else
      v_final_status := 'pending_review';
      perform public.buklod_notify_scope_formation_pending_v1(v_approval_id);
    end if;
  else
    -- Preserve legacy compatibility if entry context is missing/expired.
    -- No false success is claimed: the result remains pending review.
    v_final_status := 'pending_review';
  end if;

  return jsonb_build_object(
    'ok', true,
    'progress_id', v_progress_id,
    'approval_id', v_approval_id,
    'scope_id', v_scope,
    'submitted_for_validation_at', now(),
    'answers_found', v_answer_count,
    'status', v_final_status,
    'auto_approved', coalesce((v_auto_result->>'auto_approved')::boolean, false),
    'auto_approval_reason', v_auto_result->>'reason'
  );
end;
$function$;

create or replace function public.queue_formation_reminders_v1()
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_today date := (timezone('Asia/Manila', now()))::date;
  v_devotional uuid;
  v_assignment uuid;
  v_count bigint := 0;
  v_user uuid;
  v_scope uuid;
  v_admin uuid;
  v_pending_count integer;
begin
  if auth.uid() is not null and not public.buklod_is_system_admin() then
    raise exception 'System administrator access required';
  end if;

  select d.id into v_devotional
  from public.devotionals d
  where d.is_published = true
    and d.publish_date <= v_today
  order by d.publish_date desc nulls last, d.created_at desc
  limit 1;

  select a.id into v_assignment
  from public.daily_bible_assignments a
  where a.is_published = true
    and a.reading_date = v_today
  order by a.created_at desc
  limit 1;

  for v_user in
    select distinct m.user_id
    from public.buklod_scope_memberships m
    join public.buklod_scopes s on s.id = m.scope_id
    join public.profiles p on p.id = m.user_id
    where m.membership_status = 'ACTIVE'
      and s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and p.is_active = true
  loop
    if v_devotional is not null
       and not exists (
         select 1 from public.devotional_completions dc
         where dc.user_id = v_user and dc.devotional_id = v_devotional
       ) then
      if public.buklod_queue_notification_once_v1(
        v_user,
        'Today''s Daily Devotion is ready',
        'Spend time in the Word with BUKLOD today.',
        'devotional_reminder',
        jsonb_build_object('devotional_id', v_devotional, 'date', v_today),
        'formation:devotion-reminder:' || v_user::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end if;

    if v_assignment is not null
       and not exists (
         select 1 from public.daily_bible_submissions s
         where s.user_id = v_user and s.assignment_id = v_assignment
       ) then
      if public.buklod_queue_notification_once_v1(
        v_user,
        'Today''s Daily Reading is ready',
        'Open BUKLOD Daily Reading and complete today''s Scripture and reflection.',
        'formation_daily_reading_reminder',
        jsonb_build_object('assignment_id', v_assignment, 'date', v_today),
        'formation:reading-reminder:' || v_user::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end if;

    if exists (
      select 1
      from public.track_enrollments e
      join public.learning_tracks t on t.id = e.track_id
      where e.user_id = v_user
        and e.status::text = 'active'
        and t.formation_program in ('ccp','discipleship','mentoring')
        and exists (
          select 1
          from public.learning_lessons l
          where l.track_id = t.id
            and coalesce(l.content_ready, true) = true
            and not exists (
              select 1
              from public.lesson_progress lp
              where lp.user_id = v_user
                and lp.lesson_id = l.id
                and lp.completed_at is not null
            )
        )
    ) then
      if public.buklod_queue_notification_once_v1(
        v_user,
        'Continue your BUKLOD Lesson',
        'You have an active Formation lesson waiting. Continue when you are ready.',
        'formation_lesson_reminder',
        jsonb_build_object('date', v_today),
        'formation:lesson-reminder:' || v_user::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  for v_scope, v_pending_count in
    select a.scope_id, count(*)::integer
    from public.buklod_scope_formation_approvals_v2 a
    where a.status = 'PENDING'
      and a.created_at <= now() - interval '2 hours'
    group by a.scope_id
  loop
    for v_admin in
      select x.user_id
      from public.buklod_scope_formation_approver_ids_v1(v_scope) x
    loop
      if public.buklod_queue_notification_once_v1(
        v_admin,
        'Formation reviews waiting',
        format('%s submission%s waiting in your scope.', v_pending_count, case when v_pending_count = 1 then ' is' else 's are' end),
        'formation_pending_reminder',
        jsonb_build_object('scope_id', v_scope, 'pending_count', v_pending_count, 'date', v_today),
        'formation:pending-reminder:' || v_scope::text || ':' || v_admin::text || ':' || v_today::text
      ) is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  return v_count;
end;
$function$;

-- Supabase hosted Postgres supports pg_cron. Database timezone is UTC, so
-- 23:00 UTC = 07:00 Asia/Manila the following day.
create extension if not exists pg_cron;

do $do$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select j.jobid
    from cron.job j
    where j.jobname = 'buklod-formation-daily-reminders-r27'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end;
$do$;

select cron.schedule(
  'buklod-formation-daily-reminders-r27',
  '0 23 * * *',
  $cron$select public.queue_formation_reminders_v1();$cron$
);
