-- BUKLOD BSOC Closed-Loop Self-Heal Correlation / Read Models R14

-- Incident correlation suppresses per-user recovery storms; unresolved events escalate with diagnostics.

begin;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_correlate_health_incidents_v1(p_threshold integer DEFAULT 20, p_window_minutes integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  threshold_value integer := greatest(2,least(coalesce(p_threshold,20),1000));
  window_value integer := greatest(1,least(coalesce(p_window_minutes,5),60));
  g record;
  v_cluster_id uuid;
  v_incident_id uuid;
  incident_result jsonb;
  support_code text;
  created_incidents integer := 0;
  updated_clusters integer := 0;
  linked_events integer := 0;
  total_linked integer := 0;
begin
  if actor is null or not public.buklod_bsoc_can('bsoc.incidents.manage') then
    raise exception 'BUKLOD BSOC incident-manage permission required';
  end if;

  for g in
    select
      e.correlation_key,e.app_id,e.app_version,e.platform,e.environment,
      e.route_module,e.error_signature,
      min(e.first_seen_at) first_seen_at,max(e.last_seen_at) last_seen_at,
      sum(e.repeat_count)::integer occurrence_count,
      count(distinct e.user_id)::integer affected_user_count
    from public.bsoc_health_events e
    where e.last_seen_at>=now()-make_interval(mins=>window_value)
      and e.incident_id is null
      and e.lifecycle_state<>'AUTO_HEALED'
    group by
      e.correlation_key,e.app_id,e.app_version,e.platform,e.environment,
      e.route_module,e.error_signature
    having count(distinct e.user_id)>=threshold_value
  loop
    perform pg_advisory_xact_lock(hashtext(
      g.environment||':'||g.app_id||':'||g.correlation_key
    ));

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
        correlation_key,app_id,app_version,platform,environment,route_module,error_signature,
        first_seen_at,last_seen_at,occurrence_count,affected_user_count
      )
      values(
        g.correlation_key,g.app_id,g.app_version,g.platform,g.environment,g.route_module,g.error_signature,
        g.first_seen_at,g.last_seen_at,g.occurrence_count,g.affected_user_count
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
      support_code:='AUTO-'||upper(substr(md5(
        g.environment||':'||g.app_id||':'||g.correlation_key
      ),1,10));

      incident_result:=public.buklod_bsoc_create_incident_v1(
        'P1'::public.incident_severity,
        'SELF_HEAL',
        left(g.app_id||' degradation: '||g.error_signature,180),
        'Correlated BSOC health-event cluster. Root cause not assumed.',
        g.environment,
        g.app_id,
        g.app_version,
        null,
        case when g.platform in ('android','ios','web','server','other') then g.platform else 'other' end,
        g.route_module,
        'SERVICE_UNAVAILABLE',
        support_code,
        null,
        'Automatic incident correlation threshold reached'
      );

      v_incident_id:=(incident_result->>'incident_id')::uuid;

      update public.bsoc_health_incident_clusters c
      set incident_id=v_incident_id,updated_at=now()
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

CREATE OR REPLACE FUNCTION public.buklod_bsoc_escalate_health_event_v1(p_event_id uuid, p_recommended_next_action text DEFAULT 'Review unresolved recovery diagnostics'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  e public.bsoc_health_events%rowtype;
  case_id uuid;
begin
  if actor is null or not (
    public.buklod_bsoc_can('bsoc.support.manage')
    or public.buklod_bsoc_can('bsoc.incidents.manage')
  ) then
    raise exception 'BUKLOD BSOC support/incident permission required';
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
      'event_id',e.id,'incident_id',e.incident_id,
      'support_case_created',false,'state','LINKED_TO_INCIDENT'
    );
  end if;

  if e.support_case_id is not null then
    return jsonb_build_object(
      'event_id',e.id,'support_case_id',e.support_case_id,
      'support_case_created',false,'state','ESCALATED'
    );
  end if;

  insert into public.user_feedback(
    user_id,category,title,message,status,app_version,app_environment,diagnostics
  )
  values(
    e.user_id,
    'bug'::public.feedback_category,
    left('Auto escalation: '||e.error_signature,140),
    'BUKLOD detected an unresolved recoverable technical issue. Operational diagnostics were attached automatically.',
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
      'recommended_next_action',left(coalesce(p_recommended_next_action,''),240)
    )
  )
  returning id into case_id;

  update public.bsoc_health_events
  set support_case_id=case_id,lifecycle_state='ESCALATED',updated_at=now()
  where id=e.id;

  insert into public.bsoc_recovery_audit(
    initiator_id,target_user_id,app_id,route_module,event_id,reason,
    before_state,actions,after_state,verification_result,attempt_count,support_case_id
  )
  values(
    actor,e.user_id,e.app_id,e.route_module,e.id,
    'unresolved health event escalated to support',
    jsonb_build_object('lifecycle_state',e.lifecycle_state),
    jsonb_build_array(jsonb_build_object('action','CREATE_SUPPORT_CASE')),
    jsonb_build_object('support_case_id',case_id),
    'NOT_RUN',0,case_id
  );

  return jsonb_build_object(
    'event_id',e.id,'support_case_id',case_id,
    'support_case_created',true,'state','ESCALATED'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_health_event_list_v1(p_hours integer DEFAULT 24, p_state text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(event_id uuid, user_ref text, app_id text, app_version text, platform text, environment text, route_module text, health_category text, severity text, safe_error_code text, error_signature text, repeat_count integer, local_self_heal_result text, lifecycle_state text, incident_id uuid, support_case_id uuid, first_seen_at timestamp with time zone, last_seen_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h integer:=greatest(1,least(coalesce(p_hours,24),720));
  lim integer:=greatest(1,least(coalesce(p_limit,100),500));
  state_filter text:=nullif(upper(trim(coalesce(p_state,''))),'');
begin
  if auth.uid() is null or not public.buklod_bsoc_can('bsoc.observability.read') then
    raise exception 'BUKLOD BSOC observability permission required';
  end if;

  return query
  select e.id,e.user_ref,e.app_id,e.app_version,e.platform,e.environment,e.route_module,
         e.health_category,e.severity,e.safe_error_code,e.error_signature,e.repeat_count,
         e.local_self_heal_result,e.lifecycle_state,e.incident_id,e.support_case_id,
         e.first_seen_at,e.last_seen_at
  from public.bsoc_health_events e
  where e.last_seen_at>=now()-make_interval(hours=>h)
    and (state_filter is null or e.lifecycle_state=state_filter)
  order by
    case e.severity when 'CRITICAL' then 1 when 'ERROR' then 2 when 'WARNING' then 3 else 4 end,
    e.last_seen_at desc
  limit lim;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_health_overview_v1(p_hours integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  h integer := greatest(1,least(coalesce(p_hours,24),720));
  since_ts timestamptz := now()-make_interval(hours=>greatest(1,least(coalesce(p_hours,24),720)));
begin
  if actor is null or not public.buklod_bsoc_can('bsoc.observability.read') then
    raise exception 'BUKLOD BSOC observability permission required';
  end if;

  return jsonb_build_object(
    'generated_at',now(),
    'hours',h,
    'detected_issues',(select count(*) from public.bsoc_health_events where last_seen_at>=since_ts),
    'event_occurrences',(select coalesce(sum(repeat_count),0) from public.bsoc_health_events where last_seen_at>=since_ts),
    'local_self_heal_success',(select count(*) from public.bsoc_health_events where last_seen_at>=since_ts and local_self_heal_result='SUCCESS'),
    'remote_shadow_proposals',(select count(*) from public.bsoc_recovery_runs where started_at>=since_ts and state='SHADOW_PROPOSED'),
    'remote_auto_healed',(select count(*) from public.bsoc_recovery_runs where started_at>=since_ts and state='AUTO_HEALED'),
    'verification_failures',(select count(*) from public.bsoc_recovery_runs where started_at>=since_ts and verification_result='FAIL'),
    'escalated_events',(select count(*) from public.bsoc_health_events where last_seen_at>=since_ts and lifecycle_state='ESCALATED'),
    'incident_linked_events',(select count(*) from public.bsoc_health_events where last_seen_at>=since_ts and incident_id is not null),
    'support_cases_created',(select count(*) from public.bsoc_health_events where last_seen_at>=since_ts and support_case_id is not null),
    'top_signatures',coalesce((
      select jsonb_agg(jsonb_build_object(
        'error_signature',q.error_signature,
        'app_id',q.app_id,
        'occurrences',q.occurrences,
        'affected_users',q.affected_users,
        'last_seen_at',q.last_seen_at
      ) order by q.occurrences desc)
      from (
        select error_signature,app_id,sum(repeat_count)::bigint occurrences,
               count(distinct user_id)::bigint affected_users,max(last_seen_at) last_seen_at
        from public.bsoc_health_events
        where last_seen_at>=since_ts
        group by error_signature,app_id
        order by occurrences desc
        limit 10
      ) q
    ),'[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_recovery_run_list_v1(p_hours integer DEFAULT 24, p_limit integer DEFAULT 100)
 RETURNS TABLE(recovery_run_id uuid, event_id uuid, user_ref text, app_id text, route_module text, playbook_id text, playbook_version integer, mode text, state text, attempt_count integer, verification_result text, incident_id uuid, support_case_id uuid, started_at timestamp with time zone, finished_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h integer:=greatest(1,least(coalesce(p_hours,24),720));
  lim integer:=greatest(1,least(coalesce(p_limit,100),500));
begin
  if auth.uid() is null or not public.buklod_bsoc_can('bsoc.observability.read') then
    raise exception 'BUKLOD BSOC observability permission required';
  end if;

  return query
  select r.id,r.event_id,e.user_ref,r.app_id,r.route_module,r.playbook_id,r.playbook_version,
         r.mode,r.state,r.attempt_count,r.verification_result,r.incident_id,r.support_case_id,
         r.started_at,r.finished_at
  from public.bsoc_recovery_runs r
  join public.bsoc_health_events e on e.id=r.event_id
  where r.started_at>=now()-make_interval(hours=>h)
  order by r.started_at desc
  limit lim;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_bsoc_user_health_snapshot_v1(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.buklod_bsoc_can('bsoc.user360.read') then
    raise exception 'BUKLOD BSOC User 360 permission required';
  end if;

  return jsonb_build_object(
    'generated_at',now(),
    'user_id',p_user_id,
    'latest_event',(
      select jsonb_build_object(
        'app_id',e.app_id,
        'app_version',e.app_version,
        'platform',e.platform,
        'route_module',e.route_module,
        'health_category',e.health_category,
        'severity',e.severity,
        'safe_error_code',e.safe_error_code,
        'error_signature',e.error_signature,
        'network_state',e.network_state,
        'auth_state',e.auth_state,
        'sync_state',e.sync_state,
        'local_storage_state',e.local_storage_state,
        'notification_state',e.notification_state,
        'pending_work_count',e.pending_work_count,
        'local_self_heal_result',e.local_self_heal_result,
        'lifecycle_state',e.lifecycle_state,
        'incident_id',e.incident_id,
        'support_case_id',e.support_case_id,
        'last_seen_at',e.last_seen_at
      )
      from public.bsoc_health_events e
      where e.user_id=p_user_id
      order by e.last_seen_at desc
      limit 1
    ),
    'categories',coalesce((
      select jsonb_agg(x order by x->>'health_category')
      from (
        select distinct on (e.health_category)
          jsonb_build_object(
            'health_category',e.health_category,
            'severity',e.severity,
            'state',e.lifecycle_state,
            'error_signature',e.error_signature,
            'last_seen_at',e.last_seen_at
          ) x
        from public.bsoc_health_events e
        where e.user_id=p_user_id
        order by e.health_category,e.last_seen_at desc
      ) q
    ),'[]'::jsonb),
    'recent_recoveries',coalesce((
      select jsonb_agg(jsonb_build_object(
        'recovery_run_id',r.id,
        'playbook_id',r.playbook_id,
        'playbook_version',r.playbook_version,
        'state',r.state,
        'mode',r.mode,
        'verification_result',r.verification_result,
        'started_at',r.started_at,
        'finished_at',r.finished_at
      ) order by r.started_at desc)
      from (
        select * from public.bsoc_recovery_runs rr
        where rr.target_user_id=p_user_id
        order by rr.started_at desc
        limit 10
      ) r
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.buklod_bsoc_correlate_health_incidents_v1(p_threshold integer, p_window_minutes integer) from public;
revoke all on function public.buklod_bsoc_correlate_health_incidents_v1(p_threshold integer, p_window_minutes integer) from anon;
grant execute on function public.buklod_bsoc_correlate_health_incidents_v1(p_threshold integer, p_window_minutes integer) to authenticated;

revoke all on function public.buklod_bsoc_escalate_health_event_v1(p_event_id uuid, p_recommended_next_action text) from public;
revoke all on function public.buklod_bsoc_escalate_health_event_v1(p_event_id uuid, p_recommended_next_action text) from anon;
grant execute on function public.buklod_bsoc_escalate_health_event_v1(p_event_id uuid, p_recommended_next_action text) to authenticated;

revoke all on function public.buklod_bsoc_health_event_list_v1(p_hours integer, p_state text, p_limit integer) from public;
revoke all on function public.buklod_bsoc_health_event_list_v1(p_hours integer, p_state text, p_limit integer) from anon;
grant execute on function public.buklod_bsoc_health_event_list_v1(p_hours integer, p_state text, p_limit integer) to authenticated;

revoke all on function public.buklod_bsoc_health_overview_v1(p_hours integer) from public;
revoke all on function public.buklod_bsoc_health_overview_v1(p_hours integer) from anon;
grant execute on function public.buklod_bsoc_health_overview_v1(p_hours integer) to authenticated;

revoke all on function public.buklod_bsoc_recovery_run_list_v1(p_hours integer, p_limit integer) from public;
revoke all on function public.buklod_bsoc_recovery_run_list_v1(p_hours integer, p_limit integer) from anon;
grant execute on function public.buklod_bsoc_recovery_run_list_v1(p_hours integer, p_limit integer) to authenticated;

revoke all on function public.buklod_bsoc_user_health_snapshot_v1(p_user_id uuid) from public;
revoke all on function public.buklod_bsoc_user_health_snapshot_v1(p_user_id uuid) from anon;
grant execute on function public.buklod_bsoc_user_health_snapshot_v1(p_user_id uuid) to authenticated;

commit;

