-- DEV candidate; install AFTER sacred-stones-server-candidate.sql, only on a
-- disposable verified database. Keep disabled until canonical BP, auth and RLS
-- acceptance. Never run against live MAIN from this source branch.
begin;
create table empire_stones.release_gate (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 bp_exchange_enabled boolean not null default false,
 discovery_enabled boolean not null default false,
 world_discovery_enabled boolean not null default false
);
insert into empire_stones.release_gate(singleton) values(true);
create table empire_stones.kingdom_mastery_map (
 hero_id text not null references empire_stones.hero(id),
 game_id text not null unique references private.buklod_kingdom_mastery_catalog_v1(game_id),
 primary key(hero_id,game_id)
);
insert into empire_stones.kingdom_mastery_map values
  ('phan','phan-enterprise-builder'),
  ('phan','phan-trade-master'),
  ('phan','phan-market-match'),
  ('quin','quin-discovery-expedition'),
  ('quin','quin-guessing-quest'),
  ('quin','quin-code-breaker'),
  ('van','van-living-city-dispatch'),
  ('van','van-sudoku-master'),
  ('van','van-mind-challenge'),
  ('christian','christian-civic-leadership'),
  ('christian','christian-bible-crown'),
  ('christian','christian-scripture-word-search'),
  ('lhen','lhen-rhythm-journey'),
  ('lhen','lhen-melody-memory'),
  ('lhen','lhen-beat-composer'),
  ('ace','ace-rescue-grid'),
  ('ace','ace-chess-master'),
  ('ace','ace-tower-tactics'),
  ('ellusur','elesur-village-builder'),
  ('ellusur','elesur-domino-village'),
  ('ellusur','elesur-bridge-puzzle'),
  ('jawo','jawo-forest-trail'),
  ('jawo','jawo-trail-maze'),
  ('jawo','jawo-nature-match'),
  ('mitch','mitch-restore-mural'),
  ('mitch','mitch-block-forge'),
  ('mitch','mitch-color-merge'),
  ('niel','niel-mission-trail'),
  ('niel','niel-expedition-puzzle'),
  ('niel','niel-word-explorer'),
  ('angel','angel-kingdom-treasury'),
  ('angel','angel-number-vault'),
  ('angel','angel-treasure-merge'),
  ('vhen','vhen-farm-to-market'),
  ('vhen','vhen-harvest-match'),
  ('vhen','vhen-farm-merge'),
  ('trudice','trudice-playground-memory'),
  ('trudice','trudice-picture-pairs'),
  ('trudice','trudice-word-garden');
