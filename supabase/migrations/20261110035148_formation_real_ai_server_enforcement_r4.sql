-- BUKLOD R4: close legacy rule-v1 lesson reward bypass and route auto-completion
-- through the canonical learner-bound, real Gemini validation path.
-- Other non-lesson validation and independent evidence verification are unchanged.

CREATE OR REPLACE FUNCTION public.buklod_lesson_ai_answer_checked_v3(
  p_question_id text,p_response text,p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_lesson_id uuid;
  v_lesson record;
  v_attempt record;
  v_suffix text;
  v_index integer;
  v_question text;
  v_hash text;
  v_ttl integer;
BEGIN
  IF p_user_id IS NULL OR p_question_id IS NULL OR p_response IS NULL THEN RETURN false; END IF;
  IF p_question_id !~* '^lesson:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(generated:[1-4]|reflection)$'
     THEN RETURN false; END IF;

  v_lesson_id := split_part(p_question_id,':',2)::uuid;
  v_suffix := substring(p_question_id from ('^lesson:[0-9a-fA-F-]{36}:(.*)$'));
  SELECT l.id,l.updated_at,l.content_hash,l.reflection_question,
         l.generated_questions_fil,l.generated_questions_en
    INTO v_lesson FROM public.learning_lessons l WHERE l.id=v_lesson_id;
  IF v_lesson.id IS NULL THEN RETURN false; END IF;

  v_ttl := least(24,greatest(1,coalesce(
    (public._buklod_ai_validation_config_v1()->>'attempt_ttl_hours')::integer,6)));
  v_hash := public._buklod_ai_answer_hash_v1(p_response);

  SELECT a.status,a.fail_open,a.model,a.scores,a.created_at,a.question_context
    INTO v_attempt
    FROM public.buklod_ai_validation_attempts a
   WHERE a.user_id=p_user_id AND a.module='lesson'
     AND a.question_id=p_question_id AND a.answer_hash=v_hash
   ORDER BY a.created_at DESC,a.id DESC LIMIT 1;

  IF v_attempt.status IS DISTINCT FROM 'acceptable'
     OR coalesce(v_attempt.fail_open,true) <> false
     OR coalesce(v_attempt.model,'') NOT LIKE 'gemini-%'
     OR v_attempt.created_at IS NULL
     OR v_attempt.created_at < greatest(now()-make_interval(hours=>v_ttl),v_lesson.updated_at)
     OR coalesce((v_attempt.scores->>'overall')::numeric,0) < .82
     OR coalesce((v_attempt.scores->>'relevance')::numeric,0) < .78
     OR coalesce((v_attempt.scores->>'depth')::numeric,0) < .72
     OR coalesce(v_attempt.question_context->>'serverVerifiedLessonId','') <> v_lesson_id::text
  THEN RETURN false; END IF;

  IF v_lesson.content_hash IS NOT NULL
      AND v_attempt.question_context->>'serverVerifiedContentHash'
         IS DISTINCT FROM v_lesson.content_hash
  THEN RETURN false; END IF;

  IF v_suffix='reflection' THEN
    v_question:=coalesce(nullif(btrim(v_lesson.reflection_question),''),
                         'Write your reflection on this lesson.');
    RETURN v_attempt.question_context->>'questionType'='reflection'
       AND v_attempt.question_context->>'questionText'=v_question
       AND char_length(btrim(p_response))>=20;
  END IF;

  v_index := substring(v_suffix from '^generated:([1-4])$')::integer;
  IF v_index NOT BETWEEN 1 AND 4 THEN RETURN false; END IF;
  v_question:=v_attempt.question_context->>'questionText';
  RETURN v_attempt.question_context->>'questionType'='generated'
     AND char_length(btrim(p_response))>=10
     AND nullif(btrim(coalesce(v_question,'')),'') IS NOT NULL
     AND (
       v_question = v_lesson.generated_questions_fil->>(v_index-1)
       OR v_question = v_lesson.generated_questions_en->>(v_index-1)
     );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.buklod_lesson_ai_answer_checked_v3(text,text,uuid)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.buklod_lesson_ai_auto_approval_ready_v1(
 p_progress_id uuid,p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_progress record;
  v_answers jsonb;
  v_reflection text;
  v_answer text;
  v_index integer:=0;
BEGIN
  IF p_user_id IS NULL OR p_progress_id IS NULL THEN RETURN false; END IF;
  SELECT lp.id,lp.lesson_id,lp.enrollment_id
    INTO v_progress
    FROM public.lesson_progress lp
   WHERE lp.id=p_progress_id AND lp.user_id=p_user_id
     AND lp.submitted_for_validation_at IS NOT NULL;
  IF v_progress.id IS NULL THEN RETURN false; END IF;
  SELECT r.question_answers,r.reflection_text INTO v_answers,v_reflection
    FROM public.learning_lesson_responses r
   WHERE r.user_id=p_user_id AND r.lesson_id=v_progress.lesson_id
     AND r.enrollment_id=v_progress.enrollment_id
   ORDER BY r.updated_at DESC LIMIT 1;
  IF v_answers IS NULL OR jsonb_typeof(v_answers)<>'array'
     OR jsonb_array_length(v_answers)<>4
     OR char_length(btrim(coalesce(v_reflection,'')))<20 THEN RETURN false; END IF;

  FOR v_answer IN SELECT value FROM jsonb_array_elements_text(v_answers) LOOP
    v_index:=v_index+1;
    IF NOT public.buklod_lesson_ai_answer_checked_v3(
        'lesson:'||v_progress.lesson_id::text||':generated:'||v_index::text,
        v_answer,p_user_id)
    THEN RETURN false; END IF;
  END LOOP;
  RETURN public.buklod_lesson_ai_answer_checked_v3(
      'lesson:'||v_progress.lesson_id::text||':reflection',v_reflection,p_user_id);
END;
$function$;

-- Keep the pre-existing RPC contract; authorize all five lesson parts through
-- source-grounded Gemini. No change to generic non-Lesson legacy validations.
CREATE OR REPLACE FUNCTION public.assert_buklod_response_validated_v1(
 p_question_id text,p_response text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  actor uuid:=auth.uid();
  cfg jsonb:=public._buklod_ai_validation_config_v1();
  answer_hash text:=public._buklod_ai_answer_hash_v1(p_response);
  ttl_hours integer:=coalesce((cfg->>'attempt_ttl_hours')::integer,6);
  attempt_record record;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  -- For LESSONS never bypass via rule-v1, disabled config, or human override.
  IF coalesce(p_question_id,'') LIKE 'lesson:%' THEN
    IF NOT public.buklod_lesson_ai_answer_checked_v3(p_question_id,p_response,actor)
      THEN RAISE EXCEPTION
        'This Lesson response needs a current source-grounded BUKLOD AI check. Please retry from the updated lesson screen.';
    END IF;
    RETURN;
  END IF;

  IF coalesce((cfg->>'enabled')::boolean,true)=false THEN RETURN; END IF;
  IF coalesce(btrim(p_question_id),'')='' THEN
    RAISE EXCEPTION 'Validation question id is required'; END IF;

  SELECT a.* INTO attempt_record
  FROM public.buklod_ai_validation_attempts a
  WHERE a.user_id=actor AND a.question_id=p_question_id
    AND a.answer_hash=answer_hash
    AND a.created_at>=now()-make_interval(hours=>ttl_hours)
  ORDER BY a.created_at DESC LIMIT 1;

  IF attempt_record.id IS NULL THEN
    RAISE EXCEPTION 'Answer must pass BUKLOD quality check before submission.'; END IF;
  IF attempt_record.status='acceptable' THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.buklod_ai_validation_overrides o
      WHERE o.attempt_id=attempt_record.id) THEN RETURN; END IF;
  RAISE EXCEPTION 'Answer quality check status is %. Revise and try again.',attempt_record.status;
END;
$function$;

-- Bug fix: v1 lesson submission accidentally called legacy auto-approve v1,
-- which allowed rule-v1 evidence even after the R3 change.
CREATE OR REPLACE FUNCTION public.submit_my_formation_lesson_for_validation_v1(
 p_enrollment_id uuid,p_lesson_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_progress_id uuid;
  v_answers jsonb;
  v_reflection text;
  v_answer text;
  v_answer_count integer:=0;
  v_scope uuid;
  v_approval_id uuid;
  v_approval_status text;
  v_auto_result jsonb:='{}'::jsonb;
  v_final_status text:='needs_improvement';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Kailangang mag-sign in muli bago magsumite.'; END IF;
  IF p_enrollment_id IS NULL OR p_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Kulang ang impormasyon ng aralin.'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.track_enrollments e
    JOIN public.learning_lessons l ON l.id=p_lesson_id
    JOIN public.learning_tracks t ON t.id=l.track_id
    WHERE e.id=p_enrollment_id AND e.user_id=v_user AND e.track_id=l.track_id
      AND t.formation_program IN ('ccp','discipleship','mentoring')
  ) THEN RAISE EXCEPTION 'Ang araling ito ay hindi kabilang sa iyong enrollment.'; END IF;

  SELECT lp.id INTO v_progress_id
    FROM public.lesson_progress lp
   WHERE lp.enrollment_id=p_enrollment_id AND lp.lesson_id=p_lesson_id AND lp.user_id=v_user
   LIMIT 1;
  IF v_progress_id IS NULL THEN RAISE EXCEPTION 'I-save muna ang study bago isumite.'; END IF;

  SELECT r.question_answers,r.reflection_text INTO v_answers,v_reflection
    FROM public.learning_lesson_responses r
   WHERE r.user_id=v_user AND r.enrollment_id=p_enrollment_id AND r.lesson_id=p_lesson_id
   ORDER BY r.updated_at DESC LIMIT 1;
  IF v_answers IS NULL OR jsonb_typeof(v_answers)<>'array' THEN
    RAISE EXCEPTION 'Sagutan muna ang lahat ng apat na tanong.'; END IF;
  v_answer_count:=jsonb_array_length(v_answers);
  IF v_answer_count<>4 THEN RAISE EXCEPTION 'Kumpletuhin ang apat na tanong.'; END IF;
  FOR v_answer IN SELECT value FROM jsonb_array_elements_text(v_answers) LOOP
    IF char_length(btrim(coalesce(v_answer,'')))<10 THEN
      RAISE EXCEPTION 'Bawat sagot ay dapat kumpleto.'; END IF;
  END LOOP;
  IF char_length(btrim(coalesce(v_reflection,'')))<20 THEN
    RAISE EXCEPTION 'Kumpletuhin ang Personal Reflection.'; END IF;

  UPDATE public.lesson_progress SET submitted_for_validation_at=now(),updated_at=now()
   WHERE id=v_progress_id AND user_id=v_user;

  v_scope:=public.buklod_get_formation_entry_scope_v1('LESSON');
  IF v_scope IS NOT NULL THEN
    SELECT a.id,a.status INTO v_approval_id,v_approval_status
      FROM public.buklod_scope_formation_approvals_v2 a
     WHERE a.scope_id=v_scope AND a.learner_id=v_user
       AND a.item_kind='LESSON' AND a.item_id=v_progress_id
       AND a.status IN ('PENDING','APPROVED')
     ORDER BY a.created_at DESC LIMIT 1;
  END IF;
  IF v_approval_id IS NOT NULL AND v_approval_status='APPROVED' THEN
    v_final_status:='approved';
  ELSIF v_approval_id IS NOT NULL THEN
    v_auto_result:=public.buklod_try_auto_approve_lesson_v2(v_approval_id);
    IF coalesce((v_auto_result->>'auto_approved')::boolean,false) THEN
      v_final_status:='approved';
    ELSE
      -- No human queue: reject/allow a fresh AI attempt rather than
      -- leaving members indefinitely pending manual review.
      UPDATE public.buklod_scope_formation_approvals_v2
         SET status='REJECTED',approver_id=NULL,
             remarks='BUKLOD AI did not confirm all lesson responses. Improve the response and retry.',
             decided_at=now(),updated_at=now()
       WHERE id=v_approval_id AND status='PENDING';
      UPDATE public.lesson_progress SET submitted_for_validation_at=NULL,updated_at=now()
       WHERE id=v_progress_id AND user_id=v_user;
      PERFORM public.buklod_notify_scope_formation_outcome_v1(v_approval_id,true);
      v_final_status:='needs_improvement';
    END IF;
  ELSE
    UPDATE public.lesson_progress SET submitted_for_validation_at=NULL,updated_at=now()
      WHERE id=v_progress_id AND user_id=v_user;
    v_final_status:='needs_improvement';
  END IF;
  RETURN jsonb_build_object(
    'ok',true,'progress_id',v_progress_id,'approval_id',v_approval_id,
    'scope_id',v_scope,'answers_found',v_answer_count,
    'status',v_final_status,
    'auto_approved',coalesce((v_auto_result->>'auto_approved')::boolean,false),
    'auto_approval_reason',v_auto_result->>'reason','human_approval_required',false
  );
END;
$function$;

-- Keep existing service-role helper grants unchanged. Harden the new helper only.
