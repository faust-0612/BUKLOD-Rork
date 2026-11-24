-- DEV CANDIDATE ONLY. NOT an applied migration. Use existing MAIN database only
-- after canonical BP debit/locking, account eligibility, RLS and runtime gates pass.
-- All endpoints below are private, trusted-server-only. Never expose service credentials.
begin;
create schema if not exists empire_stones;
revoke all on schema empire_stones from public, anon, authenticated;
create table empire_stones.hero (
  id text primary key, mission text not null unique, community_event text not null unique,
  kingdom_location text not null unique, kingdom_quest text not null unique
);
insert into empire_stones.hero values
  ('phan','Builder''s Legacy','bayanihan_contribution','ancient_ruins','building_quest'),
  ('quin','Seeker of Truth','saliksik_investigation','lost_temples','exploration_puzzle'),
  ('van','Guardian''s Bond','meaningful_connect','guardian_villages','rescue_quest'),
  ('christian','Leader''s Triumph','cluster_achievement','frontier_strongholds','territory_defense'),
  ('lhen','Harmony of Souls','worship_music','harmony_chambers','music_puzzle'),
  ('ace','Healer''s Courage','verified_mentoring','healing_outposts','healing_quest'),
  ('ellusur','Beacon of Wisdom','doctrinal_teaching','wisdom_sanctuaries','teaching_trial'),
  ('jawo','Nature''s Symphony','nature_music','enchanted_forests','nature_quest'),
  ('mitch','Creator''s Masterpiece','original_art','artisan_workshops','creative_puzzle'),
  ('niel','Voice of Conviction','verified_bible_reflection','conviction_trials','courage_trial'),
  ('angel','Keeper of Balance','stewardship_service','treasury_vaults','resource_quest'),
  ('vhen','Seeds of Tomorrow','personal_growth','cultivation_gardens','cultivation_quest'),
  ('trudice','Light of Knowledge','academic_milestone','knowledge_towers','knowledge_puzzle');
create table empire_stones.wallet (
  user_id uuid references public.profiles(id) on delete restrict,
  hero_id text references empire_stones.hero(id),
  balance bigint not null default 0 check(balance>=0),
  primary key(user_id,hero_id)
);
create table empire_stones.operation (
  key text primary key check(length(key) between 1 and 200),
  payload jsonb not null, created_at timestamptz not null default now()
);
create table empire_stones.ledger (
  id bigint generated always as identity primary key,
  operation_key text not null references empire_stones.operation(key),
  user_id uuid not null references public.profiles(id) on delete restrict,
  hero_id text not null references empire_stones.hero(id),
  delta bigint not null check(delta<>0),
  created_at timestamptz not null default now()
);
create index on empire_stones.ledger(user_id,created_at desc);
create table empire_stones.match (
  id uuid primary key, mode text not null default 'unclassified' check(mode in ('unclassified','casual','ranked')), state text not null check(state in ('reserved','started','completed','cancelled','invalid')),
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table empire_stones.match_action (
  match_id uuid references empire_stones.match(id),
  user_id uuid not null references public.profiles(id) on delete restrict,
  team integer not null check(team in (0,1)),
  hero_id text not null references empire_stones.hero(id),
  action text not null check(action in ('pick','ban')),
  primary key(match_id,user_id,action)
);
create unique index on empire_stones.match_action(match_id,team) where action='ban';
create unique index on empire_stones.match_action(match_id,team,hero_id) where action='pick';
alter table empire_stones.hero enable row level security;
alter table empire_stones.wallet enable row level security;
alter table empire_stones.operation enable row level security;
alter table empire_stones.ledger enable row level security;
alter table empire_stones.match enable row level security;
alter table empire_stones.match_action enable row level security;
-- Identical retry returns false; reused key with different payload fails.
create function empire_stones.once(k text,p jsonb) returns boolean
language plpgsql set search_path='' as $$
declare old jsonb;
begin
  insert into empire_stones.operation(key,payload) values(k,p) on conflict do nothing;
  if found then return true; end if;
  select payload into old from empire_stones.operation where key=k;
  if old is distinct from p then raise exception 'Idempotency key conflict'; end if;
  return false;
end $$;
-- Serialize per user in deterministic order, also used for multi-account operations.
create function empire_stones.lock_users(ids uuid[]) returns void
language plpgsql set search_path='' as $$
declare u uuid;
begin
  for u in select distinct x from unnest(ids) x order by x loop
    if u is null then raise exception 'Missing account'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('empire_stones:'||u::text,0));
  end loop;
