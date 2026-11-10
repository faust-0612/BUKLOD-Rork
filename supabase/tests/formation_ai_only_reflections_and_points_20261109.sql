-- Read-only regression of BUKLOD AI-only reflection and reward contracts.
-- No member data or points are modified; safe to run against production or RC.
BEGIN TRANSACTION READ ONLY;

DO $test$
DECLARE
  v_count bigint;
  v_definition text;
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.buklod_ai_validation_config
    WHERE config_key='global' AND is_active=true
      AND coalesce((config_value->>'fail_open_on_ai_unavailable')::boolean,true)
  ) THEN RAISE EXCEPTION 'Quality checks must fail closed; fail-open is unsafe'; END IF;

  IF has_function_privilege('authenticated','public.buklod_award_rule_mapped_points_v1(uuid,text,text,uuid,text,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.buklod_payout_daily_bible_rewards_v1(uuid,uuid,uuid,text,date,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.record_member_lesson_completion(uuid,uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.review_daily_bible_reflection_quality_v2(uuid,boolean,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.pastor_validate_learning_progress_v2(uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.admin_review_daily_bible_submission(uuid,boolean,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.buklod_review_scope_formation_approval_core_r22b(uuid,boolean,text)','EXECUTE')
    OR has_function_privilege('anon','public.review_daily_bible_reflection_quality_v2(uuid,boolean,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Legacy human-review or points-issuing RPC is callable by public/learner'; END IF;

  IF NOT has_function_privilege('service_role','public.buklod_finalize_auto_formation_v1(uuid,text,uuid,uuid,boolean,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.buklod_award_rule_mapped_points_v1(uuid,text,text,uuid,text,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Service-role automatic finalization/payout is unexpectedly blocked'; END IF;

  v_definition:=pg_get_functiondef('public.buklod_try_auto_approve_lesson_v2(uuid)'::regprocedure);
  IF position('buklod_lesson_ai_auto_approval_ready_v1' in v_definition)=0
     OR position('buklod_record_lesson_completion_exact_scope_v2' in v_definition)=0
     OR position('request.jwt.claim.sub' in v_definition)>0
  THEN RAISE EXCEPTION 'Lesson auto approval is still reviewer-impersonated or missing verified gating'; END IF;

  v_definition:=pg_get_functiondef('public.reviewer_get_daily_bible_monitor_v3(uuid)'::regprocedure);
  IF position('false::boolean as reviewer_can_act' in v_definition)=0
  THEN RAISE EXCEPTION 'Daily Reading monitor still authorizes manual actions'; END IF;

  IF public.buklod_auto_reflection_quality_eligible_v3('00000000-0000-4000-8000-000000000000'::uuid)
  THEN RAISE EXCEPTION 'Nonexistent reflection must not qualify for points'; END IF;

  -- Detect over-credit, even on repeat/duplicate processing and rejections.
  SELECT count(*) INTO v_count
  FROM (
    SELECT l.user_id,l.source_id,
      sum(case when l.direction='credit' then l.points else -l.points end) as net_points
    FROM public.buklod_points_ledger l
    WHERE l.activity_type='reflection_quality_bonus'
    GROUP BY l.user_id,l.source_id
  ) ledger
  LEFT JOIN public.buklod_point_rules rule
    ON rule.activity_type='reflection_quality_bonus' AND rule.is_active=true
  WHERE ledger.net_points > greatest(coalesce(rule.base_points,0),0)
     OR ledger.net_points < 0;
  IF v_count<>0 THEN RAISE EXCEPTION 'Reflection quality bonus ledger has duplicate/negative net awards'; END IF;

  SELECT count(*) INTO v_count
  FROM public.buklod_points_ledger l
  WHERE l.activity_type='reflection_quality_bonus'
    AND l.direction='credit'
    AND NOT public.buklod_auto_reflection_quality_eligible_v3(l.source_id);
  IF v_count<>0 THEN RAISE EXCEPTION 'Unqualified AI attempts received a reflection quality bonus'; END IF;

  SELECT count(*) INTO v_count
  FROM public.daily_bible_submissions s
  WHERE public.buklod_auto_reflection_quality_eligible_v3(s.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.buklod_points_ledger l
      WHERE l.activity_type='reflection_quality_bonus'
        AND l.source_id=s.id AND l.direction='credit'
    );
  IF v_count<>0 THEN RAISE EXCEPTION 'Eligible AI-approved reflection has no issued bonus'; END IF;

  -- R5 compatibility: older clients can save enrollment-bound lesson drafts,
  -- but the finalization helper still requires five independent Gemini checks.
  v_definition:=pg_get_functiondef(
    'public.submit_learning_lesson_response_v1(uuid,uuid,jsonb,text)'::regprocedure);
  IF position('assert_buklod_response_validated_v1' in v_definition)>0
    OR position('enrollment_user <> actor' in v_definition)=0
    OR position('jsonb_array_length(p_question_answers) <> 4' in v_definition)=0
  THEN RAISE EXCEPTION 'Lesson draft capture lost auth/completeness or still blocks old clients'; END IF;

  v_definition:=pg_get_functiondef(
    'public.save_my_formation_lesson_study(uuid,uuid,text)'::regprocedure);
  IF position('assert_buklod_response_validated_v1' in v_definition)>0
    OR position('enrollment_record.id is null' in v_definition)=0
  THEN RAISE EXCEPTION 'Formation study drafts are blocked or enrollment protection was lost'; END IF;

  -- R4 regression: production must not accept legacy rule-v1 lesson scores
  -- for new automatic point awards, even if the score previously passed.
  IF position('buklod_lesson_ai_answer_checked_v3'
      IN pg_get_functiondef('public.buklod_lesson_ai_auto_approval_ready_v1(uuid,uuid)'::regprocedure))=0
     OR position('buklod_try_auto_approve_lesson_v2(v_approval_id)'
      IN pg_get_functiondef('public.submit_my_formation_lesson_for_validation_v1(uuid,uuid)'::regprocedure))=0
     OR position('buklod_lesson_ai_answer_checked_v3'
      IN pg_get_functiondef('public.assert_buklod_response_validated_v1(text,text)'::regprocedure))=0
  THEN RAISE EXCEPTION 'Lesson submission still allows non-Gemini validation or old auto-approver'; END IF;

  SELECT count(*) INTO v_count FROM (
    SELECT a.user_id,a.question_id,a.response_snapshot
    FROM public.buklod_ai_validation_attempts a
    WHERE a.module='lesson' AND a.model='rule-v1' AND a.status='acceptable'
    ORDER BY a.created_at DESC LIMIT 10
  ) legacy
  WHERE public.buklod_lesson_ai_answer_checked_v3(
    legacy.question_id,legacy.response_snapshot,legacy.user_id
  ) = true;
  IF v_count<>0 THEN
    RAISE EXCEPTION 'Legacy rule-v1 lesson answers are incorrectly accepted for new points';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.buklod_scope_formation_approvals_v2 a
  WHERE a.item_kind IN ('DAILY_READING','DAILY_DEVOTION')
    AND a.status='APPROVED' AND a.approver_id IS NOT NULL
    AND a.created_at >= now()-interval '3 days';
  IF v_count<>0 THEN RAISE EXCEPTION 'Recent reflection approvals incorrectly attribute a human approver'; END IF;
END;
$test$;

ROLLBACK;
