-- SEASON 2 ONLY - SOURCE CANDIDATE, NEVER AUTO-APPLY.
-- This file is deliberately under docs/season2/sql, NOT supabase/migrations.
-- Moving it into a migration requires separately reviewed staging database,
-- schema drift reconciliation, SQL concurrency/RLS tests and owner approval.
-- DO NOT APPLY TO PRODUCTION. No Season 1 table/trigger/function is mutated.
--
-- Transaction/ownership model:
-- 1. Season 2 schema is not Data API exposed.
-- 2. Config disabled and without start/end dates: fail closed after deployment.
-- 3. Only service_role may execute server-side source verification/credit/purchase.
-- 4. User can NEVER supply tokens, faith mode, event timestamp or owner in an
--    exposed RPC; no public RPCs are added by this candidate.
-- 5. BP, QMP, cash, Kingdom Shards, rank and Character V3 stay untouched.
begin;

create schema if not exists buklod_s2;
revoke all on schema buklod_s2 from public, anon, authenticated;
grant usage on schema buklod_s2 to service_role;

create table if not exists buklod_s2.control (
  only_row boolean primary key default true check (only_row),
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  rule_version text not null default 'season2-core-r1',
  daily_token_cap smallint not null default 12 check(daily_token_cap between 0 and 12),
  require_s1_reconciled boolean not null default true check(require_s1_reconciled),
  updated_at timestamptz not null default now(),
  constraint valid_s2_dates check (ends_at is null or starts_at is null or ends_at>starts_at)
);
insert into buklod_s2.control(only_row,enabled,starts_at,ends_at)
values(true,false,null,null) on conflict(only_row) do nothing;

create table if not exists buklod_s2.wallet (
  user_id uuid primary key references auth.users(id) on delete cascade,
  earned bigint not null default 0 check(earned>=0),
  spent bigint not null default 0 check(spent>=0),
  balance bigint not null default 0 check(balance>=0),
  updated_at timestamptz not null default now(),
  constraint s2_wallet_sum check(earned-spent=balance)
);
create table if not exists buklod_s2.source_receipt (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check(source_kind in
    ('today_dugtong','kl_verified_chapter','wall_original_post','wall_meaningful_comment')),
  source_id uuid not null,
  semantic_key text not null check(length(semantic_key) between 1 and 180),
  source_at timestamptz not null,
  manila_day date not null,
  week_start date not null,
  rule_version text not null,
  token_amount smallint not null check(token_amount between 0 and 3),
  created_at timestamptz not null default now(),
  unique(user_id,source_kind,source_id,rule_version)
);
create index if not exists s2_receipt_day_idx
 on buklod_s2.source_receipt(user_id,manila_day,source_kind);
create index if not exists s2_receipt_week_idx
 on buklod_s2.source_receipt(user_id,week_start,source_kind);
create table if not exists buklod_s2.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_key text not null check(length(entry_key) between 5 and 200),
  direction text not null check(direction in ('earn','spend','reversal')),
  amount integer not null check(amount<>0 and abs(amount)<=150),
  balance_after bigint not null check(balance_after>=0),
  receipt_id bigint references buklod_s2.source_receipt(id),
  created_at timestamptz not null default now(),
  unique(user_id,entry_key)
);
create index if not exists s2_token_ledger_user_idx
 on buklod_s2.token_ledger(user_id,created_at desc);
create table if not exists buklod_s2.cosmetic_catalog (
  item_key text primary key,
  price smallint not null check(price>0 and price<=150),
  item_kind text not null check(item_kind in
    ('accessory_finish','gallery_theme','skin_variant','premium_visual_effect')),
  permanent boolean not null default true,
  enabled boolean not null default false,
  nonessential boolean not null default true check(nonessential),
  is_paid_collectible boolean not null default false check(not is_paid_collectible),
  created_at timestamptz not null default now()
);
insert into buklod_s2.cosmetic_catalog(item_key,price,item_kind)
values('accessory_finish_emerald',30,'accessory_finish'),
      ('gallery_theme_storybook',60,'gallery_theme'),
      ('skin_variant_aurora',80,'skin_variant'),
      ('premium_visual_effect_beacon',150,'premium_visual_effect')
