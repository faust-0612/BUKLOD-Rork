-- DEV ONLY: apply only after sacred-stones-kingdom-candidate.sql and authoritative match adapter review.
-- Arena BP is earned game-only BP: never writes ministry ledger, QMP, Circle Rank, or cash.
begin;
create schema if not exists empire_rewards;
revoke all on schema empire_rewards from public,anon,authenticated;
create table empire_rewards.release_gate(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into empire_rewards.release_gate(singleton) values(true);
alter table empire_rewards.release_gate enable row level security;
create function empire_rewards.require_eligible(u uuid) returns void language plpgsql set search_path='' as $
begin
 if not exists(select 1 from empire_rewards.release_gate where singleton and enabled) or not empire_stones.eligible(u) then
   raise exception 'Arena rewards unavailable or account ineligible';
 end if;
end $;
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
 evidence jsonb not null, breakdown jsonb not null default '{}'::jsonb, xp integer not null check(xp>=0), bp_delta integer not null, created_at timestamptz not null default now(),
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
-- Serialize with the canonical character-switch RPC so active-window checkpoints are never lost.
create function empire_rewards.credit_character(u uuid,h text,amount integer) returns void
language plpgsql set search_path='' as $$
begin
 if u is null or amount is null or amount not between 1 and 1500 or not exists(select 1 from empire_stones.hero where id=h) then
   raise exception 'Invalid character XP';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('buklod_character_switch_v3'),pg_catalog.hashtext(u::text));
 insert into private.buklod_character_progress_v3(user_id,character_id,earned_points) values(u,h,amount)
 on conflict(user_id,character_id) do update set earned_points=private.buklod_character_progress_v3.earned_points+excluded.earned_points,updated_at=now();
end $$;

-- Category inputs are verified event aggregates; normalized to opportunity-adjusted 0..100.
-- JSON null means genuinely unavailable opportunity, never poor play. The server
-- adapter must substantiate that distinction; a player cannot choose exclusions.
create function empire_rewards.grade(score integer) returns text
language sql immutable strict set search_path='' as $$
 select case when score>=95 then 'S+' when score>=90 then 'S' when score>=80 then 'A'
 when score>=65 then 'B' when score>=50 then 'C' when score>=30 then 'D' else 'E' end
$$;
create function empire_rewards.grade_xp(score integer,teamwork boolean) returns integer
language sql immutable strict set search_path='' as $$
 select case when score>=95 then case when teamwork then 40 else 50 end
 when score>=90 then case when teamwork then 25 else 30 end
 when score>=80 then case when teamwork then 15 else 20 end
 when score>=65 then 10 when score>=50 then 5 when score>=30 then 2 else 0 end
$$;
create function empire_rewards.grade_bp(score integer) returns integer
language sql immutable strict set search_path='' as $$
 select case when score>=95 then 8 when score>=90 then 6 when score>=80 then 4
 when score>=65 then 3 when score>=50 then 2 when score>=30 then 1 else 0 end
$$;

-- Trusted, deduplicated event aggregates only. A target is an opportunity/role benchmark,
-- not a client-selected goal. Difficulty is 0..100, never a bonus for zero contribution.
create function empire_rewards.normalize_metric(metric jsonb) returns integer
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; effective numeric; target numeric; successful numeric; attempts numeric; difficulty numeric;
 impact numeric; efficiency numeric;
begin
 if metric is null or jsonb_typeof(metric)<>'object' or
    not (metric ?& array['effective','target','successful','attempts','difficulty']) or
    exists(select 1 from jsonb_object_keys(metric) x(key) where x.key not in ('effective','target','successful','attempts','difficulty')) then
   raise exception 'Invalid metric aggregate';
 end if;
 for k,v in select key,value from jsonb_each(metric) loop
   if jsonb_typeof(v)<>'number' or (v::text)!~'^(0|[1-9][0-9]{0,8})$' then raise exception 'Invalid metric aggregate value'; end if;
 end loop;
 effective:=(metric->>'effective')::numeric; target:=(metric->>'target')::numeric;
 successful:=(metric->>'successful')::numeric; attempts:=(metric->>'attempts')::numeric; difficulty:=(metric->>'difficulty')::numeric;
 if target<=0 or successful>attempts or difficulty>100 or (effective>0 and successful=0) or (successful>0 and effective=0) then
   raise exception 'Inconsistent metric aggregate';
 end if;
 if effective=0 then return 0; end if;
 impact:=least(effective/target,1); efficiency:=successful/attempts;
 return least(100,greatest(0,round(70*impact+20*efficiency+10*impact*difficulty/100)::integer));
