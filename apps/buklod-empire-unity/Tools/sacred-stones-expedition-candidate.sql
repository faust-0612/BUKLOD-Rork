-- DEV ONLY, install after sacred-stones-discovery-candidate.sql.
-- Authoritative TURN-BASED Kingdom expedition, not realtime multiplayer.
begin;
create table empire_stones.expedition (
 id uuid primary key references empire_stones.world_session(id),
 user_id uuid not null references public.profiles(id), hero_id text not null references empire_stones.hero(id),
 day date not null, stage integer not null default 0 check(stage between 0 and 5),
 version integer not null default 0 check(version between 0 and 24),
 health integer not null default 5 check(health between 0 and 5),
 monster_hp integer not null default 3 check(monster_hp between 0 and 3),
 monster_turn integer not null default 0 check(monster_turn between 0 and 12),
 successful integer not null default 0 check(successful between 0 and 4),
 state text not null default 'active' check(state in ('active','complete','failed','expired')),
 puzzles jsonb not null, results jsonb not null default '[]',
 next_action_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '30 minutes',
 unique(user_id,day)
);
create unique index expedition_one_active on empire_stones.expedition(user_id) where state='active';
create table empire_stones.expedition_step (
 expedition_id uuid references empire_stones.expedition(id), request_id uuid,
 expected_version integer not null, action text not null, answer integer,
 response jsonb not null, primary key(expedition_id,request_id)
);
alter table empire_stones.expedition enable row level security;
alter table empire_stones.expedition_step enable row level security;
create function empire_stones.expedition_view(e empire_stones.expedition) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('enabled',true,'id',e.id,'hero_id',e.hero_id,'version',e.version,
 'stage',e.stage,'state',e.state,'health',e.health,'monster_hp',e.monster_hp,
 'monster_intent',case when e.stage=1 then case when e.monster_turn%2=1 then 'heavy' else 'recovering' end else null end,
 'question',case when e.stage in (0,2,3) and e.state='active' then (e.puzzles->(e.stage::text))-'answer' else null end,
 'results',e.results,'next_action_at',e.next_action_at,'server_now',now(),'expires_at',e.expires_at)
$$;
-- Every stage is derived from server-owned state. No client event kind, object
-- key, hero override, HP or reward amount is accepted by the step endpoint.
create function public.start_my_empire_expedition_v1(p_hero_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); e empire_stones.expedition%rowtype; sid uuid;
 puzzles jsonb:='{}'; i integer; a integer; b integer; c integer; correct integer;
 today date:=(now() at time zone 'Asia/Manila')::date;
begin
 if u is null or not empire_stones.eligible(u) then raise exception 'Expedition account ineligible'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled and world_discovery_enabled and expedition_enabled) then return jsonb_build_object('enabled',false); end if;
 if not exists(select 1 from empire_stones.hero where id=p_hero_id) then raise exception 'Unknown hero'; end if;
 perform empire_stones.check_rate(u);
 perform empire_stones.lock_users(array[u]);
 -- A previously unfinished route cannot create another daily route or reroll.
 for sid in select id from empire_stones.expedition where user_id=u and state='active' and expires_at<=now() loop
  update empire_stones.expedition set state='expired' where id=sid;
  perform empire_stones.close_world_discovery(sid);
 end loop;
 select * into e from empire_stones.expedition where user_id=u and (day=today or state='active') order by (state='active') desc,day desc limit 1;
 if found then return empire_stones.expedition_view(e); end if;
 sid:=gen_random_uuid();
 foreach i in array array[0,2,3] loop
  a:=2+floor(random()*9)::integer;b:=2+floor(random()*9)::integer;c:=1+floor(random()*5)::integer;
  if i=3 then c:=least(c,a*b);end if;
  correct:=case when i=0 then a+b+c when i=2 then a*b+c else a*b-c end;
  puzzles:=puzzles||jsonb_build_object(i::text,jsonb_build_object('a',a,'b',b,'c',c,'answer',correct));
 end loop;
 perform empire_stones.open_world_discovery(sid,u,p_hero_id);
 insert into empire_stones.expedition(id,user_id,hero_id,day,puzzles) values(sid,u,p_hero_id,today,puzzles) returning * into e;
 return empire_stones.expedition_view(e);
end $$;
create function public.step_my_empire_expedition_v1(p_id uuid,p_version integer,p_action text,p_answer integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); e empire_stones.expedition%rowtype; old empire_stones.expedition_step%rowtype;
 kind text; outcome text; success boolean:=false; advance_stage boolean:=false; response jsonb;
