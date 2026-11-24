-- Disposable LOCAL PostgreSQL only. Never run against any hosted database.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() not like 'empire_stones_test_%' or to_regnamespace('empire_stones') is not null or to_regclass('public.profiles') is not null
 then raise exception 'Requires an empty disposable local empire_stones_test_* database'; end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key,is_active boolean not null default true,user_deactivated_at timestamptz,role text not null default 'member');
create function private.buklod_is_platform_official_v1(u uuid) returns boolean language sql stable as $$ select u='10000000-0000-0000-0000-000000000003'::uuid $$;
create table public.buklod_user_points_balances(user_id uuid primary key,available_points bigint not null check(available_points>=0));
create table public.buklod_points_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null,direction text not null,points integer not null,activity_type text,source_key text,source_id uuid,description text,unique(user_id,source_key));
create function public.buklod_points_cash_reserved_for(uuid) returns bigint language sql as $$ select 0::bigint $$;
create function public.fixture_debit() returns trigger language plpgsql as $$ begin
 if new.direction='debit' then update public.buklod_user_points_balances set available_points=available_points-new.points where user_id=new.user_id; end if;
 return new;
end $$;
create trigger fixture_debit after insert on public.buklod_points_ledger for each row execute function public.fixture_debit();
create table private.buklod_kingdom_mastery_catalog_v1(game_id text primary key,character_id text not null,active boolean not null default true);
insert into private.buklod_kingdom_mastery_catalog_v1(game_id,character_id) values
 ('phan-enterprise-builder','phan'),
 ('phan-trade-master','phan'),
 ('phan-market-match','phan'),
 ('quin-discovery-expedition','quin'),
 ('quin-guessing-quest','quin'),
 ('quin-code-breaker','quin'),
 ('van-living-city-dispatch','van'),
 ('van-sudoku-master','van'),
 ('van-mind-challenge','van'),
 ('christian-civic-leadership','christian'),
 ('christian-bible-crown','christian'),
 ('christian-scripture-word-search','christian'),
 ('lhen-rhythm-journey','lhen'),
 ('lhen-melody-memory','lhen'),
 ('lhen-beat-composer','lhen'),
 ('ace-rescue-grid','ace'),
 ('ace-chess-master','ace'),
 ('ace-tower-tactics','ace'),
 ('elesur-village-builder','ellusur'),
 ('elesur-domino-village','ellusur'),
 ('elesur-bridge-puzzle','ellusur'),
 ('jawo-forest-trail','jawo'),
 ('jawo-trail-maze','jawo'),
 ('jawo-nature-match','jawo'),
 ('mitch-restore-mural','mitch'),
 ('mitch-block-forge','mitch'),
 ('mitch-color-merge','mitch'),
 ('niel-mission-trail','niel'),
 ('niel-expedition-puzzle','niel'),
 ('niel-word-explorer','niel'),
 ('angel-kingdom-treasury','angel'),
 ('angel-number-vault','angel'),
 ('angel-treasure-merge','angel'),
 ('vhen-farm-to-market','vhen'),
 ('vhen-harvest-match','vhen'),
 ('vhen-farm-merge','vhen'),
 ('trudice-playground-memory','trudice'),
 ('trudice-picture-pairs','trudice'),
 ('trudice-word-garden','trudice');
create table private.buklod_kingdom_mastery_attempts_v1(id uuid primary key default gen_random_uuid(),user_id uuid not null,game_id text not null,status text not null,completed_at timestamptz);
\ir sacred-stones-server-candidate.sql
\ir sacred-stones-kingdom-candidate.sql
\ir sacred-stones-discovery-candidate.sql
\ir sacred-stones-expedition-candidate.sql
begin;
do $$
declare
 a uuid:='10000000-0000-0000-0000-000000000001';
 b uuid:='10000000-0000-0000-0000-000000000002';
 official uuid:='10000000-0000-0000-0000-000000000003';
 req uuid:='20000000-0000-0000-0000-000000000001';
 cancelled uuid:='20000000-0000-0000-0000-000000000002';
 result jsonb; game text; rejected boolean:=false;
