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

-- Non-payment reservation requests. Buyer/seller visibility only, no checkout or payout.
create table if not exists public.buklod_market_reservations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.buklod_market_listings(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  quantity integer not null check (quantity between 1 and 100),
  note text not null default '' check (char_length(note) <= 600),
  status text not null default 'requested'
    check (status in ('requested','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique(buyer_id, request_key)
);
create index if not exists buklod_market_reservation_buyer
  on public.buklod_market_reservations(buyer_id,created_at desc);
create index if not exists buklod_market_reservation_seller
  on public.buklod_market_reservations(seller_id,created_at desc);
alter table public.buklod_market_reservations enable row level security;
revoke all on public.buklod_market_reservations from public, anon, authenticated;
grant select on public.buklod_market_reservations to authenticated;
create policy buklod_market_reservation_participants on public.buklod_market_reservations
  for select to authenticated
  using(buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));

create or replace function public.buklod_market_reserve_v1(
 p_listing_id uuid,p_quantity integer,p_note text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path = ''
as $body$
declare
 v_actor uuid:=(select auth.uid());
 v_listing public.buklod_market_listings%rowtype;
 v_result uuid;
begin
 if v_actor is null or p_listing_id is null or p_request_key is null
   or p_quantity not between 1 and 100 or char_length(coalesce(p_note,'')) > 600
 then raise exception 'Invalid reservation request'; end if;
 if not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active=true)
 then raise exception 'Active account required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('buklod_reservation_' || v_actor::text,0));
 select id into v_result from public.buklod_market_reservations
   where buyer_id=v_actor and request_key=p_request_key;
 if found then return v_result; end if;
 select * into v_listing from public.buklod_market_listings
   where id=p_listing_id and publication_state='published'
     and moderation_state='approved' and stock_status='available'
   for share;
 if not found then raise exception 'Listing is unavailable'; end if;
 if v_actor=v_listing.owner_id then raise exception 'Cannot reserve your own listing'; end if;
 if not exists(select 1 from public.buklod_market_stores s
   where s.id=v_listing.store_id and s.moderation_state='approved' and s.is_open)
 then raise exception 'Store is closed'; end if;
 if (select count(*) from public.buklod_market_reservations
     where buyer_id=v_actor and created_at>now()-interval '24 hours') >= 15
 then raise exception 'Daily reservation limit reached'; end if;
 insert into public.buklod_market_reservations(
   listing_id,buyer_id,seller_id,request_key,quantity,note)
 values(p_listing_id,v_actor,v_listing.owner_id,p_request_key,p_quantity,btrim(coalesce(p_note,'')))
 on conflict(buyer_id,request_key) do nothing returning id into v_result;
 if v_result is null then
   select id into v_result from public.buklod_market_reservations
   where buyer_id=v_actor and request_key=p_request_key;
 end if;
 return v_result;
end
$body$;
revoke all on function public.buklod_market_reserve_v1(uuid,integer,text,uuid) from public,anon;
grant execute on function public.buklod_market_reserve_v1(uuid,integer,text,uuid) to authenticated;

create or replace function public.buklod_market_reservation_status_v1(p_id uuid,p_next text)
returns text language plpgsql security definer set search_path = ''
as $body$
declare v_actor uuid:=(select auth.uid());
 v_rec public.buklod_market_reservations%rowtype;
begin
 if v_actor is null or p_id is null then raise exception 'Authentication required'; end if;
 select * into v_rec from public.buklod_market_reservations where id=p_id for update;
 if not found then raise exception 'Reservation not found'; end if;
 if p_next=v_rec.status then return v_rec.status; end if;
 if not (
   (v_actor=v_rec.seller_id and
    ((v_rec.status='requested' and p_next in ('accepted','declined'))
      or (v_rec.status='accepted' and p_next='completed')))
   or
   (v_actor=v_rec.buyer_id and v_rec.status in ('requested','accepted')
      and p_next='cancelled')
 ) then raise exception 'Invalid reservation status transition'; end if;
 update public.buklod_market_reservations set status=p_next,updated_at=now()
 where id=p_id;
 return p_next;
end
$body$;
revoke all on function public.buklod_market_reservation_status_v1(uuid,text) from public,anon;
grant execute on function public.buklod_market_reservation_status_v1(uuid,text) to authenticated;

-- Reports are private to their submitter and the backend moderation service.
create table if not exists public.buklod_market_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.buklod_market_listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('scam','misleading','prohibited','other')),
  details text not null default '' check (char_length(details) <= 600),
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique(listing_id,reporter_id)
);
create index if not exists buklod_market_reports_pending
  on public.buklod_market_reports(created_at desc) where status='pending';

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
alter table public.buklod_market_reports enable row level security;

