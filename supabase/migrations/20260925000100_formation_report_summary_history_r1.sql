-- BUKLOD Formation Report R1
-- Targeted repair only:
-- 1) Fix v1 member_totals CTE lifetime.
-- 2) Add authorized recent Formation submission history.

do $migration$
declare
  v_def text;

  v_old text := $old$
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'stage_code', sa.stage_code,
          'stage_title', sa.stage_title,
          'completed_count', sa.completed_count,
          'in_progress_count', sa.in_progress_count
        )
        order by sa.stage_order
      ),
      '[]'::jsonb
    )
  into v_stage_rows
  from stage_agg sa;

  select
    count(*) filter (where mt.total_approved > 0)::int,
    count(*) filter (where mt.total_approved = 0)::int
  into v_lesson_active, v_lesson_not_started
  from member_totals mt;
$old$;

  v_new text := $new$
  select
    (
      select count(*) filter (
        where mt.total_approved > 0
      )::int
      from member_totals mt
    ),
    (
      select count(*) filter (
        where mt.total_approved = 0
      )::int
      from member_totals mt
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'stage_code', sa.stage_code,
            'stage_title', sa.stage_title,
            'completed_count', sa.completed_count,
            'in_progress_count', sa.in_progress_count
          )
          order by sa.stage_order
        )
        from stage_agg sa
      ),
      '[]'::jsonb
    )
  into
    v_lesson_active,
    v_lesson_not_started,
    v_stage_rows;
$new$;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname =
      'buklod_scope_faith_monitoring_summary_v1'
    and pg_get_function_identity_arguments(p.oid) =
      'p_scope_id uuid'
  limit 1;

  if v_def is null then
    raise exception
      'Faith monitoring summary v1 not found';
  end if;

  if position(v_old in v_def) = 0 then
    raise exception
      'Expected v1 member_totals defect anchor not found';
  end if;

  execute replace(
    v_def,
    v_old,
    v_new
  );
end
$migration$;


create or replace function
public.buklod_scope_formation_submission_history_v1(
  p_scope_id uuid,
  p_limit integer default 100
)
returns table(
  approval_id uuid,
  scope_id uuid,
  scope_name text,
  item_kind text,
  item_id uuid,
  learner_id uuid,
  learner_name text,
  title text,
  subtitle text,
  submitted_at timestamptz,
  decided_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
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

  where
    a.scope_id = p_scope_id

    or (
      v_scope_type = 'ORGANIZATION'
      and exists (
        select 1
        from public.buklod_scopes child
        where child.id = a.scope_id
          and child.scope_type = 'CLUSTER'
          and child.status not in (
            'SUSPENDED',
            'DELETED'
          )
          and coalesce(
            child.organization_id,
            child.parent_scope_id
          ) = p_scope_id
      )
    )

  order by a.created_at desc
  limit v_limit;
end;
$function$;


revoke all
on function
public.buklod_scope_formation_submission_history_v1(
  uuid,
  integer
)
from public;

revoke all
on function
public.buklod_scope_formation_submission_history_v1(
  uuid,
  integer
)
from anon;

grant execute
on function
public.buklod_scope_formation_submission_history_v1(
  uuid,
  integer
)
to authenticated;

grant execute
on function
public.buklod_scope_formation_submission_history_v1(
  uuid,
  integer
)
to service_role;