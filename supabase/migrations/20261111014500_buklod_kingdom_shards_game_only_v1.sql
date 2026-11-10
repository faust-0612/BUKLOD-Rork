-- BUKLOD Main Kingdom Shards V1: game-only, noncash permanent upgrades.
-- SAFE RELEASE HOLD: apply only after separate DB migration/RLS review and frozen RC.
-- Sources are existing verified, server-owned mastery ledger/attempts and redeemed
-- character collectibles. No client result, score, request amount, or paid AI.
-- Repeat syncs and purchases are idempotent under one wallet row lock.
create table if not exists private.buklod_kingdom_shards_wallet_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  earned integer not null default 0 check (earned >= 0),
  spent integer not null default 0 check (spent >= 0),
  updated_at timestamptz not null default now(),
  constraint buklod_kingdom_shards_balance_match_v1 check (earned - spent = balance)
);
create table if not exists private.buklod_kingdom_shards_ledger_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (length(source_key) between 6 and 180),
  amount integer not null check (amount between -100 and 10 and amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, source_key)
);
create table if not exists private.buklod_kingdom_items_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null check (item_key in
    ('wisdom_lens', 'guardian_shield', 'explorer_compass', 'aura_emerald')),
  paid_shards integer not null check (paid_shards in (2,3,10)),
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
create index if not exists buklod_kingdom_shards_user_recent_v1
  on private.buklod_kingdom_shards_ledger_v1 (user_id, created_at desc);
alter table private.buklod_kingdom_shards_wallet_v1 enable row level security;
alter table private.buklod_kingdom_shards_ledger_v1 enable row level security;
alter table private.buklod_kingdom_items_v1 enable row level security;
revoke all on private.buklod_kingdom_shards_wallet_v1 from public,anon,authenticated;
revoke all on private.buklod_kingdom_shards_ledger_v1 from public,anon,authenticated;
revoke all on private.buklod_kingdom_items_v1 from public,anon,authenticated;

-- Only called by the authenticated, uid-checked public façade functions.
-- Source records already exist in BUKLOD: no retroactive unverified gameplay grants.
create or replace function private.buklod_kingdom_sync_shards_v1(p_uid uuid)
returns void language plpgsql security invoker set search_path=''
as $function$
declare
 v_balance integer;
 v_source record;
 v_inserted text;
begin
 if p_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 insert into private.buklod_kingdom_shards_wallet_v1(user_id)
 values (p_uid) on conflict (user_id) do nothing;
 select balance into strict v_balance
 from private.buklod_kingdom_shards_wallet_v1
 where user_id=p_uid for update;

 -- Only server-verified first mastery attempts WITH an official, immutable BP
 -- award source. A locally self-reported game clear can never qualify.
 for v_source in
  select source_key, reward from (
    select distinct ('mastery:'||a.game_id)::text as source_key, 1::integer as reward
      from private.buklod_kingdom_mastery_attempts_v1 a
      where a.user_id=p_uid and a.status='credited'
        and exists (
          select 1 from public.buklod_points_ledger l
          where l.user_id=p_uid and l.direction='credit'
            and l.activity_type='game_first_qualified' and l.points=2
            and l.source_key='kingdom:mastery:v1:'||a.game_id
        )
    union all
    select ('badge:'||c.collectible_id)::text as source_key, 2::integer as reward
      from public.buklod_character_collectible_state c
      where c.user_id=p_uid and c.redeemed_at is not null
  ) verified_sources order by source_key
 loop
  v_inserted:=null;
  insert into private.buklod_kingdom_shards_ledger_v1(
    user_id,source_key,amount,balance_after)
  values(p_uid,v_source.source_key,v_source.reward,v_balance+v_source.reward)
  on conflict (user_id,source_key) do nothing
  returning source_key into v_inserted;
  if v_inserted is not null then
    update private.buklod_kingdom_shards_wallet_v1
    set balance=balance+v_source.reward,
        earned=earned+v_source.reward, updated_at=now()
    where user_id=p_uid;
    v_balance:=v_balance+v_source.reward;
  end if;
 end loop;
end;
$function$;
revoke all on function private.buklod_kingdom_sync_shards_v1(uuid)
 from public,anon,authenticated;

create or replace function public.get_my_buklod_kingdom_shards_v1()
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_wallet private.buklod_kingdom_shards_wallet_v1%rowtype;
 v_owned jsonb;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 perform private.buklod_kingdom_sync_shards_v1(v_uid);
 select * into strict v_wallet from private.buklod_kingdom_shards_wallet_v1
 where user_id=v_uid;
 select coalesce(jsonb_agg(i.item_key order by i.item_key),'[]'::jsonb)
 into v_owned from private.buklod_kingdom_items_v1 i where i.user_id=v_uid;
 return jsonb_build_object('ok',true,'balance',v_wallet.balance,
    'earned',v_wallet.earned,'spent',v_wallet.spent,
    'owned_items',v_owned,'game_only',true,'version',1);
end;
$function$;
revoke all on function public.get_my_buklod_kingdom_shards_v1()
 from public,anon,authenticated;
grant execute on function public.get_my_buklod_kingdom_shards_v1() to authenticated;

create or replace function public.buy_my_buklod_kingdom_item_v1(p_item_key text)
returns jsonb language plpgsql volatile security definer set search_path=''
as $function$
declare
 v_uid uuid := (select auth.uid());
 v_item text := lower(btrim(coalesce(p_item_key,'')));
 v_price integer;
 v_balance integer;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 -- Pricing and eligibility come ONLY from the server. No user-specified price.
 v_price := case v_item
   when 'wisdom_lens' then 2
   when 'guardian_shield' then 3
   when 'explorer_compass' then 2
   when 'aura_emerald' then 10
   else null
 end;
 if v_price is null then raise exception 'Unknown Kingdom item'; end if;
 perform private.buklod_kingdom_sync_shards_v1(v_uid);
 select balance into strict v_balance
 from private.buklod_kingdom_shards_wallet_v1 where user_id=v_uid for update;
 -- The same locked wallet serializes purchases from multiple devices.
 if exists(select 1 from private.buklod_kingdom_items_v1
           where user_id=v_uid and item_key=v_item) then
   return public.get_my_buklod_kingdom_shards_v1() ||
     jsonb_build_object('purchased',false,'already_owned',true);
 end if;
 if v_balance < v_price then
   return jsonb_build_object('ok',false,'reason','insufficient_shards',
     'balance',v_balance,'required',v_price,'game_only',true);
 end if;
 insert into private.buklod_kingdom_items_v1(user_id,item_key,paid_shards)
 values (v_uid,v_item,v_price);
 update private.buklod_kingdom_shards_wallet_v1
 set balance=balance-v_price, spent=spent+v_price,updated_at=now()
 where user_id=v_uid;
 insert into private.buklod_kingdom_shards_ledger_v1(
   user_id,source_key,amount,balance_after)
 values(v_uid,'buy:'||v_item,-v_price,v_balance-v_price);
 return public.get_my_buklod_kingdom_shards_v1() ||
   jsonb_build_object('purchased',true,'item_key',v_item);
end;
$function$;
revoke all on function public.buy_my_buklod_kingdom_item_v1(text)
 from public,anon,authenticated;
grant execute on function public.buy_my_buklod_kingdom_item_v1(text) to authenticated;

comment on function public.buy_my_buklod_kingdom_item_v1(text) is
 'BUKLOD Kingdom noncash permanent equipment. Auth-owned, fixed-price, one-time and atomic; never touches BP, QMP, AdMob or withdrawable earnings.';
