-- Read-only KL generation security contract. Safe against the live database.
-- The Edge generator may change models, but RPC access and question keys remain private.
DO $kl_security$ BEGIN
  IF to_regprocedure('public.kl_quiz_admin_context_v1(uuid)') IS NULL
     OR to_regprocedure('public.kl_quiz_store_generated_v1(uuid,text,jsonb)') IS NULL
     OR to_regprocedure('public.kl_quiz_begin_v1(uuid)') IS NULL
     OR to_regprocedure('public.kl_quiz_submit_v1(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Required KL quiz RPC missing';
  END IF;
  IF has_function_privilege('anon','public.kl_quiz_admin_context_v1(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.kl_quiz_store_generated_v1(uuid,text,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.kl_quiz_begin_v1(uuid)','EXECUTE')
     OR has_function_privilege('anon','public.kl_quiz_submit_v1(uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous caller can execute protected KL quiz RPC';
  END IF;
  IF has_table_privilege('authenticated','public.kl_quiz_questions','SELECT')
     OR has_table_privilege('anon','public.kl_quiz_questions','SELECT')
     OR has_table_privilege('authenticated','public.kl_quiz_attempts','SELECT')
     OR has_table_privilege('anon','public.kl_quiz_attempts','SELECT') THEN
    RAISE EXCEPTION 'Protected KL question keys or attempts exposed to the Data API';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid IN ('public.kl_quiz_questions'::regclass,
                  'public.kl_quiz_attempts'::regclass,
                  'public.kl_quiz_sets'::regclass)
      AND NOT relrowsecurity
  ) THEN
    RAISE EXCEPTION 'KL question or attempt row-level security disabled';
  END IF;
END $kl_security$;
