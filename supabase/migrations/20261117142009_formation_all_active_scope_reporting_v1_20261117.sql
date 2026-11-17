-- BUKLOD formation reporting: one canonical outcome, all active member scopes.
-- READ-ONLY fan-out. No point ledger writes and no duplicate approval enqueueing.
-- Existing exact-scope report authorization stays inside each reporting RPC.
create or replace function public.buklod_formation_reports_member_v1(
  p_scope_id uuid,p_user_id uuid
) returns boolean language sql stable security definer set search_path to ''
as $fn$
  select p_scope_id is not null and p_user_id is not null and exists (
    select 1 from public.buklod_scopes target
    join public.buklod_scope_memberships m on m.user_id=p_user_id and m.membership_status='ACTIVE'
    join public.buklod_scopes member_scope on member_scope.id=m.scope_id
      and member_scope.status not in ('SUSPENDED','DELETED')
    where target.id=p_scope_id and target.scope_type in ('CLUSTER','ORGANIZATION')
      and target.status not in ('SUSPENDED','DELETED')
      and (
        m.scope_id=target.id
        or (
          target.scope_type='ORGANIZATION'
          and member_scope.scope_type='CLUSTER'
          and coalesce(member_scope.organization_id,member_scope.parent_scope_id)=target.id
        )
      )
  );
$fn$;
revoke all on function public.buklod_formation_reports_member_v1(uuid,uuid) from public,anon,authenticated;

-- Source/processing scope is not report ownership: use an active Cluster anchor
-- when multiple valid memberships exist, preferring the most recent approved
-- reading's Cluster to preserve the member's existing continuity.
create or replace function public.buklod_resolve_auto_submission_scope_v1(
  p_feature_key text,p_user_id uuid
) returns uuid language plpgsql stable security definer set search_path to ''
as $fn$
declare
  v_feature text := upper(trim(coalesce(p_feature_key,'')));
  v_scope uuid;
begin
  if p_user_id is null then return null; end if;
  if auth.uid()=p_user_id and v_feature in ('DAILY_READING','DAILY_DEVOTION','LESSON') then
    v_scope:=public.buklod_get_formation_entry_scope_v1(v_feature);
    if v_scope is not null
       and public.buklod_user_is_active_scope_member(v_scope,p_user_id)
       and exists (
         select 1 from public.buklod_scopes s
         where s.id=v_scope and s.status not in ('SUSPENDED','DELETED')
           and (
             (v_feature='LESSON' and s.scope_type in ('CLUSTER','ORGANIZATION'))
             or (v_feature in ('DAILY_READING','DAILY_DEVOTION') and s.scope_type='CLUSTER')
           )
       )
    then return v_scope; end if;
  end if;
  if v_feature in ('DAILY_READING','DAILY_DEVOTION','LESSON') then
    select s.id into v_scope
    from public.buklod_scope_memberships m
    join public.buklod_scopes s on s.id=m.scope_id
    where m.user_id=p_user_id and m.membership_status='ACTIVE'
      and s.scope_type='CLUSTER' and s.status not in ('SUSPENDED','DELETED')
    order by
      case when s.id=(
        select d.cluster_id from public.daily_bible_submissions d
        where d.user_id=p_user_id and d.status='approved' and d.cluster_id is not null
        order by d.submitted_at desc nulls last limit 1
      ) then 0 else 1 end,
      m.joined_at asc nulls last,s.id
    limit 1;
    return v_scope;
  end if;
  return null;
end;
$fn$;
-- Preserve existing RPC EXECUTE ACLs; CREATE OR REPLACE does not reset grants.

