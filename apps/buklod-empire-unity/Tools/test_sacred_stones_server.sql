-- psql integration fixture ONLY in a disposable LOCAL PostgreSQL cluster.
-- Do not run against any Supabase project, staging, or production.
\set ON_ERROR_STOP on
do $$
begin
 if current_database() not like 'empire_stones_test_%' or
    to_regclass('public.profiles') is not null or to_regnamespace('empire_stones') is not null then
   raise exception 'Requires an empty disposable local empire_stones_test_* database';
 end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create table public.profiles(id uuid primary key);
create table public.buklod_user_points_balances(user_id uuid primary key,available_points bigint not null check(available_points>=0));
create table public.buklod_points_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null,
 direction text not null,points integer not null,activity_type text,source_key text unique,source_id uuid,description text);
create function public.buklod_points_cash_reserved_for(uuid) returns bigint language sql as $$ select 0::bigint $$;
create function public.test_bp_debit() returns trigger language plpgsql as $$
begin
 update public.buklod_user_points_balances set available_points=available_points-new.points where user_id=new.user_id;
 return new;
end $$;
create trigger test_bp_debit after insert on public.buklod_points_ledger for each row execute function public.test_bp_debit();
\ir sacred-stones-server-candidate.sql
begin;
do $$
declare
 a uuid:='10000000-0000-0000-0000-000000000001';
 b uuid:='10000000-0000-0000-0000-000000000002';
 req uuid:='20000000-0000-0000-0000-000000000001';
 tr uuid:='20000000-0000-0000-0000-000000000002';
 mid uuid:='30000000-0000-0000-0000-000000000001';
 rejected boolean:=false;
 actions jsonb;
begin
 insert into public.profiles values(a),(b);
 insert into public.buklod_user_points_balances values(a,500),(b,500);
 perform empire_stones.exchange(a,'phan',2,req);
 perform empire_stones.exchange(a,'phan',2,req);
 if (select available_points from public.buklod_user_points_balances where user_id=a)<>300 or
    (select balance from empire_stones.wallet where user_id=a and hero_id='phan')<>2 or
    (select count(*) from public.buklod_points_ledger where user_id=a)<>1 then raise exception 'BP exchange replay failure'; end if;
 begin
  perform empire_stones.exchange(a,'quin',2,req);
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception 'Mismatched idempotency payload accepted'; end if;
 perform empire_stones.grant_verified(a,'quin',1,'kingdom_quest','fixture-quest-1','exploration_puzzle');
 perform empire_stones.grant_verified(a,'trudice',1,'community','fixture-community-1','academic_milestone');
 perform empire_stones.convert(a,'phan',array['trudice','quin'],false,'20000000-0000-0000-0000-000000000003');
 if (select balance from empire_stones.wallet where user_id=a and hero_id='phan')<>3 then raise exception 'Recipe conversion failure'; end if;
 perform empire_stones.exchange(b,'quin',2,'20000000-0000-0000-0000-000000000004');
 perform empire_stones.offer_trade(tr,a,b,array['phan'],array['quin']);
 perform empire_stones.accept_trade(tr,b);
 perform empire_stones.accept_trade(tr,b);
 if (select balance from empire_stones.wallet where user_id=a and hero_id='quin')<>1 or
    (select balance from empire_stones.wallet where user_id=b and hero_id='phan')<>1 then raise exception 'Trade replay failure'; end if;
 actions:=jsonb_build_array(jsonb_build_object('user_id',a,'team',0,'hero_id','phan','action','pick'),
   jsonb_build_object('user_id',b,'team',1,'hero_id','quin','action','pick'));
 perform empire_stones.reserve_match(mid,actions,'casual');
 perform empire_stones.reserve_counter(mid,a,'quin');
 perform empire_stones.settle_match(mid,'started');
 perform empire_stones.settle_match(mid,'completed');
 perform empire_stones.settle_match(mid,'completed');
 if (select balance from empire_stones.wallet where user_id=a and hero_id='quin')<>1 or
    (select balance from empire_stones.wallet where user_id=a and hero_id='phan')<>1 then raise exception 'Unused counter refund or pick consumption failure'; end if;
 if has_function_privilege('authenticated','empire_stones.exchange(uuid,text,integer,uuid)','EXECUTE') or
    has_table_privilege('anon','empire_stones.wallet','SELECT') then raise exception 'Private economy unexpectedly exposed'; end if;
end $$;
rollback;
-- This verifies candidate semantics with a mock BP trigger only. Canonical production ledger parity,
-- trusted service identity, concurrency and payment provider integration still need separate acceptance.