create table empire_stones.api_rate (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 bucket timestamptz not null, calls integer not null check(calls between 1 and 60)
);
-- One receipt for all client actions, independent of private operation namespaces.
create table empire_stones.api_request (
 user_id uuid not null references public.profiles(id), request_id uuid not null,
 action text, args jsonb, state text not null check(state in ('completed','cancelled')),
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table empire_stones.api_request enable row level security;
alter table empire_stones.release_gate enable row level security;
alter table empire_stones.kingdom_mastery_map enable row level security;
alter table empire_stones.api_rate enable row level security;
-- Fail installation if source game ownership drifted or the protected principal
-- guard is absent. No inference from mutable display names or client metadata.
do $guard$
begin
 if to_regprocedure('private.buklod_is_platform_official_v1(uuid)') is null or
 exists(select 1 from empire_stones.kingdom_mastery_map m
 join private.buklod_kingdom_mastery_catalog_v1 c on c.game_id=m.game_id
 where c.character_id is distinct from m.hero_id) or
 (select count(*) from empire_stones.kingdom_mastery_map)<>39 or
 exists(select 1 from empire_stones.kingdom_mastery_map group by hero_id having count(*)<>3)
 then raise exception 'Canonical Kingdom or official identity mismatch'; end if;
end $guard$;
create function empire_stones.eligible(u uuid) returns boolean
language sql stable set search_path='' as $$
 select u is not null and exists(select 1 from public.profiles p join auth.users a on a.id=p.id
 where p.id=u and p.is_active=true and p.user_deactivated_at is null
 and p.role::text<>'system_admin') and not private.buklod_is_platform_official_v1(u)
$$;
create function empire_stones.check_rate(u uuid) returns void
language plpgsql set search_path='' as $$
declare b timestamptz:=date_trunc('hour',now())+floor(extract(minute from now())/10)*interval '10 minutes';
begin
 insert into empire_stones.api_rate(user_id,bucket,calls) values(u,b,1)
 on conflict(user_id) do update set
  bucket=excluded.bucket,
  calls=case when empire_stones.api_rate.bucket=excluded.bucket then empire_stones.api_rate.calls+1 else 1 end
 where empire_stones.api_rate.bucket<>excluded.bucket or empire_stones.api_rate.calls<60;
 if not found then raise exception 'Stone request limit reached'; end if;
end $$;
-- Existing server-scored mastery and its canonical BP ledger evidence only.
-- One quest stone per hero/account lifetime after all three mapped checks.
-- Historical genuine credited mastery counts; local wins, Shards, unverified
-- attempts and client-supplied hero/score/amount cannot mint a gem.
create function empire_stones.mastery_progress(u uuid) returns table(hero_id text,verified_count bigint)
language sql stable set search_path='' as $$
 select m.hero_id,count(*) filter(where c.active and c.character_id=m.hero_id and
 exists(select 1 from private.buklod_kingdom_mastery_attempts_v1 a
 where a.user_id=u and a.game_id=m.game_id and a.status='credited' and a.completed_at is not null)
 and exists(select 1 from public.buklod_points_ledger l
 where l.user_id=u and l.direction='credit' and l.activity_type='game_first_qualified'
 and l.points=2 and l.source_key='kingdom:mastery:v1:'||m.game_id))
 from empire_stones.kingdom_mastery_map m
 join private.buklod_kingdom_mastery_catalog_v1 c on c.game_id=m.game_id
 group by m.hero_id
$$;
create function empire_stones.sync_kingdom_mastery(u uuid) returns void
language plpgsql set search_path='' as $$
declare r record;
begin
 if not empire_stones.eligible(u) then raise exception 'Stone account ineligible'; end if;
 perform empire_stones.lock_users(array[u]);
 for r in select p.hero_id,h.kingdom_quest from empire_stones.mastery_progress(u) p
 join empire_stones.hero h on h.id=p.hero_id where p.verified_count=3 order by p.hero_id loop
  perform empire_stones.grant_verified(u,r.hero_id,1,'kingdom_quest','mastery-v1:'||u::text||':'||r.hero_id,r.kingdom_quest);
 end loop;
end $$;
create function empire_stones.snapshot(u uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('version',1,'enabled',true,'owner',u,
 'bp_exchange_enabled',g.bp_exchange_enabled,'discovery_enabled',g.discovery_enabled,
 'spendable_bp',greatest(coalesce((select available_points from public.buklod_user_points_balances where user_id=u),0)
 -public.buklod_points_cash_reserved_for(u),0),
 'stones',(select jsonb_agg(jsonb_build_object('hero_id',h.id,'balance',coalesce(w.balance,0),
 'mastery_count',coalesce(p.verified_count,0),'quest_awarded',exists(select 1 from empire_stones.operation o
 where o.key='verified:kingdom_quest:mastery-v1:'||u::text||':'||h.id)) order by h.id)
 from empire_stones.hero h left join empire_stones.wallet w on w.hero_id=h.id and w.user_id=u
 left join empire_stones.mastery_progress(u) p on p.hero_id=h.id),
 'trades',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from
 (select id,sender,recipient,offered,wanted,state,expires_at from empire_stones.trade_offer
 where (sender=u or recipient=u) and state='open' and expires_at>now() order by expires_at limit 30) t),
 'requests',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from
 (select id,requester,donor,hero_id,state,expires_at from empire_stones.gift_request
 where (requester=u or donor=u) and state='open' and expires_at>now() order by expires_at limit 30) t))
 from empire_stones.release_gate g where singleton
$$;
-- Narrow self-service facade. No caller UID, grant, match, purchase or reward
-- amounts can be supplied by the client. Private functions are not exposed.
create function public.get_my_empire_stones_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled)
 or not empire_stones.eligible(u) then return jsonb_build_object('version',1,'enabled',false); end if;
 perform empire_stones.check_rate(u);
 perform empire_stones.sync_kingdom_mastery(u);
 return empire_stones.snapshot(u);
end $$;
create function public.act_my_empire_stones_v1(p_action text,p_args jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); peer uuid; h text; inputs text[]; wants text[];
 receipt empire_stones.api_request%rowtype;
