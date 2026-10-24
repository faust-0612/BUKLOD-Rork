-- Exact-origin report counting: never roll up child Cluster submissions into an Organization report.
-- Replaces only v3's reporting definition; leaves stored submissions untouched.
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
  v_scope_type text;
  v_active_members int := 0;
  v_assignment_id uuid;
  v_bible_reference text;
  v_latest_assignment_id uuid;
  v_latest_bible_reference text;
  v_devotional_id uuid;
  v_daily_submitted int := 0;
  v_daily_approved int := 0;
  v_daily_checking int := 0;
  v_daily_revision int := 0;
  v_daily_approved_week int := 0;
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
  -- Keep all existing access checks, scope metadata, lesson stage data, and
  -- compatibility fields from v2. R3 only repairs canonical Daily Reading
  -- counting and leaves Devotion/Lesson semantics unchanged.
  v_base := public.buklod_scope_faith_monitoring_summary_v2(p_scope_id);

  select s.scope_type
  into v_scope_type
  from public.buklod_scopes s
  where s.id=p_scope_id
    and s.status not in ('SUSPENDED','DELETED');

  if v_scope_type is null then
    raise exception 'Scope not found';
  end if;

  v_active_members := coalesce((v_base->>'active_members')::int,0);
  v_assignment_id := nullif(v_base->'daily_reading'->>'assignment_id','')::uuid;
  v_bible_reference := nullif(v_base->'daily_reading'->>'bible_reference','');
  v_devotional_id := nullif(v_base->'devotion'->>'devotional_id','')::uuid;

  -- For an exact Cluster report, the canonical membership table is also the
  -- authoritative denominator. Organization-level reports retain the v2
  -- denominator because they may aggregate several child Clusters.
  if v_scope_type='CLUSTER' then
    select count(distinct m.user_id)::int
    into v_active_members
    from public.buklod_scope_memberships m
    where m.scope_id=p_scope_id
      and m.membership_status='ACTIVE';
  end if;

  -- Daily Reading R3: read the exact canonical submission scope. A submission
  -- made today for an earlier assignment is still a submission made today.
  with scoped_today as (
    select s.*
    from public.daily_bible_submissions s
    where (s.submitted_at at time zone 'Asia/Manila')::date=v_today
      and (
        (s.cluster_id = p_scope_id)
      )
  )
  select
    count(distinct s.user_id)::int,
    count(distinct s.user_id) filter (
      where coalesce(a.status,
        case s.status
          when 'approved' then 'APPROVED'
          when 'rejected' then 'REJECTED'
          else 'PENDING'
        end
      )='APPROVED'
    )::int,
    count(distinct s.user_id) filter (
      where coalesce(a.status,
        case s.status
          when 'approved' then 'APPROVED'
          when 'rejected' then 'REJECTED'
          else 'PENDING'
        end
      ) in ('EVALUATING','PENDING')
    )::int,
    count(distinct s.user_id) filter (
      where coalesce(a.status,
        case s.status
          when 'approved' then 'APPROVED'
          when 'rejected' then 'REJECTED'
          else 'PENDING'
        end
      )='REJECTED'
    )::int
  into v_daily_submitted,v_daily_approved,v_daily_checking,v_daily_revision
  from scoped_today s
  left join lateral (
    select x.id,x.status
    from public.buklod_scope_formation_approvals_v2 x
    where x.scope_id=s.cluster_id
      and x.learner_id=s.user_id
      and x.item_kind='DAILY_READING'
      and x.item_id=s.id
    order by x.created_at desc
    limit 1
  ) a on true;

  -- Use the most recently submitted Daily Reading today for the card reference.
  -- If there is no submission today, keep v2's current assignment/reference.
  select s.assignment_id,a.bible_reference
  into v_latest_assignment_id,v_latest_bible_reference
  from public.daily_bible_submissions s
  join public.daily_bible_assignments a on a.id=s.assignment_id
  where (s.submitted_at at time zone 'Asia/Manila')::date=v_today
    and (
      (s.cluster_id = p_scope_id)
    )
  order by s.submitted_at desc
  limit 1;

  if v_latest_assignment_id is not null then
    v_assignment_id := v_latest_assignment_id;
    v_bible_reference := v_latest_bible_reference;
  end if;

  select count(distinct s.user_id)::int
  into v_daily_approved_week
  from public.daily_bible_submissions s
  left join lateral (
    select x.status
    from public.buklod_scope_formation_approvals_v2 x
    where x.scope_id=s.cluster_id
      and x.learner_id=s.user_id
      and x.item_kind='DAILY_READING'
      and x.item_id=s.id
    order by x.created_at desc
    limit 1
  ) approval on true
  where (s.submitted_at at time zone 'Asia/Manila')::date between v_week_start and v_today
    and coalesce(approval.status,
      case s.status
        when 'approved' then 'APPROVED'
        when 'rejected' then 'REJECTED'
        else 'PENDING'
      end
    )='APPROVED'
    and (
      (s.cluster_id = p_scope_id)
    );

  -- Preserve existing Devotion logic for this isolated R3 repair.
  if v_devotional_id is not null then
    select
      count(distinct s.user_id)::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'')='APPROVED' or (a.id is null and s.status='approved'))::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'') in ('EVALUATING','PENDING'))::int,
      count(distinct s.user_id) filter (where coalesce(a.status,'')='REJECTED' or s.status='rejected')::int
    into v_dev_submitted,v_dev_approved,v_dev_checking,v_dev_revision
    from public.devotional_reward_submissions s
    join lateral (
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
  where dc.completion_date between v_week_start and v_today
    and exists (
      select 1 from public.buklod_scope_formation_approvals_v2 a
      where a.scope_id=p_scope_id
        and a.learner_id=s.user_id
        and a.item_kind='DAILY_DEVOTION'
        and a.item_id=s.id
    );

  select
    count(distinct a.learner_id) filter (where (a.created_at at time zone 'Asia/Manila')::date=v_today)::int,
    count(distinct a.learner_id) filter (where a.status='APPROVED' and (coalesce(a.decided_at,a.updated_at) at time zone 'Asia/Manila')::date=v_today)::int,
    count(*) filter (where a.status in ('EVALUATING','PENDING'))::int,
    count(*) filter (where a.status='REJECTED')::int
  into v_lesson_submitted_today,v_lesson_approved_today,v_lesson_checking,v_lesson_revision
  from public.buklod_scope_formation_approvals_v2 a
  where a.scope_id=p_scope_id and a.item_kind='LESSON';

  v_base := jsonb_set(v_base,'{active_members}',to_jsonb(coalesce(v_active_members,0)),true);

  v_base := jsonb_set(v_base,'{daily_reading}',coalesce(v_base->'daily_reading','{}'::jsonb) || jsonb_build_object(
    'assignment_id',v_assignment_id,
    'bible_reference',v_bible_reference,
    'submitted_today',coalesce(v_daily_submitted,0),
    'approved_today',coalesce(v_daily_approved,0),
    'automatic_checking',coalesce(v_daily_checking,0),
    'needs_revision',coalesce(v_daily_revision,0),
    'pending_review',coalesce(v_daily_checking,0),
    'not_submitted_today',greatest(v_active_members-coalesce(v_daily_submitted,0),0),
    'approved_this_week',coalesce(v_daily_approved_week,0)
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


-- Show Faith report privacy: exact scope leadership only.
-- Keep v1-v3 callable internally by their SECURITY DEFINER owner, not directly by clients.
create or replace function public.buklod_scope_faith_monitoring_summary_v4(p_scope_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or p_scope_id is null then
    raise exception 'Not authorized to view this scope report' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.buklod_scopes s
    where s.id = p_scope_id
      and s.scope_type in ('CLUSTER', 'ORGANIZATION')
      and s.status not in ('SUSPENDED', 'DELETED')
  ) or not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id, auth.uid())
    or (
      exists (
        select 1 from public.buklod_scopes s
        where s.id = p_scope_id and s.scope_type = 'CLUSTER'
      )
      and public.buklod_is_cluster_approver(p_scope_id, auth.uid())
    )
  ) then
    raise exception 'Not authorized to view this scope report' using errcode = '42501';
  end if;

  return public.buklod_scope_faith_monitoring_summary_v3(p_scope_id);
end;
$function$;

revoke all on function public.buklod_scope_faith_monitoring_summary_v1(uuid) from public, anon, authenticated;
revoke all on function public.buklod_scope_faith_monitoring_summary_v2(uuid) from public, anon, authenticated;
revoke all on function public.buklod_scope_faith_monitoring_summary_v3(uuid) from public, anon, authenticated;
revoke all on function public.buklod_scope_faith_monitoring_summary_v4(uuid) from public, anon;
grant execute on function public.buklod_scope_faith_monitoring_summary_v4(uuid) to authenticated, service_role;
