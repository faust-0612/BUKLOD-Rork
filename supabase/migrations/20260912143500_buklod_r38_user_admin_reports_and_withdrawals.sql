-- R38 separated user/admin reporting + referral withdrawal lifecycle.
-- Withdrawal can only reserve/pay finalized DIRECT_REFERRAL cash. Points are never consulted.

create or replace function public.get_my_buklod_r38_economy_report_v1()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_lifetime bigint := 0; v_available bigint := 0; v_pending bigint := 0;
  v_rank jsonb := '{}'::jsonb; v_character text; v_collectibles bigint := 0;
  v_bcu numeric := 0; v_rcu numeric := 0; v_current_bcu numeric := 0; v_current_rcu numeric := 0;
  v_total_current_bcu numeric := 0; v_total_current_rcu numeric := 0;
  v_qualified_referrals bigint := 0; v_referral_statuses jsonb := '{}'::jsonb;
  v_period private.buklod_r38_economic_periods%rowtype;
  v_est_bayanihan numeric; v_est_referral numeric;
  v_final_bayanihan numeric := 0; v_final_referral numeric := 0;
  v_avail_bayanihan numeric := 0; v_avail_referral numeric := 0;
  v_reserved_referral numeric := 0; v_paid_bayanihan numeric := 0; v_paid_referral numeric := 0;
  v_row record;
  v_estimates_enabled boolean := private.buklod_r38_flag_enabled_v1('estimated_economics_enabled');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  for v_row in
    select r.referred_id from public.buklod_referrals r
    where r.referrer_id=v_uid or r.referred_id=v_uid
    order by r.created_at asc limit 500
  loop
    perform private.buklod_r38_refresh_referral_state_v1(v_row.referred_id);
  end loop;

  v_lifetime:=public.buklod_lifetime_points_for(v_uid);
  v_available:=public.buklod_available_points_for(v_uid);
  v_pending:=public.buklod_pending_claimable_points_for(v_uid);
  select to_jsonb(r) into v_rank from public.get_buklod_rank_for_points(v_lifetime) r limit 1;

  select s.character_id into v_character from private.buklod_special_character_selection s where s.user_id=v_uid limit 1;
  if v_character is null then
    select s.character_id into v_character from private.buklod_character_selection_v2 s where s.user_id=v_uid limit 1;
  end if;

  select
    (select count(*) from public.buklod_character_collectible_state c where c.user_id=v_uid) +
    (select count(*) from private.buklod_special_collectible_awards_v2 a where a.user_id=v_uid)
  into v_collectibles;

  select coalesce(sum(case when b.direction='credit' and b.qualification_state='qualified' then b.units
                           when b.direction='debit' and b.qualification_state in ('qualified','reversed') then -b.units else 0 end),0)
  into v_bcu from private.buklod_r36_bcu_ledger b where b.user_id=v_uid;
  v_bcu:=greatest(v_bcu,0);

  select coalesce(sum(case when r.direction='credit' and r.qualification_state='qualified' then r.units
                           when r.direction='debit' and r.qualification_state in ('qualified','reversed') then -r.units else 0 end),0)
  into v_rcu from private.buklod_r38_rcu_ledger r where r.referrer_user_id=v_uid;
  v_rcu:=greatest(v_rcu,0);

  select count(*) into v_qualified_referrals from private.buklod_r38_referral_state s
  where s.referrer_user_id=v_uid and s.qualified_at is not null and s.canonical_state not in ('DISQUALIFIED','BLOCKED_FRAUD');

  select coalesce(jsonb_object_agg(x.canonical_state,x.cnt),'{}'::jsonb) into v_referral_statuses
  from (
    select s.canonical_state,count(*)::bigint cnt from private.buklod_r38_referral_state s
    where s.referrer_user_id=v_uid group by s.canonical_state
  ) x;

  select * into v_period from private.buklod_r38_economic_periods p
  where p.status not in ('CLOSED')
  order by case when now()>=p.period_start and now()<p.period_end then 0 else 1 end,p.period_start desc
  limit 1;

  if v_period.id is not null then
    select coalesce(sum(case when b.direction='credit' and b.qualification_state='qualified' then b.units
                             when b.direction='debit' and b.qualification_state in ('qualified','reversed') then -b.units else 0 end),0)
    into v_current_bcu from private.buklod_r36_bcu_ledger b
    where b.user_id=v_uid and b.occurred_at>=v_period.period_start and b.occurred_at<v_period.period_end;
    v_current_bcu:=greatest(v_current_bcu,0);

    select coalesce(sum(case when r.direction='credit' and r.qualification_state='qualified' then r.units
                             when r.direction='debit' and r.qualification_state in ('qualified','reversed') then -r.units else 0 end),0)
    into v_current_rcu from private.buklod_r38_rcu_ledger r
    where r.referrer_user_id=v_uid and r.occurred_at>=v_period.period_start and r.occurred_at<v_period.period_end;
    v_current_rcu:=greatest(v_current_rcu,0);

    with x as (
      select b.user_id,greatest(sum(case when b.direction='credit' and b.qualification_state='qualified' then b.units
                                         when b.direction='debit' and b.qualification_state in ('qualified','reversed') then -b.units else 0 end),0) u
      from private.buklod_r36_bcu_ledger b where b.occurred_at>=v_period.period_start and b.occurred_at<v_period.period_end group by b.user_id
    ) select coalesce(sum(u),0) into v_total_current_bcu from x;

    with x as (
      select r.referrer_user_id,greatest(sum(case when r.direction='credit' and r.qualification_state='qualified' then r.units
                                                  when r.direction='debit' and r.qualification_state in ('qualified','reversed') then -r.units else 0 end),0) u
      from private.buklod_r38_rcu_ledger r where r.occurred_at>=v_period.period_start and r.occurred_at<v_period.period_end group by r.referrer_user_id
    ) select coalesce(sum(u),0) into v_total_current_rcu from x;

    if v_estimates_enabled and v_period.status not in ('FINALIZED','PAYOUT_READY','CLOSED') then
      v_est_bayanihan:=case when v_total_current_bcu>0 then round(v_period.estimated_bayanihan_pool*v_current_bcu/v_total_current_bcu,2) else 0 end;
      v_est_referral:=case when v_total_current_rcu>0 then round(v_period.estimated_referral_pool*v_current_rcu/v_total_current_rcu,2) else 0 end;
    end if;
  end if;

  select coalesce(sum(s.finalized_share_amount),0) into v_final_bayanihan
  from private.buklod_r38_user_period_shares s where s.user_id=v_uid and s.pool_key='BAYANIHAN';
  select coalesce(sum(s.finalized_share_amount),0) into v_final_referral
  from private.buklod_r38_user_period_shares s where s.user_id=v_uid and s.pool_key='DIRECT_REFERRAL';

  v_avail_bayanihan:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'BAYANIHAN','AVAILABLE'),0);
  v_avail_referral:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE'),0);
  v_reserved_referral:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','RESERVED'),0);
  v_paid_bayanihan:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'BAYANIHAN','PAID'),0);
  v_paid_referral:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','PAID'),0);

  return jsonb_build_object(
    'progress',jsonb_build_object(
      'lifetime_points',v_lifetime,'available_points',v_available,'pending_points',v_pending,
      'circle_rank',coalesce(v_rank,'{}'::jsonb),'character',v_character,'collectibles',v_collectibles
    ),
    'economic_contribution',jsonb_build_object(
      'qualified_bcu',v_bcu,'current_period_bcu',v_current_bcu,
      'current_period',case when v_period.id is null then null else jsonb_build_object('period_key',v_period.period_key,'status',v_period.status,'start',v_period.period_start,'end',v_period.period_end) end
    ),
    'app_sharing',jsonb_build_object(
      'qualified_direct_referrals',v_qualified_referrals,'qualified_rcu',v_rcu,'current_period_rcu',v_current_rcu,
      'referral_statuses',v_referral_statuses,'direct_only',true
    ),
    'actual_earnings',jsonb_build_object(
      'estimated_share',case when v_estimates_enabled then jsonb_build_object('bayanihan',v_est_bayanihan,'direct_referral',v_est_referral,'total',coalesce(v_est_bayanihan,0)+coalesce(v_est_referral,0),'label','ESTIMATED — SUBJECT TO PERIOD FINALIZATION','withdrawable',false) else null end,
      'finalized_share',jsonb_build_object('bayanihan',v_final_bayanihan,'direct_referral',v_final_referral,'total',v_final_bayanihan+v_final_referral),
      'available_cash',jsonb_build_object('bayanihan',v_avail_bayanihan,'direct_referral',v_avail_referral,'total',v_avail_bayanihan+v_avail_referral),
      'reserved_for_withdrawal',v_reserved_referral,
      'paid_earnings',jsonb_build_object('bayanihan',v_paid_bayanihan,'direct_referral',v_paid_referral,'total',v_paid_bayanihan+v_paid_referral),
      'referral_withdrawal_enabled',private.buklod_r38_flag_enabled_v1('referral_withdrawal_enabled'),
      'currency','PHP'
    ),
    'economic_invariants',jsonb_build_object(
      'points_are_money',false,'fixed_php_per_point',false,'fixed_php_per_bcu',false,'fixed_php_per_rcu',false,
      'cash_source','FINALIZED_FUNDED_PLATFORM_REVENUE','rcu_is_weight_only',true,'bcu_is_weight_only',true
    )
  );
