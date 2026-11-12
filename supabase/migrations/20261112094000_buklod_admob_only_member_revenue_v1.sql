-- Canonical AdMob-only member-revenue partition, 2026-11-12.
-- Do not credit users from sponsorship, membership fees, donations, grants,
-- subscriptions, sponsorship inventory, product sales or mere AdMob estimates.
-- Historical finalized settlements and financial audit entries are untouched.

create or replace function private.buklod_is_verified_admob_source_v1(p_source text)
returns boolean language sql immutable set search_path to ''
as $$
  select lower(trim(coalesce(p_source,''))) in
    ('admob','google_admob','official_admob_api','admob_verified');
$$;
revoke all on function private.buklod_is_verified_admob_source_v1(text)
  from public,anon,authenticated;

create or replace function private.buklod_pf_admob_only_journal_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if new.entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL')
    and (not private.buklod_is_verified_admob_source_v1(new.source_system)
      or nullif(trim(coalesce(new.external_reference,'')),'') is null)
  then
    raise exception 'Only referenced AdMob revenue/reversals are eligible for member distribution'
      using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.buklod_pf_admob_only_journal_guard_v1()
  from public,anon,authenticated;
drop trigger if exists zz_buklod_pf_admob_only_journal_guard_v1 on private.buklod_pf_financial_entries;
create trigger zz_buklod_pf_admob_only_journal_guard_v1
before insert or update of entry_type,direction,reconciliation_state,source_system,external_reference
on private.buklod_pf_financial_entries
for each row execute function private.buklod_pf_admob_only_journal_guard_v1();

create or replace function private.buklod_pf_admob_only_value_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if not private.buklod_is_verified_admob_source_v1(new.provider)
     or nullif(trim(coalesce(new.external_reference,'')),'') is null
  then
    raise exception 'Only referenced AdMob finalized provider value is eligible for member distribution'
      using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.buklod_pf_admob_only_value_guard_v1()
  from public,anon,authenticated;
drop trigger if exists zz_buklod_pf_admob_only_value_guard_v1 on private.buklod_pf_finalized_value_ledger;
create trigger zz_buklod_pf_admob_only_value_guard_v1
before insert or update of provider,external_reference
on private.buklod_pf_finalized_value_ledger
for each row execute function private.buklod_pf_admob_only_value_guard_v1();

