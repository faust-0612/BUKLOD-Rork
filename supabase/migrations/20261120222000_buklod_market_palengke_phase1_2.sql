-- BUKLOD Market / Palengke. Additive tables only; no existing social or economy mutations.
-- This migration is intentionally not applied to production by this DEV commit.
create table if not exists public.buklod_market_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  seller_type text not null default 'individual' check (seller_type in ('individual','business')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  barangay text not null default '' check (char_length(barangay) <= 90),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  province text not null default '' check (char_length(province) <= 100),
  is_open boolean not null default true,
  moderation_state text not null default 'approved'
    check (moderation_state in ('approved','suspended')),
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create unique index if not exists buklod_market_store_unique_name
  on public.buklod_market_stores(owner_id, lower(btrim(name)));
create index if not exists buklod_market_store_location
  on public.buklod_market_stores(lower(city), created_at desc)
  where moderation_state = 'approved' and is_open = true;

create table if not exists public.buklod_market_listings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  owner_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  kind text not null default 'product' check (kind in ('product','service')),
  category text not null default 'other'
    check (category in ('produce','food','fashion','home','electronics','service','other')),
  price_php numeric(12,2) not null check (price_php >= 0 and price_php <= 999999999),
  unit text not null default 'item' check (char_length(unit) between 1 and 30),
  image_path text,
  stock_status text not null default 'available'
    check (stock_status in ('available','sold_out')),
  publication_state text not null default 'draft'
    check (publication_state in ('draft','published')),
  moderation_state text not null default 'approved'
    check (moderation_state in ('approved','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (store_id,owner_id)
    references public.buklod_market_stores(id,owner_id) on delete cascade,
  check (image_path is null or (
    split_part(image_path,'/',1) = owner_id::text
    and image_path ~ '^[0-9a-f-]+/[0-9a-fA-F-]+-[0-9]+[.]jpg$'
  ))
);
create index if not exists buklod_market_listing_feed
  on public.buklod_market_listings(created_at desc, id desc)
  where publication_state = 'published' and moderation_state = 'approved';
create index if not exists buklod_market_listing_store
  on public.buklod_market_listings(store_id, created_at desc);

create table if not exists public.buklod_market_wall_shares (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  listing_id uuid not null references public.buklod_market_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists buklod_market_wall_share_seller_time
  on public.buklod_market_wall_shares(owner_id,created_at desc);
create index if not exists buklod_market_wall_share_listing
  on public.buklod_market_wall_shares(listing_id,created_at desc);

alter table public.buklod_market_stores enable row level security;
alter table public.buklod_market_listings enable row level security;
alter table public.buklod_market_wall_shares enable row level security;

revoke all on public.buklod_market_stores,public.buklod_market_listings,public.buklod_market_wall_shares from anon;
grant select,insert on public.buklod_market_stores to authenticated;
grant update(name,description,barangay,city,province,seller_type,is_open,updated_at)
  on public.buklod_market_stores to authenticated;
grant select,insert on public.buklod_market_listings to authenticated;
grant update(title,description,kind,category,price_php,unit,image_path,stock_status,publication_state,updated_at)
  on public.buklod_market_listings to authenticated;
grant select on public.buklod_market_wall_shares to authenticated;

create policy buklod_market_store_read on public.buklod_market_stores
  for select to authenticated
  using (owner_id = (select auth.uid()) or moderation_state='approved');
create policy buklod_market_store_insert on public.buklod_market_stores
  for insert to authenticated
  with check (owner_id = (select auth.uid())
    and verification_state='unverified' and moderation_state='approved');
create policy buklod_market_store_update on public.buklod_market_stores
  for update to authenticated
  using (owner_id = (select auth.uid()) and moderation_state='approved')
  with check (owner_id = (select auth.uid()) and moderation_state='approved');

create policy buklod_market_listing_read on public.buklod_market_listings
  for select to authenticated
  using (owner_id = (select auth.uid()) or (
    publication_state='published' and moderation_state='approved'
    and exists(select 1 from public.buklod_market_stores s
      where s.id=store_id and s.moderation_state='approved' and s.is_open)
  ));
create policy buklod_market_listing_insert on public.buklod_market_listings
  for insert to authenticated
  with check (owner_id=(select auth.uid()) and moderation_state='approved'
    and exists(select 1 from public.buklod_market_stores s
      where s.id=store_id and s.owner_id=(select auth.uid())
        and s.moderation_state='approved'));
create policy buklod_market_listing_update on public.buklod_market_listings
  for update to authenticated
  using (owner_id=(select auth.uid()) and moderation_state='approved')
  with check (owner_id=(select auth.uid()) and moderation_state='approved'
    and exists(select 1 from public.buklod_market_stores s
      where s.id=store_id and s.owner_id=(select auth.uid())
        and s.moderation_state='approved'));

create policy buklod_market_wall_share_read on public.buklod_market_wall_shares
  for select to authenticated
  using (owner_id=(select auth.uid()) or exists(
    select 1 from public.community_posts p
    where p.id=post_id and p.audience='public'
      and p.deleted_at is null and p.is_hidden=false));

-- The only Wall posting pathway for Market promos. Atomic: no orphaned links,
-- no bypass of the existing community-post validation/approval contract.
create or replace function public.buklod_market_share_wall_v1(p_listing_id uuid)
returns uuid language plpgsql security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_listing public.buklod_market_listings%rowtype;
  v_store public.buklod_market_stores%rowtype;
  v_post uuid;
  v_price text;
begin
  if v_actor is null then raise exception 'Sign in to share a product'; end if;
  -- Transaction-scoped advisory lock prevents simultaneous promotion-limit bypass.
  perform pg_advisory_xact_lock(hashtextextended('buklod_market_' || v_actor::text,0));
  select * into v_listing from public.buklod_market_listings
  where id=p_listing_id and owner_id=v_actor and publication_state='published'
    and moderation_state='approved' for update;
  if not found then raise exception 'Only an active listing owner can post'; end if;
  select * into v_store from public.buklod_market_stores
  where id=v_listing.store_id and owner_id=v_actor
    and moderation_state='approved' and is_open for share;
  if not found then raise exception 'Store is not available'; end if;
  if exists(select 1 from public.buklod_market_wall_shares
    where owner_id=v_actor and created_at > now()-interval '10 minutes') then
    raise exception 'Allow 10 minutes between Market promotions';
  end if;
  if (select count(*) from public.buklod_market_wall_shares
    where owner_id=v_actor and created_at > now()-interval '24 hours') >= 5 then
    raise exception 'Maximum five Market promotions in 24 hours';
  end if;
  v_price := '₱' || trim(to_char(v_listing.price_php,'FM999999999D00'));
  v_post := public.create_buklod_community_post_v3(
    p_audience => 'public',
    p_group_id => null,
    p_category => 'announcement',
    p_body => left('🛍️ ' || v_store.name || ': ' || v_listing.title
      || ' • ' || v_price || '/' || v_listing.unit || E'\n'
      || left(v_listing.description,260)
      || E'\n[BUKLOD_MARKET:' || v_listing.id::text || ']', 1800),
    p_media_path => null,
    p_media_mime_type => null,
    p_media_size_bytes => null,
    p_mentioned_user_ids => array[]::uuid[],
    p_media_duration_seconds => null,
    p_is_reel => false
  );
  insert into public.buklod_market_wall_shares(post_id,listing_id,owner_id)
  values (v_post,v_listing.id,v_actor);
  return v_post;
end;
$function$;
revoke all on function public.buklod_market_share_wall_v1(uuid) from public, anon;
grant execute on function public.buklod_market_share_wall_v1(uuid) to authenticated;

-- Public product photos only: no personal IDs/documents or private chat media.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-market-media','buklod-market-media',true,2097152,array['image/jpeg'])
on conflict (id) do update set
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy buklod_market_photo_insert on storage.objects
 for insert to authenticated
 with check(bucket_id='buklod-market-media'
   and (storage.foldername(name))[1]=(select auth.uid())::text
   and lower(storage.extension(name))='jpg');
create policy buklod_market_photo_delete on storage.objects
 for delete to authenticated
 using(bucket_id='buklod-market-media'
   and (storage.foldername(name))[1]=(select auth.uid())::text);