end $$;

-- Canonical hero IDs; weights reflect kit strengths, not character prices or paid access.
-- Order: teamwork, combat, objective, support, resource, village, defense, leadership.
create function empire_rewards.performance(h text,scores jsonb,virtue integer) returns jsonb
language plpgsql immutable set search_path='' as $$
declare keys text[]:=array['teamwork','combat','objective','support','resource','village','defense','leadership'];
 weights integer[]; k text; v jsonb; score integer; weighted integer:=0; covered integer:=0;
 raw_xp integer:=0; item_xp integer; scored integer:=0; i integer; overall integer; result jsonb:='{}'::jsonb; best_key text; next_key text; best_score integer:=-1; next_score integer:=101;
begin
 weights:=case h
 when 'phan' then array[15,15,15,5,10,15,20,5]
 when 'quin' then array[15,30,20,5,10,5,5,10]
 when 'van' then array[20,10,10,15,5,5,25,10]
 when 'christian' then array[20,20,15,5,5,5,10,20]
 when 'lhen' then array[20,10,10,30,5,5,10,10]
 when 'ace' then array[20,10,10,35,5,5,10,5]
 when 'ellusur' then array[20,10,15,25,5,5,10,10]
 when 'jawo' then array[20,20,15,20,5,5,5,10]
 when 'mitch' then array[15,20,20,10,5,5,20,5]
 when 'niel' then array[15,35,20,5,5,5,10,5]
 when 'angel' then array[15,10,10,15,20,10,15,5]
 when 'vhen' then array[15,10,15,10,20,20,5,5]
 when 'trudice' then array[20,20,20,15,5,5,5,10]
 else null end;
 if weights is null or virtue is null or virtue not between 0 and 100 or
    scores is null or jsonb_typeof(scores)<>'object' or not (scores ?& keys) or
    exists(select 1 from jsonb_object_keys(scores) as x(key) where not (x.key=any(keys))) then
   raise exception 'Invalid performance evidence';
 end if;
 for i in 1..8 loop
   k:=keys[i]; v:=scores->k;
   if v='null'::jsonb then
     result:=result||jsonb_build_object(k,jsonb_build_object('grade','N/A','xp',0,'score',null));
     continue;
   end if;
   score:=empire_rewards.normalize_metric(v);
   item_xp:=empire_rewards.grade_xp(score,k='teamwork');
   raw_xp:=raw_xp+item_xp; weighted:=weighted+score*weights[i]; covered:=covered+weights[i]; scored:=scored+1;
   if score>best_score then best_score:=score; best_key:=k; end if;
   if score<next_score then next_score:=score; next_key:=k; end if;
   result:=result||jsonb_build_object(k,jsonb_build_object('grade',empire_rewards.grade(score),'xp',item_xp,'score',score,'weight',weights[i]));
 end loop;
 if scored<3 or covered<60 or scores->'teamwork'='null'::jsonb then raise exception 'Insufficient scored opportunities'; end if;
 overall:=weighted/covered;
 return jsonb_build_object('categories',result,'overall_score',overall,'grade',empire_rewards.grade(overall),
   'virtue_score',virtue,'best_category',best_key,'next_category',next_key,'scored_weight',covered,'performance_xp_raw',raw_xp,'performance_xp',least(raw_xp,300),
   'bonus_bp',empire_rewards.grade_bp(overall));
end $$;