end;
$function$;
revoke all on function public.get_my_buklod_r38_economy_report_v1() from public,anon;
grant execute on function public.get_my_buklod_r38_economy_report_v1() to authenticated;

create or replace function public.admin_get_buklod_r38_economy_report_v1(p_period_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_period private.buklod_r38_economic_periods%rowtype;
  v_financial jsonb := '[]'::jsonb; v_shares jsonb := '[]'::jsonb; v_ref_states jsonb := '{}'::jsonb; v_withdrawals jsonb := '{}'::jsonb;
  v_dist_bayanihan numeric:=0; v_dist_referral numeric:=0; v_cash_available numeric:=0; v_cash_reserved numeric:=0; v_cash_paid numeric:=0;
  v_eff_bcu numeric; v_eff_rcu numeric; v_cash_period_credit numeric:=0;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;

  if nullif(trim(coalesce(p_period_key,'')),'') is null then
    select * into v_period from private.buklod_r38_economic_periods order by period_start desc limit 1;
  else
    select * into v_period from private.buklod_r38_economic_periods where period_key=upper(trim(p_period_key)) limit 1;
  end if;

  if v_period.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('entry_kind',x.entry_kind,'direction',x.direction,'reconciliation_state',x.reconciliation_state,'amount',x.amount) order by x.direction,x.entry_kind,x.reconciliation_state),'[]'::jsonb)
    into v_financial
    from (
      select e.entry_kind,e.direction,e.reconciliation_state,sum(e.amount)::numeric amount
      from private.buklod_r38_financial_entries e where e.period_id=v_period.id
      group by e.entry_kind,e.direction,e.reconciliation_state
    ) x;

    select coalesce(sum(finalized_share_amount),0) into v_dist_bayanihan from private.buklod_r38_user_period_shares where period_id=v_period.id and pool_key='BAYANIHAN';
    select coalesce(sum(finalized_share_amount),0) into v_dist_referral from private.buklod_r38_user_period_shares where period_id=v_period.id and pool_key='DIRECT_REFERRAL';
    select coalesce(sum(case when direction='credit' then amount else -amount end),0) into v_cash_period_credit
    from private.buklod_r38_user_cash_ledger where period_id=v_period.id and bucket='AVAILABLE';

    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',s.user_id,'full_name',coalesce(nullif(trim(p.full_name),''),'BUKLOD Member'),
      'pool_key',s.pool_key,'qualified_units',s.qualified_units,'total_qualified_units',s.total_qualified_units,
      'share_ratio',s.share_ratio,'funded_pool_amount',s.funded_pool_amount,'finalized_share_amount',s.finalized_share_amount,
      'effective_php_per_unit_analytics_only',s.effective_php_per_unit
    ) order by s.pool_key,s.finalized_share_amount desc),'[]'::jsonb) into v_shares
    from private.buklod_r38_user_period_shares s join public.profiles p on p.id=s.user_id where s.period_id=v_period.id;

    v_eff_bcu:=case when coalesce(v_period.finalized_total_qualified_bcu,0)>0 then v_period.finalized_bayanihan_pool/v_period.finalized_total_qualified_bcu else null end;
    v_eff_rcu:=case when coalesce(v_period.finalized_total_qualified_rcu,0)>0 then v_period.finalized_referral_pool/v_period.finalized_total_qualified_rcu else null end;
  end if;

  select coalesce(sum(case when l.bucket='AVAILABLE' then case when l.direction='credit' then l.amount else -l.amount end else 0 end),0),
         coalesce(sum(case when l.bucket='RESERVED' then case when l.direction='credit' then l.amount else -l.amount end else 0 end),0),
         coalesce(sum(case when l.bucket='PAID' then case when l.direction='credit' then l.amount else -l.amount end else 0 end),0)
  into v_cash_available,v_cash_reserved,v_cash_paid from private.buklod_r38_user_cash_ledger l;

  select coalesce(jsonb_object_agg(x.canonical_state,x.cnt),'{}'::jsonb) into v_ref_states
  from (select canonical_state,count(*) cnt from private.buklod_r38_referral_state group by canonical_state) x;
  select coalesce(jsonb_object_agg(x.status,x.cnt),'{}'::jsonb) into v_withdrawals
  from (select status,count(*) cnt from private.buklod_r38_referral_withdrawals group by status) x;

  return jsonb_build_object(
    'period',case when v_period.id is null then null else to_jsonb(v_period) end,
    'revenue_chain',case when v_period.id is null then null else jsonb_build_object(
      'actual_reconciled_revenue',coalesce(v_period.finalized_revenue,v_period.estimated_revenue),
      'actual_reconciled_costs',coalesce(v_period.finalized_costs,v_period.estimated_costs),
      'distributable_base',coalesce(v_period.finalized_distributable_base,v_period.estimated_distributable_base),
      'bayanihan_pool',coalesce(v_period.finalized_bayanihan_pool,v_period.estimated_bayanihan_pool),
      'referral_pool',coalesce(v_period.finalized_referral_pool,v_period.estimated_referral_pool),
      'founder',coalesce(v_period.finalized_founder_allocation,v_period.estimated_founder_allocation),
      'growth',coalesce(v_period.finalized_growth_allocation,v_period.estimated_growth_allocation),
      'reserve',coalesce(v_period.finalized_reserve_allocation,v_period.estimated_reserve_allocation)
    ) end,
    'financial_entry_breakdown',v_financial,
    'qualified_units',case when v_period.id is null then null else jsonb_build_object('bcu',v_period.finalized_total_qualified_bcu,'rcu',v_period.finalized_total_qualified_rcu) end,
    'user_shares',v_shares,
    'distributed',jsonb_build_object('bayanihan',v_dist_bayanihan,'direct_referral',v_dist_referral),
    'effective_rates_analytics_only',jsonb_build_object('php_per_bcu',v_eff_bcu,'php_per_rcu',v_eff_rcu,'not_future_conversion_rate',true),
    'cash_ledger',jsonb_build_object('available',v_cash_available,'reserved',v_cash_reserved,'paid',v_cash_paid,'currency','PHP'),
    'referral_states',v_ref_states,'withdrawals',v_withdrawals,
    'activation',private.buklod_r38_policy_config_v1()->'activation',
    'invariant_checks',case when v_period.id is null then jsonb_build_object('ok',true,'note','No period yet') else jsonb_build_object(
      'bayanihan_distributed_lte_pool',v_dist_bayanihan<=coalesce(v_period.finalized_bayanihan_pool,0),
      'referral_distributed_lte_pool',v_dist_referral<=coalesce(v_period.finalized_referral_pool,0),
      'period_cash_credit_lte_distributed_shares',v_cash_period_credit<=v_dist_bayanihan+v_dist_referral,
      'points_used_for_cash',false
    ) end
  );
