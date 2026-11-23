-- Execute read-only ONLY on an isolated Season 2 staging database after installing
-- 20261123203000_kl_s2_series_dashboard_catalog.sql. Never on production.
DO $verify$
DECLARE v_source text;
BEGIN
  IF to_regclass('private.kl_s2_series_metadata') IS NULL
     OR to_regprocedure('public.kl_s2_admin_save_series_v1(integer,text,text)') IS NULL
     OR to_regprocedure('public.kl_s2_admin_series_catalog_v1()') IS NULL
     OR to_regprocedure('public.kl_s2_reader_series_catalog_v1()') IS NULL THEN
    RAISE EXCEPTION 'KL series metadata / RPC migration missing';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c
     WHERE c.oid='private.kl_s2_series_metadata'::regclass)
     OR has_table_privilege('anon','private.kl_s2_series_metadata','SELECT')
     OR has_table_privilege('authenticated','private.kl_s2_series_metadata','SELECT')
     OR has_table_privilege('authenticated','private.kl_s2_series_metadata','INSERT')
     OR has_table_privilege('authenticated','private.kl_s2_series_metadata','UPDATE') THEN
    RAISE EXCEPTION 'Series editorial metadata is exposed to public clients';
  END IF;
  IF has_function_privilege('anon','public.kl_s2_admin_save_series_v1(integer,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.kl_s2_admin_series_catalog_v1()','EXECUTE')
     OR NOT has_function_privilege('anon','public.kl_s2_reader_series_catalog_v1()','EXECUTE') THEN
    RAISE EXCEPTION 'KL series RPC access grants are incorrect';
  END IF;
  SELECT pg_get_functiondef('public.kl_s2_reader_series_catalog_v1()'::regprocedure)
    INTO v_source;
  IF position('status' IN v_source)=0
     OR position('approved_at' IN v_source)=0
     OR position('release_at' IN v_source)=0
     OR position('kl_s2_series_metadata' IN v_source)=0
     OR position('manuscript' IN v_source)>0
     OR position('storage_path' IN v_source)>0 THEN
    RAISE EXCEPTION 'KL reader series catalog publication filter or privacy guard missing';
  END IF;
  SELECT pg_get_functiondef('public.kl_s2_admin_save_series_v1(integer,text,text)'::regprocedure)
    INTO v_source;
  IF position('system_admin' IN v_source)=0
     OR position('is_active' IN v_source)=0
     OR position('auth.uid()' IN v_source)=0 THEN
    RAISE EXCEPTION 'Admin series metadata write role guard missing';
  END IF;
END
$verify$;
