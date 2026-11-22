-- Disposable PostgreSQL 17 contract test: NO PRODUCTION CONNECTION.
-- Test schema is derived from 2026-11-22 read-only live information_schema.
\set ON_ERROR_STOP on
BEGIN;

CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE FUNCTION public.is_system_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.buklod_scopes (
  id uuid PRIMARY KEY, scope_type text NOT NULL, status text NOT NULL, name text NOT NULL
);
CREATE TABLE public.buklod_scope_memberships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_id uuid NOT NULL, user_id uuid NOT NULL,
  membership_status text NOT NULL, left_at timestamptz
);
CREATE TABLE public.buklod_scope_role_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scope_id uuid NOT NULL, user_id uuid NOT NULL,
  role_key text NOT NULL, status text NOT NULL, revoked_at timestamptz
);
CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text NOT NULL);
CREATE TABLE public.attendance_events (
  id uuid PRIMARY KEY, scope_id uuid, title text NOT NULL,
  location text, starts_at timestamptz NOT NULL, is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.buklod_home_event_checkins_r3 (
  id uuid PRIMARY KEY, scope_id uuid NOT NULL, event_id uuid NOT NULL,
  user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz, reviewed_by uuid, review_note text, ledger_id uuid
);
CREATE TABLE public.buklod_point_rules (
  activity_type text NOT NULL, is_active boolean NOT NULL,
  base_points integer NOT NULL, max_points_per_event integer
);
CREATE TABLE public.buklod_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, direction text NOT NULL, points integer NOT NULL,
  activity_type text NOT NULL, source_key text NOT NULL, source_id uuid,
  description text, awarded_by uuid,
  UNIQUE(user_id,source_key)
);

INSERT INTO public.buklod_scopes VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CLUSTER','ACTIVE','Alpha Cluster'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','CLUSTER','ACTIVE','Beta Cluster');
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111','Alpha admin'),
 ('22222222-2222-4222-8222-222222222222','Left admin'),
 ('33333333-3333-4333-8333-333333333333','Alpha member'),
 ('44444444-4444-4444-8444-444444444444','Outside member'),
 ('55555555-5555-4555-8555-555555555555','Revoked admin'),
 ('88888888-8888-4888-8888-888888888888','Beta admin');
INSERT INTO public.buklod_scope_memberships(scope_id,user_id,membership_status,left_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','ACTIVE',NULL),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','LEFT',now()),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','ACTIVE',NULL),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','ACTIVE',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','88888888-8888-4888-8888-888888888888','ACTIVE',NULL),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444','ACTIVE',NULL);
INSERT INTO public.buklod_scope_role_assignments(scope_id,user_id,role_key,status,revoked_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','ADMIN','ACTIVE',NULL),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','CLUSTER_ADMIN','ACTIVE',NULL),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','ADMIN','REVOKED',now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','88888888-8888-4888-8888-888888888888','CLUSTER_ADMIN','ACTIVE',NULL);
INSERT INTO public.attendance_events VALUES
 ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Meeting','Alpha Hall',now(),true),
 ('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Workshop','Alpha Hall',now(),true),
 ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Beta Meeting','Beta Hall',now(),true);
INSERT INTO public.buklod_home_event_checkins_r3(id,scope_id,event_id,user_id,status) VALUES
 ('aaaaaaaa-0001-4001-8001-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','pending'),
 ('aaaaaaaa-0002-4002-8002-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','pending'),
 ('aaaaaaaa-0003-4003-8003-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','pending'),
 ('bbbbbbbb-0001-4001-8001-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444','pending');
INSERT INTO public.buklod_point_rules VALUES ('scope_attendance',true,10,10);

-- Apply the ACTUAL candidate migration to disposable fixtures, not copies.
\i supabase/migrations/20261122090000_cluster_scoped_home_checkin_review_v1.sql

