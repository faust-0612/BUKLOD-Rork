-- Read-only scoped finance visibility contract. Never writes balances.
do $buklod_scope_money_visibility$
declare
  v_reader oid := to_regprocedure('public.get_buklod_scope_revenue_fund_summary_v1(uuid)');
  v_src text;
begin
  if v_reader is null then raise exception 'Missing scope finance summary RPC'; end if;
  if has_function_privilege('anon',v_reader,'EXECUTE') then
    raise exception 'Anon can access scope finances';
  end if;
  if not has_function_privilege('authenticated',v_reader,'EXECUTE') then
    raise exception 'Members cannot access scope fund summary';
  end if;
  v_src:=pg_get_functiondef(v_reader);
  if position('auth.uid()' in v_src)=0
     or position('buklod_scope_can_access_v1' in v_src)=0
     or position('buklod_pf_community_balance_centavos_v3' in v_src)=0
     or position('member_withdrawal_allowed' in v_src)=0
     or position('false' in v_src)=0
     or position('CANONICAL_FUNDED_COMMUNITY_LEDGER' in v_src)=0 then
    raise exception 'Scope member, source, or no-withdrawal gate missing';
  end if;
  if position('buklod_pf_cash_ledger' in v_src)>0
     or position('admin_finalize' in v_src)>0
     or position('insert into' in lower(v_src))>0
     or position('credit_wallet' in v_src)>0 then
    raise exception 'Scope visibility must not mutate personal cash';
  end if;
end;
$buklod_scope_money_visibility$;
