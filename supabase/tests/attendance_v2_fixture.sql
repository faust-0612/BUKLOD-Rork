-- Ephemeral PostgreSQL 17 fixture. Only GitHub Actions runs this file.
-- Synthetic identities; no production credentials or data.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table auth.users (
 id uuid primary key,
 is_system_admin boolean not null default false
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;

create table public.profiles (
 id uuid primary key references auth.users(id),
 full_name text,
 username text,
 is_active boolean not null default true
);
create table public.buklod_scopes (
 id uuid primary key, name text not null
);
create table public.buklod_scope_memberships (
 scope_id uuid references public.buklod_scopes(id),
 user_id uuid references public.profiles(id),
 membership_status text default 'ACTIVE',
 left_at timestamptz
);
create table public.attendance_scope_operators (
 scope_id uuid references public.buklod_scopes(id),
 user_id uuid references public.profiles(id),
 is_active boolean not null default true
);
create table public.attendance_events (
 id uuid primary key default gen_random_uuid(),
 scope_id uuid references public.buklod_scopes(id),
 title text not null,
 location text,
 starts_at timestamptz not null,
 ends_at timestamptz,
 is_active boolean not null default true,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 allowed_methods text[] not null default array['qr','manual'],
 attendance_open_at timestamptz,
 attendance_close_at timestamptz,
 late_after timestamptz
);
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.attendance_events(id),
 user_id uuid not null references public.profiles(id),
 status text not null default 'present',
 method text not null,
 operator_id uuid references public.profiles(id),
 metadata jsonb not null default '{}'::jsonb,
 checked_in_at timestamptz not null default now(),
 unique(event_id,user_id)
);
create table public.attendance_people (
 id uuid primary key default gen_random_uuid(),
 buklod_user_id uuid references public.profiles(id),
 full_name text
);
create table public.attendance_person_records (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.attendance_events(id),
 person_id uuid not null references public.attendance_people(id),
 status text not null default 'present',
 method text not null,
 operator_id uuid references public.profiles(id),
 metadata jsonb not null default '{}'::jsonb,
 checked_in_at timestamptz not null default now(),
 unique(event_id,person_id)
);
create table public.buklod_home_event_checkins_r3 (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.attendance_events(id),
 scope_id uuid references public.buklod_scopes(id),
 user_id uuid references public.profiles(id),
 status text not null default 'pending',
 checked_in_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid,
 review_note text,
 ledger_id uuid
);
create table public.buklod_points_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 direction text not null,
 points integer not null,
 activity_type text not null,
 source_key text not null,
 source_id uuid,
 description text,
 awarded_by uuid,
 created_at timestamptz not null default now(),
 unique(user_id,source_key)
);
create table public.buklod_point_rules (
 activity_type text primary key,
 base_points integer,
 max_points_per_event integer,
 is_active boolean not null default true
);
create table public.church_events (
 id uuid primary key default gen_random_uuid(),
 starts_at timestamptz not null
);
create table public.buklod_attendance_qr_tokens (
 user_id uuid references public.profiles(id),
 token uuid unique default gen_random_uuid(),
 is_active boolean not null default true
);
create function public.is_system_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.is_system_admin=true)
$$;
create function public.buklod_is_scope_admin(p_scope_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.attendance_scope_operators a
   where a.scope_id=p_scope_id and a.user_id=auth.uid() and a.is_active)
$$;
create function public.can_operate_attendance_scope(p_scope_id uuid,p_actor uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.attendance_scope_operators a
   where a.scope_id=p_scope_id and a.user_id=p_actor and a.is_active)
$$;
create function public.can_manage_buklod_attendance_event(p_event_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.attendance_events e
   where e.id=p_event_id and (e.created_by=p_user_id or
     public.can_operate_attendance_scope(e.scope_id,p_user_id)))
$$;
create function public.buklod_scope_attendance_member_eligible_v1(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_user_id and p.is_active)
$$;
create function public.buklod_can_view_scope(p_scope_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.buklod_scope_memberships m
   where m.scope_id=p_scope_id and m.user_id=auth.uid()
     and m.membership_status='ACTIVE' and m.left_at is null)
$$;
insert into public.buklod_point_rules(activity_type,base_points,max_points_per_event)
values('scope_attendance',10,10);

insert into auth.users(id,is_system_admin) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',false),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',false),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
insert into public.profiles(id,full_name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Event Creator'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QR Attendee'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Independent Reviewer'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Spoofed Self Checkin'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','System Admin');

insert into public.buklod_scopes(id,name) values
 ('11111111-1111-4111-8111-111111111111','Home Cluster'),
 ('22222222-2222-4222-8222-222222222222','Hosting Organization');

insert into public.attendance_scope_operators(scope_id,user_id) values
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc');

insert into public.buklod_scope_memberships(scope_id,user_id) values
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
 ('11111111-1111-4111-8111-111111111111','dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
