-- Ephemeral Postgres 17 test fixture. NEVER run in production.
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;
create schema if not exists private;
grant usage on schema public to anon, authenticated;
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;

create table public.profiles (
  id uuid primary key,
  role text not null default 'member',
  is_active boolean not null default true
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id),
  role text not null,
  is_active boolean not null default true,
  primary key(user_id,role)
);
create table public.user_capabilities (
  user_id uuid not null references public.profiles(id),
  capability text not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz default now(),
  is_active boolean not null default true,
  primary key(user_id,capability)
);
create table public.buklod_foundation_protected_principals (
  principal_key text primary key,
  user_id uuid not null references public.profiles(id),
  protected boolean not null default true
);
create table public.mentor_assignments (
  mentor_id uuid not null references public.profiles(id),
  disciple_id uuid not null references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  is_active boolean not null default true,
  primary key(mentor_id,disciple_id)
);
create table public.learning_tracks (
  id uuid primary key,
  title text not null,
  formation_program text not null
);
create table public.learning_lessons (
  id uuid primary key,
  track_id uuid not null references public.learning_tracks(id),
  lesson_number integer not null,
  title text not null
);
create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
 select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role='system_admin'
) $$;
create or replace function public.has_capability(p_user_id uuid,p_capability text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.user_capabilities c
where c.user_id=p_user_id and c.capability=p_capability and c.is_active) $$;

insert into public.profiles(id,role,is_active) values
 ('11111111-1111-4111-8111-111111111111','system_admin',true),
 ('22222222-2222-4222-8222-222222222222','member',true),
 ('33333333-3333-4333-8333-333333333333','member',true),
 ('44444444-4444-4444-8444-444444444444','system_admin',true),
 ('55555555-5555-4555-8555-555555555555','member',false);
insert into public.user_roles(user_id,role,is_active) values
 ('11111111-1111-4111-8111-111111111111','system_admin',true),
 ('44444444-4444-4444-8444-444444444444','system_admin',true);
insert into public.buklod_foundation_protected_principals(principal_key,user_id,protected)
values('OFFICIAL_SYSTEM_ADMIN','44444444-4444-4444-8444-444444444444',true);
insert into public.learning_tracks values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','CCP 5: Pagbibigay','ccp');
insert into public.learning_lessons values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',2,
  'Ang Epekto ng Pagbibigay sa Ministeryo ng Iglesya');
