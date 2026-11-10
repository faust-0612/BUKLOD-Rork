-- Finance V3 summary reads the same qualified monthly QMP weights as
-- Community Contribution and canonical Finance settlement.
-- No changes to actual cash ledger, wallet, payout, or finalization flags.
CREATE OR REPLACE FUNCTION public.get_my_buklod_financial_summary_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_person uuid;
  v_cfg private.buklod_pf_config%rowtype;
  v_now timestamptz:=now();
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_points bigint:=0;
  v_total_points bigint:=0;
  v_current_revenue bigint:=0;
  v_est_pool bigint:=0;
  v_est_share bigint:=0;
  v_lifetime bigint:=0;
  v_ref private.buklod_pf_referrals%rowtype;
  v_referrals jsonb;
  v_designation private.buklod_pf_community_designations%rowtype;
  v_scope_name text;
  v_tier text;
  v_active_count integer:=0;
  v_latest_user_share bigint:=0;
  v_available bigint:=0;
  v_reserved bigint:=0;
  v_paid bigint:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  v_person:=private.buklod_pf_person_for_user_v2(v_uid);
  if v_person is null then
    return jsonb_build_object('identity_ready',false);
  end if;

  select * into v_cfg
  from private.buklod_pf_config
  where singleton=true;

  v_month_start:=date_trunc('month',v_now at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  v_month_end:=(date_trunc('month',v_now at time zone 'Asia/Manila')+interval '1 month') at time zone 'Asia/Manila';

  select coalesce(b.lifetime_points,0)::bigint
  into v_lifetime
  from public.buklod_user_points_balances b
  where b.user_id=v_uid;

  v_points:=private.buklod_pf_monthly_points_v3(v_person,v_month_start,v_month_end);

  v_total_points:=private.buklod_pf_total_monthly_qmp_v1(v_month_start,v_month_end);

  select coalesce(sum(post_qualification_value_centavos),0)::bigint
  into v_current_revenue
  from private.buklod_pf_finalized_value_ledger
  where finalized_at>=v_month_start
    and finalized_at<v_month_end;

  select v_current_revenue+coalesce(sum(
    case when direction='CREDIT' then amount_centavos else -amount_centavos end
  ),0)::bigint
  into v_current_revenue
  from private.buklod_pf_financial_entries
  where period_key=to_char(v_month_start at time zone 'Asia/Manila','YYYY-MM')
    and reconciliation_state='RECONCILED'
    and entry_type in ('UNATTRIBUTED_ELIGIBLE_REVENUE','REVENUE_REVERSAL');

  v_current_revenue:=greatest(v_current_revenue,0);
  v_est_pool:=floor(v_current_revenue::numeric*v_cfg.user_pool_bps/10000)::bigint;

  if v_total_points>0 and v_points>0 then
    v_est_share:=floor(v_est_pool::numeric*v_points::numeric/v_total_points::numeric)::bigint;
  end if;

  select * into v_ref
  from private.buklod_pf_referrals
  where referred_person_id=v_person;

  select coalesce(jsonb_agg(jsonb_build_object(
    'referral_id',r.referral_id,
    'status',r.status,
    'pending_reward_php',case
      when r.reward_withdrawable_at is null then round(r.one_time_reward_centavos::numeric/100,2)
      else 0
    end,
    'reward_withdrawable_php',case
      when r.reward_withdrawable_at is not null then round(r.one_time_reward_centavos::numeric/100,2)
      else 0
    end,
    'qualification_value_php',round(r.qualification_value_centavos::numeric/100,2),
    'qualification_threshold_php',round(r.qualification_threshold_centavos::numeric/100,2),
    'qualification_pct',least(
      100,
      round(
        100*r.qualification_value_centavos::numeric
        /nullif(r.qualification_threshold_centavos,0),
        1
      )
    ),
    'share_started_at',r.referral_share_started_at,
    'share_ends_at',r.referral_share_ends_at,
    'referred_label',coalesce(nullif(trim(p.first_name),''),'BUKLOD member')
  ) order by r.created_at desc),'[]'::jsonb)
  into v_referrals
  from private.buklod_pf_referrals r
  left join private.buklod_pf_persons rp
    on rp.person_id=r.referred_person_id
  left join public.profiles p
    on p.id=rp.current_user_id
  where r.referrer_person_id=v_person;

  select * into v_designation
  from private.buklod_pf_community_designations
  where person_id=v_person
    and effective_to is null;

  if found then
    select s.name into v_scope_name
    from public.buklod_scopes s
    where s.id=v_designation.scope_id;

    select current_tier,active_contributor_count
    into v_tier,v_active_count
    from private.buklod_pf_community_tiers
    where scope_id=v_designation.scope_id;
  end if;

  select coalesce(us.user_pool_share_centavos,0)::bigint
  into v_latest_user_share
  from private.buklod_pf_user_settlements us
  join private.buklod_pf_settlements st
    on st.id=us.settlement_id
  where us.person_id=v_person
    and st.status='FINALIZED'
  order by st.period_end desc
  limit 1;

  v_available:=greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'AVAILABLE'),0);
  v_reserved:=greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'RESERVED'),0);
  v_paid:=greatest(private.buklod_pf_cash_balance_centavos_v3(v_person,'PAID'),0);

  return jsonb_build_object(
    'identity_ready',true,
    'policy_version',v_cfg.policy_version,

    'progress',jsonb_build_object(
      'lifetime_points',v_lifetime,
      'qualified_monthly_points',v_points,
      'total_qualified_monthly_points',v_total_points
    ),

    'earnings',jsonb_build_object(
      'estimated_pool_share_pct',case
        when v_total_points>0 then round(100*v_points::numeric/v_total_points::numeric,4)
        else 0
      end,
      'estimated_user_pool_php',round(v_est_pool::numeric/100,2),
      'estimated_earnings_php',round(v_est_share::numeric/100,2),
      'latest_finalized_user_share_php',round(v_latest_user_share::numeric/100,2),
      'withdrawable_php',round(v_available::numeric/100,2),
      'reserved_php',round(v_reserved::numeric/100,2),
      'paid_php',round(v_paid::numeric/100,2),
      -- Monthly user-pool eligibility is qualified QMP and clear identity,
      -- never the obsolete individual-revenue qualification threshold.
      'user_pool_eligibility_active',v_points>0 and exists(
        select 1 from private.buklod_pf_persons p
        join public.profiles pr on pr.id=p.current_user_id
        where p.person_id=v_person and p.risk_status='CLEAR'
          and pr.is_active=true and pr.user_deactivated_at is null
      )
    ),

    'referral',jsonb_build_object(
      'referral_code',private.buklod_pf_ensure_code_v2(v_person),
      'share_url','https://buklod.expo.app/register?ref='||private.buklod_pf_ensure_code_v2(v_person),
      'one_time_reward_php',round(v_cfg.one_time_referral_centavos::numeric/100,2),
      'referred_qualification_php',round(v_cfg.referred_qualification_centavos::numeric/100,2),
      'no_referrer_qualification_php',round(v_cfg.no_referrer_qualification_centavos::numeric/100,2),
      'first_line_pct',v_cfg.first_line_bps::numeric/100,
      'referral_months',v_cfg.referral_months,
      'was_referred',v_ref.referral_id is not null,
      'invited_count',(select count(*) from private.buklod_pf_referrals where referrer_person_id=v_person),
      'qualified_count',(select count(*) from private.buklod_pf_referrals where referrer_person_id=v_person and qualified_at is not null),
      'items',v_referrals
    ),

    'community',case
      when v_designation.id is null then jsonb_build_object(
        'selected',false
      )
      else jsonb_build_object(
        'selected',true,
        'scope_id',v_designation.scope_id,
        'scope_name',v_scope_name,
        'tier',coalesce(v_tier,'CLUSTER'),
        'allocation_pct',case
          when coalesce(v_tier,'CLUSTER')='ORGANIZATION'
            then v_cfg.organization_fund_bps::numeric/100
          else v_cfg.cluster_fund_bps::numeric/100
        end,
        'active_contributors',v_active_count,
        'organization_threshold',v_cfg.organization_contributor_threshold,
        'locked_until',v_designation.locked_until,
        'available_fund_php',round(
          greatest(
            private.buklod_pf_community_balance_centavos_v3(v_designation.scope_id,'AVAILABLE'),
            0
          )::numeric/100,
          2
        ),
        'reserved_fund_php',round(
          greatest(
            private.buklod_pf_community_balance_centavos_v3(v_designation.scope_id,'RESERVED'),
            0
          )::numeric/100,
          2
        ),
        'spent_fund_php',round(
          greatest(
            private.buklod_pf_community_balance_centavos_v3(v_designation.scope_id,'SPENT'),
            0
          )::numeric/100,
          2
        )
      )
    end
  );
end
$function$
revoke all on function public.get_my_buklod_financial_summary_v3() from public,anon;
grant execute on function public.get_my_buklod_financial_summary_v3() to authenticated;
