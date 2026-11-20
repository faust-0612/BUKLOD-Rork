-- BUKLOD permanent virtual trading economy (DEV). Nothing activates by migration.
-- Isolated from QMP, PHP, Bayanihan cash and existing reward-mint functions.
create table if not exists public.buklod_trade_config (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null default false,
 rank_profit_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.buklod_trade_config(singleton) values (true) on conflict do nothing;

create table if not exists public.buklod_trade_items (
 code text primary key check (code ~ '^[a-z_]{3,32}$'),
 title text not null,
 max_unit_price integer not null check(max_unit_price between 1 and 10000),
 active boolean not null default true
);
insert into public.buklod_trade_items(code,title,max_unit_price) values
 ('wood','Timber / Wood',200),('stone','Stone',200),
 ('nails','Fasteners',150),('metal','Metal Parts',300),
 ('glass','Glass Panels',300),('fabric','Fabric / Finishes',200)
on conflict(code) do nothing;

create table if not exists public.buklod_trade_inventory (
 user_id uuid not null references public.profiles(id),
 item_code text not null references public.buklod_trade_items(code),
 quantity bigint not null default 0 check(quantity>=0),
 cost_basis_bp bigint not null default 0 check(cost_basis_bp>=0),
 primary key(user_id,item_code)
);
create table if not exists public.buklod_trade_participation_claims (
 source_ledger_id uuid primary key references public.buklod_points_ledger(id),
 user_id uuid not null references public.profiles(id),
 item_code text not null references public.buklod_trade_items(code),
 quantity integer not null check(quantity between 1 and 10),
 created_at timestamptz not null default now()
);
create table if not exists public.buklod_trade_businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references public.profiles(id),
 title text not null check(char_length(title) between 3 and 70),
 category text not null check(char_length(category) between 3 and 50),
 level integer not null default 1 check(level between 1 and 10),
 construction_stage integer not null default 0 check(construction_stage between 0 and 5),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.buklod_trade_build_requirements (
 level integer not null check(level between 1 and 10),
 stage integer not null check(stage between 1 and 5),
 item_code text not null references public.buklod_trade_items(code),
 quantity integer not null check(quantity between 1 and 100000),
 bp_cost integer not null default 0 check(bp_cost>=0),
 primary key(level,stage,item_code)
);
-- Stages 1..5 in every level: posts, frame, walls, roof, finishes.
-- Requirements increase ~1.65x every level; L1 cannot start as a finished building.
insert into public.buklod_trade_build_requirements(level,stage,item_code,quantity,bp_cost)
select l,s,'wood',
 ceil((case s when 1 then 2 when 2 then 3 when 3 then 1 when 4 then 2 else 1 end)*power(1.65,l-1))::integer,
 ceil((s+1)*2*power(1.65,l-1))::integer
from generate_series(1,10) l cross join generate_series(1,5) s
on conflict do nothing;
insert into public.buklod_trade_build_requirements(level,stage,item_code,quantity,bp_cost)
select l,s,case when s in (1,3) then 'stone' when s in (2,4) then 'nails' when l>=6 then 'metal' else 'fabric' end,
 ceil((case when s=5 then 1 else 2 end)*power(1.65,l-1))::integer,0
from generate_series(1,10) l cross join generate_series(1,5) s
on conflict do nothing;
insert into public.buklod_trade_build_requirements(level,stage,item_code,quantity,bp_cost)
select l,5,'glass',ceil(power(1.65,l-1))::integer,0
from generate_series(3,10) l
on conflict do nothing;
create table if not exists public.buklod_trade_build_history (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.buklod_trade_businesses(id),
 owner_id uuid not null references public.profiles(id),
 level integer not null,
 stage integer not null,
 bp_spent integer not null check(bp_spent>=0),
 created_at timestamptz not null default now(),
 unique(business_id,level,stage)
);
create table if not exists public.buklod_trade_listings (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.buklod_trade_businesses(id),
 seller_id uuid not null references public.profiles(id),
 item_code text not null references public.buklod_trade_items(code),
 quantity_remaining bigint not null check(quantity_remaining>=0),
 cost_basis_remaining bigint not null default 0 check(cost_basis_remaining>=0),
 unit_price_bp integer not null check(unit_price_bp>0),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','SOLD_OUT','CANCELLED')),
 created_at timestamptz not null default now()
);
create index if not exists buklod_trade_listings_active_idx on public.buklod_trade_listings(created_at desc)
 where status='ACTIVE' and quantity_remaining>0;
create table if not exists public.buklod_trade_orders (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.buklod_trade_listings(id),
 buyer_id uuid not null references public.profiles(id),
 seller_id uuid not null references public.profiles(id),
 item_code text not null references public.buklod_trade_items(code),
 quantity integer not null check(quantity between 1 and 100),
 total_bp integer not null check(total_bp>0),
 cost_basis_bp integer not null check(cost_basis_bp>=0),
 gross_profit_bp integer not null check(gross_profit_bp>=0),
 rank_state text not null default 'PENDING' check(rank_state in ('PENDING','QUALIFIED','EXCLUDED','REVIEW')),
 rank_credit_bp integer not null default 0 check(rank_credit_bp>=0),
 buyer_request_key text not null check(char_length(buyer_request_key) between 8 and 100),
 buyer_ledger_id uuid unique references public.buklod_points_ledger(id),
 rank_ledger_id uuid unique references public.buklod_points_ledger(id),
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 unique(buyer_id,buyer_request_key),
 check(buyer_id<>seller_id)
);
-- Separate receipt for transferred BP: existing reward ledger restricts claim_state
-- to legacy/pending/claimed and has a unique (user_id,source_key) constraint.
-- Transfer does not count as an earned or claimable reward.
create table if not exists public.buklod_trade_bp_transfers (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.buklod_trade_orders(id),
 buyer_id uuid not null references public.profiles(id),
 seller_id uuid not null references public.profiles(id),
 amount_bp integer not null check(amount_bp>0),
 created_at timestamptz not null default now(),
 check(buyer_id<>seller_id)
);
create index if not exists buklod_trade_orders_seller_idx on public.buklod_trade_orders(seller_id,created_at desc);
create index if not exists buklod_trade_orders_buyer_idx on public.buklod_trade_orders(buyer_id,created_at desc);

alter table public.buklod_trade_config enable row level security;
alter table public.buklod_trade_items enable row level security;
alter table public.buklod_trade_inventory enable row level security;
alter table public.buklod_trade_participation_claims enable row level security;
alter table public.buklod_trade_businesses enable row level security;
alter table public.buklod_trade_build_requirements enable row level security;
alter table public.buklod_trade_build_history enable row level security;
alter table public.buklod_trade_listings enable row level security;
alter table public.buklod_trade_orders enable row level security;
alter table public.buklod_trade_bp_transfers enable row level security;
-- No direct table access for clients; RPCs enforce identity and transaction rules.
revoke all on public.buklod_trade_config,public.buklod_trade_items,
 public.buklod_trade_inventory,public.buklod_trade_participation_claims,
 public.buklod_trade_businesses,public.buklod_trade_build_requirements,
 public.buklod_trade_build_history,public.buklod_trade_listings,
 public.buklod_trade_orders, public.buklod_trade_bp_transfers from public,anon,authenticated;

create or replace function public.buklod_trade_snapshot_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_enabled boolean; v_rank boolean;
begin
 if v_uid is null then raise exception 'Login required' using errcode='28000'; end if;
 select enabled,rank_profit_enabled into v_enabled,v_rank from public.buklod_trade_config where singleton;
 return jsonb_build_object(
  'enabled',coalesce(v_enabled,false),'rank_profit_enabled',coalesce(v_rank,false),
  'available_bp',public.buklod_available_points_for(v_uid),
  'business',(select to_jsonb(b) from public.buklod_trade_businesses b where b.owner_id=v_uid),
  'inventory',(select coalesce(jsonb_agg(jsonb_build_object('code',i.item_code,'quantity',i.quantity,'cost_basis_bp',i.cost_basis_bp)),'[]'::jsonb)
               from public.buklod_trade_inventory i where i.user_id=v_uid and i.quantity>0),
  'items',(select coalesce(jsonb_agg(jsonb_build_object('code',i.code,'title',i.title,'max_unit_price',i.max_unit_price) order by i.code),'[]'::jsonb)
           from public.buklod_trade_items i where i.active),
  'listings',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'business',b.title,'item_code',l.item_code,'quantity',l.quantity_remaining,'unit_price_bp',l.unit_price_bp,'is_mine',l.seller_id=v_uid) order by l.created_at desc),'[]'::jsonb)
              from (select * from public.buklod_trade_listings where status='ACTIVE' and quantity_remaining>0 order by created_at desc limit 100) l
              join public.buklod_trade_businesses b on b.id=l.business_id),
  'requirements',(select coalesce(jsonb_agg(jsonb_build_object('level',r.level,'stage',r.stage,'item_code',r.item_code,'quantity',r.quantity,'bp_cost',r.bp_cost) order by r.level,r.stage,r.item_code),'[]'::jsonb)
                  from public.buklod_trade_build_requirements r),
  'recent_orders',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'total_bp',o.total_bp,'quantity',o.quantity,'item_code',o.item_code,'role',case when o.seller_id=v_uid then 'seller' else 'buyer' end,'rank_state',o.rank_state,'rank_credit_bp',o.rank_credit_bp,'created_at',o.created_at) order by o.created_at desc),'[]'::jsonb)
                  from (select * from public.buklod_trade_orders where buyer_id=v_uid or seller_id=v_uid order by created_at desc limit 30) o)
 );