end $$;
create function empire_stones.change_balance(k text,u uuid,h text,d bigint) returns void
language plpgsql set search_path='' as $$
begin
  if d is null or d=0 then raise exception 'Invalid delta'; end if;
  insert into empire_stones.wallet(user_id,hero_id,balance) values(u,h,0) on conflict do nothing;
  update empire_stones.wallet set balance=balance+d where user_id=u and hero_id=h and balance+d>=0;
  if not found then raise exception 'Insufficient matching stones'; end if;
  insert into empire_stones.ledger(operation_key,user_id,hero_id,delta) values(k,u,h,d);
end $$;
-- Caller must resolve the authenticated account, reject system/admin and restricted accounts,
-- and reconcile current canonical BP restrictions before enabling this endpoint.
create function empire_stones.exchange(u uuid,h text,n integer,request_id uuid) returns void
language plpgsql set search_path='' as $$
declare available bigint; cost integer; k text; debit_id uuid;
begin
  if n is null or n not between 1 and 1000 or request_id is null then raise exception 'Invalid exchange'; end if;
  cost:=n*100; k:='exchange:'||u::text||':'||request_id::text;
  perform empire_stones.lock_users(array[u]);
  -- Existing points redemption uses this same canonical balance row lock.
  select available_points into available from public.buklod_user_points_balances where user_id=u for update;
  if not empire_stones.once(k,jsonb_build_object('user',u,'hero',h,'quantity',n)) then return; end if;
  if available is null or greatest(available-public.buklod_points_cash_reserved_for(u),0)<cost then
    raise exception 'Insufficient claimed spendable BP';
  end if;
  insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id,description)
    values(u,'debit',cost,'sacred_stone_exchange',k,request_id,'Sacred Stone exchange: '||h)
    returning id into debit_id;
  perform empire_stones.change_balance(k,u,h,n);
end $$;
create function empire_stones.gift(sender uuid,recipient uuid,h text,n integer,request_id uuid) returns void
language plpgsql set search_path='' as $$
declare k text;
begin
  if sender is null or recipient is null or sender=recipient or n is null or n not between 1 and 1000 or request_id is null then raise exception 'Invalid gift'; end if;
  perform empire_stones.lock_users(array[sender,recipient]);
  k:='gift:'||sender::text||':'||request_id::text;
  if not empire_stones.once(k,jsonb_build_object('sender',sender,'recipient',recipient,'hero',h,'quantity',n)) then return; end if;
  perform empire_stones.change_balance(k,sender,h,-n);
  perform empire_stones.change_balance(k,recipient,h,n);
end $$;
-- Trusted verifier only: evidence IDs must be immutable, globally unique per
-- issuer, not generated by players. Verify receipt/quest/anti-farming upstream.
-- One stone per distinct verified reward. Paid bundle quantities come from verified SKU.
create function empire_stones.grant_verified(u uuid,h text,n integer,kind text,evidence_id text,context_id text) returns void
language plpgsql set search_path='' as $$
declare k text; rule empire_stones.hero%rowtype;
begin
  select * into strict rule from empire_stones.hero where id=h;
  if n is null or n not between 1 and 1000 or kind is null or evidence_id is null or length(evidence_id) not between 1 and 140
    or context_id is null or length(context_id) not between 1 and 140 then raise exception 'Invalid evidence'; end if;
  if kind='purchase' then null; -- receipt verification and SKU/account mapping mandatory upstream
  elsif kind='community' then
    if n<>1 or context_id<>rule.community_event then raise exception 'Wrong community mission'; end if;
  elsif kind='kingdom_quest' then
    if n<>1 or context_id<>rule.kingdom_quest then raise exception 'Wrong Kingdom quest'; end if;
  elsif kind in ('rare_pick','monster_drop','treasure_discovery','village_reward','quest_reward') then
    if n<>1 or context_id<>rule.kingdom_location then raise exception 'Wrong Kingdom location'; end if;
  elsif kind='battle_reward' then
    if n<>1 then raise exception 'Invalid battle reward'; end if;
  else raise exception 'Unsupported award'; end if;
  perform empire_stones.lock_users(array[u]);
  k:='verified:'||kind||':'||evidence_id;
  if not empire_stones.once(k,jsonb_build_object('user',u,'hero',h,'quantity',n,'context',context_id)) then return; end if;
  perform empire_stones.change_balance(k,u,h,n);
