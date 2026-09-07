-- BUKLOD MAIN R22-B hardening
-- Corrective/additive migration for exact-scope authority, legacy compatibility,
-- and scope-isolated monitoring. No production data is rewritten.

-- Reuse the existing protected governance helpers instead of duplicating role rules.
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
begin
  if p_scope_id is null or p_user_id is null then
    return false;
  end if;

  if p_user_id = auth.uid() and public.buklod_is_system_admin() then
    return true;
  end if;

  select s.scope_type
  into v_type
  from public.buklod_scopes s
  where s.id = p_scope_id
    and s.status not in ('SUSPENDED','DELETED');

  if v_type = 'CLUSTER' then
    -- Protected existing rule: exact Cluster Admin/Head/Pastor/Mentor,
    -- functional approver, or Admin of this Cluster's own parent Organization.
    return public.buklod_is_cluster_approver(p_scope_id, p_user_id);
  end if;

  if v_type = 'ORGANIZATION' then
    -- Sub-organizations use ORGANIZATION scope rows with parent_scope_id;
    -- exact-scope admin assignment remains authoritative.
    return public.buklod_is_exact_scope_admin_v1(p_scope_id, p_user_id);
  end if;

  return false;
end;
$function$;

-- Daily Reading can be re-submitted from another exact scope while the legacy
-- source row is still pending. Enqueue on each submitted-row write; the partial
-- unique index keeps repeated writes inside the same scope idempotent.
create or replace function public.buklod_capture_daily_reading_scope_approval_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
begin
  if new.status = 'pending_admin' then
    v_scope := public.buklod_get_formation_entry_scope_v1('DAILY_READING');
    if v_scope is not null then
      perform public.buklod_enqueue_scope_formation_approval_v2(
        v_scope, new.user_id, 'DAILY_READING', new.id
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists buklod_capture_daily_reading_scope_approval_v2
on public.daily_bible_submissions;
create trigger buklod_capture_daily_reading_scope_approval_v2
after insert or update on public.daily_bible_submissions
for each row execute function public.buklod_capture_daily_reading_scope_approval_v2();

-- Preserve one global learner reward/completion for legacy compatibility, while
-- allowing the same already-completed lesson to be approved in a second exact
-- scope without creating a duplicate attempt or duplicate reward.
alter function public.buklod_review_scope_formation_approval_v2(uuid, boolean, text)
  rename to buklod_review_scope_formation_approval_core_r22b;

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
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select a.*
  into v_row
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
    select lp.lesson_id
    into v_lesson_id
    from public.lesson_progress lp
    where lp.id = v_row.item_id
      and lp.user_id = v_row.learner_id;

    if v_lesson_id is null then
      raise exception 'Formation learning progress not found';
    end if;

    select a.id
    into v_existing_attempt
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

      return jsonb_build_object(
        'ok', true,
        'approval_id', v_row.id,
        'scope_id', v_row.scope_id,
        'status', 'APPROVED',
        'lesson_attempt_id', v_existing_attempt,
        'reused_existing_completion', true
      );
    end if;
  end if;

  return public.buklod_review_scope_formation_approval_core_r22b(
    p_approval_id,
    p_approve,
    p_remarks
  );
end;
$function$;

-- Exact-aware monitoring overlay. Historical rows with no R22-B scope binding
-- keep the legacy result; once any R22-B binding exists for an item, only that
-- item's exact-scope approval rows contribute to scoped monitoring.
create or replace function public.buklod_scope_faith_monitoring_summary_v2(p_scope_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_base jsonb;
  v_today date := (timezone('Asia/Manila', now()))::date;
  v_week_start date := v_today - 6;
  v_active_members int := 0;
  v_assignment_id uuid;
  v_devotional_id uuid;
  v_daily_submitted int := 0;
  v_daily_approved int := 0;
  v_daily_pending int := 0;
  v_daily_week_active int := 0;
  v_devotion_today int := 0;
  v_devotion_week int := 0;
  v_lesson_active int := 0;
  v_lesson_not_started int := 0;
  v_stage_rows jsonb := '[]'::jsonb;
begin
  v_base := public.buklod_scope_faith_monitoring_summary_v1(p_scope_id);
  v_active_members := coalesce((v_base->>'active_members')::int, 0);
  v_assignment_id := nullif(v_base->'daily_reading'->>'assignment_id', '')::uuid;
  v_devotional_id := nullif(v_base->'devotion'->>'devotional_id', '')::uuid;

  if v_assignment_id is not null then
    select
      count(distinct s.user_id) filter (
        where exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.scope_id = p_scope_id
            and x.learner_id = s.user_id
            and x.item_kind = 'DAILY_READING'
            and x.item_id = s.id
        )
        or not exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.learner_id = s.user_id
            and x.item_kind = 'DAILY_READING'
            and x.item_id = s.id
        )
      )::int,
      count(distinct s.user_id) filter (
        where exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.scope_id = p_scope_id
            and x.learner_id = s.user_id
            and x.item_kind = 'DAILY_READING'
            and x.item_id = s.id
            and x.status = 'APPROVED'
        )
        or (
          s.status = 'approved'
          and not exists (
            select 1
            from public.buklod_scope_formation_approvals_v2 x
            where x.learner_id = s.user_id
              and x.item_kind = 'DAILY_READING'
              and x.item_id = s.id
          )
        )
      )::int,
      count(distinct s.user_id) filter (
        where exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.scope_id = p_scope_id
            and x.learner_id = s.user_id
            and x.item_kind = 'DAILY_READING'
            and x.item_id = s.id
            and x.status = 'PENDING'
        )
        or (
          s.status in ('pending_admin','pending')
          and not exists (
            select 1
            from public.buklod_scope_formation_approvals_v2 x
            where x.learner_id = s.user_id
              and x.item_kind = 'DAILY_READING'
              and x.item_id = s.id
          )
        )
      )::int
    into v_daily_submitted, v_daily_approved, v_daily_pending
    from public.daily_bible_submissions s
    join public.buklod_scope_memberships m
      on m.user_id = s.user_id
     and m.scope_id = p_scope_id
     and m.membership_status = 'ACTIVE'
    where s.assignment_id = v_assignment_id;
  end if;

  select count(distinct s.user_id)::int
  into v_daily_week_active
  from public.daily_bible_submissions s
  join public.daily_bible_assignments a on a.id = s.assignment_id
  join public.buklod_scope_memberships m
    on m.user_id = s.user_id
   and m.scope_id = p_scope_id
   and m.membership_status = 'ACTIVE'
  where a.reading_date between v_week_start and v_today
    and (
      exists (
        select 1
        from public.buklod_scope_formation_approvals_v2 x
        where x.scope_id = p_scope_id
          and x.learner_id = s.user_id
          and x.item_kind = 'DAILY_READING'
          and x.item_id = s.id
          and x.status = 'APPROVED'
      )
      or (
        s.status = 'approved'
        and not exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.learner_id = s.user_id
            and x.item_kind = 'DAILY_READING'
            and x.item_id = s.id
        )
      )
    );

  if v_devotional_id is not null then
    select count(distinct dc.user_id)::int
    into v_devotion_today
    from public.devotional_completions dc
    join public.buklod_scope_memberships m
      on m.user_id = dc.user_id
     and m.scope_id = p_scope_id
     and m.membership_status = 'ACTIVE'
    where dc.devotional_id = v_devotional_id
      and (
        exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.scope_id = p_scope_id
            and x.learner_id = dc.user_id
            and x.item_kind = 'DAILY_DEVOTION'
            and x.item_id = dc.devotional_id
            and x.status = 'APPROVED'
        )
        or not exists (
          select 1
          from public.buklod_scope_formation_approvals_v2 x
          where x.learner_id = dc.user_id
            and x.item_kind = 'DAILY_DEVOTION'
            and x.item_id = dc.devotional_id
        )
      );
  end if;

  select count(distinct dc.user_id)::int
  into v_devotion_week
  from public.devotional_completions dc
  join public.buklod_scope_memberships m
    on m.user_id = dc.user_id
   and m.scope_id = p_scope_id
   and m.membership_status = 'ACTIVE'
  where dc.completion_date between v_week_start and v_today
    and (
      exists (
        select 1
        from public.buklod_scope_formation_approvals_v2 x
        where x.scope_id = p_scope_id
          and x.learner_id = dc.user_id
          and x.item_kind = 'DAILY_DEVOTION'
          and x.item_id = dc.devotional_id
          and x.status = 'APPROVED'
      )
      or not exists (
        select 1
        from public.buklod_scope_formation_approvals_v2 x
        where x.learner_id = dc.user_id
          and x.item_kind = 'DAILY_DEVOTION'
          and x.item_id = dc.devotional_id
      )
    );

  with scope_members as (
    select m.user_id
    from public.buklod_scope_memberships m
    where m.scope_id = p_scope_id
      and m.membership_status = 'ACTIVE'
  ),
  exact_approved as (
    select
      a.learner_id as user_id,
      lp.lesson_id,
      trim(t.stage_code)::integer as stage_code
    from public.buklod_scope_formation_approvals_v2 a
    join public.lesson_progress lp on lp.id = a.item_id
    join public.learning_lessons l on l.id = lp.lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where a.scope_id = p_scope_id
      and a.item_kind = 'LESSON'
      and a.status = 'APPROVED'
      and t.stage_code is not null
      and trim(t.stage_code) ~ '^[0-9]+$'
  ),
  legacy_approved as (
    select
      sm.user_id,
      a.lesson_id,
      trim(t.stage_code)::integer as stage_code
    from scope_members sm
    join public.member_lesson_attempts a
      on a.user_id = sm.user_id
     and a.review_status = 'approved'
    join public.learning_lessons l on l.id = a.lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where t.stage_code is not null
      and trim(t.stage_code) ~ '^[0-9]+$'
      and not exists (
        select 1
        from public.buklod_scope_formation_approvals_v2 x
        join public.lesson_progress xlp on xlp.id = x.item_id
        where x.learner_id = sm.user_id
          and x.item_kind = 'LESSON'
          and xlp.lesson_id = a.lesson_id
      )
  ),
  approved_union as (
    select * from exact_approved
    union
    select * from legacy_approved
  ),
  approved_lessons as (
    select user_id, stage_code, count(distinct lesson_id)::bigint as approved_lessons
    from approved_union
    group by user_id, stage_code
  ),
  member_totals as (
    select sm.user_id, coalesce(sum(al.approved_lessons), 0)::bigint as total_approved
    from scope_members sm
    left join approved_lessons al on al.user_id = sm.user_id
    group by sm.user_id
  ),
  expected as (
    select c.stage_code::integer as stage_code,
           coalesce(sum(c.expected_lesson_count), 0)::integer as expected_lessons
    from public.buklod_curriculum_components c
    where c.expected_lesson_count is not null
    group by c.stage_code::integer
  ),
  required as (
    select r.stage_code::integer as stage_code,
           count(*)::integer as required_records
    from public.buklod_stage_requirements r
    where r.is_active = true
      and r.required_for_stage_completion = true
    group by r.stage_code::integer
  ),
  verified as (
    select sm.user_id,
           r.stage_code::integer as stage_code,
           count(distinct r.requirement_code)::bigint as verified_records
    from scope_members sm
    join public.member_stage_requirement_records mr
      on mr.user_id = sm.user_id
     and mr.status = 'verified'
    join public.buklod_stage_requirements r
      on r.requirement_code = mr.requirement_code
     and r.is_active = true
     and r.required_for_stage_completion = true
    group by sm.user_id, r.stage_code::integer
  ),
  member_stage as (
    select
      sm.user_id,
      s.stage_code::integer as stage_code,
      s.title_fil as stage_title,
      s.stage_order,
      coalesce(e.expected_lessons, 0) as expected_lessons,
      coalesce(al.approved_lessons, 0) as approved_lessons,
      coalesce(req.required_records, 0) as required_records,
      coalesce(v.verified_records, 0) as verified_records,
      (
        s.is_completable = true
        and coalesce(e.expected_lessons, 0) > 0
        and coalesce(al.approved_lessons, 0) >= coalesce(e.expected_lessons, 0)
        and coalesce(v.verified_records, 0) >= coalesce(req.required_records, 0)
      ) as stage_complete
    from scope_members sm
    cross join public.buklod_stages s
    left join expected e on e.stage_code = s.stage_code::integer
    left join approved_lessons al
      on al.user_id = sm.user_id
     and al.stage_code = s.stage_code::integer
    left join required req on req.stage_code = s.stage_code::integer
    left join verified v
      on v.user_id = sm.user_id
     and v.stage_code = s.stage_code::integer
    where s.is_active = true
      and s.stage_code between 101 and 107
  ),
  stage_agg as (
    select
      ms.stage_code,
      ms.stage_title,
      ms.stage_order,
      count(*) filter (where ms.stage_complete)::int as completed_count,
      count(*) filter (
        where not ms.stage_complete and ms.approved_lessons > 0
      )::int as in_progress_count
    from member_stage ms
    group by ms.stage_code, ms.stage_title, ms.stage_order
    order by ms.stage_order
  )
  select
    (select count(*) filter (where mt.total_approved > 0)::int from member_totals mt),
    (select count(*) filter (where mt.total_approved = 0)::int from member_totals mt),
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'stage_code', sa.stage_code,
          'stage_title', sa.stage_title,
          'completed_count', sa.completed_count,
          'in_progress_count', sa.in_progress_count
        ) order by sa.stage_order
      ) from stage_agg sa),
      '[]'::jsonb
    )
  into v_lesson_active, v_lesson_not_started, v_stage_rows;

  v_base := jsonb_set(
    v_base,
    '{daily_reading}',
    coalesce(v_base->'daily_reading', '{}'::jsonb) || jsonb_build_object(
      'submitted_today', coalesce(v_daily_submitted, 0),
      'approved_today', coalesce(v_daily_approved, 0),
      'pending_review', coalesce(v_daily_pending, 0),
      'not_submitted_today', greatest(v_active_members - coalesce(v_daily_submitted, 0), 0),
      'approved_this_week', coalesce(v_daily_week_active, 0)
    ),
    true
  );

  v_base := jsonb_set(
    v_base,
    '{devotion}',
    coalesce(v_base->'devotion', '{}'::jsonb) || jsonb_build_object(
      'completed_today', coalesce(v_devotion_today, 0),
      'completed_this_week', coalesce(v_devotion_week, 0),
      'not_completed_today', greatest(v_active_members - coalesce(v_devotion_today, 0), 0)
    ),
    true
  );

  v_base := jsonb_set(
    v_base,
    '{buklod_lesson}',
    coalesce(v_base->'buklod_lesson', '{}'::jsonb) || jsonb_build_object(
      'members_active', coalesce(v_lesson_active, 0),
      'members_not_started', coalesce(v_lesson_not_started, 0),
      'stages', v_stage_rows
    ),
    true
  );

  return v_base;