end;
$function$;
revoke all on function public.admin_get_buklod_r38_economy_report_v1(text) from public,anon;
grant execute on function public.admin_get_buklod_r38_economy_report_v1(text) to authenticated;

create or replace function public.request_my_buklod_r38_referral_withdrawal_v1(
  p_payout_method text,
  p_payout_profile_ref text,
  p_destination_masked text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_cfg jsonb := private.buklod_r38_policy_config_v1();
  v_available numeric:=0; v_min numeric:=200; v_key text:=left(trim(coalesce(p_request_key,'')),160);
  v_existing private.buklod_r38_referral_withdrawals%rowtype; v_row private.buklod_r38_referral_withdrawals%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not private.buklod_r38_flag_enabled_v1('referral_withdrawal_enabled') then raise exception 'Referral withdrawal is not enabled'; end if;
  if v_key='' then raise exception 'Request key is required'; end if;
  select * into v_existing from private.buklod_r38_referral_withdrawals where user_id=v_uid and request_idempotency_key=v_key;
  if found then return jsonb_build_object('idempotent_replay',true,'withdrawal',to_jsonb(v_existing)); end if;

  perform p.id from public.profiles p where p.id=v_uid for update;
  v_available:=greatest(private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE'),0);
  v_min:=greatest(coalesce((v_cfg->'withdrawal'->>'minimum_amount')::numeric,200),0);
  if v_available<v_min then raise exception 'Available finalized referral cash is below the withdrawal minimum'; end if;
  if v_available<=0 then raise exception 'No finalized referral cash is available'; end if;

  insert into private.buklod_r38_referral_withdrawals(
    user_id,requested_amount,currency,status,payout_method,payout_profile_ref,payout_destination_masked,
    request_idempotency_key,source_pool,metadata
  ) values(
    v_uid,round(v_available,2),'PHP','REQUESTED',left(trim(coalesce(p_payout_method,'')),40),
    nullif(left(trim(coalesce(p_payout_profile_ref,'')),120),''),nullif(left(trim(coalesce(p_destination_masked,'')),120),''),
    v_key,'DIRECT_REFERRAL',jsonb_build_object('full_balance_only',true,'points_used',false)
  ) returning * into v_row;

  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','AVAILABLE','debit',v_row.requested_amount,'WITHDRAWAL_RESERVE','withdrawal-reserve-available:'||v_row.id::text,v_row.id,'Reserve finalized referral cash for withdrawal','r38_unified_economy_v1','{}'::jsonb);
  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','RESERVED','credit',v_row.requested_amount,'WITHDRAWAL_RESERVE','withdrawal-reserve-held:'||v_row.id::text,v_row.id,'Reserved finalized referral cash','r38_unified_economy_v1','{}'::jsonb);

  return jsonb_build_object('idempotent_replay',false,'withdrawal',to_jsonb(v_row),'remaining_available_referral_cash',private.buklod_r38_cash_bucket_balance_v1(v_uid,'DIRECT_REFERRAL','AVAILABLE'));
end;
$function$;
revoke all on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) from public,anon;
grant execute on function public.request_my_buklod_r38_referral_withdrawal_v1(text,text,text,text) to authenticated;

create or replace function public.cancel_my_buklod_r38_referral_withdrawal_v1(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid()); v_row private.buklod_r38_referral_withdrawals%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  perform p.id from public.profiles p where p.id=v_uid for update;
  select * into v_row from private.buklod_r38_referral_withdrawals w where w.id=p_withdrawal_id and w.user_id=v_uid for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_row.status not in ('REQUESTED','UNDER_REVIEW') then raise exception 'Only requested/under-review withdrawal can be cancelled'; end if;

  update private.buklod_r38_referral_withdrawals set status='CANCELLED',updated_at=now() where id=v_row.id returning * into v_row;
  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','RESERVED','debit',v_row.requested_amount,'WITHDRAWAL_RELEASE','withdrawal-cancel-reserved:'||v_row.id::text,v_row.id,'Release cancelled withdrawal reserve','r38_unified_economy_v1','{}'::jsonb)
  on conflict(user_id,event_key) do nothing;
  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,policy_version,metadata)
  values(v_uid,'DIRECT_REFERRAL','AVAILABLE','credit',v_row.requested_amount,'WITHDRAWAL_RELEASE','withdrawal-cancel-available:'||v_row.id::text,v_row.id,'Return cancelled withdrawal to available referral cash','r38_unified_economy_v1','{}'::jsonb)
  on conflict(user_id,event_key) do nothing;
  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.cancel_my_buklod_r38_referral_withdrawal_v1(uuid) from public,anon;