begin
 insert into auth.users values(a),(b),(official);
 insert into public.profiles(id) values(a),(b),(official);
 insert into public.buklod_user_points_balances values(a,500),(b,500),(official,500);
 perform set_config('request.jwt.claim.sub',a::text,true);
 result:=public.get_my_empire_stones_v1();
 if result->>'enabled'<>'false' then raise exception 'Gate was enabled by default'; end if;
 update empire_stones.release_gate set enabled=true,bp_exchange_enabled=true;
 -- All attempts credited, but third is initially missing its canonical ledger proof.
 for game in select game_id from empire_stones.kingdom_mastery_map where hero_id='phan' order by game_id loop
  insert into private.buklod_kingdom_mastery_attempts_v1(user_id,game_id,status,completed_at) values(a,game,'credited',now());
  if game<>'phan-trade-master' then insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key)
   values(a,'credit',2,'game_first_qualified','kingdom:mastery:v1:'||game); end if;
 end loop;
 result:=public.get_my_empire_stones_v1();
 if exists(select 1 from empire_stones.wallet where user_id=a and balance>0) then raise exception 'Unproven quest minted a stone'; end if;
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key) values(a,'credit',2,'game_first_qualified','kingdom:mastery:v1:phan-trade-master');
 result:=public.get_my_empire_stones_v1();
 perform public.get_my_empire_stones_v1();
 if (select balance from empire_stones.wallet where user_id=a and hero_id='phan') is distinct from 1::bigint then raise exception 'Quest reward missing or duplicated'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 result:=public.get_my_empire_stones_v1();
 if result->>'owner'<>b::text or exists(select 1 from empire_stones.wallet where user_id=b and balance>0) then raise exception 'Account isolation failed'; end if;
 perform set_config('request.jwt.claim.sub',official::text,true);
 if public.get_my_empire_stones_v1()->>'enabled'<>'false' then raise exception 'Official account eligible'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.act_my_empire_stones_v1('exchange','{"hero_id":"phan"}',req);
 perform public.act_my_empire_stones_v1('exchange','{"hero_id":"phan"}',req);
 if (select available_points from public.buklod_user_points_balances where user_id=a)<>400 or
 (select balance from empire_stones.wallet where user_id=a and hero_id='phan')<>2 then raise exception 'Exchange replay failure'; end if;
 result:=public.resolve_my_empire_stone_request_v1(req);
 if result->>'request_state'<>'completed' then raise exception 'Committed request resolution failed'; end if;
 result:=public.resolve_my_empire_stone_request_v1(cancelled);
 if result->>'request_state'<>'cancelled' then raise exception 'Tombstone missing'; end if;
 begin perform public.act_my_empire_stones_v1('exchange','{"hero_id":"phan"}',cancelled);
 exception when others then rejected:=true; end;
 if not rejected or (select available_points from public.buklod_user_points_balances where user_id=a)<>400 then raise exception 'Cancelled request was spent'; end if;
 -- Force deterministic fixture probability, never production tuning.
 update empire_stones.release_gate set discovery_enabled=true,world_discovery_enabled=true;
 update empire_stones.discovery_policy set chance_bps=10000;
 result:=public.start_my_empire_discovery_v1('quin');
 if result->>'status'<>'pending' or (result->'questions'->0) ? 'answer' then raise exception 'Invalid trial exposure'; end if;
 if public.start_my_empire_discovery_v1('phan')->>'id'<>result->>'id' then raise exception 'Pending trial rerolled'; end if;
 -- Read fixture-only private answers; move clock to satisfy minimum age.
 update empire_stones.discovery_challenge set created_at=now()-interval '6 seconds' where id=(result->>'id')::uuid;
 declare answers integer[]; trial_id uuid:=(result->>'id')::uuid;
 begin
  select array_agg((q->>'answer')::integer order by ordinality) into answers from empire_stones.discovery_challenge c cross join lateral jsonb_array_elements(c.questions) with ordinality as t(q,ordinality) where c.id=trial_id;
  result:=public.finish_my_empire_discovery_v1(trial_id,answers);
  if result->>'outcome'<>'awarded' then raise exception 'Trial grant failed'; end if;
  if public.finish_my_empire_discovery_v1(trial_id,answers)->>'outcome'<>'awarded' or (select balance from empire_stones.wallet where user_id=a and hero_id='quin') is distinct from 1::bigint then raise exception 'Trial replay duplicated'; end if;
 end;
 perform empire_stones.open_world_discovery('30000000-0000-0000-0000-000000000001',a,'quin');
 if empire_stones.record_world_discovery('30000000-0000-0000-0000-000000000001','treasure-1','treasure_discovery')<>'daily_cap' then raise exception 'Shared cap failed'; end if;
 if empire_stones.record_world_discovery('30000000-0000-0000-0000-000000000001','treasure-1','treasure_discovery')<>'daily_cap' then raise exception 'World event replay failed'; end if;
 -- New authoritative route: one per day, no answer key, replay and cross-account checks.
 update empire_stones.release_gate set expedition_enabled=true;
 perform set_config('request.jwt.claim.sub',b::text,true);
 declare exid uuid; answer integer; turn_id uuid:='40000000-0000-0000-0000-000000000001'; blocked boolean:=false;
 begin
  result:=public.start_my_empire_expedition_v1('phan');exid:=(result->>'id')::uuid;
  if (result->'question') ? 'answer' or public.start_my_empire_expedition_v1('quin')->>'id'<>exid::text then raise exception 'Expedition reroll or answer leaked'; end if;
  select (puzzles->'0'->>'answer')::integer into answer from empire_stones.expedition where id=exid;
  result:=public.step_my_empire_expedition_v1(exid,0,'solve',answer,turn_id);
  if result->>'stage'<>'1' or result->>'version'<>'1' then raise exception 'Pickup stage failed'; end if;
  result:=public.step_my_empire_expedition_v1(exid,0,'solve',answer,turn_id);
  if result->>'version'<>'1' then raise exception 'Expedition replay duplicated'; end if;
  perform set_config('request.jwt.claim.sub',a::text,true);
  begin perform public.step_my_empire_expedition_v1(exid,1,'strike',null,gen_random_uuid());exception when others then blocked:=true;end;
  if not blocked then raise exception 'Cross-account expedition accepted';end if;
  perform set_config('request.jwt.claim.sub',b::text,true);
  -- Simulate elapsed turns inside a single fixture transaction.
  for i in 1..5 loop
   update empire_stones.expedition set next_action_at=now()-interval '1 second' where id=exid;
   result:=public.step_my_empire_expedition_v1(exid,(result->>'version')::integer,case when i%2=1 then 'strike' else 'guard' end,null,gen_random_uuid());
  end loop;
  if result->>'stage'<>'2' or result->>'health'<>'5' then raise exception 'Monster encounter progression failed';end if;
  for i in 2..3 loop
   update empire_stones.expedition set next_action_at=now()-interval '1 second' where id=exid;
   select (puzzles->(i::text)->>'answer')::integer into answer from empire_stones.expedition where id=exid;
   result:=public.step_my_empire_expedition_v1(exid,(result->>'version')::integer,'solve',answer,gen_random_uuid());
  end loop;
  update empire_stones.expedition set next_action_at=now()-interval '1 second' where id=exid;
  result:=public.step_my_empire_expedition_v1(exid,(result->>'version')::integer,'finish',null,gen_random_uuid());
  if result->>'state'<>'complete' or jsonb_array_length(result->'results')<>5 or (select balance from empire_stones.wallet where user_id=b and hero_id='phan') is distinct from 1::bigint then raise exception 'Expedition settlement or shared cap failed';end if;
 end;
 if has_function_privilege('authenticated','empire_stones.record_world_discovery(uuid,text,text)','EXECUTE') then raise exception 'World hook exposed'; end if;
 if has_function_privilege('authenticated','empire_stones.grant_verified(uuid,text,integer,text,text,text)','EXECUTE') or
 has_function_privilege('anon','public.get_my_empire_stones_v1()','EXECUTE') or
 has_table_privilege('authenticated','empire_stones.wallet','SELECT') then raise exception 'Private economy leaked'; end if;
end $$;
rollback;
-- Uses mock BP trigger and auth claims; production parity/concurrency require independent verification.
