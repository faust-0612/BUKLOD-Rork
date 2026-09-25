-- BUKLOD Formation Report Lesson Activity R2
-- Targeted wrapper repair:
-- preserve the current canonical v3 report exactly, then overlay real
-- lesson_progress starts for member/stage activity counts.

alter function public.buklod_scope_faith_monitoring_summary_v3(uuid)
rename to buklod_scope_faith_monitoring_summary_v3_base_r2;

revoke all on function
public.buklod_scope_faith_monitoring_summary_v3_base_r2(uuid)
from public, anon, authenticated;

grant execute on function
public.buklod_scope_faith_monitoring_summary_v3_base_r2(uuid)
to service_role;


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


create or replace function public.buklod_scope_faith_monitoring_summary_v3(
  p_scope_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_base jsonb;
begin
  v_base :=
    public.buklod_scope_faith_monitoring_summary_v3_base_r2(
      p_scope_id
    );

  return
    private.buklod_scope_faith_monitoring_lesson_activity_overlay_v1(
      p_scope_id,
      v_base
    );
end;
$function$;

revoke all on function
public.buklod_scope_faith_monitoring_summary_v3(uuid)
from public, anon;

grant execute on function
public.buklod_scope_faith_monitoring_summary_v3(uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';
