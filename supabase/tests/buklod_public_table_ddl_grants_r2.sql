-- BUKLOD least privilege R2 post-migration read-only verification.
-- RLS never authorizes TRUNCATE; app roles must not have this privilege.
DO $buklod_ddl_gate$
DECLARE v_unsafe integer;
BEGIN
  SELECT count(*)::integer INTO v_unsafe FROM pg_catalog.pg_class c
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
  IF v_unsafe<>0 THEN
    RAISE EXCEPTION 'Unsafe app role table DDL grants remain: %',v_unsafe;
  END IF;
  IF NOT pg_catalog.has_table_privilege('authenticated','public.notifications','UPDATE')
      OR NOT pg_catalog.has_table_privilege('authenticated','public.bayanihan_withdrawals','SELECT')
      OR NOT pg_catalog.has_table_privilege('service_role','public.bayanihan_withdrawals','TRUNCATE') THEN
    RAISE EXCEPTION 'Critical retained table privileges regressed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid='private.buklod_security_scan_v1()'::regprocedure
      AND pg_catalog.pg_get_functiondef(oid) LIKE '%PUBLIC_UNSAFE_DDL_GRANTS%'
  ) THEN
    RAISE EXCEPTION 'Future grant regression monitoring was not installed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_default_acl d,
      LATERAL pg_catalog.aclexplode(d.defaclacl) a
    WHERE d.defaclrole='postgres'::regrole
      AND d.defaclnamespace='public'::regnamespace
      AND d.defaclobjtype='r'
      AND a.grantee IN ('anon'::regrole,'authenticated'::regrole)
      AND a.privilege_type IN ('TRUNCATE','TRIGGER','REFERENCES')
  ) THEN
    RAISE EXCEPTION 'Postgres default grants still expose app roles to DDL';
  END IF;
END;
$buklod_ddl_gate$;
