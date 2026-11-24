-- Run ONLY on an empty disposable LOCAL PostgreSQL database named empire_online_test_*.
-- No connection to MAIN, staging or any shared database. This fixture has not been executed.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() not like 'empire_online_test_%' or to_regclass('public.profiles') is not null or
 to_regnamespace('empire_stones') is not null or to_regnamespace('empire_rewards') is not null
 then raise exception 'Requires empty disposable local database'; end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create table public.profiles(id uuid primary key);
create table public.buklod_user_points_balances(user_id uuid primary key,available_points bigint not null);
create table public.buklod_points_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null,
 direction text not null,points integer not null,activity_type text,source_key text unique,source_id uuid,description text);
create function public.buklod_points_cash_reserved_for(uuid) returns bigint language sql as $$ select 0::bigint $$;
create schema private;
create table private.buklod_character_progress_v3(user_id uuid,character_id text,earned_points bigint not null,updated_at timestamptz default now(),primary key(user_id,character_id));
\ir sacred-stones-server-candidate.sql
-- Fixture stand-in ONLY; real eligibility is in sacred-stones-kingdom-candidate.sql.
create function empire_stones.eligible(u uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=u) and u<>'10000000-0000-0000-0000-000000000099'::uuid
$$;
\ir arena-progression-server-candidate.sql
\ir online-match-settlement-candidate.sql
begin;
do $$
declare ids uuid[]; heroes text[]:=array['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel'];
 mid uuid:='30000000-0000-0000-0000-000000000001'; mid2 uuid:='30000000-0000-0000-0000-000000000002';
 host uuid:='40000000-0000-0000-0000-000000000001'; wrong_host uuid:='40000000-0000-0000-0000-000000000002';
 actions jsonb:='[]'; participants jsonb:='[]'; bad jsonb; scores jsonb; metric jsonb;
 receipt jsonb; i integer; rejected boolean;
begin
 select array_agg(('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid order by n) into ids from generate_series(1,10) n;
 metric:='{"effective":100,"target":100,"successful":10,"attempts":10,"difficulty":100}';
 scores:=jsonb_build_object('teamwork',metric,'combat',metric,'objective',metric,'support',metric,'resource',metric,'village',metric,'defense',metric,'leadership',metric);
 for i in 1..10 loop
  insert into public.profiles values(ids[i]);
  perform empire_stones.grant_verified(ids[i],heroes[i],1,'kingdom_quest','fixture-grant-'||i,(select kingdom_quest from empire_stones.hero where id=heroes[i]));
  -- Additional stone is available for a later refund fixture.
  perform empire_stones.grant_verified(ids[i],heroes[i],1,'kingdom_quest','fixture-second-'||i,(select kingdom_quest from empire_stones.hero where id=heroes[i]));
  actions:=actions||jsonb_build_array(jsonb_build_object('user_id',ids[i],'hero_id',heroes[i],'team',case when i<=5 then 0 else 1 end,'action','pick'));
  participants:=participants||jsonb_build_array(jsonb_build_object('user_id',ids[i],'facts',jsonb_build_object('eligible',true,'mvp',false,'conduct','clean','scores',scores,'virtue',90)));
 end loop;
 -- Incomplete draft must fail without debits.
 rejected:=false;
 begin perform empire_rewards.reserve_online(mid,host,'casual',actions-9);exception when others then rejected:=true;end;
 if not rejected or exists(select 1 from empire_stones.match where id=mid) then raise exception 'Incomplete draft accepted';end if;
 perform empire_rewards.reserve_online(mid,host,'casual',actions);
 perform empire_rewards.reserve_online(mid,host,'casual',actions);
 if (select sum(balance) from empire_stones.wallet)<>10 then raise exception 'Reservation replay';end if;
 rejected:=false;
 begin perform empire_rewards.start_online(mid,wrong_host);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Host fence failed';end if;
 perform empire_rewards.start_online(mid,host);
 perform empire_rewards.start_online(mid,host);
 -- Invalid final participant data must roll back completion and every reward.
 bad:=jsonb_set(participants,'{9,facts,scores,teamwork}','null'::jsonb);
 rejected:=false;
 begin perform empire_rewards.finish_online(mid,host,0,'elimination',repeat('a',64),bad);exception when others then rejected:=true;end;
 if not rejected or exists(select 1 from empire_rewards.settlement where match_id=mid) or
 (select state from empire_stones.match where id=mid)<>'started' then raise exception 'Atomic rollback failed';end if;
 receipt:=empire_rewards.finish_online(mid,host,0,'elimination',repeat('a',64),participants);
 if receipt is distinct from empire_rewards.finish_online(mid,host,0,'elimination',repeat('a',64),participants) then raise exception 'Final replay changed receipt';end if;
 if (select count(*) from empire_rewards.settlement where match_id=mid)<>10 or
 (select count(*) from empire_rewards.settlement where match_id=mid and evidence->>'outcome'='win')<>5 or
 (select count(*) from empire_rewards.settlement where match_id=mid and evidence->>'outcome'='loss')<>5 or
 (select sum(bp_delta) from empire_rewards.settlement where match_id=mid)<>120 or
 (select count(*) from private.buklod_character_progress_v3)<>10 then raise exception 'Final reward mismatch';end if;
 rejected:=false;
 begin perform empire_rewards.finish_online(mid,host,1,'elimination',repeat('b',64),participants);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Conflicting result accepted';end if;
 perform empire_rewards.reserve_online(mid2,host,'ranked',actions);
 perform empire_rewards.start_online(mid2,host);
 perform empire_rewards.abort_online(mid2,host);
 perform empire_rewards.abort_online(mid2,host);
 if (select sum(balance) from empire_stones.wallet)<>10 or exists(select 1 from empire_rewards.settlement where match_id=mid2)
 then raise exception 'Invalid-match refund failed';end if;
end $$;
rollback;
