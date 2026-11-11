-- Read-only security regression: KL trigger functions must never be callable as user RPCs.
DO $guard$ BEGIN
 IF has_function_privilege('anon','public.kl_quiz_sync_approval_v1()','EXECUTE') OR has_function_privilege('authenticated','public.kl_quiz_sync_approval_v1()','EXECUTE') OR has_function_privilege('anon','public.kl_quiz_release_ready_guard_v1()','EXECUTE') OR has_function_privilege('authenticated','public.kl_quiz_release_ready_guard_v1()','EXECUTE') THEN
  RAISE EXCEPTION 'KL security trigger is publicly callable';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.kl_episodes'::regclass AND tgname='kl_quiz_sync_approval_trigger' AND tgenabled<>'D') OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.kl_episodes'::regclass AND tgname='kl_quiz_release_guard_trigger' AND tgenabled<>'D') THEN
  RAISE EXCEPTION 'Required KL approval/release trigger is disabled';
 END IF;
END $guard$;