end $$;
-- Authoritative match service only. Final confirmed draft contains one pick per human
-- player and at most one optional ban per team. Bots/practice are not billed.
-- Server validates membership and pick/ban phase before calling; never accept raw client arrays.
create function empire_stones.reserve_match(mid uuid,actions jsonb,match_mode text default 'unclassified') returns void
language plpgsql set search_path='' as $$
declare k text; a record; ids uuid[];
begin
  if mid is null or actions is null or match_mode is null or match_mode not in ('unclassified','casual','ranked') or jsonb_typeof(actions)<>'array' then raise exception 'Invalid match'; end if;
  if jsonb_array_length(actions) not between 1 and 12 then raise exception 'Invalid draft size'; end if;
  k:='reserve:'||mid::text;
  if not empire_stones.once(k,jsonb_build_object('actions',actions,'mode',match_mode)) then return; end if;
  insert into empire_stones.match(id,mode,state,expires_at) values(mid,match_mode,'reserved',now()+interval '5 minutes');
  insert into empire_stones.match_action(match_id,user_id,team,hero_id,action)
    select mid,x.user_id,x.team,x.hero_id,x.action from jsonb_to_recordset(actions) as x(user_id uuid,team integer,hero_id text,action text);
  if not exists(select 1 from empire_stones.match_action where match_id=mid and action='pick') or
    exists(select 1 from empire_stones.match_action b where b.match_id=mid and b.action='ban' and
      not exists(select 1 from empire_stones.match_action p where p.match_id=mid and p.user_id=b.user_id and p.team=b.team and p.action='pick')) or
    exists(select 1 from empire_stones.match_action p join empire_stones.match_action b
      on p.match_id=b.match_id and p.team<>b.team and p.hero_id=b.hero_id
      where p.match_id=mid and p.action='pick' and b.action='ban') or
    exists(select 1 from empire_stones.match_action where match_id=mid and action='pick' group by team having count(*)>5)
    then raise exception 'Invalid pick or ban'; end if;
  select array_agg(distinct user_id) into ids from empire_stones.match_action where match_id=mid;
  perform empire_stones.lock_users(ids);
  for a in select user_id,hero_id,count(*)::bigint quantity from empire_stones.match_action where match_id=mid group by user_id,hero_id order by user_id,hero_id loop
    perform empire_stones.change_balance(k,a.user_id,a.hero_id,-a.quantity);
  end loop;
end $$;
-- Scheduled trusted worker, bounded batch. Does not restore started matches on client disconnect.
create function empire_stones.expire_drafts() returns integer
language plpgsql set search_path='' as $$
declare m record; n integer:=0;
begin
  for m in select id from empire_stones.match where state='reserved' and expires_at<=now() order by expires_at limit 1 for update skip locked loop
    perform empire_stones.settle_match(m.id,'cancelled'); n:=n+1;
  end loop;
  return n;
end $$;

-- Arena-only conversions. Canonical recipe inputs are unordered.
create table empire_stones.recipe (
  output text primary key references empire_stones.hero(id),
  input_a text not null references empire_stones.hero(id),
  input_b text not null references empire_stones.hero(id),
  check(input_a<>input_b and output<>input_a and output<>input_b)
);
insert into empire_stones.recipe values
('phan','trudice','quin'),
('quin','phan','van'),
('van','quin','christian'),
('christian','van','lhen'),
('lhen','christian','ace'),
('ace','lhen','ellusur'),
('ellusur','ace','jawo'),
('jawo','ellusur','mitch'),
('mitch','jawo','niel'),
('niel','mitch','angel'),
('angel','niel','vhen'),
('vhen','angel','trudice'),
('trudice','vhen','phan');
alter table empire_stones.recipe enable row level security;
create function empire_stones.convert(u uuid,h text,inputs text[],universal boolean,request_id uuid) returns void
language plpgsql set search_path='' as $$
declare k text; a record; ordered text[]; r empire_stones.recipe%rowtype;
begin
  if u is null or h is null or request_id is null or universal is null or inputs is null or
     cardinality(inputs)<>(case when universal then 3 else 2 end) or
     exists(select 1 from unnest(inputs) x where x is null or x=h or not exists(select 1 from empire_stones.hero where id=x))
     then raise exception 'Invalid conversion'; end if;
  select * into strict r from empire_stones.recipe where output=h;
  select array_agg(x order by x) into ordered from unnest(inputs) x;
  if not universal and ordered is distinct from array(select x from unnest(array[r.input_a,r.input_b]) x order by x)
     then raise exception 'Recipe mismatch'; end if;
  perform empire_stones.lock_users(array[u]);
  k:='convert:'||u::text||':'||request_id::text;
  if not empire_stones.once(k,jsonb_build_object('user',u,'output',h,'inputs',ordered,'universal',universal)) then return; end if;
  for a in select x as hero,count(*) as quantity from unnest(ordered) x group by x order by x loop
    perform empire_stones.change_balance(k,u,a.hero,-a.quantity);
  end loop;
  perform empire_stones.change_balance(k,u,h,1);