grant execute on function public.cancel_my_buklod_r38_referral_withdrawal_v1(uuid) to authenticated;

create or replace function public.admin_review_buklod_r38_referral_withdrawal_v1(p_withdrawal_id uuid,p_approve boolean,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid()); v_row private.buklod_r38_referral_withdrawals%rowtype; v_before jsonb;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  select * into v_row from private.buklod_r38_referral_withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_row.status not in ('REQUESTED','UNDER_REVIEW') then raise exception 'Withdrawal is not reviewable'; end if;
  v_before:=to_jsonb(v_row);

  if coalesce(p_approve,false) then
    update private.buklod_r38_referral_withdrawals set status='APPROVED',reviewed_by=v_actor,reviewed_at=now(),approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_row.id returning * into v_row;
  else
    update private.buklod_r38_referral_withdrawals set status='REJECTED',reviewed_by=v_actor,reviewed_at=now(),rejection_reason=nullif(left(trim(coalesce(p_reason,'')),500),''),updated_at=now() where id=v_row.id returning * into v_row;
    insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,created_by,policy_version,metadata)
    values(v_row.user_id,'DIRECT_REFERRAL','RESERVED','debit',v_row.requested_amount,'WITHDRAWAL_RELEASE','withdrawal-reject-reserved:'||v_row.id::text,v_row.id,'Release rejected withdrawal reserve',v_actor,'r38_unified_economy_v1','{}'::jsonb)
    on conflict(user_id,event_key) do nothing;
    insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,created_by,policy_version,metadata)
    values(v_row.user_id,'DIRECT_REFERRAL','AVAILABLE','credit',v_row.requested_amount,'WITHDRAWAL_RELEASE','withdrawal-reject-available:'||v_row.id::text,v_row.id,'Return rejected withdrawal to available referral cash',v_actor,'r38_unified_economy_v1','{}'::jsonb)
    on conflict(user_id,event_key) do nothing;
  end if;

  perform private.buklod_r38_audit_v1(v_actor,'WITHDRAWAL_REVIEWED','REFERRAL_WITHDRAWAL',v_row.id::text,v_before,
    jsonb_build_object('approved',coalesce(p_approve,false)),to_jsonb(v_row),p_reason,
    'withdrawal-review:'||v_row.id::text||':'||v_row.status);
  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.admin_review_buklod_r38_referral_withdrawal_v1(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_buklod_r38_referral_withdrawal_v1(uuid,boolean,text) to authenticated;

create or replace function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(p_withdrawal_id uuid,p_transaction_ref text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid()); v_row private.buklod_r38_referral_withdrawals%rowtype; v_ref text:=nullif(left(trim(coalesce(p_transaction_ref,'')),160),''); v_before jsonb;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if not private.buklod_r38_flag_enabled_v1('payout_processing_enabled') then raise exception 'R38 payout processing is disabled'; end if;
  if v_ref is null then raise exception 'Payout transaction reference is required'; end if;
  select * into v_row from private.buklod_r38_referral_withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'Withdrawal request not found'; end if;
  if v_row.status='PAID' then return to_jsonb(v_row); end if;
  if v_row.status not in ('APPROVED','PROCESSING') then raise exception 'Only approved/processing withdrawal can be marked paid'; end if;
  if private.buklod_r38_cash_bucket_balance_v1(v_row.user_id,'DIRECT_REFERRAL','RESERVED')<v_row.requested_amount then raise exception 'Reserved funded cash is insufficient'; end if;
  v_before:=to_jsonb(v_row);

  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,created_by,policy_version,metadata)
  values(v_row.user_id,'DIRECT_REFERRAL','RESERVED','debit',v_row.requested_amount,'PAYOUT_PAID','withdrawal-paid-reserved:'||v_row.id::text,v_row.id,'Consume reserved finalized referral cash',v_actor,'r38_unified_economy_v1','{}'::jsonb)
  on conflict(user_id,event_key) do nothing;
  insert into private.buklod_r38_user_cash_ledger(user_id,source_pool,bucket,direction,amount,entry_type,event_key,withdrawal_request_id,description,created_by,policy_version,metadata)
  values(v_row.user_id,'DIRECT_REFERRAL','PAID','credit',v_row.requested_amount,'PAYOUT_PAID','withdrawal-paid-history:'||v_row.id::text,v_row.id,'Paid finalized referral earnings',v_actor,'r38_unified_economy_v1',jsonb_build_object('transaction_ref',v_ref))
  on conflict(user_id,event_key) do nothing;

  update private.buklod_r38_referral_withdrawals set status='PAID',paid_at=now(),payout_transaction_ref=v_ref,updated_at=now() where id=v_row.id returning * into v_row;
  perform private.buklod_r38_audit_v1(v_actor,'WITHDRAWAL_PAID','REFERRAL_WITHDRAWAL',v_row.id::text,v_before,
    jsonb_build_object('transaction_ref',v_ref),to_jsonb(v_row),'Paid from previously reserved finalized referral cash','withdrawal-paid:'||v_row.id::text);
  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(uuid,text) from public,anon;
grant execute on function public.admin_mark_buklod_r38_referral_withdrawal_paid_v1(uuid,text) to authenticated;

comment on function public.get_my_buklod_r38_economy_report_v1() is
'User economy report keeps progression Points, BCU/RCU contribution, referrals, and actual funded cash earnings visually/logically separate.';
comment on function public.admin_get_buklod_r38_economy_report_v1(text) is
'Admin revenue-chain report. Effective PHP per BCU/RCU is retrospective analytics only, never a fixed or promised conversion rate.';