end $$;
revoke all on function public.buklod_trade_snapshot_v1() from public,anon;
grant execute on function public.buklod_trade_snapshot_v1() to authenticated;

-- A resource may be claimed ONCE from each already-verified canonical participation
-- ledger credit. Item grants do not mint BP or alter QMP and are available with faith off.
create or replace function public.buklod_trade_claim_participation_item_v1(p_ledger_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_event public.buklod_points_ledger%rowtype;
 v_item text; v_qty integer; v_inserted uuid;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.buklod_trade_config where enabled) then raise exception 'Trading is not enabled yet'; end if;
 select * into v_event from public.buklod_points_ledger
 where id=p_ledger_id and user_id=v_uid and direction='credit'
   and claim_state in ('claimed','legacy') and points>0
   and activity_type in ('community_post','community_comment','community_reaction',
   'event_attendance','verified_volunteer_service','formation_lesson','mentor_session',
   'daily_bible','devotional','kl_episode','kl_season','weekly_consistency')
 for share;
 if not found then raise exception 'Verified participation record required'; end if;
 v_item:=case
  when v_event.activity_type in ('community_post','daily_bible','kl_episode') then 'wood'
  when v_event.activity_type in ('community_comment','devotional','weekly_consistency') then 'nails'
  when v_event.activity_type in ('community_reaction','formation_lesson') then 'stone'
  when v_event.activity_type='kl_season' then 'glass'
  when v_event.activity_type='verified_volunteer_service' then 'metal'
  else 'fabric' end;
 v_qty:=case when v_event.activity_type in ('verified_volunteer_service','kl_season') then 2 else 1 end;
 insert into public.buklod_trade_participation_claims(source_ledger_id,user_id,item_code,quantity)
 values(p_ledger_id,v_uid,v_item,v_qty)
 on conflict(source_ledger_id) do nothing returning source_ledger_id into v_inserted;
 if v_inserted is null then return jsonb_build_object('already_claimed',true,'item_code',v_item); end if;
 insert into public.buklod_trade_inventory(user_id,item_code,quantity,cost_basis_bp)
 values(v_uid,v_item,v_qty,0)
 on conflict(user_id,item_code) do update
 set quantity=public.buklod_trade_inventory.quantity+excluded.quantity;
 return jsonb_build_object('already_claimed',false,'item_code',v_item,'quantity',v_qty);