end $$;
-- Explicit counterparty offer; no balance movement until recipient accepts.
create table empire_stones.trade_offer (
  id uuid primary key, sender uuid not null references public.profiles(id),
  recipient uuid not null references public.profiles(id), offered text[] not null, wanted text[] not null,
  state text not null default 'open' check(state in ('open','accepted','cancelled')),
  expires_at timestamptz not null default now()+interval '1 day',
  check(sender<>recipient)
);
alter table empire_stones.trade_offer enable row level security;
create function empire_stones.offer_trade(tid uuid,sender_id uuid,recipient_id uuid,give text[],want text[]) returns void
language plpgsql set search_path='' as $$
declare a text[]; b text[];
begin
  if tid is null or sender_id is null or recipient_id is null or sender_id=recipient_id or give is null or want is null or
     cardinality(give) not between 1 and 100 or cardinality(give)<>cardinality(want) or
     exists(select 1 from unnest(give||want) x where x is null or not exists(select 1 from empire_stones.hero where id=x))
     then raise exception 'Invalid trade'; end if;
  select array_agg(x order by x) into a from unnest(give) x;
  select array_agg(x order by x) into b from unnest(want) x;
  if a=b then raise exception 'No-op trade'; end if;
  if not empire_stones.once('offer:'||tid::text,jsonb_build_object('sender',sender_id,'recipient',recipient_id,'give',a,'want',b)) then return; end if;
  insert into empire_stones.trade_offer(id,sender,recipient,offered,wanted) values(tid,sender_id,recipient_id,a,b);
end $$;
create function empire_stones.accept_trade(tid uuid,actor uuid) returns void
language plpgsql set search_path='' as $$
declare t empire_stones.trade_offer%rowtype; a record; k text;
begin
  select * into strict t from empire_stones.trade_offer where id=tid for update;
  if actor is distinct from t.recipient then raise exception 'Not recipient'; end if;
  if t.state='accepted' then return; end if;
  if t.state<>'open' or t.expires_at<=now() then raise exception 'Offer closed'; end if;
  perform empire_stones.lock_users(array[t.sender,t.recipient]);
  k:='trade:'||tid::text;
  if not empire_stones.once(k,jsonb_build_object('sender',t.sender,'recipient',t.recipient,'give',t.offered,'want',t.wanted)) then raise exception 'Trade conflict'; end if;
  -- All debits precede credits, so incoming stones cannot finance the same trade.
  for a in select x hero,count(*) quantity from unnest(t.offered) x group by x order by x loop
    perform empire_stones.change_balance(k,t.sender,a.hero,-a.quantity);
  end loop;
  for a in select x hero,count(*) quantity from unnest(t.wanted) x group by x order by x loop
    perform empire_stones.change_balance(k,t.recipient,a.hero,-a.quantity);
  end loop;
  for a in select x hero,count(*) quantity from unnest(t.offered) x group by x order by x loop
    perform empire_stones.change_balance(k,t.recipient,a.hero,a.quantity);
  end loop;
  for a in select x hero,count(*) quantity from unnest(t.wanted) x group by x order by x loop
    perform empire_stones.change_balance(k,t.sender,a.hero,a.quantity);
  end loop;
  update empire_stones.trade_offer set state='accepted' where id=tid;
end $$;
create function empire_stones.cancel_trade(tid uuid,actor uuid) returns void
language plpgsql set search_path='' as $$
begin
  update empire_stones.trade_offer set state='cancelled' where id=tid and actor in (sender,recipient) and state='open';
