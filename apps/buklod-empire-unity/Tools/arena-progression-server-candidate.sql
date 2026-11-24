-- DEV ONLY: apply only after sacred-stones-server-candidate.sql and authoritative match adapter review.
-- Arena BP is earned game-only BP: never writes ministry ledger, QMP, Circle Rank, or cash.
begin;
create schema if not exists empire_rewards;
revoke all on schema empire_rewards from public,anon,authenticated;
create table empire_rewards.account (
 user_id uuid primary key references public.profiles(id) on delete restrict,
 bp bigint not null default 0 check(bp>=0)
);
create table empire_rewards.mastery (
 user_id uuid references empire_rewards.account(user_id), hero_id text references empire_stones.hero(id),
 xp bigint not null default 0 check(xp>=0), matches bigint not null default 0, wins bigint not null default 0,
 primary key(user_id,hero_id)
);
create table empire_rewards.settlement (
 match_id uuid references empire_stones.match(id), user_id uuid references empire_rewards.account(user_id),
 hero_id text not null references empire_stones.hero(id), day date not null,
 evidence jsonb not null, xp integer not null check(xp>=0), bp_delta integer not null, created_at timestamptz not null default now(),
 primary key(match_id,user_id)
);
create index on empire_rewards.settlement(user_id,day);
create table empire_rewards.milestone (
 user_id uuid references empire_rewards.account(user_id), hero_id text references empire_stones.hero(id),
 event_key text not null, xp integer not null check(xp between 50 and 500), created_at timestamptz not null default now(),
 primary key(user_id,hero_id,event_key)
);
create table empire_rewards.stone_exchange (
 user_id uuid references empire_rewards.account(user_id), request_id uuid, hero_id text references empire_stones.hero(id),
 quantity integer not null check(quantity between 1 and 100), primary key(user_id,request_id)
);
-- Trusted adapter supplies adjudicated facts ONLY; no client reward claims or amount arguments.
-- A terminal match state alone is insufficient: adapter must establish competitive mode, server replay,
-- account eligibility (including Official exclusion), opponent diversity and confirmed misconduct.
create function empire_rewards.settle(mid uuid,u uuid,facts jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare h text; old empire_rewards.settlement%rowtype; d date; n int; earned int; xp int:=0; bp int:=0;
 bal bigint; outcome text; conduct text; first_win boolean; eligible boolean; team_no int;
begin
 if u is null or mid is null or facts is null or jsonb_typeof(facts)<>'object' then raise exception 'Invalid evidence'; end if;
 if not (facts ?& array['outcome','conduct','eligible','mvp','teamwork','objective','rescue','resource']) or
   exists(select 1 from jsonb_each(facts) e where e.key not in ('outcome','conduct','eligible','mvp','teamwork','objective','rescue','resource')) or
   exists(select 1 from jsonb_each(facts) e where e.key in ('eligible','mvp','teamwork','objective','rescue','resource') and jsonb_typeof(e.value)<>'boolean') then raise exception 'Invalid facts'; end if;
 outcome:=facts->>'outcome'; conduct:=facts->>'conduct'; eligible:=(facts->>'eligible')::boolean;
 if outcome is null or outcome not in ('win','loss','draw') or conduct is null or conduct not in ('clean','intentional_afk','abuse','cheat','outage') then raise exception 'Invalid result'; end if;
 perform 1 from empire_stones.match where id=mid and state='completed' for share;
 if not found then raise exception 'Not a completed authoritative match'; end if;
 select hero_id,team into h,team_no from empire_stones.match_action where match_id=mid and user_id=u and action='pick';
 if not found then raise exception 'Not a participant'; end if;
 -- Full competitive roster required (training/bot matches cannot enter this settlement).
 if (select count(*) from empire_stones.match_action where match_id=mid and action='pick')<>10 or
    (select count(distinct hero_id) from empire_stones.match_action where match_id=mid and action='pick')<>10 or
    (select count(*) from empire_stones.match_action where match_id=mid and action='pick' and team=team_no)<>5 then raise exception 'Invalid competitive roster'; end if;
 perform empire_stones.lock_users(array[u]);
 insert into empire_rewards.account(user_id) values(u) on conflict do nothing;
 select bp into bal from empire_rewards.account where user_id=u for update;
 select * into old from empire_rewards.settlement where match_id=mid and user_id=u;
 if found then
   if old.evidence is distinct from facts then raise exception 'Settlement conflict'; end if;
   return jsonb_build_object('xp',old.xp,'bp_delta',old.bp_delta,'duplicate',true);
 end if;
 d:=(now() at time zone 'Asia/Manila')::date;
 select count(*),coalesce(sum(greatest(bp_delta,0)),0) into n,earned from empire_rewards.settlement where user_id=u and day=d and xp>0;
 first_win:=not exists(select 1 from empire_rewards.settlement where user_id=u and day=d and xp>0 and evidence->>'outcome'='win');
 if conduct in ('intentional_afk','abuse','cheat') and eligible then
   bp:=-least(bal,case conduct when 'intentional_afk' then 5 when 'abuse' then 10 else 20 end)::int;
 elsif conduct='clean' and eligible and n<5 then
   xp:=20+case when outcome='win' then 30 else 0 end
      +case when (facts->>'mvp')::boolean then 25 else 0 end
      +case when (facts->>'teamwork')::boolean then 15 else 0 end
      +case when (facts->>'objective')::boolean then 10 else 0 end
      +case when (facts->>'rescue')::boolean then 5 else 0 end
      +case when (facts->>'resource')::boolean then 15 else 0 end
      +case when outcome='win' and first_win then 50 else 0 end;
   bp:=least(greatest(30-earned,0),3+case when outcome='win' then 2 else 0 end
      +case when (facts->>'teamwork')::boolean then 2 else 0 end
      +case when (facts->>'objective')::boolean then 1 else 0 end);
 end if;
 insert into empire_rewards.settlement(match_id,user_id,hero_id,day,evidence,xp,bp_delta) values(mid,u,h,d,facts,xp,bp);
 update empire_rewards.account set bp=empire_rewards.account.bp+settle.bp where user_id=u;
 if xp>0 then
   insert into empire_rewards.mastery(user_id,hero_id,xp,matches,wins) values(u,h,xp,1,case when outcome='win' then 1 else 0 end)
   on conflict(user_id,hero_id) do update set xp=empire_rewards.mastery.xp+excluded.xp,matches=empire_rewards.mastery.matches+1,wins=empire_rewards.mastery.wins+excluded.wins;
 end if;
 return jsonb_build_object('xp',xp,'bp_delta',bp,'duplicate',false);
end $$;
-- Game-only BP can buy exactly the same hero stone at 100 BP, not cash or ministry rank.
create function empire_rewards.exchange(u uuid,h text,n integer,req uuid) returns void
language plpgsql set search_path='' as $$
declare old empire_rewards.stone_exchange%rowtype; bal bigint;
begin
 if u is null or req is null or n is null or n not between 1 and 100 or h is null then raise exception 'Invalid exchange'; end if;
 perform empire_stones.lock_users(array[u]);
 select bp into bal from empire_rewards.account where user_id=u for update;
 if not found then raise exception 'No Arena BP'; end if;
 select * into old from empire_rewards.stone_exchange where user_id=u and request_id=req;
 if found then if old.hero_id<>h or old.quantity<>n then raise exception 'Exchange conflict'; end if; return; end if;
 if bal<100*n then raise exception 'Insufficient Arena BP'; end if;
 insert into empire_rewards.stone_exchange values(u,req,h,n);
 update empire_rewards.account set bp=bp-100*n where user_id=u;
 if not empire_stones.once('arena-bp:'||u||':'||req,jsonb_build_object('hero',h,'quantity',n)) then raise exception 'Unexpected operation collision'; end if;
 perform empire_stones.change_balance('arena-bp:'||u||':'||req,u,h,n::bigint);
end $$;
alter table empire_rewards.account enable row level security;
alter table empire_rewards.mastery enable row level security;
alter table empire_rewards.settlement enable row level security;
alter table empire_rewards.milestone enable row level security;
alter table empire_rewards.stone_exchange enable row level security;
revoke all on all tables in schema empire_rewards from public,anon,authenticated;
revoke all on all functions in schema empire_rewards from public,anon,authenticated;
-- No exposed RPC or service-role grants. Pending server authority, mission/rank adapters, appeal/reversal, shared inventory review and tests.
commit;
