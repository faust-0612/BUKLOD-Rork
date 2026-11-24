-- DEV ONLY, AFTER core stones, Kingdom eligibility and progression candidates.
-- No grants, no migrations, no client-callable function. Do not apply to MAIN.
begin;
create table empire_rewards.match_authority (
 match_id uuid primary key references empire_stones.match(id),
 host_id uuid not null,
 draft jsonb not null,
 started_at timestamptz,
 final_evidence jsonb,
 final_receipt jsonb,
 check((final_evidence is null)=(final_receipt is null))
);
alter table empire_rewards.match_authority enable row level security;

-- Server worker passes exactly ten eligible accounts + at most two captain ban intents.
-- Sorted canonical actions make retry independent of arrival/order.
create function empire_rewards.reserve_online(mid uuid,host uuid,mode_name text,actions jsonb) returns void
language plpgsql set search_path='' as $$
declare canonical jsonb; old empire_rewards.match_authority%rowtype; ids uuid[];
begin
 if mid is null or host is null or mode_name is null or mode_name not in ('casual','ranked') or
 jsonb_typeof(actions) is distinct from 'array' then raise exception 'Invalid online reservation'; end if;
 if jsonb_array_length(actions) not between 10 and 12 then raise exception 'Invalid roster size'; end if;
 if exists(select 1 from jsonb_array_elements(actions) a(x) where jsonb_typeof(x) is distinct from 'object'
 or not(x ?& array['user_id','team','hero_id','action']) or
 exists(select 1 from jsonb_object_keys(x) k where k not in ('user_id','team','hero_id','action'))) then raise exception 'Invalid draft shape'; end if;
 if exists(select 1 from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text)
 where a.user_id is null or a.team is null or a.team not in (0,1) or a.hero_id is null or
 a.action is null or a.action not in ('pick','ban') or
 not exists(select 1 from empire_stones.hero h where h.id=a.hero_id)) then raise exception 'Invalid draft entry'; end if;
 if (select count(*) from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='pick')<>10 or
 (select count(distinct user_id) from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='pick')<>10 or
 (select count(distinct hero_id) from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='pick')<>10 or
 (select count(*) from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='pick' and a.team=0)<>5
 then raise exception 'Invalid 5v5 roster'; end if;
 if exists(select 1 from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='ban'
 and (mode_name='ranked' or exists(select 1 from jsonb_to_recordset(actions) p(user_id uuid,team int,hero_id text,action text)
 where p.action='pick' and p.hero_id=a.hero_id))) then raise exception 'Invalid ban policy'; end if;
 if (select count(*) from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='ban') <>
 (select count(distinct hero_id) from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text) where a.action='ban') then raise exception 'Duplicate ban'; end if;
 select jsonb_agg(to_jsonb(a) order by a.user_id,a.action,a.hero_id,a.team),array_agg(distinct a.user_id)
 into canonical,ids from jsonb_to_recordset(actions) a(user_id uuid,team int,hero_id text,action text);
 -- Serialize same-match creation BEFORE core per-account locks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('empire_online:'||mid::text,0));
 select * into old from empire_rewards.match_authority where match_id=mid for update;
 if found then
  if old.host_id<>host or old.draft is distinct from jsonb_build_object('mode',mode_name,'actions',canonical) then raise exception 'Reservation conflict'; end if;
  return;
 end if;
 perform empire_stones.lock_users(ids);
 if exists(select 1 from unnest(ids) u(id) where not coalesce(empire_stones.eligible(u.id),false)) then raise exception 'Ineligible participant'; end if;
 -- Prevent adoption of a previously created legacy reservation.
 if exists(select 1 from empire_stones.match where id=mid) then raise exception 'Match id already used'; end if;
 perform empire_stones.reserve_match(mid,canonical,mode_name);
 insert into empire_rewards.match_authority(match_id,host_id,draft) values(mid,host,jsonb_build_object('mode',mode_name,'actions',canonical));
end $$;

-- A host identifier is a server-assigned fence, not an authentication credential.
-- Worker must confirm all ten connected and hold its exclusive host lease before calling.
create function empire_rewards.start_online(mid uuid,host uuid) returns void
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; state_now text;
begin
 select * into strict a from empire_rewards.match_authority where match_id=mid for update;
 if host is null or a.host_id<>host then raise exception 'Wrong match host'; end if;
 select state into strict state_now from empire_stones.match where id=mid for update;
 if state_now='started' and a.started_at is not null then return; end if;
 if state_now<>'reserved' or a.started_at is not null then raise exception 'Invalid start'; end if;
 perform empire_stones.settle_match(mid,'started');
 update empire_rewards.match_authority set started_at=now() where match_id=mid;
end $$;

