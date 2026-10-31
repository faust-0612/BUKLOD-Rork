-- Read-only verification after the additive migration is installed.
DO $test$
DECLARE
  v_fn oid := to_regprocedure('public.get_my_buklod_community_qmp_history_v1()');
  v_def text;
BEGIN
  IF v_fn IS NULL THEN RAISE EXCEPTION 'Lifetime QMP RPC missing'; END IF;
  IF has_function_privilege('anon', v_fn, 'EXECUTE')
      OR has_function_privilege('public', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'Lifetime QMP RPC is exposed to unauthenticated users';
  END IF;
  IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated members cannot read their own QMP history';
  END IF;
  v_def := pg_get_functiondef(v_fn);
  IF position('a.user_id = v_actor' in v_def) = 0
     OR position('auth.uid()' in v_def) = 0 THEN
    RAISE EXCEPTION 'Lifetime QMP must be caller-scoped';
  END IF;
END;
$test$;
