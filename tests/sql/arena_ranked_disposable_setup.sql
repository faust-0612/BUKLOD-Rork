-- Disposable PostgreSQL harness ONLY. Mirrors the relevant type contracts from
-- existing BUKLOD Main tables; never connects to any real user data or project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.buklod_points_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  activity_type text NOT NULL,
  direction text NOT NULL,
  claim_state text NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.buklod_character_collectible_state (
  user_id uuid REFERENCES auth.users(id),
  character_id text NOT NULL,
  level_no integer NOT NULL,
  item_index integer NOT NULL,
  redeemed_at timestamptz
);
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002'),
 ('00000000-0000-4000-8000-000000000003'),
 ('00000000-0000-4000-8000-000000000004');
INSERT INTO public.buklod_points_ledger(id,user_id,activity_type,direction,claim_state,points) VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','learning_progress_verification','credit','claimed',10),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','community_mutual_support_chain','credit','claimed',10),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','learning_progress_verification','credit','claimed',10),
 ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','learning_progress_verification','credit','claimed',10),
 ('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','learning_progress_verification','credit','claimed',10),
 ('10000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','learning_progress_verification','credit','claimed',10),
 ('10000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000003','r36_engager_comment','credit','pending',10);