-- Trusted adjudicator supplies replay digest and complete normalized category facts.
-- No reward amounts or player-selected outcomes accepted. This function does not
-- prove a replay is genuine; that is a mandatory upstream verifier, still pending.
create function empire_rewards.finish_online(mid uuid,host uuid,winner_team int,end_reason text,replay_sha256 text,participants jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; state_now text; canonical jsonb; evidence jsonb; receipts jsonb:='{}'::jsonb;
 ids uuid[]; r record; facts jsonb; result jsonb;
begin
 if host is null or (winner_team is not null and winner_team not in (0,1)) or end_reason is null or
 end_reason not in ('elimination','no-combatants','overtime-inactivity','overtime-safety-limit') or
 (end_reason<>'elimination' and winner_team is not null) or replay_sha256 is null or replay_sha256!~'^[a-f0-9]{64}$' or
 jsonb_typeof(participants) is distinct from 'array' then raise exception 'Invalid match evidence'; end if;
 if jsonb_array_length(participants)<>10 then raise exception 'Incomplete evidence'; end if;
 if exists(select 1 from jsonb_array_elements(participants) a(x) where jsonb_typeof(x) is distinct from 'object' or
 not(x ?& array['user_id','facts']) or exists(select 1 from jsonb_object_keys(x) k where k not in ('user_id','facts')) or
 jsonb_typeof(x->'facts') is distinct from 'object' or (x->'facts') ? 'outcome') then raise exception 'Invalid participant evidence'; end if;
 select jsonb_agg(to_jsonb(p) order by p.user_id),array_agg(distinct p.user_id)
 into canonical,ids from jsonb_to_recordset(participants) p(user_id uuid,facts jsonb);
 if cardinality(ids)<>10 or array_position(ids,null::uuid) is not null then raise exception 'Duplicate or null participant'; end if;
 evidence:=jsonb_build_object('winner_team',winner_team,'end_reason',end_reason,'replay_sha256',replay_sha256,'participants',canonical);
 select * into strict a from empire_rewards.match_authority where match_id=mid for update;
 if a.host_id<>host then raise exception 'Wrong match host'; end if;
 if a.final_evidence is not null then
  if a.final_evidence is distinct from evidence then raise exception 'Final evidence conflict'; end if;
  return a.final_receipt;
 end if;
 select state into strict state_now from empire_stones.match where id=mid for update;
 if state_now<>'started' or a.started_at is null then raise exception 'Match not started'; end if;
 if (select count(*) from empire_stones.match_action m where m.match_id=mid and m.action='pick' and m.user_id=any(ids))<>10
 then raise exception 'Roster mismatch'; end if;
 -- Acquire all participant locks once, in canonical order. Any error rolls back
 -- completion, unused-counter refund, all XP/BP and all receipts together.
 perform empire_stones.lock_users(ids);
 perform empire_stones.settle_match(mid,'completed');
 for r in select p.user_id,p.facts,m.team from jsonb_to_recordset(canonical) p(user_id uuid,facts jsonb)
 join empire_stones.match_action m on m.match_id=mid and m.action='pick' and m.user_id=p.user_id order by p.user_id loop
  facts:=r.facts||jsonb_build_object('outcome',case when winner_team is null then 'draw' when r.team=winner_team then 'win' else 'loss' end);
  if not coalesce(empire_stones.eligible(r.user_id),false) then facts:=facts||jsonb_build_object('eligible',false); end if;
  result:=empire_rewards.settle(mid,r.user_id,facts);
  receipts:=receipts||jsonb_build_object(r.user_id::text,result);
 end loop;
 result:=jsonb_build_object('match_id',mid,'winner_team',winner_team,'end_reason',end_reason,'receipts',receipts);
 update empire_rewards.match_authority set final_evidence=evidence,final_receipt=result where match_id=mid;
 return result;
end $$;

-- Invalid infrastructure results refund all stones, including activated counters,
-- and never grant or deduct BP/XP. Do not refund a completed match.
create function empire_rewards.abort_online(mid uuid,host uuid) returns void
language plpgsql set search_path='' as $$
declare a empire_rewards.match_authority%rowtype; state_now text;
begin
 select * into strict a from empire_rewards.match_authority where match_id=mid for update;
 if host is null or a.host_id<>host or a.final_evidence is not null then raise exception 'Invalid abort'; end if;
 select state into strict state_now from empire_stones.match where id=mid for update;
 if state_now in ('invalid','cancelled') then return; end if;
 if state_now='reserved' then perform empire_stones.settle_match(mid,'cancelled');
 elsif state_now='started' then perform empire_stones.settle_match(mid,'invalid');
 else raise exception 'Invalid abort state'; end if;
end $$;
revoke all on all tables in schema empire_rewards from public,anon,authenticated;
revoke all on all functions in schema empire_rewards from public,anon,authenticated;
-- No grants, no public RPC. Runtime lease/verified evidence adapters remain mandatory.
commit;
