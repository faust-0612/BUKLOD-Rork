-- BUKLOD WORLD EXCHANGE V1 — TEST-BACKEND CANDIDATE ONLY, NOT AN APPLIED MIGRATION.
-- Do not deploy to the live database. Test authentication, RLS, concurrent purchase,
-- source verification, and reconciliation first. No BP/QMP/earnings minting.
-- BP itself CANNOT be bought or sold as a listed item. Only server-verified
-- goods/materials may be exchanged *for* already-spendable BP. Every transfer
-- preserves global BP supply, individual earned lifetime BP and Circle Rank.
-- Canonical permanent Character/evolution collectibles are NEVER saleable receipts.
-- Private verified-source rows must originate from independent trusted adapters,
-- never from direct client-scored games, an upload, or a user-chosen item key.
begin;

-- Fail immediately when the existing available/lifetime BP authority differs.
do $$
begin
  if to_regclass('public.buklod_user_points_balances') is null
     or not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='buklod_user_points_balances'
        and column_name='available_points' and data_type='bigint')
     or not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='buklod_user_points_balances'
        and column_name='lifetime_points' and data_type='bigint')
  then raise exception 'BUKLOD point authority incompatible: stop migration'; end if;
end $$;

create table if not exists private.buklod_world_exchange_gate_v1 (
  singleton boolean primary key default true check (singleton),
  trading_enabled boolean not null default false,
  issuance_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.buklod_world_exchange_gate_v1 (singleton,trading_enabled,issuance_enabled)
values (true,false,false) on conflict (singleton)
  do update set trading_enabled=false,issuance_enabled=false,updated_at=now();

-- Immutable deploy-owned projection of the official Arena V2 armory (13 heroes × 5
-- slots); this does not create transferable ownership of story collectibles.
-- Keep this table in sync with src/lib/buklodCharacterWorldCatalog.ts and the
-- Arena V2 armory through reviewed source/asset-mapping tests, never user input.
create table if not exists private.buklod_world_tradeable_catalog_v1 (
  character_id text not null,
  slot text not null check (slot in ('weapon','shield','armor','boots','jewel')),
  asset_key text not null,
  required_character_level smallint not null check (required_character_level between 1 and 20),
  primary key (character_id,slot),
  unique (character_id,slot,asset_key)
);
insert into private.buklod_world_tradeable_catalog_v1
  (character_id,slot,asset_key,required_character_level)
values
  ('phan','weapon','phan:L01:I03',1),
  ('phan','shield','phan:L03:I03',3),
  ('phan','armor','phan:L07:I03',7),
  ('phan','boots','phan:L10:I03',10),
  ('phan','jewel','phan:L20:I03',20),
  ('quin','weapon','quin:L01:I03',1),
  ('quin','shield','quin:L03:I03',3),
  ('quin','armor','quin:L07:I03',7),
  ('quin','boots','quin:L10:I03',10),
  ('quin','jewel','quin:L20:I03',20),
  ('van','weapon','van:L01:I03',1),
  ('van','shield','van:L03:I03',3),
  ('van','armor','van:L07:I03',7),
  ('van','boots','van:L10:I03',10),
  ('van','jewel','van:L20:I03',20),
  ('christian','weapon','christian:L01:I03',1),
  ('christian','shield','christian:L03:I03',3),
  ('christian','armor','christian:L07:I03',7),
  ('christian','boots','christian:L10:I03',10),
  ('christian','jewel','christian:L20:I03',20),
  ('lhen','weapon','lhen:L01:I03',1),
  ('lhen','shield','lhen:L03:I03',3),
  ('lhen','armor','lhen:L07:I03',7),
  ('lhen','boots','lhen:L10:I03',10),
  ('lhen','jewel','lhen:L20:I03',20),
  ('ace','weapon','ace:L01:I03',1),
  ('ace','shield','ace:L03:I03',3),
  ('ace','armor','ace:L07:I03',7),
  ('ace','boots','ace:L10:I03',10),
  ('ace','jewel','ace:L20:I03',20),
  ('ellusur','weapon','ellusur:L01:I03',1),
  ('ellusur','shield','ellusur:L03:I03',3),
  ('ellusur','armor','ellusur:L07:I03',7),
  ('ellusur','boots','ellusur:L10:I03',10),
  ('ellusur','jewel','ellusur:L20:I03',20),
  ('jawo','weapon','jawo:L01:I03',1),
  ('jawo','shield','jawo:L03:I03',3),
  ('jawo','armor','jawo:L07:I03',7),
  ('jawo','boots','jawo:L10:I03',10),
  ('jawo','jewel','jawo:L20:I03',20),
  ('mitch','weapon','mitch:L01:I03',1),
  ('mitch','shield','mitch:L03:I03',3),
  ('mitch','armor','mitch:L07:I03',7),
  ('mitch','boots','mitch:L10:I03',10),
  ('mitch','jewel','mitch:L20:I03',20),
  ('niel','weapon','niel:L01:I03',1),
  ('niel','shield','niel:L03:I03',3),
  ('niel','armor','niel:L07:I03',7),
  ('niel','boots','niel:L10:I03',10),
  ('niel','jewel','niel:L20:I03',20),
  ('angel','weapon','angel:L01:I03',1),
  ('angel','shield','angel:L03:I03',3),
  ('angel','armor','angel:L07:I03',7),
  ('angel','boots','angel:L10:I03',10),
  ('angel','jewel','angel:L20:I03',20),
  ('vhen','weapon','vhen:L01:I03',1),
  ('vhen','shield','vhen:L03:I03',3),
  ('vhen','armor','vhen:L07:I03',7),
  ('vhen','boots','vhen:L10:I03',10),
  ('vhen','jewel','vhen:L20:I03',20),
  ('trudice','weapon','trudice:L01:I03',1),
  ('trudice','shield','trudice:L03:I03',3),
  ('trudice','armor','trudice:L07:I03',7),
  ('trudice','boots','trudice:L10:I03',10),
  ('trudice','jewel','trudice:L20:I03',20)
on conflict (character_id,slot) do nothing;
-- Never silently accept a stale/wrong 65-item catalog during schema re-apply.
do $$
begin
  if (select count(*) from private.buklod_world_tradeable_catalog_v1)<>65
     or exists (
       select 1 from private.buklod_world_tradeable_catalog_v1 c
       where c.asset_key <> c.character_id||':L'||lpad(
          (case c.slot when 'weapon' then 1 when 'shield' then 3
            when 'armor' then 7 when 'boots' then 10 when 'jewel' then 20 end)::text,2,'0')||':I03'
         or c.required_character_level <> (case c.slot
           when 'weapon' then 1 when 'shield' then 3 when 'armor' then 7
           when 'boots' then 10 when 'jewel' then 20 end)
     ) then raise exception 'Stale/corrupt BUKLOD canonical world item catalog'; end if;
end $$;

-- Only a server verifier can record a source after checking the REAL subsystem.
-- No client API can insert receipts or assert that Kingdom / Empire was completed.
create table if not exists private.buklod_world_verified_sources_v1 (
  source_key text primary key check (length(source_key) between 8 and 180),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  source_surface text not null check (source_surface in
    ('kingdom','empire','cluster','community','learning','wall','bayanihan')),
  source_object_key text not null check (length(source_object_key) between 4 and 180),
  kind text not null check (kind in ('gear','strategy','material')),
  asset_key text not null,
  character_id text,
  slot text,
  tier smallint not null default 1 check (tier between 1 and 4),
  material_quantity integer not null default 1 check (material_quantity between 1 and 100),
  tradable boolean not null default false,
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  item_id uuid unique,
  constraint world_source_unique_origin unique (source_surface,source_object_key),
  -- Exact 65-row canonical character/slot/asset relation, not an arbitrary
  -- syntactically valid Lxx/Ixx key. NULL columns bypass FK for materials only.
  constraint world_source_canonical_gear_v1 foreign key (character_id,slot,asset_key)
    references private.buklod_world_tradeable_catalog_v1(character_id,slot,asset_key),
  constraint world_source_identity check (
    (kind in ('gear','strategy') and character_id in
     ('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
     and slot in ('weapon','shield','armor','boots','jewel')
     and asset_key ~ '^(phan|quin|van|christian|lhen|ace|ellusur|jawo|mitch|niel|angel|vhen|trudice):L(0[1-9]|1[0-9]|20):I[1-5]$'
     and split_part(asset_key,':',1)=character_id)
    or (kind='material' and character_id is null and slot is null
        and asset_key in ('material:wood','material:gold','material:stone'))
  )
);

create table if not exists private.buklod_world_items_v1 (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique references private.buklod_world_verified_sources_v1(source_key),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('gear','strategy','material')),
  asset_key text not null,
  character_id text,
  slot text,
  tier smallint not null check (tier between 1 and 4),
  material_quantity integer not null default 1 check (material_quantity between 1 and 100),
  tradable boolean not null default false,
  status text not null default 'inventory' check (status in
    ('inventory','escrow','match_reserved','consumed','revoked')),
  match_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_item_match_status check (
    (status='match_reserved' and match_id is not null) or
    (status<>'match_reserved' and match_id is null))
);

create table if not exists private.buklod_world_offers_v1 (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references private.buklod_world_items_v1(id),
  seller_user_id uuid not null references auth.users(id),
  restricted_buyer_id uuid references auth.users(id),
  price_bp integer not null check (price_bp between 1 and 100000),
  client_request_id text not null check (length(client_request_id) between 8 and 120),
  status text not null default 'open' check (status in ('open','settled','cancelled','expired')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (seller_user_id,client_request_id),
  check (restricted_buyer_id is null or restricted_buyer_id<>seller_user_id)
);
create unique index if not exists buklod_world_one_open_offer_per_item_v1
  on private.buklod_world_offers_v1(item_id) where status='open';
create index if not exists buklod_world_offers_open_created_v1
  on private.buklod_world_offers_v1(created_at desc,id) where status='open';

-- Separate balance-to-balance ledger. NEVER insert these transfers into the
-- *reward* points_ledger: its credit/debit triggers can affect rank or rewards.
-- Trade audit is distinct from the earned-reward ledger. A seller's receive
-- is income of EXISTING BP only; no second lifetime BP credit is ever granted.
create table if not exists private.buklod_world_bp_transfers_v1 (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references private.buklod_world_offers_v1(id),
  item_id uuid not null references private.buklod_world_items_v1(id),
  buyer_user_id uuid not null references auth.users(id),
  seller_user_id uuid not null references auth.users(id),
  client_request_id text not null check (length(client_request_id) between 8 and 120),
  amount_bp integer not null check (amount_bp between 1 and 100000),
  settled_at timestamptz not null default now(),
  unique(buyer_user_id,client_request_id),
  check(buyer_user_id<>seller_user_id)
);
create index if not exists buklod_world_bp_transfer_buyer_created_v1
  on private.buklod_world_bp_transfers_v1(buyer_user_id,settled_at desc);
create index if not exists buklod_world_bp_transfer_seller_created_v1
  on private.buklod_world_bp_transfers_v1(seller_user_id,settled_at desc);

-- Defense in depth. Private tables cannot be read or changed directly by a user.
alter table private.buklod_world_tradeable_catalog_v1 enable row level security;
alter table private.buklod_world_exchange_gate_v1 enable row level security;
alter table private.buklod_world_verified_sources_v1 enable row level security;
alter table private.buklod_world_items_v1 enable row level security;
alter table private.buklod_world_offers_v1 enable row level security;
alter table private.buklod_world_bp_transfers_v1 enable row level security;
revoke all on private.buklod_world_tradeable_catalog_v1 from public,anon,authenticated;
revoke all on private.buklod_world_exchange_gate_v1 from public,anon,authenticated;
revoke all on private.buklod_world_verified_sources_v1 from public,anon,authenticated;
revoke all on private.buklod_world_items_v1 from public,anon,authenticated;
revoke all on private.buklod_world_offers_v1 from public,anon,authenticated;
revoke all on private.buklod_world_bp_transfers_v1 from public,anon,authenticated;

-- The independent verifier controls source ingestion. Service role is NEVER
-- used in client apps. Zero direct access for regular authenticated users.
-- The verifier can only INSERT immutable attestations. Revocation is a
-- separate audited RPC; no direct UPDATE of the ownership/provenance fields.
grant usage on schema private to service_role;
revoke all on private.buklod_world_verified_sources_v1 from service_role;
grant select,insert on private.buklod_world_verified_sources_v1 to service_role;

-- A service bug cannot rewrite a receipt actor, tier, asset, origin or proof.
-- After issuance an item pointer is permanent. Revocation is one-way.
create or replace function private.buklod_world_source_immutable_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    if new.item_id is not null or new.revoked_at is not null then
      raise exception 'Verified source cannot arrive pre-issued or revoked';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'revoked_at' - 'item_id')
       is distinct from (to_jsonb(old) - 'revoked_at' - 'item_id') then
    raise exception 'Verified source identity is immutable';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'Cannot undo source revocation';
  end if;
  if old.item_id is not null and new.item_id is distinct from old.item_id then
    raise exception 'Cannot rebind issued item';
  end if;
  return new;
end $$;
revoke all on function private.buklod_world_source_immutable_v1() from public,anon,authenticated;
drop trigger if exists trg_buklod_world_source_immutable_v1
  on private.buklod_world_verified_sources_v1;
create trigger trg_buklod_world_source_immutable_v1
before insert or update on private.buklod_world_verified_sources_v1
for each row execute function private.buklod_world_source_immutable_v1();

create or replace function private.buklod_world_issue_verified_item_v1(p_source_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v private.buklod_world_verified_sources_v1%rowtype; v_id uuid;
begin
  if not exists (select 1 from private.buklod_world_exchange_gate_v1
                 where singleton=true and issuance_enabled=true) then
    raise exception 'Verified world item issuance is disabled';
  end if;
  select * into v from private.buklod_world_verified_sources_v1
    where source_key=p_source_key for update;
  if not found or v.revoked_at is not null or v.verified_at>now() then
    raise exception 'No valid independent verified source';
  end if;
  if v.item_id is not null then return v.item_id; end if;
  insert into private.buklod_world_items_v1
    (source_key,owner_user_id,kind,asset_key,character_id,slot,tier,material_quantity,tradable)
  values (v.source_key,v.actor_user_id,v.kind,v.asset_key,v.character_id,v.slot,
          v.tier,v.material_quantity,v.tradable) returning id into v_id;
  update private.buklod_world_verified_sources_v1 set item_id=v_id
    where source_key=v.source_key;
  return v_id;
end $$;
revoke all on function private.buklod_world_issue_verified_item_v1(text) from public,anon,authenticated;
grant execute on function private.buklod_world_issue_verified_item_v1(text) to service_role;

-- Existing source revocation must quarantine an unlisted item before another
-- trade can be initiated. Settled items require audited dispute/recovery workflow.
create or replace function private.buklod_world_quarantine_item_v1(p_source_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_item private.buklod_world_items_v1%rowtype;
        v_item_id uuid; v_initial_id uuid;
begin
  -- Match the SAME item-scoped advisory lock taken by listing, purchase and
  -- cancellation before any row-level lock: no item/offer lock-order inversion.
  select id into v_initial_id from private.buklod_world_items_v1
    where source_key=p_source_key;
  if v_initial_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('buklod-world-item:'||v_initial_id::text,0));
  end if;
  update private.buklod_world_verified_sources_v1 set revoked_at=coalesce(revoked_at,now())
    where source_key=p_source_key;
  -- Issuance may have committed while we waited on the source row.
  select id into v_item_id from private.buklod_world_items_v1
    where source_key=p_source_key;
  if v_item_id is null then return false; end if;
  if v_initial_id is null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('buklod-world-item:'||v_item_id::text,0));
  end if;
  select * into v_item from private.buklod_world_items_v1
    where id=v_item_id for update;
  if not found then return false; end if;
  if v_item.status='escrow' then
    update private.buklod_world_offers_v1 set status='cancelled',closed_at=now()
      where item_id=v_item.id and status='open';
  end if;
  if v_item.status in ('inventory','escrow') then
    update private.buklod_world_items_v1 set status='revoked',updated_at=now()
      where id=v_item.id;
  end if;
  -- A match-reserved item must be revoked by trusted match arbitration; do not
  -- rewrite an active match state from another transaction.
  return true;
end $$;
revoke all on function private.buklod_world_quarantine_item_v1(text) from public,anon,authenticated;
grant execute on function private.buklod_world_quarantine_item_v1(text) to service_role;

create or replace function public.buklod_world_my_items_v1(p_limit integer default 40)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result
  from (select id,asset_key,kind,character_id,slot,tier,material_quantity,
        tradable,status,created_at from private.buklod_world_items_v1
        where owner_user_id=v_user order by created_at desc,id limit least(greatest(coalesce(p_limit,40),1),100)) q;
  return v_result;
end $$;

create or replace function public.buklod_world_browse_offers_v1(p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from private.buklod_world_exchange_gate_v1 where singleton=true and trading_enabled=true) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result
  from (select o.id as offer_id,o.price_bp,i.asset_key,i.character_id,i.slot,
               i.tier,i.kind,o.created_at
        from private.buklod_world_offers_v1 o
        join private.buklod_world_items_v1 i on i.id=o.item_id
        join private.buklod_world_verified_sources_v1 v on v.source_key=i.source_key
        where o.status='open' and i.status='escrow' and v.revoked_at is null
          and (o.restricted_buyer_id is null or o.restricted_buyer_id=v_user)
        order by o.created_at desc,o.id limit least(greatest(coalesce(p_limit,30),1),50)) q;
  return v_result;
end $$;

create or replace function public.buklod_world_exchange_status_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_enabled boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select trading_enabled into v_enabled from private.buklod_world_exchange_gate_v1
    where singleton=true;
  return jsonb_build_object('trading_enabled',coalesce(v_enabled,false),
    'source','BUKLOD verified world inventory','currency','spendable_bp_only');
end $$;

create or replace function public.buklod_world_list_item_v1(
  p_item_id uuid,p_price_bp integer,p_request_id text,p_restricted_buyer_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_offer private.buklod_world_offers_v1%rowtype;
        v_item private.buklod_world_items_v1%rowtype; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or length(p_request_id) not between 8 and 120 or
     p_price_bp is null or p_price_bp not between 1 and 100000 then
    raise exception 'Invalid listing request';
  end if;
  -- Distinct items can otherwise race past the active-offer cap. The lock is
  -- scoped to THIS seller and is released automatically on transaction end.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buklod-world-list:'||v_user::text,0));
  select * into v_offer from private.buklod_world_offers_v1
   where seller_user_id=v_user and client_request_id=p_request_id;
  if found then
    if v_offer.item_id<>p_item_id or v_offer.price_bp<>p_price_bp or
      v_offer.restricted_buyer_id is distinct from p_restricted_buyer_id then
      raise exception 'Idempotency key reused with different listing';
    end if;
    return v_offer.id;
  end if;
  if not exists(select 1 from private.buklod_world_exchange_gate_v1
      where singleton=true and trading_enabled=true) then raise exception 'World trading disabled'; end if;
  if p_restricted_buyer_id=v_user then raise exception 'Self trading forbidden'; end if;
  if not exists(select 1 from public.profiles where id=v_user and is_active=true
      and user_deactivated_at is null) then raise exception 'Inactive account'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buklod-world-item:'||p_item_id::text,0));
  select * into v_item from private.buklod_world_items_v1
     where id=p_item_id for update;
  -- A concurrent identical request may have committed while we waited for
  -- item custody. Return its one immutable listing instead of failing a retry.
  select * into v_offer from private.buklod_world_offers_v1
   where seller_user_id=v_user and client_request_id=p_request_id;
  if found then
    if v_offer.item_id<>p_item_id or v_offer.price_bp<>p_price_bp or
       v_offer.restricted_buyer_id is distinct from p_restricted_buyer_id then
      raise exception 'Idempotency key reused with different listing'; end if;
    return v_offer.id;
  end if;
  if v_item.id is null or v_item.owner_user_id<>v_user or v_item.status<>'inventory'
     or not v_item.tradable or not exists(select 1 from private.buklod_world_verified_sources_v1
           where source_key=v_item.source_key and revoked_at is null) then
    raise exception 'Item unavailable for this seller';
  end if;
  if (select count(*) from private.buklod_world_offers_v1 where seller_user_id=v_user
         and status='open')>=30 then raise exception 'Active offer limit reached'; end if;
  insert into private.buklod_world_offers_v1
    (item_id,seller_user_id,restricted_buyer_id,price_bp,client_request_id)
    values (p_item_id,v_user,p_restricted_buyer_id,p_price_bp,p_request_id)
    returning id into v_id;
  update private.buklod_world_items_v1 set status='escrow',updated_at=now() where id=p_item_id;
  return v_id;
end $$;

create or replace function public.buklod_world_buy_offer_v1(p_offer_id uuid,p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_buyer uuid := auth.uid(); v_offer private.buklod_world_offers_v1%rowtype;
        v_item private.buklod_world_items_v1%rowtype; v_prior private.buklod_world_bp_transfers_v1%rowtype;
        v_row_count integer; v_locked integer; v_seller_balance bigint;
        v_lock_item_id uuid;
begin
  if v_buyer is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or length(p_request_id) not between 8 and 120 then
    raise exception 'Invalid purchase request'; end if;
  -- Serialize the SAME buyer/request key even when concurrently sent against
  -- DIFFERENT offers. Never double-debit, and retries return one stable receipt.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buklod-world-purchase:'||v_buyer::text||':'||p_request_id,0));
  select * into v_prior from private.buklod_world_bp_transfers_v1
    where buyer_user_id=v_buyer and client_request_id=p_request_id;
  if found then
    if v_prior.offer_id<>p_offer_id then raise exception 'Conflicting purchase retry'; end if;
    return jsonb_build_object('transfer_id',v_prior.id,'offer_id',v_prior.offer_id,
       'item_id',v_prior.item_id,'amount_bp',v_prior.amount_bp,'status','settled');
  end if;
  if not exists(select 1 from private.buklod_world_exchange_gate_v1
      where singleton=true and trading_enabled=true) then raise exception 'World trading disabled'; end if;
  if not exists(select 1 from public.profiles where id=v_buyer and is_active=true
      and user_deactivated_at is null) then raise exception 'Inactive account'; end if;
  select item_id into v_lock_item_id from private.buklod_world_offers_v1
    where id=p_offer_id;
  if v_lock_item_id is null then raise exception 'Offer not available'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buklod-world-item:'||v_lock_item_id::text,0));
  select * into v_offer from private.buklod_world_offers_v1
    where id=p_offer_id for update;
  -- Verify the same-buyer request a second time AFTER obtaining the offer
  -- lock: a simultaneous identical buy may have committed while we waited.
  select * into v_prior from private.buklod_world_bp_transfers_v1
    where buyer_user_id=v_buyer and client_request_id=p_request_id;
  if found then
    if v_prior.offer_id<>p_offer_id then raise exception 'Conflicting purchase retry'; end if;
    return jsonb_build_object('transfer_id',v_prior.id,'offer_id',v_prior.offer_id,
       'item_id',v_prior.item_id,'amount_bp',v_prior.amount_bp,'status','settled');
  end if;
  if v_offer.id is null or v_offer.status<>'open' or v_offer.seller_user_id=v_buyer
       or (v_offer.restricted_buyer_id is not null and v_offer.restricted_buyer_id<>v_buyer)
  then raise exception 'Offer not available to this buyer'; end if;
  select * into v_item from private.buklod_world_items_v1 where id=v_offer.item_id for update;
  if not found or v_item.status<>'escrow' or v_item.owner_user_id<>v_offer.seller_user_id
      or not v_item.tradable or not exists(select 1 from private.buklod_world_verified_sources_v1
       where source_key=v_item.source_key and revoked_at is null) then
    raise exception 'Offer item invalid or revoked';
  end if;
  if not exists(select 1 from public.profiles where id=v_offer.seller_user_id
       and is_active=true and user_deactivated_at is null) then
     raise exception 'Seller unavailable'; end if;
  -- Canonical deterministic account lock order, not separate buyer/seller locks.
  select count(*) into v_locked from (
    select user_id from public.buklod_user_points_balances
    where user_id in (v_buyer,v_offer.seller_user_id)
    order by user_id for update) balances;
  if v_locked<>2 then raise exception 'Both canonical BP wallets must already exist'; end if;
  select available_points into v_seller_balance from public.buklod_user_points_balances
    where user_id=v_offer.seller_user_id;
  if v_seller_balance>9223372036854775807::bigint-v_offer.price_bp then
    raise exception 'Seller BP overflow'; end if;
  -- Debit only spendable available BP. The lifetime points source remains intact.
  update public.buklod_user_points_balances
    set available_points=available_points-v_offer.price_bp,updated_at=now()
    where user_id=v_buyer and available_points>=v_offer.price_bp;
  get diagnostics v_row_count=row_count;
  if v_row_count<>1 then raise exception 'Insufficient spendable BP'; end if;
  update public.buklod_user_points_balances
    set available_points=available_points+v_offer.price_bp,updated_at=now()
    where user_id=v_offer.seller_user_id;
  get diagnostics v_row_count=row_count;
  if v_row_count<>1 then raise exception 'Seller BP wallet missing'; end if;
  update private.buklod_world_items_v1 set owner_user_id=v_buyer,status='inventory',updated_at=now()
    where id=v_item.id;
  update private.buklod_world_offers_v1 set status='settled',closed_at=now() where id=v_offer.id;
  insert into private.buklod_world_bp_transfers_v1
    (offer_id,item_id,buyer_user_id,seller_user_id,client_request_id,amount_bp)
    values (v_offer.id,v_item.id,v_buyer,v_offer.seller_user_id,p_request_id,v_offer.price_bp)
    returning * into v_prior;
  return jsonb_build_object('transfer_id',v_prior.id,'offer_id',v_offer.id,
    'item_id',v_item.id,'amount_bp',v_offer.price_bp,'status','settled');
end $$;

create or replace function public.buklod_world_cancel_offer_v1(p_offer_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_offer private.buklod_world_offers_v1%rowtype;
        v_item private.buklod_world_items_v1%rowtype;
        v_lock_item_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select item_id into v_lock_item_id from private.buklod_world_offers_v1
    where id=p_offer_id;
  if v_lock_item_id is null then raise exception 'Not your offer'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('buklod-world-item:'||v_lock_item_id::text,0));
  select * into v_offer from private.buklod_world_offers_v1
    where id=p_offer_id for update;
  if not found or v_offer.seller_user_id<>v_user then raise exception 'Not your offer'; end if;
  if v_offer.status='cancelled' then return true; end if;
  if v_offer.status<>'open' then raise exception 'Settled/expired offer cannot be cancelled'; end if;
  select * into v_item from private.buklod_world_items_v1 where id=v_offer.item_id for update;
  if not found or v_item.status<>'escrow' or v_item.owner_user_id<>v_user then
    raise exception 'Escrow inconsistency'; end if;
  update private.buklod_world_offers_v1 set status='cancelled',closed_at=now() where id=v_offer.id;
  update private.buklod_world_items_v1 set status='inventory',updated_at=now() where id=v_item.id;
  return true;
end $$;

-- Canonical read/action APIs are callable only by signed-in accounts.
revoke all on function public.buklod_world_exchange_status_v1() from public,anon;
revoke all on function public.buklod_world_my_items_v1(integer) from public,anon;
revoke all on function public.buklod_world_browse_offers_v1(integer) from public,anon;
revoke all on function public.buklod_world_list_item_v1(uuid,integer,text,uuid) from public,anon;
revoke all on function public.buklod_world_buy_offer_v1(uuid,text) from public,anon;
revoke all on function public.buklod_world_cancel_offer_v1(uuid) from public,anon;
grant execute on function public.buklod_world_exchange_status_v1() to authenticated;
grant execute on function public.buklod_world_my_items_v1(integer) to authenticated;
grant execute on function public.buklod_world_browse_offers_v1(integer) to authenticated;
grant execute on function public.buklod_world_list_item_v1(uuid,integer,text,uuid) to authenticated;
grant execute on function public.buklod_world_buy_offer_v1(uuid,text) to authenticated;
grant execute on function public.buklod_world_cancel_offer_v1(uuid) to authenticated;

commit;