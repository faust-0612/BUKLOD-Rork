-- DEV ONLY; install after the core and Kingdom candidate on a disposable database.
-- Separate gates default false. No client-trusted world result or reward amount.
begin;
create table empire_stones.discovery_policy (
 source text primary key check(source in ('rare_pick','monster_drop','treasure_discovery','village_reward','quest_reward')),
 chance_bps integer not null check(chance_bps between 0 and 10000)
);
insert into empire_stones.discovery_policy values
 ('rare_pick',500),('monster_drop',800),('treasure_discovery',1200),('village_reward',1500),('quest_reward',2000);
create table empire_stones.discovery_event (
 id uuid primary key default gen_random_uuid(), source_key text not null unique,
 user_id uuid not null references public.profiles(id), hero_id text not null references empire_stones.hero(id),
 source text not null references empire_stones.discovery_policy(source),
 outcome text not null check(outcome in ('awarded','no_drop','daily_cap','roll_cap')),
 created_at timestamptz not null default now()
);
create index discovery_events_user_day on empire_stones.discovery_event(user_id,created_at);
create table empire_stones.world_session (
 id uuid primary key, user_id uuid not null references public.profiles(id),
 hero_id text not null references empire_stones.hero(id), expires_at timestamptz not null,
 closed boolean not null default false
);
create table empire_stones.discovery_challenge (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 hero_id text not null references empire_stones.hero(id), questions jsonb not null,
 state text not null default 'pending' check(state in ('pending','failed','expired','verified')),
 outcome text, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes'
);
create index discovery_challenge_user_day on empire_stones.discovery_challenge(user_id,created_at);
create unique index discovery_one_pending on empire_stones.discovery_challenge(user_id) where state='pending';
alter table empire_stones.discovery_policy enable row level security;
alter table empire_stones.discovery_event enable row level security;
alter table empire_stones.world_session enable row level security;
alter table empire_stones.discovery_challenge enable row level security;
-- Only trusted functions can call this. Lock shared wallet per account, persist
-- every outcome, and never reroll an event, including suppressed events.
create function empire_stones.settle_discovery(u uuid,h text,kind text,evidence text) returns text
language plpgsql set search_path='' as $$
declare old empire_stones.discovery_event%rowtype; result text; event_id uuid; location_id text; chance integer;
 day_start timestamptz:=date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
 if not empire_stones.eligible(u) or evidence is null or length(evidence) not between 1 and 180 then raise exception 'Invalid discovery'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled and
  (case when kind='quest_reward' then discovery_enabled or world_discovery_enabled else world_discovery_enabled end))
 then raise exception 'Discovery unavailable'; end if;
 select kingdom_location into strict location_id from empire_stones.hero where id=h;
 select chance_bps into strict chance from empire_stones.discovery_policy where source=kind;
 perform empire_stones.lock_users(array[u]);
 -- Serialize even conflicting reuse of the same evidence across accounts.
 perform pg_advisory_xact_lock(hashtextextended('stone-discovery:'||evidence,0));
 select * into old from empire_stones.discovery_event where source_key=evidence;
 if found then
  if old.user_id is distinct from u or old.hero_id is distinct from h or old.source is distinct from kind then raise exception 'Discovery evidence conflict'; end if;
  return old.outcome;
 end if;
 if exists(select 1 from empire_stones.discovery_event where user_id=u and created_at>=day_start and outcome='awarded') then result:='daily_cap';
 elsif (select count(*) from empire_stones.discovery_event where user_id=u and created_at>=day_start and outcome in ('awarded','no_drop'))>=12 then result:='roll_cap';
 elsif floor(random()*10000)::integer<chance then result:='awarded';
 else result:='no_drop'; end if;
 insert into empire_stones.discovery_event(source_key,user_id,hero_id,source,outcome)
 values(evidence,u,h,kind,result) returning id into event_id;
 if result='awarded' then perform empire_stones.grant_verified(u,h,1,kind,'discovery-v1:'||event_id::text,location_id); end if;
 return result;
end $$;
-- Future authoritative world engine calls these private functions with its OWN
-- session/object identity. No raw client event, no public RPC, no offline mint.
create function empire_stones.open_world_discovery(sid uuid,u uuid,h text) returns void
language plpgsql set search_path='' as $$
declare old empire_stones.world_session%rowtype;
begin
 if sid is null or not empire_stones.eligible(u) or not exists(select 1 from empire_stones.release_gate where singleton and enabled and world_discovery_enabled)
 then raise exception 'World discovery unavailable'; end if;
 insert into empire_stones.world_session(id,user_id,hero_id,expires_at) values(sid,u,h,now()+interval '45 minutes') on conflict do nothing;
 if not found then
  select * into strict old from empire_stones.world_session where id=sid;
  if old.user_id is distinct from u or old.hero_id is distinct from h then raise exception 'World session conflict'; end if;
 end if;