begin
 if u is null or not empire_stones.eligible(u) then raise exception 'Expedition account ineligible'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled and world_discovery_enabled and expedition_enabled) then raise exception 'Expedition unavailable'; end if;
 if p_id is null or p_version is null or p_request_id is null or p_action is null or p_action not in ('solve','strike','guard','finish') then raise exception 'Invalid expedition input'; end if;
 perform empire_stones.check_rate(u);
 perform empire_stones.lock_users(array[u]);
 select * into strict e from empire_stones.expedition where id=p_id and user_id=u for update;
 select * into old from empire_stones.expedition_step where expedition_id=p_id and request_id=p_request_id;
 if found then
  if old.expected_version is distinct from p_version or old.action is distinct from p_action or old.answer is distinct from p_answer then raise exception 'Expedition request conflict'; end if;
  -- Current authoritative state, never a stale prior snapshot on replay.
  return empire_stones.expedition_view(e);
 end if;
 if e.state<>'active' then return empire_stones.expedition_view(e); end if;
 if e.expires_at<=now() then
  update empire_stones.expedition set state='expired' where id=e.id returning * into e;
  perform empire_stones.close_world_discovery(e.id);return empire_stones.expedition_view(e);
 end if;
 if e.version<>p_version then return empire_stones.expedition_view(e); end if;
 if e.next_action_at>now() then raise exception 'Wait for next expedition turn'; end if;
 if e.stage in (0,2,3) then
  if p_action<>'solve' or p_answer is null or p_answer not between 0 and 200 then raise exception 'Solve the current objective'; end if;
  success:=p_answer=(e.puzzles->(e.stage::text)->>'answer')::integer;
  kind:=case e.stage when 0 then 'rare_pick' when 2 then 'treasure_discovery' else 'village_reward' end;
  advance_stage:=true;
 elsif e.stage=1 then
  if p_action not in ('strike','guard') or p_answer is not null then raise exception 'Invalid combat action'; end if;
  if e.monster_turn%2=1 then
   if p_action='strike' then e.health:=greatest(0,e.health-2);end if;
  elsif p_action='strike' then e.monster_hp:=greatest(0,e.monster_hp-1);
  end if;
  e.monster_turn:=e.monster_turn+1;
  if e.monster_hp=0 and e.health>0 then kind:='monster_drop';success:=true;advance_stage:=true;
  elsif e.health=0 or e.monster_turn>=10 then kind:='monster_drop';advance_stage:=true;end if;
 elsif e.stage=4 then
  if p_action<>'finish' or p_answer is not null then raise exception 'Finish the expedition'; end if;
  kind:='quest_reward';success:=e.successful=4;advance_stage:=true;
 else raise exception 'Expedition completed';
 end if;
 if advance_stage then
  outcome:=case when success then empire_stones.record_world_discovery(e.id,'expedition-stage-'||e.stage::text,kind) else 'objective_failed' end;
  e.results:=e.results||jsonb_build_array(jsonb_build_object('source',kind,'outcome',outcome));
  if success and e.stage<4 then e.successful:=e.successful+1; end if;
  e.stage:=e.stage+1;
  if e.health=0 then e.state:='failed';elsif e.stage=5 then e.state:='complete';end if;
 end if;
 e.version:=e.version+1;
 update empire_stones.expedition set stage=e.stage,version=e.version,health=e.health,monster_hp=e.monster_hp,monster_turn=e.monster_turn,successful=e.successful,state=e.state,results=e.results,next_action_at=now()+interval '2 seconds'
 where id=e.id returning * into e;
 if e.state<>'active' then perform empire_stones.close_world_discovery(e.id);end if;
 response:=empire_stones.expedition_view(e);
 insert into empire_stones.expedition_step(expedition_id,request_id,expected_version,action,answer,response) values(e.id,p_request_id,p_version,p_action,p_answer,response);
 return response;
end $$;
revoke all on all tables in schema empire_stones from public,anon,authenticated;
revoke all on all functions in schema empire_stones from public,anon,authenticated;
revoke all on function public.start_my_empire_expedition_v1(text) from public,anon,authenticated;
revoke all on function public.step_my_empire_expedition_v1(uuid,integer,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.start_my_empire_expedition_v1(text) to authenticated;
grant execute on function public.step_my_empire_expedition_v1(uuid,integer,text,integer,uuid) to authenticated;
commit;
