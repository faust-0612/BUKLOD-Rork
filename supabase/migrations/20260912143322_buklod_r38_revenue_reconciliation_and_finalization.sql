-- R38 actual realized revenue -> reconciled distributable base -> funded pools -> proportional finalized shares.
-- Finalization is hard-gated by centralized financial_finalization_enabled (currently false).

alter table private.buklod_r38_economic_periods
  add column if not exists estimated_bayanihan_pool numeric not null default 0,
  add column if not exists estimated_founder_allocation numeric not null default 0,
  add column if not exists estimated_growth_allocation numeric not null default 0,
  add column if not exists estimated_reserve_allocation numeric not null default 0;

create or replace function private.buklod_r38_cash_bucket_balance_v1(
  p_user_id uuid,
  p_source_pool text,
  p_bucket text
)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(sum(case when l.direction='credit' then l.amount else -l.amount end),0)::numeric
  from private.buklod_r38_user_cash_ledger l
  where l.user_id=p_user_id and l.source_pool=p_source_pool and l.bucket=p_bucket;
$function$;
revoke all on function private.buklod_r38_cash_bucket_balance_v1(uuid,text,text) from public,anon,authenticated;

create or replace function private.buklod_r38_refresh_period_estimates_v1(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_rev numeric := 0;
  v_cost numeric := 0;
  v_base numeric := 0;
  v_cfg jsonb := private.buklod_r38_policy_config_v1();
  v_bayanihan_pct numeric := 30;
  v_referral_pct numeric := 5;
  v_founder_pct numeric := 35;
  v_growth_pct numeric := 20;
  v_reserve_pct numeric := 10;
begin
  select
    coalesce(sum(case when e.direction='revenue' and e.reconciliation_state in ('ESTIMATED','RECONCILED') then e.amount else 0 end),0),
    coalesce(sum(case when e.direction='cost' and e.reconciliation_state in ('ESTIMATED','RECONCILED') then e.amount else 0 end),0)
  into v_rev,v_cost
  from private.buklod_r38_financial_entries e
  where e.period_id=p_period_id;

  v_base := greatest(v_rev-v_cost,0);
  v_bayanihan_pct := coalesce((v_cfg->'allocation_percent'->>'bayanihan')::numeric,30);
  v_referral_pct := coalesce((v_cfg->'allocation_percent'->>'active_direct_referral')::numeric,5);
  v_founder_pct := coalesce((v_cfg->'allocation_percent'->>'founder')::numeric,35);
  v_growth_pct := coalesce((v_cfg->'allocation_percent'->>'growth')::numeric,20);
  v_reserve_pct := coalesce((v_cfg->'allocation_percent'->>'reserve')::numeric,10);

  update private.buklod_r38_economic_periods p
  set estimated_revenue=round(v_rev,2),
      estimated_costs=round(v_cost,2),
      estimated_distributable_base=round(v_base,2),
      estimated_bayanihan_pool=round(v_base*v_bayanihan_pct/100,2),
      estimated_referral_pool=round(v_base*v_referral_pct/100,2),
      estimated_founder_allocation=round(v_base*v_founder_pct/100,2),
      estimated_growth_allocation=round(v_base*v_growth_pct/100,2),
      estimated_reserve_allocation=round(v_base*v_reserve_pct/100,2),
      status=case when p.status='OPEN' and (v_rev>0 or v_cost>0) then 'ESTIMATING' else p.status end,
      updated_at=now()
  where p.id=p_period_id and p.status not in ('FINALIZED','PAYOUT_READY','CLOSED');
end;
$function$;
revoke all on function private.buklod_r38_refresh_period_estimates_v1(uuid) from public,anon,authenticated;

create or replace function public.admin_create_buklod_r38_economic_period_v1(
  p_period_key text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_key text := upper(left(trim(coalesce(p_period_key,'')),80));
  v_row private.buklod_r38_economic_periods%rowtype;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if v_key='' then raise exception 'Period key is required'; end if;
  if p_period_start is null or p_period_end is null or p_period_end<=p_period_start then raise exception 'Valid period start/end required'; end if;

  select * into v_row from private.buklod_r38_economic_periods where period_key=v_key;
  if found then return to_jsonb(v_row); end if;

  if exists(
    select 1 from private.buklod_r38_economic_periods p
    where tstzrange(p.period_start,p.period_end,'[)') && tstzrange(p_period_start,p_period_end,'[)')
      and p.status<>'CLOSED'
  ) then
    raise exception 'Economic period overlaps an existing active period';
  end if;

  insert into private.buklod_r38_economic_periods(period_key,period_start,period_end,status,currency,policy_version,notes)
  values(v_key,p_period_start,p_period_end,'OPEN','PHP','r38_unified_economy_v1',nullif(left(trim(coalesce(p_notes,'')),1000),''))
  returning * into v_row;

  perform private.buklod_r38_audit_v1(v_actor,'PERIOD_CREATED','ECONOMIC_PERIOD',v_row.id::text,null,
    jsonb_build_object('period_key',v_key,'period_start',p_period_start,'period_end',p_period_end),to_jsonb(v_row),
    'Economic period created','period-create:'||v_row.id::text);

  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.admin_create_buklod_r38_economic_period_v1(text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.admin_create_buklod_r38_economic_period_v1(text,timestamptz,timestamptz,text) to authenticated;

create or replace function public.admin_add_buklod_r38_financial_entry_v1(
  p_period_key text,
  p_entry_kind text,
  p_direction text,
  p_amount numeric,
  p_source_system text,
  p_external_reference text,
  p_idempotency_key text,
  p_reconciliation_state text default 'ESTIMATED',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_period private.buklod_r38_economic_periods%rowtype;
  v_existing private.buklod_r38_financial_entries%rowtype;
  v_row private.buklod_r38_financial_entries%rowtype;
  v_kind text := upper(trim(coalesce(p_entry_kind,'')));
  v_direction text := lower(trim(coalesce(p_direction,'')));
  v_state text := upper(trim(coalesce(p_reconciliation_state,'ESTIMATED')));
  v_key text := left(trim(coalesce(p_idempotency_key,'')),160);
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if coalesce(p_amount,0)<0 then raise exception 'Amount cannot be negative'; end if;
  if v_direction not in ('revenue','cost') then raise exception 'Direction must be revenue or cost'; end if;
  if v_state not in ('ESTIMATED','RECONCILED','EXCLUDED') then raise exception 'Invalid reconciliation state'; end if;
  if v_key='' then raise exception 'Idempotency key is required'; end if;
  if v_direction='revenue' and v_kind not in ('REVENUE','ADJUSTMENT') then raise exception 'Revenue direction requires REVENUE or ADJUSTMENT entry kind'; end if;
  if v_direction='cost' and v_kind in ('REVENUE') then raise exception 'REVENUE entry kind cannot be a cost'; end if;

  select * into v_existing from private.buklod_r38_financial_entries where idempotency_key=v_key;
  if found then return jsonb_build_object('idempotent_replay',true,'entry',to_jsonb(v_existing)); end if;

  select * into v_period from private.buklod_r38_economic_periods where period_key=upper(trim(p_period_key)) for update;
  if not found then raise exception 'Economic period not found'; end if;
  if v_period.status in ('FINALIZED','PAYOUT_READY','CLOSED') then raise exception 'Finalized/closed period cannot accept financial entries'; end if;

  insert into private.buklod_r38_financial_entries(
    period_id,entry_kind,direction,amount,source_system,external_reference,idempotency_key,
    recognized_at,created_by,metadata,reconciliation_state,currency,reconciled_at,reconciled_by
  ) values(
    v_period.id,v_kind,v_direction,round(p_amount,2),left(coalesce(nullif(trim(p_source_system),''),'manual_admin'),80),
    nullif(left(trim(coalesce(p_external_reference,'')),200),''),v_key,now(),v_actor,coalesce(p_metadata,'{}'::jsonb),
    v_state,'PHP',case when v_state='RECONCILED' then now() else null end,case when v_state='RECONCILED' then v_actor else null end
  ) returning * into v_row;

  perform private.buklod_r38_refresh_period_estimates_v1(v_period.id);
  perform private.buklod_r38_audit_v1(v_actor,'FINANCIAL_ENTRY_ADDED','FINANCIAL_ENTRY',v_row.id::text,null,
    to_jsonb(v_row),to_jsonb(v_row),'Aggregate platform financial entry; never user Points derived','financial-entry:'||v_key);

  return jsonb_build_object('idempotent_replay',false,'entry',to_jsonb(v_row));
end;
$function$;
revoke all on function public.admin_add_buklod_r38_financial_entry_v1(text,text,text,numeric,text,text,text,text,jsonb) from public,anon;
grant execute on function public.admin_add_buklod_r38_financial_entry_v1(text,text,text,numeric,text,text,text,text,jsonb) to authenticated;

create or replace function public.admin_set_buklod_r38_financial_entry_state_v1(
  p_entry_id uuid,
  p_reconciliation_state text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_row private.buklod_r38_financial_entries%rowtype;
  v_before jsonb;
  v_period private.buklod_r38_economic_periods%rowtype;
  v_state text := upper(trim(coalesce(p_reconciliation_state,'')));
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if v_state not in ('ESTIMATED','RECONCILED','EXCLUDED') then raise exception 'Invalid reconciliation state'; end if;

  select * into v_row from private.buklod_r38_financial_entries where id=p_entry_id for update;
  if not found then raise exception 'Financial entry not found'; end if;
  v_before:=to_jsonb(v_row);
  select * into v_period from private.buklod_r38_economic_periods where id=v_row.period_id for update;
  if v_period.status in ('FINALIZED','PAYOUT_READY','CLOSED') then raise exception 'Finalized/closed period is immutable'; end if;

  update private.buklod_r38_financial_entries
  set reconciliation_state=v_state,
      reconciled_at=case when v_state='RECONCILED' then now() else null end,
      reconciled_by=case when v_state='RECONCILED' then v_actor else null end
  where id=p_entry_id returning * into v_row;

  perform private.buklod_r38_refresh_period_estimates_v1(v_period.id);
  perform private.buklod_r38_audit_v1(v_actor,'FINANCIAL_ENTRY_STATE_CHANGED','FINANCIAL_ENTRY',v_row.id::text,v_before,
    jsonb_build_object('reconciliation_state',v_state),to_jsonb(v_row),p_reason,
    'financial-entry-state:'||v_row.id::text||':'||v_state||':'||extract(epoch from now())::bigint::text);
  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.admin_set_buklod_r38_financial_entry_state_v1(uuid,text,text) from public,anon;
grant execute on function public.admin_set_buklod_r38_financial_entry_state_v1(uuid,text,text) to authenticated;

create or replace function public.admin_set_buklod_r38_period_status_v1(p_period_key text,p_status text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_row private.buklod_r38_economic_periods%rowtype;
  v_before jsonb;
  v_next text := upper(trim(coalesce(p_status,'')));
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  select * into v_row from private.buklod_r38_economic_periods where period_key=upper(trim(p_period_key)) for update;
  if not found then raise exception 'Economic period not found'; end if;
  if v_row.status in ('FINALIZED','PAYOUT_READY','CLOSED') then raise exception 'Finalized/closed period cannot be moved backward'; end if;
  if v_next not in ('OPEN','ESTIMATING','RECONCILING','READY_FOR_FINALIZATION') then raise exception 'Invalid pre-finalization status'; end if;
  if v_next='READY_FOR_FINALIZATION' and exists(
    select 1 from private.buklod_r38_financial_entries e where e.period_id=v_row.id and e.reconciliation_state='ESTIMATED'
  ) then raise exception 'Estimated entries remain; reconcile or exclude them first'; end if;

  v_before:=to_jsonb(v_row);
  update private.buklod_r38_economic_periods set status=v_next,updated_at=now() where id=v_row.id returning * into v_row;
  perform private.buklod_r38_audit_v1(v_actor,'PERIOD_STATUS_CHANGED','ECONOMIC_PERIOD',v_row.id::text,v_before,
    jsonb_build_object('status',v_next),to_jsonb(v_row),p_reason,
    'period-status:'||v_row.id::text||':'||v_next||':'||extract(epoch from now())::bigint::text);
  return to_jsonb(v_row);
end;
$function$;
revoke all on function public.admin_set_buklod_r38_period_status_v1(text,text,text) from public,anon;
grant execute on function public.admin_set_buklod_r38_period_status_v1(text,text,text) to authenticated;

create or replace function public.admin_finalize_buklod_r38_economic_period_v1(p_period_key text,p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_period private.buklod_r38_economic_periods%rowtype;
  v_cfg jsonb := private.buklod_r38_policy_config_v1();
  v_rev numeric := 0; v_cost numeric := 0; v_base numeric := 0;
  v_bayanihan_pct numeric := 30; v_referral_pct numeric := 5; v_founder_pct numeric := 35; v_growth_pct numeric := 20; v_reserve_pct numeric := 10;
  v_bayanihan_pool numeric := 0; v_referral_pool numeric := 0; v_founder numeric := 0; v_growth numeric := 0; v_reserve numeric := 0;
  v_total_bcu numeric := 0; v_total_rcu numeric := 0;
  v_finalization_id uuid := gen_random_uuid();
  v_bayanihan_distributed numeric := 0; v_referral_distributed numeric := 0;
  v_before jsonb;
begin
  if v_actor is null or not public.is_system_admin() then raise exception 'System Admin access required'; end if;
  if not private.buklod_r38_flag_enabled_v1('financial_finalization_enabled') then
    raise exception 'R38 financial finalization is disabled. No cash entitlement may be created until explicitly activated.';
  end if;

  select * into v_period from private.buklod_r38_economic_periods where period_key=upper(trim(p_period_key)) for update;
  if not found then raise exception 'Economic period not found'; end if;
  if v_period.status in ('FINALIZED','PAYOUT_READY','CLOSED') then
    return jsonb_build_object('idempotent_replay',true,'period',to_jsonb(v_period));
  end if;
  if v_period.status<>'READY_FOR_FINALIZATION' then raise exception 'Period must be READY_FOR_FINALIZATION'; end if;
  if exists(select 1 from private.buklod_r38_financial_entries e where e.period_id=v_period.id and e.reconciliation_state='ESTIMATED') then
    raise exception 'Estimated entries remain; all entries must be reconciled or excluded';
  end if;

  select
    coalesce(sum(case when e.direction='revenue' and e.reconciliation_state='RECONCILED' then e.amount else 0 end),0),
    coalesce(sum(case when e.direction='cost' and e.reconciliation_state='RECONCILED' then e.amount else 0 end),0)
  into v_rev,v_cost from private.buklod_r38_financial_entries e where e.period_id=v_period.id;

  v_base:=greatest(v_rev-v_cost,0);
  v_bayanihan_pct:=coalesce((v_cfg->'allocation_percent'->>'bayanihan')::numeric,30);
  v_referral_pct:=coalesce((v_cfg->'allocation_percent'->>'active_direct_referral')::numeric,5);
  v_founder_pct:=coalesce((v_cfg->'allocation_percent'->>'founder')::numeric,35);
  v_growth_pct:=coalesce((v_cfg->'allocation_percent'->>'growth')::numeric,20);
  v_reserve_pct:=coalesce((v_cfg->'allocation_percent'->>'reserve')::numeric,10);
  if round(v_bayanihan_pct+v_referral_pct+v_founder_pct+v_growth_pct+v_reserve_pct,6)<>100 then
    raise exception 'R38 allocation percentages must total 100';
  end if;

  v_bayanihan_pool:=round(v_base*v_bayanihan_pct/100,2);
  v_referral_pool:=round(v_base*v_referral_pct/100,2);
  v_founder:=round(v_base*v_founder_pct/100,2);
  v_growth:=round(v_base*v_growth_pct/100,2);
  v_reserve:=round(v_base*v_reserve_pct/100,2);

  with user_bcu as (
    select b.user_id,
      greatest(sum(case when b.direction='credit' and b.qualification_state='qualified' then b.units
                        when b.direction='debit' and b.qualification_state in ('qualified','reversed') then -b.units else 0 end),0)::numeric as units
    from private.buklod_r36_bcu_ledger b
    where b.occurred_at>=v_period.period_start and b.occurred_at<v_period.period_end
    group by b.user_id
  ) select coalesce(sum(units),0) into v_total_bcu from user_bcu;

  with user_rcu as (
    select r.referrer_user_id as user_id,
      greatest(sum(case when r.direction='credit' and r.qualification_state='qualified' then r.units
                        when r.direction='debit' and r.qualification_state in ('qualified','reversed') then -r.units else 0 end),0)::numeric as units
    from private.buklod_r38_rcu_ledger r
    where r.occurred_at>=v_period.period_start and r.occurred_at<v_period.period_end
    group by r.referrer_user_id
  ) select coalesce(sum(units),0) into v_total_rcu from user_rcu;

  v_before:=to_jsonb(v_period);

  update private.buklod_r38_economic_periods
  set status='FINALIZED',
      finalized_revenue=round(v_rev,2),finalized_costs=round(v_cost,2),finalized_distributable_base=round(v_base,2),
      finalized_bayanihan_pool=v_bayanihan_pool,finalized_referral_pool=v_referral_pool,
      finalized_founder_allocation=v_founder,finalized_growth_allocation=v_growth,finalized_reserve_allocation=v_reserve,
      finalized_total_qualified_bcu=v_total_bcu,finalized_total_qualified_rcu=v_total_rcu,
      finalization_id=v_finalization_id,policy_snapshot=v_cfg,finalized_by=v_actor,finalized_at=now(),updated_at=now()
  where id=v_period.id returning * into v_period;

  insert into private.buklod_r38_user_period_shares(
    period_id,user_id,pool_key,qualified_units,total_qualified_units,share_ratio,funded_pool_amount,finalized_share_amount,
    effective_php_per_unit,finalization_id,policy_version,calculation_snapshot,finalized_at
  )
  select v_period.id,x.user_id,'BAYANIHAN',x.units,v_total_bcu,
         case when v_total_bcu>0 then x.units/v_total_bcu else 0 end,
         v_bayanihan_pool,
         case when v_total_bcu>0 then floor((v_bayanihan_pool*x.units/v_total_bcu)*100)/100 else 0 end,
         case when v_total_bcu>0 then v_bayanihan_pool/v_total_bcu else null end,
         v_finalization_id,'r38_unified_economy_v1',
         jsonb_build_object('formula','user_bcu / total_bcu * finalized_bayanihan_pool','analytics_effective_rate_only',true,'points_used',false),
         now()
  from (
    select b.user_id,
      greatest(sum(case when b.direction='credit' and b.qualification_state='qualified' then b.units
                        when b.direction='debit' and b.qualification_state in ('qualified','reversed') then -b.units else 0 end),0)::numeric as units
    from private.buklod_r36_bcu_ledger b
    where b.occurred_at>=v_period.period_start and b.occurred_at<v_period.period_end
    group by b.user_id
  ) x where x.units>0
  on conflict(period_id,user_id,pool_key) do nothing;

  insert into private.buklod_r38_user_period_shares(
    period_id,user_id,pool_key,qualified_units,total_qualified_units,share_ratio,funded_pool_amount,finalized_share_amount,
    effective_php_per_unit,finalization_id,policy_version,calculation_snapshot,finalized_at
  )
  select v_period.id,x.user_id,'DIRECT_REFERRAL',x.units,v_total_rcu,
         case when v_total_rcu>0 then x.units/v_total_rcu else 0 end,
         v_referral_pool,
         case when v_total_rcu>0 then floor((v_referral_pool*x.units/v_total_rcu)*100)/100 else 0 end,
         case when v_total_rcu>0 then v_referral_pool/v_total_rcu else null end,
         v_finalization_id,'r38_unified_economy_v1',
         jsonb_build_object('formula','user_rcu / total_rcu * finalized_referral_pool','analytics_effective_rate_only',true,'points_used',false),
         now()
  from (
    select r.referrer_user_id as user_id,
      greatest(sum(case when r.direction='credit' and r.qualification_state='qualified' then r.units
                        when r.direction='debit' and r.qualification_state in ('qualified','reversed') then -r.units else 0 end),0)::numeric as units
    from private.buklod_r38_rcu_ledger r
    where r.occurred_at>=v_period.period_start and r.occurred_at<v_period.period_end
    group by r.referrer_user_id
  ) x where x.units>0
  on conflict(period_id,user_id,pool_key) do nothing;

  insert into private.buklod_r38_user_cash_ledger(
    user_id,period_id,source_pool,bucket,direction,amount,entry_type,event_key,description,created_by,policy_version,metadata
  )
  select s.user_id,s.period_id,s.pool_key,'AVAILABLE','credit',s.finalized_share_amount,'PERIOD_FINALIZATION',
         'period-finalization:'||s.period_id::text||':'||lower(s.pool_key),
         case when s.pool_key='DIRECT_REFERRAL' then 'Finalized Direct Referral share' else 'Finalized User/Bayanihan share' end,
         v_actor,'r38_unified_economy_v1',
         jsonb_build_object('finalization_id',v_finalization_id,'funded_pool_amount',s.funded_pool_amount,'qualified_units',s.qualified_units,'total_qualified_units',s.total_qualified_units)
  from private.buklod_r38_user_period_shares s
  where s.period_id=v_period.id and s.finalization_id=v_finalization_id and s.finalized_share_amount>0
  on conflict(user_id,event_key) do nothing;

  select coalesce(sum(finalized_share_amount),0) into v_bayanihan_distributed
  from private.buklod_r38_user_period_shares where period_id=v_period.id and pool_key='BAYANIHAN';
  select coalesce(sum(finalized_share_amount),0) into v_referral_distributed
  from private.buklod_r38_user_period_shares where period_id=v_period.id and pool_key='DIRECT_REFERRAL';

  if v_bayanihan_distributed>v_bayanihan_pool or v_referral_distributed>v_referral_pool then
    raise exception 'Funded-pool invariant violated; transaction rolled back';
  end if;

  perform private.buklod_r38_audit_v1(v_actor,'PERIOD_FINALIZED','ECONOMIC_PERIOD',v_period.id::text,v_before,
    jsonb_build_object('finalized_revenue',v_rev,'finalized_costs',v_cost,'distributable_base',v_base,'bayanihan_pool',v_bayanihan_pool,'referral_pool',v_referral_pool,
      'distributed_bayanihan',v_bayanihan_distributed,'distributed_referral',v_referral_distributed),
    to_jsonb(v_period),p_reason,'period-finalized:'||v_period.id::text||':'||v_finalization_id::text);

  return jsonb_build_object(
    'idempotent_replay',false,'period',to_jsonb(v_period),
    'funded_pools',jsonb_build_object('bayanihan',v_bayanihan_pool,'direct_referral',v_referral_pool,'founder',v_founder,'growth',v_growth,'reserve',v_reserve),
    'qualified_units',jsonb_build_object('bcu',v_total_bcu,'rcu',v_total_rcu),
    'distributed',jsonb_build_object('bayanihan',v_bayanihan_distributed,'direct_referral',v_referral_distributed),
    'unallocated_residual',jsonb_build_object('bayanihan',v_bayanihan_pool-v_bayanihan_distributed,'direct_referral',v_referral_pool-v_referral_distributed),
    'points_used_for_cash',false
  );
end;
$function$;
revoke all on function public.admin_finalize_buklod_r38_economic_period_v1(text,text) from public,anon;
grant execute on function public.admin_finalize_buklod_r38_economic_period_v1(text,text) to authenticated;

comment on function public.admin_finalize_buklod_r38_economic_period_v1(text,text) is
'R38 cash creation event. Uses only RECONCILED aggregate platform revenue less reconciled costs, then funded pool percentages and BCU/RCU proportional weights. Never Points.';