end $$;
-- Opt-in trade discovery only. Never auto-execute a match or reveal non-opt-in wallets.
create table empire_stones.wishlist (
 user_id uuid references public.profiles(id), wanted text references empire_stones.hero(id),
 offered text references empire_stones.hero(id), primary key(user_id,wanted,offered),check(wanted<>offered)
);
alter table empire_stones.wishlist enable row level security;
create function empire_stones.set_wish(u uuid,w text,o text,enabled boolean) returns void
language plpgsql set search_path='' as $$
begin
  if enabled then insert into empire_stones.wishlist values(u,w,o) on conflict do nothing;
  else delete from empire_stones.wishlist where user_id=u and wanted=w and offered=o; end if;
end $$;
create function empire_stones.find_trade_matches(u uuid,w text,o text) returns table(candidate uuid)
language sql stable set search_path='' as $$
 select a.user_id from empire_stones.wishlist a join empire_stones.wallet b on b.user_id=a.user_id and b.hero_id=a.offered
 where a.wanted=o and a.offered=w and a.user_id<>u and b.balance>0
 order by a.user_id limit 30
$$;
-- Request and sponsorship use the same gift ledger, with recipient explicitly selected.
create table empire_stones.gift_request (
 id uuid primary key, requester uuid not null references public.profiles(id), donor uuid not null references public.profiles(id),
 hero_id text not null references empire_stones.hero(id), state text not null default 'open' check(state in ('open','accepted','cancelled')),
 expires_at timestamptz not null default now()+interval '1 day',check(requester<>donor)
);
alter table empire_stones.gift_request enable row level security;
create function empire_stones.request_stone(rid uuid,u uuid,d uuid,h text) returns void
language plpgsql set search_path='' as $$
begin
 if not empire_stones.once('gift_request:'||rid::text,jsonb_build_object('requester',u,'donor',d,'hero',h)) then return; end if;
 insert into empire_stones.gift_request(id,requester,donor,hero_id) values(rid,u,d,h);
end $$;
create function empire_stones.answer_stone_request(rid uuid,actor uuid,accept boolean) returns void
language plpgsql set search_path='' as $$
declare r empire_stones.gift_request%rowtype;
begin
 select * into strict r from empire_stones.gift_request where id=rid for update;
 if actor is distinct from r.donor then raise exception 'Not donor'; end if;
 if r.state<>'open' then return; end if;
 if r.expires_at<=now() or accept is null then raise exception 'Request closed'; end if;
 if accept then
   -- Distinct namespace from ordinary gift request keys.
   perform empire_stones.lock_users(array[r.donor,r.requester]);
   if not empire_stones.once('request_gift:'||rid::text,jsonb_build_object('donor',r.donor,'recipient',r.requester,'hero',r.hero_id)) then raise exception 'Request conflict'; end if;
   perform empire_stones.change_balance('request_gift:'||rid::text,r.donor,r.hero_id,-1);
   perform empire_stones.change_balance('request_gift:'||rid::text,r.requester,r.hero_id,1);
 end if;
 update empire_stones.gift_request set state=case when accept then 'accepted' else 'cancelled' end where id=rid;
end $$;
-- Trusted match service: reserve one counter per human before start. Casual only.
create table empire_stones.counter_reservation (
 match_id uuid references empire_stones.match(id),user_id uuid references public.profiles(id),
 hero_id text not null references empire_stones.hero(id), target_id uuid references public.profiles(id),
 activated_at timestamptz, refunded boolean not null default false,primary key(match_id,user_id)
);
create unique index counter_once_per_target on empire_stones.counter_reservation(match_id,target_id) where activated_at is not null;
alter table empire_stones.counter_reservation enable row level security;
create function empire_stones.reserve_counter(mid uuid,u uuid,h text) returns void
language plpgsql set search_path='' as $$
declare m empire_stones.match%rowtype; k text; team_id integer;
begin
 select * into strict m from empire_stones.match where id=mid for update;
 if m.state<>'reserved' or m.mode<>'casual' or m.expires_at<=now() then raise exception 'Counter unavailable'; end if;
 select team into strict team_id from empire_stones.match_action where match_id=mid and user_id=u and action='pick';
 if not exists(select 1 from empire_stones.match_action where match_id=mid and team<>team_id and action='pick' and hero_id=h)
   then raise exception 'No matching opponent'; end if;
 perform empire_stones.lock_users(array[u]);k:='counter:'||mid::text||':'||u::text;
 if not empire_stones.once(k,jsonb_build_object('hero',h)) then return; end if;
 insert into empire_stones.counter_reservation(match_id,user_id,hero_id) values(mid,u,h);
 perform empire_stones.change_balance(k,u,h,-1);