-- Updated buklod_scope_formation_submission_history_v1 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_scope_formation_submission_history_v1(p_scope_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(approval_id uuid, scope_id uuid, scope_name text, item_kind text, item_id uuid, learner_id uuid, learner_name text, title text, subtitle text, submitted_at timestamp with time zone, decided_at timestamp with time zone, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_scope_type text;
  v_limit integer :=
    least(
      greatest(
        coalesce(p_limit,100),
        1
      ),
      250
    );
begin
  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;

  select s.scope_type
  into v_scope_type
  from public.buklod_scopes s
  where s.id = p_scope_id
    and coalesce(
      s.status::text,
      'ACTIVE'
    ) <> 'DELETED';

  if v_scope_type is null then
    raise exception 'Scope not found';
  end if;

  if v_scope_type = 'CLUSTER' then
    if not
      public.buklod_can_view_cluster_progress_v1(
        p_scope_id,
        auth.uid()
      )
    then
      raise exception
        'Cluster report access required';
    end if;
  else
    if not (
      public.buklod_is_exact_scope_admin_v1(
        p_scope_id
      )
      or public.buklod_is_system_admin()
    ) then
      raise exception
        'Scope report access required';
    end if;
  end if;

  return query
  select
    a.id,
    a.scope_id,
    s.name::text,
    a.item_kind,
    a.item_id,
    a.learner_id,
    coalesce(
      p.full_name,
      p.username,
      'BUKLOD Member'
    )::text,
    (
      case
        when a.item_kind = 'DAILY_READING'
          then coalesce(
            dba.bible_reference,
            'Daily Reading'
          )
        when a.item_kind = 'DAILY_DEVOTION'
          then coalesce(
            d.title,
            'Daily Devotion'
          )
        when a.item_kind = 'LESSON'
          then coalesce(
            ll.title,
            'BUKLOD Lesson'
          )
        else a.item_kind
      end
    )::text,
    (
      case
        when a.item_kind = 'DAILY_READING'
          then coalesce(
            dba.reading_date::text,
            ''
          )
        when a.item_kind = 'DAILY_DEVOTION'
          then coalesce(
            d.bible_passage,
            ''
          )
        when a.item_kind = 'LESSON'
          then coalesce(
            lt.title,
            ''
          )
        else ''
      end
    )::text,
    a.created_at,
    a.decided_at,
    a.status
  from public.buklod_scope_formation_approvals_v2 a

  join public.buklod_scopes s
    on s.id = a.scope_id

  left join public.profiles p
    on p.id = a.learner_id

  left join public.daily_bible_submissions dbs
    on a.item_kind = 'DAILY_READING'
   and dbs.id = a.item_id

  left join public.daily_bible_assignments dba
    on dba.id = dbs.assignment_id

  left join public.devotional_reward_submissions drs
    on a.item_kind = 'DAILY_DEVOTION'
   and drs.id = a.item_id

  left join public.devotionals d
    on d.id = drs.devotional_id

  left join public.lesson_progress lp
    on a.item_kind = 'LESSON'
   and lp.id = a.item_id

  left join public.learning_lessons ll
    on ll.id = lp.lesson_id

  left join public.learning_tracks lt
    on lt.id = ll.track_id

  where public.buklod_formation_reports_member_v1(p_scope_id,a.learner_id)
  order by a.created_at desc
  limit v_limit;
end;
$function$;


-- Updated buklod_scope_faith_monitoring_summary_v2 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_scope_faith_monitoring_summary_v2(p_scope_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
          where public.buklod_formation_reports_member_v1(p_scope_id,x.learner_id)
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
          where public.buklod_formation_reports_member_v1(p_scope_id,x.learner_id)
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
          where public.buklod_formation_reports_member_v1(p_scope_id,x.learner_id)
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
        where public.buklod_formation_reports_member_v1(p_scope_id,x.learner_id)
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
          where public.buklod_formation_reports_member_v1(p_scope_id,x.learner_id)
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
        where public.buklod_formation_reports_member_v1(p_scope_id,x.learner_id)
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
    where public.buklod_formation_reports_member_v1(p_scope_id,a.learner_id)
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


-- Updated buklod_scope_faith_monitoring_summary_v3 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_scope_faith_monitoring_summary_v3(p_scope_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_started_members int := 0;
  v_started_stage_rows jsonb := '[]'::jsonb;
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
        (v_scope_type='CLUSTER' and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
        or
        (v_scope_type='ORGANIZATION' and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
        or
        (v_scope_type not in ('CLUSTER','ORGANIZATION') and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
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
      (v_scope_type='CLUSTER' and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
      or
      (v_scope_type='ORGANIZATION' and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
      or
      (v_scope_type not in ('CLUSTER','ORGANIZATION') and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
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
      (v_scope_type='CLUSTER' and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
      or
      (v_scope_type='ORGANIZATION' and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
      or
      (v_scope_type not in ('CLUSTER','ORGANIZATION') and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id))
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
  where public.buklod_formation_reports_member_v1(p_scope_id,a.learner_id) and a.item_kind='LESSON';

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

  select count(distinct lp.user_id)::int
  into v_started_members
  from public.buklod_scope_memberships m
  join public.lesson_progress lp
    on lp.user_id=m.user_id
   and lp.started_at is not null
  join public.learning_lessons l on l.id=lp.lesson_id
  join public.learning_tracks t on t.id=l.track_id
  where m.scope_id=p_scope_id
    and m.membership_status='ACTIVE'
    and trim(t.stage_code) in ('101','102','103','104','105','106','107');

  with stage_started as (
    select
      trim(t.stage_code)::integer as stage_code,
      count(distinct lp.user_id)::int as started_members
    from public.buklod_scope_memberships m
    join public.lesson_progress lp
      on lp.user_id=m.user_id
     and lp.started_at is not null
    join public.learning_lessons l on l.id=lp.lesson_id
    join public.learning_tracks t on t.id=l.track_id
    where m.scope_id=p_scope_id
      and m.membership_status='ACTIVE'
      and trim(t.stage_code) in ('101','102','103','104','105','106','107')
    group by trim(t.stage_code)::integer
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stage_code',(r->>'stage_code')::integer,
        'stage_title',r->>'stage_title',
        'completed_count',coalesce((r->>'completed_count')::integer,0),
        'in_progress_count',greatest(
          coalesce(s.started_members,0)
          - coalesce((r->>'completed_count')::integer,0),
          0
        )
      )
      order by (r->>'stage_code')::integer
    ),
    '[]'::jsonb
  )
  into v_started_stage_rows
  from jsonb_array_elements(
    coalesce(v_base->'buklod_lesson'->'stages','[]'::jsonb)
  ) r
  left join stage_started s
    on s.stage_code=(r->>'stage_code')::integer;

  v_base := jsonb_set(
    v_base,
    '{buklod_lesson}',
    coalesce(v_base->'buklod_lesson','{}'::jsonb)
    || jsonb_build_object(
      'members_active',coalesce(v_started_members,0),
      'members_not_started',greatest(
        coalesce((v_base->>'active_members')::int,0)
        - coalesce(v_started_members,0),
        0
      ),
      'stages',coalesce(v_started_stage_rows,'[]'::jsonb)
    ),
    true
  );
  return v_base;
end;
$function$;


-- Updated buklod_scope_faith_monitoring_members_v1 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_scope_faith_monitoring_members_v1(p_scope_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id)
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
    where public.buklod_formation_reports_member_v1(p_scope_id,a.learner_id)
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


-- Updated buklod_scope_faith_monitoring_metric_details_v1 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_scope_faith_monitoring_metric_details_v1(p_scope_id uuid, p_metric text)
 RETURNS TABLE(user_id uuid, member_name text, avatar_url text, status text, item_kind text, item_id uuid, title text, submitted_at timestamp with time zone, why text, automatic_feedback text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_metric text := upper(trim(coalesce(p_metric,'')));
  v_today date := (timezone('Asia/Manila',now()))::date;
  v_scope_type text;
  v_devotional_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.scope_type
  into v_scope_type
  from public.buklod_scopes s
  where s.id=p_scope_id
    and s.status not in ('SUSPENDED','DELETED');

  if v_scope_type is null then
    raise exception 'Scope not found';
  end if;

  if v_scope_type='CLUSTER' then
    if not public.buklod_can_view_cluster_progress_v1(
      p_scope_id,
      auth.uid()
    ) then
      raise exception 'Cluster report access required';
    end if;
  elsif not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id)
    or public.buklod_is_system_admin()
  ) then
    raise exception 'Scope report access required';
  end if;

  select nullif(
    public.buklod_scope_faith_monitoring_summary_v3(p_scope_id)
      ->'devotion'->>'devotional_id',
    ''
  )::uuid
  into v_devotional_id;

  if v_metric like 'DAILY_READING_%' then
    if v_metric='DAILY_READING_NOT_SUBMITTED' then
      return query
      select
        m.user_id,
        coalesce(p.full_name,p.username,'BUKLOD Member')::text,
        p.avatar_url,
        'NOT_SUBMITTED'::text,
        'DAILY_READING'::text,
        null::uuid,
        'Daily Reading'::text,
        null::timestamptz,
        'No Daily Reading submission recorded today.'::text,
        'Submit today''s Daily Reading to complete this item.'::text
      from public.buklod_scope_memberships m
      left join public.profiles p on p.id=m.user_id
      where m.scope_id=p_scope_id
        and m.membership_status='ACTIVE'
        and not exists (
          select 1
          from public.daily_bible_submissions s
          where s.user_id=m.user_id
            and public.buklod_formation_reports_member_v1(p_scope_id,s.user_id)
            and (s.submitted_at at time zone 'Asia/Manila')::date=v_today
        )
      order by coalesce(p.full_name,p.username,m.user_id::text);
      return;
    end if;

    return query
    select
      s.user_id,
      coalesce(p.full_name,p.username,'BUKLOD Member')::text,
      p.avatar_url,
      coalesce(
        a.status,
        case s.status
          when 'approved' then 'APPROVED'
          when 'rejected' then 'REJECTED'
          else 'PENDING'
        end
      )::text,
      'DAILY_READING'::text,
      s.id,
      coalesce(dba.bible_reference,'Daily Reading')::text,
      s.submitted_at,
      coalesce(
        nullif(trim(a.remarks),''),
        nullif(trim(s.admin_note),''),
        case
          when coalesce(a.status,'')='REJECTED' or s.status='rejected'
            then 'Automatic checking found an item that needs revision.'
          when coalesce(a.status,'')='APPROVED' or s.status='approved'
            then 'Passed BUKLOD automatic source-grounded validation.'
          else 'Automatic checking is still in progress.'
        end
      )::text,
      coalesce(
        nullif(trim(a.remarks),''),
        nullif(trim(s.admin_note),''),
        case
          when coalesce(a.status,'')='REJECTED' or s.status='rejected'
            then 'Review the flagged answer and submit again.'
          when coalesce(a.status,'')='APPROVED' or s.status='approved'
            then 'No revision needed.'
          else 'Please wait for automatic checking to finish.'
        end
      )::text
    from public.daily_bible_submissions s
    left join public.profiles p on p.id=s.user_id
    left join public.daily_bible_assignments dba on dba.id=s.assignment_id
    left join lateral (
      select x.status,x.remarks
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id=s.cluster_id
        and x.learner_id=s.user_id
        and x.item_kind='DAILY_READING'
        and x.item_id=s.id
      order by x.created_at desc
      limit 1
    ) a on true
    where public.buklod_formation_reports_member_v1(p_scope_id,s.user_id)
      and (s.submitted_at at time zone 'Asia/Manila')::date=v_today
      and (
        v_metric='DAILY_READING_SUBMITTED_TODAY'
        or (
          v_metric='DAILY_READING_APPROVED_TODAY'
          and coalesce(
            a.status,
            case s.status when 'approved' then 'APPROVED' when 'rejected' then 'REJECTED' else 'PENDING' end
          )='APPROVED'
        )
        or (
          v_metric='DAILY_READING_CHECKING'
          and coalesce(
            a.status,
            case s.status when 'approved' then 'APPROVED' when 'rejected' then 'REJECTED' else 'PENDING' end
          ) in ('EVALUATING','PENDING')
        )
        or (
          v_metric='DAILY_READING_NEEDS_REVISION'
          and coalesce(
            a.status,
            case s.status when 'approved' then 'APPROVED' when 'rejected' then 'REJECTED' else 'PENDING' end
          )='REJECTED'
        )
      )
    order by s.submitted_at desc;
    return;
  end if;

  if v_metric like 'DEVOTION_%' then
    if v_metric='DEVOTION_NOT_COMPLETED' then
      return query
      select
        m.user_id,
        coalesce(p.full_name,p.username,'BUKLOD Member')::text,
        p.avatar_url,
        'NOT_COMPLETED'::text,
        'DAILY_DEVOTION'::text,
        null::uuid,
        'Daily Devotion'::text,
        null::timestamptz,
        'No completion recorded for the current Daily Devotion.'::text,
        'Complete today''s Devotion and reflection.'::text
      from public.buklod_scope_memberships m
      left join public.profiles p on p.id=m.user_id
      where m.scope_id=p_scope_id
        and m.membership_status='ACTIVE'
        and not exists (
          select 1
          from public.devotional_reward_submissions s
          where s.user_id=m.user_id
            and s.devotional_id=v_devotional_id
        )
      order by coalesce(p.full_name,p.username,m.user_id::text);
      return;
    end if;

    return query
    select
      s.user_id,
      coalesce(p.full_name,p.username,'BUKLOD Member')::text,
      p.avatar_url,
      coalesce(
        a.status,
        case s.status
          when 'approved' then 'APPROVED'
          when 'rejected' then 'REJECTED'
          else 'PENDING'
        end
      )::text,
      'DAILY_DEVOTION'::text,
      s.id,
      coalesce(s.devotional_title_snapshot,'Daily Devotion')::text,
      s.submitted_at,
      coalesce(
        nullif(trim(a.remarks),''),
        nullif(trim(s.admin_note),''),
        case
          when coalesce(a.status,'')='REJECTED' or s.status='rejected'
            then 'Automatic checking found an item that needs revision.'
          when coalesce(a.status,'')='APPROVED' or s.status='approved'
            then 'Passed BUKLOD automatic source-grounded validation.'
          else 'Automatic checking is still in progress.'
        end
      )::text,
      coalesce(
        nullif(trim(a.remarks),''),
        nullif(trim(s.admin_note),''),
        case
          when coalesce(a.status,'')='REJECTED' or s.status='rejected'
            then 'Review the automatic feedback and submit again.'
          when coalesce(a.status,'')='APPROVED' or s.status='approved'
            then 'No revision needed.'
          else 'Please wait for automatic checking to finish.'
        end
      )::text
    from public.devotional_reward_submissions s
    join public.buklod_scope_memberships m
      on m.user_id=s.user_id
     and m.scope_id=p_scope_id
     and m.membership_status='ACTIVE'
    left join public.profiles p on p.id=s.user_id
    left join lateral (
      select x.status,x.remarks
      from public.buklod_scope_formation_approvals_v2 x
      where x.scope_id=p_scope_id
        and x.learner_id=s.user_id
        and x.item_kind='DAILY_DEVOTION'
        and x.item_id=s.id
      order by x.created_at desc
      limit 1
    ) a on true
    where s.devotional_id=v_devotional_id
      and (
        v_metric='DEVOTION_SUBMITTED_TODAY'
        or (
          v_metric='DEVOTION_APPROVED_TODAY'
          and (coalesce(a.status,'')='APPROVED' or (a.status is null and s.status='approved'))
        )
        or (
          v_metric='DEVOTION_CHECKING'
          and coalesce(a.status,'') in ('EVALUATING','PENDING')
        )
        or (
          v_metric='DEVOTION_NEEDS_REVISION'
          and (coalesce(a.status,'')='REJECTED' or s.status='rejected')
        )
      )
    order by s.submitted_at desc;
    return;
  end if;

  if v_metric like 'LESSON_%' then
    if v_metric='LESSON_NOT_STARTED' then
      return query
      select
        m.user_id,
        coalesce(p.full_name,p.username,'BUKLOD Member')::text,
        p.avatar_url,
        'NOT_STARTED'::text,
        'LESSON'::text,
        null::uuid,
        'BUKLOD Lesson'::text,
        null::timestamptz,
        'No BUKLOD Lesson activity recorded yet.'::text,
        'Open the current BUKLOD Lesson to begin.'::text
      from public.buklod_scope_memberships m
      left join public.profiles p on p.id=m.user_id
      where m.scope_id=p_scope_id
        and m.membership_status='ACTIVE'
        and not exists (
          select 1
          from public.lesson_progress lp
          join public.learning_lessons l on l.id=lp.lesson_id
          join public.learning_tracks t on t.id=l.track_id
          where lp.user_id=m.user_id
            and lp.started_at is not null
            and trim(t.stage_code) in ('101','102','103','104','105','106','107')
        )
      order by coalesce(p.full_name,p.username,m.user_id::text);
      return;
    end if;

    if v_metric='LESSON_ACTIVITY' then
      return query
      select distinct on (lp.user_id)
        lp.user_id,
        coalesce(p.full_name,p.username,'BUKLOD Member')::text,
        p.avatar_url,
        case
          when lp.completed_at is not null then 'COMPLETED'
          when lp.submitted_for_validation_at is not null then 'SUBMITTED'
          else 'IN_PROGRESS'
        end::text,
        'LESSON'::text,
        lp.id,
        coalesce(l.title,'BUKLOD Lesson')::text,
        lp.started_at,
        case
          when lp.completed_at is not null then 'Lesson completed.'
          when lp.submitted_for_validation_at is not null then 'Lesson submitted for automatic validation.'
          else 'Lesson has been started but not completed yet.'
        end::text,
        case
          when lp.completed_at is not null then 'No revision needed.'
          when lp.submitted_for_validation_at is not null then 'Automatic validation is processing this lesson.'
          else 'Continue the lesson and complete the required responses.'
        end::text
      from public.lesson_progress lp
      join public.buklod_scope_memberships m
        on m.user_id=lp.user_id
       and m.scope_id=p_scope_id
       and m.membership_status='ACTIVE'
      left join public.profiles p on p.id=lp.user_id
      join public.learning_lessons l on l.id=lp.lesson_id
      join public.learning_tracks t on t.id=l.track_id
      where lp.started_at is not null
        and trim(t.stage_code) in ('101','102','103','104','105','106','107')
      order by lp.user_id,coalesce(lp.updated_at,lp.started_at) desc;
      return;
    end if;

    return query
    select
      a.learner_id,
      coalesce(p.full_name,p.username,'BUKLOD Member')::text,
      p.avatar_url,
      a.status::text,
      'LESSON'::text,
      a.item_id,
      coalesce(l.title,'BUKLOD Lesson')::text,
      a.created_at,
      coalesce(
        nullif(trim(a.remarks),''),
        case
          when a.status='REJECTED' then 'Automatic checking found an item that needs revision.'
          when a.status='APPROVED' then 'Passed BUKLOD automatic validation.'
          else 'Automatic checking is still in progress.'
        end
      )::text,
      coalesce(
        nullif(trim(a.remarks),''),
        case
          when a.status='REJECTED' then 'Review the flagged answer or reflection and submit again.'
          when a.status='APPROVED' then 'No revision needed.'
          else 'Please wait for automatic checking to finish.'
        end
      )::text
    from public.buklod_scope_formation_approvals_v2 a
    left join public.profiles p on p.id=a.learner_id
    left join public.lesson_progress lp on lp.id=a.item_id
    left join public.learning_lessons l on l.id=lp.lesson_id
    where public.buklod_formation_reports_member_v1(p_scope_id,a.learner_id)
      and a.item_kind='LESSON'
      and (
        (
          v_metric='LESSON_SUBMITTED_TODAY'
          and (a.created_at at time zone 'Asia/Manila')::date=v_today
        )
        or (
          v_metric='LESSON_APPROVED_TODAY'
          and a.status='APPROVED'
          and (coalesce(a.decided_at,a.updated_at) at time zone 'Asia/Manila')::date=v_today
        )
        or (
          v_metric='LESSON_CHECKING'
          and a.status in ('EVALUATING','PENDING')
        )
        or (
          v_metric='LESSON_NEEDS_REVISION'
          and a.status='REJECTED'
        )
      )
    order by a.created_at desc;
    return;
  end if;

  raise exception 'Unsupported report metric';
end;
$function$;


-- Updated buklod_scope_faith_monitoring_period_v1 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_scope_faith_monitoring_period_v1(p_scope_id uuid, p_period text, p_anchor_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    left join lateral (
      select f0.status
      from public.buklod_scope_formation_approvals_v2 f0
      where f0.learner_id = s.user_id
        and f0.item_kind = 'DAILY_DEVOTION' and f0.item_id = s.id
      order by case f0.status when 'APPROVED' then 0 when 'REJECTED' then 1 else 2 end,
               f0.created_at desc
      limit 1
    ) f on true
    
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


-- Updated buklod_capture_lesson_scope_approval_v2 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.buklod_capture_lesson_scope_approval_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_scope uuid;
begin
  if new.submitted_for_validation_at is not null
     and (
       tg_op = 'INSERT'
       or old.submitted_for_validation_at is distinct from new.submitted_for_validation_at
     ) then
    v_scope := coalesce(public.buklod_get_formation_entry_scope_v1('LESSON'),public.buklod_resolve_auto_submission_scope_v1('LESSON',new.user_id));
    if v_scope is not null then
      perform public.buklod_enqueue_scope_formation_approval_v2(
        v_scope, new.user_id, 'LESSON', new.id
      );
    end if;
  end if;
  return new;
end;
$function$;


-- Updated submit_my_formation_lesson_for_validation_v2 (report-only attribution except lesson fallback)
CREATE OR REPLACE FUNCTION public.submit_my_formation_lesson_for_validation_v2(p_enrollment_id uuid, p_lesson_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  v_scope := coalesce(public.buklod_get_formation_entry_scope_v1('LESSON'),public.buklod_resolve_auto_submission_scope_v1('LESSON',v_user));

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
    v_auto_result := public.buklod_try_auto_approve_lesson_v2(v_approval_id);

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
