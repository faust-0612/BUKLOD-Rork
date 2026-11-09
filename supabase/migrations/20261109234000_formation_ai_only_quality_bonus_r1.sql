
-- BUKLOD 2026-11-09: AI-only formation approval and automatic quality rewards.
-- Previous manual review procedures retained as explicit non-mutating compatibility stubs.
-- Both quality bonus and lesson approval remain scoped, audited, and ledger-idempotent.

CREATE OR REPLACE FUNCTION public.buklod_auto_reflection_quality_eligible_v3(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $body$
  SELECT coalesce((
    SELECT
      s.status::text = 'approved'
      AND v.status = 'acceptable'
      AND v.fail_open = false
      AND v.model LIKE 'gemini-%'
      AND v.created_at >= s.submitted_at
      AND v.question_context->>'submissionId' = s.id::text
      AND coalesce(v.question_context->>'serverVerifiedSourceHash','') <> ''
      AND coalesce((v.scores->>'overall')::numeric,0) >= 0.90
      AND coalesce((v.scores->>'relevance')::numeric,0) >= 0.85
      AND coalesce((v.scores->>'depth')::numeric,0) >= 0.85
    FROM public.daily_bible_submissions s
    LEFT JOIN LATERAL (
      SELECT a.status,a.fail_open,a.model,a.scores,a.created_at,a.question_context
      FROM public.buklod_ai_validation_attempts a
      WHERE a.user_id = s.user_id
        AND a.module = 'daily_reading'
        AND a.question_id = 'daily_reading:' || s.id::text || ':auto'
      ORDER BY a.created_at DESC,a.id DESC LIMIT 1
    ) v ON true
    WHERE s.id = p_submission_id
  ),false);
$body$;

CREATE OR REPLACE FUNCTION public.reconcile_daily_bible_reflection_quality_v2(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  rec public.daily_bible_submissions%rowtype;
  configured_points integer := 0;
  desired_points integer := 0;
  current_net bigint := 0;
  delta bigint := 0;
  ai_eligible boolean := false;
BEGIN
  IF p_submission_id IS NULL THEN RETURN; END IF;
  SELECT * INTO rec FROM public.daily_bible_submissions
    WHERE id = p_submission_id FOR UPDATE;
  IF rec.id IS NULL THEN RETURN; END IF;

  -- Serialize repeat trigger calls and retried submissions; no duplicate credits.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'buklod:daily_reading:quality:' || rec.id::text, 0
  ));
  ai_eligible := public.buklod_auto_reflection_quality_eligible_v3(rec.id);

  SELECT greatest(coalesce(base_points,0),0) INTO configured_points
  FROM public.buklod_point_rules
  WHERE activity_type = 'reflection_quality_bonus' AND is_active = true
  LIMIT 1;
  desired_points := CASE WHEN ai_eligible THEN coalesce(configured_points,0) ELSE 0 END;

  SELECT coalesce(sum(CASE WHEN direction='credit' THEN points ELSE -points END),0)
    INTO current_net
    FROM public.buklod_points_ledger
   WHERE user_id=rec.user_id
     AND activity_type='reflection_quality_bonus'
     AND source_id=rec.id
     AND source_key LIKE 'reflection_quality:daily_bible:' || rec.id::text || ':%';

  delta := desired_points - current_net;
  IF delta <> 0 THEN
    INSERT INTO public.buklod_points_ledger
      (user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
    VALUES (
      rec.user_id,
      CASE WHEN delta > 0 THEN 'credit' ELSE 'debit' END,
      abs(delta)::integer,
      'reflection_quality_bonus',
      'reflection_quality:daily_bible:' || rec.id::text || ':' ||
        CASE WHEN delta > 0 THEN 'ai-credit:' ELSE 'ai-adjust:' END ||
        pg_catalog.gen_random_uuid()::text,
      rec.id,
      CASE WHEN delta > 0
        THEN 'Automatic BUKLOD AI reflection quality bonus'
        ELSE 'Automatic reflection quality bonus correction' END,
      NULL
    );
  END IF;

  -- Preserve schema compatibility while showing that this was AI, NOT a human reviewer.
  -- One nested trigger is harmless: the second call sees an identical state and no delta.
  IF rec.reflection_quality_awarded IS DISTINCT FROM ai_eligible
    OR rec.reflection_quality_reviewed_by IS NOT NULL
    OR (ai_eligible AND rec.reflection_quality_reviewed_at IS NULL)
    OR (NOT ai_eligible AND rec.reflection_quality_reviewed_at IS NOT NULL)
  THEN
    UPDATE public.daily_bible_submissions
       SET reflection_quality_awarded = ai_eligible,
           reflection_quality_reviewed_by = NULL,
           reflection_quality_reviewed_at =
             CASE WHEN ai_eligible THEN coalesce(rec.reflection_quality_reviewed_at,now())
                  ELSE NULL END,
           reflection_quality_note =
             CASE WHEN ai_eligible THEN 'Automatic BUKLOD AI quality bonus'
                  ELSE NULL END
     WHERE id = rec.id;
  END IF;
END;
$body$;

CREATE OR REPLACE FUNCTION public.review_daily_bible_reflection_quality_v2(
  p_submission_id uuid,p_award boolean,p_note text DEFAULT NULL::text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
BEGIN
  RAISE EXCEPTION
    'Reflection quality points are issued automatically by BUKLOD AI. Pastor/Admin quality-bonus approval is retired.';
END;
$body$;

-- Lesson auto-approval: direct learner-bound, evidence-backed recording.
-- No more missing v2 readiness RPC or simulated reviewer identity.
CREATE OR REPLACE FUNCTION public.buklod_try_auto_approve_lesson_v2(p_approval_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  actor uuid := auth.uid();
  rec record;
  attempt_id uuid;
BEGIN
  IF actor IS NULL THEN
    RETURN jsonb_build_object('auto_approved',false,'reason','not_authenticated');
  END IF;
  SELECT a.* INTO rec FROM public.buklod_scope_formation_approvals_v2 a
   WHERE a.id=p_approval_id FOR UPDATE;
  IF rec.id IS NULL OR rec.status <> 'PENDING'
    OR rec.item_kind <> 'LESSON' OR rec.learner_id <> actor THEN
    RETURN jsonb_build_object('auto_approved',false,'reason','not_eligible');
  END IF;
  IF public.buklod_get_formation_entry_scope_v1('LESSON') IS DISTINCT FROM rec.scope_id THEN
    RETURN jsonb_build_object('auto_approved',false,'reason','scope_context_mismatch');
  END IF;
  IF NOT public.buklod_lesson_ai_auto_approval_ready_v1(rec.item_id,actor) THEN
    RETURN jsonb_build_object('auto_approved',false,'reason','quality_or_ai_threshold_not_met');
  END IF;

  BEGIN
    PERFORM set_config('buklod.auto_approval','on',true);
    attempt_id := public.buklod_record_lesson_completion_exact_scope_v2(
      rec.scope_id,rec.item_id,
      'Approved automatically by BUKLOD lesson quality validation. No human reviewer was used.'
    );
    UPDATE public.buklod_scope_formation_approvals_v2
       SET status='APPROVED',approver_id=NULL,
           remarks='BUKLOD automatic validation: five required responses passed; no human review.',
           decided_at=now(),updated_at=now()
     WHERE id=rec.id AND status='PENDING';
    PERFORM public.buklod_notify_scope_formation_outcome_v1(rec.id,true);
    PERFORM set_config('buklod.auto_approval','off',true);
    RETURN jsonb_build_object(
      'ok',true,'status','APPROVED','approval_id',rec.id,
      'scope_id',rec.scope_id,'lesson_attempt_id',attempt_id,
      'auto_approved',true,'decision_source','BUKLOD_AI','audit_approver_id',NULL
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('buklod.auto_approval','off',true);
    RAISE WARNING 'BUKLOD lesson automatic approval failed: %',SQLERRM;
    RETURN jsonb_build_object('auto_approved',false,'reason','automatic_recording_failed');
  END;
END;
$body$;

CREATE OR REPLACE FUNCTION public.buklod_review_scope_formation_approval_v2(p_approval_id uuid, p_approve boolean, p_remarks text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_lesson_id uuid;
  v_existing_attempt uuid;
  v_result jsonb;
  v_auto boolean := coalesce(current_setting('buklod.auto_approval', true), '') = 'on';
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  select a.* into v_row
  from public.buklod_scope_formation_approvals_v2 a
  where a.id = p_approval_id;

  if v_row.id is null then
    raise exception 'Approval not found';
  end if;
  if v_row.item_kind in ('DAILY_READING','DAILY_DEVOTION','LESSON') then
    raise exception 'BUKLOD Formation reflection decisions and points are AI-only. Use the automatic validation and retry workflow; manual approval is retired.';
  end if;
  if v_row.status <> 'PENDING' then
    raise exception 'Approval has already been decided';
  end if;
  if v_row.learner_id = v_actor then
    raise exception 'Members cannot approve their own submission';
  end if;
  if not public.buklod_is_formation_scope_approver_v1(v_row.scope_id, v_actor) then
    raise exception 'Exact-scope approval authority required';
  end if;
  if not public.buklod_user_is_active_scope_member(v_row.scope_id, v_row.learner_id) then
    raise exception 'Learner is no longer ACTIVE in this submission scope';
  end if;

  if p_approve and v_row.item_kind = 'LESSON' then
    select lp.lesson_id into v_lesson_id
    from public.lesson_progress lp
    where lp.id = v_row.item_id
      and lp.user_id = v_row.learner_id;

    if v_lesson_id is null then
      raise exception 'Formation learning progress not found';
    end if;

    select a.id into v_existing_attempt
    from public.member_lesson_attempts a
    where a.user_id = v_row.learner_id
      and a.lesson_id = v_lesson_id
      and a.review_status = 'approved'
      and a.reset_at is null
    order by a.attempt_number desc
    limit 1;

    if v_existing_attempt is not null then
      update public.buklod_scope_formation_approvals_v2
      set status = 'APPROVED',
          approver_id = v_actor,
          remarks = nullif(trim(coalesce(p_remarks, '')), ''),
          decided_at = now(),
          updated_at = now()
      where id = v_row.id
        and status = 'PENDING';

      v_result := jsonb_build_object(
        'ok', true,
        'approval_id', v_row.id,
        'scope_id', v_row.scope_id,
        'status', 'APPROVED',
        'lesson_attempt_id', v_existing_attempt,
        'reused_existing_completion', true
      );

      perform public.buklod_notify_scope_formation_outcome_v1(v_row.id, v_auto);
      return v_result;
    end if;
  end if;

  v_result := public.buklod_review_scope_formation_approval_core_r22b(
    p_approval_id,
    p_approve,
    p_remarks
  );

  perform public.buklod_notify_scope_formation_outcome_v1(p_approval_id, v_auto);
  return v_result;
end;
$function$;

-- Prevent direct invocation of the old core mutation RPC by members.
REVOKE EXECUTE ON FUNCTION public.buklod_review_scope_formation_approval_core_r22b(uuid,boolean,text)
  FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_daily_bible_reflection_quality_v2(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.buklod_auto_reflection_quality_eligible_v3(uuid)
  FROM PUBLIC,anon,authenticated;

-- Never bypass a substantive quality check just because a model is unavailable.
UPDATE public.buklod_ai_validation_config
   SET config_value=jsonb_set(config_value,'{fail_open_on_ai_unavailable}','false'::jsonb,true),
       updated_at=now()
 WHERE config_key='global' AND is_active=true;
