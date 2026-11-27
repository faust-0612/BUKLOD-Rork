-- Run ONLY after test_online_match_settlement.sql in the SAME disposable database.
-- Previous fixture rolls back participants; this fixture creates its own.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() not like 'empire_online_test_%' or to_regclass('empire_rewards.match_authority') is null
 then raise exception 'Requires isolated disposable test DB'; end if;
end $$;
\ir online-match-lease-candidate.sql
begin;
do $$
declare ids uuid[]; heroes text[]:=array['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel'];
 mid uuid:='30000000-0000-0000-0000-000000000011'; mid2 uuid:='30000000-0000-0000-0000-000000000012';
 host uuid:='40000000-0000-0000-0000-000000000011'; other uuid:='40000000-0000-0000-0000-000000000012';
 actions jsonb:='[]'; i int; rejected boolean; deadline timestamptz;
begin
 select array_agg(('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid order by n) into ids from generate_series(11,20) n;
 for i in 1..10 loop
  insert into public.profiles values(ids[i]);
  perform empire_stones.grant_verified(ids[i],heroes[i],1,'kingdom_quest','lease-one-'||i,(select kingdom_quest from empire_stones.hero where id=heroes[i]));
  perform empire_stones.grant_verified(ids[i],heroes[i],1,'kingdom_quest','lease-two-'||i,(select kingdom_quest from empire_stones.hero where id=heroes[i]));
  actions:=actions||jsonb_build_array(jsonb_build_object('user_id',ids[i],'hero_id',heroes[i],'team',case when i<=5 then 0 else 1 end,'action','pick'));
 end loop;
 deadline:=empire_rewards.reserve_leased(mid,host,'casual',actions);
 if deadline is distinct from empire_rewards.reserve_leased(mid,host,'casual',actions) then raise exception 'Reservation retry drift';end if;
 if (select count(*) from empire_rewards.active_online_seat where match_id=mid)<>10 then raise exception 'Seat fence missing';end if;
 rejected:=false;begin perform empire_rewards.reserve_leased(mid2,other,'casual',actions);exception when unique_violation then rejected:=true;end;
 if not rejected or exists(select 1 from empire_stones.match where id=mid2) or (select sum(balance) from empire_stones.wallet where user_id=any(ids))<>10 then raise exception 'Cross-match atomicity failed';end if;
 rejected:=false;begin perform empire_rewards.start_leased(mid,other);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Wrong host started';end if;
 perform empire_rewards.start_leased(mid,host);
 perform empire_rewards.renew_online(mid,host);
 update empire_rewards.match_authority set lease_until=clock_timestamp()-interval '1 second' where match_id=mid;
 rejected:=false;begin perform empire_rewards.renew_online(mid,host);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Expired lease resurrected';end if;
 if empire_rewards.recover_expired_online() is distinct from mid then raise exception 'Recovery failed';end if;
 if empire_rewards.recover_expired_online() is not null or exists(select 1 from empire_rewards.active_online_seat where match_id=mid) or
 (select state from empire_stones.match where id=mid)<>'invalid' or
 (select sum(balance) from empire_stones.wallet where user_id=any(ids))<>20 or exists(select 1 from empire_rewards.settlement where match_id=mid)
 then raise exception 'Recovery refund or idempotency failed';end if;
 perform empire_rewards.reserve_leased(mid2,other,'ranked',actions);
 perform empire_rewards.abort_leased(mid2,other);perform empire_rewards.abort_leased(mid2,other);
 if exists(select 1 from empire_rewards.active_online_seat where match_id=mid2) or (select sum(balance) from empire_stones.wallet where user_id=any(ids))<>20 then raise exception 'Abort failed';end if;
end $$;
rollback;
select 'LEASED_MATCH_ISOLATED_FIXTURE_PASS' as verdict;
