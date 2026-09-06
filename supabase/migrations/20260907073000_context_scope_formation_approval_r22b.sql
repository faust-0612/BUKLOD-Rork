-- BUKLOD MAIN R22-B
-- Context-scoped Formation approvals.
-- Additive only: legacy tables/RPCs remain intact for backward compatibility.

create table if not exists public.buklod_formation_entry_contexts (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  feature_key text not null check (feature_key in ('DAILY_READING','DAILY_DEVOTION','LESSON')),
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  entered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  primary key (user_id, session_key, feature_key)
);

alter table public.buklod_formation_entry_contexts enable row level security;
revoke all on table public.buklod_formation_entry_contexts from public, anon, authenticated;
grant all on table public.buklod_formation_entry_contexts to service_role;

create table if not exists public.buklod_scope_formation_approvals_v2 (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('DAILY_READING','DAILY_DEVOTION','LESSON')),
  item_id uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  approver_id uuid references auth.users(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists buklod_scope_formation_approvals_v2_scope_queue_idx
  on public.buklod_scope_formation_approvals_v2 (scope_id, status, created_at desc);
create index if not exists buklod_scope_formation_approvals_v2_learner_idx
  on public.buklod_scope_formation_approvals_v2 (learner_id, item_kind, item_id, created_at desc);
create unique index if not exists buklod_scope_formation_approvals_v2_open_uidx
  on public.buklod_scope_formation_approvals_v2 (scope_id, learner_id, item_kind, item_id)
  where status in ('PENDING','APPROVED');

alter table public.buklod_scope_formation_approvals_v2 enable row level security;
revoke all on table public.buklod_scope_formation_approvals_v2 from public, anon, authenticated;
grant select on table public.buklod_scope_formation_approvals_v2 to authenticated, service_role;
grant all on table public.buklod_scope_formation_approvals_v2 to service_role;

create or replace function public.buklod_formation_session_key_v1()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(nullif(auth.jwt() ->> 'session_id', ''), 'user');
$function$;

create or replace function public.buklod_is_formation_scope_approver_v1(
  p_scope_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p_scope_id is not null
    and p_user_id is not null
    and (
      (p_user_id = auth.uid() and public.buklod_is_system_admin())
      or exists (
        select 1
        from public.buklod_scopes s
        join public.buklod_scope_memberships m
          on m.scope_id = s.id
         and m.user_id = p_user_id
         and coalesce(m.membership_status::text, '') = 'ACTIVE'
        join public.buklod_scope_role_assignments ra
          on ra.scope_id = s.id
         and ra.user_id = p_user_id
         and ra.status = 'ACTIVE'
        where s.id = p_scope_id
          and s.status not in ('SUSPENDED','DELETED')
          and (
            (
              s.scope_type = 'CLUSTER'
              and upper(ra.role_key) in ('ADMIN','CLUSTER_ADMIN','CLUSTER_HEAD','PASTOR','MENTOR')
            )
            or (
              s.scope_type = 'ORGANIZATION'
              and upper(ra.role_key) in ('ADMIN','ORG_ADMIN','ORGANIZATION_ADMIN')
            )
          )
      )
    );
$function$;

create policy buklod_scope_formation_approvals_v2_read
on public.buklod_scope_formation_approvals_v2
for select
to authenticated
using (
  learner_id = auth.uid()
  or public.buklod_is_formation_scope_approver_v1(scope_id, auth.uid())
);

create or replace function public.buklod_set_formation_entry_scope_v1(
  p_feature_key text,
  p_scope_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_feature text := upper(trim(coalesce(p_feature_key, '')));
  v_session text := public.buklod_formation_session_key_v1();
  v_type text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_feature not in ('DAILY_READING','DAILY_DEVOTION','LESSON') then
    raise exception 'Unsupported Formation feature';
  end if;

  if p_scope_id is null then
    delete from public.buklod_formation_entry_contexts
    where user_id = v_user
      and session_key = v_session
      and feature_key = v_feature;
    return jsonb_build_object('ok', true, 'scope_id', null, 'feature_key', v_feature);
  end if;

  select s.scope_type
  into v_type
  from public.buklod_scopes s
  where s.id = p_scope_id
    and s.scope_type in ('ORGANIZATION','CLUSTER')
    and s.status not in ('SUSPENDED','DELETED');

  if v_type is null then
    raise exception 'Formation entry scope is not available';
  end if;

  if not public.buklod_user_is_active_scope_member(p_scope_id, v_user) then
    raise exception 'Active membership in this exact scope is required';
  end if;

  insert into public.buklod_formation_entry_contexts (
    user_id, session_key, feature_key, scope_id, entered_at, expires_at
  ) values (
    v_user, v_session, v_feature, p_scope_id, now(), now() + interval '12 hours'
  )
  on conflict (user_id, session_key, feature_key)
  do update set
    scope_id = excluded.scope_id,
    entered_at = excluded.entered_at,
    expires_at = excluded.expires_at;

  return jsonb_build_object(
    'ok', true,
    'scope_id', p_scope_id,
    'scope_type', v_type,
    'feature_key', v_feature
  );
end;
$function$;

create or replace function public.buklod_get_formation_entry_scope_v1(p_feature_key text)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
  v_feature text := upper(trim(coalesce(p_feature_key, '')));
begin
  select c.scope_id
  into v_scope
  from public.buklod_formation_entry_contexts c
  where c.user_id = auth.uid()
    and c.session_key = public.buklod_formation_session_key_v1()
    and c.feature_key = v_feature
    and c.expires_at > now()
    and public.buklod_user_is_active_scope_member(c.scope_id, auth.uid())
  order by c.entered_at desc
  limit 1;

  return v_scope;
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

  select a.id
  into v_id
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

  return v_id;
end;
$function$;

create or replace function public.buklod_capture_daily_reading_scope_approval_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
begin
  if new.status = 'pending_admin'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
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
after insert or update of status on public.daily_bible_submissions
for each row execute function public.buklod_capture_daily_reading_scope_approval_v2();

create or replace function public.buklod_capture_devotion_scope_approval_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
begin
  v_scope := public.buklod_get_formation_entry_scope_v1('DAILY_DEVOTION');
  if v_scope is not null then
    perform public.buklod_enqueue_scope_formation_approval_v2(
      v_scope, new.user_id, 'DAILY_DEVOTION', new.devotional_id
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists buklod_capture_devotion_scope_approval_v2
on public.devotional_completions;
create trigger buklod_capture_devotion_scope_approval_v2
after insert or update of completed_at on public.devotional_completions
for each row execute function public.buklod_capture_devotion_scope_approval_v2();

create or replace function public.buklod_capture_lesson_scope_approval_v2()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
begin
  if new.submitted_for_validation_at is not null
     and (
       tg_op = 'INSERT'
       or old.submitted_for_validation_at is distinct from new.submitted_for_validation_at
     ) then
    v_scope := public.buklod_get_formation_entry_scope_v1('LESSON');
    if v_scope is not null then
      perform public.buklod_enqueue_scope_formation_approval_v2(
        v_scope, new.user_id, 'LESSON', new.id
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists buklod_capture_lesson_scope_approval_v2
on public.lesson_progress;
create trigger buklod_capture_lesson_scope_approval_v2
after insert or update of submitted_for_validation_at on public.lesson_progress
for each row execute function public.buklod_capture_lesson_scope_approval_v2();

create or replace function public.buklod_scope_formation_approval_queue_v2(p_scope_id uuid)
returns table(
  approval_id uuid,
  scope_id uuid,
  item_kind text,
  item_id uuid,
  learner_id uuid,
  learner_name text,
  title text,
  subtitle text,
  submitted_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_is_formation_scope_approver_v1(p_scope_id, auth.uid()) then
    raise exception 'Exact-scope approval authority required';
  end if;

  return query
  select
    a.id,
    a.scope_id,
    a.item_kind,
    a.item_id,
    a.learner_id,
    coalesce(p.full_name, 'BUKLOD Member')::text,
    case
      when a.item_kind = 'DAILY_READING' then coalesce(dba.bible_reference, 'Daily Reading')
      when a.item_kind = 'DAILY_DEVOTION' then coalesce(d.title, 'Daily Devotion')
      when a.item_kind = 'LESSON' then coalesce(ll.title, 'BUKLOD Lesson')
      else a.item_kind
    end::text,
    case
      when a.item_kind = 'DAILY_READING' then coalesce(dba.reading_date::text, '')
      when a.item_kind = 'DAILY_DEVOTION' then coalesce(d.bible_passage, '')
      when a.item_kind = 'LESSON' then coalesce(lt.title, '')
      else ''
    end::text,
    a.created_at,
    a.status
  from public.buklod_scope_formation_approvals_v2 a
  left join public.profiles p on p.id = a.learner_id
  left join public.daily_bible_submissions dbs
    on a.item_kind = 'DAILY_READING' and dbs.id = a.item_id
  left join public.daily_bible_assignments dba on dba.id = dbs.assignment_id
  left join public.devotionals d
    on a.item_kind = 'DAILY_DEVOTION' and d.id = a.item_id
  left join public.lesson_progress lp
    on a.item_kind = 'LESSON' and lp.id = a.item_id
  left join public.learning_lessons ll on ll.id = lp.lesson_id
  left join public.learning_tracks lt on lt.id = ll.track_id
  where a.scope_id = p_scope_id
    and a.status = 'PENDING'
  order by a.created_at asc;
end;
$function$;

create or replace function public.buklod_record_lesson_completion_exact_scope_v2(
  p_scope_id uuid,
  p_progress_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  progress_record record;
  lesson_record record;
  enrollment_record record;
  last_attempt record;
  active_repeat record;
  next_attempt smallint;
  new_id uuid;
  track_stage integer;
  access jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_is_formation_scope_approver_v1(p_scope_id, actor) then
    raise exception 'Exact-scope approval authority required';
  end if;

  select lp.* into progress_record
  from public.lesson_progress lp
  where lp.id = p_progress_id
    and lp.submitted_for_validation_at is not null
  for update;

  if progress_record.id is null then raise exception 'Formation learning progress not found'; end if;
  if progress_record.user_id = actor then raise exception 'Members cannot approve their own completion'; end if;
  if not public.buklod_user_is_active_scope_member(p_scope_id, progress_record.user_id) then
    raise exception 'Learner is not an ACTIVE member of this submission scope';
  end if;

  select
    l.id, l.track_id, l.title as lesson_title, l.bayanihan_reward,
    t.formation_program, t.status as track_status,
    public.buklod_formation_track_stage_code(t.id) as track_stage
  into lesson_record
  from public.learning_lessons l
  join public.learning_tracks t on t.id = l.track_id
  where l.id = progress_record.lesson_id;

  if lesson_record.id is null then raise exception 'Lesson not found'; end if;
  track_stage := lesson_record.track_stage;

  if public.buklod_formation_engine_v2_enabled() and track_stage between 101 and 107 then
    access := public.buklod_formation_evaluate_stage_access(progress_record.user_id, track_stage);
    if coalesce((access->>'access_allowed')::boolean, false) = false
       and coalesce((access->>'repeat_required')::boolean, false) = false then
      raise exception 'Formation stage access denied for lesson recording';
    end if;
  end if;

  if lesson_record.formation_program not in ('ccp','discipleship','mentoring')
     and track_stage is null then
    raise exception 'Lesson is not a BUKLOD formation lesson';
  end if;

  select e.* into enrollment_record
  from public.track_enrollments e
  where e.id = progress_record.enrollment_id
    and e.user_id = progress_record.user_id
    and e.track_id = lesson_record.track_id
    and e.status in ('active','completed')
  limit 1;

  if enrollment_record.id is null then raise exception 'Member is not enrolled in this lesson track'; end if;

  select a.* into last_attempt
  from public.member_lesson_attempts a
  where a.user_id = progress_record.user_id
    and a.lesson_id = progress_record.lesson_id
  order by a.attempt_number desc
  limit 1;

  select r.* into active_repeat
  from public.buklod_formation_repeat_requests r
  where r.member_id = progress_record.user_id
    and r.status = 'ACTIVE'
    and (
      r.lesson_id = progress_record.lesson_id
      or (r.repeat_scope = 'STAGE' and r.stage_code = track_stage)
    )
  order by r.requested_at desc
  limit 1;

  if last_attempt.id is null then
    next_attempt := 1;
  elsif public.buklod_formation_engine_v2_enabled() then
    if last_attempt.review_status = 'pending_admin' and last_attempt.reset_at is null then
      raise exception 'This lesson has a legacy pending attempt that must be finalized first';
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
    user_id, lesson_id, enrollment_id, attempt_number,
    pastor_id, pastor_note, pastor_validated_at,
    review_status, admin_id, admin_reviewed_at, admin_note,
    reward_amount, supersedes_attempt_id, repeat_request_id, is_active_attempt
  ) values (
    progress_record.user_id, progress_record.lesson_id, enrollment_record.id, next_attempt,
    actor, nullif(trim(coalesce(p_note, '')), ''), now(),
    'approved', actor, now(), nullif(trim(coalesce(p_note, '')), ''),
    coalesce(lesson_record.bayanihan_reward, 0), last_attempt.id, active_repeat.id, true
  ) returning id into new_id;

  if last_attempt.id is not null then
    update public.member_lesson_attempts
    set is_active_attempt = false
    where id = last_attempt.id and id <> new_id;
  end if;

  update public.lesson_progress
  set completed_at = coalesce(completed_at, now()), updated_at = now()
  where id = progress_record.id;

  perform public.buklod_payout_learning_progress_rewards_v1(
    new_id,
    progress_record.user_id,
    progress_record.lesson_id,
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

create or replace function public.buklod_review_scope_formation_approval_v2(
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
      set status = 'approved', reviewed_by = actor, reviewed_at = now(),
          admin_note = nullif(trim(coalesce(p_remarks, '')), '')
      where id = daily.id;

      perform public.buklod_payout_daily_bible_rewards_v1(
        daily.id, daily.user_id, daily.assignment_id,
        daily.bible_reference, daily.reading_date, actor
      );
    else
      update public.daily_bible_submissions
      set status = 'rejected', reviewed_by = actor, reviewed_at = now(),
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
      set submitted_for_validation_at = null, updated_at = now()
      where id = rec.item_id and user_id = rec.learner_id;
    end if;

  elsif rec.item_kind = 'DAILY_DEVOTION' then
    if not exists (
      select 1 from public.devotional_completions dc
      where dc.user_id = rec.learner_id and dc.devotional_id = rec.item_id
    ) then
      raise exception 'Devotional completion not found';
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

revoke all on function public.buklod_set_formation_entry_scope_v1(text, uuid) from public, anon;
grant execute on function public.buklod_set_formation_entry_scope_v1(text, uuid) to authenticated, service_role;
revoke all on function public.buklod_get_formation_entry_scope_v1(text) from public, anon;
grant execute on function public.buklod_get_formation_entry_scope_v1(text) to authenticated, service_role;
revoke all on function public.buklod_scope_formation_approval_queue_v2(uuid) from public, anon;
grant execute on function public.buklod_scope_formation_approval_queue_v2(uuid) to authenticated, service_role;
revoke all on function public.buklod_review_scope_formation_approval_v2(uuid, boolean, text) from public, anon;
grant execute on function public.buklod_review_scope_formation_approval_v2(uuid, boolean, text) to authenticated, service_role;

notify pgrst, 'reload schema';
