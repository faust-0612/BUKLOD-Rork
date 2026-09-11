-- BUKLOD Formation automatic completion R2
-- 1) repair community photo reads without broad table grants
-- 2) make devotional and lesson completion atomic + automatic
-- 3) expose canonical automatic-pipeline report summary

alter function public.buklod_storage_object_select_allowed_v1(text,text) security definer;
alter function public.buklod_storage_object_select_allowed_v1(text,text) set search_path to '';

create or replace function public.complete_my_devotional_v2(
  p_devotional_id uuid,
  p_reflection text,
  p_application text,
  p_privacy text default 'private'
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_submission_id uuid;
  v_submission_status text;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_devotional_id is null then raise exception 'Devotional is required'; end if;
  if char_length(btrim(coalesce(p_reflection,''))) < 20 then
    raise exception 'Reflection must contain at least 20 characters';
  end if;
  if char_length(btrim(coalesce(p_application,''))) < 20 then
    raise exception 'Application must contain at least 20 characters';
  end if;
  if lower(coalesce(p_privacy,'')) not in ('private','leader','group','church') then
    raise exception 'Invalid reflection privacy';
  end if;

  perform public.buklod_require_active_cluster_membership(v_user);

  if not exists (
    select 1 from public.devotionals d
    where d.id=p_devotional_id and d.is_published=true
  ) then
    raise exception 'Published devotional not found';
  end if;

  select s.id,s.status
    into v_submission_id,v_submission_status
  from public.devotional_reward_submissions s
  where s.user_id=v_user and s.devotional_id=p_devotional_id
  for update;

  if v_submission_id is not null and v_submission_status='approved' then
    return jsonb_build_object(
      'ok',true,
      'submission_id',v_submission_id,
      'status','approved',
      'already_completed',true,
      'automatic',true
    );
  end if;

  insert into public.reflections(
    user_id,devotional_id,reflection_text,application_text,privacy,updated_at
  ) values (
    v_user,p_devotional_id,btrim(p_reflection),btrim(p_application),
    lower(p_privacy)::public.content_privacy,v_now
  )
  on conflict (user_id,devotional_id) do update set
    reflection_text=excluded.reflection_text,
    application_text=excluded.application_text,
    privacy=excluded.privacy,
    updated_at=v_now;

  insert into public.devotional_completions(
    user_id,devotional_id,completed_at,completion_date
  ) values (
    v_user,p_devotional_id,v_now,(v_now at time zone 'Asia/Manila')::date
  )
  on conflict (user_id,devotional_id) do update set
    completed_at=excluded.completed_at,
    completion_date=excluded.completion_date;

  v_submission_id := public.submit_devotional_for_bayanihan(p_devotional_id);

  select s.status into v_submission_status
  from public.devotional_reward_submissions s
  where s.id=v_submission_id;

  return jsonb_build_object(
    'ok',true,
    'submission_id',v_submission_id,
    'status',coalesce(v_submission_status,'pending_admin'),
    'already_completed',false,
    'automatic',true
  );
end;
$function$;

create or replace function public.complete_my_formation_lesson_v2(
  p_enrollment_id uuid,
  p_lesson_id uuid,
  p_question_answers jsonb,
  p_reflection text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_response_id uuid;
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_enrollment_id is null or p_lesson_id is null then
    raise exception 'Enrollment and lesson are required';
  end if;

  v_response_id := public.submit_learning_lesson_response_v1(
    p_enrollment_id,p_lesson_id,p_question_answers,p_reflection
  );

  perform public.save_my_formation_lesson_study(
    p_enrollment_id,p_lesson_id,p_reflection
  );

  v_result := public.submit_my_formation_lesson_for_validation_v1(
    p_enrollment_id,p_lesson_id
  );

  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object(
    'ok',true,
    'response_id',v_response_id,
    'automatic',true,
    'human_approval_required',false
  );
end;
$function$;

create or replace function public.buklod_scope_faith_monitoring_summary_v3(p_scope_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_base jsonb;
  v_today date := (timezone('Asia/Manila',now()))::date;
  v_week_start date := v_today-6;
  v_active_members int := 0;
  v_assignment_id uuid;
  v_devotional_id uuid;
  v_daily_submitted int := 0;
  v_daily_approved int := 0;
  v_daily_checking int := 0;
  v_daily_revision int := 0;
  v_dev_submitted int := 0;
  v_dev_approved int := 0;
  v_dev_checking int := 0;
  v_dev_revision int := 0;
  v_dev_week int := 0;
  v_lesson_submitted_today int := 0;
  v_lesson_approved_today int := 0;
  v_lesson_checking int := 0;
  v_lesson_revision int := 0;
begin
  v_base := public.buklod_scope_faith_monitoring_summary_v2(p_scope_id);
  v_active_members := coalesce((v_base->>'active_members')::int,0);
  v_assignment_id := nullif(v_base->'daily_reading'->>'assignment_id','')::uuid;
  v_devotional_id := nullif(v_base->'devotion'->>'devotional_id','')::uuid;

  if v_assignment_id is not null then
    select
      count(distinct s.user_id)::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'')='APPROVED' or (a.id is null and s.status='approved'))::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'') in ('EVALUATING','PENDING'))::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'')='REJECTED' or s.status='rejected')::int
    into v_daily_submitted,v_daily_approved,v_daily_checking,v_daily_revision
    from public.daily_bible_submissions s
    join public.buklod_scope_memberships m on m.user_id=s.user_id and m.scope_id=p_scope_id and m.membership_status='ACTIVE'
    left join lateral (
      select x.id,x.status
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id=p_scope_id and x.learner_id=s.user_id and x.item_kind='DAILY_READING' and x.item_id=s.id
      order by x.created_at desc limit 1
    ) a on true
    where s.assignment_id=v_assignment_id;
  end if;

  if v_devotional_id is not null then
    select
      count(distinct s.user_id)::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'')='APPROVED' or (a.id is null and s.status='approved'))::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'') in ('EVALUATING','PENDING'))::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'')='REJECTED' or s.status='rejected')::int
    into v_dev_submitted,v_dev_approved,v_dev_checking,v_dev_revision
    from public.devotional_reward_submissions s
    join public.buklod_scope_memberships m on m.user_id=s.user_id and m.scope_id=p_scope_id and m.membership_status='ACTIVE'
    left join lateral (
      select x.id,x.status
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id=p_scope_id and x.learner_id=s.user_id and x.item_kind='DAILY_DEVOTION' and x.item_id=s.id
      order by x.created_at desc limit 1
    ) a on true
    where s.devotional_id=v_devotional_id;
  end if;

  select count(distinct s.user_id)::int
  into v_dev_week
  from public.devotional_reward_submissions s
  join public.devotional_completions dc on dc.id=s.completion_id
  join public.buklod_scope_memberships m on m.user_id=s.user_id and m.scope_id=p_scope_id and m.membership_status='ACTIVE'
  where dc.completion_date between v_week_start and v_today;

  select
    count(distinct a.learner_id) filter (where (a.created_at at time zone 'Asia/Manila')::date=v_today)::int,
    count(distinct a.learner_id) filter (where a.status='APPROVED' and (coalesce(a.decided_at,a.updated_at) at time zone 'Asia/Manila')::date=v_today)::int,
    count(*) filter (where a.status in ('EVALUATING','PENDING'))::int,
    count(*) filter (where a.status='REJECTED')::int
  into v_lesson_submitted_today,v_lesson_approved_today,v_lesson_checking,v_lesson_revision
  from public.buklod_scope_formation_approvals_v2 a
  where a.scope_id=p_scope_id and a.item_kind='LESSON';

  v_base := jsonb_set(v_base,'{daily_reading}',coalesce(v_base->'daily_reading','{}'::jsonb) || jsonb_build_object(
    'submitted_today',coalesce(v_daily_submitted,0),
    'approved_today',coalesce(v_daily_approved,0),
    'automatic_checking',coalesce(v_daily_checking,0),
    'needs_revision',coalesce(v_daily_revision,0),
    'pending_review',coalesce(v_daily_checking,0),
    'not_submitted_today',greatest(v_active_members-coalesce(v_daily_submitted,0),0)
  ),true);

  v_base := jsonb_set(v_base,'{devotion}',coalesce(v_base->'devotion','{}'::jsonb) || jsonb_build_object(
    'submitted_today',coalesce(v_dev_submitted,0),
    'approved_today',coalesce(v_dev_approved,0),
    'automatic_checking',coalesce(v_dev_checking,0),
    'needs_revision',coalesce(v_dev_revision,0),
    'completed_today',coalesce(v_dev_submitted,0),
    'completed_this_week',coalesce(v_dev_week,0),
    'not_completed_today',greatest(v_active_members-coalesce(v_dev_submitted,0),0)
  ),true);

  v_base := jsonb_set(v_base,'{buklod_lesson}',coalesce(v_base->'buklod_lesson','{}'::jsonb) || jsonb_build_object(
    'submitted_today',coalesce(v_lesson_submitted_today,0),
    'approved_today',coalesce(v_lesson_approved_today,0),
    'automatic_checking',coalesce(v_lesson_checking,0),
    'needs_revision',coalesce(v_lesson_revision,0)
  ),true);

  v_base := v_base || jsonb_build_object(
    'submission_mode','AUTOMATIC',
    'human_approval_required',false
  );

  return v_base;
end;
$function$;

revoke all on function public.complete_my_devotional_v2(uuid,text,text,text) from public,anon;
grant execute on function public.complete_my_devotional_v2(uuid,text,text,text) to authenticated,service_role;
revoke all on function public.complete_my_formation_lesson_v2(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.complete_my_formation_lesson_v2(uuid,uuid,jsonb,text) to authenticated,service_role;
revoke all on function public.buklod_scope_faith_monitoring_summary_v3(uuid) from public,anon;
grant execute on function public.buklod_scope_faith_monitoring_summary_v3(uuid) to authenticated,service_role;
