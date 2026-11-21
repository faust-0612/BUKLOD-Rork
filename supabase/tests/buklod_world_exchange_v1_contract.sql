-- Run ONLY in an isolated test project AFTER applying the candidate SQL there.
-- This SQL contract does not modify application data or toggle live feature flags.
do $$
declare t text; n integer;
begin
  foreach t in array array[
    'buklod_world_exchange_gate_v1','buklod_world_verified_sources_v1',
    'buklod_world_items_v1','buklod_world_offers_v1','buklod_world_bp_transfers_v1'
  ] loop
    if not exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
        where s.nspname='private' and c.relname=t and c.relrowsecurity) then
      raise exception 'Missing RLS on private.%',t;
    end if;
  end loop;
  if (select trading_enabled from private.buklod_world_exchange_gate_v1 where singleton) is distinct from false
    or (select issuance_enabled from private.buklod_world_exchange_gate_v1 where singleton) is distinct from false then
    raise exception 'Unsafe default: feature flags are not OFF';
  end if;
  if has_table_privilege('authenticated','private.buklod_world_items_v1','UPDATE')
      or has_table_privilege('anon','private.buklod_world_items_v1','SELECT')
      or has_table_privilege('authenticated','private.buklod_world_verified_sources_v1','INSERT')
      or has_table_privilege('authenticated','private.buklod_world_bp_transfers_v1','INSERT') then
    raise exception 'Direct item, source or transfer privilege leaked';
  end if;
  if has_function_privilege('authenticated','private.buklod_world_issue_verified_item_v1(text)','EXECUTE')
      or has_function_privilege('anon','public.buklod_world_buy_offer_v1(uuid,text)','EXECUTE') then
    raise exception 'Unauthorized issuance or purchase function privilege';
  end if;
  if not has_function_privilege('authenticated','public.buklod_world_buy_offer_v1(uuid,text)','EXECUTE') then
    raise exception 'Authenticated purchase endpoint unavailable';
  end if;
  if (select count(*) from pg_indexes where schemaname='private'
        and indexname='buklod_world_one_open_offer_per_item_v1')<>1 then
    raise exception 'Missing unique open escrow protection';
  end if;
  -- Existing reward ledger triggers remain in place. World exchange must NEVER
  -- update lifetime_points or insert reward-credit ledger entries.
  select count(*) into n from pg_trigger g join pg_class c on c.oid=g.tgrelid
   join pg_namespace s on s.oid=c.relnamespace
   where s.nspname='public' and c.relname='buklod_points_ledger' and not g.tgisinternal;
  if n=0 then raise exception 'Existing points ledger unexpectedly modified or missing'; end if;
end $$;