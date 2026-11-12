-- BUKLOD dedicated Quiz post-deploy read-only privilege guard.
DO $post$
DECLARE c integer;
BEGIN
  SELECT count(*)::integer INTO c
  FROM pg_catalog.pg_class cl
  JOIN pg_catalog.pg_namespace n ON n.oid=cl.relnamespace
  WHERE n.nspname='public' AND cl.relkind IN ('r','p')
    AND (pg_catalog.has_table_privilege('anon',cl.oid,'TRUNCATE')
      OR pg_catalog.has_table_privilege('anon',cl.oid,'TRIGGER')
      OR pg_catalog.has_table_privilege('anon',cl.oid,'REFERENCES')
      OR pg_catalog.has_table_privilege('authenticated',cl.oid,'TRUNCATE')
      OR pg_catalog.has_table_privilege('authenticated',cl.oid,'TRIGGER')
      OR pg_catalog.has_table_privilege('authenticated',cl.oid,'REFERENCES'));
  IF c<>0 THEN RAISE EXCEPTION 'Quiz public RLS bypass grants remain: %',c; END IF;
  IF NOT pg_catalog.has_function_privilege('anon','public.buklod_quiz_resolve_login_identifier_v1(text)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.buklod_quiz_save_answer_v1(uuid,uuid,jsonb)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('anon','public.buklod_quiz_save_answer_v2(uuid,uuid,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Quiz login/answer RPC grant regression';
  END IF;
END;$post$;