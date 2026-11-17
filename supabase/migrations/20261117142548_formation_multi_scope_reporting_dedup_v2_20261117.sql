-- Reporting projection v2: a canonical Formation activity is displayed once per
-- authorized report, even when multiple historical per-scope approval rows exist.
-- Keep all original approvals/audit records intact; do not change rewards/points.

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
  from (
    select distinct on (ra.learner_id,ra.item_kind,ra.item_id) ra.*
    from public.buklod_scope_formation_approvals_v2 ra
    where public.buklod_formation_reports_member_v1(p_scope_id,ra.learner_id)
    order by ra.learner_id,ra.item_kind,ra.item_id,
      case ra.status
        when 'APPROVED' then 0
        when 'EVALUATING' then 1
        when 'PENDING' then 2
        when 'REJECTED' then 3
        else 4
      end,coalesce(ra.decided_at,ra.updated_at,ra.created_at) desc,ra.id
  ) a

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
  from (
    select distinct on (ra.learner_id,ra.item_kind,ra.item_id) ra.*
    from public.buklod_scope_formation_approvals_v2 ra
    where ra.item_kind='LESSON' and public.buklod_formation_reports_member_v1(p_scope_id,ra.learner_id)
    order by ra.learner_id,ra.item_kind,ra.item_id,
      case ra.status
        when 'APPROVED' then 0
        when 'EVALUATING' then 1
        when 'PENDING' then 2
        when 'REJECTED' then 3
        else 4
      end,coalesce(ra.decided_at,ra.updated_at,ra.created_at) desc,ra.id
  ) a;

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
    from (
    select distinct on (ra.learner_id,ra.item_kind,ra.item_id) ra.*
    from public.buklod_scope_formation_approvals_v2 ra
    where ra.item_kind='LESSON' and public.buklod_formation_reports_member_v1(p_scope_id,ra.learner_id)
    order by ra.learner_id,ra.item_kind,ra.item_id,
      case ra.status
        when 'APPROVED' then 0
        when 'EVALUATING' then 1
        when 'PENDING' then 2
        when 'REJECTED' then 3
        else 4
      end,coalesce(ra.decided_at,ra.updated_at,ra.created_at) desc,ra.id
  ) a
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
    from (
    select distinct on (ra.learner_id,ra.item_kind,ra.item_id) ra.*
    from public.buklod_scope_formation_approvals_v2 ra
    where ra.item_kind='LESSON'
    order by ra.learner_id,ra.item_kind,ra.item_id,
      case ra.status
        when 'APPROVED' then 0
        when 'EVALUATING' then 1
        when 'PENDING' then 2
        when 'REJECTED' then 3
        else 4
      end,coalesce(ra.decided_at,ra.updated_at,ra.created_at) desc,ra.id
  ) f
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