end;
$function$;

-- SECURITY DEFINER functions are not exposed unless the client actually needs them.
revoke execute on function public.buklod_formation_session_key_v1() from public, anon, authenticated;
revoke execute on function public.buklod_get_formation_entry_scope_v1(text) from public, anon, authenticated;
revoke execute on function public.buklod_enqueue_scope_formation_approval_v2(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.buklod_capture_daily_reading_scope_approval_v2() from public, anon, authenticated;
revoke execute on function public.buklod_capture_devotion_scope_approval_v2() from public, anon, authenticated;
revoke execute on function public.buklod_capture_lesson_scope_approval_v2() from public, anon, authenticated;
revoke execute on function public.buklod_record_lesson_completion_exact_scope_v2(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.buklod_review_scope_formation_approval_core_r22b(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.buklod_scope_faith_monitoring_summary_v2(uuid) from public, anon;
grant execute on function public.buklod_scope_faith_monitoring_summary_v2(uuid) to authenticated, service_role;
revoke execute on function public.buklod_is_formation_scope_approver_v1(uuid, uuid) from public, anon;
grant execute on function public.buklod_is_formation_scope_approver_v1(uuid, uuid) to authenticated, service_role;
revoke execute on function public.buklod_review_scope_formation_approval_v2(uuid, boolean, text) from public, anon;
grant execute on function public.buklod_review_scope_formation_approval_v2(uuid, boolean, text) to authenticated, service_role;

notify pgrst, 'reload schema';
