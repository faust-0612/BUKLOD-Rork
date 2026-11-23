-- Read-only KL quiz safety regression: failover may not weaken SQL-side chapter/answer gates.
DO $quiz_guard$
BEGIN
  IF to_regprocedure('public.kl_quiz_admin_context_v1(uuid)') IS NULL
     OR to_regprocedure('public.kl_quiz_store_generated_v1(uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Required KL admin quiz validation RPC missing';
  END IF;
  IF has_function_privilege('anon', 'public.kl_quiz_admin_context_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.kl_quiz_store_generated_v1(uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'KL answer generation is exposed anonymously';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.kl_quiz_admin_context_v1(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.kl_quiz_store_generated_v1(uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'KL authenticated admin RPC is no longer available';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.kl_episodes'::regclass
      AND tgname = 'kl_quiz_sync_approval_trigger' AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'KL manuscript-edit invalidation trigger is disabled';
  END IF;
END $quiz_guard$;