CREATE OR REPLACE FUNCTION private.buklod_r38_refresh_period_estimates_v1(p_period_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rev numeric := 0;
  v_cost numeric := 0;
  v_base numeric := 0;
  v_admob_revenue numeric := 0;
  v_admob_cost numeric := 0;
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

  -- Whole-platform P&L stays visible in estimated_revenue and costs, but
  -- the illustrative R38 allocation preview can use reconciled AdMob only.
  -- R38 payout finalization remains retired; Finance V3 is authoritative.
  select
    coalesce(sum(e.amount) filter(where e.direction='revenue'),0),
    coalesce(sum(e.amount) filter(where e.direction='cost'),0)
  into v_admob_revenue,v_admob_cost
  from private.buklod_r38_financial_entries e
  where e.period_id=p_period_id
    and e.reconciliation_state='RECONCILED'
    and private.buklod_is_verified_admob_source_v1(e.source_system)
    and nullif(trim(coalesce(e.external_reference,'')),'') is not null;
  v_base := greatest(v_admob_revenue-v_admob_cost,0);
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

CREATE OR REPLACE FUNCTION public.admin_get_buklod_pf_qmp_readiness_v1(p_period_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=(select auth.uid());
  v_p private.buklod_community_settlement_periods%rowtype;
  v_qualified_users bigint:=0;
  v_total_qmp bigint:=0;
  v_unlinked bigint:=0;
  v_ineligible bigint:=0;
  v_pending bigint:=0;
  v_held bigint:=0;
  v_legacy bigint:=0;
  v_finalized bigint:=0;
  v_reconciled_sources bigint:=0;
  v_cfg private.buklod_pf_config%rowtype;
begin
  if v_actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;
  if coalesce(p_period_key,'') !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Invalid finance period key';
  end if;

  select * into v_cfg from private.buklod_pf_config where singleton=true;
  select * into v_p from private.buklod_community_settlement_periods
  where period_key=p_period_key;
  if v_p.id is null then
    return jsonb_build_object('period_key',p_period_key,'period_exists',false,
      'ready_for_finalization',false);
  end if;

  select
    count(*) filter(where q.qualified_qmp>0),
    coalesce(sum(q.qualified_qmp),0),
    count(*) filter(where q.qualified_qmp>0 and (l.person_id is null or l.retired_at is not null)),
    count(*) filter(where q.qualified_qmp>0 and (
      pr.id is null or pr.is_active is distinct from true
      or pr.user_deactivated_at is not null
      or pf.person_id is null
      or pf.risk_status<>'CLEAR'
    ))
  into v_qualified_users,v_total_qmp,v_unlinked,v_ineligible
  from private.buklod_community_qmp_accounts q
  left join private.buklod_pf_user_links l on l.user_id=q.user_id
  left join private.buklod_pf_persons pf on pf.person_id=l.person_id
  left join public.profiles pr on pr.id=q.user_id
  where q.settlement_period_id=v_p.id
    and not private.buklod_is_platform_official_v1(q.user_id);

  select
    count(*) filter(where state='PENDING'),
    count(*) filter(where state='HELD')
  into v_pending,v_held
  from private.buklod_community_qmp_events
  where settlement_period_id=v_p.id and total_qmp>0
    and not private.buklod_is_platform_official_v1(user_id);

  select count(*) into v_legacy
  from private.buklod_community_user_pool_periods
  where settlement_period_id=v_p.id;
  select v_legacy+count(*) into v_legacy
  from private.buklod_r38_user_period_shares s
  join private.buklod_r38_economic_periods ep on ep.id=s.period_id
  where ep.period_key=upper(p_period_key) and s.pool_key='BAYANIHAN';

  select count(*) into v_finalized from private.buklod_pf_settlements
  where period_key=p_period_key and status='FINALIZED';

  select count(*) into v_reconciled_sources
  from private.buklod_pf_financial_entries fe
  where fe.period_key=p_period_key
    and fe.reconciliation_state='RECONCILED'
    and fe.entry_type='UNATTRIBUTED_ELIGIBLE_REVENUE'
    and fe.direction='CREDIT' and fe.amount_centavos>0
    and private.buklod_is_verified_admob_source_v1(fe.source_system)
    and nullif(trim(coalesce(fe.external_reference,'')),'') is not null;
  select v_reconciled_sources+count(*) into v_reconciled_sources
  from private.buklod_pf_finalized_value_ledger f
  where f.finalized_at>=v_p.starts_at and f.finalized_at<v_p.ends_at
    and f.gross_value_centavos>0
    and private.buklod_is_verified_admob_source_v1(f.provider);

  return jsonb_build_object(
    'period_key',p_period_key,
    'period_exists',true,
    'qmp_period_status',v_p.status,
    'month_complete',now()>=v_p.ends_at,
    'qualified_users',v_qualified_users,
    'qualified_monthly_qmp',v_total_qmp,
    'unlinked_finance_identities',v_unlinked,
    'ineligible_or_risk_held',v_ineligible,
    'pending_qmp_reviews',v_pending,
    'held_qmp_reviews',v_held,
    'legacy_share_records',v_legacy,
    'canonical_finalized_months',v_finalized,
    'reconciled_eligible_revenue_sources',v_reconciled_sources,
    'finance_enabled',coalesce(v_cfg.economics_enabled,false),
    'settlement_enabled',coalesce(v_cfg.settlement_enabled,false),
    'ready_for_finalization',
       v_p.status='OPEN'
       and now()>=v_p.ends_at
       and v_unlinked=0 and v_ineligible=0
       and v_pending=0 and v_held=0 and v_legacy=0 and v_finalized=0
       and v_reconciled_sources>0
       and coalesce(v_cfg.economics_enabled,false)
       and coalesce(v_cfg.settlement_enabled,false)
  );
end;
$function$;

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

  -- AdMob-only distribution: sponsorship, sales, grants, donations and all
  -- other app revenue are excluded from the user/referred/community cash pool.
  -- Older source-backed rows with non-AdMob provenance fail closed, not silently
  -- counted or rewritten; finalized historical months replay above unchanged.
  if exists (
    select 1 from private.buklod_pf_finalized_value_ledger f
    where f.finalized_at>=v_start and f.finalized_at<v_end
      and f.gross_value_centavos>0
      and not private.buklod_is_verified_admob_source_v1(f.provider)
  ) or exists (
    select 1 from private.buklod_pf_financial_entries e
    where e.period_key=p_period_key and e.reconciliation_state='RECONCILED'
      and e.entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL')
      and not private.buklod_is_verified_admob_source_v1(e.source_system)
  ) then
    raise exception 'Only reconciled AdMob revenue can fund member settlement';
  end if;

  -- Never lock an eligible month forever using a zero-funded placeholder.
  -- At least one finalized per-person source or verified reconciled eligible
  -- platform revenue entry is required. Preliminary AdMob reports are not money.
  if not exists (
    select 1 from private.buklod_pf_finalized_value_ledger f
    where f.finalized_at>=v_start and f.finalized_at<v_end
      and f.gross_value_centavos>0
  ) and not exists (
    select 1 from private.buklod_pf_financial_entries e
    where e.period_key=p_period_key
      and e.entry_type='UNATTRIBUTED_ELIGIBLE_REVENUE'
      and e.direction='CREDIT'
      and e.reconciliation_state='RECONCILED'
      and e.amount_centavos>0
      and nullif(trim(coalesce(e.external_reference,'')),'') is not null
  ) then
    raise exception 'Verified source-backed eligible revenue is required for month finalization';
  end if;

  -- Authenticated active profiles are included independently of old
  -- per-person revenue qualification and referral activation gates.
  for v_row in
    select distinct q.user_id from private.buklod_community_qmp_accounts q
    where q.settlement_period_id=v_qperiod.id and q.qualified_qmp>0
      and not private.buklod_is_platform_official_v1(q.user_id)
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
    and not private.buklod_is_platform_official_v1(q.user_id)
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_buklod_canonical_economy_snapshot_v1(p_period_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_key text:=trim(coalesce(p_period_key,''));
  v_finance jsonb;
  v_qmp jsonb;
  v_admob jsonb;
  v_sources jsonb;
begin
  if (select auth.uid()) is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;
  if v_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Finance month must be YYYY-MM (01-12)';
  end if;

  -- These existing APIs are the canonical sources; never join to R38 money,
  -- legacy Community pool, BCU/RCU or provisional AdMob as funded cash.
  v_finance:=public.admin_get_buklod_pf_finance_console_v3(v_key);
  v_qmp:=public.admin_get_buklod_pf_qmp_readiness_v1(v_key);
  v_admob:=public.admin_get_buklod_community_admob_estimate_v1(v_key);

  if coalesce(v_finance->>'period_key','')<>v_key
     or coalesce(v_qmp->>'period_key','')<>v_key
     or (v_admob is not null and coalesce(v_admob->>'period_key','')<>v_key) then
    raise exception 'Economy reporting period mismatch';
  end if;

  -- Reconcile independent source buckets. Do not join retired R38 sponsor
  -- receipts into the member cash pool or treat an AdMob estimate as cash.
  select jsonb_build_object(
    'member_distribution_source','RECONCILED_ADMOB_ONLY',
    'admob_finalized_provider_value_php',
      round(coalesce((select sum(f.gross_value_centavos)
       from private.buklod_pf_finalized_value_ledger f
       where f.finalized_at>=to_date(v_key||'-01','YYYY-MM-DD')::timestamp at time zone 'Asia/Manila'
         and f.finalized_at<(to_date(v_key||'-01','YYYY-MM-DD')+interval '1 month')::timestamp at time zone 'Asia/Manila'
         and private.buklod_is_verified_admob_source_v1(f.provider)),0)::numeric/100,2),
    'admob_reconciled_finance_journal_php',
      round(coalesce((select sum(case when e.direction='CREDIT'
         then e.amount_centavos else -e.amount_centavos end)
       from private.buklod_pf_financial_entries e
       where e.period_key=v_key
         and e.reconciliation_state='RECONCILED'
         and e.entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL')
         and private.buklod_is_verified_admob_source_v1(e.source_system)),0)::numeric/100,2),
    'other_app_reconciled_revenue_php',
      round(coalesce((select sum(e.amount)
        from private.buklod_r38_financial_entries e
        join private.buklod_r38_economic_periods rp on rp.id=e.period_id
        where rp.period_key=upper(v_key) and e.direction='revenue'
          and e.reconciliation_state='RECONCILED'
          and not private.buklod_is_verified_admob_source_v1(e.source_system)),0)::numeric,2),
    'other_app_reconciled_costs_php',
      round(coalesce((select sum(e.amount)
        from private.buklod_r38_financial_entries e
        join private.buklod_r38_economic_periods rp on rp.id=e.period_id
        where rp.period_key=upper(v_key) and e.direction='cost'
          and e.reconciliation_state='RECONCILED'
          and not private.buklod_is_verified_admob_source_v1(e.source_system)),0)::numeric,2),
    'other_app_excluded_from_user_pool',true,
    'admob_preliminary_is_cash',false
  ) into v_sources;

  return jsonb_build_object(
    'period_key',v_key,
    'generated_at',transaction_timestamp(),
    'finance',v_finance,
    'qmp',v_qmp,
    'admob_provisional',v_admob,
    'revenue_sources',v_sources,
    'source','CANONICAL_FINANCE_V3'
  );
end;
$function$;

-- Recalculate only open R38 estimate cards. This does not settle or pay anyone.
do $recalc$
declare x record;
begin
  for x in select id from private.buklod_r38_economic_periods
     where status not in ('FINALIZED','PAYOUT_READY','CLOSED')
  loop
    perform private.buklod_r38_refresh_period_estimates_v1(x.id);
  end loop;
end $recalc$;