on conflict(item_key) do nothing;
create table if not exists buklod_s2.purchases (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_nonce uuid not null,
  item_key text not null references buklod_s2.cosmetic_catalog(item_key),
  price smallint not null check(price>0),
  purchased_at timestamptz not null default now(),
  primary key(user_id,request_nonce),
  unique(user_id,item_key)
);
create table if not exists buklod_s2.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null references buklod_s2.cosmetic_catalog(item_key),
  acquired_at timestamptz not null default now(),
  equipped_character text,
  equipped_at timestamptz,
  primary key(user_id,item_key)
);
create table if not exists buklod_s2.badge_grant (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null check(length(badge_key) between 4 and 100),
  week_start date not null,
  earned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_case_id text,
  primary key(user_id,badge_key,week_start),
  constraint s2_revocation_requires_case check (
    (revoked_at is null and revoked_case_id is null)
    or (revoked_at is not null and revoked_case_id is not null
       and length(trim(revoked_case_id))>=8)
  )
);
-- A receipt may satisfy only ONE weekly foundation claim; separate weekly
-- bonus cannot be farmed from replaying a KL chapter or social reply.
create table if not exists buklod_s2.weekly_claim (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  learning_receipt_id bigint not null references buklod_s2.source_receipt(id),
  community_receipt_id bigint not null references buklod_s2.source_receipt(id),
  claimed_at timestamptz not null default now(),
  badge_key text not null default 's2_weekly_foundation',
  primary key(user_id,week_start),
  unique(user_id,learning_receipt_id),
  unique(user_id,community_receipt_id),
  constraint separate_s2_foundation_receipts check(
     learning_receipt_id<>community_receipt_id)
);
create table if not exists buklod_s2.flex_allocation (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  credit_count smallint not null check(credit_count between 1 and 2),
  opted_at timestamptz not null default now(),
  request_nonce uuid not null,
  primary key(user_id,week_start),
  unique(user_id,request_nonce)
);
create table if not exists buklod_s2.opt_in (
  user_id uuid primary key references auth.users(id) on delete cascade,
  momentum_enrolled_at timestamptz,
  reading_daily_enrolled_at timestamptz,
  creator_daily_enrolled_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists buklod_s2.momentum_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  manila_day date not null,
  event_key text not null check(length(event_key) between 8 and 100),
  amount smallint not null check(amount between -9 and 5 and amount<>0),
  server_attestation_key text not null check(length(server_attestation_key)>=12),
  created_at timestamptz not null default now(),
  primary key(user_id,manila_day,event_key)
);
-- No direct member access, even after migration. Internal RPCs must use
-- explicit service credentials and never expose service keys on devices.
alter table buklod_s2.control enable row level security;
alter table buklod_s2.wallet enable row level security;
alter table buklod_s2.source_receipt enable row level security;
alter table buklod_s2.token_ledger enable row level security;
alter table buklod_s2.cosmetic_catalog enable row level security;
alter table buklod_s2.purchases enable row level security;
alter table buklod_s2.inventory enable row level security;
alter table buklod_s2.badge_grant enable row level security;
alter table buklod_s2.flex_allocation enable row level security;
alter table buklod_s2.weekly_claim enable row level security;
alter table buklod_s2.opt_in enable row level security;
alter table buklod_s2.momentum_ledger enable row level security;
revoke all on all tables in schema buklod_s2 from public,anon,authenticated;
revoke all on all sequences in schema buklod_s2 from public,anon,authenticated;
grant select,insert,update on all tables in schema buklod_s2 to service_role;
-- Even internal service credentials must NOT flip the production rollout switch.
revoke update on buklod_s2.control from service_role;
grant usage,select on all sequences in schema buklod_s2 to service_role;

