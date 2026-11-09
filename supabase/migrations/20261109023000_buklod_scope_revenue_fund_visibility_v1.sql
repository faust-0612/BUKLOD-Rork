-- BUKLOD live earnings visibility: read-only scoped fund balance.
-- All personal earnings stay behind own authenticated PF/QMP RPCs.
-- Scope community funds are never individual withdrawable balances.
create or replace function public.get_buklod_scope_revenue_fund_summary_v1(p_scope_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_scope public.buklod_scopes%rowtype;
  v_cfg private.buklod_pf_config%rowtype;
  v_tier text;
  v_rate integer;
  v_available bigint;
  v_reserved bigint;
  v_spent bigint;
begin
  if v_actor is null or p_scope_id is null then raise exception 'Authentication required'; end if;
  if not public.buklod_scope_can_access_v1(p_scope_id,v_actor) then
    raise exception 'Active scope membership required';
  end if;
  select * into v_scope from public.buklod_scopes where id=p_scope_id;
  if not found then raise exception 'Scope not found'; end if;
  if upper(v_scope.scope_type) not in ('ORGANIZATION','CLUSTER','SUB_ORGANIZATION') then
    raise exception 'Unsupported finance scope';
  end if;
  select * into v_cfg from private.buklod_pf_config where singleton=true;
  select current_tier into v_tier from private.buklod_pf_community_tiers where scope_id=p_scope_id;
  v_rate:=case when coalesce(v_tier,upper(v_scope.scope_type))='ORGANIZATION'
    then v_cfg.organization_fund_bps else v_cfg.cluster_fund_bps end;
  v_available:=greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'AVAILABLE'),0);
  v_reserved:=greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'RESERVED'),0);
  v_spent:=greatest(private.buklod_pf_community_balance_centavos_v3(p_scope_id,'SPENT'),0);
  return jsonb_build_object(
    'scope_id',p_scope_id,'scope_type',v_scope.scope_type,
    'fund_source','CANONICAL_FUNDED_COMMUNITY_LEDGER',
    'policy_allocation_bps',v_rate,
    'available_fund_minor',v_available,
    'reserved_fund_minor',v_reserved,
    'spent_fund_minor',v_spent,
    'is_member_personal_wallet',false,
    'member_withdrawal_allowed',false,
    'economics_enabled',coalesce(v_cfg.economics_enabled,false)
  );
end;
$function$;
revoke all on function public.get_buklod_scope_revenue_fund_summary_v1(uuid) from public,anon;
grant execute on function public.get_buklod_scope_revenue_fund_summary_v1(uuid) to authenticated;
comment on function public.get_buklod_scope_revenue_fund_summary_v1(uuid) is
'Authenticated exact-scope member community fund transparency. Separately funded PF community ledger only; not AdMob provisional and not a personal cash wallet.';
