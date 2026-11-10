-- Consolidation source: canonical Finance V3 settlement uses Community QMP only.
-- Depends on previous identity bridge migration 20261111023000.
-- No settlement execution or finance flag activation. Existing money, payouts,
-- referral allocations, profit guard, idempotency, largest-remainder behavior kept.
-- Prevent late QMP edits from changing a finalized month's ledger weights.
create or replace function private.buklod_community_qmp_period_write_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $guard$
declare
  v_period uuid;
  v_status text;
begin
  v_period:=case when tg_op='DELETE' then old.settlement_period_id
    else new.settlement_period_id end;
  select status into v_status
  from private.buklod_community_settlement_periods
  where id=v_period for share;
  if v_status in ('FINALIZED','PAYABLE','PAID','LOCKED') then
    raise exception 'QMP period is finalized: historical earning weights are immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$guard$;
revoke all on function private.buklod_community_qmp_period_write_guard_v1()
  from public,anon,authenticated;

drop trigger if exists buklod_qmp_events_period_frozen_v1
  on private.buklod_community_qmp_events;
create trigger buklod_qmp_events_period_frozen_v1
before insert or update or delete on private.buklod_community_qmp_events
for each row execute function private.buklod_community_qmp_period_write_guard_v1();

drop trigger if exists buklod_qmp_accounts_period_frozen_v1
  on private.buklod_community_qmp_accounts;
create trigger buklod_qmp_accounts_period_frozen_v1
before insert or update or delete on private.buklod_community_qmp_accounts
for each row execute function private.buklod_community_qmp_period_write_guard_v1();

-- Disable obsolete Community-only disbursement (0 existing payouts),
-- leaving read-only Community QMP, history and estimate APIs intact.
create or replace function public.admin_finalize_buklod_community_user_pool_v1(
  p_period_key text,p_reason text default null
) returns jsonb language plpgsql security definer set search_path to ''
as $disable$
begin
  raise exception 'Use the single canonical Finance V3 month settlement. The legacy Community settlement path is retired to prevent duplicate cash distributions.';
end;
$disable$;
revoke all on function public.admin_finalize_buklod_community_user_pool_v1(text,text)
from public,anon;
grant execute on function public.admin_finalize_buklod_community_user_pool_v1(text,text)
to authenticated;


