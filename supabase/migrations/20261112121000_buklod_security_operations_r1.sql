-- BUKLOD Security Operations R1. Private-only telemetry + admin containment.
-- No account bans, media changes, settlement activation, or automatic restore.
CREATE TABLE IF NOT EXISTS private.buklod_security_control_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  finance_hold_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  change_reason text
);
CREATE TABLE IF NOT EXISTS private.buklod_security_findings_v1 (
  signal_key text PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('P0','P1','P2')),
  status text NOT NULL CHECK (status IN ('ACTIVE','CLEARED')),
  observed_count integer NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz
);
CREATE TABLE IF NOT EXISTS private.buklod_security_action_audit_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action_key uuid NOT NULL UNIQUE,
  action_type text NOT NULL CHECK (action_type IN ('FINANCE_HOLD_ENABLED','FINANCE_HOLD_RELEASED')),
  actor_user_id uuid NOT NULL,
  reason text NOT NULL,
  previous_version integer NOT NULL,
  new_version integer NOT NULL,
  release_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS private.buklod_security_scan_state_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  scanned_at timestamptz,
  scan_count bigint NOT NULL DEFAULT 0,
  auth_audit_entries_24h bigint NOT NULL DEFAULT 0
);
ALTER TABLE private.buklod_security_control_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.buklod_security_findings_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.buklod_security_action_audit_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.buklod_security_scan_state_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.buklod_security_control_v1,private.buklod_security_findings_v1,
  private.buklod_security_action_audit_v1,private.buklod_security_scan_state_v1
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE private.buklod_security_action_audit_v1_id_seq FROM PUBLIC,anon,authenticated;
INSERT INTO private.buklod_security_control_v1(singleton) VALUES(true)
ON CONFLICT(singleton) DO NOTHING;
INSERT INTO private.buklod_security_scan_state_v1(singleton) VALUES(true)
ON CONFLICT(singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION private.buklod_security_deny_audit_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  RAISE EXCEPTION 'Security action audit is immutable' USING ERRCODE='42501';
END;$$;
REVOKE ALL ON FUNCTION private.buklod_security_deny_audit_mutation_v1()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS buklod_security_action_immutable_v1 ON private.buklod_security_action_audit_v1;
CREATE TRIGGER buklod_security_action_immutable_v1 BEFORE UPDATE OR DELETE
ON private.buklod_security_action_audit_v1 FOR EACH ROW
EXECUTE FUNCTION private.buklod_security_deny_audit_mutation_v1();

-- Every existing finance RPC (including old clients) is subject to this
-- trigger when attempting to enable Canonical Finance V3 money switches.
CREATE OR REPLACE FUNCTION private.buklod_security_guard_finance_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM private.buklod_security_control_v1
            WHERE singleton=true AND finance_hold_enabled)
     AND (coalesce(NEW.economics_enabled,false)
      OR coalesce(NEW.settlement_enabled,false)
      OR coalesce(NEW.withdrawal_enabled,false)
      OR coalesce(NEW.payout_processing_enabled,false)) THEN
    RAISE EXCEPTION 'BUKLOD emergency finance hold: Finance V3 remains disabled'
    USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.buklod_security_guard_finance_v1()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS buklod_security_finance_guard_v1 ON private.buklod_pf_config;
CREATE TRIGGER buklod_security_finance_guard_v1 BEFORE INSERT OR UPDATE
ON private.buklod_pf_config FOR EACH ROW
EXECUTE FUNCTION private.buklod_security_guard_finance_v1();

