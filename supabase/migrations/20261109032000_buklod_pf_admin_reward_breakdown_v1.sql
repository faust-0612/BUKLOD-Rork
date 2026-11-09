-- Read-only extension of canonical own-person financial history.
-- Adds only explicitly funded, audited admin credits, not noncash Points.
-- No change to balances, payouts, PF wallet reservation or existing source fields.
CREATE OR REPLACE FUNCTION public.get_my_buklod_financial_earnings_breakdown_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_person uuid;
  v_latest_settlement uuid;
  v_latest_period text;
  v_latest_user_pool bigint := 0;
  v_latest_first_line bigint := 0;
  v_lifetime_user_pool bigint := 0;
  v_lifetime_first_line bigint := 0;
  v_lifetime_referral_reward bigint := 0;
  v_lifetime_admin_reward bigint := 0;
  v_available bigint := 0;
  v_reserved bigint := 0;
  v_paid bigint := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  v_person := private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then
    return jsonb_build_object('identity_ready',false);
  end if;

  select s.id,s.period_key
  into v_latest_settlement,v_latest_period
  from private.buklod_pf_settlements s
  where s.status='FINALIZED'
  order by s.period_end desc,s.finalized_at desc nulls last,s.id
  limit 1;

  if v_latest_settlement is not null then
    select coalesce(us.user_pool_share_centavos,0)
    into v_latest_user_pool
    from private.buklod_pf_user_settlements us
    where us.settlement_id=v_latest_settlement
      and us.person_id=v_person;

    select coalesce(sum(rs.allocation_centavos),0)::bigint
    into v_latest_first_line
    from private.buklod_pf_referral_settlements rs
    where rs.settlement_id=v_latest_settlement
      and rs.referrer_person_id=v_person;
  end if;

  select
    coalesce(sum(case
      when l.direction='CREDIT' and l.entry_type='USER_POOL_SETTLEMENT'
        then l.amount_centavos
      else 0
    end),0)::bigint,
    coalesce(sum(case
      when l.direction='CREDIT' and l.entry_type='FIRST_LINE_SETTLEMENT'
        then l.amount_centavos
      else 0
    end),0)::bigint,
    coalesce(sum(case
      when l.direction='CREDIT' and l.entry_type='REFERRAL_ONE_TIME_REWARD'
        then l.amount_centavos
      else 0
    end),0)::bigint,
    coalesce(sum(case
      when l.direction='CREDIT' and l.entry_type='ADMIN_CORRECTION'
        and l.metadata->>'funding_class'='ADMIN_FUNDED_REWARD'
        then l.amount_centavos
      else 0
    end),0)::bigint
  into
    v_lifetime_user_pool,
    v_lifetime_first_line,
    v_lifetime_referral_reward,
    v_lifetime_admin_reward
  from private.buklod_pf_cash_ledger l
  where l.person_id=v_person;

  v_available := greatest(
    private.buklod_pf_cash_balance_centavos_v3(v_person,'AVAILABLE'),0
  );
  v_reserved := greatest(
    private.buklod_pf_cash_balance_centavos_v3(v_person,'RESERVED'),0
  );
  v_paid := greatest(
    private.buklod_pf_cash_balance_centavos_v3(v_person,'PAID'),0
  );

  return jsonb_build_object(
    'identity_ready',true,
    'latest_period_key',v_latest_period,
    'latest_finalized',jsonb_build_object(
      'user_pool_php',round(v_latest_user_pool::numeric/100,2),
      'first_line_php',round(v_latest_first_line::numeric/100,2),
      'total_share_php',round((v_latest_user_pool+v_latest_first_line)::numeric/100,2)
    ),
    'lifetime_earned',jsonb_build_object(
      'user_pool_php',round(v_lifetime_user_pool::numeric/100,2),
      'first_line_php',round(v_lifetime_first_line::numeric/100,2),
      'referral_reward_php',round(v_lifetime_referral_reward::numeric/100,2),
      'admin_funded_reward_php',round(v_lifetime_admin_reward::numeric/100,2),
      'total_php',round(
        (v_lifetime_user_pool+v_lifetime_first_line+v_lifetime_referral_reward+v_lifetime_admin_reward)::numeric/100,
        2
      )
    ),
    'cash_status',jsonb_build_object(
      'available_php',round(v_available::numeric/100,2),
      'reserved_php',round(v_reserved::numeric/100,2),
      'paid_php',round(v_paid::numeric/100,2)
    ),
    'points_used_for_cash',false
  );
end;
$function$
;
revoke all on function public.get_my_buklod_financial_earnings_breakdown_v1() from public,anon;
grant execute on function public.get_my_buklod_financial_earnings_breakdown_v1() to authenticated;
