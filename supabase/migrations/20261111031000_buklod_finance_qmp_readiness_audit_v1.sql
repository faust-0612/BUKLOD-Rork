-- Private admin-only, read-only release readiness report. No money writes.
-- Canonical Finance V3 allocation can never begin from an unverified snapshot.
create or replace function public.admin_get_buklod_pf_qmp_readiness_v1(p_period_key text)
returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
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
  where q.settlement_period_id=v_p.id;

  select
    count(*) filter(where state='PENDING'),
    count(*) filter(where state='HELD')
  into v_pending,v_held
  from private.buklod_community_qmp_events
  where settlement_period_id=v_p.id and total_qmp>0;

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
    and fe.direction='CREDIT' and fe.amount_centavos>0;
  select v_reconciled_sources+count(*) into v_reconciled_sources
  from private.buklod_pf_finalized_value_ledger f
  where f.finalized_at>=v_p.starts_at and f.finalized_at<v_p.ends_at
    and f.gross_value_centavos>0;

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
revoke all on function public.admin_get_buklod_pf_qmp_readiness_v1(text)
from public,anon;
grant execute on function public.admin_get_buklod_pf_qmp_readiness_v1(text)
to authenticated;
comment on function public.admin_get_buklod_pf_qmp_readiness_v1(text) is
'System Admin only; aggregated identity/revenue/QMP safety checks, no user identifiers or financial writes.';
