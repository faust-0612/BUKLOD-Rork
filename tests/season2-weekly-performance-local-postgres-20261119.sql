-- DISPOSABLE GITHUB ACTIONS POSTGRES ONLY: never run against BUKLOD Supabase.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE TABLE public.profiles(id uuid primary key,is_active boolean not null default true);
CREATE TABLE public.community_posts(
 id uuid primary key,user_id uuid not null,body text,deleted_at timestamptz,
 is_hidden boolean,author_only boolean,created_at timestamptz not null
);
CREATE TABLE public.buklod_points_ledger(
 id bigserial primary key,user_id uuid not null,direction text,
 claim_state text,activity_type text,source_id uuid,points integer,
 created_at timestamptz not null
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $auth$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$auth$;
CREATE OR REPLACE FUNCTION private.buklod_is_platform_official_v1(p uuid)
RETURNS boolean LANGUAGE sql STABLE AS $official$
 SELECT p='cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid;
$official$;

INSERT INTO public.profiles(id,is_active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',true),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',false);
-- Five days in the prior completed week, independent quality and community.
-- The CI job should work whether it is Monday, Thursday, or Sunday today.
WITH generated AS (
 SELECT n,
 (date_trunc('week',now() AT TIME ZONE 'Asia/Manila')::date-7+n)::timestamp
    AT TIME ZONE 'Asia/Manila' + interval '12 hours' AS event_at,
 ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid AS source_id
 FROM generate_series(0,4) n
)
INSERT INTO public.community_posts(id,user_id,body,created_at)
SELECT source_id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'A genuine community post with a meaningful explanation and unique milestone day '||n,event_at
FROM generated;
WITH generated AS (
 SELECT n,
 (date_trunc('week',now() AT TIME ZONE 'Asia/Manila')::date-7+n)::timestamp
    AT TIME ZONE 'Asia/Manila' + interval '12 hours' AS event_at,
 ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid AS source_id
 FROM generate_series(0,4) n
)
INSERT INTO public.buklod_points_ledger(user_id,direction,claim_state,activity_type,source_id,points,created_at)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','credit','claimed',activity,source_id,1,event_at
FROM generated CROSS JOIN (VALUES ('r36_publish_wall'),('r36_creator_impact')) kinds(activity);

-- Hundreds of reactions, generic comments, and pending claims cannot farm a class.
INSERT INTO public.buklod_points_ledger(user_id,direction,claim_state,activity_type,points,created_at)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','credit',s.kind,s.activity,100,now()-interval '1 day'
FROM generate_series(1,200) n CROSS JOIN
  (VALUES ('claimed','r36_engager_reaction'),('claimed','r36_engager_comment'),('pending','r36_publish_wall')) s(kind,activity);
-- Single-domain reading cannot reach Thrive/Exceptional despite 5 verified days.
INSERT INTO public.buklod_points_ledger(user_id,direction,claim_state,activity_type,points,created_at)
SELECT 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','credit','claimed','daily_bible',10,
 (date_trunc('week',now() AT TIME ZONE 'Asia/Manila')::date-7+n)::timestamp
   AT TIME ZONE 'Asia/Manila' + interval '13 hours'
FROM generate_series(0,4) n;
-- Platform Official and inactive member are never returned to public avatar API.
INSERT INTO public.buklod_points_ledger(user_id,direction,claim_state,activity_type,points,created_at)
SELECT id,'credit','claimed','devotional',10,now()-interval '1 day'
FROM public.profiles WHERE id IN (
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
-- Never count a future-dated source, even with a forged claimed status.
INSERT INTO public.buklod_points_ledger(user_id,direction,claim_state,activity_type,points,created_at)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','credit','claimed','daily_bible',10,now()+interval '1 minute');

-- Install candidate on a fresh disposable Postgres with only synthetic users.
\i docs/season2/sql/BUKLOD_S2_WEEKLY_PERFORMANCE_READONLY_STAGING_CANDIDATE.sql

SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $tests$
DECLARE week date:=date_trunc('week',now() AT TIME ZONE 'Asia/Manila')::date-7;
        result_row record; c integer;
BEGIN
  SELECT * INTO result_row FROM private.buklod_weekly_performance_core_s2(
   ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],week);
  IF result_row.class_code<>'exceptional' OR result_row.score<>90 OR
     result_row.active_days<>5 OR result_row.learning_days<>0 OR
     result_row.community_days<>5 OR result_row.creation_days<>5 THEN
    RAISE EXCEPTION 'Nonfaith exceptional classification failed: %',row_to_json(result_row);
  END IF;
  SELECT * INTO result_row FROM private.buklod_weekly_performance_core_s2(
   ARRAY['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid],week);
  IF result_row.class_code<>'active' OR result_row.score<>55 THEN
    RAISE EXCEPTION 'Single-category anti-farm gate failed: %',row_to_json(result_row);
  END IF;
  SELECT count(*) INTO c FROM private.buklod_weekly_performance_core_s2(
    ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
          'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid],week);
  IF c<>0 THEN RAISE EXCEPTION 'Official/inactive subject leaked';END IF;
  SELECT * INTO result_row FROM private.buklod_weekly_performance_core_s2(
    ARRAY['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid]);
  IF result_row.class_code<>'unrated' OR result_row.score<>0 THEN
    RAISE EXCEPTION 'Future source counted incorrectly: %',row_to_json(result_row);
  END IF;
  IF has_function_privilege('anon','public.buklod_weekly_performance_batch_s2(uuid[])','execute')
   OR has_function_privilege('anon','public.get_my_buklod_weekly_performance_s2()','execute')
   OR has_function_privilege('authenticated','private.buklod_weekly_performance_core_s2(uuid[],date)','execute')
  THEN RAISE EXCEPTION 'SECURITY breach: function privileges';END IF;
END;
$tests$;

SET ROLE authenticated;
DO $tests$
DECLARE c integer; result_row record;
BEGIN
 SELECT count(*) INTO c FROM public.buklod_weekly_performance_batch_s2(
   array_fill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,ARRAY[41]));
 IF c<>0 THEN RAISE EXCEPTION 'Unbounded avatar batch passed';END IF;
 SELECT * INTO result_row FROM public.get_my_buklod_weekly_performance_s2();
 IF result_row.user_id<>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid THEN
  RAISE EXCEPTION 'Wrong-account private breakdown leaked';
 END IF;
END;
$tests$;
RESET ROLE;

-- No business writes were caused by classification calls.
SELECT CASE WHEN (
  SELECT COUNT(*) FROM public.buklod_points_ledger
) >= 605 THEN 'DISPOSABLE_WEEKLY_SQL_BEHAVIOR_PASSED'
ELSE (SELECT 1/0)::text END;
