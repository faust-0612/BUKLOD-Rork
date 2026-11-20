-- BUKLOD Government: isolated rollout; run only after DEV review and staged RLS tests.
-- Government portal is free to citizens; no personal Focus App premium entitlement.
create schema if not exists buklod_government_private;
revoke all on schema buklod_government_private from public, anon;
grant usage on schema buklod_government_private to authenticated;

create table if not exists public.buklod_government_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 160),
  entity_type text not null check (entity_type in ('NATIONAL','REGIONAL','PROVINCIAL','CITY','MUNICIPALITY','BARANGAY','DEPARTMENT')),
  psgc_code text,
  location_label text not null check (char_length(btrim(location_label)) between 2 and 160),
  official_email text not null check (char_length(btrim(official_email)) between 5 and 254),
  official_url text check (official_url is null or official_url ~* '^https://[^[:space:]]+$'),
  application_note text check (application_note is null or char_length(application_note) <= 1500),
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED','REJECTED','SUSPENDED')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists buklod_gov_entities_location_idx on public.buklod_government_entities(status,psgc_code);
create index if not exists buklod_gov_entities_applicant_idx on public.buklod_government_entities(created_by,created_at desc);

create table if not exists public.buklod_government_staff (
  entity_id uuid not null references public.buklod_government_entities(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('OWNER','ADMIN','PUBLISHER','CONCERN_HANDLER','AUDITOR','EMERGENCY_PUBLISHER')),
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(entity_id,user_id)
);
create index if not exists buklod_gov_staff_user_idx on public.buklod_government_staff(user_id,entity_id) where is_active;

-- Narrow, authenticated per-entity authority helper. Not exposed via the public Data API.
create or replace function buklod_government_private.has_role(p_entity uuid, p_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.buklod_government_staff s
    join public.buklod_government_entities e on e.id=s.entity_id
    where s.entity_id=p_entity and s.user_id=auth.uid()
      and s.is_active and e.status='VERIFIED' and s.role=any(p_roles)
  );
$$;
revoke all on function buklod_government_private.has_role(uuid,text[]) from public,anon;
grant execute on function buklod_government_private.has_role(uuid,text[]) to authenticated;

create table if not exists public.buklod_government_publications (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.buklod_government_entities(id),
  created_by uuid not null references auth.users(id),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  post_kind text not null default 'ANNOUNCEMENT'
    check(post_kind in ('ANNOUNCEMENT','PROGRAM','PROJECT','CONSULTATION','ADVISORY')),
  locality_keys text[] not null default '{}',
  public_wall_post_id uuid unique references public.community_posts(id) on delete set null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique(entity_id,created_by,idempotency_key),
  check(cardinality(locality_keys) <= 25)
);
create index if not exists buklod_gov_pub_feed_idx on public.buklod_government_publications(entity_id,created_at desc);
create index if not exists buklod_gov_pub_location_idx on public.buklod_government_publications using gin(locality_keys);

create table if not exists public.buklod_government_services (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.buklod_government_entities(id),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text,
  official_url text not null check (official_url ~* '^https://[^[:space:]]+$'),
  is_published boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create index if not exists buklod_gov_services_idx on public.buklod_government_services(entity_id,is_published);

create table if not exists public.buklod_government_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.buklod_government_entities(id),
  title text not null check(char_length(btrim(title)) between 3 and 140),
  description text,
  location_label text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_published boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at > starts_at)
);
create index if not exists buklod_gov_events_idx on public.buklod_government_events(entity_id,starts_at);

create table if not exists public.buklod_government_follows (
  entity_id uuid not null references public.buklod_government_entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(entity_id,user_id)
);

