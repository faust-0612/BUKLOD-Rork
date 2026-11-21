-- Isolated-test-DB verification AFTER applying the two reviewed DEV migrations.
-- READ-ONLY contract checks; no production data mutations or feature flag flips.
do $buklod_trade_security_tests$
declare t text; n integer; src text; qty_low integer; qty_high integer;
begin
 foreach t in array array[
  'buklod_trade_config','buklod_trade_items','buklod_trade_inventory',
  'buklod_trade_participation_claims','buklod_trade_businesses',
  'buklod_trade_build_requirements','buklod_trade_build_history',
  'buklod_trade_listings','buklod_trade_orders','buklod_trade_bp_transfers'
 ] loop
  if to_regclass('public.'||t) is null then
   raise exception 'Missing marketplace table: %',t; end if;
  if not exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
   where ns.nspname='public' and c.relname=t and c.relrowsecurity) then
   raise exception 'Missing RLS: %',t; end if;
  if has_table_privilege('anon','public.'||t,'SELECT')
     or has_table_privilege('anon','public.'||t,'INSERT')
     or has_table_privilege('authenticated','public.'||t,'INSERT')
     or has_table_privilege('authenticated','public.'||t,'UPDATE')
     or has_table_privilege('authenticated','public.'||t,'DELETE') then
   raise exception 'Direct marketplace table permissions: %',t; end if;
 end loop;
 if (select enabled or rank_profit_enabled from public.buklod_trade_config where singleton) then
  raise exception 'Trade or Rank activated by migration'; end if;
 if (select count(*) from public.buklod_trade_build_requirements where item_code='wood')<>50 then
  raise exception 'All 10 levels x 5 visible construction stages required'; end if;
 select quantity into qty_low from public.buklod_trade_build_requirements
 where level=1 and stage=1 and item_code='wood';
 select quantity into qty_high from public.buklod_trade_build_requirements
 where level=10 and stage=1 and item_code='wood';
 if qty_low>=qty_high then raise exception 'High levels are not more difficult'; end if;
 if has_function_privilege('anon','public.buklod_trade_buy_item_v1(uuid,integer,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.buklod_trade_buy_item_v1(uuid,integer,text)','EXECUTE')
    or has_function_privilege('anon','public.buklod_trade_claim_participation_item_v1(uuid)','EXECUTE')
    or has_function_privilege('anon','public.buklod_trade_settle_rank_v1(uuid)','EXECUTE')
    then raise exception 'Marketplace RPC grants are unsafe'; end if;
 select pg_get_functiondef('public.buklod_trade_buy_item_v1(uuid,integer,text)'::regprocedure) into src;
 if position('buyer_request_key' in src)=0
    or position('for update' in lower(src))=0
    or position('buklod_trade_inventory' in src)=0
    or position('buklod_trade_bp_transfers' in src)=0
    or position('trade:buyer:' in src)=0
    or position('auth.uid()' in src)=0
    then raise exception 'Atomic transfer/escrow/idempotency controls missing'; end if;
 select pg_get_functiondef('public.buklod_trade_claim_participation_item_v1(uuid)'::regprocedure) into src;
 if position('claim_state in (' in lower(src))=0
    or position('on conflict(source_ledger_id) do nothing' in lower(src))=0
    then raise exception 'Item provenance validation and idempotency missing'; end if;
 select pg_get_functiondef('public.buklod_trade_settle_rank_v1(uuid)'::regprocedure) into src;
 if position('72 hours' in src)=0
    or position('gross_profit_bp' in src)=0
    or position('lifetime_points=lifetime_points+v_credit' in src)=0
    or position('available_points=available_points+v_credit' in src)>0
    then raise exception 'Rank profit must not mint spendable BP'; end if;
 -- Unauthenticated attempts must fail without ever writing a row.
 begin
   perform public.buklod_trade_snapshot_v1();
   raise exception 'FAIL: unauthenticated snapshot unexpectedly allowed';
 exception when others then
   if SQLERRM like 'FAIL:%' then raise; end if;
 end;
end;
$buklod_trade_security_tests$;
