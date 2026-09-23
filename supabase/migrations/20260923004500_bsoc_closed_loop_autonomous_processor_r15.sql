-- BUKLOD BSOC Closed-Loop Autonomous Processor R15
-- DETECT -> DIAGNOSE -> HEAL -> VERIFY -> ESCALATE ONLY IF UNRESOLVED
--
-- Safety:
-- - automatic execution is limited to named LOW-risk playbooks
-- - ENABLED playbooks still require QA verification + executor_ready + no kill switch
-- - finance/security/role/account-delete patterns are human-controlled only
-- - AUTO_HEALED is never written here; only the verification RPC can produce it
-- - shared failures correlate before individual support escalation
-- - Main remains independent of BSOC runtime availability

begin;

create or replace function public.buklod_bsoc_system_escalate_health_event_v1(
  p_event_id uuid,
  p_reason text default 'unresolved closed-loop recovery'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  e public.bsoc_health_events%rowtype;
  case_id uuid;
begin
  select *
  into e
  from public.bsoc_health_events
  where id=p_event_id
  for update;

  if not found then
    return null;
  end if;

  if e.incident_id is not null then
    update public.bsoc_health_events
    set lifecycle_state='LINKED_TO_INCIDENT',
        updated_at=now()
    where id=e.id;

    return null;
  end if;

  if e.support_case_id is not null then
    return e.support_case_id;
  end if;

  insert into public.user_feedback(
    user_id,
    category,
    title,
    message,
    status,
    app_version,
    app_environment,
    diagnostics
  )
  values(
    e.user_id,
    'bug'::public.feedback_category,
    left('Auto escalation: '||e.error_signature,140),
    'BUKLOD detected an unresolved technical issue after bounded recovery. Operational diagnostics were attached automatically.',
    'new'::public.feedback_status,
    e.app_version,
    e.environment,
    jsonb_build_object(
      'source','BSOC_CLOSED_LOOP_SELF_HEAL',
      'health_event_id',e.id,
      'app_id',e.app_id,
      'platform',e.platform,
      'route_module',e.route_module,
      'health_category',e.health_category,
      'safe_error_code',e.safe_error_code,
      'error_signature',e.error_signature,
      'first_detected',e.first_seen_at,
      'last_detected',e.last_seen_at,
      'repeat_count',e.repeat_count,
      'local_self_heal_result',e.local_self_heal_result,
      'lifecycle_state',e.lifecycle_state,
      'recommended_next_action',left(coalesce(p_reason,''),240)
    )
  )
  returning id into case_id;

  update public.bsoc_health_events
  set support_case_id=case_id,
      lifecycle_state='ESCALATED',
      updated_at=now()
  where id=e.id;

  insert into public.bsoc_recovery_audit(
    initiator_id,
    target_user_id,
    app_id,
    route_module,
    event_id,
    reason,
    before_state,
    actions,
    after_state,
    verification_result,
    attempt_count,
    support_case_id
  )
  values(
    null,
    e.user_id,
    e.app_id,
    e.route_module,
    e.id,
    left(coalesce(p_reason,'unresolved closed-loop recovery'),500),
    jsonb_build_object('lifecycle_state',e.lifecycle_state),
    jsonb_build_array(jsonb_build_object('action','CREATE_SUPPORT_CASE')),
    jsonb_build_object('support_case_id',case_id),
    'NOT_RUN',
    0,
    case_id
  );

  return case_id;
end;
$function$;

revoke all on function public.buklod_bsoc_system_escalate_health_event_v1(uuid,text)
from public, anon, authenticated;
grant execute on function public.buklod_bsoc_system_escalate_health_event_v1(uuid,text)
to service_role;


create or replace function public.buklod_bsoc_correlate_health_incidents_system_v1(
  p_threshold integer default 20,
  p_window_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  threshold_value integer := greatest(2,least(coalesce(p_threshold,20),1000));
  window_value integer := greatest(1,least(coalesce(p_window_minutes,5),60));
  g record;
  v_cluster_id uuid;
  v_incident_id uuid;
  v_support_code text;
  created_incidents integer := 0;
  updated_clusters integer := 0;
  linked_events integer := 0;
  total_linked integer := 0;
begin
  for g in
    select
      e.correlation_key,
      e.app_id,
      e.app_version,
      e.platform,
      e.environment,
      e.route_module,
      e.error_signature,
      min(e.first_seen_at) first_seen_at,
      max(e.last_seen_at) last_seen_at,
      sum(e.repeat_count)::integer occurrence_count,
      count(distinct e.user_id)::integer affected_user_count
    from public.bsoc_health_events e
    where e.last_seen_at>=now()-make_interval(mins=>window_value)
      and e.incident_id is null
      and e.lifecycle_state<>'AUTO_HEALED'
    group by
      e.correlation_key,
      e.app_id,
      e.app_version,
      e.platform,
      e.environment,
      e.route_module,
      e.error_signature
    having count(distinct e.user_id)>=threshold_value
  loop
    perform pg_advisory_xact_lock(
      hashtext(g.environment||':'||g.app_id||':'||g.correlation_key)
    );

    v_cluster_id:=null;
    v_incident_id:=null;

    select c.id,c.incident_id
    into v_cluster_id,v_incident_id
    from public.bsoc_health_incident_clusters c
    where c.correlation_key=g.correlation_key
      and c.app_id=g.app_id
      and coalesce(c.environment,g.environment)=g.environment
      and c.status in ('OPEN','MONITORING')
      and c.last_seen_at>=now()-interval '30 minutes'
    order by c.last_seen_at desc
    limit 1
    for update;

    if v_cluster_id is null then
      insert into public.bsoc_health_incident_clusters(
        correlation_key,
        app_id,
        app_version,
        platform,
        environment,
        route_module,
        error_signature,
        first_seen_at,
        last_seen_at,
        occurrence_count,
        affected_user_count
      )
      values(
        g.correlation_key,
        g.app_id,
        g.app_version,
        g.platform,
        g.environment,
        g.route_module,
        g.error_signature,
        g.first_seen_at,
        g.last_seen_at,
        g.occurrence_count,
        g.affected_user_count
      )
      returning id into v_cluster_id;
    else
      update public.bsoc_health_incident_clusters c
      set first_seen_at=least(c.first_seen_at,g.first_seen_at),
          last_seen_at=greatest(c.last_seen_at,g.last_seen_at),
          occurrence_count=greatest(c.occurrence_count,g.occurrence_count),
          affected_user_count=greatest(c.affected_user_count,g.affected_user_count),
          platform=coalesce(c.platform,g.platform),
          environment=coalesce(c.environment,g.environment),
          updated_at=now()
      where c.id=v_cluster_id;

      updated_clusters:=updated_clusters+1;
    end if;

    if v_incident_id is null then
      v_support_code:='AUTO-'||upper(substr(md5(
        g.environment||':'||g.app_id||':'||g.correlation_key
      ),1,10));

      insert into public.pilot_incidents(
        severity,
        area,
        title,
        description,
        environment,
        app_version,
        platform,
        app_id,
        route,
        error_category,
        support_code,
        reported_by,
        operator_message
      )
      values(
        'P1'::public.incident_severity,
        'SELF_HEAL',
        left(g.app_id||' degradation: '||g.error_signature,180),
        'Correlated BSOC health-event cluster. Root cause not assumed.',
        g.environment,
        g.app_version,
        case when g.platform in ('android','ios','web','server','other')
             then g.platform else 'other' end,
        g.app_id,
        g.route_module,
        'SERVICE_UNAVAILABLE',
        v_support_code,
        null,
        'Created automatically by verified BSOC incident correlation.'
      )
      returning id into v_incident_id;

      insert into public.audit_logs(
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      values(
        null,
        'bsoc_auto_incident_create',
        'pilot_incident',
        v_incident_id::text,
        jsonb_build_object(
          'source','BSOC_CLOSED_LOOP_R15',
          'app_id',g.app_id,
          'error_signature',g.error_signature,
          'correlation_key',g.correlation_key,
          'affected_users',g.affected_user_count
        )
      );

      update public.bsoc_health_incident_clusters c
      set incident_id=v_incident_id,
          updated_at=now()
      where c.id=v_cluster_id;

      created_incidents:=created_incidents+1;
    end if;

    update public.bsoc_health_events e
    set incident_id=v_incident_id,
        lifecycle_state='LINKED_TO_INCIDENT',
        updated_at=now()
    where e.correlation_key=g.correlation_key
      and e.app_id=g.app_id
      and e.environment=g.environment
      and e.last_seen_at>=now()-make_interval(mins=>window_value)
      and e.incident_id is null;

    get diagnostics linked_events=row_count;
    total_linked:=total_linked+linked_events;
  end loop;

  return jsonb_build_object(
    'threshold',threshold_value,
    'window_minutes',window_value,
    'incidents_created',created_incidents,
    'clusters_updated',updated_clusters,
    'events_linked',total_linked
  );
end;
$function$;

revoke all on function public.buklod_bsoc_correlate_health_incidents_system_v1(integer,integer)
from public, anon, authenticated;
grant execute on function public.buklod_bsoc_correlate_health_incidents_system_v1(integer,integer)
to service_role;


create or replace function public.buklod_bsoc_process_closed_loop_v1(
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  lim integer:=greatest(1,least(coalesce(p_limit,200),1000));
  action_whitelist text[]:=array[
    'REQUEST_CLIENT_SESSION_REFRESH',
    'REQUEST_CLIENT_SYNC_RESUME',
    'REQUEST_CLIENT_ROUTE_RECOVERY',
    'REQUEST_CLIENT_PUSH_REFRESH',
    'REQUEST_CLIENT_ORG_RERESOLVE'
  ];
  v_expired integer:=0;
  v_shadow integer:=0;
  v_remote_started integer:=0;
  v_escalated integer:=0;
  v_skipped integer:=0;
  v_run_id uuid;
  v_recent integer;
  v_attempts integer;
  v_case uuid;
  v_corr jsonb;
  e public.bsoc_health_events%rowtype;
  pb public.bsoc_recovery_playbooks%rowtype;
  expired_run record;
begin
  /*
   * First correlate shared failures so individual users do not create a
   * recovery or support storm while one system incident is active.
   */
  v_corr:=public.buklod_bsoc_correlate_health_incidents_system_v1(20,5);

  /*
   * Commands that passed their verified execution window fail closed.
   * No timeout can become AUTO_HEALED.
   */
  for expired_run in
    select distinct
      r.id as recovery_run_id,
      r.event_id,
      r.target_user_id,
      r.app_id,
      r.route_module,
      r.playbook_id,
      r.playbook_version,
      r.before_state,
      r.proposed_actions,
      r.started_at,
      r.attempt_count
    from public.bsoc_recovery_runs r
    join public.bsoc_recovery_commands c
      on c.recovery_run_id=r.id
    where r.state in ('REMOTE_RECOVERY_RUNNING','VERIFYING')
      and c.status in ('PENDING','DELIVERED')
      and c.expires_at<=now()
    order by r.started_at
    limit lim
    for update of r skip locked
  loop
    update public.bsoc_recovery_commands
    set status='EXPIRED'
    where recovery_run_id=expired_run.recovery_run_id
      and status in ('PENDING','DELIVERED');

    update public.bsoc_recovery_runs
    set state='RECOVERY_FAILED',
        verification_result='FAIL',
        failure_reason='RECOVERY_TIMEOUT',
        finished_at=now(),
        updated_at=now()
    where id=expired_run.recovery_run_id
      and state in ('REMOTE_RECOVERY_RUNNING','VERIFYING');

    update public.bsoc_health_events
    set lifecycle_state='RECOVERY_FAILED',
        updated_at=now()
    where id=expired_run.event_id
      and lifecycle_state not in ('AUTO_HEALED','LINKED_TO_INCIDENT');

    insert into public.bsoc_recovery_audit(
      initiator_id,
      target_user_id,
      app_id,
      route_module,
      playbook_id,
      playbook_version,
      recovery_run_id,
      event_id,
      reason,
      before_state,
      actions,
      after_state,
      verification_result,
      duration_ms,
      attempt_count
    )
    values(
      null,
      expired_run.target_user_id,
      expired_run.app_id,
      expired_run.route_module,
      expired_run.playbook_id,
      expired_run.playbook_version,
      expired_run.recovery_run_id,
      expired_run.event_id,
      'remote recovery timed out before verification proof',
      expired_run.before_state,
      expired_run.proposed_actions,
      jsonb_build_object('failure_reason','RECOVERY_TIMEOUT'),
      'FAIL',
      greatest(
        0,
        (extract(epoch from (now()-expired_run.started_at))*1000)::integer
      ),
      expired_run.attempt_count
    );

    v_expired:=v_expired+1;
  end loop;

  /*
   * Process only unresolved, non-incident health events. Local SUCCESS is
   * intentionally left alone: no support case, no remote action, no fake
   * AUTO_HEALED transition.
   */
  for e in
    select he.*
    from public.bsoc_health_events he
    where he.incident_id is null
      and he.support_case_id is null
      and he.lifecycle_state in (
        'DETECTED',
        'LOCAL_RECOVERY_ATTEMPTED',
        'REMOTE_RECOVERY_ELIGIBLE',
        'RECOVERY_FAILED'
      )
    order by
      case he.severity
        when 'CRITICAL' then 1
        when 'ERROR' then 2
        when 'WARNING' then 3
        else 4
      end,
      he.last_seen_at
    limit lim
    for update skip locked
  loop
    if e.local_self_heal_result='SUCCESS' then
      v_skipped:=v_skipped+1;
      continue;
    end if;

    if e.privacy_classification='SECURITY_REVIEW_REQUIRED'
       or e.auth_state='LOCKED'
       or e.error_signature like 'FINANCE%'
       or e.error_signature like 'PAYOUT%'
       or e.error_signature like 'ROLE_%'
       or e.error_signature like 'ACCOUNT_DELETE%'
       or e.error_signature like 'SECURITY_%'
       or e.error_signature like 'OWNERSHIP_%'
       or e.error_signature like 'BREAK_GLASS%' then
      v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
        e.id,
        'Human-controlled safety boundary. Automatic recovery prohibited.'
      );

      if v_case is not null then
        v_escalated:=v_escalated+1;
      end if;

      continue;
    end if;

    pb:=null;

    select p.*
    into pb
    from public.bsoc_recovery_playbooks p
    where p.health_category=e.health_category
      and p.error_signature=e.error_signature
      and (p.app_id is null or p.app_id=e.app_id)
      and p.risk_level='LOW'
      and p.action_kind=any(action_whitelist)
      and not p.kill_switch
      and p.mode<>'DISABLED'
    order by
      case when p.app_id=e.app_id then 0 else 1 end,
      p.version desc
    limit 1;

    if not found then
      if e.lifecycle_state='RECOVERY_FAILED'
         or e.last_seen_at<=now()-interval '2 minutes' then
        v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
          e.id,
          'No eligible LOW-risk automatic recovery playbook.'
        );

        if v_case is not null then
          v_escalated:=v_escalated+1;
        end if;
      else
        v_skipped:=v_skipped+1;
      end if;

      continue;
    end if;

    select count(*)
    into v_attempts
    from public.bsoc_recovery_runs r
    where r.event_id=e.id
      and r.playbook_id=pb.playbook_id;

    if v_attempts>=pb.max_attempts then
      v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
        e.id,
        'Automatic recovery reached the playbook max-attempt limit.'
      );

      if v_case is not null then
        v_escalated:=v_escalated+1;
      end if;

      continue;
    end if;

    select count(*)
    into v_recent
    from public.bsoc_recovery_runs r
    where r.target_user_id=e.user_id
      and r.playbook_id=pb.playbook_id
      and r.app_id=e.app_id
      and r.started_at>=now()-make_interval(secs=>pb.cooldown_seconds);

    if v_recent>0 then
      if pb.mode='SHADOW'
         and e.last_seen_at<=now()-interval '2 minutes' then
        v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
          e.id,
          'Playbook remains in SHADOW and the user is still unresolved.'
        );

        if v_case is not null then
          v_escalated:=v_escalated+1;
        end if;
      else
        v_skipped:=v_skipped+1;
      end if;

      continue;
    end if;

    if pb.mode='SHADOW' then
      insert into public.bsoc_recovery_runs(
        event_id,
        playbook_id,
        playbook_version,
        mode,
        state,
        initiated_by,
        target_user_id,
        app_id,
        route_module,
        attempt_count,
        before_state,
        proposed_actions,
        verification_result
      )
      values(
        e.id,
        pb.playbook_id,
        pb.version,
        'SHADOW',
        'SHADOW_PROPOSED',
        null,
        e.user_id,
        e.app_id,
        e.route_module,
        0,
        jsonb_build_object(
          'auth_state',e.auth_state,
          'sync_state',e.sync_state,
          'network_state',e.network_state,
          'pending_work_count',e.pending_work_count,
          'lifecycle_state',e.lifecycle_state
        ),
        jsonb_build_array(jsonb_build_object(
          'would_execute',pb.action_kind,
          'timeout_seconds',pb.timeout_seconds
        )),
        'NOT_RUN'
      )
      returning id into v_run_id;

      update public.bsoc_health_events
      set lifecycle_state='REMOTE_RECOVERY_ELIGIBLE',
          updated_at=now()
      where id=e.id;

      insert into public.bsoc_recovery_audit(
        initiator_id,
        target_user_id,
        app_id,
        route_module,
        playbook_id,
        playbook_version,
        recovery_run_id,
        event_id,
        reason,
        before_state,
        actions,
        verification_result,
        attempt_count
      )
      values(
        null,
        e.user_id,
        e.app_id,
        e.route_module,
        pb.playbook_id,
        pb.version,
        v_run_id,
        e.id,
        'automatic SHADOW evaluation; no mutation executed',
        jsonb_build_object(
          'auth_state',e.auth_state,
          'sync_state',e.sync_state,
          'network_state',e.network_state,
          'pending_work_count',e.pending_work_count
        ),
        jsonb_build_array(jsonb_build_object('would_execute',pb.action_kind)),
        'NOT_RUN',
        0
      );

      v_shadow:=v_shadow+1;

      /*
       * SHADOW proves decision quality but does not heal a user. After a
       * short grace window unresolved users are routed to human support.
       */
      if e.last_seen_at<=now()-interval '2 minutes' then
        v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
          e.id,
          'Playbook is in SHADOW. User remains unresolved and requires support.'
        );

        if v_case is not null then
          v_escalated:=v_escalated+1;
        end if;
      end if;

      continue;
    end if;

    if pb.mode='ENABLED'
       and pb.qa_verified_at is not null
       and pb.executor_ready then
      insert into public.bsoc_recovery_runs(
        event_id,
        playbook_id,
        playbook_version,
        mode,
        state,
        initiated_by,
        target_user_id,
        app_id,
        route_module,
        attempt_count,
        before_state,
        proposed_actions,
        verification_result
      )
      values(
        e.id,
        pb.playbook_id,
        pb.version,
        'ENABLED',
        'REMOTE_RECOVERY_RUNNING',
        null,
        e.user_id,
        e.app_id,
        e.route_module,
        1,
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
      returning id into v_run_id;

      insert into public.bsoc_recovery_commands(
        recovery_run_id,
        target_user_id,
        app_id,
        action_kind,
        action_payload,
        expires_at
      )
      values(
        v_run_id,
        e.user_id,
        e.app_id,
        pb.action_kind,
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
      set lifecycle_state='REMOTE_RECOVERY_RUNNING',
          updated_at=now()
      where id=e.id;

      insert into public.bsoc_recovery_audit(
        initiator_id,
        target_user_id,
        app_id,
        route_module,
        playbook_id,
        playbook_version,
        recovery_run_id,
        event_id,
        reason,
        before_state,
        actions,
        verification_result,
        attempt_count
      )
      values(
        null,
        e.user_id,
        e.app_id,
        e.route_module,
        pb.playbook_id,
        pb.version,
        v_run_id,
        e.id,
        'automatic verified LOW-risk recovery queued',
        jsonb_build_object(
          'auth_state',e.auth_state,
          'sync_state',e.sync_state,
          'network_state',e.network_state,
          'pending_work_count',e.pending_work_count
        ),
        jsonb_build_array(jsonb_build_object('queued',pb.action_kind)),
        'PENDING',
        1
      );

      v_remote_started:=v_remote_started+1;
      continue;
    end if;

    /*
     * RESTRICTED or not-yet-verified executors never mutate automatically.
     */
    if e.lifecycle_state='RECOVERY_FAILED'
       or e.last_seen_at<=now()-interval '2 minutes' then
      v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
        e.id,
        'Automatic playbook is restricted or not fully verified/executor-ready.'
      );

      if v_case is not null then
        v_escalated:=v_escalated+1;
      end if;
    else
      v_skipped:=v_skipped+1;
    end if;
  end loop;

  /*
   * A timeout from an ENABLED remote recovery is unresolved and must be
   * escalated unless incident correlation already absorbed it.
   */
  for e in
    select he.*
    from public.bsoc_health_events he
    where he.lifecycle_state='RECOVERY_FAILED'
      and he.incident_id is null
      and he.support_case_id is null
      and he.updated_at<=now()-interval '15 seconds'
    order by he.updated_at
    limit lim
    for update skip locked
  loop
    v_case:=public.buklod_bsoc_system_escalate_health_event_v1(
      e.id,
      'Verified remote recovery failed or timed out.'
    );

    if v_case is not null then
      v_escalated:=v_escalated+1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed_at',now(),
    'correlation',v_corr,
    'expired_recoveries',v_expired,
    'shadow_proposals',v_shadow,
    'remote_recoveries_started',v_remote_started,
    'support_escalations',v_escalated,
    'skipped_or_waiting',v_skipped
  );