create function empire_rewards.settle(mid uuid,u uuid,facts jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare h text; old empire_rewards.settlement%rowtype; d date; n int; earned int; xp_amount int:=0; bp_amount int:=0; bonus_xp int:=0; match_count bigint; penalty_today int; milestone_row record; perf jsonb:='{}'::jsonb; receipt jsonb:='{}'::jsonb; virtue integer; base_xp integer:=0; bp_raw integer:=0;
 bal bigint; outcome text; conduct text; first_win boolean; eligible boolean; team_no int;
begin
 if u is null or mid is null or facts is null or jsonb_typeof(facts)<>'object' then raise exception 'Invalid evidence'; end if;
 if not (facts ?& array['outcome','conduct','eligible','mvp','scores','virtue']) or
   exists(select 1 from jsonb_each(facts) e where e.key not in ('outcome','conduct','eligible','mvp','scores','virtue')) or
   exists(select 1 from jsonb_each(facts) e where e.key in ('eligible','mvp') and jsonb_typeof(e.value)<>'boolean') then raise exception 'Invalid facts'; end if;
 if jsonb_typeof(facts->'virtue')<>'number' or (facts->>'virtue')!~'^(0|[1-9][0-9]{0,2})$' then raise exception 'Invalid virtue evidence'; end if;
 virtue:=(facts->>'virtue')::integer;
 if virtue not between 0 and 100 then raise exception 'Invalid virtue score'; end if;
 outcome:=facts->>'outcome'; conduct:=facts->>'conduct'; eligible:=(facts->>'eligible')::boolean;
 if outcome is null or outcome not in ('win','loss','draw') or conduct is null or conduct not in ('clean','intentional_afk','abuse','cheat','outage') then raise exception 'Invalid result'; end if;
 perform empire_rewards.require_eligible(u);
 perform 1 from empire_stones.match where id=mid and mode='ranked' and state='completed' for share;
 if not found then raise exception 'Not a completed authoritative match'; end if;
 select hero_id,team into h,team_no from empire_stones.match_action where match_id=mid and user_id=u and action='pick';
 if not found then raise exception 'Not a participant'; end if;
 -- Full competitive roster required (training/bot matches cannot enter this settlement).
 if (select count(*) from empire_stones.match_action where match_id=mid and action='pick')<>10 or
    (select count(distinct hero_id) from empire_stones.match_action where match_id=mid and action='pick')<>10 or
    (select count(*) from empire_stones.match_action where match_id=mid and action='pick' and team=team_no)<>5 then raise exception 'Invalid competitive roster'; end if;
 perform empire_stones.lock_users(array[u]);
 insert into empire_rewards.account(user_id) values(u) on conflict do nothing;
 select a.bp into bal from empire_rewards.account a where a.user_id=u for update;
 select * into old from empire_rewards.settlement where match_id=mid and user_id=u;
 if found then
   if old.evidence is distinct from facts then raise exception 'Settlement conflict'; end if;
   return old.breakdown||jsonb_build_object('xp',old.xp,'bp_delta',old.bp_delta,'duplicate',true);
 end if;
 d:=(now() at time zone 'Asia/Manila')::date;
 -- Score clean eligible matches even after daily cap, for feedback only.
 if conduct='clean' and eligible then perf:=empire_rewards.performance(h,facts->'scores',virtue); end if;
 select count(*),coalesce(sum(greatest(bp_delta,0)),0) into n,earned from empire_rewards.settlement where user_id=u and day=d and xp>0;
 first_win:=not exists(select 1 from empire_rewards.settlement where user_id=u and day=d and xp>0 and evidence->>'outcome'='win');
 if conduct in ('intentional_afk','abuse','cheat') and eligible then
   select coalesce(sum(greatest(-bp_delta,0)),0) into penalty_today from empire_rewards.settlement where user_id=u and day=d;
   bp_amount:=-least(bal,greatest(20-penalty_today,0),case conduct when 'intentional_afk' then 5 when 'abuse' then 10 else 20 end)::int;
 elsif conduct='clean' and eligible and n<5 then
   base_xp:=20+case when outcome='win' then 30 else 0 end
      +case when (facts->>'mvp')::boolean and (perf->>'overall_score')::integer>=80 then 25 else 0 end
      +case when outcome='win' and first_win then 50 else 0 end;
   xp_amount:=base_xp+(perf->>'performance_xp')::integer;
   bp_raw:=3+case when outcome='win' then 2 else 0 end+(perf->>'bonus_bp')::integer;
   bp_amount:=least(greatest(30-earned,0),bp_raw);
 end if;
 receipt:=perf||jsonb_build_object('policy','graded-v2','base_xp',base_xp,'performance_xp_awarded',xp_amount-base_xp,
   'bp_before_daily_cap',bp_raw,'bp_cap_reached',bp_raw>greatest(bp_amount,0),'daily_reward_match_limit',5,'daily_bp_limit',30,'daily_penalty_limit',20,
   'reason',case when not eligible then 'ineligible' when conduct<>'clean' then conduct when n>=5 then 'daily_match_cap' else 'rewarded' end);
 insert into empire_rewards.settlement(match_id,user_id,hero_id,day,evidence,breakdown,xp,bp_delta) values(mid,u,h,d,facts,receipt,xp_amount,bp_amount);
 update empire_rewards.account set bp=empire_rewards.account.bp+bp_amount where user_id=u;
 if xp_amount>0 then
   insert into empire_rewards.mastery(user_id,hero_id,xp,matches,wins) values(u,h,xp_amount,1,case when outcome='win' then 1 else 0 end)
   on conflict(user_id,hero_id) do update set xp=empire_rewards.mastery.xp+excluded.xp,matches=empire_rewards.mastery.matches+1,wins=empire_rewards.mastery.wins+excluded.wins;
   select matches into match_count from empire_rewards.mastery where user_id=u and hero_id=h;
   for milestone_row in select * from (values (10,100),(25,250),(50,500)) as m(threshold,award) where threshold<=match_count loop
     insert into empire_rewards.milestone(user_id,hero_id,event_key,xp) values(u,h,'mastery:'||milestone_row.threshold,milestone_row.award) on conflict do nothing;
     if found then bonus_xp:=bonus_xp+milestone_row.award; end if;
   end loop;
   if bonus_xp>0 then
     update empire_rewards.mastery set xp=empire_rewards.mastery.xp+bonus_xp where user_id=u and hero_id=h;
     update empire_rewards.settlement set xp=xp_amount+bonus_xp where match_id=mid and user_id=u;
   end if;
   perform empire_rewards.credit_character(u,h,xp_amount+bonus_xp);
 end if;
 receipt:=receipt||jsonb_build_object('milestone_xp',bonus_xp,'xp',xp_amount+bonus_xp,'bp_delta',bp_amount);
 update empire_rewards.settlement set breakdown=receipt where match_id=mid and user_id=u;
 return receipt||jsonb_build_object('duplicate',false);
end $$;
-- Mission tier grants are once per canonical hero and tier. The future trusted adapter must
-- verify that the named community/Kingdom mission actually occurred and tier evidence is legitimate.
create function empire_rewards.mission(u uuid,h text,tier integer,mission_key text) returns integer
language plpgsql set search_path='' as $$
declare award integer;
begin
 if u is null or tier is null or tier not between 1 and 3 or mission_key is null or
    not exists(select 1 from empire_stones.hero where id=h and (community_event=mission_key or kingdom_quest=mission_key)) then
   raise exception 'Invalid mission evidence';
 end if;
 perform empire_rewards.require_eligible(u);
 award:=case tier when 1 then 50 when 2 then 100 else 200 end;
 perform empire_stones.lock_users(array[u]);
 insert into empire_rewards.account(user_id) values(u) on conflict do nothing;
 if tier>1 and not exists(select 1 from empire_rewards.milestone where user_id=u and hero_id=h and event_key='mission:'||(tier-1)) then
   raise exception 'Prior mission tier required';
 end if;
 insert into empire_rewards.milestone(user_id,hero_id,event_key,xp) values(u,h,'mission:'||tier,award) on conflict do nothing;
 if not found then return 0; end if;
 perform empire_rewards.credit_character(u,h,award);
 return award;
end $$;
-- Game-only BP can buy exactly the same hero stone at 100 BP, not cash or ministry rank.
create function empire_rewards.exchange(u uuid,h text,n integer,req uuid) returns void
language plpgsql set search_path='' as $$
declare old empire_rewards.stone_exchange%rowtype; bal bigint;
begin
 if u is null or req is null or n is null or n not between 1 and 100 or h is null then raise exception 'Invalid exchange'; end if;
 perform empire_rewards.require_eligible(u);
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
-- No exposed RPC or service-role grants. Pending server authority, mission evidence/rank adapters, appeal/reversal, shared inventory review and tests.
commit;
