-- BUKLOD LIFE isolated security contract. Execute ONLY against disposable PostgreSQL.
-- This harness never connects to Supabase or any live BUKLOD environment.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.buklod_referrals (
  id uuid primary key,
  referrer_id uuid not null,
  referred_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.notifications (
  user_id uuid not null,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb
);
-- Simulate the legacy own-user getter without exposing anyone else's journey.
create or replace function public.get_my_buklod_life_journey_v1()
returns jsonb language sql stable security definer set search_path = ''
as $$ select jsonb_build_object('authenticated', auth.uid() is not null, 'stage', 'NONE') $$;
revoke all on function public.get_my_buklod_life_journey_v1() from public, anon;
grant execute on function public.get_my_buklod_life_journey_v1() to authenticated;
-- The exact production-source migration must compile and run unchanged.
\ir ../supabase/migrations/20261115125000_buklod_life_no_inferred_milestones.sql
\ir ../supabase/tests/20261115_life_privacy.sql
-- Distinct inviter accounts, and one person referred by each.
insert into public.buklod_referrals (id, referrer_id, referred_id) values
('10000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('10000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('10000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
do $life_test$
declare
  v_impact jsonb;
  v_journey jsonb;
begin
  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  v_impact := public.get_my_buklod_life_impact_v1();
  if (v_impact->>'people_reached')::integer <> 2 then raise exception 'Inviter A count wrong'; end if;
  if (v_impact->>'faith_journeys_started')::integer <> 0 or (v_impact->'recent_activity') <> '[]'::jsonb
  then raise exception 'Inviter A sees sensitive status'; end if;
  v_journey := public.buklod_life_mark_my_stage_v1('NEW_BEGINNING');
  if v_journey->>'stage' <> 'NONE' then raise exception 'Legacy stage RPC mutated journey'; end if;
  if (select count(*) from public.notifications) <> 0 then raise exception 'Stage created forbidden notice'; end if;
  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  v_impact := public.get_my_buklod_life_impact_v1();
  if (v_impact->>'people_reached')::integer <> 1 then raise exception 'Inviter B can see A counts'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  if auth.uid() is not null then raise exception 'Anonymous identity stub leaked'; end if;
end;
$life_test$;
-- Actual authenticated role can execute, anon cannot.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select public.buklod_life_mark_my_stage_v1('SEEKING');
select public.get_my_buklod_life_impact_v1();
reset role;
do $priv_test$
begin
  if has_function_privilege('anon', 'public.buklod_life_mark_my_stage_v1(text)', 'execute')
    or has_function_privilege('anon','public.get_my_buklod_life_impact_v1()','execute')
  then raise exception 'Anonymous RPC execution improperly allowed'; end if;
  if not has_function_privilege('authenticated', 'public.buklod_life_mark_my_stage_v1(text)','execute')
    or not has_function_privilege('authenticated','public.get_my_buklod_life_impact_v1()','execute')
  then raise exception 'Authenticated RPC compatibility broken'; end if;
end;
$priv_test$;
select 'BUKLOD LIFE ISOLATED POSTGRESQL PRIVACY PASS' as result;
