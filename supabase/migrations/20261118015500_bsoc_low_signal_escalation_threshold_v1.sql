-- Isolated DEV candidate; NOT applied to production.
-- Existing source is a read-only exact definition of the live BSOC processor.
-- Preserve all verified recovery, security, incident, and ERROR-level gates.
CREATE OR REPLACE FUNCTION public.buklod_bsoc_process_closed_loop_v1(p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select
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
    where r.state in ('REMOTE_RECOVERY_RUNNING','VERIFYING')
      and exists (
        select 1
        from public.bsoc_recovery_commands c
        where c.recovery_run_id=r.id
          and c.status in ('PENDING','DELIVERED')
          and c.expires_at<=now()
      )
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
      -- Do not auto-escalate isolated low-severity deferred AUTH timeouts
      -- when the client cannot prove an actual backend outage. Preserve
      -- telemetry and escalate repeated, confirmed, security, or failed
      -- recovery events through the unchanged remaining gates.
      and not (
        he.severity in ('INFO','WARNING')
        and he.health_category = 'AUTH'
        and he.privacy_classification = 'MINIMAL'
        and coalesce(he.network_state,'UNKNOWN') in ('UNKNOWN','OFFLINE','DEGRADED')
        and he.repeat_count < 3
        and he.local_self_heal_attempted = false
        and he.lifecycle_state in ('DETECTED','LOCAL_RECOVERY_ATTEMPTED')
      )
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
$function$