CREATE OR REPLACE FUNCTION public.admin_finalize_buklod_pf_month_v3(p_period_key text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_cfg private.buklod_pf_config%rowtype;
  v_start_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_settlement private.buklod_pf_settlements%rowtype;

  v_prequal bigint:=0;
  v_qual_reserve_open bigint:=0;
  v_qual_reserve_close bigint:=0;
  v_one_time bigint:=0;
  v_prequal_retained bigint:=0;
  v_postqual bigint:=0;
  v_unattributed bigint:=0;
  v_normal bigint:=0;

  v_user_pool bigint:=0;
  v_total_points bigint:=0;
  v_user_distributed bigint:=0;
  v_user_reserve bigint:=0;
  v_user_residue bigint:=0;

  v_first_line bigint:=0;
  v_community bigint:=0;
  v_retained bigint:=0;

  v_operating bigint:=0;
  v_tax bigint:=0;
  v_net bigint:=0;

  v_row record;
  v_residue bigint;
  v_qperiod private.buklod_community_settlement_periods%rowtype;
  v_source_total_qmp bigint:=0;
begin
  if v_actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if trim(coalesce(p_period_key,'')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Period key must be YYYY-MM';
  end if;

  if trim(coalesce(p_idempotency_key,''))='' then
    raise exception 'Idempotency key required';
  end if;

  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true
  for share;

  if not v_cfg.economics_enabled or not v_cfg.settlement_enabled then
    raise exception 'Canonical financial settlement is disabled';
  end if;

  v_start_date:=to_date(p_period_key||'-01','YYYY-MM-DD');
  if to_char(v_start_date,'YYYY-MM')<>p_period_key then
    raise exception 'Invalid period key';
  end if;

  v_start:=v_start_date::timestamp at time zone 'Asia/Manila';
  v_end:=(v_start_date+interval '1 month')::timestamp at time zone 'Asia/Manila';

  -- A month may become an immutable revenue entitlement only after it ends.
  if now()<v_end then
    raise exception 'Cannot finalize an open QMP month';
  end if;

  select * into v_qperiod
  from private.buklod_community_settlement_periods
  where period_key=p_period_key for update;
  if v_qperiod.id is null or v_qperiod.starts_at<>v_start or v_qperiod.ends_at<>v_end then
    raise exception 'Matching Manila-calendar qualified QMP period is required';
  end if;
  if v_qperiod.status<>'OPEN' then
    -- Retrying a successfully finalized month must return the original
    -- settlement instead of creating credits or throwing a stale-period error.
    select * into v_settlement from private.buklod_pf_settlements
    where period_key=p_period_key and status='FINALIZED';
    if found then
      return jsonb_build_object('idempotent_replay',true,
        'settlement',to_jsonb(v_settlement));
    end if;
    raise exception 'Community QMP period was closed outside canonical Finance V3';
  end if;

  if exists(select 1
    from private.buklod_community_user_pool_periods legacy
    where legacy.settlement_period_id=v_qperiod.id)
    or exists(select 1
      from private.buklod_r38_economic_periods rp
      join private.buklod_r38_user_period_shares s on s.period_id=rp.id
      where rp.period_key=upper(p_period_key) and s.pool_key='BAYANIHAN') then
    raise exception 'Duplicate user revenue allocation blocked: legacy R38/Community pool exists';
  end if;
  if exists (
    select 1 from private.buklod_community_qmp_events e
    where e.settlement_period_id=v_qperiod.id
      and e.total_qmp>0 and e.state in ('HELD','PENDING')
  ) then
    raise exception 'Outstanding QMP reviews must be resolved before finalization';
  end if;

  -- Authenticated active profiles are included independently of old
  -- per-person revenue qualification and referral activation gates.
  for v_row in
    select distinct q.user_id from private.buklod_community_qmp_accounts q
    where q.settlement_period_id=v_qperiod.id and q.qualified_qmp>0
  loop
    if private.buklod_pf_ensure_qmp_person_v1(v_row.user_id) is null then
      raise exception 'All qualified QMP identities must reconcile before settlement';
    end if;
  end loop;

  insert into private.buklod_pf_settlements(
    period_key,period_start,period_end,status,policy_version,idempotency_key,finalized_by
  )
  values(
    p_period_key,v_start,v_end,'PREPARING',v_cfg.policy_version,trim(p_idempotency_key),v_actor
  )
  on conflict(period_key) do nothing;

  select * into v_settlement
  from private.buklod_pf_settlements
  where period_key=p_period_key
  for update;

  if v_settlement.status='FINALIZED' then
    return jsonb_build_object(
      'idempotent_replay',true,
      'settlement',to_jsonb(v_settlement)
    );
  end if;

  if v_settlement.idempotency_key<>trim(p_idempotency_key) then
    raise exception 'Period is already being prepared under a different idempotency key';
  end if;

  delete from private.buklod_pf_user_settlements where settlement_id=v_settlement.id;
  delete from private.buklod_pf_referral_settlements where settlement_id=v_settlement.id;
  delete from private.buklod_pf_community_settlements where settlement_id=v_settlement.id;
  delete from private.buklod_pf_user_pool_reserve where settlement_id=v_settlement.id;

  select coalesce(sum(qualification_value_centavos),0)::bigint,
         coalesce(sum(post_qualification_value_centavos),0)::bigint
  into v_prequal,v_postqual
  from private.buklod_pf_finalized_value_ledger
  where finalized_at>=v_start
    and finalized_at<v_end;

  select coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_qual_reserve_open
  from private.buklod_pf_qualification_fund_ledger
  where created_at<v_start;

  select coalesce(sum(amount_centavos),0)::bigint
  into v_one_time
  from private.buklod_pf_qualification_fund_ledger
  where entry_type='REFERRAL_REWARD_FUNDING'
    and direction='DEBIT'
    and created_at>=v_start
    and created_at<v_end;

  select coalesce(sum(amount_centavos),0)::bigint
  into v_prequal_retained
  from private.buklod_pf_qualification_fund_ledger
  where entry_type='BUKLOD_RETAINED_TRANSFER'
    and direction='DEBIT'
    and created_at>=v_start
    and created_at<v_end;

  select coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_qual_reserve_close
  from private.buklod_pf_qualification_fund_ledger
  where created_at<v_end;

  select coalesce(sum(
    case
      when direction='CREDIT' then amount_centavos
      else -amount_centavos
    end
  ),0)::bigint
  into v_unattributed
  from private.buklod_pf_financial_entries
  where period_key=p_period_key
    and reconciliation_state='RECONCILED'
    and entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL');

  if v_unattributed<0 then
    raise exception 'Unattributed eligible revenue cannot be negative';
  end if;

  v_normal:=v_postqual+v_unattributed;
  v_user_pool:=floor(v_normal::numeric*v_cfg.user_pool_bps/10000)::bigint;

  -- Resolve a period-end tier only when immutable history does not already
  -- cover the period. Never rewrite an existing historical tier from today's clock.
  for v_row in
    select distinct d.scope_id
    from private.buklod_pf_community_designations d
    where d.effective_from<v_end
      and (d.effective_to is null or d.effective_to>v_start)
      and not exists(
        select 1
        from private.buklod_pf_community_tier_history h
        where h.scope_id=d.scope_id
          and h.effective_from<=v_end-interval '1 microsecond'
          and (h.effective_to is null or h.effective_to>v_end-interval '1 microsecond')
      )
  loop
    perform private.buklod_pf_evaluate_community_tier_v3(
      v_row.scope_id,
      v_end-interval '1 microsecond'
    );
  end loop;

  -- Qualified Monthly Points are weights only. They never create cash.
  insert into private.buklod_pf_user_settlements(
    settlement_id,person_id,qualified_monthly_points,total_qualified_monthly_points,
    raw_share_numerator,remainder_numerator,user_pool_share_centavos,policy_version
  )
  select
    v_settlement.id,
    p.person_id,
    private.buklod_pf_monthly_points_v3(p.person_id,v_start,v_end),
    0,
    0,
    0,
    0,
    v_cfg.policy_version
  from private.buklod_pf_persons p
  join public.profiles pr on pr.id=p.current_user_id
  where p.risk_status='CLEAR'
    and pr.is_active=true
    and pr.user_deactivated_at is null
    and private.buklod_pf_monthly_points_v3(p.person_id,v_start,v_end)>0;

  select coalesce(sum(qualified_monthly_points),0)::bigint
  into v_total_points
  from private.buklod_pf_user_settlements
  where settlement_id=v_settlement.id;

  -- No qualified contributor may be omitted (or duplicated) by identity
  -- reconciliation; otherwise no credits are created for this month.
  select coalesce(sum(q.qualified_qmp),0)::bigint into v_source_total_qmp
  from private.buklod_community_qmp_accounts q
  join public.profiles pr on pr.id=q.user_id
  where q.settlement_period_id=v_qperiod.id
    and q.qualified_qmp>0
    and pr.is_active=true and pr.user_deactivated_at is null;
  if v_total_points<>v_source_total_qmp then
    raise exception 'Qualified QMP snapshot does not reconcile with eligible Finance people';
  end if;

  if v_user_pool>0 and v_total_points>0 then
    update private.buklod_pf_user_settlements u
    set total_qualified_monthly_points=v_total_points,
        raw_share_numerator=(v_user_pool::numeric*u.qualified_monthly_points::numeric),
        user_pool_share_centavos=floor(
          (v_user_pool::numeric*u.qualified_monthly_points::numeric)
          /v_total_points::numeric
        )::bigint,
        remainder_numerator=mod(
          (v_user_pool::numeric*u.qualified_monthly_points::numeric),
          v_total_points::numeric
        )
    where u.settlement_id=v_settlement.id
      and u.qualified_monthly_points>0;

    select coalesce(sum(user_pool_share_centavos),0)::bigint
    into v_user_distributed
    from private.buklod_pf_user_settlements
    where settlement_id=v_settlement.id;

    v_residue:=v_user_pool-v_user_distributed;

    if v_residue>0 then
      with ranked as (
        select person_id,
               row_number() over(
                 order by remainder_numerator desc,person_id
               ) as rn
        from private.buklod_pf_user_settlements
        where settlement_id=v_settlement.id
          and qualified_monthly_points>0
      )
      update private.buklod_pf_user_settlements u
      set user_pool_share_centavos=u.user_pool_share_centavos+1
      from ranked r
      where u.settlement_id=v_settlement.id
        and u.person_id=r.person_id
        and r.rn<=v_residue;
    end if;

    select coalesce(sum(user_pool_share_centavos),0)::bigint
    into v_user_distributed
    from private.buklod_pf_user_settlements
    where settlement_id=v_settlement.id;

    if v_user_distributed<>v_user_pool then
      raise exception 'User pool allocation does not reconcile';
    end if;

    insert into private.buklod_pf_cash_ledger(
      person_id,bucket,direction,amount_centavos,entry_type,event_key,
      settlement_id,policy_version,description,metadata
    )
    select
      person_id,
      'AVAILABLE',
      'CREDIT',
      user_pool_share_centavos,
      'USER_POOL_SETTLEMENT',
      'user-pool-settlement:'||v_settlement.id::text||':'||person_id::text,
      v_settlement.id,
      v_cfg.policy_version,
      'Monthly 30% User Revenue Pool share distributed by Qualified Monthly Points',
      jsonb_build_object(
        'qualified_monthly_points',qualified_monthly_points,
        'total_qualified_monthly_points',v_total_points
      )
    from private.buklod_pf_user_settlements
    where settlement_id=v_settlement.id
      and user_pool_share_centavos>0
    on conflict(person_id,event_key) do nothing;
  elsif v_user_pool>0 then
    v_user_reserve:=v_user_pool;

    insert into private.buklod_pf_user_pool_reserve(
      settlement_id,amount_centavos,reason
    )
    values(
      v_settlement.id,
      v_user_pool,
      'No qualified monthly points were available. User Pool held as an undistributed reserve.'
    );
  end if;

  -- First-line only: 10% of the referred person's post-qualification revenue
  -- that falls inside the immutable six-month window.
  insert into private.buklod_pf_referral_settlements(
    settlement_id,referral_id,referrer_person_id,referred_person_id,
    source_revenue_centavos,allocation_centavos,policy_version
  )
  select
    v_settlement.id,
    r.referral_id,
    r.referrer_person_id,
    r.referred_person_id,
    coalesce(sum(v.post_qualification_value_centavos),0)::bigint,
    floor(
      coalesce(sum(v.post_qualification_value_centavos),0)::numeric
      *v_cfg.first_line_bps/10000
    )::bigint,
    v_cfg.policy_version
  from private.buklod_pf_referrals r
  join private.buklod_pf_finalized_value_ledger v
    on v.person_id=r.referred_person_id
   and v.finalized_at>=v_start
   and v.finalized_at<v_end
   and v.post_qualification_value_centavos>0
   and r.referral_share_started_at is not null
   and v.finalized_at>=r.referral_share_started_at
   and v.finalized_at<r.referral_share_ends_at
  group by
    r.referral_id,r.referrer_person_id,r.referred_person_id;

  select coalesce(sum(allocation_centavos),0)::bigint
  into v_first_line
  from private.buklod_pf_referral_settlements
  where settlement_id=v_settlement.id;

  insert into private.buklod_pf_cash_ledger(
    person_id,bucket,direction,amount_centavos,entry_type,event_key,
    referral_id,settlement_id,policy_version,description,metadata
  )
  select
    rs.referrer_person_id,
    'AVAILABLE',
    'CREDIT',
    rs.allocation_centavos,
    'FIRST_LINE_SETTLEMENT',
    'first-line-settlement:'||rs.settlement_id::text||':'||rs.referral_id::text,
    rs.referral_id,
    rs.settlement_id,
    rs.policy_version,
    'First-line referral share for the active six-month period',
    jsonb_build_object(
      'source_revenue_centavos',rs.source_revenue_centavos,
      'first_line_bps',v_cfg.first_line_bps
    )
  from private.buklod_pf_referral_settlements rs
  where rs.settlement_id=v_settlement.id
    and rs.allocation_centavos>0
  on conflict(person_id,event_key) do nothing;

  -- Exactly one community destination per person and one tier per event timestamp.
  insert into private.buklod_pf_community_settlements(
    settlement_id,scope_id,tier,active_contributor_count,
    source_revenue_centavos,allocation_bps,allocation_centavos,policy_version
  )
  select
    v_settlement.id,
    d.scope_id,
    h.tier,
    max(h.active_contributor_count),
    sum(v.post_qualification_value_centavos)::bigint,
    case when h.tier='ORGANIZATION'
      then v_cfg.organization_fund_bps
      else v_cfg.cluster_fund_bps
    end,
    floor(
      sum(v.post_qualification_value_centavos)::numeric
      *case when h.tier='ORGANIZATION'
        then v_cfg.organization_fund_bps
        else v_cfg.cluster_fund_bps
      end
      /10000
    )::bigint,
    v_cfg.policy_version
  from private.buklod_pf_finalized_value_ledger v
  join private.buklod_pf_community_designations d
    on d.person_id=v.person_id
   and d.effective_from<=v.finalized_at
   and (d.effective_to is null or d.effective_to>v.finalized_at)
  join private.buklod_pf_community_tier_history h
    on h.scope_id=d.scope_id
   and h.effective_from<=v.finalized_at
   and (h.effective_to is null or h.effective_to>v.finalized_at)
  join public.buklod_scopes destination_scope
    on destination_scope.id=d.scope_id
   and destination_scope.status='ACTIVE'
   and (
     destination_scope.scope_type='CLUSTER'
     or (
       destination_scope.scope_type='ORGANIZATION'
       and destination_scope.parent_scope_id is null
     )
   )
  where v.finalized_at>=v_start
    and v.finalized_at<v_end
    and v.post_qualification_value_centavos>0
  group by d.scope_id,h.tier;

  select coalesce(sum(allocation_centavos),0)::bigint
  into v_community
  from private.buklod_pf_community_settlements
  where settlement_id=v_settlement.id;

  insert into private.buklod_pf_community_fund_ledger(
    scope_id,bucket,direction,amount_centavos,entry_type,event_key,
    settlement_id,description,metadata
  )
  select
    cs.scope_id,
    'AVAILABLE',
    'CREDIT',
    cs.allocation_centavos,
    'SETTLEMENT_ALLOCATION',
    'community-settlement:'||cs.id::text,
    cs.settlement_id,
    'Bayanihan Community Fund allocation',
    jsonb_build_object(
      'tier',cs.tier,
      'active_contributors',cs.active_contributor_count,
      'allocation_bps',cs.allocation_bps
    )
  from private.buklod_pf_community_settlements cs
  where cs.settlement_id=v_settlement.id
    and cs.allocation_centavos>0
  on conflict(event_key) do nothing;

  select coalesce(sum(
    case when direction='DEBIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_operating
  from private.buklod_pf_financial_entries
  where period_key=p_period_key
    and reconciliation_state='RECONCILED'
    and entry_type in (
      'OPERATING_COST','INFRASTRUCTURE_COST','PAYOUT_COST',
      'PAYMENT_PROCESSING_COST','OTHER_COST'
    );

  select coalesce(sum(
    case when direction='DEBIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_tax
  from private.buklod_pf_financial_entries
  where period_key=p_period_key
    and reconciliation_state='RECONCILED'
    and entry_type='TAX_RESERVE';

  if v_qual_reserve_open+v_prequal
     <>v_one_time+v_prequal_retained+v_qual_reserve_close then
    raise exception 'Profit guard failed: qualification reserve does not reconcile';
  end if;

  v_retained:=
    v_prequal_retained
    +(v_normal-v_user_pool-v_first_line-v_community);

  if v_normal<v_user_pool+v_first_line+v_community then
    raise exception 'Profit guard failed: normal allocations exceed eligible finalized revenue';
  end if;

  if v_retained<0 then
    raise exception 'Profit guard failed: negative BUKLOD retained allocation';
  end if;

  v_net:=v_retained-v_operating-v_tax;

  if v_net<0 then
    raise exception 'Profit guard failed: operating costs and tax reserve exceed BUKLOD retained allocation';
  end if;

  if v_user_pool>0 and v_total_points>0 and v_user_distributed<>v_user_pool then
    raise exception 'Profit guard failed: User Pool does not reconcile';
  end if;

  v_user_residue:=v_user_pool-v_user_distributed-v_user_reserve;
  if v_user_residue<>0 then
    raise exception 'Profit guard failed: unexplained User Pool rounding residue';
  end if;

  update private.buklod_pf_settlements
  set status='FINALIZED',
      prequalification_revenue_centavos=v_prequal,
      qualification_reserve_opening_centavos=v_qual_reserve_open,
      qualification_reserve_closing_centavos=v_qual_reserve_close,
      one_time_referral_rewards_centavos=v_one_time,
      prequalification_retained_transfer_centavos=v_prequal_retained,
      normal_eligible_revenue_centavos=v_normal,
      user_pool_centavos=v_user_pool,
      user_pool_distributed_centavos=v_user_distributed,
      user_pool_reserved_centavos=v_user_reserve,
      first_line_centavos=v_first_line,
      community_fund_centavos=v_community,
      retained_allocation_centavos=v_retained,
      operating_cost_centavos=v_operating,
      tax_reserve_centavos=v_tax,
      estimated_final_net_centavos=v_net,
      total_qualified_monthly_points=v_total_points,
      rounding_residue_centavos=0,
      finalized_by=v_actor,
      finalized_at=now(),
      metadata=jsonb_build_object(
        'points_are_money',false,
        'monthly_weight_source','COMMUNITY_QUALIFIED_QMP',
        'community_qmp_period_id',v_qperiod.id,
        'user_share_requires_prequalification',false,
        'user_pool_is_monthly_shared_pool',true,
        'first_line_only',true,
        'community_5_or_7_never_both',true,
        'centavo_safe',true,
        'profit_guard_passed',true
      )
  where id=v_settlement.id
  returning * into v_settlement;

  -- Freeze the same QMP period as the canonical Finance settlement:
  -- once finalized, activity may not change previously earned shares.
  update private.buklod_community_qmp_events
  set state='FINALIZED',finalized_at=coalesce(finalized_at,now())
  where settlement_period_id=v_qperiod.id and state='QUALIFIED';
  update private.buklod_community_settlement_periods
  set status='FINALIZED',finalized_at=now(),updated_at=now()
  where id=v_qperiod.id and status='OPEN';
  if not found then raise exception 'Community QMP period lock failed'; end if;

  return jsonb_build_object(
    'idempotent_replay',false,
    'settlement',to_jsonb(v_settlement)
  );
end
$function$

-- Explicitly retain the existing admin-only execute contract.
revoke all on function public.admin_finalize_buklod_pf_month_v3(text,text) from public,anon;
grant execute on function public.admin_finalize_buklod_pf_month_v3(text,text) to authenticated;
