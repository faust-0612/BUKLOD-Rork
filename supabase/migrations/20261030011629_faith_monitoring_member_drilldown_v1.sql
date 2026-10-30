-- Leadership-only, per-member Faith Monitoring drill-down.
-- Keep the canonical summary v3 untouched; this is an additive, read-only RPC.
-- This RPC returns participation/status metadata only, never private reflections.

create or replace function public.buklod_scope_faith_monitoring_members_v1(p_scope_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_today date := (timezone('Asia/Manila', now()))::date;
  v_week_start date := v_today - 6;
  v_scope_type text;
  v_scope_name text;
  v_devotional_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null or p_scope_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select s.scope_type, s.name
    into v_scope_type, v_scope_name
  from public.buklod_scopes s
  where s.id = p_scope_id
    and s.scope_type in ('CLUSTER', 'ORGANIZATION')
    and s.status not in ('SUSPENDED', 'DELETED');

  if v_scope_type is null then
    raise exception 'Faith Monitoring workspace not found';
  end if;

  -- Match the existing protected v1/v2/v3 report guard. The client is not a
  -- security boundary: UUID guessing must not reveal any member roster.
  if not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id, auth.uid())
    or (
      v_scope_type = 'CLUSTER'
      and (
        exists (
          select 1
          from public.buklod_scope_role_assignments ra
          where ra.scope_id = p_scope_id
            and ra.user_id = auth.uid()
            and ra.status = 'ACTIVE'
            and upper(ra.role_key) in ('ADMIN', 'CLUSTER_ADMIN', 'CLUSTER_HEAD', 'PASTOR', 'MENTOR')
        )
        or public.buklod_user_has_functional_approver_role(p_scope_id, auth.uid())
      )
    )
  ) then
    raise exception 'Not authorized to view this scope report' using errcode = '42501';
  end if;

  -- Use the same current devotion ID as the summary card. The existing
  -- canonical reporting functions are left unchanged for compatibility.
  select nullif(
    public.buklod_scope_faith_monitoring_summary_v3(p_scope_id)->'devotion'->>'devotional_id',
    ''
  )::uuid into v_devotional_id;

  with scope_members as (
    select distinct m.user_id
    from public.buklod_scope_memberships m
    where m.membership_status = 'ACTIVE'
      and (
        m.scope_id = p_scope_id
        or (
          v_scope_type = 'ORGANIZATION'
          and exists (
            select 1 from public.buklod_scopes child
            where child.id = m.scope_id
              and child.scope_type = 'CLUSTER'
              and child.status not in ('SUSPENDED', 'DELETED')
              and coalesce(child.organization_id, child.parent_scope_id) = p_scope_id
          )
        )
      )
  ),
  named_members as (
    select sm.user_id,
           coalesce(nullif(btrim(p.full_name), ''),
                    nullif(btrim(concat_ws(' ', p.first_name, p.surname)), ''),
                    'Member') as member_name
    from scope_members sm
    left join public.profiles p on p.id = sm.user_id
  ),
  reading_submissions as (
    select s.user_id, s.assignment_id, s.submitted_at,
           coalesce(a.status,
             case s.status
               when 'approved' then 'APPROVED'
               when 'rejected' then 'REJECTED'
               else 'PENDING'
             end
           ) as effective_status
    from public.daily_bible_submissions s
    join scope_members sm on sm.user_id = s.user_id
    left join lateral (
      select x.status
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id = s.cluster_id
        and x.learner_id = s.user_id
        and x.item_kind = 'DAILY_READING'
        and x.item_id = s.id
      order by x.created_at desc
      limit 1
    ) a on true
    where (s.submitted_at at time zone 'Asia/Manila')::date between v_week_start and v_today
      and (
        (v_scope_type = 'CLUSTER' and s.cluster_id = p_scope_id)
        or (v_scope_type = 'ORGANIZATION' and exists (
          select 1 from public.buklod_scopes child
          where child.id = s.cluster_id
            and child.scope_type = 'CLUSTER'
            and child.status not in ('SUSPENDED', 'DELETED')
            and coalesce(child.organization_id, child.parent_scope_id) = p_scope_id
        ))
      )
  ),
  reading_rollup as (
    select s.user_id,
           bool_or((s.submitted_at at time zone 'Asia/Manila')::date = v_today) as submitted,
           bool_or(s.effective_status = 'APPROVED'
                   and (s.submitted_at at time zone 'Asia/Manila')::date = v_today) as approved,
           bool_or(s.effective_status in ('EVALUATING', 'PENDING')
                   and (s.submitted_at at time zone 'Asia/Manila')::date = v_today) as checking,
           bool_or(s.effective_status = 'REJECTED'
                   and (s.submitted_at at time zone 'Asia/Manila')::date = v_today) as revision,
           bool_or(s.effective_status = 'APPROVED') as weekly,
           max(s.submitted_at) filter (
             where (s.submitted_at at time zone 'Asia/Manila')::date = v_today
           ) as latest_at,
           (array_agg(s.assignment_id order by s.submitted_at desc) filter (
             where (s.submitted_at at time zone 'Asia/Manila')::date = v_today
           ))[1] as latest_assignment_id
    from reading_submissions s
    group by s.user_id
  ),
  devotion_submissions as (
    select s.user_id, s.submitted_at,
           coalesce(a.status,
             case s.status
               when 'approved' then 'APPROVED'
               when 'rejected' then 'REJECTED'
               else 'PENDING'
             end
           ) as effective_status
    from public.devotional_reward_submissions s
    join scope_members sm on sm.user_id = s.user_id
    left join lateral (
      select x.status
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id = p_scope_id
        and x.learner_id = s.user_id
        and x.item_kind = 'DAILY_DEVOTION'
        and x.item_id = s.id
      order by x.created_at desc
      limit 1
    ) a on true
    where v_devotional_id is not null
      and s.devotional_id = v_devotional_id
  ),
  devotion_rollup as (
    select s.user_id,
           true as submitted,
           bool_or(s.effective_status = 'APPROVED') as approved,
           bool_or(s.effective_status in ('EVALUATING', 'PENDING')) as checking,
           bool_or(s.effective_status = 'REJECTED') as revision,
           max(s.submitted_at) as latest_at
    from devotion_submissions s
    group by s.user_id
  ),
  devotion_week as (
    select distinct s.user_id
    from public.devotional_reward_submissions s
    join public.devotional_completions dc on dc.id = s.completion_id
    join scope_members sm on sm.user_id = s.user_id
    where dc.completion_date between v_week_start and v_today
  ),
  exact_approved as (
    select a.learner_id as user_id, lp.lesson_id, btrim(t.stage_code)::integer as stage_code
    from public.buklod_scope_formation_approvals_v2 a
    join scope_members sm on sm.user_id = a.learner_id
    join public.lesson_progress lp on lp.id = a.item_id
    join public.learning_lessons l on l.id = lp.lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where a.scope_id = p_scope_id
      and a.item_kind = 'LESSON'
      and a.status = 'APPROVED'
      and t.stage_code is not null
      and btrim(t.stage_code) ~ '^[0-9]+$'
  ),
  legacy_approved as (
    select sm.user_id, a.lesson_id, btrim(t.stage_code)::integer as stage_code
    from scope_members sm
    join public.member_lesson_attempts a on a.user_id = sm.user_id and a.review_status = 'approved'
    join public.learning_lessons l on l.id = a.lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where t.stage_code is not null
      and btrim(t.stage_code) ~ '^[0-9]+$'
      and not exists (
        select 1
        from public.buklod_scope_formation_approvals_v2 x
        join public.lesson_progress xlp on xlp.id = x.item_id
        where x.learner_id = sm.user_id
          and x.item_kind = 'LESSON'
          and xlp.lesson_id = a.lesson_id
      )
  ),
  approved_lessons as (
    select x.user_id, x.stage_code, count(distinct x.lesson_id)::integer as count
    from (select * from exact_approved union select * from legacy_approved) x
    group by x.user_id, x.stage_code
  ),
  expected_lessons as (
    select c.stage_code::integer as stage_code,
           sum(c.expected_lesson_count)::integer as count
    from public.buklod_curriculum_components c
    where c.expected_lesson_count is not null
    group by c.stage_code::integer
  ),
  required_records as (
    select r.stage_code::integer as stage_code, count(*)::integer as count
    from public.buklod_stage_requirements r
    where r.is_active = true and r.required_for_stage_completion = true
    group by r.stage_code::integer
  ),
  verified_records as (
    select sm.user_id, r.stage_code::integer as stage_code,
           count(distinct r.requirement_code)::integer as count
    from scope_members sm
    join public.member_stage_requirement_records mr
      on mr.user_id = sm.user_id and mr.status = 'verified'
    join public.buklod_stage_requirements r
      on r.requirement_code = mr.requirement_code
      and r.is_active = true and r.required_for_stage_completion = true
    group by sm.user_id, r.stage_code::integer
  ),
  started_stages as (
    -- Canonical v3 dashboard activity is based on starting a lesson, even if
    -- none have been approved yet. Keep member detail counts in sync.
    select distinct lp.user_id, btrim(t.stage_code)::integer as stage_code
    from public.lesson_progress lp
    join scope_members sm on sm.user_id = lp.user_id
    join public.learning_lessons l on l.id = lp.lesson_id
    join public.learning_tracks t on t.id = l.track_id
    where lp.started_at is not null
      and btrim(t.stage_code) in ('101', '102', '103', '104', '105', '106', '107')
  ),
  lesson_rollup as (
    select sm.user_id,
           bool_or(started.user_id is not null) as has_activity,
           jsonb_agg(jsonb_build_object(
             'stage_code', s.stage_code,
             'stage_title', s.title_fil,
             'status', case
               when s.is_completable = true
                 and coalesce(e.count, 0) > 0
                 and coalesce(al.count, 0) >= coalesce(e.count, 0)
                 and coalesce(v.count, 0) >= coalesce(r.count, 0)
                 then 'COMPLETED'
               when started.user_id is not null then 'IN_PROGRESS'
               else 'NOT_STARTED'
             end,
             'approved_lessons', coalesce(al.count, 0),
             'expected_lessons', coalesce(e.count, 0),
             'verified_requirements', coalesce(v.count, 0),
             'required_requirements', coalesce(r.count, 0)
           ) order by s.stage_order) as stages
    from scope_members sm
    cross join public.buklod_stages s
    left join started_stages started on started.user_id = sm.user_id and started.stage_code = s.stage_code
    left join approved_lessons al on al.user_id = sm.user_id and al.stage_code = s.stage_code
    left join expected_lessons e on e.stage_code = s.stage_code
    left join required_records r on r.stage_code = s.stage_code
    left join verified_records v on v.user_id = sm.user_id and v.stage_code = s.stage_code
    where s.is_active = true and s.stage_code between 101 and 107
    group by sm.user_id
  )
  select jsonb_build_object(
    'scope_id', p_scope_id,
    'scope_name', v_scope_name,
    'report_date', v_today,
    'members', coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id,
      'member_name', m.member_name,
      'reading', jsonb_build_object(
        'submitted', coalesce(rd.submitted, false),
        'approved', coalesce(rd.approved, false),
        'checking', coalesce(rd.checking, false),
        'revision', coalesce(rd.revision, false),
        'weekly', coalesce(rd.weekly, false),
        'latest_at', rd.latest_at,
        'latest_reference', a.bible_reference
      ),
      'devotion', jsonb_build_object(
        'submitted', coalesce(dv.submitted, false),
        'approved', coalesce(dv.submitted, false),
        'checking', coalesce(dv.checking, false),
        'revision', coalesce(dv.revision, false),
        'weekly', dw.user_id is not null,
        'latest_at', dv.latest_at,
        'latest_reference', null
      ),
      'lesson', jsonb_build_object(
        'has_activity', coalesce(ls.has_activity, false),
        'stages', coalesce(ls.stages, '[]'::jsonb)
      )
    ) order by m.member_name, m.user_id), '[]'::jsonb)
  ) into v_result
  from named_members m
  left join reading_rollup rd on rd.user_id = m.user_id
  left join public.daily_bible_assignments a on a.id = rd.latest_assignment_id
  left join devotion_rollup dv on dv.user_id = m.user_id
  left join devotion_week dw on dw.user_id = m.user_id
  left join lesson_rollup ls on ls.user_id = m.user_id;

  return v_result;
end;
$function$;

revoke all on function public.buklod_scope_faith_monitoring_members_v1(uuid) from public, anon;
grant execute on function public.buklod_scope_faith_monitoring_members_v1(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
