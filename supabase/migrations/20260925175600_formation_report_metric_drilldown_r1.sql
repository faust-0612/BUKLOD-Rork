-- BUKLOD Formation report metric drilldown R1
-- Exact production function source.

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
            and s.cluster_id=p_scope_id
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
    where s.cluster_id=p_scope_id
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
    where a.scope_id=p_scope_id
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
$function$


revoke all on function
public.buklod_scope_faith_monitoring_metric_details_v1(uuid,text)
from public,anon;

grant execute on function
public.buklod_scope_faith_monitoring_metric_details_v1(uuid,text)
to authenticated,service_role;

notify pgrst,'reload schema';