end;
$function$;

revoke all on function public.buklod_bsoc_process_closed_loop_v1(integer)
from public, anon, authenticated;
grant execute on function public.buklod_bsoc_process_closed_loop_v1(integer)
to service_role;


create or replace function public.buklod_bsoc_closed_loop_scheduler_status_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor uuid:=auth.uid();
  job_row record;
begin
  if actor is null
     or not (
       public.buklod_bsoc_can('bsoc.observability.read')
       or public.buklod_is_system_admin()
     ) then
    raise exception 'BUKLOD BSOC observability permission required';
  end if;

  select
    j.jobid,
    j.jobname,
    j.schedule,
    j.active
  into job_row
  from cron.job j
  where j.jobname='buklod-bsoc-closed-loop-r15'
  order by j.jobid desc
  limit 1;

  return jsonb_build_object(
    'job_present',job_row.jobid is not null,
    'job_id',job_row.jobid,
    'job_name',job_row.jobname,
    'schedule',job_row.schedule,
    'active',coalesce(job_row.active,false),
    'playbooks_enabled',(
      select count(*)
      from public.bsoc_recovery_playbooks
      where mode='ENABLED'
        and not kill_switch
        and qa_verified_at is not null
        and executor_ready
    ),
    'playbooks_shadow',(
      select count(*)
      from public.bsoc_recovery_playbooks
      where mode='SHADOW'
        and not kill_switch
    )
  );
end;
$function$;

revoke all on function public.buklod_bsoc_closed_loop_scheduler_status_v1()
from public, anon;
grant execute on function public.buklod_bsoc_closed_loop_scheduler_status_v1()
to authenticated;


do $schedule$
declare
  existing_job bigint;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname='buklod-bsoc-closed-loop-r15'
  loop
    perform cron.unschedule(existing_job);
  end loop;

  perform cron.schedule(
    'buklod-bsoc-closed-loop-r15',
    '* * * * *',
    'select public.buklod_bsoc_process_closed_loop_v1(200);'
  );
end;
$schedule$;

commit;
