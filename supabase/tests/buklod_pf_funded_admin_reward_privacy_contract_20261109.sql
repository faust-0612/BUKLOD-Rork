-- No money is moved by this contract. Confirm privileged source and locked gates.
do $buklod_funded_admin_rewards_contract$
declare
  v_grant oid := to_regprocedure('public.admin_transfer_buklod_pf_funded_reward_v1(uuid,uuid,bigint,text,text)');
  v_register oid := to_regprocedure('public.admin_register_buklod_pf_reward_funding_v1(text,text,bigint,text)');
  v_verify oid := to_regprocedure('public.admin_verify_buklod_pf_reward_funding_v1(uuid,text)');
  v_toggle oid := to_regprocedure('public.admin_set_buklod_pf_reward_transfers_enabled_v1(boolean)');
  v_reader oid := to_regprocedure('public.get_my_buklod_financial_earnings_breakdown_v1()');
  v_body text;
  v_reader_body text;
begin
  if v_grant is null or v_register is null or v_verify is null or v_toggle is null or v_reader is null then
    raise exception 'A funded admin rewards control or private reporting API is missing';
  end if;
  if has_function_privilege('anon',v_grant,'EXECUTE') or has_function_privilege('anon',v_register,'EXECUTE')
      or has_function_privilege('anon',v_verify,'EXECUTE') or has_function_privilege('anon',v_toggle,'EXECUTE') then
    raise exception 'Unauthenticated reward funding privilege exposure';
  end if;
  if has_table_privilege('authenticated','private.buklod_pf_admin_reward_budgets','SELECT')
      or has_table_privilege('authenticated','private.buklod_pf_admin_reward_transfers','INSERT')
      or has_table_privilege('anon','private.buklod_pf_admin_reward_controls','UPDATE') then
    raise exception 'Reward escrow and cash transfers exposed without server authorization';
  end if;
  v_body:=pg_get_functiondef(v_grant);
  v_reader_body:=pg_get_functiondef(v_reader);
  if position('buklod_is_system_admin' in v_body)=0
    or position('economics_enabled' in v_body)=0
    or position('v_enabled' in v_body)=0
    or position('VERIFIED_BY_ADMIN' in v_body)=0
    or position('remaining_centavos>=p_amount_centavos' in v_body)=0
    or position('risk_status' in v_body)=0
    or position('for update' in lower(v_body))=0
    or position('ADMIN_CORRECTION' in v_body)=0
    or position('ADMIN_FUNDED_REWARD' in v_body)=0
    or position('v_cfg.withdrawal_enabled' in v_body)=0
    or position('admin_funded_reward_php' in v_reader_body)=0 then
    raise exception 'Audited source, idempotency, role, cash isolation or private reward breakdown missing';
  end if;
  if not exists (select 1 from private.buklod_pf_admin_reward_controls where singleton=true) then
    raise exception 'Reward funding control row not installed';
  end if;
end;
$buklod_funded_admin_rewards_contract$;
