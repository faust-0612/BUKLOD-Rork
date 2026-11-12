-- Read-only production post-deploy security gate.
DO $security_r1_gate$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM private.buklod_security_control_v1 WHERE singleton) THEN
    RAISE EXCEPTION 'BUKLOD security control singleton missing';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class WHERE oid='private.buklod_security_control_v1'::regclass AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'BUKLOD security control RLS missing';
  END IF;
  IF has_table_privilege('anon','private.buklod_security_control_v1','SELECT')
     OR has_table_privilege('authenticated','private.buklod_security_action_audit_v1','SELECT')
     OR has_table_privilege('anon','private.buklod_security_findings_v1','INSERT') THEN
    RAISE EXCEPTION 'BUKLOD private security tables exposed';
  END IF;
  IF has_function_privilege('anon','public.buklod_admin_security_overview_v1()','EXECUTE')
     OR has_function_privilege('anon','public.buklod_admin_security_scan_now_v1()','EXECUTE')
     OR has_function_privilege('anon',
      'public.buklod_admin_security_finance_hold_v1(boolean,integer,text,text,uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'BUKLOD security RPC anonymous access';
  END IF;
  IF NOT has_function_privilege('authenticated','public.buklod_admin_security_overview_v1()','EXECUTE') THEN
    RAISE EXCEPTION 'BUKLOD authenticated admin view unavailable';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='private.buklod_pf_config'::regclass
     AND tgname='buklod_security_finance_guard_v1' AND tgenabled='O') THEN
    RAISE EXCEPTION 'BUKLOD finance hold trigger missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='private.buklod_security_action_audit_v1'::regclass
     AND tgname='buklod_security_action_immutable_v1' AND tgenabled='O') THEN
    RAISE EXCEPTION 'BUKLOD immutable action audit missing';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='buklod-security-scan-r1' AND active) THEN
    RAISE EXCEPTION 'BUKLOD security scan scheduler missing';
  END IF;
END;
$security_r1_gate$;
