-- BUKLOD MAIN non-Season2 security monitoring R2.
-- Add regression detection for privileged internal helper EXECUTE grants and
-- an explicit warning when database Auth audit time-window cannot be read safely.
-- Preserve existing 15-minute scan job, private RLS, audit immutability, finance
-- hold and money switches, and existing one-alert-per-episode deduplication.
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

  -- Alert if untrusted clients regain direct access to internal role helpers.
  SELECT count(*)::integer INTO v_count
  FROM (VALUES
    ('public.buklod_church_ensure_membership_v1(uuid,uuid)'),
    ('public.buklod_church_ensure_role_key_v1(uuid,uuid,text)'),
    ('public.buklod_church_ensure_provisional_admin_v1(uuid,uuid)'),
    ('public.buklod_church_ensure_scoped_leader_v1(uuid,uuid,text)'),
    ('public.buklod_sync_local_memberships(uuid)')
  ) AS guarded(signature)
  WHERE pg_catalog.to_regprocedure(guarded.signature) IS NOT NULL
    AND (
      pg_catalog.has_function_privilege(
        'anon',pg_catalog.to_regprocedure(guarded.signature),'EXECUTE'
      ) OR pg_catalog.has_function_privilege(
        'authenticated',pg_catalog.to_regprocedure(guarded.signature),'EXECUTE'
      )
    );
  PERFORM private.buklod_security_signal_v1(
    'INTERNAL_ROLE_HELPER_CLIENT_EXECUTE','P1',v_count
  );

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
  -- The managed Auth audit table lacks a created_at index. Skipped
  -- database queries are never evidence of zero login activity.
  SELECT count(*)::integer INTO v_count FROM pg_catalog.pg_indexes
  WHERE schemaname='auth' AND tablename='audit_log_entries'
    AND indexdef ILIKE '%created_at%';
  PERFORM private.buklod_security_signal_v1(
    'AUTH_AUDIT_DB_WINDOW_UNVERIFIED','P2',
    CASE WHEN v_count=0 THEN 1 ELSE 0 END
  );

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

REVOKE ALL ON FUNCTION private.buklod_security_scan_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.buklod_security_scan_v1() TO service_role;
