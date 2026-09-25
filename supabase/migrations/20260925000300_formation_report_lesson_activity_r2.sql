-- BUKLOD Formation Report Lesson Activity R2
-- Targeted backend repair:
-- 1) Keep approved/stage-complete semantics from the existing summary.
-- 2) Count real lesson_progress starts as "members with lesson activity".
-- 3) Count stage in-progress from started lesson activity, not only approved lessons.
-- 4) Preserve Daily Reading / Devotion / approval-pipeline logic unchanged.

create or replace function private.buklod_scope_faith_monitoring_lesson_activity_overlay_v1(
  p_scope_id uuid,
  p_base jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
with scope_members as (
  select m.user_id
  from public.buklod_scope_memberships m
  where m.scope_id = p_scope_id
    and m.membership_status = 'ACTIVE'
),
started_by_stage as (
  select
    trim(t.stage_code)::integer as stage_code,
    count(distinct lp.user_id)::integer as started_members
  from scope_members sm
  join public.lesson_progress lp
    on lp.user_id = sm.user_id
   and lp.started_at is not null
  join public.learning_lessons l
    on l.id = lp.lesson_id
  join public.learning_tracks t
    on t.id = l.track_id
  where t.stage_code is not null
    and trim(t.stage_code) ~ '^[0-9]+$'
    and trim(t.stage_code)::integer between 101 and 107
  group by trim(t.stage_code)::integer
),
member_activity as (
  select count(distinct lp.user_id)::integer as members_active
  from scope_members sm
  join public.lesson_progress lp
    on lp.user_id = sm.user_id
   and lp.started_at is not null
  join public.learning_lessons l
    on l.id = lp.lesson_id
  join public.learning_tracks t
    on t.id = l.track_id
  where t.stage_code is not null
    and trim(t.stage_code) ~ '^[0-9]+$'
    and trim(t.stage_code)::integer between 101 and 107
),
stage_rows as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stage_code',
          (stage_row->>'stage_code')::integer,
        'stage_title',
          stage_row->>'stage_title',
        'completed_count',
          coalesce((stage_row->>'completed_count')::integer, 0),
        'in_progress_count',
          greatest(
            coalesce(sb.started_members, 0)
            - coalesce((stage_row->>'completed_count')::integer, 0),
            0
          )
      )
      order by (stage_row->>'stage_code')::integer
    ),
    '[]'::jsonb
  ) as rows
  from jsonb_array_elements(
    coalesce(
      p_base->'buklod_lesson'->'stages',
      '[]'::jsonb
    )
  ) stage_row
  left join started_by_stage sb
    on sb.stage_code =
      (stage_row->>'stage_code')::integer
)
select jsonb_set(
  p_base,
  '{buklod_lesson}',
  coalesce(
    p_base->'buklod_lesson',
    '{}'::jsonb
  )
  ||
  jsonb_build_object(
    'members_active',
      coalesce(
        (select ma.members_active from member_activity ma),
        0
      ),
    'members_not_started',
      greatest(
        coalesce((p_base->>'active_members')::integer, 0)
        - coalesce(
            (select ma.members_active from member_activity ma),
            0
          ),
        0
      ),
    'stages',
      coalesce(
        (select sr.rows from stage_rows sr),
        '[]'::jsonb
      )
  ),
  true
);
$function$;

revoke all on function
private.buklod_scope_faith_monitoring_lesson_activity_overlay_v1(uuid,jsonb)
from public, anon, authenticated;

grant execute on function
private.buklod_scope_faith_monitoring_lesson_activity_overlay_v1(uuid,jsonb)
to service_role;

do $migration$
declare
  v_def text;
  v_anchor text := '  return v_base;';
  v_replacement text :=
    '  v_base := private.buklod_scope_faith_monitoring_lesson_activity_overlay_v1('
    || E'\n    p_scope_id,'
    || E'\n    v_base'
    || E'\n  );'
    || E'\n\n  return v_base;';
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname =
      'buklod_scope_faith_monitoring_summary_v3'
    and pg_get_function_identity_arguments(p.oid) =
      'p_scope_id uuid'
  limit 1;

  if v_def is null then
    raise exception
      'Faith monitoring summary v3 not found';
  end if;

  if position(
    'buklod_scope_faith_monitoring_lesson_activity_overlay_v1'
    in v_def
  ) > 0 then
    return;
  end if;

  if position(v_anchor in v_def) = 0 then
    raise exception
      'Faith monitoring v3 return anchor not found';
  end if;

  execute replace(
    v_def,
    v_anchor,
    v_replacement
  );
end
$migration$;

notify pgrst, 'reload schema';