CREATE OR REPLACE FUNCTION private.buklod_security_signal_v1(p_key text,p_severity text,p_count integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF p_count>0 THEN
    INSERT INTO private.buklod_security_findings_v1(signal_key,severity,status,observed_count)
    VALUES(p_key,p_severity,'ACTIVE',p_count)
    ON CONFLICT(signal_key) DO UPDATE SET
      severity=EXCLUDED.severity,status='ACTIVE',observed_count=EXCLUDED.observed_count,
      last_seen_at=now(),cleared_at=NULL;
  ELSE
    UPDATE private.buklod_security_findings_v1 SET
      status='CLEARED',observed_count=0,cleared_at=now(),last_seen_at=now()
      WHERE signal_key=p_key AND status='ACTIVE';
  END IF;
END;$$;
REVOKE ALL ON FUNCTION private.buklod_security_signal_v1(text,text,integer)
FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.buklod_security_scan_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
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

  SELECT count(*)::integer INTO v_count FROM private.buklod_backend_capacity_alert_state_v2
    WHERE upper(coalesce(level,'')) IN ('CRITICAL','P0');
  PERFORM private.buklod_security_signal_v1('BACKEND_CAPACITY_CRITICAL','P1',v_count);

  -- Presence is not proof of complete login coverage; absence is never 'safe'.
  SELECT count(*) INTO v_auth FROM auth.audit_log_entries
    WHERE created_at >= now()-interval '24 hours';
  INSERT INTO private.buklod_security_scan_state_v1
    (singleton,scanned_at,scan_count,auth_audit_entries_24h)
  VALUES(true,now(),1,v_auth)
  ON CONFLICT(singleton) DO UPDATE SET
    scanned_at=EXCLUDED.scanned_at,
    scan_count=private.buklod_security_scan_state_v1.scan_count+1,
    auth_audit_entries_24h=EXCLUDED.auth_audit_entries_24h;
END;$$;
REVOKE ALL ON FUNCTION private.buklod_security_scan_v1() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.buklod_admin_security_overview_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_state private.buklod_security_control_v1%rowtype;
  v_scan private.buklod_security_scan_state_v1%rowtype;
  v_fin private.buklod_pf_config%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_state FROM private.buklod_security_control_v1 WHERE singleton=true;
  SELECT * INTO v_scan FROM private.buklod_security_scan_state_v1 WHERE singleton=true;
  SELECT * INTO v_fin FROM private.buklod_pf_config WHERE singleton=true;
  RETURN pg_catalog.jsonb_build_object(
    'finance_hold',coalesce(v_state.finance_hold_enabled,false),
    'control_version',v_state.version,
    'changed_at',v_state.changed_at,
    'scan_at',v_scan.scanned_at,
    'scan_count',coalesce(v_scan.scan_count,0),
    'auth_audit_rows_24h',coalesce(v_scan.auth_audit_entries_24h,0),
    'auth_audit_coverage',CASE WHEN v_scan.auth_audit_entries_24h>0 THEN 'EVENTS_PRESENT' ELSE 'UNVERIFIED' END,
    'finance',pg_catalog.jsonb_build_object(
      'economics',coalesce(v_fin.economics_enabled,false),
      'settlement',coalesce(v_fin.settlement_enabled,false),
      'withdrawal',coalesce(v_fin.withdrawal_enabled,false),
      'payout_processing',coalesce(v_fin.payout_processing_enabled,false)),
    'findings',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'key',f.signal_key,'severity',f.severity,'status',f.status,
      'count',f.observed_count,'last_seen_at',f.last_seen_at) ORDER BY f.severity,f.signal_key)
      FROM private.buklod_security_findings_v1 f WHERE f.status='ACTIVE'),'[]'::jsonb),
    'last_actions',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'action',a.action_type,'at',a.created_at,'version',a.new_version)
      ORDER BY a.created_at DESC)
      FROM (SELECT action_type,created_at,new_version
            FROM private.buklod_security_action_audit_v1
            ORDER BY id DESC LIMIT 8) a),'[]'::jsonb)
  );
END;$$;
REVOKE ALL ON FUNCTION public.buklod_admin_security_overview_v1()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_admin_security_overview_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_admin_security_scan_now_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin required' USING ERRCODE='42501';
  END IF;
  PERFORM private.buklod_security_scan_v1();
  RETURN public.buklod_admin_security_overview_v1();
END;$$;
REVOKE ALL ON FUNCTION public.buklod_admin_security_scan_now_v1()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_admin_security_scan_now_v1() TO authenticated;

