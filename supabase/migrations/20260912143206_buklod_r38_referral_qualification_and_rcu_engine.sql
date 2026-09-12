-- R38 referral qualification and RCU accrual engine.
-- GENERAL-user qualification only: verified account + general activities/days.
-- No Attendance, Reports, Classroom, Organization, purchase, ad-view, or Show Faith requirement.

create or replace function private.buklod_r38_audit_v1(
  p_actor uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb default null,
  p_change jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_event_key text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into private.buklod_r38_economy_audit_log(
    actor_user_id,action,target_type,target_id,before_state,change_state,after_state,reason,event_key
  ) values (
    p_actor,left(coalesce(p_action,'UNKNOWN'),120),left(coalesce(p_target_type,'UNKNOWN'),120),
    left(coalesce(p_target_id,''),240),p_before,p_change,p_after,p_reason,p_event_key
  )
  on conflict (event_key) do nothing;
end;
$function$;

revoke all on function private.buklod_r38_audit_v1(uuid,text,text,text,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated;

create or replace function private.buklod_r38_refresh_referral_state_v1(p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ref public.buklod_referrals%rowtype;
  v_old private.buklod_r38_referral_state%rowtype;
  v_verified boolean := false;
  v_verified_at timestamptz;
  v_days integer := 0;
  v_activities integer := 0;
  v_min_days integer := 3;
  v_min_activities integer := 3;
  v_day_threshold_at timestamptz;
  v_activity_threshold_at timestamptz;
  v_qualified_at timestamptz;
  v_window_end timestamptz;
  v_state text := 'JOINED';
  v_fraud_blocked boolean := false;
  v_cfg jsonb := private.buklod_r38_policy_config_v1();
  v_after jsonb;
begin
  select * into v_ref
  from public.buklod_referrals
  where referred_id=p_referred_user_id
  order by created_at asc
  limit 1;

  if not found then
    return jsonb_build_object('found',false);
  end if;

  v_min_days := greatest(coalesce((v_cfg->'referral'->>'qualification_active_days')::integer,3),1);
  v_min_activities := greatest(coalesce((v_cfg->'referral'->>'qualification_activities')::integer,3),1);

  select
    (u.confirmed_at is not null or u.email_confirmed_at is not null or u.phone_confirmed_at is not null),
    coalesce(u.confirmed_at,u.email_confirmed_at,u.phone_confirmed_at)
  into v_verified,v_verified_at
  from auth.users u
  where u.id=v_ref.referred_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now());

  v_verified := coalesce(v_verified,false);

  select count(distinct (e.occurred_at at time zone 'Asia/Manila')::date)::integer,
         count(distinct (e.source_table||':'||e.source_id))::integer
  into v_days,v_activities
  from private.buklod_achievement_events_v2 e
  where e.user_id=v_ref.referred_id
    and e.occurred_at>=v_ref.created_at
    and e.event_type in ('community_post','devotion_completed','reading_completed','lesson_completed');

  select x.occurred_at into v_activity_threshold_at
  from (
    select e.occurred_at,
           row_number() over(order by e.occurred_at,e.id) as rn
    from private.buklod_achievement_events_v2 e
    where e.user_id=v_ref.referred_id
      and e.occurred_at>=v_ref.created_at
      and e.event_type in ('community_post','devotion_completed','reading_completed','lesson_completed')
  ) x
  where x.rn=v_min_activities
  limit 1;

  select x.first_at into v_day_threshold_at
  from (
    select min(e.occurred_at) as first_at,
           row_number() over(order by (e.occurred_at at time zone 'Asia/Manila')::date) as rn
    from private.buklod_achievement_events_v2 e
    where e.user_id=v_ref.referred_id
      and e.occurred_at>=v_ref.created_at
      and e.event_type in ('community_post','devotion_completed','reading_completed','lesson_completed')
    group by (e.occurred_at at time zone 'Asia/Manila')::date
  ) x
  where x.rn=v_min_days
  limit 1;

  select exists(
    select 1 from private.buklod_r38_fraud_flags f
    where (f.user_id in (v_ref.referrer_id,v_ref.referred_id) or f.referral_id=v_ref.id)
      and f.blocks_economics=true
      and f.status in ('OPEN','REVIEWING','CONFIRMED')
  ) into v_fraud_blocked;

  select * into v_old
  from private.buklod_r38_referral_state s
  where s.referral_id=v_ref.id;

  if v_fraud_blocked then
    v_state := 'BLOCKED_FRAUD';
  elsif v_verified and v_days>=v_min_days and v_activities>=v_min_activities then
    v_qualified_at := coalesce(
      v_old.qualified_at,
      greatest(v_ref.created_at,coalesce(v_verified_at,v_ref.created_at),coalesce(v_day_threshold_at,v_ref.created_at),coalesce(v_activity_threshold_at,v_ref.created_at))
    );
    v_window_end := v_qualified_at + make_interval(months=>private.buklod_r38_referral_window_months_v1());
    if now()>v_window_end then
      v_state := 'EARNING_WINDOW_ENDED';
    else
      v_state := 'ACTIVE_REFERRAL';
    end if;
  elsif v_verified or v_days>0 or v_activities>0 then
    v_state := 'QUALIFYING';
  else
    v_state := 'JOINED';
  end if;

  insert into private.buklod_r38_referral_state(
    referral_id,referrer_user_id,referred_user_id,canonical_state,joined_at,
    account_verified,meaningful_active_days,qualifying_activity_count,
    qualified_at,earning_window_start,earning_window_end,fraud_blocked_at,last_evaluated_at,metadata
  ) values (
    v_ref.id,v_ref.referrer_id,v_ref.referred_id,v_state,v_ref.created_at,
    v_verified,v_days,v_activities,
    v_qualified_at,v_qualified_at,v_window_end,
    case when v_fraud_blocked then coalesce(v_old.fraud_blocked_at,now()) else null end,
    now(),
    jsonb_build_object(
      'qualification_activity_types',jsonb_build_array('community_post','devotion_completed','reading_completed','lesson_completed'),
      'qualification_active_days_required',v_min_days,
      'qualification_activities_required',v_min_activities,
      'general_user_only',true
    )
  )
  on conflict(referral_id) do update set
    canonical_state=excluded.canonical_state,
    account_verified=excluded.account_verified,
    meaningful_active_days=excluded.meaningful_active_days,
    qualifying_activity_count=excluded.qualifying_activity_count,
    qualified_at=coalesce(private.buklod_r38_referral_state.qualified_at,excluded.qualified_at),
    earning_window_start=coalesce(private.buklod_r38_referral_state.earning_window_start,excluded.earning_window_start),
    earning_window_end=coalesce(private.buklod_r38_referral_state.earning_window_end,excluded.earning_window_end),
    fraud_blocked_at=excluded.fraud_blocked_at,
    last_evaluated_at=now(),
    metadata=private.buklod_r38_referral_state.metadata||excluded.metadata,
    updated_at=now();

  select to_jsonb(s) into v_after from private.buklod_r38_referral_state s where s.referral_id=v_ref.id;

  if v_old.referral_id is null or v_old.canonical_state is distinct from v_state then
    perform private.buklod_r38_audit_v1(
      null,'REFERRAL_STATE_EVALUATED','REFERRAL',v_ref.id::text,
      case when v_old.referral_id is null then null else to_jsonb(v_old) end,
      jsonb_build_object('new_state',v_state),v_after,
      'Server-computed GENERAL referral qualification',
      'referral-state:'||v_ref.id::text||':'||v_state||':'||coalesce(v_qualified_at::text,'none')
    );
  end if;

  return jsonb_build_object(
    'found',true,'referral_id',v_ref.id,'referrer_user_id',v_ref.referrer_id,'referred_user_id',v_ref.referred_id,
    'state',v_state,'account_verified',v_verified,'active_days',v_days,'qualifying_activities',v_activities,
    'qualified_at',v_qualified_at,'earning_window_end',v_window_end,'fraud_blocked',v_fraud_blocked
  );
end;
$function$;

revoke all on function private.buklod_r38_refresh_referral_state_v1(uuid) from public,anon,authenticated;

create or replace function private.buklod_r38_sync_rcu_for_bcu_v1(p_bcu_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_bcu private.buklod_r36_bcu_ledger%rowtype;
  v_ref public.buklod_referrals%rowtype;
  v_state private.buklod_r38_referral_state%rowtype;
  v_factor numeric := 0;
  v_units numeric := 0;
  v_credit_exists boolean := false;
begin
  if not private.buklod_r38_flag_enabled_v1('rcu_accrual_enabled') then
    return;
  end if;

  select * into v_bcu from private.buklod_r36_bcu_ledger where id=p_bcu_ledger_id;
  if not found then return; end if;

  select * into v_ref from public.buklod_referrals
  where referred_id=v_bcu.user_id
  order by created_at asc limit 1;
  if not found then return; end if;

  perform private.buklod_r38_refresh_referral_state_v1(v_ref.referred_id);
  select * into v_state from private.buklod_r38_referral_state where referral_id=v_ref.id;
  if not found then return; end if;

  select exists(
    select 1 from private.buklod_r38_rcu_ledger r
    where r.referrer_user_id=v_ref.referrer_id and r.event_key='bcu:'||v_bcu.id::text and r.direction='credit'
  ) into v_credit_exists;

  if v_bcu.direction='credit' and v_bcu.qualification_state='qualified' and v_bcu.units>0
     and v_state.canonical_state='ACTIVE_REFERRAL'
     and v_state.earning_window_start is not null
     and v_bcu.occurred_at>=v_state.earning_window_start
     and v_bcu.occurred_at<=v_state.earning_window_end then

    v_factor := greatest(coalesce((private.buklod_r38_policy_config_v1()->'referral'->>'rcu_percent_of_qualified_bcu')::numeric,0.1),0);
    v_units := round(v_bcu.units*v_factor,6);
    if v_units>0 then
      insert into private.buklod_r38_rcu_ledger(
        referrer_user_id,referred_user_id,referral_id,source_bcu_ledger_id,direction,units,
        qualification_state,event_key,occurred_at,policy_version,metadata
      ) values (
        v_ref.referrer_id,v_ref.referred_id,v_ref.id,v_bcu.id,'credit',v_units,
        'qualified','bcu:'||v_bcu.id::text,v_bcu.occurred_at,'r38_unified_economy_v1',
        jsonb_build_object('rcu_factor',v_factor,'source_bcu_units',v_bcu.units,'pooled_cash_only',true)
      ) on conflict(referrer_user_id,event_key) do nothing;
    end if;
  elsif v_credit_exists and not exists(
    select 1 from private.buklod_r38_rcu_ledger r
    where r.referrer_user_id=v_ref.referrer_id and r.event_key='bcu-reversal:'||v_bcu.id::text
  ) then
    select units into v_units from private.buklod_r38_rcu_ledger r
    where r.referrer_user_id=v_ref.referrer_id and r.event_key='bcu:'||v_bcu.id::text and r.direction='credit'
    limit 1;

    insert into private.buklod_r38_rcu_ledger(
      referrer_user_id,referred_user_id,referral_id,source_bcu_ledger_id,direction,units,
      qualification_state,event_key,occurred_at,policy_version,metadata
    ) values (
      v_ref.referrer_id,v_ref.referred_id,v_ref.id,v_bcu.id,'debit',coalesce(v_units,0),
      'reversed','bcu-reversal:'||v_bcu.id::text,now(),'r38_unified_economy_v1',
      jsonb_build_object('reason','source_bcu_no_longer_qualified')
    ) on conflict(referrer_user_id,event_key) do nothing;
  end if;
end;
$function$;

revoke all on function private.buklod_r38_sync_rcu_for_bcu_v1(uuid) from public,anon,authenticated;

create or replace function private.buklod_r38_bcu_to_rcu_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private.buklod_r38_sync_rcu_for_bcu_v1(new.id);
  return new;
end;
$function$;

revoke all on function private.buklod_r38_bcu_to_rcu_trigger_v1() from public,anon,authenticated;

drop trigger if exists buklod_r38_bcu_to_rcu_sync on private.buklod_r36_bcu_ledger;
create trigger buklod_r38_bcu_to_rcu_sync
after insert or update of direction,units,qualification_state,occurred_at on private.buklod_r36_bcu_ledger
for each row execute function private.buklod_r38_bcu_to_rcu_trigger_v1();

create or replace function public.admin_reconcile_buklod_r38_referrals_v1(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_row record;
  v_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,500),1),2000);
begin
  if v_actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  for v_row in
    select r.referred_id from public.buklod_referrals r order by r.created_at asc limit v_limit
  loop
    perform private.buklod_r38_refresh_referral_state_v1(v_row.referred_id);
    v_count := v_count+1;
  end loop;

  perform private.buklod_r38_audit_v1(v_actor,'REFERRAL_RECONCILIATION','SYSTEM','r38',null,
    jsonb_build_object('evaluated',v_count),null,'Server recomputation only',
    'referral-reconcile:'||extract(epoch from date_trunc('minute',now()))::bigint::text);

  return jsonb_build_object('evaluated',v_count,'rcu_accrual_enabled',private.buklod_r38_flag_enabled_v1('rcu_accrual_enabled'));
end;
$function$;

revoke all on function public.admin_reconcile_buklod_r38_referrals_v1(integer) from public,anon;
grant execute on function public.admin_reconcile_buklod_r38_referrals_v1(integer) to authenticated;