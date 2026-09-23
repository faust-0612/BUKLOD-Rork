-- BUKLOD BSOC Closed-Loop Self-Heal Engine R13

-- Canonical engine source reconstructed from the verified production definitions.

begin;

CREATE OR REPLACE FUNCTION public.buklod_record_health_event_v1(p_client_event_id text, p_app_id text, p_app_version text, p_platform text, p_environment text, p_route_module text, p_health_category text, p_severity text, p_safe_error_code text, p_error_signature text, p_device_ref text, p_session_ref text, p_network_state text, p_auth_state text, p_sync_state text, p_local_storage_state text, p_notification_state text, p_last_successful_action text, p_pending_work_count integer, p_known_incident_hint text, p_local_self_heal_attempted boolean, p_local_self_heal_result text, p_correlation_key text, p_privacy_classification text, p_detected_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  contract public.bsoc_app_health_contracts%rowtype;
  app_key text := upper(trim(coalesce(p_app_id,'')));
  category_key text := upper(trim(coalesce(p_health_category,'')));
  severity_key text := upper(trim(coalesce(p_severity,'')));
  platform_key text := lower(trim(coalesce(p_platform,'')));
  env_key text := lower(trim(coalesce(p_environment,'')));
  err_code text := upper(trim(coalesce(p_safe_error_code,'')));
  signature text := upper(trim(coalesce(p_error_signature,'')));
  corr text := upper(trim(coalesce(p_correlation_key,'')));
  local_result text := upper(trim(coalesce(p_local_self_heal_result,'NOT_ATTEMPTED')));
  privacy_key text := upper(trim(coalesce(p_privacy_classification,'OPERATIONAL')));
  existing_id uuid;
  new_id uuid;
  deduped boolean := false;
  detected timestamptz := coalesce(p_detected_at,now());
  now_ts timestamptz := now();
begin
  if actor is null then raise exception 'Authentication required'; end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=actor and coalesce(p.is_active,true)
  ) then
    raise exception 'Active BUKLOD account required';
  end if;

  select * into contract
  from public.bsoc_app_health_contracts c
  where c.app_id=app_key and c.enabled;

  if not found then raise exception 'Unknown or disabled BUKLOD health contract'; end if;
  if not (category_key = any(contract.accepted_categories)) then
    raise exception 'Unsupported health category';
  end if;
  if env_key not in ('production','staging','development') then raise exception 'Invalid environment'; end if;
  if platform_key not in ('android','ios','web','desktop','server','other') then raise exception 'Invalid platform'; end if;
  if severity_key not in ('INFO','WARNING','ERROR','CRITICAL') then raise exception 'Invalid severity'; end if;
  if local_result not in ('NOT_ATTEMPTED','SUCCESS','FAILED','INELIGIBLE','UNKNOWN') then raise exception 'Invalid local recovery result'; end if;
  if privacy_key not in ('OPERATIONAL','MINIMAL','SECURITY_REVIEW_REQUIRED') then raise exception 'Invalid privacy classification'; end if;
  if detected > now_ts + interval '5 minutes'
     or detected < now_ts - make_interval(secs => contract.max_event_age_seconds) then
    raise exception 'Health event timestamp outside accepted window';
  end if;

  if err_code !~ '^[A-Z0-9_.:-]{2,96}$'
     or signature !~ '^[A-Z0-9_.:-]{2,120}$'
     or corr !~ '^[A-Z0-9_.:-]{2,160}$' then
    raise exception 'Health codes must use privacy-safe stable identifiers';
  end if;

  if nullif(trim(coalesce(p_route_module,'')),'') is not null
     and trim(p_route_module) !~ '^[A-Za-z0-9_./:-]{1,160}$' then
    raise exception 'Route/module must be a safe identifier';
  end if;

  if nullif(trim(coalesce(p_last_successful_action,'')),'') is not null
     and upper(trim(p_last_successful_action)) !~ '^[A-Z0-9_.:-]{2,96}$' then
    raise exception 'Last successful action must be a safe code';
  end if;

  if nullif(trim(coalesce(p_known_incident_hint,'')),'') is not null
     and upper(trim(p_known_incident_hint)) !~ '^[A-Z0-9_.:-]{2,96}$' then
    raise exception 'Known incident hint must be a safe code';
  end if;

  if coalesce(p_pending_work_count,0) < 0 or coalesce(p_pending_work_count,0) > 1000000 then
    raise exception 'Invalid pending work count';
  end if;

  if nullif(trim(coalesce(p_client_event_id,'')),'') is not null then
    select e.id into existing_id
    from public.bsoc_health_events e
    where e.user_id=actor
      and e.app_id=app_key
      and e.client_event_id=left(trim(p_client_event_id),120)
    limit 1;

    if existing_id is not null then
      return jsonb_build_object('event_id',existing_id,'deduped',true,'reason','CLIENT_EVENT_ID');
    end if;
  end if;

  select e.id into existing_id
  from public.bsoc_health_events e
  where e.user_id=actor
    and e.app_id=app_key
    and e.error_signature=signature
    and e.correlation_key=corr
    and e.last_seen_at >= now_ts - make_interval(secs => contract.dedupe_window_seconds)
  order by e.last_seen_at desc
  limit 1
  for update;

  if existing_id is not null then
    update public.bsoc_health_events e
    set last_seen_at=greatest(e.last_seen_at,detected),
        repeat_count=e.repeat_count+1,
        severity=case
          when e.severity='CRITICAL' or severity_key='CRITICAL' then 'CRITICAL'
          when e.severity='ERROR' or severity_key='ERROR' then 'ERROR'
          when e.severity='WARNING' or severity_key='WARNING' then 'WARNING'
          else 'INFO'
        end,
        network_state=coalesce(nullif(upper(trim(coalesce(p_network_state,''))),''),e.network_state),
        auth_state=coalesce(nullif(upper(trim(coalesce(p_auth_state,''))),''),e.auth_state),
        sync_state=coalesce(nullif(upper(trim(coalesce(p_sync_state,''))),''),e.sync_state),
        local_storage_state=coalesce(nullif(upper(trim(coalesce(p_local_storage_state,''))),''),e.local_storage_state),
        notification_state=coalesce(nullif(upper(trim(coalesce(p_notification_state,''))),''),e.notification_state),
        pending_work_count=greatest(e.pending_work_count,coalesce(p_pending_work_count,0)),
        local_self_heal_attempted=e.local_self_heal_attempted or coalesce(p_local_self_heal_attempted,false),
        local_self_heal_result=case
          when local_result='SUCCESS' then 'SUCCESS'
          when local_result='FAILED' and e.local_self_heal_result<>'SUCCESS' then 'FAILED'
          else e.local_self_heal_result
        end,
        lifecycle_state=case
          when coalesce(p_local_self_heal_attempted,false) then 'LOCAL_RECOVERY_ATTEMPTED'
          else e.lifecycle_state
        end,
        updated_at=now_ts
    where e.id=existing_id;
    deduped:=true;
    new_id:=existing_id;
  else
    insert into public.bsoc_health_events(
      client_event_id,occurred_at,user_id,user_ref,device_ref_hash,session_ref_hash,
      app_id,app_version,platform,environment,route_module,health_category,severity,
      safe_error_code,error_signature,network_state,auth_state,sync_state,
      local_storage_state,notification_state,last_successful_action,pending_work_count,
      known_incident_hint,local_self_heal_attempted,local_self_heal_result,
      correlation_key,privacy_classification,first_seen_at,last_seen_at,lifecycle_state
    )
    values(
      nullif(left(trim(coalesce(p_client_event_id,'')),120),''),
      detected,
      actor,
      substr(md5(actor::text),1,16),
      case when nullif(trim(coalesce(p_device_ref,'')),'') is null then null else md5(trim(p_device_ref)) end,
      case when nullif(trim(coalesce(p_session_ref,'')),'') is null then null else md5(trim(p_session_ref)) end,
      app_key,
      nullif(left(trim(coalesce(p_app_version,'')),80),''),
      platform_key,
      env_key,
      nullif(left(trim(coalesce(p_route_module,'')),160),''),
      category_key,
      severity_key,
      err_code,
      signature,
      nullif(upper(left(trim(coalesce(p_network_state,'')),40)),''),
      nullif(upper(left(trim(coalesce(p_auth_state,'')),40)),''),
      nullif(upper(left(trim(coalesce(p_sync_state,'')),40)),''),
      nullif(upper(left(trim(coalesce(p_local_storage_state,'')),40)),''),
      nullif(upper(left(trim(coalesce(p_notification_state,'')),40)),''),
      nullif(upper(left(trim(coalesce(p_last_successful_action,'')),96)),''),
      coalesce(p_pending_work_count,0),
      nullif(upper(left(trim(coalesce(p_known_incident_hint,'')),96)),''),
      coalesce(p_local_self_heal_attempted,false),
      local_result,
      corr,
      privacy_key,
      detected,
      detected,
      case when coalesce(p_local_self_heal_attempted,false)
           then 'LOCAL_RECOVERY_ATTEMPTED' else 'DETECTED' end
    )
    returning id into new_id;
  end if;

  return jsonb_build_object(
    'event_id',new_id,
    'deduped',deduped,
    'local_self_heal_result',local_result,
    'support_case_created',false
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_poll_recovery_commands_v1(p_app_id text, p_limit integer DEFAULT 5)
 RETURNS TABLE(command_id uuid, recovery_run_id uuid, action_kind text, action_payload jsonb, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  app_key text := upper(trim(coalesce(p_app_id,'')));
  lim integer := greatest(1,least(coalesce(p_limit,5),20));
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.bsoc_app_health_contracts
    where app_id=app_key and enabled
  ) then
    raise exception 'Unknown app health contract';
  end if;

  update public.bsoc_recovery_commands c
  set status='EXPIRED'
  where c.target_user_id=actor
    and c.app_id=app_key
    and c.status in ('PENDING','DELIVERED')
    and c.expires_at<=now();

  return query
  with chosen as (
    select c.id
    from public.bsoc_recovery_commands c
    where c.target_user_id=actor
      and c.app_id=app_key
      and c.status='PENDING'
      and c.expires_at>now()
    order by c.created_at
    limit lim
    for update skip locked
  ),
  delivered as (
    update public.bsoc_recovery_commands c
    set status='DELIVERED',delivered_at=now()
    from chosen x
    where c.id=x.id
    returning c.*
  )
  select d.id,d.recovery_run_id,d.action_kind,d.action_payload,d.expires_at
  from delivered d
  order by d.created_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_record_recovery_verification_v1(p_recovery_run_id uuid, p_verification_type text, p_success boolean, p_evidence_code text, p_safe_metrics jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  r public.bsoc_recovery_runs%rowtype;
  pb public.bsoc_recovery_playbooks%rowtype;
  metrics jsonb := coalesce(p_safe_metrics,'{}'::jsonb);
  forbidden_key text;
  final_state text;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select * into r
  from public.bsoc_recovery_runs
  where id=p_recovery_run_id
  for update;
  if not found then raise exception 'Recovery run not found'; end if;
  if r.target_user_id<>actor then raise exception 'Recovery run belongs to another user'; end if;
  if r.mode<>'ENABLED' then raise exception 'Shadow runs cannot be marked AUTO_HEALED'; end if;
  if r.state not in ('REMOTE_RECOVERY_RUNNING','VERIFYING') then
    raise exception 'Recovery run is not awaiting verification';
  end if;

  select * into pb
  from public.bsoc_recovery_playbooks
  where playbook_id=r.playbook_id and version=r.playbook_version;
  if not found then raise exception 'Recovery playbook missing'; end if;

  if upper(trim(coalesce(p_verification_type,''))) <> upper(pb.verification_type) then
    raise exception 'Verification type does not match playbook';
  end if;
  if upper(trim(coalesce(p_evidence_code,''))) !~ '^[A-Z0-9_.:-]{2,96}$' then
    raise exception 'Evidence code must be privacy-safe';
  end if;
  if jsonb_typeof(metrics)<>'object' then raise exception 'Safe metrics must be a JSON object'; end if;

  select k into forbidden_key
  from jsonb_object_keys(metrics) k
  where k not in (
    'latency_ms','pending_work_count','protected_route_ok','server_ack',
    'duplicate_count','current_state_ok','authorized_scope_ok',
    'user_context_ok','registration_ok','route_rendered','remaining_pending_count'
  )
  limit 1;

  if forbidden_key is not null then
    raise exception 'Unsupported verification metric key: %',forbidden_key;
  end if;

  insert into public.bsoc_recovery_verifications(
    recovery_run_id,reporter_user_id,verification_type,success,evidence_code,safe_metrics
  )
  values(
    r.id,actor,upper(trim(p_verification_type)),coalesce(p_success,false),
    upper(trim(p_evidence_code)),metrics
  );

  final_state:=case when coalesce(p_success,false) then 'AUTO_HEALED' else 'RECOVERY_FAILED' end;

  update public.bsoc_recovery_runs
  set state=final_state,
      verification_result=case when p_success then 'PASS' else 'FAIL' end,
      after_state=metrics,
      failure_reason=case when p_success then null else upper(trim(p_evidence_code)) end,
      finished_at=now(),
      updated_at=now()
  where id=r.id;

  update public.bsoc_recovery_commands
  set status='ACKNOWLEDGED',acknowledged_at=now()
  where recovery_run_id=r.id
    and status in ('PENDING','DELIVERED');

  update public.bsoc_health_events
  set lifecycle_state=final_state,updated_at=now()
  where id=r.event_id;

  insert into public.bsoc_recovery_audit(
    initiator_id,target_user_id,app_id,route_module,playbook_id,playbook_version,
    recovery_run_id,event_id,reason,before_state,actions,after_state,
    verification_result,duration_ms,attempt_count,incident_id,support_case_id
  )
  values(
    actor,r.target_user_id,r.app_id,r.route_module,r.playbook_id,r.playbook_version,
    r.id,r.event_id,'client verification heartbeat',r.before_state,r.proposed_actions,
    metrics,case when p_success then 'PASS' else 'FAIL' end,
    greatest(0,(extract(epoch from (now()-r.started_at))*1000)::integer),
    r.attempt_count,r.incident_id,r.support_case_id
  );

  return jsonb_build_object(
    'recovery_run_id',r.id,
    'state',final_state,
    'verified',coalesce(p_success,false)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_diagnose_health_event_v1(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.bsoc_health_events%rowtype;
  pb public.bsoc_recovery_playbooks%rowtype;
  known_incident jsonb;
begin
  if auth.uid() is null or not (
    public.buklod_bsoc_can('bsoc.observability.read')
    or public.buklod_bsoc_can('bsoc.safe_recovery.execute')
    or public.buklod_bsoc_can('bsoc.incidents.read')
  ) then
    raise exception 'BUKLOD BSOC health permission required';
  end if;

  select * into e from public.bsoc_health_events where id=p_event_id;
  if not found then raise exception 'Health event not found'; end if;

  select * into pb
  from public.bsoc_recovery_playbooks p
  where p.health_category=e.health_category
    and p.error_signature=e.error_signature
    and (p.app_id is null or p.app_id=e.app_id)
    and not p.kill_switch
    and p.mode<>'DISABLED'
  order by
    case when p.app_id=e.app_id then 0 else 1 end,
    p.version desc
  limit 1;

  if e.incident_id is not null then
    select jsonb_build_object(
      'incident_id',i.id,
      'title',i.title,
      'severity',i.severity,
      'status',i.status
    ) into known_incident
    from public.pilot_incidents i
    where i.id=e.incident_id;
  end if;

  return jsonb_build_object(
    'event_id',e.id,
    'app_id',e.app_id,
    'app_version',e.app_version,
    'platform',e.platform,
    'environment',e.environment,
    'route_module',e.route_module,
    'category',e.health_category,
    'severity',e.severity,
    'safe_error_code',e.safe_error_code,
    'error_signature',e.error_signature,
    'repeat_count',e.repeat_count,
    'network_state',e.network_state,
    'auth_state',e.auth_state,
    'sync_state',e.sync_state,
    'pending_work_count',e.pending_work_count,
    'local_self_heal_attempted',e.local_self_heal_attempted,
    'local_self_heal_result',e.local_self_heal_result,
    'known_incident',known_incident,
    'remote_recovery_allowed',
      pb.playbook_id is not null
      and pb.risk_level='LOW'
      and e.auth_state is distinct from 'LOCKED'
      and e.privacy_classification<>'SECURITY_REVIEW_REQUIRED',
    'proposed_playbook',
      case when pb.playbook_id is null then null else jsonb_build_object(
        'playbook_id',pb.playbook_id,
        'version',pb.version,
        'mode',pb.mode,
        'risk_level',pb.risk_level,
        'action_kind',pb.action_kind,
        'max_attempts',pb.max_attempts,
        'timeout_seconds',pb.timeout_seconds,
        'cooldown_seconds',pb.cooldown_seconds,
        'verification_type',pb.verification_type,
        'kill_switch',pb.kill_switch,
        'qa_verified',pb.qa_verified_at is not null,
        'executor_ready',pb.executor_ready
      ) end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_orchestrate_recovery_v1(p_event_id uuid, p_execute boolean DEFAULT false, p_reason text DEFAULT 'closed-loop recovery evaluation'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  e public.bsoc_health_events%rowtype;
  pb public.bsoc_recovery_playbooks%rowtype;
  run_id uuid;
  recent_count integer;
  action_whitelist text[] := array[
    'REQUEST_CLIENT_SESSION_REFRESH',
    'REQUEST_CLIENT_SYNC_RESUME',
    'REQUEST_CLIENT_ROUTE_RECOVERY',
    'REQUEST_CLIENT_PUSH_REFRESH',
    'REQUEST_CLIENT_ORG_RERESOLVE'
  ];
begin
  if actor is null then raise exception 'Authentication required'; end if;

  if coalesce(p_execute,false) then
    if not public.buklod_bsoc_can('bsoc.safe_recovery.execute') then
      raise exception 'BUKLOD BSOC safe-recovery permission required';
    end if;
  elsif not (
    public.buklod_bsoc_can('bsoc.observability.read')
    or public.buklod_bsoc_can('bsoc.playbooks.read')
  ) then
    raise exception 'BUKLOD BSOC observability permission required';
  end if;

  select * into e
  from public.bsoc_health_events
  where id=p_event_id
  for update;
  if not found then raise exception 'Health event not found'; end if;

  if e.incident_id is not null then
    update public.bsoc_health_events
    set lifecycle_state='LINKED_TO_INCIDENT',updated_at=now()
    where id=e.id;

    return jsonb_build_object(
      'event_id',e.id,
      'state','LINKED_TO_INCIDENT',
      'incident_id',e.incident_id,
      'recovery_started',false
    );
  end if;

  if e.privacy_classification='SECURITY_REVIEW_REQUIRED'
     or e.auth_state='LOCKED'
     or e.error_signature like 'FINANCE%'
     or e.error_signature like 'PAYOUT%'
     or e.error_signature like 'ROLE_%'
     or e.error_signature like 'ACCOUNT_DELETE%'
     or e.error_signature like 'SECURITY_%' then
    update public.bsoc_health_events
    set lifecycle_state='ESCALATED',updated_at=now()
    where id=e.id;

    return jsonb_build_object(
      'event_id',e.id,
      'state','ESCALATED',
      'reason','HUMAN_CONTROLLED_ONLY',
      'recovery_started',false
    );
  end if;

  select * into pb
  from public.bsoc_recovery_playbooks p
  where p.health_category=e.health_category
    and p.error_signature=e.error_signature
    and (p.app_id is null or p.app_id=e.app_id)
    and not p.kill_switch
    and p.mode<>'DISABLED'
  order by
    case when p.app_id=e.app_id then 0 else 1 end,
    p.version desc
  limit 1;

  if not found or pb.risk_level<>'LOW' then
    update public.bsoc_health_events
    set lifecycle_state='RECOVERY_FAILED',updated_at=now()
    where id=e.id;

    return jsonb_build_object(
      'event_id',e.id,
      'state','RECOVERY_FAILED',
      'reason','NO_ELIGIBLE_LOW_RISK_PLAYBOOK',
      'recovery_started',false
    );
  end if;

  if not (pb.action_kind = any(action_whitelist)) then
    raise exception 'Playbook action kind is not in the safe recovery allowlist';
  end if;

  select count(*) into recent_count
  from public.bsoc_recovery_runs r
  where r.target_user_id=e.user_id
    and r.playbook_id=pb.playbook_id
    and r.app_id=e.app_id
    and r.started_at >= now() - make_interval(secs=>pb.cooldown_seconds)
    and r.state not in ('RECOVERY_FAILED','ESCALATED');

  if recent_count>0 then
    return jsonb_build_object(
      'event_id',e.id,
      'state','REMOTE_RECOVERY_ELIGIBLE',
      'reason','COOLDOWN_DEDUPED',
      'recovery_started',false
    );
  end if;

  if not coalesce(p_execute,false) or pb.mode='SHADOW' then
    insert into public.bsoc_recovery_runs(
      event_id,playbook_id,playbook_version,mode,state,initiated_by,target_user_id,
      app_id,route_module,attempt_count,before_state,proposed_actions,verification_result
    )
    values(
      e.id,pb.playbook_id,pb.version,'SHADOW','SHADOW_PROPOSED',actor,e.user_id,
      e.app_id,e.route_module,0,
      jsonb_build_object(
        'auth_state',e.auth_state,
        'sync_state',e.sync_state,
        'network_state',e.network_state,
        'pending_work_count',e.pending_work_count,
        'lifecycle_state',e.lifecycle_state
      ),
      jsonb_build_array(jsonb_build_object(
        'action_kind',pb.action_kind,
        'action_spec',pb.action_spec,
        'timeout_seconds',pb.timeout_seconds
      )),
      'NOT_RUN'
    )
    returning id into run_id;

    update public.bsoc_health_events
    set lifecycle_state='REMOTE_RECOVERY_ELIGIBLE',updated_at=now()
    where id=e.id;

    insert into public.bsoc_recovery_audit(
      initiator_id,target_user_id,app_id,route_module,playbook_id,playbook_version,
      recovery_run_id,event_id,reason,before_state,actions,verification_result,attempt_count
    )
    values(
      actor,e.user_id,e.app_id,e.route_module,pb.playbook_id,pb.version,
      run_id,e.id,left(coalesce(p_reason,'shadow evaluation'),500),
      jsonb_build_object(
        'auth_state',e.auth_state,'sync_state',e.sync_state,
        'network_state',e.network_state,'pending_work_count',e.pending_work_count
      ),
      jsonb_build_array(jsonb_build_object('would_execute',pb.action_kind)),
      'NOT_RUN',0
    );

    return jsonb_build_object(
      'event_id',e.id,
      'recovery_run_id',run_id,
      'state','SHADOW_PROPOSED',
      'playbook_id',pb.playbook_id,
      'playbook_version',pb.version,
      'would_execute',pb.action_kind,
      'recovery_started',false
    );
  end if;

  if pb.mode<>'ENABLED' or pb.kill_switch then
    raise exception 'Playbook is not enabled for execution';
  end if;
  if pb.qa_verified_at is null then
    raise exception 'Playbook cannot execute before QA verification';
  end if;
  if not pb.executor_ready then
    raise exception 'Playbook executor is not ready';
  end if;

  insert into public.bsoc_recovery_runs(
    event_id,playbook_id,playbook_version,mode,state,initiated_by,target_user_id,
    app_id,route_module,attempt_count,before_state,proposed_actions,verification_result
  )
  values(
    e.id,pb.playbook_id,pb.version,'ENABLED','REMOTE_RECOVERY_RUNNING',actor,e.user_id,
    e.app_id,e.route_module,1,
    jsonb_build_object(
      'auth_state',e.auth_state,
      'sync_state',e.sync_state,
      'network_state',e.network_state,
      'pending_work_count',e.pending_work_count,
      'lifecycle_state',e.lifecycle_state
    ),
    jsonb_build_array(jsonb_build_object(
      'action_kind',pb.action_kind,
      'action_spec',pb.action_spec
    )),
    'PENDING'
  )
  returning id into run_id;

  insert into public.bsoc_recovery_commands(
    recovery_run_id,target_user_id,app_id,action_kind,action_payload,expires_at
  )
  values(
    run_id,e.user_id,e.app_id,pb.action_kind,
    jsonb_build_object(
      'playbook_id',pb.playbook_id,
      'playbook_version',pb.version,
      'event_id',e.id,
      'timeout_seconds',pb.timeout_seconds,
      'action_spec',pb.action_spec
    ),
    now()+make_interval(secs=>pb.timeout_seconds)
  );

  update public.bsoc_health_events
  set lifecycle_state='REMOTE_RECOVERY_RUNNING',updated_at=now()
  where id=e.id;

  insert into public.bsoc_recovery_audit(
    initiator_id,target_user_id,app_id,route_module,playbook_id,playbook_version,
    recovery_run_id,event_id,reason,before_state,actions,verification_result,attempt_count
  )
  values(
    actor,e.user_id,e.app_id,e.route_module,pb.playbook_id,pb.version,
    run_id,e.id,left(coalesce(p_reason,'approved safe recovery'),500),
    jsonb_build_object(
      'auth_state',e.auth_state,'sync_state',e.sync_state,
      'network_state',e.network_state,'pending_work_count',e.pending_work_count
    ),
    jsonb_build_array(jsonb_build_object('queued',pb.action_kind)),
    'PENDING',1
  );

  return jsonb_build_object(
    'event_id',e.id,
    'recovery_run_id',run_id,
    'state','REMOTE_RECOVERY_RUNNING',
    'playbook_id',pb.playbook_id,
    'playbook_version',pb.version,
    'command_queued',true,
    'recovery_started',true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_set_playbook_mode_v1(p_playbook_id text, p_version integer, p_mode text, p_kill_switch boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  requested_mode text := upper(trim(coalesce(p_mode,'')));
  reason text := nullif(trim(coalesce(p_reason,'')),'');
  pb public.bsoc_recovery_playbooks%rowtype;
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if reason is null then raise exception 'Reason is required'; end if;
  if requested_mode not in ('DISABLED','SHADOW','ENABLED','RESTRICTED') then
    raise exception 'Invalid playbook mode';
  end if;

  select * into pb
  from public.bsoc_recovery_playbooks
  where playbook_id=upper(trim(p_playbook_id)) and version=p_version
  for update;
  if not found then raise exception 'Playbook not found'; end if;

  if requested_mode='ENABLED' then
    if pb.qa_verified_at is null then raise exception 'QA verification required before enable'; end if;
    if not pb.executor_ready then raise exception 'Executor readiness required before enable'; end if;
    if pb.risk_level<>'LOW' then raise exception 'Only LOW-risk playbooks can be auto-enabled'; end if;
    if coalesce(p_kill_switch,false) then raise exception 'Cannot enable while kill switch is active'; end if;
  end if;

  update public.bsoc_recovery_playbooks
  set mode=requested_mode,
      kill_switch=coalesce(p_kill_switch,false),
      enabled_at=case when requested_mode='ENABLED' then now() else enabled_at end,
      enabled_by=case when requested_mode='ENABLED' then actor else enabled_by end,
      updated_at=now()
  where playbook_id=pb.playbook_id and version=pb.version;

  insert into public.bsoc_recovery_audit(
    initiator_id,app_id,playbook_id,playbook_version,reason,before_state,actions,after_state,verification_result
  )
  values(
    actor,coalesce(pb.app_id,'GLOBAL'),pb.playbook_id,pb.version,reason,
    jsonb_build_object('mode',pb.mode,'kill_switch',pb.kill_switch),
    jsonb_build_array(jsonb_build_object('action','SET_PLAYBOOK_MODE')),
    jsonb_build_object('mode',requested_mode,'kill_switch',coalesce(p_kill_switch,false)),
    'NOT_RUN'
  );

  return jsonb_build_object(
    'ok',true,'playbook_id',pb.playbook_id,'version',pb.version,
    'mode',requested_mode,'kill_switch',coalesce(p_kill_switch,false)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_mark_playbook_qa_v1(p_playbook_id text, p_version integer, p_verified boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if reason is null then raise exception 'Reason is required'; end if;

  update public.bsoc_recovery_playbooks
  set qa_verified_at=case when p_verified then now() else null end,
      qa_verified_by=case when p_verified then actor else null end,
      updated_at=now()
  where playbook_id=upper(trim(p_playbook_id))
    and version=p_version;
  if not found then raise exception 'Playbook not found'; end if;

  insert into public.bsoc_recovery_audit(
    initiator_id,app_id,playbook_id,playbook_version,reason,actions,verification_result
  )
  select actor,coalesce(p.app_id,'GLOBAL'),p.playbook_id,p.version,reason,
         jsonb_build_array(jsonb_build_object('qa_verified',coalesce(p_verified,false))),
         case when p_verified then 'PASS' else 'NOT_RUN' end
  from public.bsoc_recovery_playbooks p
  where p.playbook_id=upper(trim(p_playbook_id)) and p.version=p_version;

  return jsonb_build_object('ok',true,'qa_verified',coalesce(p_verified,false));
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_set_playbook_executor_ready_v1(p_playbook_id text, p_version integer, p_ready boolean, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if reason is null then raise exception 'Reason is required'; end if;

  update public.bsoc_recovery_playbooks
  set executor_ready=coalesce(p_ready,false),updated_at=now()
  where playbook_id=upper(trim(p_playbook_id)) and version=p_version;
  if not found then raise exception 'Playbook not found'; end if;

  insert into public.bsoc_recovery_audit(
    initiator_id,app_id,playbook_id,playbook_version,reason,actions,verification_result
  )
  select actor,coalesce(p.app_id,'GLOBAL'),p.playbook_id,p.version,reason,
         jsonb_build_array(jsonb_build_object('executor_ready',coalesce(p_ready,false))),
         'NOT_RUN'
  from public.bsoc_recovery_playbooks p
  where p.playbook_id=upper(trim(p_playbook_id)) and p.version=p_version;

  return jsonb_build_object('ok',true,'executor_ready',coalesce(p_ready,false));
end;
$function$;

revoke all on function public.buklod_record_health_event_v1(p_client_event_id text, p_app_id text, p_app_version text, p_platform text, p_environment text, p_route_module text, p_health_category text, p_severity text, p_safe_error_code text, p_error_signature text, p_device_ref text, p_session_ref text, p_network_state text, p_auth_state text, p_sync_state text, p_local_storage_state text, p_notification_state text, p_last_successful_action text, p_pending_work_count integer, p_known_incident_hint text, p_local_self_heal_attempted boolean, p_local_self_heal_result text, p_correlation_key text, p_privacy_classification text, p_detected_at timestamp with time zone) from public;
revoke all on function public.buklod_record_health_event_v1(p_client_event_id text, p_app_id text, p_app_version text, p_platform text, p_environment text, p_route_module text, p_health_category text, p_severity text, p_safe_error_code text, p_error_signature text, p_device_ref text, p_session_ref text, p_network_state text, p_auth_state text, p_sync_state text, p_local_storage_state text, p_notification_state text, p_last_successful_action text, p_pending_work_count integer, p_known_incident_hint text, p_local_self_heal_attempted boolean, p_local_self_heal_result text, p_correlation_key text, p_privacy_classification text, p_detected_at timestamp with time zone) from anon;
grant execute on function public.buklod_record_health_event_v1(p_client_event_id text, p_app_id text, p_app_version text, p_platform text, p_environment text, p_route_module text, p_health_category text, p_severity text, p_safe_error_code text, p_error_signature text, p_device_ref text, p_session_ref text, p_network_state text, p_auth_state text, p_sync_state text, p_local_storage_state text, p_notification_state text, p_last_successful_action text, p_pending_work_count integer, p_known_incident_hint text, p_local_self_heal_attempted boolean, p_local_self_heal_result text, p_correlation_key text, p_privacy_classification text, p_detected_at timestamp with time zone) to authenticated;

revoke all on function public.buklod_poll_recovery_commands_v1(p_app_id text, p_limit integer) from public;
revoke all on function public.buklod_poll_recovery_commands_v1(p_app_id text, p_limit integer) from anon;
grant execute on function public.buklod_poll_recovery_commands_v1(p_app_id text, p_limit integer) to authenticated;

revoke all on function public.buklod_record_recovery_verification_v1(p_recovery_run_id uuid, p_verification_type text, p_success boolean, p_evidence_code text, p_safe_metrics jsonb) from public;
revoke all on function public.buklod_record_recovery_verification_v1(p_recovery_run_id uuid, p_verification_type text, p_success boolean, p_evidence_code text, p_safe_metrics jsonb) from anon;
grant execute on function public.buklod_record_recovery_verification_v1(p_recovery_run_id uuid, p_verification_type text, p_success boolean, p_evidence_code text, p_safe_metrics jsonb) to authenticated;

revoke all on function public.buklod_bsoc_diagnose_health_event_v1(p_event_id uuid) from public;
revoke all on function public.buklod_bsoc_diagnose_health_event_v1(p_event_id uuid) from anon;
grant execute on function public.buklod_bsoc_diagnose_health_event_v1(p_event_id uuid) to authenticated;

revoke all on function public.buklod_bsoc_orchestrate_recovery_v1(p_event_id uuid, p_execute boolean, p_reason text) from public;
revoke all on function public.buklod_bsoc_orchestrate_recovery_v1(p_event_id uuid, p_execute boolean, p_reason text) from anon;
grant execute on function public.buklod_bsoc_orchestrate_recovery_v1(p_event_id uuid, p_execute boolean, p_reason text) to authenticated;

revoke all on function public.buklod_bsoc_set_playbook_mode_v1(p_playbook_id text, p_version integer, p_mode text, p_kill_switch boolean, p_reason text) from public;
revoke all on function public.buklod_bsoc_set_playbook_mode_v1(p_playbook_id text, p_version integer, p_mode text, p_kill_switch boolean, p_reason text) from anon;
grant execute on function public.buklod_bsoc_set_playbook_mode_v1(p_playbook_id text, p_version integer, p_mode text, p_kill_switch boolean, p_reason text) to authenticated;

revoke all on function public.buklod_bsoc_mark_playbook_qa_v1(p_playbook_id text, p_version integer, p_verified boolean, p_reason text) from public;
revoke all on function public.buklod_bsoc_mark_playbook_qa_v1(p_playbook_id text, p_version integer, p_verified boolean, p_reason text) from anon;
grant execute on function public.buklod_bsoc_mark_playbook_qa_v1(p_playbook_id text, p_version integer, p_verified boolean, p_reason text) to authenticated;

revoke all on function public.buklod_bsoc_set_playbook_executor_ready_v1(p_playbook_id text, p_version integer, p_ready boolean, p_reason text) from public;
revoke all on function public.buklod_bsoc_set_playbook_executor_ready_v1(p_playbook_id text, p_version integer, p_ready boolean, p_reason text) from anon;
grant execute on function public.buklod_bsoc_set_playbook_executor_ready_v1(p_playbook_id text, p_version integer, p_ready boolean, p_reason text) to authenticated;

commit;

