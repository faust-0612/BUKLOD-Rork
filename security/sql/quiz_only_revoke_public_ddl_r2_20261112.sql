-- BUKLOD QUIZ DEDICATED SUPABASE ONLY: cjtehbfspgimyhifnjon
-- DO NOT APPLY TO BUKLOD MAIN. Kept outside supabase/migrations to avoid
-- accidental wrong-project execution by the canonical Main migration runner.
-- Preserve Quiz login, exam and answer RPCs, grading and historical records.
-- Fail closed if a maintainer points the Quiz-only SQL at BUKLOD Main.
DO $quiz_target$
BEGIN
  IF pg_catalog.to_regclass('public.buklod_quiz_attempts') IS NULL
      OR pg_catalog.to_regclass('public.buklod_quiz_responses') IS NULL
      OR pg_catalog.to_regclass('private.buklod_pf_config') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong target: dedicated BUKLOD Quiz Supabase required';
  END IF;
END;$quiz_target$;

DO $restrict$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT n.nspname AS schema_name,c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      v.schema_name,v.table_name
    );
  END LOOP;
END;$restrict$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM PUBLIC,anon,authenticated;
DO $gate$
DECLARE v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND (
      pg_catalog.has_table_privilege('anon',c.oid,'TRUNCATE')
      OR pg_catalog.has_table_privilege('anon',c.oid,'TRIGGER')
      OR pg_catalog.has_table_privilege('anon',c.oid,'REFERENCES')
      OR pg_catalog.has_table_privilege('authenticated',c.oid,'TRUNCATE')
      OR pg_catalog.has_table_privilege('authenticated',c.oid,'TRIGGER')
      OR pg_catalog.has_table_privilege('authenticated',c.oid,'REFERENCES')
    );
  IF v_count<>0 THEN RAISE EXCEPTION 'Quiz unsafe DDL access remains: %',v_count; END IF;
  IF NOT pg_catalog.has_function_privilege('anon',
       'public.buklod_quiz_resolve_login_identifier_v1(text)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated',
       'public.buklod_quiz_save_answer_v1(uuid,uuid,jsonb)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('anon',
       'public.buklod_quiz_save_answer_v2(uuid,uuid,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Quiz existing login/exam API ACL changed unexpectedly';
  END IF;
END;$gate$;