begin
 if u is null or not empire_stones.eligible(u) then raise exception 'Stone account ineligible' using errcode='42501'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled) then raise exception 'Stones unavailable'; end if;
 if p_request_id is null or jsonb_typeof(p_args) is distinct from 'object' or pg_column_size(p_args)>8192 then raise exception 'Invalid request'; end if;
 perform empire_stones.check_rate(u);
 insert into empire_stones.api_request(user_id,request_id,action,args,state)
 values(u,p_request_id,p_action,p_args,'completed') on conflict do nothing;
 if not found then
  select * into strict receipt from empire_stones.api_request where user_id=u and request_id=p_request_id;
  if receipt.state='cancelled' then raise exception 'Request cancelled'; end if;
  if receipt.action is distinct from p_action or receipt.args is distinct from p_args then raise exception 'Request payload mismatch'; end if;
  return empire_stones.snapshot(u);
 end if;
 h:=p_args->>'hero_id';
 if p_action in ('gift','offer','request') then
  peer:=(p_args->>'peer')::uuid;
  if peer=u or not empire_stones.eligible(peer) then raise exception 'Recipient unavailable'; end if;
 end if;
 if p_action in ('combine','convert','offer') then
  if jsonb_typeof(p_args->'inputs') is distinct from 'array' then raise exception 'Invalid inputs'; end if;
  select array_agg(x) into inputs from jsonb_array_elements_text(p_args->'inputs') x;
 end if;
 case p_action
 when 'exchange' then
  if not exists(select 1 from empire_stones.release_gate where singleton and bp_exchange_enabled) then raise exception 'BP exchange unavailable'; end if;
  perform empire_stones.exchange(u,h,1,p_request_id);
 when 'combine' then perform empire_stones.convert(u,h,inputs,false,p_request_id);
 when 'convert' then perform empire_stones.convert(u,h,inputs,true,p_request_id);
 when 'gift' then perform empire_stones.gift(u,peer,h,1,p_request_id);
 when 'offer' then
  if jsonb_typeof(p_args->'wanted') is distinct from 'array' then raise exception 'Invalid wanted stones'; end if;
  select array_agg(x) into wants from jsonb_array_elements_text(p_args->'wanted') x;
  perform empire_stones.offer_trade(p_request_id,u,peer,inputs,wants);
 when 'accept_trade' then
  if not exists(select 1 from empire_stones.trade_offer t where t.id=(p_args->>'id')::uuid and t.recipient=u and empire_stones.eligible(t.sender)) then raise exception 'Trade unavailable'; end if;
  perform empire_stones.accept_trade((p_args->>'id')::uuid,u);
 when 'cancel_trade' then perform empire_stones.cancel_trade((p_args->>'id')::uuid,u);
 when 'request' then perform empire_stones.request_stone(p_request_id,u,peer,h);
 when 'accept_request' then
  if not exists(select 1 from empire_stones.gift_request t where t.id=(p_args->>'id')::uuid and t.donor=u and empire_stones.eligible(t.requester)) then raise exception 'Request unavailable'; end if;
  perform empire_stones.answer_stone_request((p_args->>'id')::uuid,u,true);
 when 'decline_request' then perform empire_stones.answer_stone_request((p_args->>'id')::uuid,u,false);
 else raise exception 'Unsupported stone action';
 end case;
 return empire_stones.snapshot(u);
end $$;
-- Resolve ambiguous client transport outcome. If the prior transaction already
-- committed, report completed; otherwise atomically tombstone its request ID.
-- A delayed in-flight retry can no longer spend after cancellation.
create function public.resolve_my_empire_stone_request_v1(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); result_state text;
begin
 if u is null or not empire_stones.eligible(u) or p_request_id is null then raise exception 'Invalid stone account/request' using errcode='42501'; end if;
 if not exists(select 1 from empire_stones.release_gate where singleton and enabled) then raise exception 'Stones unavailable'; end if;
 perform empire_stones.check_rate(u);
 insert into empire_stones.api_request(user_id,request_id,state) values(u,p_request_id,'cancelled') on conflict do nothing;
 select state into strict result_state from empire_stones.api_request where user_id=u and request_id=p_request_id;
 return jsonb_build_object('version',1,'owner',u,'request_state',result_state,'snapshot',empire_stones.snapshot(u));
end $$;
revoke all on all tables in schema empire_stones from public,anon,authenticated;
revoke all on all sequences in schema empire_stones from public,anon,authenticated;
revoke all on all functions in schema empire_stones from public,anon,authenticated;
revoke all on function public.get_my_empire_stones_v1() from public,anon,authenticated;
revoke all on function public.act_my_empire_stones_v1(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.get_my_empire_stones_v1() to authenticated;
grant execute on function public.act_my_empire_stones_v1(text,jsonb,uuid) to authenticated;
revoke all on function public.resolve_my_empire_stone_request_v1(uuid) from public,anon,authenticated;
grant execute on function public.resolve_my_empire_stone_request_v1(uuid) to authenticated;
commit;
