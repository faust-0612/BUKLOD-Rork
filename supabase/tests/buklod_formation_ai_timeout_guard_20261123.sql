-- BUKLOD KL timeout recovery: source-backed approval/points must fail closed.
-- Read-only behavioral contract inspection of the deployed database functions.
DO $test$
DECLARE
  v_check text;
  v_complete text;
BEGIN
  v_check := pg_catalog.pg_get_functiondef(
    'public.buklod_lesson_ai_answer_checked_v3(text,text,uuid)'::regprocedure
  );
  v_complete := pg_catalog.pg_get_functiondef(
    'public.complete_my_formation_lesson_v2(uuid,uuid,jsonb,text)'::regprocedure
  );
  IF position('a.user_id=p_user_id' in v_check) = 0
     OR position('a.answer_hash=v_hash' in v_check) = 0
     OR position('coalesce(v_attempt.fail_open,true) <> false' in v_check) = 0
     OR position('NOT LIKE ''gemini-%''' in v_check) = 0
     OR position('serverVerifiedContentHash' in v_check) = 0
     OR position('v_attempt.created_at < greatest(' in v_check) = 0
  THEN
    RAISE EXCEPTION 'KL lesson AI approval must require fresh account-bound Gemini source proof';
  END IF;
  IF position('submit_learning_lesson_response_v1' in v_complete) = 0
     OR position('submit_my_formation_lesson_for_validation_v1' in v_complete) = 0
  THEN
    RAISE EXCEPTION 'KL lesson completion must keep draft and official validation distinct';
  END IF;
END
$test$;
