-- BUKLOD Formation daily pipeline repair R1
-- Stability-first: no new tables, no unrelated module changes.
-- Canonical paths remain daily_bible_submissions, devotional_reward_submissions,
-- and buklod_scope_formation_approvals_v2.

-- ---------------------------------------------------------------------------
-- 1) Formation-specific authority: no global System Admin bypass.
--    Exact Cluster roles/functional approvers and parent Organization Admins
--    remain authoritative for Formation.
-- ---------------------------------------------------------------------------
create or replace function public.buklod_is_formation_scope_approver_v1(
  p_scope_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_type text;
  v_org_id uuid;
begin
  if p_scope_id is null or p_user_id is null then
    return false;
  end if;

  select s.scope_type, coalesce(s.organization_id, s.parent_scope_id)
    into v_type, v_org_id
  from public.buklod_scopes s
  where s.id = p_scope_id
    and s.status not in ('SUSPENDED','DELETED');

  if v_type is null then
    return false;
  end if;

  if v_type = 'CLUSTER' then
    if exists (
      select 1
      from public.buklod_scope_role_assignments ra
      where ra.scope_id = p_scope_id
        and ra.user_id = p_user_id
        and ra.status = 'ACTIVE'
        and upper(ra.role_key) in (
          'ADMIN','CLUSTER_ADMIN','CLUSTER_HEAD','PASTOR','MENTOR'
        )
    ) then
      return true;
    end if;

    if public.buklod_user_has_functional_approver_role(p_scope_id, p_user_id) then
      return true;
    end if;

    if v_org_id is not null and exists (
      select 1
      from public.buklod_scope_role_assignments ra
      where ra.scope_id = v_org_id
        and ra.user_id = p_user_id
        and ra.status = 'ACTIVE'
        and upper(ra.role_key) in ('ADMIN','ORG_ADMIN','ORGANIZATION_ADMIN')
    ) then
      return true;
    end if;

    return false;
  end if;

  if v_type = 'ORGANIZATION' then
    return exists (
      select 1
      from public.buklod_scope_role_assignments ra
      where ra.scope_id = p_scope_id
        and ra.user_id = p_user_id
        and ra.status = 'ACTIVE'
        and upper(ra.role_key) in ('ADMIN','ORG_ADMIN','ORGANIZATION_ADMIN')
    );
  end if;

  return false;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2) Daily Devotion must enter approval only from the canonical reward
--    submission. Completion remains a lifecycle fact, not a review request.
--    Keep the trigger object for compatibility but make it non-enqueuing.
-- ---------------------------------------------------------------------------
create or replace function public.buklod_capture_devotion_scope_approval_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  return new;
end;
$function$;

-- Remove only obsolete, never-decided completion-keyed Devotion approvals.
-- Canonical submission-keyed rows are intentionally untouched.
delete from public.buklod_scope_formation_approvals_v2 a
where a.item_kind = 'DAILY_DEVOTION'
  and a.status = 'PENDING'
  and exists (
    select 1
    from public.devotional_completions dc
    where dc.user_id = a.learner_id
      and dc.devotional_id = a.item_id
  )
  and not exists (
    select 1
    from public.devotional_reward_submissions ds
    where ds.id = a.item_id
      and ds.user_id = a.learner_id
  );