end $$;
create function empire_stones.record_world_discovery(sid uuid,object_key text,kind text) returns text
language plpgsql set search_path='' as $$
declare s empire_stones.world_session%rowtype; prior empire_stones.discovery_event%rowtype; evidence text;
begin
 if object_key is null or length(object_key) not between 1 and 100 or kind is null or kind not in ('rare_pick','monster_drop','treasure_discovery','village_reward','quest_reward') then raise exception 'Invalid world event'; end if;
 select * into strict s from empire_stones.world_session where id=sid for update;
 if not empire_stones.eligible(s.user_id) then raise exception 'Ineligible account'; end if;
 evidence:='world:'||sid::text||':'||object_key;
 select * into prior from empire_stones.discovery_event where source_key=evidence;
 if found then
  if prior.source is distinct from kind then raise exception 'World object already settled'; end if;
  return prior.outcome;
 end if;
 if s.closed or s.expires_at<=now() or not exists(select 1 from empire_stones.release_gate where singleton and enabled and world_discovery_enabled) then raise exception 'World session unavailable'; end if;
 return empire_stones.settle_discovery(s.user_id,s.hero_id,kind,evidence);
end $$;
create function empire_stones.close_world_discovery(sid uuid) returns void
language sql set search_path='' as $$ update empire_stones.world_session set closed=true where id=sid $$;
-- A playable repeatable Kingdom discovery trial, independent of offline wins.
-- Private answer keys generated on server, 3 attempts per Manila day; one active
-- challenge across heroes. No paid entry, no points or Shards charged.
create function public.start_my_empire_discovery_v1(p_hero_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); c empire_stones.discovery_challenge%rowtype;
 q jsonb:='[]'::jsonb; a integer; b integer; d integer; i integer;
 day_start timestamptz:=date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
 if u is null or not empire_stones.eligible(u) then raise exception 'Discovery account ineligible'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled and discovery_enabled) then return jsonb_build_object('enabled',false); end if;
 if not exists(select 1 from empire_stones.hero where id=p_hero_id) then raise exception 'Unknown hero'; end if;
 perform empire_stones.check_rate(u);
 perform empire_stones.lock_users(array[u]);
 update empire_stones.discovery_challenge set state='expired' where user_id=u and state='pending' and expires_at<=now();
 select * into c from empire_stones.discovery_challenge where user_id=u and state='pending';
 if not found then
  if exists(select 1 from empire_stones.discovery_event where user_id=u and created_at>=day_start and outcome='awarded') then return jsonb_build_object('enabled',true,'status','daily_cap'); end if;
  if (select count(*) from empire_stones.discovery_challenge where user_id=u and created_at>=day_start)>=3 then return jsonb_build_object('enabled',true,'status','attempt_cap'); end if;
  for i in 1..3 loop
   a:=2+floor(random()*10)::integer;b:=2+floor(random()*10)::integer;d:=1+floor(random()*9)::integer;
   q:=q||jsonb_build_array(jsonb_build_object('a',a,'b',b,'c',d,'answer',a*b+d));
  end loop;
  insert into empire_stones.discovery_challenge(user_id,hero_id,questions) values(u,p_hero_id,q) returning * into c;
 end if;
 return jsonb_build_object('enabled',true,'status','pending','id',c.id,'hero_id',c.hero_id,'expires_at',c.expires_at,
 'questions',(select jsonb_agg(value-'answer' order by ordinality) from jsonb_array_elements(c.questions) with ordinality));
end $$;
create function public.finish_my_empire_discovery_v1(p_id uuid,p_answers integer[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); c empire_stones.discovery_challenge%rowtype; result text; correct integer;
begin
 if u is null or not empire_stones.eligible(u) then raise exception 'Discovery account ineligible'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled and discovery_enabled) then raise exception 'Discovery unavailable'; end if;
 if p_id is null or p_answers is null or cardinality(p_answers)<>3 or array_ndims(p_answers)<>1 or array_position(p_answers,null) is not null then raise exception 'Exactly three answers required'; end if;
 perform empire_stones.check_rate(u);
 perform empire_stones.lock_users(array[u]);
 select * into strict c from empire_stones.discovery_challenge where id=p_id and user_id=u for update;
 if c.state='pending' then
  if c.expires_at<=now() then update empire_stones.discovery_challenge set state='expired' where id=c.id;
  elsif c.created_at+interval '5 seconds'>now() then raise exception 'Finish the trial before submitting';
  else
   select count(*) into correct from jsonb_array_elements(c.questions) with ordinality as t(q,n)
    where (q->>'answer')::integer=p_answers[n::integer];
   if correct<>3 then update empire_stones.discovery_challenge set state='failed' where id=c.id;
   else
    result:=empire_stones.settle_discovery(u,c.hero_id,'quest_reward','trial:'||c.id::text);
    update empire_stones.discovery_challenge set state='verified',outcome=result where id=c.id;
   end if;
  end if;
 end if;
 select * into strict c from empire_stones.discovery_challenge where id=p_id;
 return jsonb_build_object('enabled',true,'id',c.id,'hero_id',c.hero_id,'status',c.state,'outcome',c.outcome);
end $$;
revoke all on all tables in schema empire_stones from public,anon,authenticated;
revoke all on all functions in schema empire_stones from public,anon,authenticated;
revoke all on function public.start_my_empire_discovery_v1(text) from public,anon,authenticated;
revoke all on function public.finish_my_empire_discovery_v1(uuid,integer[]) from public,anon,authenticated;
grant execute on function public.start_my_empire_discovery_v1(text) to authenticated;
grant execute on function public.finish_my_empire_discovery_v1(uuid,integer[]) to authenticated;
commit;
