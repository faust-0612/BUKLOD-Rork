create or replace function public.get_buklod_r38_economy_policy_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  cfg jsonb := private.buklod_r38_policy_config_v1();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'policy_version','r38_unified_economy_v1',
    'referral',jsonb_build_object(
      'direct_only',coalesce((cfg->'referral'->>'direct_only')::boolean,true),
      'qualification_active_days',greatest(coalesce((cfg->'referral'->>'qualification_active_days')::integer,3),1),
      'qualification_activities',greatest(coalesce((cfg->'referral'->>'qualification_activities')::integer,3),1),
      'earning_window_months',greatest(coalesce((cfg->'referral'->>'earning_window_months')::integer,6),1),
      'rcu_percent_of_qualified_bcu',greatest(coalesce((cfg->'referral'->>'rcu_percent_of_qualified_bcu')::numeric,0.10),0),
      'qualification_activity_types',jsonb_build_array('community_post','devotion_completed','reading_completed','lesson_completed'),
      'organization_required',false,
      'attendance_required',false,
      'reports_required',false,
      'classroom_required',false,
      'purchase_required',false,
      'ad_view_required',false
    ),
    'withdrawal',jsonb_build_object(
      'currency',coalesce(cfg->'withdrawal'->>'currency','PHP'),
      'minimum_amount',greatest(coalesce((cfg->'withdrawal'->>'minimum_amount')::numeric,200),0),
      'full_balance_only',coalesce((cfg->'withdrawal'->>'full_balance_only')::boolean,true),
      'partial_enabled',coalesce((cfg->'withdrawal'->>'partial_enabled')::boolean,false),
      'manual_processing_phase_1',coalesce((cfg->'withdrawal'->>'manual_processing_phase_1')::boolean,true)
    ),
    'allocation_percent',coalesce(cfg->'allocation_percent','{}'::jsonb),
    'activation',coalesce(cfg->'activation','{}'::jsonb),
    'invariants',jsonb_build_object(
      'points_are_money',false,
      'points_fixed_php_rate',false,
      'bcu_fixed_php_rate',false,
      'rcu_fixed_php_rate',false,
      'cash_source','FINALIZED_FUNDED_PLATFORM_REVENUE',
      'bcu_rcu_are_weights_only',true
    )
  );
end;
$function$;

revoke all on function public.get_buklod_r38_economy_policy_v1() from public,anon;
grant execute on function public.get_buklod_r38_economy_policy_v1() to authenticated;

comment on function public.get_buklod_r38_economy_policy_v1() is
'Authenticated user-safe R38 policy contract. Exposes referral/withdrawal rules and invariants without creating any monetary entitlement.';