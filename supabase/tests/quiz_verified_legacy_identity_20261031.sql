-- Read-only behavioral database contract for BUKLOD Quiz legacy identity resolution.
-- Safe on the dedicated Quiz DB: no user, exam, roster, grade or attempt mutation.
DO $quiz_legacy_identity_test$
DECLARE
  v_id uuid;
  v_email text;
  v_other_id uuid := gen_random_uuid();
  v_result jsonb;
  v_before bigint;
  v_after bigint;
BEGIN
  IF has_function_privilege('anon',
       'public.buklod_quiz_ensure_main_shadow_user_v1(uuid,text,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.buklod_quiz_ensure_main_shadow_user_v1(uuid,text,jsonb)','EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.buklod_quiz_ensure_main_shadow_user_v1(uuid,text,jsonb)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Quiz identity provision RPC must remain service-role-only';
  END IF;

  SELECT id,email INTO v_id,v_email FROM auth.users
  WHERE email_confirmed_at IS NOT NULL
    AND is_sso_user=false AND is_anonymous=false
    AND (banned_until IS NULL OR banned_until <= now())
    AND raw_app_meta_data->>'buklod_main_user_id' IS NULL
    AND email IS NOT NULL
  ORDER BY created_at LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No safe verified fixture for legacy Quiz identity contract';
  END IF;
  SELECT count(*) INTO v_before FROM auth.users;
  SELECT public.buklod_quiz_ensure_main_shadow_user_v1(
    v_other_id,v_email,'{}'::jsonb
  ) INTO v_result;
  IF v_result->>'ok' <> 'true'
    OR v_result->>'user_id' <> v_id::text
    OR v_result->>'legacy_existing' <> 'true'
    OR v_result->>'created' <> 'false'
  THEN
    RAISE EXCEPTION 'Verified legacy Quiz UUID was not preserved';
  END IF;

  SELECT public.buklod_quiz_ensure_main_shadow_user_v1(
    v_id,v_email,'{}'::jsonb
  ) INTO v_result;
  IF v_result->>'ok' <> 'true'
    OR v_result->>'user_id' <> v_id::text
    OR v_result->>'created' <> 'false'
  THEN
    RAISE EXCEPTION 'Ordinary matching-UUID Quiz identity regressed';
  END IF;

  SELECT count(*) INTO v_after FROM auth.users;
  IF v_before <> v_after THEN
    RAISE EXCEPTION 'Legacy lookup unexpectedly changed auth user count';
  END IF;
END;
$quiz_legacy_identity_test$;
