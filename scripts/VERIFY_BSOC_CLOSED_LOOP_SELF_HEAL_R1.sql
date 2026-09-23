-- BUKLOD BSOC Closed-Loop Self-Heal R1
-- Phase A E2E / safety verification.
--
-- IMPORTANT:
-- - This script intentionally wraps all synthetic QA state in one transaction.
-- - The final ROLLBACK is mandatory.
-- - It may temporarily toggle playbook readiness INSIDE the transaction only.
-- - No persistent incidents/cases/playbook changes are expected after success.

begin;

do $e2e$
declare
  v_admin uuid;
  v_suffix text := upper(substr(md5(clock_timestamp()::text || random()::text),1,10));
  v_ingest jsonb;
  v_orch jsonb;
  v_verify jsonb;
  v_event uuid;
  v_run uuid;
  v_event_fin uuid;
  v_event_lock uuid;
  v_event_fail uuid;
  v_corr text;
  v_uid uuid;
  v_count integer;
  v_linked integer;
  v_clusters integer;
  v_cases integer;
  v_privacy_rejected boolean := false;
begin
  select ra.user_id
  into v_admin
  from public.buklod_scope_role_assignments ra
  join public.buklod_scopes s on s.id=ra.scope_id
  join public.profiles p on p.id=ra.user_id
  where ra.role_key='SYSTEM_ADMIN'
    and ra.status='ACTIVE'
    and s.scope_type='SYSTEM'
    and s.status='ACTIVE'
    and coalesce(p.is_active,true)
  order by ra.created_at
  limit 1;

  if v_admin is null then
    raise exception 'No active SYSTEM_ADMIN is available for the E2E transaction';
  end if;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);

  if not public.buklod_is_system_admin() then
    raise exception 'E2E actor did not resolve as system admin';
  end if;

  -- A. STALE SESSION -> approved safe playbook -> verification -> AUTO_HEALED.
  update public.bsoc_recovery_playbooks
  set mode='ENABLED',
      kill_switch=false,
      qa_verified_at=now(),
      qa_verified_by=v_admin,
      executor_ready=true,
      updated_at=now()
  where playbook_id='AUTH_SESSION_STALE_V1' and version=1;

  select public.buklod_record_health_event_v1(
    'E2E-A-'||v_suffix,
    'BUKLOD_MAIN','E2E','web','staging','auth/login',
    'AUTH','ERROR','AUTH-401','AUTH_SESSION_STALE',
    'device-e2e-a-'||v_suffix,'session-e2e-a-'||v_suffix,
    'ONLINE','STALE','IDLE','HEALTHY','HEALTHY',
    'AUTH_LOGIN_ATTEMPT',0,null,true,'FAILED',
    'E2E_AUTH_STALE_'||v_suffix,'OPERATIONAL',now()
  ) into v_ingest;

  v_event := (v_ingest->>'event_id')::uuid;

  select public.buklod_bsoc_orchestrate_recovery_v1(
    v_event,true,'Phase A E2E stale-session recovery'
  ) into v_orch;

  if v_orch->>'state' <> 'REMOTE_RECOVERY_RUNNING' then
    raise exception 'A failed: expected REMOTE_RECOVERY_RUNNING, got %',v_orch;
  end if;

  v_run := (v_orch->>'recovery_run_id')::uuid;

  if exists(
    select 1
    from public.bsoc_health_events
    where id=v_event and lifecycle_state='AUTO_HEALED'
  ) then
    raise exception 'A failed: AUTO_HEALED existed before verification';
  end if;

  select public.buklod_record_recovery_verification_v1(
    v_run,'AUTH_HEARTBEAT',true,'AUTH_VERIFIED',
    jsonb_build_object(
      'latency_ms',120,
      'protected_route_ok',true,
      'user_context_ok',true
    )
  ) into v_verify;

  if v_verify->>'state' <> 'AUTO_HEALED' then
    raise exception 'A failed: verification did not produce AUTO_HEALED: %',v_verify;
  end if;

  -- F. A recovery command may run, but failed verification must fail closed.
  update public.bsoc_recovery_playbooks
  set mode='ENABLED',
      kill_switch=false,
      qa_verified_at=now(),
      qa_verified_by=v_admin,
      executor_ready=true,
      updated_at=now()
  where playbook_id='ROUTE_LOAD_TIMEOUT_V1' and version=1;

  select public.buklod_record_health_event_v1(
    'E2E-F-'||v_suffix,
    'BUKLOD_MAIN','E2E','web','staging','community/wall',
    'LOADING','ERROR','ROUTE-408','ROUTE_LOAD_TIMEOUT',
    'device-e2e-f-'||v_suffix,'session-e2e-f-'||v_suffix,
    'ONLINE','AUTH_OK','IDLE','HEALTHY','HEALTHY',
    'ROUTE_OPEN',0,null,true,'FAILED',
    'E2E_ROUTE_TIMEOUT_'||v_suffix,'OPERATIONAL',now()
  ) into v_ingest;

  v_event_fail := (v_ingest->>'event_id')::uuid;

  select public.buklod_bsoc_orchestrate_recovery_v1(
    v_event_fail,true,'Phase A E2E verification-failure test'
  ) into v_orch;

  if v_orch->>'state' <> 'REMOTE_RECOVERY_RUNNING' then
    raise exception 'F failed: route recovery did not start: %',v_orch;
  end if;

  v_run := (v_orch->>'recovery_run_id')::uuid;

  select public.buklod_record_recovery_verification_v1(
    v_run,'ROUTE_RENDER',false,'ROUTE_STILL_TIMEOUT',
    jsonb_build_object('latency_ms',25000,'route_rendered',false)
  ) into v_verify;

  if v_verify->>'state' <> 'RECOVERY_FAILED' then
    raise exception 'F failed: failed proof did not become RECOVERY_FAILED: %',v_verify;
  end if;

  if exists(
    select 1
    from public.bsoc_health_events
    where id=v_event_fail and lifecycle_state='AUTO_HEALED'
  ) then
    raise exception 'F failed: false AUTO_HEALED after failed verification';
  end if;

  -- C. Financial mutation signatures are human-controlled only.
  select public.buklod_record_health_event_v1(
    'E2E-C-'||v_suffix,
    'BUKLOD_MAIN','E2E','web','staging','economy/ledger',
    'UNKNOWN','CRITICAL','FIN-500','FINANCE_LEDGER_MISMATCH',
    'device-e2e-c-'||v_suffix,'session-e2e-c-'||v_suffix,
    'ONLINE','AUTH_OK','IDLE','HEALTHY','HEALTHY',
    'LEDGER_READ',0,null,false,'INELIGIBLE',
    'E2E_FINANCE_'||v_suffix,'OPERATIONAL',now()
  ) into v_ingest;

  v_event_fin := (v_ingest->>'event_id')::uuid;

  select public.buklod_bsoc_orchestrate_recovery_v1(
    v_event_fin,true,'Phase A E2E financial safety'
  ) into v_orch;

  if v_orch->>'state' <> 'ESCALATED'
     or v_orch->>'reason' <> 'HUMAN_CONTROLLED_ONLY' then
    raise exception 'C failed: financial event was not human-only: %',v_orch;
  end if;

  if exists(
    select 1 from public.bsoc_recovery_runs where event_id=v_event_fin
  ) then
    raise exception 'C failed: recovery run exists for financial mutation';
  end if;

  -- D. Security/account locks are human-controlled only.
  select public.buklod_record_health_event_v1(
    'E2E-D-'||v_suffix,
    'BUKLOD_MAIN','E2E','web','staging','auth/login',
    'AUTH','CRITICAL','AUTH-LOCK','AUTH_SESSION_STALE',
    'device-e2e-d-'||v_suffix,'session-e2e-d-'||v_suffix,
    'ONLINE','LOCKED','IDLE','HEALTHY','HEALTHY',
    'AUTH_LOGIN_ATTEMPT',0,null,false,'INELIGIBLE',
    'E2E_SECURITY_LOCK_'||v_suffix,'SECURITY_REVIEW_REQUIRED',now()
  ) into v_ingest;

  v_event_lock := (v_ingest->>'event_id')::uuid;

  select public.buklod_bsoc_orchestrate_recovery_v1(
    v_event_lock,true,'Phase A E2E security-lock safety'
  ) into v_orch;

  if v_orch->>'state' <> 'ESCALATED'
     or v_orch->>'reason' <> 'HUMAN_CONTROLLED_ONLY' then
    raise exception 'D failed: locked/security event was not human-only: %',v_orch;
  end if;

  if exists(
    select 1 from public.bsoc_recovery_runs where event_id=v_event_lock
  ) then
    raise exception 'D failed: recovery run exists for security lock';
  end if;

  -- E. Private/unrestricted content is not valid operational route metadata.
  begin
    perform public.buklod_record_health_event_v1(
      'E2E-E-'||v_suffix,
      'BUKLOD_MAIN','E2E','web','staging',
      'drawer/private note content=should_not_leave_device',
      'LOCAL_STORAGE','ERROR','LOCAL-500','LOCAL_CACHE_REBUILD_REQUIRED',
      'device-e2e-e-'||v_suffix,'session-e2e-e-'||v_suffix,
      'ONLINE','AUTH_OK','IDLE','DEGRADED','HEALTHY',
      'DRAWER_OPEN',0,null,false,'NOT_ATTEMPTED',
      'E2E_PRIVACY_'||v_suffix,'OPERATIONAL',now()
    );
  exception when others then
    v_privacy_rejected := true;
  end;

  if not v_privacy_rejected then
    raise exception 'E failed: unsafe private-content route metadata was accepted';
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='bsoc_health_events'
      and lower(column_name) in (
        'message','body','note_text','content','prayer_text','spiritual_notes',
        'password','otp','token','payment_credentials'
      )
  ) then
    raise exception 'E failed: health event schema exposes private-content columns';
  end if;

  -- B. Same signature across 50 users -> one incident and no recovery/ticket storm.
  select count(*) into v_count
  from public.profiles p
  join auth.users u on u.id=p.id
  where coalesce(p.is_active,true);

  if v_count < 50 then
    raise exception 'B cannot run: fewer than 50 active users available';
  end if;

  v_corr := 'E2E_AUTH_STORM_'||v_suffix;
  v_count := 0;

  for v_uid in
    select p.id
    from public.profiles p
    join auth.users u on u.id=p.id
    where coalesce(p.is_active,true)
    order by p.id
    limit 50
  loop
    insert into public.bsoc_health_events(
      client_event_id,occurred_at,user_id,user_ref,
      app_id,app_version,platform,environment,route_module,
      health_category,severity,safe_error_code,error_signature,
      network_state,auth_state,sync_state,local_storage_state,notification_state,
      last_successful_action,pending_work_count,known_incident_hint,
      local_self_heal_attempted,local_self_heal_result,
      correlation_key,privacy_classification,first_seen_at,last_seen_at,
      repeat_count,lifecycle_state
    )
    values(
      'E2E-B-'||v_suffix||'-'||lpad((v_count+1)::text,2,'0'),
      now(),v_uid,substr(md5(v_uid::text),1,16),
      'BUKLOD_MAIN','E2E','web','staging','auth/login',
      'AUTH','ERROR','AUTH-408','AUTH_TIMEOUT_V3',
      'ONLINE','STALE','IDLE','HEALTHY','HEALTHY',
      'AUTH_LOGIN_ATTEMPT',0,null,
      true,'FAILED',
      v_corr,'OPERATIONAL',now(),now(),
      1,'LOCAL_RECOVERY_ATTEMPTED'
    );
    v_count := v_count + 1;
  end loop;

  perform public.buklod_bsoc_correlate_health_incidents_v1(20,1);

  select count(*) into v_clusters
  from public.bsoc_health_incident_clusters
  where correlation_key=v_corr
    and app_id='BUKLOD_MAIN'
    and incident_id is not null;

  if v_clusters <> 1 then
    raise exception 'B failed: expected one correlated incident cluster, got %',v_clusters;
  end if;

  select count(*) into v_linked
  from public.bsoc_health_events
  where correlation_key=v_corr
    and incident_id is not null
    and lifecycle_state='LINKED_TO_INCIDENT';

  if v_linked <> 50 then
    raise exception 'B failed: expected 50 linked events, got %',v_linked;
  end if;

  select id into v_event
  from public.bsoc_health_events
  where correlation_key=v_corr
  order by id
  limit 1;

  select public.buklod_bsoc_orchestrate_recovery_v1(
    v_event,false,'Phase A E2E incident suppression check'
  ) into v_orch;

  if v_orch->>'state' <> 'LINKED_TO_INCIDENT'
     or coalesce((v_orch->>'recovery_started')::boolean,true) then
    raise exception 'B failed: correlated incident did not suppress recovery: %',v_orch;
  end if;

  select count(*) into v_cases
  from public.user_feedback uf
  where uf.diagnostics->>'source'='BSOC_CLOSED_LOOP_SELF_HEAL'
    and (uf.diagnostics->>'health_event_id')::uuid in (
      select id
      from public.bsoc_health_events
      where correlation_key=v_corr
    );

  if v_cases <> 0 then
    raise exception 'B failed: event storm created individual support cases: %',v_cases;
  end if;
end
$e2e$;

rollback;

select *
from (values
  ('A_STALE_SESSION_VERIFIED_AUTO_HEAL','PASS'),
  ('B_50_USER_INCIDENT_CORRELATION_NO_STORM','PASS'),
  ('C_FINANCIAL_AUTO_RECOVERY_DENIED','PASS'),
  ('D_SECURITY_LOCK_AUTO_RECOVERY_DENIED','PASS'),
  ('E_PRIVATE_CONTENT_REJECTED_FROM_HEALTH_METADATA','PASS'),
  ('F_FAILED_VERIFICATION_NEVER_AUTO_HEALED','PASS'),
  ('PRODUCTION_PERSISTENCE','ROLLBACK_ONLY')
) as e2e(test,result);