revoke all on public.buklod_market_stores,public.buklod_market_listings,public.buklod_market_wall_shares,public.buklod_market_reports from public, anon, authenticated;
grant select,insert on public.buklod_market_stores to authenticated;
grant update(name,description,barangay,city,province,seller_type,is_open,updated_at)
  on public.buklod_market_stores to authenticated;
grant select,insert on public.buklod_market_listings to authenticated;
grant update(title,description,kind,category,price_php,unit,image_path,stock_status,publication_state,updated_at)
  on public.buklod_market_listings to authenticated;
grant select on public.buklod_market_wall_shares to authenticated;
grant select,insert on public.buklod_market_reports to authenticated;

create policy buklod_market_store_read on public.buklod_market_stores
  for select to authenticated
  using (owner_id = (select auth.uid()) or moderation_state='approved');
create policy buklod_market_store_insert on public.buklod_market_stores
  for insert to authenticated
  with check (owner_id = (select auth.uid())
    and verification_state='unverified' and moderation_state='approved'
    and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.is_active=true));
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
        and s.moderation_state='approved')
    and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.is_active=true));
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

create policy buklod_market_reports_select on public.buklod_market_reports
  for select to authenticated
  using(reporter_id=(select auth.uid()));
create policy buklod_market_reports_insert on public.buklod_market_reports
  for insert to authenticated
  with check(reporter_id=(select auth.uid()) and status='pending'
    and exists(select 1 from public.buklod_market_listings l
      where l.id=listing_id and l.publication_state='published'
        and l.moderation_state='approved' and l.owner_id <> (select auth.uid())));

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
   and lower(storage.extension(name))='jpg'
   and exists(select 1 from public.profiles p
     where p.id=(select auth.uid()) and p.is_active=true));
create policy buklod_market_photo_delete on storage.objects
 for delete to authenticated
 using(bucket_id='buklod-market-media'
   and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Market promotions MUST NOT mint social QMP, CP, character XP or achievements.
-- Existing ordinary posts keep their exact previous trigger definitions/behavior.
-- Fail-closed on unknown function shape: never partially modify economy contracts.
do $market_reward_exclusion$
declare
  v_signature text;
  v_proc regprocedure;
  v_def text;
  v_start integer;
  v_guard text := E'  -- market_promo_guard_v1\n  IF TG_TABLE_NAME = ''community_posts'' THEN\n    IF position(''[BUKLOD_MARKET:'' in coalesce(NEW.body, '''')) > 0 THEN RETURN NEW; END IF;\n  END IF;\n';
begin
  foreach v_signature in array array[
    'public.community_post_points_trigger_v2()',
    'private.buklod_community_qmp_after_post_v1()',
    'private.buklod_engagement_r4_post_trigger_v1()',
    'private.buklod_achievement_source_trigger_v2()',
    'private.buklod_character_public_wall_metric_trigger_v3()'
  ] loop
    v_proc := to_regprocedure(v_signature);
    if v_proc is null then raise exception 'Missing mandatory reward guard target: %',v_signature; end if;
    if not exists(select 1 from pg_proc where oid=v_proc and prorettype='pg_catalog.trigger'::regtype and prosecdef) then
      raise exception 'Reward trigger signature/ownership changed: %',v_signature;
    end if;
    select pg_get_functiondef(v_proc) into v_def;
    if position('market_promo_guard_v1' in v_def)>0 then continue; end if;
    v_start := strpos(lower(v_def),E'\nbegin\n');
    if v_start=0 then raise exception 'Unexpected reward function body (no BEGIN): %',v_signature; end if;
    v_def := substr(v_def,1,v_start+6) || v_guard || substr(v_def,v_start+7);
    execute v_def;
  end loop;
end
$market_reward_exclusion$;