DO $$
BEGIN
 IF has_function_privilege('anon','public.cluster_review_buklod_home_checkin_v1(uuid,boolean,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous reviewers have function execution privilege';
 END IF;
 IF NOT has_function_privilege('authenticated','public.cluster_review_buklod_home_checkin_v1(uuid,boolean,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Authenticated Cluster Admin function grant missing';
 END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $$
DECLARE denied boolean:=false;
BEGIN
 IF public.buklod_cluster_can_review_home_checkin_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
   RAISE EXCEPTION 'Ordinary member accepted as Cluster Admin';
 END IF;
 BEGIN PERFORM public.cluster_get_buklod_home_checkin_queue_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Ordinary member can enumerate check-in queue'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$
BEGIN
 IF public.buklod_cluster_can_review_home_checkin_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
   RAISE EXCEPTION 'Left former Cluster Admin retained approval rights';
 END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
DO $$
BEGIN
 IF public.buklod_cluster_can_review_home_checkin_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
   RAISE EXCEPTION 'Revoked Cluster Admin retained approval rights';
 END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$
DECLARE q jsonb; outcome jsonb; blocked boolean;
BEGIN
 IF NOT public.buklod_cluster_can_review_home_checkin_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
   RAISE EXCEPTION 'Active exact-Cluster Admin access denied';
 END IF;
 q:=public.cluster_get_buklod_home_checkin_queue_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 IF jsonb_array_length(q)<>3 THEN RAISE EXCEPTION 'Cluster A queue count wrong'; END IF;
 IF (q->0->>'cluster') <> 'Alpha Cluster' THEN RAISE EXCEPTION 'Wrong Cluster queue'; END IF;
 blocked:=false;
 BEGIN PERFORM public.cluster_get_buklod_home_checkin_queue_v1('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-Cluster queue enumeration allowed'; END IF;
 blocked:=false;
 BEGIN PERFORM public.cluster_review_buklod_home_checkin_v1('bbbbbbbb-0001-4001-8001-bbbbbbbbbbbb',true,'Not my cluster');
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-Cluster verification allowed'; END IF;
 blocked:=false;
 BEGIN PERFORM public.cluster_review_buklod_home_checkin_v1('aaaaaaaa-0002-4002-8002-aaaaaaaaaaaa',true,'Own check in');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Another Cluster Admin%'; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cluster Admin could verify own check-in'; END IF;
 blocked:=false;
 BEGIN PERFORM public.cluster_review_buklod_home_checkin_v1('aaaaaaaa-0001-4001-8001-aaaaaaaaaaaa',true,'Short');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%at least 8 characters%'; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Short evidence note accepted'; END IF;
 outcome:=public.cluster_review_buklod_home_checkin_v1('aaaaaaaa-0001-4001-8001-aaaaaaaaaaaa',true,'Verified in person at entry');
 IF outcome->>'status'<>'approved' OR outcome->>'credited'<>'true' OR (outcome->>'points')::int<>10 THEN
   RAISE EXCEPTION 'Approval did not award exactly 10 BP';
 END IF;
 blocked:=false;
 BEGIN PERFORM public.cluster_review_buklod_home_checkin_v1('aaaaaaaa-0001-4001-8001-aaaaaaaaaaaa',true,'Retried the same approval');
 EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%Already reviewed%'; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Duplicate approval accepted'; END IF;
 outcome:=public.cluster_review_buklod_home_checkin_v1('aaaaaaaa-0003-4003-8003-aaaaaaaaaaaa',false,'No attendance evidence supplied');
 IF outcome->>'status'<>'rejected' OR outcome->>'credited'<>'false' THEN
   RAISE EXCEPTION 'Rejection processed as paid approval';
 END IF;
END $$;
RESET ROLE;

DO $$
DECLARE v integer; st text;
BEGIN
 SELECT count(*) INTO v FROM public.buklod_points_ledger;
 IF v<>1 THEN RAISE EXCEPTION 'Expected one and only one ledger credit, got %',v; END IF;
 SELECT points INTO v FROM public.buklod_points_ledger;
 IF v<>10 THEN RAISE EXCEPTION 'Invalid attendance BP credit'; END IF;
 SELECT status INTO st FROM public.buklod_home_event_checkins_r3 WHERE id='aaaaaaaa-0002-4002-8002-aaaaaaaaaaaa';
 IF st<>'pending' THEN RAISE EXCEPTION 'Self-attendance must remain pending'; END IF;
 SELECT status INTO st FROM public.buklod_home_event_checkins_r3 WHERE id='bbbbbbbb-0001-4001-8001-bbbbbbbbbbbb';
 IF st<>'pending' THEN RAISE EXCEPTION 'Unrelated Cluster check-in was modified'; END IF;
 SELECT status INTO st FROM public.buklod_home_event_checkins_r3 WHERE id='aaaaaaaa-0003-4003-8003-aaaaaaaaaaaa';
 IF st<>'rejected' THEN RAISE EXCEPTION 'Rejected claim was not audited'; END IF;
END $$;
\echo CLUSTER_ADMIN_ISOLATED_ROLE_LEDGER_CONTRACT_PASS
ROLLBACK;
