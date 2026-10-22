-- Disposable schema for the cloud Kabihasnang Ligaw R5 test. Not production.
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table if not exists public.buklod_point_rules (
  activity_type text primary key,
  label text,
  base_points integer,
  max_points_per_event integer,
  daily_cap_points integer,
  weekly_cap_points integer,
  is_active boolean,
  notes text,
  updated_at timestamptz
);

create table if not exists public.buklod_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  direction text not null,
  points integer not null,
  activity_type text not null,
  source_key text not null,
  source_id uuid,
  description text,
  awarded_by uuid,
  claim_state text,
  unique (user_id, source_key)
);

create or replace function public.buklod_is_system_admin()
returns boolean
language sql
stable
as $$
  select current_setting('kl.test_admin', true) = 'on'
$$;

grant execute on function public.buklod_is_system_admin() to anon, authenticated;
grant usage on schema public to anon, authenticated;