end $$;
-- Trusted game server verifies alive/range and simulation tick BEFORE activation;
-- apply effect from this durable activation id, exactly once in game event processing.
create function empire_stones.activate_counter(mid uuid,u uuid,target uuid) returns boolean
language plpgsql set search_path='' as $$
declare m empire_stones.match%rowtype; c empire_stones.counter_reservation%rowtype;
begin
 select * into strict m from empire_stones.match where id=mid for update;
 if m.state<>'started' or m.mode<>'casual' then raise exception 'Counter unavailable'; end if;
 select * into strict c from empire_stones.counter_reservation where match_id=mid and user_id=u for update;
 if c.refunded then raise exception 'Counter refunded'; end if;
 if c.activated_at is not null then
   if c.target_id is distinct from target then raise exception 'Counter already used'; end if;
   return false;
 end if;
 if not exists(select 1 from empire_stones.match_action a join empire_stones.match_action b on a.match_id=b.match_id and a.team<>b.team
   where a.match_id=mid and a.user_id=u and a.action='pick' and b.user_id=target and b.action='pick' and b.hero_id=c.hero_id)
   then raise exception 'Invalid opponent'; end if;
 update empire_stones.counter_reservation set target_id=target,activated_at=now() where match_id=mid and user_id=u;
 return true;
end $$;

create function empire_stones.settle_match(mid uuid,next_state text) returns void
language plpgsql set search_path='' as $$
declare current_state text; deadline timestamptz; k text; ids uuid[]; a record;
begin
  select state,expires_at into strict current_state,deadline from empire_stones.match where id=mid for update;
  if current_state=next_state then return; end if;
  if not ((current_state='reserved' and next_state in ('started','cancelled')) or
          (current_state='started' and next_state in ('completed','invalid'))) then raise exception 'Invalid match transition'; end if;
  if next_state='started' and deadline<=now() then raise exception 'Reservation expired'; end if;
  if next_state in ('cancelled','invalid') then
    k:='refund:'||mid::text;
    select array_agg(distinct user_id) into ids from empire_stones.match_action where match_id=mid;
    perform empire_stones.lock_users(ids);
    if not empire_stones.once(k,jsonb_build_object('match',mid,'reason',next_state)) then raise exception 'Unexpected refund replay'; end if;
    for a in select user_id,hero_id,count(*)::bigint quantity from empire_stones.match_action where match_id=mid group by user_id,hero_id order by user_id,hero_id loop
      perform empire_stones.change_balance(k,a.user_id,a.hero_id,a.quantity);
    end loop;
  end if;
  if next_state in ('cancelled','invalid','completed') then
    select array_agg(distinct user_id) into ids from empire_stones.counter_reservation where match_id=mid and not refunded and
      (next_state<>'completed' or activated_at is null);
    if ids is not null then
      perform empire_stones.lock_users(ids);
      k:='counter_refund:'||mid::text;
      if not empire_stones.once(k,jsonb_build_object('match',mid,'state',next_state)) then raise exception 'Counter refund conflict'; end if;
      for a in select user_id,hero_id from empire_stones.counter_reservation where match_id=mid and not refunded and
        (next_state<>'completed' or activated_at is null) order by user_id loop
        perform empire_stones.change_balance(k,a.user_id,a.hero_id,1);
      end loop;
      update empire_stones.counter_reservation set refunded=true where match_id=mid and not refunded and
        (next_state<>'completed' or activated_at is null);
    end if;
  end if;
  update empire_stones.match set state=next_state where id=mid;
end $$;

-- Private direct database access for trusted worker only; public clients have no privileges.
revoke all on all tables in schema empire_stones from public,anon,authenticated;
revoke all on all sequences in schema empire_stones from public,anon,authenticated;
revoke all on all functions in schema empire_stones from public,anon,authenticated;
-- Deliberately no grants to service_role and no exposed RPC until adapter review.
commit;