-- ---------------------------------------------------------------------------
-- 3) Manual exact-scope fallback must operate on the same canonical Devotion
--    submission ID used by automatic validation, and must finalize reward state.
-- ---------------------------------------------------------------------------
create or replace function public.buklod_review_scope_formation_approval_core_r22b(
  p_approval_id uuid,
  p_approve boolean,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  rec record;
  daily record;
  devotion record;
  has_bible_photo boolean := false;
  has_reflection_photo boolean := false;
  valid_question_answers integer := 0;
  lesson_attempt uuid;
  v_status text := case when p_approve then 'APPROVED' else 'REJECTED' end;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select a.* into rec
  from public.buklod_scope_formation_approvals_v2 a
  where a.id = p_approval_id
  for update;

  if rec.id is null then raise exception 'Approval not found'; end if;
  if rec.status <> 'PENDING' then raise exception 'Approval has already been decided'; end if;
  if rec.learner_id = actor then raise exception 'Members cannot approve their own submission'; end if;
  if not public.buklod_is_formation_scope_approver_v1(rec.scope_id, actor) then
    raise exception 'Exact-scope approval authority required';
  end if;
  if not public.buklod_user_is_active_scope_member(rec.scope_id, rec.learner_id) then
    raise exception 'Learner is no longer ACTIVE in this submission scope';
  end if;

  if rec.item_kind = 'DAILY_READING' then
    select s.*, a.bible_reference, a.reading_date
    into daily
    from public.daily_bible_submissions s
    join public.daily_bible_assignments a on a.id = s.assignment_id
    where s.id = rec.item_id
    for update of s;

    if daily.id is null then raise exception 'Bible Reading submission not found'; end if;
    if daily.status <> 'pending_admin' then raise exception 'Bible Reading submission has already been reviewed'; end if;

    if daily.bible_photo_path is not null then
      select exists (
        select 1 from storage.objects o
        where o.bucket_id = 'daily-bible-evidence' and o.name = daily.bible_photo_path
      ) into has_bible_photo;
    end if;
    if daily.reflection_photo_path is not null then
      select exists (
        select 1 from storage.objects o
        where o.bucket_id = 'daily-bible-evidence' and o.name = daily.reflection_photo_path
      ) into has_reflection_photo;
    end if;

    if p_approve then
      if daily.question_answers is null
         or jsonb_typeof(daily.question_answers) <> 'array'
         or jsonb_array_length(daily.question_answers) <> 4 then
        raise exception 'Cannot approve: all four Daily Bible questions must be answered';
      end if;

      select count(*) into valid_question_answers
      from jsonb_array_elements_text(daily.question_answers) q(answer_value)
      where char_length(trim(q.answer_value)) >= 10;

      if valid_question_answers <> 4 then
        raise exception 'Cannot approve: all four Daily Bible question answers must be complete';
      end if;
      if coalesce(char_length(trim(daily.bible_text)), 0) < 20 and not has_bible_photo then
        raise exception 'Cannot approve: Bible passage evidence is missing';
      end if;
      if coalesce(char_length(trim(daily.answer_text)), 0) < 20 and not has_reflection_photo then
        raise exception 'Cannot approve: reflection evidence is missing';
      end if;

      update public.daily_bible_submissions
      set status = 'approved',
          reviewed_by = actor,
          reviewed_at = now(),
          admin_note = nullif(trim(coalesce(p_remarks, '')), '')
      where id = daily.id;

      perform public.buklod_payout_daily_bible_rewards_v1(
        daily.id,
        daily.user_id,
        daily.assignment_id,
        daily.bible_reference,
        daily.reading_date,
        actor
      );
    else
      update public.daily_bible_submissions
      set status = 'rejected',
          reviewed_by = actor,
          reviewed_at = now(),
          admin_note = coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            'Please revise your Bible questions and/or Personal Reflection, then resubmit.'
          )
      where id = daily.id;
    end if;

  elsif rec.item_kind = 'LESSON' then
    if p_approve then
      lesson_attempt := public.buklod_record_lesson_completion_exact_scope_v2(
        rec.scope_id, rec.item_id, p_remarks
      );
    else
      update public.lesson_progress
      set submitted_for_validation_at = null,
          updated_at = now()
      where id = rec.item_id
        and user_id = rec.learner_id;
    end if;

  elsif rec.item_kind = 'DAILY_DEVOTION' then
    select s.*, d.title as devotional_title
    into devotion
    from public.devotional_reward_submissions s
    join public.devotionals d on d.id = s.devotional_id
    where s.id = rec.item_id
      and s.user_id = rec.learner_id
    for update of s;

    if devotion.id is null then raise exception 'Daily Devotion submission not found'; end if;
    if devotion.status <> 'pending_admin' then raise exception 'Daily Devotion submission has already been reviewed'; end if;

    if not exists (
      select 1
      from public.devotional_completions dc
      where dc.id = devotion.completion_id
        and dc.user_id = rec.learner_id
        and dc.devotional_id = devotion.devotional_id
    ) then
      raise exception 'Devotional completion not found';
    end if;

    if coalesce(char_length(trim(devotion.reflection_snapshot)), 0) = 0
       or coalesce(char_length(trim(devotion.application_snapshot)), 0) = 0 then
      raise exception 'Cannot approve: reflection and application are required';
    end if;

    if p_approve then
      update public.devotional_reward_submissions
      set status = 'approved',
          reviewed_by = actor,
          reviewed_at = now(),
          admin_note = nullif(trim(coalesce(p_remarks, '')), '')
      where id = devotion.id;

      perform public.buklod_award_rule_mapped_points_v1(
        devotion.user_id,
        'devotional',
        'devotional:' || devotion.user_id::text || ':' || devotion.devotional_id::text,
        devotion.id,
        'Devotional: ' || coalesce(devotion.devotional_title_snapshot, devotion.devotional_title, 'Daily Devotion'),
        actor
      );
    else
      update public.devotional_reward_submissions
      set status = 'rejected',
          reviewed_by = actor,
          reviewed_at = now(),
          admin_note = coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            'Please improve the reflection/application and resubmit.'
          )
      where id = devotion.id;
    end if;
  else
    raise exception 'Unsupported approval item';
  end if;

  update public.buklod_scope_formation_approvals_v2
  set status = v_status,
      approver_id = actor,
      remarks = nullif(trim(coalesce(p_remarks, '')), ''),
      decided_at = now(),
      updated_at = now()
  where id = rec.id;

  return jsonb_build_object(
    'ok', true,
    'approval_id', rec.id,
    'scope_id', rec.scope_id,
    'status', v_status,
    'lesson_attempt_id', lesson_attempt
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4) Existing legacy Bible review button becomes a compatibility wrapper over
--    the exact-scope Formation approval path. No System Admin-only approval.
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_daily_bible_submission(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  v_approval uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select a.id into v_approval
  from public.buklod_scope_formation_approvals_v2 a
  where a.item_kind = 'DAILY_READING'
    and a.item_id = p_submission_id
    and a.status = 'PENDING'
    and public.buklod_is_formation_scope_approver_v1(a.scope_id, actor)
  order by a.created_at desc
  limit 1;

  if v_approval is null then
    raise exception 'Exact-scope Formation approval authority required';
  end if;

  perform public.buklod_review_scope_formation_approval_v2(
    v_approval,
    p_approve,
    p_admin_note
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5) A real Daily Reading submission is deterministic proof that the guided
--    reading reached its response stage. Finalize only that user's matching
--    Daily Plan sessions for that assignment date, then continue the existing
--    automatic validation flow.
-- ---------------------------------------------------------------------------
create or replace function public.buklod_capture_daily_reading_scope_approval_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
  v_approval uuid;
  v_reading_date date;
begin
  if new.status <> 'pending_admin' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending_admin' then return new; end if;

  select a.reading_date into v_reading_date
  from public.daily_bible_assignments a
  where a.id = new.assignment_id;

  if v_reading_date is not null then
    update public.bible_reading_sessions s
    set completed_at = coalesce(s.completed_at, new.submitted_at, now())
    where s.user_id = new.user_id
      and s.source = 'daily_plan'
      and (s.started_at at time zone 'Asia/Manila')::date = v_reading_date
      and s.completed_at is null;
  end if;

  v_scope := public.buklod_resolve_auto_submission_scope_v1('DAILY_READING', new.user_id);
  if v_scope is null then
    raise exception 'Daily Reading must be submitted from the exact cluster context for automatic validation';
  end if;

  v_approval := public.buklod_prepare_auto_formation_approval_v1(
    v_scope, new.user_id, 'DAILY_READING', new.id
  );

  perform public.buklod_queue_auto_formation_validation_v1(
    v_scope, new.user_id, 'DAILY_READING', new.id, v_approval
  );

  return new;
end;
$function$;

-- Deterministically repair matching sessions for already-existing submissions.
update public.bible_reading_sessions s
set completed_at = coalesce(s.completed_at, x.submitted_at, now())
from (
  select dbs.user_id, dba.reading_date, dbs.submitted_at
  from public.daily_bible_submissions dbs
  join public.daily_bible_assignments dba on dba.id = dbs.assignment_id
) x
where s.user_id = x.user_id
  and s.source = 'daily_plan'
  and (s.started_at at time zone 'Asia/Manila')::date = x.reading_date
  and s.completed_at is null;

-- ---------------------------------------------------------------------------
-- 6) Reuse the existing Bible monitor RPC, but expose the real lifecycle from
--    assignments + reading sessions + canonical submissions + exact-scope
--    approval state. Same return signature keeps the current UI compatible.
-- ---------------------------------------------------------------------------
create or replace function public.reviewer_get_daily_bible_monitor_v3(
  p_assignment_id uuid
)
returns table(
  assignment_id uuid,
  reading_date date,
  bible_reference text,
  user_id uuid,
  full_name text,
  church_id uuid,
  church_name text,
  submission_id uuid,
  bible_text text,
  bible_photo_path text,
  chapter_questions_fil jsonb,
  chapter_questions_en jsonb,
  question_answers jsonb,
  answer_language text,
  reflection_text text,
  reflection_photo_path text,
  submission_status text,
  submitted_at timestamptz,
  submitted_on_time boolean,
  has_bible_photo boolean,
  has_reflection_photo boolean,
  reviewer_can_act boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  local_today date := (now() at time zone 'Asia/Manila')::date;
  actor_is_system_admin boolean := public.buklod_is_system_admin();
  actor_has_scope boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.buklod_scopes s
    where s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and public.buklod_is_formation_scope_approver_v1(s.id, actor)
  ) into actor_has_scope;

  if not actor_is_system_admin and not actor_has_scope then
    raise exception 'Formation monitoring access required';
  end if;

  return query
  select
    a.id,
    a.reading_date,
    a.bible_reference,
    p.id,
    p.full_name,
    p.church_id,
    coalesce(c.name, 'No Local')::text,
    sub.id,
    sub.bible_text,
    sub.bible_photo_path,
    coalesce(a.chapter_questions_fil, '[]'::jsonb),
    coalesce(a.chapter_questions_en, '[]'::jsonb),
    coalesce(sub.question_answers, '[]'::jsonb),
    coalesce(sub.answer_language, 'fil')::text,
    sub.answer_text,
    sub.reflection_photo_path,
    (
      case
        when sub.status = 'approved' then 'approved'
        when sub.status = 'rejected' then 'revision_required'
        when sub.id is not null and appr.status = 'EVALUATING' then 'ai_checking'
        when sub.id is not null and appr.status = 'PENDING' then 'ai_checked_pending_review'
        when sub.id is not null then 'submitted'
        when rs.has_completed then 'completed_locally'
        when rs.has_started then 'in_progress'
        when a.reading_date < local_today then 'missed'
        else 'assigned'
      end
    )::text,
    sub.submitted_at,
    coalesce(sub.submitted_on_time, false),
    (
      sub.bible_photo_path is not null
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'daily-bible-evidence'
          and o.name = sub.bible_photo_path
      )
    ),
    (
      sub.reflection_photo_path is not null
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'daily-bible-evidence'
          and o.name = sub.reflection_photo_path
      )
    ),
    (
      sub.id is not null
      and sub.status = 'pending_admin'
      and appr.id is not null
      and appr.status = 'PENDING'
      and public.buklod_is_formation_scope_approver_v1(appr.scope_id, actor)
    )
  from public.daily_bible_assignment_members am
  join public.daily_bible_assignments a on a.id = am.assignment_id
  join public.profiles p on p.id = am.user_id
  left join public.churches c on c.id = p.church_id
  left join public.daily_bible_submissions sub
    on sub.assignment_id = am.assignment_id
   and sub.user_id = am.user_id
  left join lateral (
    select
      bool_or(brs.completed_at is not null) as has_completed,
      bool_or(brs.started_at is not null) as has_started
    from public.bible_reading_sessions brs
    where brs.user_id = am.user_id
      and brs.source = 'daily_plan'
      and (brs.started_at at time zone 'Asia/Manila')::date = a.reading_date
  ) rs on true
  left join lateral (
    select fa.id, fa.scope_id, fa.status
    from public.buklod_scope_formation_approvals_v2 fa
    where fa.learner_id = am.user_id
      and fa.item_kind = 'DAILY_READING'
      and fa.item_id = sub.id
    order by fa.created_at desc
    limit 1
  ) appr on true
  where am.assignment_id = p_assignment_id
    and (
      actor_is_system_admin
      or exists (
        select 1
        from public.buklod_scope_memberships sm
        join public.buklod_scopes sc on sc.id = sm.scope_id
        where sm.user_id = am.user_id
          and coalesce(sm.membership_status::text, '') = 'ACTIVE'
          and sc.scope_type = 'CLUSTER'
          and sc.status not in ('SUSPENDED','DELETED')
          and public.buklod_is_formation_scope_approver_v1(sc.id, actor)
      )
    )
  order by
    case
      when sub.status = 'pending_admin' then 1
      when sub.status = 'rejected' then 2
      when rs.has_completed then 3
      when rs.has_started then 4
      when sub.id is null and a.reading_date < local_today then 5
      when sub.id is null then 6
      else 7
    end,
    c.name nulls last,
    p.full_name;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7) Deterministic historical Devotion recovery only.
