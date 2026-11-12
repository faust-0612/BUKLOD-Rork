-- Security R2: deny unnecessary DDL-grade privileges to public app roles.
-- Note: these privileges are NOT part of the normal read/write HTTP API.
-- Preserve SELECT/INSERT/UPDATE/DELETE, service role rights and existing RLS.
DO $revoke$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      v.schema_name,v.table_name
    );
  END LOOP;
END;
$revoke$;
-- Protect new tables created by postgres. supabase_admin default ACL is
-- provider-owned and cannot be changed by this unprivileged connection;
-- the monitored detector will flag future granting.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION private.buklod_security_scan_v1()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_count integer;v_auth bigint;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(42102,20261112) THEN RETURN; END IF;

  SELECT count(*)::integer INTO v_count FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
  PERFORM private.buklod_security_signal_v1('PUBLIC_TABLE_WITHOUT_RLS','P0',v_count);

  SELECT count(*)::integer INTO v_count FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname LIKE 'admin\_%' ESCAPE '\'
      AND pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE');
  PERFORM private.buklod_security_signal_v1('ANON_ADMIN_PRIVILEGED_RPC','P1',v_count);

  SELECT count(*)::integer INTO v_count FROM private.buklod_r38_fraud_flags
    WHERE blocks_economics=true
      AND upper(coalesce(status,'')) NOT IN ('RESOLVED','DISMISSED','CLEARED','CLOSED');
  PERFORM private.buklod_security_signal_v1('FINANCE_BLOCKING_FRAUD','P1',v_count);

  SELECT count(*)::integer INTO v_count FROM public.bsoc_known_incidents_v1
    WHERE upper(severity::text)='P0'
      AND lower(status::text) NOT IN ('closed','resolved','accepted');
  PERFORM private.buklod_security_signal_v1('BSOC_P0_OPEN','P1',v_count);

  -- Existing capacity monitor emits NORMAL, WATCH and REVIEW, not just P0.
  SELECT count(*)::integer INTO v_count FROM private.buklod_backend_capacity_alert_state_v2
    WHERE upper(coalesce(level,''))='WATCH';
  PERFORM private.buklod_security_signal_v1('BACKEND_CAPACITY_WATCH','P2',v_count);

  SELECT count(*)::integer INTO v_count FROM private.buklod_backend_capacity_alert_state_v2
    WHERE upper(coalesce(level,'')) IN ('REVIEW','CRITICAL','P0');
  PERFORM private.buklod_security_signal_v1('BACKEND_CAPACITY_REVIEW','P1',v_count);


  -- In addition to RLS, protect against DDL-grade app role privileges
  -- (TRUNCATE is not constrained by RLS).
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
  PERFORM private.buklod_security_signal_v1('PUBLIC_UNSAFE_DDL_GRANTS','P1',v_count);

  -- Detection only: legitimate future finance activation is not automatically
  -- frozen, but any money-switch activation requires explicit incident review.
  SELECT count(*)::integer INTO v_count FROM private.buklod_pf_config
    WHERE coalesce(economics_enabled,false)
       OR coalesce(settlement_enabled,false)
       OR coalesce(withdrawal_enabled,false)
       OR coalesce(payout_processing_enabled,false);
  PERFORM private.buklod_security_signal_v1('FINANCE_MONEY_SWITCH_ACTIVE','P1',v_count);

  -- Presence is not proof of complete login coverage; absence is never 'safe'.
  -- Managed Auth table currently lacks an indexed created_at access path.
  -- Do not full-scan potentially millions of Auth rows every 15 minutes.
  -- Without a suitable index, leave coverage UNVERIFIED instead of guessing.
  v_auth:=0;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_indexes
            WHERE schemaname='auth' AND tablename='audit_log_entries'
              AND indexdef ILIKE '%created_at%') THEN
    SELECT count(*) INTO v_auth
      FROM (SELECT 1 FROM auth.audit_log_entries
            WHERE created_at>=now()-interval '24 hours' LIMIT 1000) bounded;
  END IF;
  INSERT INTO private.buklod_security_scan_state_v1
    (singleton,scanned_at,scan_count,auth_audit_entries_24h)
  VALUES(true,now(),1,v_auth)
  ON CONFLICT(singleton) DO UPDATE SET
    scanned_at=EXCLUDED.scanned_at,
    scan_count=private.buklod_security_scan_state_v1.scan_count+1,
    auth_audit_entries_24h=EXCLUDED.auth_audit_entries_24h;
END;$function$;
DO $verify$
DECLARE v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count
  FROM pg_catalog.pg_class c
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
  IF v_count<>0 THEN RAISE EXCEPTION 'R2 unsafe ACLs remain on % public tables',v_count; END IF;
  IF NOT pg_catalog.has_table_privilege('authenticated','public.notifications','UPDATE')
    OR NOT pg_catalog.has_table_privilege('authenticated','public.bayanihan_withdrawals','SELECT')
    OR NOT pg_catalog.has_table_privilege('service_role','public.bayanihan_withdrawals','TRUNCATE') THEN
      RAISE EXCEPTION 'Legitimate table service/read/update privileges unexpectedly changed';
  END IF;
END;
$verify$;