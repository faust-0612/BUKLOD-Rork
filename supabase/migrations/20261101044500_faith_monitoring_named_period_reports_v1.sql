-- Additive period-level monitoring. Existing daily summary and member drill-down
-- remain unchanged. Only scoped participation metadata is returned.
create or replace function public.buklod_scope_faith_monitoring_period_v1(
  p_scope_id uuid,
  p_period text,
  p_anchor_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_today date := (timezone('Asia/Manila', now()))::date;
  v_anchor date := coalesce(p_anchor_date, (timezone('Asia/Manila', now()))::date);
  v_start date;
  v_end date;
  v_through date;
  v_expected integer;
  v_scope_type text;
  v_scope_name text;
  v_result jsonb;
begin
  if auth.uid() is null or p_scope_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_period is null or p_period not in ('week', 'month') then
    raise exception 'Report period must be week or month' using errcode = '22023';
  end if;
  -- Bound queries; do not allow unbounded history scans or future projections.
  if v_anchor > v_today or v_anchor < v_today - 366 then
    raise exception 'Report date must be within the last 12 months' using errcode = '22023';
  end if;

  select s.scope_type, s.name into v_scope_type, v_scope_name
  from public.buklod_scopes s
  where s.id = p_scope_id and s.scope_type in ('CLUSTER','ORGANIZATION')
    and s.status not in ('SUSPENDED','DELETED');
  if v_scope_type is null then
    raise exception 'Faith Monitoring workspace not found' using errcode = '42501';
  end if;

  -- Match the existing read-only member drill-down authorization exactly.
  -- A global system-admin role alone does not grant other scopes' details.
  if not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id, auth.uid())
    or (v_scope_type = 'CLUSTER' and (
      exists (
        select 1 from public.buklod_scope_role_assignments ra
        where ra.scope_id = p_scope_id and ra.user_id = auth.uid()
          and ra.status = 'ACTIVE'
          and upper(ra.role_key) in ('ADMIN','CLUSTER_ADMIN','CLUSTER_HEAD','PASTOR','MENTOR')
      )
      or public.buklod_user_has_functional_approver_role(p_scope_id, auth.uid())
    ))
  ) then
    raise exception 'Not authorized to view this scope report' using errcode = '42501';
  end if;

  if p_period = 'week' then
    -- ISO Monday -> Sunday, Philippine local dates.
    v_start := v_anchor - (extract(isodow from v_anchor)::integer - 1);
    v_end := v_start + 6;
  else
    v_start := date_trunc('month', v_anchor::timestamp)::date;
    v_end := (v_start + interval '1 month - 1 day')::date;
  end if;
  v_through := least(v_end, v_today);
  v_expected := greatest(v_through - v_start + 1, 0);

  with allowed_scopes as (
    select p_scope_id as scope_id
    union
    select child.id
    from public.buklod_scopes child
    where v_scope_type = 'ORGANIZATION'
      and child.scope_type = 'CLUSTER'
      and child.status not in ('SUSPENDED','DELETED')
      and coalesce(child.organization_id, child.parent_scope_id) = p_scope_id
  ),
  scope_members as (
    select distinct m.user_id
    from public.buklod_scope_memberships m
    join allowed_scopes a on a.scope_id = m.scope_id
    where m.membership_status = 'ACTIVE'
  ),
  named_members as (
    select sm.user_id,
      coalesce(nullif(btrim(p.full_name),''),
               nullif(btrim(concat_ws(' ',p.first_name,p.surname)),''),
               'Member') as member_name
    from scope_members sm
    left join public.profiles p on p.id = sm.user_id
  ),
  reading_events as (
    select s.user_id, a.reading_date as activity_date,
      upper(coalesce(f.status,
        case lower(s.status)
          when 'approved' then 'APPROVED'
          when 'rejected' then 'REJECTED'
          else 'PENDING'
        end)) as effective_status
    from public.daily_bible_submissions s
    join scope_members sm on sm.user_id = s.user_id
    join allowed_scopes allowed on allowed.scope_id = s.cluster_id
    join public.daily_bible_assignments a on a.id = s.assignment_id
    left join lateral (
      select x.status
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id = s.cluster_id and x.learner_id = s.user_id
        and x.item_kind = 'DAILY_READING' and x.item_id = s.id
      order by x.updated_at desc nulls last, x.created_at desc
      limit 1
    ) f on true
    where a.reading_date between v_start and v_through
  ),
  reading_days as (
    select user_id, activity_date,
      bool_or(effective_status = 'APPROVED') as approved,
      bool_or(effective_status = 'REJECTED') as revision
    from reading_events
    group by user_id, activity_date
  ),
  reading_totals as (
    select user_id, count(*)::integer as submitted_days,
      count(*) filter (where approved)::integer as approved_days,
      count(*) filter (where revision and not approved)::integer as revision_days
    from reading_days
    group by user_id
  ),
  -- A global Devotion completion is not proof of reporting in this workspace.
  -- Include it only if a submission carries an actual scope-specific approval row.
  devotion_events as (
    select s.user_id, dc.completion_date as activity_date,
      upper(coalesce(f.status, s.status, 'PENDING')) as effective_status
    from public.devotional_reward_submissions s
    join scope_members sm on sm.user_id = s.user_id
    join public.devotional_completions dc on dc.id = s.completion_id
      and dc.user_id = s.user_id
    join public.buklod_scope_formation_approvals_v2 f
      on f.learner_id = s.user_id
      and f.item_kind = 'DAILY_DEVOTION' and f.item_id = s.id
    join allowed_scopes allowed on allowed.scope_id = f.scope_id
    where dc.completion_date between v_start and v_through
  ),
  devotion_days as (
    select user_id, activity_date,
      bool_or(effective_status = 'APPROVED') as approved,
      bool_or(effective_status = 'REJECTED') as revision
    from devotion_events
    group by user_id, activity_date
  ),
  devotion_totals as (
    select user_id, count(*)::integer as submitted_days,
      count(*) filter (where approved)::integer as completed_days,
      count(*) filter (where revision and not approved)::integer as revision_days
    from devotion_days group by user_id
  ),
  lesson_events as (
    select f.learner_id as user_id, lp.lesson_id,
      btrim(t.stage_code)::integer as stage_code,
      upper(f.status) as effective_status,
      (timezone('Asia/Manila',coalesce(f.decided_at,f.updated_at,f.created_at)))::date as decision_date,
      (timezone('Asia/Manila',f.created_at))::date as submitted_date
    from public.buklod_scope_formation_approvals_v2 f
    join allowed_scopes allowed on allowed.scope_id = f.scope_id
    join scope_members sm on sm.user_id = f.learner_id
    join public.lesson_progress lp on lp.id = f.item_id and lp.user_id = f.learner_id
    join public.learning_lessons l on l.id = lp.lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where f.item_kind = 'LESSON'
      and btrim(t.stage_code) in ('101','102','103','104','105','106','107')
  ),
  lesson_totals as (
    select user_id,
      count(distinct lesson_id) filter (
        where effective_status = 'APPROVED' and decision_date between v_start and v_through
      )::integer as approved_count,
      count(distinct lesson_id) filter (
        where effective_status in ('PENDING','EVALUATING')
          and submitted_date between v_start and v_through
      )::integer as pending_count
    from lesson_events group by user_id
  ),
  lesson_by_stage as (
    select user_id, stage_code,
      count(distinct lesson_id)::integer as approved_count
    from lesson_events
    where effective_status = 'APPROVED' and decision_date between v_start and v_through
    group by user_id, stage_code
  ),
  lesson_stage_json as (
    select user_id,
      jsonb_agg(jsonb_build_object('stage_code',stage_code,'approved_count',approved_count)
        order by stage_code) as stages
    from lesson_by_stage group by user_id
  ),
  member_metrics as (
    select m.user_id, m.member_name,
      coalesce(r.submitted_days,0) as reading_submitted_days,
      coalesce(r.approved_days,0) as reading_approved_days,
      coalesce(r.revision_days,0) as reading_revision_days,
      coalesce(d.submitted_days,0) as devotion_submitted_days,
      coalesce(d.completed_days,0) as devotion_completed_days,
      coalesce(d.revision_days,0) as devotion_revision_days,
      coalesce(l.approved_count,0) as lesson_approved_count,
      coalesce(l.pending_count,0) as lesson_pending_count,
      coalesce(ls.stages,'[]'::jsonb) as lesson_stages
    from named_members m
    left join reading_totals r on r.user_id = m.user_id
    left join devotion_totals d on d.user_id = m.user_id
    left join lesson_totals l on l.user_id = m.user_id
    left join lesson_stage_json ls on ls.user_id = m.user_id
  )
  select jsonb_build_object(
    'scope_id',p_scope_id, 'scope_name',v_scope_name, 'period',p_period,
    'start_date',v_start, 'end_date',v_end, 'as_of_date',v_through,
    'expected_days',v_expected,
    'totals',jsonb_build_object(
      'active_members',count(*),
      'reading_submitted_days',coalesce(sum(reading_submitted_days),0),
      'reading_approved_days',coalesce(sum(reading_approved_days),0),
      'devotion_submitted_days',coalesce(sum(devotion_submitted_days),0),
      'devotion_completed_days',coalesce(sum(devotion_completed_days),0),
      'lesson_approved_count',coalesce(sum(lesson_approved_count),0),
      'lesson_pending_count',coalesce(sum(lesson_pending_count),0),
      'members_with_activity',count(*) filter (
        where reading_submitted_days > 0 or devotion_submitted_days > 0
          or lesson_approved_count > 0 or lesson_pending_count > 0
      )
    ),
    'members',coalesce(jsonb_agg(jsonb_build_object(
      'user_id',user_id, 'member_name',member_name,
      'reading_submitted_days',reading_submitted_days,
      'reading_approved_days',reading_approved_days,
      'reading_revision_days',reading_revision_days,
      'devotion_submitted_days',devotion_submitted_days,
      'devotion_completed_days',devotion_completed_days,
      'devotion_revision_days',devotion_revision_days,
      'lesson_approved_count',lesson_approved_count,
      'lesson_pending_count',lesson_pending_count,
      'lesson_stages',lesson_stages
    ) order by lower(member_name),user_id),'[]'::jsonb)
  ) into v_result
  from member_metrics;

  return v_result;
end;
$function$;

revoke all on function public.buklod_scope_faith_monitoring_period_v1(uuid,text,date)
  from public, anon;
grant execute on function public.buklod_scope_faith_monitoring_period_v1(uuid,text,date)
  to authenticated,service_role;

notify pgrst, 'reload schema';