--    Criteria: published devotional, valid completion + reflection row,
--    reflection >=20, application >=20, no existing submission, and exactly
--    one ACTIVE Cluster context resolvable from current scope truth.
--    Ambiguous or weak historical rows remain untouched.
-- ---------------------------------------------------------------------------
insert into public.devotional_reward_submissions (
  user_id,
  devotional_id,
  completion_id,
  reflection_id,
  devotional_title_snapshot,
  reflection_snapshot,
  application_snapshot,
  reward_amount,
  status,
  submitted_at
)
select
  dc.user_id,
  dc.devotional_id,
  dc.id,
  r.id,
  d.title,
  r.reflection_text,
  r.application_text,
  d.bayanihan_reward,
  'pending_admin',
  dc.completed_at
from public.devotional_completions dc
join public.reflections r
  on r.user_id = dc.user_id
 and r.devotional_id = dc.devotional_id
join public.devotionals d
  on d.id = dc.devotional_id
 and d.is_published = true
left join public.devotional_reward_submissions existing
  on existing.user_id = dc.user_id
 and existing.devotional_id = dc.devotional_id
where existing.id is null
  and char_length(trim(coalesce(r.reflection_text, ''))) >= 20
  and char_length(trim(coalesce(r.application_text, ''))) >= 20
  and (
    select count(distinct s.id)
    from public.buklod_scopes s
    join public.buklod_scope_role_assignments ra on ra.scope_id = s.id
    where ra.user_id = dc.user_id
      and ra.status = 'ACTIVE'
      and s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and public.buklod_user_is_active_scope_member(s.id, dc.user_id)
  ) = 1
on conflict (user_id, devotional_id) do nothing;

-- Keep current API exposure explicit without opening anonymous access.
revoke all on function public.buklod_is_formation_scope_approver_v1(uuid,uuid) from anon;
grant execute on function public.buklod_is_formation_scope_approver_v1(uuid,uuid) to authenticated;
revoke all on function public.reviewer_get_daily_bible_monitor_v3(uuid) from anon;
grant execute on function public.reviewer_get_daily_bible_monitor_v3(uuid) to authenticated;
revoke all on function public.admin_review_daily_bible_submission(uuid,boolean,text) from anon;
grant execute on function public.admin_review_daily_bible_submission(uuid,boolean,text) to authenticated;