-- System Admin only. Enable hold immediately disables all canonical money
-- switches; release requires AAL2 and documented independent restore evidence.
-- Release never re-enables earnings, withdrawals, settlement or payouts.
CREATE OR REPLACE FUNCTION public.buklod_admin_security_finance_hold_v1(
  p_enable boolean,p_expected_version integer,p_reason text,
  p_confirmation text,p_action_key uuid,p_recovery_evidence jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_state private.buklod_security_control_v1%rowtype;
  v_reason text:=pg_catalog.btrim(coalesce(p_reason,''));
  v_aal text:=coalesce(auth.jwt()->>'aal','');
BEGIN
  IF v_actor IS NULL OR NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin required' USING ERRCODE='42501';
  END IF;
  IF p_enable IS NULL OR p_action_key IS NULL
     OR length(v_reason)<20 OR length(v_reason)>500 THEN
    RAISE EXCEPTION 'Explicit action key and 20-500 character reason required'
    USING ERRCODE='22023';
  END IF;
  IF p_confirmation IS DISTINCT FROM
      (CASE WHEN p_enable THEN 'HOLD BUKLOD FINANCE' ELSE 'RELEASE BUKLOD FINANCE' END) THEN
    RAISE EXCEPTION 'Typed confirmation does not match the requested action'
    USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM private.buklod_security_action_audit_v1
            WHERE action_key=p_action_key) THEN
    RETURN public.buklod_admin_security_overview_v1();
  END IF;
  SELECT * INTO v_state FROM private.buklod_security_control_v1
    WHERE singleton=true FOR UPDATE;
  IF v_state.version IS DISTINCT FROM p_expected_version
     OR v_state.finance_hold_enabled=p_enable THEN
    RAISE EXCEPTION 'Stale or unchanged finance hold. Refresh and retry.'
    USING ERRCODE='40001';
  END IF;
  IF NOT p_enable THEN
    IF v_aal<>'aal2' THEN
      RAISE EXCEPTION 'MFA AAL2 required to release emergency finance hold'
      USING ERRCODE='42501';
    END IF;
    IF coalesce(p_recovery_evidence->>'backup_verified','')<>'true'
       OR coalesce(p_recovery_evidence->>'admin_sessions_reviewed','')<>'true'
       OR coalesce(p_recovery_evidence->>'api_security_checked','')<>'true'
       OR coalesce(p_recovery_evidence->>'finance_reconciled','')<>'true'
       OR coalesce(p_recovery_evidence->>'release_sha','') !~ '^[0-9a-f]{40}$'
       OR length(coalesce(p_recovery_evidence->>'evidence_reference',''))<12 THEN
      RAISE EXCEPTION 'Independent restore checks and exact release SHA required'
      USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE private.buklod_security_control_v1 SET
    finance_hold_enabled=p_enable,version=version+1,
    changed_at=now(),changed_by=v_actor,change_reason=v_reason
    WHERE singleton=true;
  IF p_enable THEN
    UPDATE private.buklod_pf_config SET
      economics_enabled=false,settlement_enabled=false,
      withdrawal_enabled=false,payout_processing_enabled=false,
      updated_by=v_actor,updated_at=now()
    WHERE singleton=true;
  END IF;
  INSERT INTO private.buklod_security_action_audit_v1
    (action_key,action_type,actor_user_id,reason,previous_version,new_version,release_evidence)
  VALUES(p_action_key,
    CASE WHEN p_enable THEN 'FINANCE_HOLD_ENABLED' ELSE 'FINANCE_HOLD_RELEASED' END,
    v_actor,v_reason,v_state.version,v_state.version+1,
    CASE WHEN p_enable THEN '{}'::jsonb ELSE p_recovery_evidence END);
  RETURN public.buklod_admin_security_overview_v1();
END;$$;
REVOKE ALL ON FUNCTION public.buklod_admin_security_finance_hold_v1(
  boolean,integer,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_admin_security_finance_hold_v1(
  boolean,integer,text,text,uuid,jsonb) TO authenticated;

-- Supabase pg_cron (already installed); no Edge/HTTP billing, no new secrets.
SELECT cron.schedule('buklod-security-scan-r1','*/15 * * * *',
  'select private.buklod_security_scan_v1()');
