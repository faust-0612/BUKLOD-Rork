-- BUKLOD monthly earnings carry-forward: add an own-account, read-only projection.
-- Source of truth: canonical Finance V3 finalized settlement and immutable cash ledger.
-- This NEVER settles revenue, alters financial flags, transfers cash, or creates
-- withdrawable value from preliminary AdMob/Community QMP estimates.
-- The monthly contribution preview remains a separate, provisional read path.

create or replace function public.get_my_buklod_monthly_earnings_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_person uuid;
  v_current_month text := to_char(now() at time zone 'Asia/Manila','YYYY-MM');
  v_previous_month text := to_char(date_trunc('month',now() at time zone 'Asia/Manila') - interval '1 month','YYYY-MM');
  v_last_status text := 'AWAITING_FINALIZATION';
  v_last_share bigint := null;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_paid bigint := 0;
  v_lifetime_user_pool bigint := 0;
  v_lifetime_other bigint := 0;
  v_minimum bigint := 20000;
  v_withdrawal_enabled boolean := false;
  v_history jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_person := private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then
    return jsonb_build_object('identity_ready',false,
      'current_month_key',v_current_month,'previous_month_key',v_previous_month);
  end if;

  -- Previous month's historical earning is fixed ONLY when canonical settlement
  -- is finalized. Zero is legitimate after a finalized month with no share.
  select 'FINALIZED',coalesce(u.user_pool_share_centavos,0)
  into v_last_status,v_last_share
  from private.buklod_pf_settlements s
  left join private.buklod_pf_user_settlements u
    on u.settlement_id=s.id and u.person_id=v_person
  where s.period_key=v_previous_month and s.status='FINALIZED'
  limit 1;
  if not found then
    v_last_status := 'AWAITING_FINALIZATION';
    v_last_share := null;
  end if;

  -- Historical months never depend on current QMP, and withdrawals never
  -- rewrite their original monthly earned amounts.
  select coalesce(jsonb_agg(jsonb_build_object(
      'month',month_data.period_key,
      'share_minor',month_data.share_minor,
      'status','FINALIZED'
    ) order by month_data.period_key desc),'[]'::jsonb)
  into v_history
  from (
    select s.period_key,coalesce(u.user_pool_share_centavos,0)::bigint as share_minor
    from private.buklod_pf_settlements s
    left join private.buklod_pf_user_settlements u
      on u.settlement_id=s.id and u.person_id=v_person
    where s.status='FINALIZED' and s.period_key<v_current_month
    order by s.period_key desc
    limit 36
  ) month_data;

  select
    coalesce(sum(l.amount_centavos) filter(
      where l.direction='CREDIT' and l.entry_type='USER_POOL_SETTLEMENT'
    ),0)::bigint,
    coalesce(sum(l.amount_centavos) filter(
      where l.direction='CREDIT'
        and (l.entry_type in ('FIRST_LINE_SETTLEMENT','REFERRAL_ONE_TIME_REWARD')
          or (l.entry_type='ADMIN_CORRECTION'
            and l.metadata->>'funding_class'='ADMIN_FUNDED_REWARD'))
    ),0)::bigint
  into v_lifetime_user_pool,v_lifetime_other
  from private.buklod_pf_cash_ledger l
  where l.person_id=v_person;

  v_available := greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'AVAILABLE'),0);
  v_reserved := greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'RESERVED'),0);
  v_paid := greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'PAID'),0);

  select minimum_withdrawal_centavos,withdrawal_enabled
  into v_minimum,v_withdrawal_enabled
  from private.buklod_pf_config
  where singleton=true;

  return jsonb_build_object(
    'identity_ready',true,
    'current_month_key',v_current_month,
    'previous_month_key',v_previous_month,
    'last_month',jsonb_build_object(
      'status',v_last_status,
      'finalized_share_minor',v_last_share
    ),
    'historical_months',v_history,
    'lifetime_finalized_user_pool_minor',v_lifetime_user_pool,
    'lifetime_other_funded_minor',v_lifetime_other,
    'available_finalized_minor',v_available,
    'reserved_for_payout_minor',v_reserved,
    'already_paid_minor',v_paid,
    'minimum_withdrawal_minor',v_minimum,
    'withdrawal_enabled',coalesce(v_withdrawal_enabled,false),
    'meets_amount_threshold',v_available>=coalesce(v_minimum,20000),
    'current_month_estimate_included',false,
    'withdrawable_uses_only_available_finalized_cash',true
  );
end;
$function$;

revoke all on function public.get_my_buklod_monthly_earnings_v1() from public,anon;
grant execute on function public.get_my_buklod_monthly_earnings_v1() to authenticated;

comment on function public.get_my_buklod_monthly_earnings_v1() is
'Own-account finalized monthly user-pool history and actual cash balances; current QMP estimate must be sourced separately and cannot be withdrawn.';
