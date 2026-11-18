-- LOCAL CI POSTGRES FIXTURE ONLY. NEVER run against BUKLOD Supabase.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
grant usage on schema auth to service_role;
create table auth.users(id uuid primary key);
create table public.buklod_rank_seasons(
  id uuid primary key, season_number integer, status text);
create table public.buklod_rank_season_results(
  season_id uuid not null, user_id uuid);
create table public.community_posts(
  id uuid primary key,user_id uuid not null,scope_id uuid,
  category text,body text,media_path text,author_only boolean,
  deleted_at timestamptz,is_hidden boolean,created_at timestamptz not null);
create table public.comments(
  id uuid primary key,post_id uuid not null,user_id uuid not null,body text,
  deleted_at timestamptz,is_hidden boolean,created_at timestamptz not null);
create table public.buklod_community_dugtongs(
  id uuid primary key,user_id uuid not null,root_post_id uuid not null,body text,
  deleted_at timestamptz,moderation_state text,created_at timestamptz not null);
create table public.kl_quiz_attempts(
  id uuid primary key,episode_id uuid not null,user_id uuid not null,
  verified_at timestamptz);
create table public.kl_reading_sessions(
  user_id uuid not null,episode_id uuid not null,
  completed_at timestamptz,
  primary key(user_id,episode_id));
create table public.buklod_scope_memberships(
  user_id uuid not null,scope_id uuid not null,
  membership_status text,joined_at timestamptz,left_at timestamptz);
grant select on all tables in schema public to service_role;
insert into auth.users(id)values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.buklod_rank_seasons(id,season_number,status)
 values('11111111-1111-4111-8111-111111111111',1,'active');