-- Fail closed if ever accidentally installed. No silent crossover from S1.
create or replace function buklod_s2.assert_active()
returns buklod_s2.control language plpgsql security invoker set search_path=''
as $fn$
declare c buklod_s2.control;
begin
  select * into c from buklod_s2.control where only_row=true;
  if not found or not c.enabled or c.starts_at is null or c.ends_at is null
     or now()<c.starts_at or now()>c.ends_at then
    raise exception 'SEASON2_DISABLED' using errcode='55000';
  end if;
  -- READ-ONLY dependency check: never mutate the live Season1 history.
  if c.require_s1_reconciled and (
    exists(select 1 from public.buklod_rank_seasons
           where season_number=1 and status='active')
    or not exists(select 1 from public.buklod_rank_season_results r
      join public.buklod_rank_seasons s on s.id=r.season_id
      where s.season_number=1)
  ) then raise exception 'S1_AWAITING_SIGNED_RECONCILIATION' using errcode='55000';
  end if;
  -- A separate signed closeout/owner authorization still must be verified
  -- by the release gate; row existence alone is NOT a legal audit signature.
  return c;
end;
$fn$;
revoke all on function buklod_s2.assert_active() from public,anon,authenticated;
grant execute on function buklod_s2.assert_active() to service_role;

-- Actual source fetch. No event is accepted merely because a client reports it.
-- Only verified, substantive Main content is eligible. All feature-specific
-- qualification remains conservative until the staging schema/rules are proved.
create or replace function buklod_s2.verify_main_source(
  p_user uuid,p_kind text,p_source uuid
) returns table(source_at timestamptz,source_scope uuid,semantic_key text)
language plpgsql security invoker set search_path=''
as $fn$
declare v_at timestamptz;v_scope uuid;v_semantic text;
begin
 if p_user is null or p_source is null then
   raise exception 'INVALID_SOURCE' using errcode='22023';
 end if;
 -- Existing authoritative Official identity; no hardcoded user ID/email.
 if public.buklod_is_official_system_admin(p_user) then
   raise exception 'OFFICIAL_SYSTEM_ADMIN_EXCLUDED' using errcode='42501';
 end if;
 if p_kind='wall_original_post' then
   select p.created_at,p.scope_id,p.id::text
   into v_at,v_scope,v_semantic
   from public.community_posts p
   where p.id=p_source and p.user_id=p_user
     and p.deleted_at is null and not coalesce(p.is_hidden,false)
     and p.category not in ('announcement')
     and (length(trim(coalesce(p.body,'')))>=40 or
          (p.media_path is not null and length(p.media_path)>8))
     and not coalesce(p.author_only,false);
   -- Same body repeatedly reposted is not distinct meaningful contribution.
   if exists(
      select 1 from public.community_posts q
      where q.user_id=p_user and q.id<>p_source and q.deleted_at is null
        and q.created_at>v_at-interval '7 days' and q.created_at<v_at
        and length(trim(coalesce(q.body,'')))>0
        and lower(trim(q.body))=(select lower(trim(body))
                                  from public.community_posts where id=p_source)
   ) then v_at:=null; end if;
 elsif p_kind='wall_meaningful_comment' then
   select c.created_at,p.scope_id,p.id::text
   into v_at,v_scope,v_semantic
   from public.comments c join public.community_posts p on p.id=c.post_id
   where c.id=p_source and c.user_id=p_user and p.user_id<>p_user
     and c.deleted_at is null and not coalesce(c.is_hidden,false)
     and p.deleted_at is null and not coalesce(p.is_hidden,false)
     and length(trim(coalesce(c.body,'')))>=20;
   -- An account earns once per distinct thread/day, not every reply.
 elsif p_kind='today_dugtong' then
   select d.created_at,null::uuid,d.root_post_id::text
   into v_at,v_scope,v_semantic
   from public.buklod_community_dugtongs d
   where d.id=p_source and d.user_id=p_user and d.deleted_at is null
     and d.moderation_state='approved'
     and length(trim(coalesce(d.body,'')))>=20;
 elsif p_kind='kl_verified_chapter' then
   select a.verified_at,null::uuid,a.episode_id::text
   into v_at,v_scope,v_semantic
   from public.kl_quiz_attempts a
   join public.kl_reading_sessions s
     on s.user_id=a.user_id and s.episode_id=a.episode_id
   where a.id=p_source and a.user_id=p_user and a.verified_at is not null
     and s.completed_at is not null and s.completed_at<=a.verified_at;
 else raise exception 'SOURCE_NOT_IN_S2_ADAPTER' using errcode='22023';
 end if;
 if v_at is null or v_semantic is null then
    raise exception 'SOURCE_NOT_VERIFIED' using errcode='22023';
 end if;
 if v_scope is not null and not exists(
   select 1 from public.buklod_scope_memberships m
   where m.user_id=p_user and m.scope_id=v_scope
     and m.membership_status='ACTIVE'
     and m.joined_at<=v_at and (m.left_at is null or m.left_at>=v_at)
 ) then raise exception 'SCOPE_MEMBERSHIP_NOT_VERIFIED' using errcode='42501';
 end if;
 return query select v_at,v_scope,v_semantic;
