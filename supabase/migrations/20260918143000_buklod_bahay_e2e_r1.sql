-- BUKLOD Bahay E2E R1
-- Private household coordination + room zoom model + virtual garden + multi-home communities.

create table if not exists public.buklod_homes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  home_kind text not null default 'PHYSICAL' check (home_kind in ('PHYSICAL','VIRTUAL')),
  created_by uuid not null references auth.users(id) on delete cascade,
  garden_energy integer not null default 0 check (garden_energy>=0),
  garden_seeds integer not null default 3 check (garden_seeds>=0),
  garden_harvests integer not null default 0 check (garden_harvests>=0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_home_members (
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'ADULT' check (role in ('OWNER','ADMIN','ADULT','TEEN','CHILD','HELPER','GUEST')),
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','DECLINED','REMOVED')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(home_id,user_id)
);

create table if not exists public.buklod_home_items (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  room text not null default 'SALA' check (room in ('SALA','KITCHEN','BEDROOM','DRAWER','CALENDAR','BILLS','GARDEN','GENERAL')),
  item_type text not null check (item_type in ('TASK','GROCERY','MEAL','BILL','INVENTORY','MAINTENANCE','RULE','NOTICE','EVENT','MOMENT','EMERGENCY','PRIVATE_NOTE','REMINDER')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  amount numeric(14,2),
  visibility text not null default 'SHARED' check (visibility in ('SHARED','ADULTS','PRIVATE')),
  reminder_enabled boolean not null default true,
  is_done boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_home_messages (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.buklod_home_files (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  room text not null default 'DRAWER' check (room in ('DRAWER','BEDROOM','GENERAL')),
  visibility text not null default 'SHARED' check (visibility in ('SHARED','ADULTS','PRIVATE')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes>=0 and size_bytes<=10485760),
  created_at timestamptz not null default now()
);

create table if not exists public.buklod_home_polls (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 240),
  closes_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.buklod_home_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.buklod_home_polls(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  sort_order integer not null default 0
);
create table if not exists public.buklod_home_poll_votes (
  poll_id uuid not null references public.buklod_home_polls(id) on delete cascade,
  option_id uuid not null references public.buklod_home_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(poll_id,user_id)
);

create table if not exists public.buklod_home_garden_plants (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  planted_by uuid not null references auth.users(id) on delete cascade,
  plant_type text not null default 'SUNFLOWER' check (plant_type in ('SUNFLOWER','TOMATO','HERB','TREE','FLOWER')),
  nickname text,
  stage integer not null default 1 check (stage between 1 and 5),
  water_count integer not null default 0 check (water_count>=0),
  harvested_at timestamptz,
  planted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_home_communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  community_kind text not null check (community_kind in ('COMPOUND','SUBDIVISION','VIRTUAL')),
  parent_community_id uuid references public.buklod_home_communities(id) on delete set null,
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.buklod_home_community_homes (
  community_id uuid not null references public.buklod_home_communities(id) on delete cascade,
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('ADMIN','MEMBER')),
  joined_at timestamptz not null default now(),
  primary key(community_id,home_id)
);
create table if not exists public.buklod_home_community_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.buklod_home_communities(id) on delete cascade,
  item_type text not null check (item_type in ('GOAL','TASK','NOTICE','EVENT','RESOURCE','POLL')),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  body text,
  due_at timestamptz,
  is_done boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.buklod_home_community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.buklod_home_communities(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create table if not exists public.buklod_home_reminder_dispatches (
  item_id uuid not null references public.buklod_home_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null,
  created_at timestamptz not null default now(),
  primary key(item_id,user_id,reminder_key)
);

create index if not exists buklod_home_members_user_idx on public.buklod_home_members(user_id,status);
create index if not exists buklod_home_items_home_due_idx on public.buklod_home_items(home_id,is_done,due_at);
create index if not exists buklod_home_messages_home_idx on public.buklod_home_messages(home_id,created_at desc);
create index if not exists buklod_home_files_home_idx on public.buklod_home_files(home_id,created_at desc);
create index if not exists buklod_home_community_homes_home_idx on public.buklod_home_community_homes(home_id);
create index if not exists buklod_home_community_items_idx on public.buklod_home_community_items(community_id,created_at desc);

create or replace function public.buklod_home_is_member(p_home_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.buklod_home_members m where m.home_id=p_home_id and m.user_id=(select auth.uid()) and m.status='ACTIVE' and (m.expires_at is null or m.expires_at>now()));
$$;
create or replace function public.buklod_home_is_admin(p_home_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.buklod_home_members m where m.home_id=p_home_id and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role in ('OWNER','ADMIN') and (m.expires_at is null or m.expires_at>now()));
$$;
create or replace function public.buklod_home_is_adult(p_home_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.buklod_home_members m where m.home_id=p_home_id and m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role in ('OWNER','ADMIN','ADULT') and (m.expires_at is null or m.expires_at>now()));
$$;
create or replace function public.buklod_home_has_invite(p_home_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.buklod_home_members m where m.home_id=p_home_id and m.user_id=(select auth.uid()) and m.status='PENDING');
$$;
create or replace function public.buklod_home_can_read_item(p_home_id uuid,p_visibility text,p_created_by uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select case when p_visibility='PRIVATE' then p_created_by=(select auth.uid())
              when p_visibility='ADULTS' then public.buklod_home_is_adult(p_home_id)
              else public.buklod_home_is_member(p_home_id) end;
$$;
create or replace function public.buklod_home_is_community_member(p_community_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.buklod_home_community_homes ch join public.buklod_home_members hm on hm.home_id=ch.home_id where ch.community_id=p_community_id and hm.user_id=(select auth.uid()) and hm.status='ACTIVE' and (hm.expires_at is null or hm.expires_at>now()));
$$;
create or replace function public.buklod_home_is_community_admin(p_community_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.buklod_home_community_homes ch join public.buklod_home_members hm on hm.home_id=ch.home_id where ch.community_id=p_community_id and ch.role='ADMIN' and hm.user_id=(select auth.uid()) and hm.status='ACTIVE' and hm.role in ('OWNER','ADMIN'));
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.buklod_home_is_member(uuid)','public.buklod_home_is_admin(uuid)','public.buklod_home_is_adult(uuid)',
    'public.buklod_home_has_invite(uuid)','public.buklod_home_can_read_item(uuid,text,uuid)',
    'public.buklod_home_is_community_member(uuid)','public.buklod_home_is_community_admin(uuid)'
  ] loop
    execute 'revoke all on function '||signature||' from public, anon';
    execute 'grant execute on function '||signature||' to authenticated';
  end loop;
end $$;

create or replace function public.buklod_home_create_v1(p_name text,p_kind text default 'PHYSICAL') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if btrim(coalesce(p_name,''))='' then raise exception 'Home name is required'; end if;
  insert into public.buklod_homes(name,home_kind,created_by)
  values(left(btrim(p_name),80),case when upper(p_kind)='VIRTUAL' then 'VIRTUAL' else 'PHYSICAL' end,(select auth.uid()))
  returning id into v_id;
  insert into public.buklod_home_members(home_id,user_id,role,status,joined_at)
  values(v_id,(select auth.uid()),'OWNER','ACTIVE',now());
  return v_id;
end $$;

create or replace function public.buklod_home_invite_v1(p_home_id uuid,p_identifier text,p_role text default 'ADULT',p_expires_at timestamptz default null)
returns table(user_id uuid,full_name text,username text)
language plpgsql security definer set search_path='' as $$
declare v_target public.profiles%rowtype; v_role text; v_ident text;
begin
  if not public.buklod_home_is_admin(p_home_id) then raise exception 'Home admin access required'; end if;
  v_ident:=lower(regexp_replace(btrim(coalesce(p_identifier,'')),'^@',''));
  if v_ident='' then raise exception 'Username or login identifier is required'; end if;
  select p.* into v_target from public.profiles p
  where lower(coalesce(p.username,''))=v_ident or lower(coalesce(p.login_identifier,''))=v_ident
  order by case when lower(coalesce(p.username,''))=v_ident then 0 else 1 end limit 1;
  if v_target.id is null then raise exception 'BUKLOD user not found'; end if;
  v_role:=upper(coalesce(p_role,'ADULT'));
  if v_role not in ('ADMIN','ADULT','TEEN','CHILD','HELPER','GUEST') then v_role:='ADULT'; end if;
  insert into public.buklod_home_members(home_id,user_id,role,status,invited_by,expires_at)
  values(p_home_id,v_target.id,v_role,'PENDING',(select auth.uid()),p_expires_at)
  on conflict(home_id,user_id) do update set role=excluded.role,status='PENDING',invited_by=excluded.invited_by,expires_at=excluded.expires_at;
  insert into public.notifications(user_id,title,body,kind,data)
  values(v_target.id,'Imbitasyon sa Bahay',(select name from public.buklod_homes where id=p_home_id)||' invited you as Kasambahay.','buklod_home_invite',jsonb_build_object('route','/personal-home','home_id',p_home_id));
  return query select v_target.id,v_target.full_name,v_target.username;
end $$;

create or replace function public.buklod_home_invite_decide_v1(p_home_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.buklod_home_members set status=case when p_accept then 'ACTIVE' else 'DECLINED' end,
    joined_at=case when p_accept then now() else joined_at end
  where home_id=p_home_id and user_id=(select auth.uid()) and status='PENDING';
  if not found then raise exception 'Pending invitation not found'; end if;
end $$;

create or replace function public.buklod_home_complete_item_v1(p_item_id uuid,p_done boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_item public.buklod_home_items%rowtype; v_was_done boolean;
begin
  select * into v_item from public.buklod_home_items where id=p_item_id;
  if v_item.id is null or not public.buklod_home_is_member(v_item.home_id) then raise exception 'Item not available'; end if;
  if v_item.visibility='PRIVATE' and v_item.created_by<>(select auth.uid()) then raise exception 'Private item'; end if;
  if v_item.visibility='ADULTS' and not public.buklod_home_is_adult(v_item.home_id) then raise exception 'Adults only'; end if;
  v_was_done:=v_item.is_done;
  update public.buklod_home_items set is_done=p_done,completed_at=case when p_done then now() else null end,
    completed_by=case when p_done then (select auth.uid()) else null end,updated_at=now() where id=p_item_id;
  if p_done and not v_was_done and v_item.item_type in ('TASK','MAINTENANCE') and v_item.visibility<>'PRIVATE' then
    update public.buklod_homes set garden_energy=garden_energy+1,updated_at=now() where id=v_item.home_id;
  end if;
end $$;

create or replace function public.buklod_home_plant_v1(p_home_id uuid,p_type text default 'SUNFLOWER',p_nickname text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_seeds integer; v_type text;
begin
  if not public.buklod_home_is_member(p_home_id) then raise exception 'Home membership required'; end if;
  select garden_seeds into v_seeds from public.buklod_homes where id=p_home_id for update;
  if coalesce(v_seeds,0)<1 then raise exception 'No seeds available. Complete shared chores to grow the garden.'; end if;
  v_type:=upper(coalesce(p_type,'SUNFLOWER'));
  if v_type not in ('SUNFLOWER','TOMATO','HERB','TREE','FLOWER') then v_type:='SUNFLOWER'; end if;
  update public.buklod_homes set garden_seeds=garden_seeds-1,updated_at=now() where id=p_home_id;
  insert into public.buklod_home_garden_plants(home_id,planted_by,plant_type,nickname)
  values(p_home_id,(select auth.uid()),v_type,nullif(left(btrim(coalesce(p_nickname,'')),40),''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.buklod_home_water_plant_v1(p_plant_id uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare v_plant public.buklod_home_garden_plants%rowtype; v_energy integer; v_next integer;
begin
  select * into v_plant from public.buklod_home_garden_plants where id=p_plant_id for update;
  if v_plant.id is null or not public.buklod_home_is_member(v_plant.home_id) then raise exception 'Plant not available'; end if;
  if v_plant.harvested_at is not null then return v_plant.stage; end if;
  select garden_energy into v_energy from public.buklod_homes where id=v_plant.home_id for update;
  if coalesce(v_energy,0)<1 then raise exception 'Need garden energy. Finish a shared chore first.'; end if;
  v_next:=least(5,v_plant.stage+1);
  update public.buklod_homes set garden_energy=garden_energy-1,updated_at=now() where id=v_plant.home_id;
  update public.buklod_home_garden_plants set stage=v_next,water_count=water_count+1,updated_at=now(),
    harvested_at=case when v_next=5 then coalesce(harvested_at,now()) else harvested_at end where id=p_plant_id;
  if v_next=5 and v_plant.stage<5 then
    update public.buklod_homes set garden_seeds=garden_seeds+2,garden_harvests=garden_harvests+1 where id=v_plant.home_id;
  end if;
  return v_next;
end $$;

create or replace function public.buklod_home_create_community_v1(p_home_id uuid,p_name text,p_kind text,p_parent uuid default null)
returns table(community_id uuid,join_code text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_code text; v_kind text;
begin
  if not public.buklod_home_is_admin(p_home_id) then raise exception 'Home admin access required'; end if;
  v_kind:=upper(coalesce(p_kind,'COMPOUND'));
  if v_kind not in ('COMPOUND','SUBDIVISION','VIRTUAL') then v_kind:='VIRTUAL'; end if;
  if p_parent is not null and not exists(
    select 1 from public.buklod_home_community_homes ch join public.buklod_home_members hm on hm.home_id=ch.home_id
    where ch.community_id=p_parent and ch.role='ADMIN' and hm.user_id=(select auth.uid()) and hm.status='ACTIVE' and hm.role in ('OWNER','ADMIN')
  ) then raise exception 'Parent community admin access required'; end if;
  insert into public.buklod_home_communities(name,community_kind,parent_community_id,created_by)
  values(left(btrim(p_name),100),v_kind,p_parent,(select auth.uid()))
  returning id,buklod_home_communities.join_code into v_id,v_code;
  insert into public.buklod_home_community_homes(community_id,home_id,role) values(v_id,p_home_id,'ADMIN');
  return query select v_id,v_code;
end $$;

create or replace function public.buklod_home_join_community_v1(p_home_id uuid,p_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if not public.buklod_home_is_admin(p_home_id) then raise exception 'Home admin access required'; end if;
  select id into v_id from public.buklod_home_communities where upper(join_code)=upper(btrim(p_code)) limit 1;
  if v_id is null then raise exception 'Community code not found'; end if;
  insert into public.buklod_home_community_homes(community_id,home_id,role) values(v_id,p_home_id,'MEMBER') on conflict do nothing;
  return v_id;
end $$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'public.buklod_home_create_v1(text,text)',
    'public.buklod_home_invite_v1(uuid,text,text,timestamptz)',
    'public.buklod_home_invite_decide_v1(uuid,boolean)',
    'public.buklod_home_complete_item_v1(uuid,boolean)',
    'public.buklod_home_plant_v1(uuid,text,text)',
    'public.buklod_home_water_plant_v1(uuid)',
    'public.buklod_home_create_community_v1(uuid,text,text,uuid)',
    'public.buklod_home_join_community_v1(uuid,text)'
  ] loop
    execute 'revoke all on function '||signature||' from public, anon';
    execute 'grant execute on function '||signature||' to authenticated';
  end loop;
end $$;

alter table public.buklod_homes enable row level security;
alter table public.buklod_home_members enable row level security;
alter table public.buklod_home_items enable row level security;
alter table public.buklod_home_messages enable row level security;
alter table public.buklod_home_files enable row level security;
alter table public.buklod_home_polls enable row level security;
alter table public.buklod_home_poll_options enable row level security;
alter table public.buklod_home_poll_votes enable row level security;
alter table public.buklod_home_garden_plants enable row level security;
alter table public.buklod_home_communities enable row level security;
alter table public.buklod_home_community_homes enable row level security;
alter table public.buklod_home_community_items enable row level security;
alter table public.buklod_home_community_messages enable row level security;
alter table public.buklod_home_reminder_dispatches enable row level security;

drop policy if exists "Bahay members read homes" on public.buklod_homes;
create policy "Bahay members read homes" on public.buklod_homes for select to authenticated using(public.buklod_home_is_member(id) or public.buklod_home_has_invite(id) or created_by=(select auth.uid()));

drop policy if exists "Bahay members read memberships" on public.buklod_home_members;
create policy "Bahay members read memberships" on public.buklod_home_members for select to authenticated using(user_id=(select auth.uid()) or public.buklod_home_is_member(home_id));
drop policy if exists "Bahay admins manage memberships" on public.buklod_home_members;
create policy "Bahay admins manage memberships" on public.buklod_home_members for all to authenticated using(public.buklod_home_is_admin(home_id)) with check(public.buklod_home_is_admin(home_id));

drop policy if exists "Bahay members read items" on public.buklod_home_items;
create policy "Bahay members read items" on public.buklod_home_items for select to authenticated using(public.buklod_home_can_read_item(home_id,visibility,created_by));
drop policy if exists "Bahay members create items" on public.buklod_home_items;
create policy "Bahay members create items" on public.buklod_home_items for insert to authenticated with check(
  created_by=(select auth.uid()) and public.buklod_home_is_member(home_id)
  and (visibility<>'ADULTS' or public.buklod_home_is_adult(home_id))
  and (visibility<>'PRIVATE' or room='BEDROOM')
  and (assigned_to is null or exists(select 1 from public.buklod_home_members m where m.home_id=buklod_home_items.home_id and m.user_id=buklod_home_items.assigned_to and m.status='ACTIVE' and (m.expires_at is null or m.expires_at>now())))
);
drop policy if exists "Bahay members update items" on public.buklod_home_items;
create policy "Bahay members update items" on public.buklod_home_items for update to authenticated
using(created_by=(select auth.uid()) or public.buklod_home_is_admin(home_id) or (assigned_to=(select auth.uid()) and visibility<>'PRIVATE'))
with check(public.buklod_home_can_read_item(home_id,visibility,created_by));
drop policy if exists "Bahay creators delete items" on public.buklod_home_items;
create policy "Bahay creators delete items" on public.buklod_home_items for delete to authenticated using(created_by=(select auth.uid()) or public.buklod_home_is_admin(home_id));

drop policy if exists "Bahay members read messages" on public.buklod_home_messages;
create policy "Bahay members read messages" on public.buklod_home_messages for select to authenticated using(public.buklod_home_is_member(home_id));
drop policy if exists "Bahay members send messages" on public.buklod_home_messages;
create policy "Bahay members send messages" on public.buklod_home_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.buklod_home_is_member(home_id));

drop policy if exists "Bahay members read file metadata" on public.buklod_home_files;
create policy "Bahay members read file metadata" on public.buklod_home_files for select to authenticated using(
  (visibility='PRIVATE' and owner_id=(select auth.uid())) or
  (visibility='ADULTS' and public.buklod_home_is_adult(home_id)) or
  (visibility='SHARED' and public.buklod_home_is_member(home_id))
);
drop policy if exists "Bahay members add file metadata" on public.buklod_home_files;
create policy "Bahay members add file metadata" on public.buklod_home_files for insert to authenticated with check(
  owner_id=(select auth.uid()) and public.buklod_home_is_member(home_id)
  and (visibility<>'ADULTS' or public.buklod_home_is_adult(home_id))
  and (visibility<>'PRIVATE' or room='BEDROOM')
);
drop policy if exists "Bahay owners delete files" on public.buklod_home_files;
create policy "Bahay owners delete files" on public.buklod_home_files for delete to authenticated using(owner_id=(select auth.uid()) or public.buklod_home_is_admin(home_id));

drop policy if exists "Bahay members read polls" on public.buklod_home_polls;
create policy "Bahay members read polls" on public.buklod_home_polls for select to authenticated using(public.buklod_home_is_member(home_id));
drop policy if exists "Bahay members create polls" on public.buklod_home_polls;
create policy "Bahay members create polls" on public.buklod_home_polls for insert to authenticated with check(created_by=(select auth.uid()) and public.buklod_home_is_member(home_id));
drop policy if exists "Bahay members read poll options" on public.buklod_home_poll_options;
create policy "Bahay members read poll options" on public.buklod_home_poll_options for select to authenticated using(exists(select 1 from public.buklod_home_polls p where p.id=poll_id and public.buklod_home_is_member(p.home_id)));
drop policy if exists "Bahay poll creators add options" on public.buklod_home_poll_options;
create policy "Bahay poll creators add options" on public.buklod_home_poll_options for insert to authenticated with check(exists(select 1 from public.buklod_home_polls p where p.id=poll_id and p.created_by=(select auth.uid())));
drop policy if exists "Bahay members read votes" on public.buklod_home_poll_votes;
create policy "Bahay members read votes" on public.buklod_home_poll_votes for select to authenticated using(exists(select 1 from public.buklod_home_polls p where p.id=poll_id and public.buklod_home_is_member(p.home_id)));
drop policy if exists "Bahay members vote" on public.buklod_home_poll_votes;
create policy "Bahay members vote" on public.buklod_home_poll_votes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.buklod_home_polls p where p.id=poll_id and public.buklod_home_is_member(p.home_id)));
drop policy if exists "Bahay members delete own vote" on public.buklod_home_poll_votes;
create policy "Bahay members delete own vote" on public.buklod_home_poll_votes for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists "Bahay members read garden" on public.buklod_home_garden_plants;
create policy "Bahay members read garden" on public.buklod_home_garden_plants for select to authenticated using(public.buklod_home_is_member(home_id));

drop policy if exists "Community members read communities" on public.buklod_home_communities;
create policy "Community members read communities" on public.buklod_home_communities for select to authenticated using(public.buklod_home_is_community_member(id));
drop policy if exists "Community members read links" on public.buklod_home_community_homes;
create policy "Community members read links" on public.buklod_home_community_homes for select to authenticated using(public.buklod_home_is_community_member(community_id));
drop policy if exists "Community members read items" on public.buklod_home_community_items;
create policy "Community members read items" on public.buklod_home_community_items for select to authenticated using(public.buklod_home_is_community_member(community_id));
drop policy if exists "Community members create items" on public.buklod_home_community_items;
create policy "Community members create items" on public.buklod_home_community_items for insert to authenticated with check(created_by=(select auth.uid()) and public.buklod_home_is_community_member(community_id));
drop policy if exists "Community creators update items" on public.buklod_home_community_items;
create policy "Community creators update items" on public.buklod_home_community_items for update to authenticated using(created_by=(select auth.uid()) or public.buklod_home_is_community_admin(community_id)) with check(public.buklod_home_is_community_member(community_id));
drop policy if exists "Community members read messages" on public.buklod_home_community_messages;
create policy "Community members read messages" on public.buklod_home_community_messages for select to authenticated using(public.buklod_home_is_community_member(community_id));
drop policy if exists "Community members send messages" on public.buklod_home_community_messages;
create policy "Community members send messages" on public.buklod_home_community_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.buklod_home_is_community_member(community_id));
drop policy if exists "Bahay reminder dispatch private" on public.buklod_home_reminder_dispatches;
create policy "Bahay reminder dispatch private" on public.buklod_home_reminder_dispatches for select to authenticated using(false);

grant select on public.buklod_homes,public.buklod_home_members,public.buklod_home_items,public.buklod_home_messages,
  public.buklod_home_files,public.buklod_home_polls,public.buklod_home_poll_options,public.buklod_home_poll_votes,
  public.buklod_home_garden_plants,public.buklod_home_communities,public.buklod_home_community_homes,
  public.buklod_home_community_items,public.buklod_home_community_messages to authenticated;
grant insert,update,delete on public.buklod_home_items,public.buklod_home_messages,public.buklod_home_files,
  public.buklod_home_polls,public.buklod_home_poll_options,public.buklod_home_poll_votes,
  public.buklod_home_community_items,public.buklod_home_community_messages to authenticated;
revoke all on public.buklod_home_reminder_dispatches from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-home-drawer','buklod-home-drawer',false,10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain','text/csv','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Bahay drawer members read shared files" on storage.objects;
create policy "Bahay drawer members read shared files" on storage.objects for select to authenticated using(
  bucket_id='buklod-home-drawer' and (
    ((storage.foldername(name))[2]='private' and (storage.foldername(name))[3]=(select auth.uid())::text)
    or ((storage.foldername(name))[2]='adults' and public.buklod_home_is_adult(((storage.foldername(name))[1])::uuid))
    or ((storage.foldername(name))[2]='shared' and public.buklod_home_is_member(((storage.foldername(name))[1])::uuid))
  )
);
drop policy if exists "Bahay drawer members upload files" on storage.objects;
create policy "Bahay drawer members upload files" on storage.objects for insert to authenticated with check(
  bucket_id='buklod-home-drawer' and public.buklod_home_is_member(((storage.foldername(name))[1])::uuid)
  and (((storage.foldername(name))[2]='private' and (storage.foldername(name))[3]=(select auth.uid())::text)
       or ((storage.foldername(name))[2]='adults' and public.buklod_home_is_adult(((storage.foldername(name))[1])::uuid))
       or ((storage.foldername(name))[2]='shared'))
);
drop policy if exists "Bahay drawer owners delete files" on storage.objects;
create policy "Bahay drawer owners delete files" on storage.objects for delete to authenticated using(
  bucket_id='buklod-home-drawer' and (owner_id=(select auth.uid())::text or public.buklod_home_is_admin(((storage.foldername(name))[1])::uuid))
);

create or replace function public.buklod_home_file_quota_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_used bigint;
begin
  select coalesce(sum(size_bytes),0) into v_used from public.buklod_home_files where home_id=new.home_id;
  if v_used+new.size_bytes>262144000 then raise exception 'Bahay Shared Drawer limit is 250 MB per home.'; end if;
  return new;
end $$;
drop trigger if exists trg_buklod_home_file_quota_guard on public.buklod_home_files;
create trigger trg_buklod_home_file_quota_guard before insert on public.buklod_home_files for each row execute function public.buklod_home_file_quota_guard();

create or replace function public.buklod_home_message_notify() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(user_id,title,body,kind,data)
  select m.user_id,'Bahay · Bagong Mensahe',left(new.body,180),'buklod_home_message',jsonb_build_object('route','/personal-home','home_id',new.home_id)
  from public.buklod_home_members m
  where m.home_id=new.home_id and m.status='ACTIVE' and m.user_id<>new.sender_id and (m.expires_at is null or m.expires_at>now());
  return new;
end $$;
revoke all on function public.buklod_home_message_notify() from public,anon,authenticated;
drop trigger if exists trg_buklod_home_message_notify on public.buklod_home_messages;
create trigger trg_buklod_home_message_notify after insert on public.buklod_home_messages for each row execute function public.buklod_home_message_notify();

create or replace function public.buklod_home_task_notify() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.assigned_to is not null and new.assigned_to<>new.created_by and new.item_type in ('TASK','MAINTENANCE','REMINDER','EVENT') then
    insert into public.notifications(user_id,title,body,kind,data)
    values(new.assigned_to,'Bahay · Bagong Gawain',new.title,'buklod_home_task',jsonb_build_object('route','/personal-home','home_id',new.home_id,'item_id',new.id));
  end if;
  return new;
end $$;
revoke all on function public.buklod_home_task_notify() from public,anon,authenticated;
drop trigger if exists trg_buklod_home_task_notify on public.buklod_home_items;
create trigger trg_buklod_home_task_notify after insert on public.buklod_home_items for each row execute function public.buklod_home_task_notify();

create or replace function public.buklod_home_enqueue_due_reminders() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  with candidates as (
    select i.id,i.home_id,i.title,coalesce(i.assigned_to,m.user_id) target_user
    from public.buklod_home_items i
    left join public.buklod_home_members m on m.home_id=i.home_id and i.assigned_to is null and m.status='ACTIVE' and (m.expires_at is null or m.expires_at>now())
    where i.is_done=false and i.reminder_enabled=true and i.due_at is not null and i.due_at>now() and i.due_at<=now()+interval '1 hour'
      and i.item_type in ('TASK','MAINTENANCE','REMINDER','EVENT','BILL')
  ), inserted as (
    insert into public.buklod_home_reminder_dispatches(item_id,user_id,reminder_key)
    select id,target_user,'DUE_1H' from candidates where target_user is not null
    on conflict do nothing returning item_id,user_id
  )
  insert into public.notifications(user_id,title,body,kind,data)
  select ins.user_id,'Bahay · Paalala',c.title||' · due within 1 hour','buklod_home_due',
    jsonb_build_object('route','/personal-home','home_id',c.home_id,'item_id',c.id)
  from inserted ins join candidates c on c.id=ins.item_id and c.target_user=ins.user_id;
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function public.buklod_home_enqueue_due_reminders() from public,anon,authenticated;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='buklod-home-due-reminders' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('buklod-home-due-reminders','*/15 * * * *','select public.buklod_home_enqueue_due_reminders();');
end $$;

do $$
declare t text;
begin
  foreach t in array array['buklod_home_items','buklod_home_messages','buklod_home_members','buklod_home_garden_plants','buklod_home_community_items','buklod_home_community_messages'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
