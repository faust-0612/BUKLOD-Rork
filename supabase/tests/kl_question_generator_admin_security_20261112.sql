-- Read-only KL generation security contract. Safe against the live database.
-- The Edge generator may change models, but RPC access and question keys remain private.
DO $kl_security$ BEGIN
  IF to_regprocedure('public.kl_quiz_admin_review_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Admin question review RPC missing';
  END IF;
  IF has_function_privilege('anon','public.kl_quiz_admin_review_v1(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Admin answer review exposed anonymously';
  END IF;
  IF position('role::text = ''system_admin'' AND is_active = true' in
      pg_get_functiondef('public.kl_quiz_admin_review_v1(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Admin question review lost active role authorization';
  END IF;
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

-- Provider failover must preserve server-side authorization, stale-hash rejection,
-- source validation and idempotency regardless of which model responded.
DO $kl_failover_security$
DECLARE
  context_def text := pg_get_functiondef('public.kl_quiz_admin_context_v1(uuid)'::regprocedure);
  store_def text := pg_get_functiondef('public.kl_quiz_store_generated_v1(uuid,text,jsonb)'::regprocedure);
BEGIN
  IF position('id=auth.uid() AND role::text=''system_admin'' AND is_active=true' in context_def)=0
     OR position('id=auth.uid() AND role::text=''system_admin'' AND is_active=true' in store_def)=0
     OR position('v.status<>''approved''' in context_def)=0
     OR position('v.approved_at IS NULL' in context_def)=0
     OR position('manuscript_hash=md5(v.manuscript)' in context_def)=0 THEN
    RAISE EXCEPTION 'KL failover must not bypass approved manuscript authorization';
  END IF;
  IF position('FOR UPDATE' in store_def)=0
     OR position('md5(v.manuscript)<>p_manuscript_hash' in store_def)=0
     OR position('jsonb_array_length(p_items)<>5' in store_def)=0
     OR position('position(v_e in v.manuscript)=0' in store_def)=0
     OR position('Correct answer must appear verbatim in the approved evidence' in store_def)=0
     OR position('status=''ready''' in store_def)=0
     OR position('''changed'',false' in store_def)=0
     OR position('''changed'',false' in store_def)>=position('DELETE FROM public.kl_quiz_questions' in store_def) THEN
    RAISE EXCEPTION 'KL failover must preserve locked hash, evidence, five-item and no-rewrite contracts';
  END IF;
END $kl_failover_security$;