end;
$fn$;
revoke all on function buklod_s2.verify_main_source(uuid,text,uuid)
 from public,anon,authenticated;
grant execute on function buklod_s2.verify_main_source(uuid,text,uuid)
 to service_role;

-- Serializable equivalent for an individual wallet: one account row lock
-- serializes all credits, caps, badges and purchases across devices/retries.
create or replace function buklod_s2.credit_main_source(
  p_user uuid,p_kind text,p_source uuid
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare
 c buklod_s2.control;
 v_at timestamptz;v_scope uuid;v_key text;
 v_day date;v_week date;v_cap smallint;v_rate smallint;
 v_day_total integer;v_kind_count integer;v_wallet bigint;
 v_id bigint;v_amount smallint;v_learn boolean;v_community boolean;
begin
 c:=buklod_s2.assert_active();
 -- Candidate common-source minting only; faith and nonfaith paths have
 -- identical token opportunity until real alternative education hooks exist.
 if p_kind not in ('today_dugtong','kl_verified_chapter',
                  'wall_original_post','wall_meaningful_comment') then
   raise exception 'SOURCE_DISABLED' using errcode='22023';
 end if;
 select source_at,source_scope,semantic_key into strict v_at,v_scope,v_key
 from buklod_s2.verify_main_source(p_user,p_kind,p_source);
 if v_at<c.starts_at or v_at>now() or v_at>c.ends_at then
   raise exception 'SOURCE_OUTSIDE_SEASON2' using errcode='22023';
 end if;
 v_day:=(v_at at time zone 'Asia/Manila')::date;
 v_week:=(c.starts_at at time zone 'Asia/Manila')::date
   + (floor((v_day-(c.starts_at at time zone 'Asia/Manila')::date)::numeric/7)::int*7);
 v_rate:=case p_kind when 'kl_verified_chapter' then 3
     when 'wall_meaningful_comment' then 1 else 2 end;
 v_cap:=case p_kind when 'wall_meaningful_comment' then 2 else 1 end;
 insert into buklod_s2.wallet(user_id) values(p_user)
 on conflict(user_id) do nothing;
 select w.balance into strict v_wallet
 from buklod_s2.wallet w where w.user_id=p_user for update;
 -- Lock acquired BEFORE duplicate, daily and same-thread checks.
 if exists(select 1 from buklod_s2.source_receipt r
   where r.user_id=p_user and r.source_kind=p_kind
     and r.source_id=p_source and r.rule_version=c.rule_version) then
   return jsonb_build_object('status','DUPLICATE','minted',0,'balance',v_wallet);
 end if;
 if p_kind='kl_verified_chapter' and exists(
    select 1 from buklod_s2.source_receipt r where r.user_id=p_user
    and r.source_kind=p_kind and r.semantic_key=v_key
 ) then return jsonb_build_object('status','CHAPTER_ALREADY_REWARDED','minted',0,'balance',v_wallet);
 end if;
 if p_kind='wall_meaningful_comment' and exists(
    select 1 from buklod_s2.source_receipt r where r.user_id=p_user
    and r.source_kind=p_kind and r.semantic_key=v_key and r.manila_day=v_day
 ) then return jsonb_build_object('status','THREAD_ALREADY_REWARDED','minted',0,'balance',v_wallet);
 end if;
 select count(*) into v_kind_count from buklod_s2.source_receipt r
   where r.user_id=p_user and r.source_kind=p_kind and r.manila_day=v_day;
 if v_kind_count>=v_cap then
   return jsonb_build_object('status','SOURCE_DAILY_CAP','minted',0,'balance',v_wallet);
 end if;
 select coalesce(sum(token_amount),0)::int into v_day_total
 from buklod_s2.source_receipt r where r.user_id=p_user and r.manila_day=v_day;
 v_amount:=least(v_rate,greatest(0,c.daily_token_cap-v_day_total));
 insert into buklod_s2.source_receipt(
   user_id,source_kind,source_id,semantic_key,source_at,manila_day,week_start,
   rule_version,token_amount)
 values(p_user,p_kind,p_source,v_key,v_at,v_day,v_week,c.rule_version,v_amount)
 returning id into v_id;
 if v_amount>0 then
   update buklod_s2.wallet
     set earned=earned+v_amount,balance=balance+v_amount,updated_at=now()
     where user_id=p_user;
   v_wallet:=v_wallet+v_amount;
   insert into buklod_s2.token_ledger(user_id,entry_key,direction,amount,
       balance_after,receipt_id)
   values(p_user,'source:'||c.rule_version||':'||v_id,'earn',v_amount,v_wallet,v_id);
 end if;
 -- P0 weekly foundation is claimed through a separate, evidence-bound
 -- step so a source cannot be counted in two weeks across grace/flex days.
 -- Minted tokens are separate from any Season 2 mission bonus.
 return jsonb_build_object('status',case when v_amount>0 then 'EARNED'
                         else 'DAILY_CAP' end,'minted',v_amount,
                         'balance',v_wallet,'week_start',v_week,
                         'receipt_id',v_id,'foundation_badge_eligible',false);
end;
$fn$;
revoke all on function buklod_s2.credit_main_source(uuid,text,uuid)
 from public,anon,authenticated;
grant execute on function buklod_s2.credit_main_source(uuid,text,uuid)
 to service_role;

-- Fixed-price nonessential cosmetics only. Does not sell level-gated
-- collectibles, existing Character inventory, badges, Shards, QMP or BP.
create or replace function buklod_s2.buy_cosmetic(
  p_user uuid,p_item text,p_nonce uuid
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare c buklod_s2.control;v_balance bigint;v_price smallint;
        v_item text;v_nonce uuid;
begin
 c:=buklod_s2.assert_active();
 if public.buklod_is_official_system_admin(p_user) then
   raise exception 'OFFICIAL_SYSTEM_ADMIN_EXCLUDED' using errcode='42501';
 end if;
 if p_user is null or p_nonce is null or p_item is null
 then raise exception 'INVALID_PURCHASE' using errcode='22023';end if;
 insert into buklod_s2.wallet(user_id) values(p_user)
 on conflict(user_id) do nothing;
 select balance into strict v_balance from buklod_s2.wallet
 where user_id=p_user for update;
 select item_key into v_item from buklod_s2.purchases
 where user_id=p_user and request_nonce=p_nonce;
 if found then
   if v_item<>p_item then raise exception 'NONCE_REUSED_FOR_OTHER_ITEM';end if;
   return jsonb_build_object('status','ALREADY_PURCHASED','balance',v_balance);
 end if;
 if exists(select 1 from buklod_s2.inventory
   where user_id=p_user and item_key=p_item) then
    return jsonb_build_object('status','ALREADY_OWNED','balance',v_balance);
 end if;
 select price into v_price from buklod_s2.cosmetic_catalog
 where item_key=p_item and enabled and nonessential and not is_paid_collectible;
 if v_price is null then raise exception 'ITEM_NOT_AVAILABLE' using errcode='22023';end if;
 if v_balance<v_price then
   return jsonb_build_object('status','INSUFFICIENT_TOKENS','balance',v_balance);
 end if;
 insert into buklod_s2.purchases(user_id,request_nonce,item_key,price)
 values(p_user,p_nonce,p_item,v_price);
 insert into buklod_s2.inventory(user_id,item_key)values(p_user,p_item);
 update buklod_s2.wallet set spent=spent+v_price,
   balance=balance-v_price,updated_at=now() where user_id=p_user;
 insert into buklod_s2.token_ledger(user_id,entry_key,direction,
   amount,balance_after)
 values(p_user,'purchase:'||p_nonce::text,'spend',-v_price,v_balance-v_price);
 return jsonb_build_object('status','PURCHASED','item_key',p_item,
    'balance',v_balance-v_price);
end;
$fn$;
revoke all on function buklod_s2.buy_cosmetic(uuid,text,uuid)
 from public,anon,authenticated;
grant execute on function buklod_s2.buy_cosmetic(uuid,text,uuid)
 to service_role;


-- Weekly P0 badge is never granted by a self-reported timer or client boolean.
-- The service may claim only a real reading/mastery + separate community source.
-- Grace = 3 days; flex = 0/7/14 opt-in days. Source receipts are globally
-- single-use across weekly claims. No BP, QMP, cash, Shards or permanent debits.
create or replace function buklod_s2.claim_weekly_foundation(
  p_user uuid,p_week date
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare c buklod_s2.control;v_flex int;v_end date;
  v_learning bigint;v_community bigint;v_claimed date;
begin
 c:=buklod_s2.assert_active();
 if public.buklod_is_official_system_admin(p_user) then
   raise exception 'OFFICIAL_SYSTEM_ADMIN_EXCLUDED' using errcode='42501';
 end if;
 if p_user is null or p_week is null
  or p_week<(c.starts_at at time zone 'Asia/Manila')::date
  or mod(p_week-(c.starts_at at time zone 'Asia/Manila')::date,7)<>0
  or p_week>(c.ends_at at time zone 'Asia/Manila')::date
 then raise exception 'INVALID_SEASON2_WEEK' using errcode='22023';end if;
 insert into buklod_s2.wallet(user_id) values(p_user)
 on conflict(user_id) do nothing;
 perform 1 from buklod_s2.wallet where user_id=p_user for update;
 if exists(select 1 from buklod_s2.weekly_claim
           where user_id=p_user and week_start=p_week) then
   return jsonb_build_object('status','ALREADY_CLAIMED','week_start',p_week);
 end if;
 select coalesce(sum(credit_count),0)::int into v_flex
   from buklod_s2.flex_allocation
   where user_id=p_user and week_start=p_week and
         opted_at<(p_week+7)::timestamp at time zone 'Asia/Manila';
 v_end:=p_week+6+3+least(v_flex,2)*7;
 v_claimed:=(now() at time zone 'Asia/Manila')::date;
 if v_claimed>v_end then
   return jsonb_build_object('status','EXPIRED_UNEARNED_BONUS',
       'week_start',p_week,'deadline',v_end);
 end if;
 -- Both receipts must be inside assigned week + valid late catch-up.
 -- Later attempts are checked against actual server source timestamp.
 select r.id into v_learning from buklod_s2.source_receipt r
 where r.user_id=p_user and r.source_kind='kl_verified_chapter'
   and r.source_at >= (p_week::timestamp at time zone 'Asia/Manila')
   and r.source_at < ((v_end+1)::timestamp at time zone 'Asia/Manila')
   and r.token_amount>0 and r.rule_version=c.rule_version
   and not exists(select 1 from buklod_s2.weekly_claim prior
     where prior.user_id=p_user and prior.learning_receipt_id=r.id)
 order by r.source_at limit 1;
 select r.id into v_community from buklod_s2.source_receipt r
 where r.user_id=p_user and r.source_kind in
   ('today_dugtong','wall_original_post','wall_meaningful_comment')
   and r.source_at >= (p_week::timestamp at time zone 'Asia/Manila')
   and r.source_at < ((v_end+1)::timestamp at time zone 'Asia/Manila')
   and r.token_amount>0 and r.rule_version=c.rule_version
   and not exists(select 1 from buklod_s2.weekly_claim prior
      where prior.user_id=p_user and prior.community_receipt_id=r.id)
 order by r.source_at limit 1;
 if v_learning is null or v_community is null then
   return jsonb_build_object('status','PENDING_FOUNDATION','week_start',p_week,
       'needs_learning',v_learning is null,
       'needs_community',v_community is null,'deadline',v_end);
 end if;
 insert into buklod_s2.weekly_claim(
   user_id,week_start,learning_receipt_id,community_receipt_id)
 values(p_user,p_week,v_learning,v_community);
 insert into buklod_s2.badge_grant(user_id,badge_key,week_start)
 values(p_user,'s2_weekly_foundation',p_week)
 on conflict(user_id,badge_key,week_start) do nothing;
 return jsonb_build_object('status','CLAIMED','week_start',p_week,
   'badge','s2_weekly_foundation','deadline',v_end,
   'spent_tokens',0,'bp_changed',false,'qmp_changed',false);
end;
$fn$;
revoke all on function buklod_s2.claim_weekly_foundation(uuid,date)
 from public,anon,authenticated;
grant execute on function buklod_s2.claim_weekly_foundation(uuid,date)
 to service_role;

-- Flex enrollment must happen before the normal deadline. Each credit is
-- seven days and only TWO credits per Season2, split or combined.
create or replace function buklod_s2.allocate_flex(
  p_user uuid,p_week date,p_credits smallint,p_nonce uuid
) returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare c buklod_s2.control;v_spent integer;v_existing smallint;
begin
 c:=buklod_s2.assert_active();
 if public.buklod_is_official_system_admin(p_user) then
   raise exception 'OFFICIAL_SYSTEM_ADMIN_EXCLUDED' using errcode='42501';
 end if;
 if p_user is null or p_nonce is null or p_week is null
 or p_credits not between 1 and 2 or p_week<(c.starts_at at time zone 'Asia/Manila')::date
 or mod((p_week-(c.starts_at at time zone 'Asia/Manila')::date),7)<>0
 then raise exception 'INVALID_FLEX_REQUEST' using errcode='22023';end if;
 if ((now() at time zone 'Asia/Manila')::date > p_week+6)
 then raise exception 'FLEX_MUST_BE_OPTED_IN_BEFORE_WEEK_END';end if;
 -- Wallet lock is the same per-user serialization root.
 insert into buklod_s2.wallet(user_id) values(p_user)
 on conflict(user_id) do nothing;
 perform 1 from buklod_s2.wallet where user_id=p_user for update;
 select credit_count into v_existing from buklod_s2.flex_allocation
 where user_id=p_user and week_start=p_week;
 if found then
   if exists(select 1 from buklod_s2.flex_allocation
     where user_id=p_user and week_start=p_week
       and request_nonce=p_nonce and credit_count=p_credits) then
      return jsonb_build_object('status','ALREADY_ALLOCATED','credits',v_existing);
   end if;
   raise exception 'WEEK_ALREADY_ALLOCATED';
 end if;
 select coalesce(sum(credit_count),0)::int into v_spent from
    buklod_s2.flex_allocation where user_id=p_user;
 if v_spent+p_credits>2 then raise exception 'FLEX_CREDITS_EXCEEDED';end if;
 insert into buklod_s2.flex_allocation(user_id,week_start,credit_count,request_nonce)
 values(p_user,p_week,p_credits,p_nonce);
 return jsonb_build_object('status','ALLOCATED','remaining',2-v_spent-p_credits);
end;
$fn$;
revoke all on function buklod_s2.allocate_flex(uuid,date,smallint,uuid)
 from public,anon,authenticated;
grant execute on function buklod_s2.allocate_flex(uuid,date,smallint,uuid)
 to service_role;

-- All tables explicitly deny to client roles (and no public facade exists).
-- Signed Season1 reconciliation, official Show Faith source parity, children/
-- prayer safeguards, anti-bot/Official exclusion and staging device checks
-- remain blockers. Migration MUST NOT be marked production ready.
commit;
