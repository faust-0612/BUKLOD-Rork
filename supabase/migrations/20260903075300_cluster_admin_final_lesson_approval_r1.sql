-- BUKLOD Formation: Cluster Admin is the sole final approver for lesson completion.
-- Legacy function/column names are preserved for app compatibility; semantics are now Cluster Admin final approval.

create or replace function public.can_validate_formation_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select p_user_id is not null
    and auth.uid() is not null
    and p_user_id <> auth.uid()
    and exists (
      select 1
      from public.buklod_scope_memberships learner_m
      join public.buklod_scopes s
        on s.id = learner_m.scope_id
       and s.scope_type = 'CLUSTER'
      where learner_m.user_id = p_user_id
        and coalesce(learner_m.membership_status::text, '') = 'ACTIVE'
        and public.buklod_scope_is_active_lifecycle(learner_m.scope_id)
        and exists (
          select 1
          from public.buklod_scope_memberships actor_m
          where actor_m.scope_id = learner_m.scope_id
            and actor_m.user_id = auth.uid()
            and coalesce(actor_m.membership_status::text, '') = 'ACTIVE'
        )
        and public.buklod_user_has_scope_roles(
          learner_m.scope_id,
          auth.uid(),
          array['ADMIN','CLUSTER_ADMIN','CLUSTER_HEAD']::text[]
        )
    );
$function$;

create or replace function public.pastor_get_learning_validation_queue_v2()
returns table(
  progress_id uuid,
  user_id uuid,
  member_name text,
  church_id uuid,
  church_name text,
  enrollment_id uuid,
  lesson_id uuid,
  lesson_number integer,
  lesson_title text,
  track_title text,
  studied_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  v_can boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s
      on s.id = ra.scope_id
     and s.scope_type = 'CLUSTER'
    join public.buklod_scope_memberships m
      on m.scope_id = s.id
     and m.user_id = actor
     and coalesce(m.membership_status::text, '') = 'ACTIVE'
    where ra.user_id = actor
      and ra.status = 'ACTIVE'
      and upper(ra.role_key) in ('ADMIN','CLUSTER_ADMIN','CLUSTER_HEAD')
      and public.buklod_scope_is_active_lifecycle(s.id)
  ) into v_can;

  if not v_can then
    raise exception 'Cluster Admin access required';
  end if;

  return query
  select
    lp.id,
    p.id,
    p.full_name,
    p.church_id,
    coalesce(c.name, 'Cluster')::text,
    lp.enrollment_id,
    l.id,
    l.lesson_number,
    l.title,
    t.title,
    lp.updated_at
  from public.lesson_progress lp
  join public.profiles p on p.id = lp.user_id
  left join public.churches c on c.id = p.church_id
  join public.learning_lessons l on l.id = lp.lesson_id
  join public.learning_tracks t on t.id = l.track_id
  join public.track_enrollments e on e.id = lp.enrollment_id
  where p.is_active = true
    and lp.submitted_for_validation_at is not null
    and coalesce(p.is_verified, false) = true
    and t.formation_program in ('ccp','discipleship')
    and e.user_id = p.id
    and public.can_validate_formation_member(p.id)
    and not exists (
      select 1
      from public.member_lesson_attempts a
      where a.user_id = p.id
        and a.lesson_id = l.id
        and a.reset_at is null
        and a.review_status = 'approved'
    )
  order by c.name nulls last, p.full_name, t.title, l.lesson_number;
end;
$function$;

