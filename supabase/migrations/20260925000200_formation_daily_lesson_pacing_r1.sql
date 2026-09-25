-- BUKLOD Formation Daily Lesson Pacing R1
-- SOURCE ONLY. Do not apply automatically from this patch.
--
-- Rules:
-- 1) BUKLOD 101-105: next lesson opens one day after previous approved lesson.
-- 2) BUKLOD 106-107: existing weekly pacing remains unchanged.
-- 3) Full AI pass remains strict.
-- 4) rule-v1 fallback may finalize only when ACCEPTABLE, non-fail-open,
--    and it meets the fallback score contract.
-- 5) Historical reward recovery is intentionally excluded from this production-safe pacing migration.

create or replace function public.buklod_lesson_ai_auto_approval_ready_v1(
  p_progress_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_lesson_id uuid;
  v_answers jsonb;
  v_reflection text;
  v_answer text;
  v_index integer := 0;
  v_question_id text;
  v_hash text;
  v_ttl integer := 6;
begin
  select lp.lesson_id
  into v_lesson_id
  from public.lesson_progress lp
  where lp.id = p_progress_id
    and lp.user_id = p_user_id
    and lp.submitted_for_validation_at is not null;

  if v_lesson_id is null then
    return false;
  end if;

  select r.question_answers, r.reflection_text
  into v_answers, v_reflection
  from public.learning_lesson_responses r
  where r.user_id = p_user_id
    and r.lesson_id = v_lesson_id
  order by r.updated_at desc
  limit 1;

  if v_answers is null
     or jsonb_typeof(v_answers) <> 'array'
     or jsonb_array_length(v_answers) <> 4
     or char_length(trim(coalesce(v_reflection, ''))) < 20 then
    return false;
  end if;

  v_ttl := coalesce(
    (public._buklod_ai_validation_config_v1()->>'attempt_ttl_hours')::integer,
    6
  );

  for v_answer in
    select value
    from jsonb_array_elements_text(v_answers)
  loop
    v_index := v_index + 1;
    v_question_id :=
      'lesson:' || v_lesson_id::text || ':generated:' || v_index::text;
    v_hash := public._buklod_ai_answer_hash_v1(v_answer);

    if not exists (
      select 1
      from public.buklod_ai_validation_attempts a
      where a.user_id = p_user_id
        and a.question_id = v_question_id
        and a.answer_hash = v_hash
        and a.created_at >= now() - make_interval(hours => v_ttl)
        and a.status = 'acceptable'
        and a.fail_open = false
        and (
          (
            coalesce(a.model, '') not in (
              '', 'rule-v1', 'disabled', 'edge-unavailable'
            )
            and coalesce((a.scores->>'overall')::numeric, 0) >= 0.82
            and coalesce((a.scores->>'relevance')::numeric, 0) >= 0.78
            and coalesce((a.scores->>'depth')::numeric, 0) >= 0.72
          )
          or
          (
            a.model = 'rule-v1'
            and coalesce((a.scores->>'overall')::numeric, 0) >= 0.72
            and coalesce((a.scores->>'relevance')::numeric, 0) >= 0.75
            and coalesce((a.scores->>'depth')::numeric, 0) >= 0.70
          )
        )
      limit 1
    ) then
      return false;
    end if;
  end loop;

  v_hash := public._buklod_ai_answer_hash_v1(v_reflection);

  if not exists (
    select 1
    from public.buklod_ai_validation_attempts a
    where a.user_id = p_user_id
      and a.question_id = 'lesson:' || v_lesson_id::text || ':reflection'
      and a.answer_hash = v_hash
      and a.created_at >= now() - make_interval(hours => v_ttl)
      and a.status = 'acceptable'
      and a.fail_open = false
      and (
        (
          coalesce(a.model, '') not in (
            '', 'rule-v1', 'disabled', 'edge-unavailable'
          )
          and coalesce((a.scores->>'overall')::numeric, 0) >= 0.82
          and coalesce((a.scores->>'relevance')::numeric, 0) >= 0.78
          and coalesce((a.scores->>'depth')::numeric, 0) >= 0.72
        )
        or
        (
          a.model = 'rule-v1'
          and coalesce((a.scores->>'overall')::numeric, 0) >= 0.72
          and coalesce((a.scores->>'relevance')::numeric, 0) >= 0.75
          and coalesce((a.scores->>'depth')::numeric, 0) >= 0.70
        )
      )
    limit 1
  ) then
    return false;
  end if;

  return true;
end;
$function$;


create or replace function public.buklod_formation_previous_lesson_available_from_v1(
  p_user_id uuid,
  p_track_lesson_id uuid
)
returns timestamptz
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_current record;
  v_previous record;
  v_completed_at timestamptz;
begin
  select *
  into v_current
  from public.buklod_formation_track_lessons
  where id = p_track_lesson_id
    and is_active = true;

  if v_current.id is null or coalesce(v_current.lesson_sequence, 1) <= 1 then
    return null;
  end if;

  select *
  into v_previous
  from public.buklod_formation_track_lessons p
  where p.stage_code = v_current.stage_code
    and coalesce(
      p.role_track_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    ) = coalesce(
      v_current.role_track_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
    and p.lesson_sequence = v_current.lesson_sequence - 1
    and p.is_active = true
  limit 1;

  if v_previous.id is null or v_previous.learning_lesson_id is null then
    return null;
  end if;

  select max(
    coalesce(a.admin_reviewed_at, a.pastor_validated_at, a.created_at)
  )
  into v_completed_at
  from public.member_lesson_attempts a
  where a.user_id = p_user_id
    and a.lesson_id = v_previous.learning_lesson_id
    and a.review_status = 'approved'
    and a.reset_at is null;

  if v_completed_at is null then
    return null;
  end if;

  return v_completed_at + interval '1 day';
end;
$function$;


create or replace function public.can_access_formation_lesson_v1(
  p_lesson_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  actor uuid := auth.uid();
  tl record;
  delivery record;
  stage_access jsonb;
  stage_code integer;
  legacy_stage integer;
  calendar_released boolean;
  current_week integer;
  release_week integer;
  available_from timestamptz;
  blocking text;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if p_lesson_id is null then
    return jsonb_build_object(
      'allowed', false,
      'blocking_reason', 'STAGE_LOCKED'
    );
  end if;

  tl := public.buklod_formation_resolve_track_lesson_for_learning(
    p_lesson_id,
    actor
  );

  if tl.id is null then
    select trim(t.stage_code)::integer
    into legacy_stage
    from public.learning_lessons l
    join public.learning_tracks t on t.id = l.track_id
    where l.id = p_lesson_id
      and trim(t.stage_code) ~ '^[0-9]+$';

    if legacy_stage is null then
      return jsonb_build_object(
        'allowed', false,
        'release_status', 'not_formation',
        'blocking_reason', 'FORMATION_STAGE_NOT_FOUND'
      );
    end if;

    stage_access := public.buklod_formation_evaluate_stage_access(
      actor,
      legacy_stage
    );

    if not coalesce(
      (stage_access->>'access_allowed')::boolean,
      false
    ) and not public.is_system_admin() then
      return jsonb_build_object(
        'allowed', false,
        'stage_code', legacy_stage,
        'release_status', 'locked',
        'blocking_reason',
          coalesce(stage_access->'blocking_reasons'->>0, 'STAGE_LOCKED')
      );
    end if;

    return jsonb_build_object(
      'allowed', true,
      'stage_code', legacy_stage,
      'release_status', 'legacy',
      'blocking_reason', null
    );
  end if;

  stage_code := tl.stage_code;

  stage_access := public.buklod_formation_evaluate_stage_access(
    actor,
    stage_code
  );

  if not coalesce(
    (stage_access->>'access_allowed')::boolean,
    false
  ) and not public.is_system_admin() then
    return jsonb_build_object(
      'allowed', false,
      'stage_code', stage_code,
      'release_status', 'locked',
      'blocking_reason',
        coalesce(stage_access->'blocking_reasons'->>0, 'STAGE_LOCKED'),
      'track_lesson_id', tl.id,
      'lesson_sequence', tl.lesson_sequence
    );
  end if;

  -- BUKLOD 101-105: sequential + one-day pacing.
  if stage_code not in (106, 107) then
    if not public.buklod_formation_are_track_lesson_prerequisites_met(
      actor,
      tl.id
    ) and not public.is_system_admin() then
      return jsonb_build_object(
        'allowed', false,
        'stage_code', stage_code,
        'release_status', 'available',
        'blocking_reason', 'PREREQUISITE_LESSON_INCOMPLETE',
        'track_lesson_id', tl.id,
        'lesson_sequence', tl.lesson_sequence
      );
    end if;

    if not public.is_system_admin()
       and coalesce(tl.lesson_sequence, 1) > 1 then
      available_from :=
        public.buklod_formation_previous_lesson_available_from_v1(
          actor,
          tl.id
        );

      if available_from is not null and now() < available_from then
        return jsonb_build_object(
          'allowed', false,
          'stage_code', stage_code,
          'release_status', 'daily_wait',
          'available_from', available_from,
          'blocking_reason', 'NEXT_LESSON_DAILY_WAIT',
          'track_lesson_id', tl.id,
          'lesson_sequence', tl.lesson_sequence
        );
      end if;
    end if;

    return jsonb_build_object(
      'allowed', true,
      'stage_code', stage_code,
      'release_status', 'available',
      'available_from', available_from,
      'track_lesson_id', tl.id,
      'lesson_sequence', tl.lesson_sequence
    );
  end if;

  -- BUKLOD 106-107: preserve current weekly delivery.
  select *
  into delivery
  from public.buklod_formation_get_member_delivery(
    actor,
    stage_code
  ) d;

  if delivery.id is null then
    blocking :=
      case
        when stage_code = 106 then 'FORMATION_TRACK_NOT_ASSIGNED'
        else 'CURRICULUM_NOT_ASSIGNED'
      end;

    return jsonb_build_object(
      'allowed', false,
      'stage_code', stage_code,
      'release_status', 'unassigned',
      'blocking_reason', blocking,
      'track_lesson_id', tl.id,
      'lesson_sequence', tl.lesson_sequence
    );
  end if;

  if stage_code = 106
     and delivery.role_track_id is not null
     and tl.role_track_id is distinct from delivery.role_track_id then
    return jsonb_build_object(
      'allowed', false,
      'stage_code', stage_code,
      'blocking_reason', 'FORMATION_TRACK_NOT_ASSIGNED',
      'track_lesson_id', tl.id,
      'lesson_sequence', tl.lesson_sequence
    );
  end if;

  calendar_released :=
    public.buklod_formation_is_track_lesson_calendar_released(
      delivery,
      tl
    );

  current_week :=
    public.buklod_formation_delivery_current_week(delivery);

  release_week :=
    ceil(
      tl.lesson_sequence::numeric /
      greatest(delivery.lessons_per_week, 1)::numeric
    )::integer;

  available_from :=
    coalesce(
      delivery.release_anchor_date::timestamptz,
      delivery.started_at
    )
    + make_interval(days => (release_week - 1) * 7);

  if not calendar_released then
    return jsonb_build_object(
      'allowed', false,
      'stage_code', stage_code,
      'release_status', delivery.release_status,
      'release_week', release_week,
      'available_from', available_from,
      'blocking_reason', 'LESSON_NOT_RELEASED',
      'track_lesson_id', tl.id,
      'lesson_sequence', tl.lesson_sequence,
      'current_week', current_week,
      'lessons_per_week', delivery.lessons_per_week
    );
  end if;

  if not public.buklod_formation_are_track_lesson_prerequisites_met(
    actor,
    tl.id
  ) and not public.is_system_admin() then
    return jsonb_build_object(
      'allowed', false,
      'stage_code', stage_code,
      'release_status', delivery.release_status,
      'release_week', release_week,
      'available_from', available_from,
      'blocking_reason', 'PREREQUISITE_LESSON_INCOMPLETE',
      'track_lesson_id', tl.id,
      'lesson_sequence', tl.lesson_sequence,
      'current_week', current_week,
      'lessons_per_week', delivery.lessons_per_week
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'stage_code', stage_code,
    'release_status', delivery.release_status,
    'release_week', release_week,
    'available_from', available_from,
    'track_lesson_id', tl.id,
    'lesson_sequence', tl.lesson_sequence,
    'current_week', current_week,
    'lessons_per_week', delivery.lessons_per_week
  );
end;
$function$;


-- Historical validated-but-stranded lesson recovery is intentionally not
-- performed here. Forward pacing and validation rules must not silently
-- create retroactive approvals, points, or payouts during a pacing release.




revoke all on function
public.buklod_formation_previous_lesson_available_from_v1(uuid, uuid)
from public;

grant execute on function
public.buklod_formation_previous_lesson_available_from_v1(uuid, uuid)
to authenticated, service_role;
