-- Focused BUKLOD Kingdom Shards DB regression assertions.
-- Run only on a migration-applied isolated database. This test is read-only,
-- requires no real user mutation, and rolls back its transaction.
begin;
do $test$
declare
  v_table text;
  v_rls boolean;
begin
  foreach v_table in array array[
    'private.buklod_kingdom_shards_wallet_v1',
    'private.buklod_kingdom_shards_ledger_v1',
    'private.buklod_kingdom_items_v1'
  ] loop
    if to_regclass(v_table) is null then
      raise exception 'Missing BUKLOD Kingdom table: %',v_table;
    end if;
    select c.relrowsecurity into v_rls
    from pg_class c where c.oid=to_regclass(v_table);
    if not coalesce(v_rls,false) then
      raise exception 'Kingdom Shards table missing RLS: %',v_table;
    end if;
    if has_table_privilege('anon',v_table,'SELECT') or
       has_table_privilege('authenticated',v_table,'INSERT') or
       has_table_privilege('authenticated',v_table,'UPDATE') or
       has_table_privilege('authenticated',v_table,'DELETE') then
      raise exception 'Kingdom direct table permission exposed: %',v_table;
    end if;
  end loop;
  if has_function_privilege('anon','public.get_my_buklod_kingdom_shards_v1()','EXECUTE')
    or has_function_privilege('anon','public.buy_my_buklod_kingdom_item_v1(text)','EXECUTE') then
    raise exception 'Anonymous Kingdom Shards RPC exposure';
  end if;
  if not has_function_privilege('authenticated',
      'public.get_my_buklod_kingdom_shards_v1()','EXECUTE') or
     not has_function_privilege('authenticated',
      'public.buy_my_buklod_kingdom_item_v1(text)','EXECUTE') then
    raise exception 'Authenticated Kingdom Shards RPC unavailable';
  end if;
  if exists(
    select 1 from private.buklod_kingdom_shards_wallet_v1
    where balance<0 or earned<spent or earned-spent<>balance
  ) then raise exception 'Kingdom Shards wallet conservation mismatch'; end if;
  if exists(
    select 1 from private.buklod_kingdom_shards_ledger_v1
    where amount=0 or balance_after<0
  ) then raise exception 'Invalid Kingdom Shards ledger entry'; end if;
  if exists(
    select 1 from private.buklod_kingdom_items_v1
    where item_key not in
      ('wisdom_lens','guardian_shield','explorer_compass','aura_emerald')
  ) then raise exception 'Unrecognized Kingdom item'; end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='private.buklod_kingdom_shards_ledger_v1'::regclass
      and contype='p'
  ) then raise exception 'Shards idempotency primary key missing'; end if;
end;
$test$;
rollback;