create or replace function public.record_member_lesson_completion(
  p_user_id uuid,
  p_lesson_id uuid,
  p_pastor_note text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  lesson_record record;
  enrollment_record record;
  last_attempt record;
  active_repeat record;
  next_attempt smallint;
  new_id uuid;
  track_stage integer;
  access jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if p_user_id is null or p_lesson_id is null then
    raise exception 'Member and lesson are required';
  end if;

  if not public.can_validate_formation_member(p_user_id) then
    raise exception 'Only the learner''s Cluster Admin can approve this completion';
  end if;

  select
    l.id,
    l.track_id,
    l.title as lesson_title,
    l.bayanihan_reward,
    t.formation_program,
    t.status as track_status,
    public.buklod_formation_track_stage_code(t.id) as track_stage
  into lesson_record
  from public.learning_lessons l
  join public.learning_tracks t on t.id = l.track_id
  where l.id = p_lesson_id;

  if lesson_record.id is null then
    raise exception 'Lesson not found';
  end if;

  track_stage := lesson_record.track_stage;

  if public.buklod_formation_engine_v2_enabled()
     and track_stage between 101 and 107 then
    access := public.buklod_formation_evaluate_stage_access(p_user_id, track_stage);

    if coalesce((access->>'access_allowed')::boolean, false) = false
       and coalesce((access->>'repeat_required')::boolean, false) = false then
      raise exception 'Formation stage access denied for lesson recording';
    end if;
  end if;

  if lesson_record.formation_program not in ('ccp','discipleship')
     and track_stage is null then
    raise exception 'Lesson is not a BUKLOD formation lesson';
  end if;

  select e.*
  into enrollment_record
  from public.track_enrollments e
  where e.user_id = p_user_id
    and e.track_id = lesson_record.track_id
    and e.status in ('active','completed')
  limit 1;

  if enrollment_record.id is null then
    raise exception 'Member is not enrolled in this lesson track';
  end if;

  select a.*
  into last_attempt
  from public.member_lesson_attempts a
  where a.user_id = p_user_id
    and a.lesson_id = p_lesson_id
  order by a.attempt_number desc
  limit 1;

  select r.*
  into active_repeat
  from public.buklod_formation_repeat_requests r
  where r.member_id = p_user_id
    and r.status = 'ACTIVE'
    and (
      r.lesson_id = p_lesson_id
      or (r.repeat_scope = 'STAGE' and r.stage_code = track_stage)
    )
  order by r.requested_at desc
  limit 1;

  if last_attempt.id is null then
    next_attempt := 1;
  elsif public.buklod_formation_engine_v2_enabled() then
    if last_attempt.review_status = 'pending_admin' and last_attempt.reset_at is null then
      raise exception 'This lesson has a legacy pending attempt that must be finalized by the Cluster Admin';
    end if;

    if last_attempt.review_status = 'approved'
       and active_repeat.id is null
       and last_attempt.reset_at is null then
      raise exception 'This lesson is already officially approved';
    end if;

    next_attempt := last_attempt.attempt_number + 1;
  else
    if last_attempt.reset_at is null then
      raise exception 'Previous attempt must be reset before another attempt is created';
    end if;
    next_attempt := last_attempt.attempt_number + 1;
  end if;

  insert into public.member_lesson_attempts (
    user_id,
    lesson_id,
    enrollment_id,
    attempt_number,
    pastor_id,
    pastor_note,
    pastor_validated_at,
    review_status,
    admin_id,
    admin_reviewed_at,
    admin_note,
    reward_amount,
    supersedes_attempt_id,
    repeat_request_id,
    is_active_attempt
  )
  values (
    p_user_id,
    p_lesson_id,
    enrollment_record.id,
    next_attempt,
    actor,
    nullif(trim(coalesce(p_pastor_note, '')), ''),
    now(),
    'approved',
    actor,
    now(),
    nullif(trim(coalesce(p_pastor_note, '')), ''),
    coalesce(lesson_record.bayanihan_reward, 0),
    last_attempt.id,
    active_repeat.id,
    true
  )
  returning id into new_id;

  if last_attempt.id is not null then
    update public.member_lesson_attempts
    set is_active_attempt = false
    where id = last_attempt.id
      and id <> new_id;
  end if;

  update public.lesson_progress
  set completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where user_id = p_user_id
    and lesson_id = p_lesson_id
    and enrollment_id = enrollment_record.id;

  perform public.buklod_payout_learning_progress_rewards_v1(
    new_id,
    p_user_id,
    p_lesson_id,
    actor,
    lesson_record.lesson_title,
    actor
  );

  if active_repeat.id is not null then
    perform public.buklod_formation_try_complete_repeat_request(active_repeat.id);
  end if;

  return new_id;
end;
$function$;

create or replace function public.admin_review_member_lesson_attempt(
  p_attempt_id uuid,
  p_approve boolean,
  p_admin_note text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  rec record;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select
    a.*,
    l.title as lesson_title
  into rec
  from public.member_lesson_attempts a
  join public.learning_lessons l on l.id = a.lesson_id
  where a.id = p_attempt_id
  for update of a;

  if rec.id is null then
    raise exception 'Attempt not found';
  end if;

  if rec.review_status <> 'pending_admin' then
    raise exception 'This attempt has already been reviewed';
  end if;

  if not public.can_validate_formation_member(rec.user_id) then
    raise exception 'Only the learner''s Cluster Admin can review this completion';
  end if;

  if p_approve then
    update public.member_lesson_attempts
    set review_status = 'approved',
        admin_id = actor,
        admin_reviewed_at = now(),
        admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
        is_active_attempt = true,
        updated_at = now()
    where id = p_attempt_id;

    update public.member_lesson_attempts
    set is_active_attempt = false,
        updated_at = now()
    where user_id = rec.user_id
      and lesson_id = rec.lesson_id
      and id <> p_attempt_id
      and is_active_attempt = true;

    update public.lesson_progress
    set completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where user_id = rec.user_id
      and lesson_id = rec.lesson_id;

    perform public.buklod_payout_learning_progress_rewards_v1(
      rec.id,
      rec.user_id,
      rec.lesson_id,
      actor,
      rec.lesson_title,
      actor
    );

    if rec.repeat_request_id is not null then
      perform public.buklod_formation_try_complete_repeat_request(rec.repeat_request_id);
    end if;
  else
    update public.member_lesson_attempts
    set review_status = 'rejected',
        admin_id = actor,
        admin_reviewed_at = now(),
        admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
        updated_at = now()
    where id = p_attempt_id;
  end if;
end;
$function$;

create or replace function public.pastor_validate_learning_progress_v2(
  p_progress_id uuid,
  p_pastor_note text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  rec record;
  attempt_id uuid;
  legacy_pending_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select lp.id, lp.user_id, lp.lesson_id
  into rec
  from public.lesson_progress lp
  join public.learning_lessons l on l.id = lp.lesson_id
  join public.learning_tracks t on t.id = l.track_id
  where lp.id = p_progress_id
    and lp.submitted_for_validation_at is not null
    and t.formation_program in ('ccp','discipleship');

  if rec.id is null then
    raise exception 'Formation learning progress not found';
  end if;

  if not public.can_validate_formation_member(rec.user_id) then
    raise exception 'Only the learner''s Cluster Admin can approve this completion';
  end if;

  if exists (
    select 1
    from public.member_lesson_attempts a
    where a.user_id = rec.user_id
      and a.lesson_id = rec.lesson_id
      and a.reset_at is null
      and a.review_status = 'approved'
  ) then
    raise exception 'This lesson is already officially approved';
  end if;

  select a.id
  into legacy_pending_id
  from public.member_lesson_attempts a
  where a.user_id = rec.user_id
    and a.lesson_id = rec.lesson_id
    and a.reset_at is null
    and a.review_status = 'pending_admin'
  order by a.attempt_number desc
  limit 1;

  if legacy_pending_id is not null then
    perform public.admin_review_member_lesson_attempt(
      legacy_pending_id,
      true,
      p_pastor_note
    );
    return legacy_pending_id;
  end if;

  select public.record_member_lesson_completion(
    rec.user_id,
    rec.lesson_id,
    p_pastor_note
  ) into attempt_id;

  return attempt_id;
end;
$function$;
