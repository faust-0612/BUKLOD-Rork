-- Ephemeral PostgreSQL 17 CI fixture. NEVER run this against a live project.
-- Creates only synthetic identities and minimal structure for the exact v1
-- migration. The script runs in GitHub's disposable postgres service.
do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end$$;
create schema if not exists auth;
grant usage on schema auth, public to anon, authenticated;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table if not exists public.profiles (
  id uuid primary key,
  is_active boolean not null default true
);
create table if not exists public.bsoc_health_events (
  id uuid primary key,
  user_id uuid not null,
  occurred_at timestamptz not null,
  health_category text not null,
  safe_error_code text not null,
  error_signature text not null
);
create or replace function public.buklod_bsoc_can(permission text) returns boolean
language sql stable as $$
  select coalesce(current_setting('bsoc.test_allowed',true)='true',false);
$$;
insert into public.profiles (id,is_active) values
('11111111-1111-4111-8111-111111111111',true),
('22222222-2222-4222-8222-222222222222',true),
('33333333-3333-4333-8333-333333333333',false);
insert into public.bsoc_health_events(id,user_id,occurred_at,health_category,safe_error_code,error_signature) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',now(),'ROUTE','SYS-500','RENDER_3E577D35'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',now(),'ROUTE','SYS-500','RENDER_3E577D35'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',now(),'AUTH','AUTH-500','AUTH_FAILED');