end $$;
revoke all on function public.buklod_trade_claim_participation_item_v1(uuid) from public,anon;
grant execute on function public.buklod_trade_claim_participation_item_v1(uuid) to authenticated;

create or replace function public.buklod_trade_register_business_v1(p_title text,p_category text,p_orientation_ack boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_count bigint; v_id uuid;
begin
 if v_uid is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.buklod_trade_config where enabled) then raise exception 'Trading is not enabled yet'; end if;
 if p_orientation_ack is distinct from true then raise exception 'Complete business orientation first'; end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 70 or length(trim(coalesce(p_category,''))) not between 3 and 50 then
   raise exception 'Valid business name and category required'; end if;
 perform 1 from public.profiles where id=v_uid and is_active=true for update;
 if not found or private.buklod_is_platform_official_v1(v_uid) then raise exception 'Active member required'; end if;
 select count(distinct id) into v_count from public.buklod_points_ledger
 where user_id=v_uid and direction='credit' and claim_state in ('claimed','legacy')
   and activity_type in ('community_post','community_comment','community_reaction',
   'event_attendance','verified_volunteer_service','formation_lesson','mentor_session',
   'daily_bible','devotional','kl_episode','kl_season','weekly_consistency');
 if v_count<5 then raise exception 'Five verified participation activities are required'; end if;
 if public.buklod_available_points_for(v_uid)<40 then raise exception 'At least 40 spendable BP in starter capital required'; end if;
 insert into public.buklod_trade_businesses(owner_id,title,category)
 values(v_uid,trim(p_title),trim(p_category)) returning id into v_id;
 return jsonb_build_object('business_id',v_id,'level',1,'stage',0);
end $$;
revoke all on function public.buklod_trade_register_business_v1(text,text,boolean) from public,anon;
grant execute on function public.buklod_trade_register_business_v1(text,text,boolean) to authenticated;

-- Paginated, user-scoped unclaimed sources; claiming a batch exposes the next
-- unclaimed events rather than permanently hiding older participation records.
create or replace function public.buklod_trade_unclaimed_sources_v1(p_limit integer default 30)
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'activity_type',x.activity_type,
  'points',x.points,'created_at',x.created_at) order by x.created_at desc),'[]'::jsonb)
 from (
  select l.id,l.activity_type,l.points,l.created_at from public.buklod_points_ledger l
  left join public.buklod_trade_participation_claims c on c.source_ledger_id=l.id
  where l.user_id=auth.uid() and l.direction='credit'
    and l.claim_state in ('claimed','legacy') and l.points>0
    and c.source_ledger_id is null
    and l.activity_type in ('community_post','community_comment','community_reaction',
      'event_attendance','verified_volunteer_service','formation_lesson','mentor_session',
      'daily_bible','devotional','kl_episode','kl_season','weekly_consistency')
  order by l.created_at desc limit greatest(1,least(coalesce(p_limit,30),100))
 ) x;
$$;
revoke all on function public.buklod_trade_unclaimed_sources_v1(integer) from public,anon;
grant execute on function public.buklod_trade_unclaimed_sources_v1(integer) to authenticated;
