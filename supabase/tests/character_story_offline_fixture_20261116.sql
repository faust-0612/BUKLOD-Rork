-- Ephemeral PostgreSQL 17 compatibility fixture only; NEVER apply to live Supabase.
-- Covers referenced column types and auth/Storage API shape, not complete production logic.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema private;
create schema storage;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
 language sql stable as $f$
 select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
 $f$;
create table storage.buckets (
 id text primary key, name text not null, public boolean not null,
 file_size_limit bigint, allowed_mime_types text[]
);
create table private.buklod_character_selection_v2(
 user_id uuid primary key references auth.users(id),
 character_id text not null default 'phan',
 baseline_lifetime_points bigint not null default 0
);
create table private.buklod_character_progress_v3(
 user_id uuid not null references auth.users(id),
 character_id text not null, earned_points bigint not null default 0,
 primary key(user_id,character_id)
);
create table private.buklod_character_public_events_v3(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id),
 metric_key text not null, source_table text not null,
 source_id text not null, occurred_at timestamptz not null default now()
);
create table public.buklod_points_ledger(
 id uuid primary key, user_id uuid not null references auth.users(id),
 direction text not null, points integer not null,
 activity_type text not null, claim_state text not null,
 created_at timestamptz not null default now()
);
create or replace function public.get_my_buklod_character_selection_v2()
 returns jsonb language sql stable security definer set search_path=''
 as $f$ select pg_catalog.jsonb_build_object(
 'character_levels',pg_catalog.jsonb_build_object('phan',1,'quin',1,'van',1,'christian',1,'lhen',1),
 'visible_special_character_ids','[]'::jsonb) $f$;
create or replace function public.buklod_lifetime_points_for(p_user_id uuid)
 returns bigint language sql stable as $f$ select 0::bigint $f$;
create or replace function private.buklod_character_level_for_delta_v2(p_points_delta bigint)
 returns smallint language sql stable as $f$
 select least(20,greatest(1,1+(p_points_delta/100)::integer))::smallint $f$;