create table if not exists public.buklod_government_cases (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('BG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  entity_id uuid not null references public.buklod_government_entities(id),
  submitted_by uuid not null references auth.users(id),
  subject text not null check (char_length(btrim(subject)) between 5 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 6000),
  locality_key text,
  status text not null default 'SUBMITTED' check(status in ('SUBMITTED','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED','ESCALATED')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(entity_id,assigned_to) references public.buklod_government_staff(entity_id,user_id)
);
create index if not exists buklod_gov_cases_owner_idx on public.buklod_government_cases(submitted_by,created_at desc);
create index if not exists buklod_gov_cases_entity_idx on public.buklod_government_cases(entity_id,status,created_at desc);

create table if not exists public.buklod_government_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.buklod_government_cases(id) on delete cascade,
  actor_id uuid references auth.users(id),
  status text,
  note text not null check(char_length(btrim(note)) between 2 and 2500),
  created_at timestamptz not null default now()
);
create index if not exists buklod_gov_case_events_idx on public.buklod_government_case_events(case_id,created_at);

-- All tables deny by default; any exposed tables must be explicitly protected.
alter table public.buklod_government_entities enable row level security;
alter table public.buklod_government_staff enable row level security;
alter table public.buklod_government_publications enable row level security;
alter table public.buklod_government_services enable row level security;
alter table public.buklod_government_events enable row level security;
alter table public.buklod_government_follows enable row level security;
alter table public.buklod_government_cases enable row level security;
alter table public.buklod_government_case_events enable row level security;

create policy gov_entities_read on public.buklod_government_entities for select to authenticated
using (status='VERIFIED' or created_by=(select auth.uid()) or public.buklod_is_system_admin());
create policy gov_entities_apply on public.buklod_government_entities for insert to authenticated
with check (created_by=(select auth.uid()) and status='PENDING' and reviewed_by is null and reviewed_at is null);
create policy gov_entities_verify on public.buklod_government_entities for update to authenticated
using(public.buklod_is_system_admin()) with check(public.buklod_is_system_admin());

create policy gov_staff_read on public.buklod_government_staff for select to authenticated
using(user_id=(select auth.uid()) or public.buklod_is_system_admin()
  or buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','AUDITOR']));
create policy gov_staff_insert on public.buklod_government_staff for insert to authenticated
with check(public.buklod_is_system_admin() or
  (role <> 'OWNER' and buklod_government_private.has_role(entity_id,array['OWNER','ADMIN'])));
create policy gov_staff_update on public.buklod_government_staff for update to authenticated
using(public.buklod_is_system_admin() or buklod_government_private.has_role(entity_id,array['OWNER','ADMIN']))
with check(public.buklod_is_system_admin() or (role <> 'OWNER'
  and buklod_government_private.has_role(entity_id,array['OWNER','ADMIN'])));
create policy gov_staff_delete on public.buklod_government_staff for delete to authenticated
using(public.buklod_is_system_admin() or
  (role <> 'OWNER' and buklod_government_private.has_role(entity_id,array['OWNER','ADMIN'])));

create policy gov_publications_read on public.buklod_government_publications for select to authenticated
using(exists(select 1 from public.buklod_government_entities e where e.id=entity_id and e.status='VERIFIED'));

create policy gov_services_read on public.buklod_government_services for select to authenticated
using(is_published and exists(select 1 from public.buklod_government_entities e where e.id=entity_id and e.status='VERIFIED')
  or buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER','AUDITOR']));
create policy gov_services_manage_insert on public.buklod_government_services for insert to authenticated
with check(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER']));
create policy gov_services_manage_update on public.buklod_government_services for update to authenticated
using(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER']))
with check(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER']));
create policy gov_services_manage_delete on public.buklod_government_services for delete to authenticated
using(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN']));
create policy gov_events_read on public.buklod_government_events for select to authenticated
using(is_published and exists(select 1 from public.buklod_government_entities e where e.id=entity_id and e.status='VERIFIED')
  or buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER','AUDITOR']));
create policy gov_events_manage_insert on public.buklod_government_events for insert to authenticated
with check(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER']));
create policy gov_events_manage_update on public.buklod_government_events for update to authenticated
using(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER']))
with check(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','PUBLISHER']));
create policy gov_events_manage_delete on public.buklod_government_events for delete to authenticated
using(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN']));

create policy gov_follows_read on public.buklod_government_follows for select to authenticated
using(user_id=(select auth.uid()));
create policy gov_follows_insert on public.buklod_government_follows for insert to authenticated
with check(user_id=(select auth.uid()) and exists(
  select 1 from public.buklod_government_entities e where e.id=entity_id and e.status='VERIFIED'));
create policy gov_follows_delete on public.buklod_government_follows for delete to authenticated
using(user_id=(select auth.uid()));

create policy gov_cases_read on public.buklod_government_cases for select to authenticated
using(submitted_by=(select auth.uid()) or
  buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','CONCERN_HANDLER','AUDITOR']));
create policy gov_cases_create on public.buklod_government_cases for insert to authenticated
with check(submitted_by=(select auth.uid()) and status='SUBMITTED' and assigned_to is null
  and exists(select 1 from public.buklod_government_entities e where e.id=entity_id and e.status='VERIFIED'));
create policy gov_cases_manage on public.buklod_government_cases for update to authenticated
using(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','CONCERN_HANDLER']))
with check(buklod_government_private.has_role(entity_id,array['OWNER','ADMIN','CONCERN_HANDLER']));
create policy gov_case_events_read on public.buklod_government_case_events for select to authenticated
using(exists(select 1 from public.buklod_government_cases c where c.id=case_id
  and (c.submitted_by=(select auth.uid()) or buklod_government_private.has_role(c.entity_id,array['OWNER','ADMIN','CONCERN_HANDLER','AUDITOR']))));
create policy gov_case_events_insert on public.buklod_government_case_events for insert to authenticated
with check(actor_id=(select auth.uid()) and exists(select 1 from public.buklod_government_cases c
  where c.id=case_id and buklod_government_private.has_role(c.entity_id,array['OWNER','ADMIN','CONCERN_HANDLER'])));

-- Approval creates an agency owner, but only after an independently authorized System Admin verifies the entity.
create or replace function buklod_government_private.on_verify() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.status='VERIFIED' and old.status<>'VERIFIED' then
    insert into public.buklod_government_staff(entity_id,user_id,role,assigned_by)
    values(new.id,new.created_by,'OWNER',auth.uid())
    on conflict(entity_id,user_id) do update set is_active=true,role='OWNER',assigned_by=excluded.assigned_by;
  end if;
  return new;
end;
$$;
revoke all on function buklod_government_private.on_verify() from public, anon, authenticated;
create trigger buklod_government_verified_owner after update of status
on public.buklod_government_entities for each row
execute function buklod_government_private.on_verify();

create or replace function public.buklod_government_publish_v1(
 p_entity_id uuid,p_body text,p_kind text,p_locality_keys text[],p_idempotency_key uuid,p_public_wall boolean default false)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid := auth.uid(); v_entity public.buklod_government_entities%rowtype;
 v_id uuid; v_wall uuid; v_keys text[]:=coalesce(p_locality_keys,'{}');
begin
 if v_actor is null then raise exception 'Authentication required'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
 select * into v_entity from public.buklod_government_entities where id=p_entity_id and status='VERIFIED';
 if not found then raise exception 'Verified government entity required'; end if;
 if not buklod_government_private.has_role(p_entity_id,array['OWNER','ADMIN','PUBLISHER','EMERGENCY_PUBLISHER']) then
   raise exception 'Government publishing permission required';
 end if;
 if p_kind not in ('ANNOUNCEMENT','PROGRAM','PROJECT','CONSULTATION','ADVISORY')
   or char_length(btrim(coalesce(p_body,''))) not between 1 and 5000
   or cardinality(v_keys)>25 then raise exception 'Invalid publication'; end if;
 if exists(select 1 from unnest(v_keys) k where length(k)>30 or k!~'^[A-Za-z0-9_-]+$')
 then raise exception 'Invalid locality key'; end if;
 -- Only agencies with national jurisdiction can send a nationwide Public Wall post.
 if p_public_wall and v_entity.entity_type<>'NATIONAL' then
   raise exception 'Nationwide Wall publication requires national government authority';
 end if;
 perform pg_advisory_xact_lock(hashtext(p_entity_id::text||p_idempotency_key::text));
 select id into v_id from public.buklod_government_publications
 where entity_id=p_entity_id and created_by=v_actor and idempotency_key=p_idempotency_key;
 if v_id is not null then return v_id; end if;
 if p_public_wall then
   insert into public.community_posts(user_id,body,category,audience,is_hidden)
   values(v_actor,'[OFFICIAL GOVERNMENT • '||v_entity.name||'] '||btrim(p_body),'announcement','public',false)
   returning id into v_wall;
 end if;
 insert into public.buklod_government_publications(entity_id,created_by,body,post_kind,locality_keys,public_wall_post_id,idempotency_key)
 values(p_entity_id,v_actor,btrim(p_body),p_kind,v_keys,v_wall,p_idempotency_key)
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.buklod_government_publish_v1(uuid,text,text,text[],uuid,boolean) from public, anon;
grant execute on function public.buklod_government_publish_v1(uuid,text,text,text[],uuid,boolean) to authenticated;

-- Reduced Data API privileges: private cases and staff never readable anonymously.
revoke all on public.buklod_government_entities,public.buklod_government_staff,
 public.buklod_government_publications,public.buklod_government_services,
 public.buklod_government_events,public.buklod_government_follows,
 public.buklod_government_cases,public.buklod_government_case_events from anon;
grant select,insert,update on public.buklod_government_entities to authenticated;
grant select,insert,update,delete on public.buklod_government_staff to authenticated;
grant select on public.buklod_government_publications to authenticated;
grant select,insert,update,delete on public.buklod_government_services,public.buklod_government_events to authenticated;
grant select,insert,delete on public.buklod_government_follows to authenticated;
grant select,insert on public.buklod_government_cases to authenticated;
grant update(status,assigned_to,updated_at) on public.buklod_government_cases to authenticated;
grant select,insert on public.buklod_government_case_events to authenticated;

-- Atomic case transition with status history and duplicate-request protection.
alter table public.buklod_government_case_events add column if not exists client_key uuid;
create unique index if not exists buklod_gov_case_event_idempotency_idx
on public.buklod_government_case_events(case_id,actor_id,client_key)
where client_key is not null;

create or replace function public.buklod_government_case_transition_v1(
 p_case_id uuid,p_status text,p_note text,p_client_key uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_case public.buklod_government_cases%rowtype;
  v_staff boolean;
begin
 if v_actor is null or p_client_key is null then raise exception 'Authentication and idempotency key required'; end if;
 if p_status not in ('ACKNOWLEDGED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED','ESCALATED')
  or char_length(btrim(coalesce(p_note,''))) not between 2 and 2500 then raise exception 'Invalid case update'; end if;
 select * into v_case from public.buklod_government_cases where id=p_case_id for update;
 if not found then raise exception 'Case not found'; end if;
 v_staff:=buklod_government_private.has_role(v_case.entity_id,array['OWNER','ADMIN','CONCERN_HANDLER']);
 if not v_staff and not (v_case.submitted_by=v_actor and p_status='REOPENED' and v_case.status in ('RESOLVED','CLOSED')) then
  raise exception 'Not authorized to update this case';
 end if;
 if not exists(select 1 from public.buklod_government_case_events
  where case_id=p_case_id and actor_id=v_actor and client_key=p_client_key) then
   update public.buklod_government_cases set status=p_status,updated_at=now() where id=p_case_id;
   insert into public.buklod_government_case_events(case_id,actor_id,status,note,client_key)
   values(p_case_id,v_actor,p_status,btrim(p_note),p_client_key);
 end if;
 return true;
end;
$$;
revoke all on function public.buklod_government_case_transition_v1(uuid,text,text,uuid) from public,anon;
grant execute on function public.buklod_government_case_transition_v1(uuid,text,text,uuid) to authenticated;
