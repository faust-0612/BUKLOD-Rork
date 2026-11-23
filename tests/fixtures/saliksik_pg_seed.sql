-- ONLY for ephemeral Postgres CI. Never apply to live BUKLOD.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth,storage,public TO authenticated,anon;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $q$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $q$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),is_active boolean NOT NULL DEFAULT true);
CREATE FUNCTION public.is_system_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $q$
 SELECT auth.uid()='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
 AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active) $q$;
CREATE TABLE public.buklod_scopes(id uuid PRIMARY KEY,scope_type text NOT NULL,status text NOT NULL);
CREATE TABLE public.buklod_scope_memberships(scope_id uuid NOT NULL REFERENCES public.buklod_scopes(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),membership_status text NOT NULL,
 PRIMARY KEY(scope_id,user_id));
CREATE FUNCTION public.buklod_user_is_active_scope_member(p_scope_id uuid,p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $q$
 SELECT EXISTS(SELECT 1 FROM public.buklod_scope_memberships m WHERE m.scope_id=p_scope_id
 AND m.user_id=p_user_id AND m.membership_status='ACTIVE') $q$;
CREATE TABLE public.buklod_point_rules(
 activity_type text PRIMARY KEY,label text NOT NULL,base_points integer NOT NULL,
 max_points_per_event integer,daily_cap_points integer,weekly_cap_points integer,
 is_active boolean NOT NULL DEFAULT true,notes text
);
CREATE TABLE public.buklod_points_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 direction text NOT NULL DEFAULT 'credit',
 points integer NOT NULL CHECK(points>0),
 activity_type text NOT NULL,
 source_key text NOT NULL,
 source_id uuid,
 description text,
 awarded_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 claim_state text,
 UNIQUE(user_id,source_key)
);
CREATE FUNCTION public.test_points_claim_pending() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.direction='credit' AND NEW.claim_state IS NULL THEN NEW.claim_state:='pending'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER test_pending BEFORE INSERT ON public.buklod_points_ledger
FOR EACH ROW EXECUTE FUNCTION public.test_points_claim_pending();
CREATE TABLE public.buklod_reward_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 source_point_id uuid NOT NULL UNIQUE REFERENCES public.buklod_points_ledger(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.test_points_to_events() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.direction='credit' AND NEW.claim_state='pending' THEN
  INSERT INTO public.buklod_reward_events(user_id,source_point_id)
  VALUES (NEW.user_id,NEW.id) ON CONFLICT(source_point_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER test_reward AFTER INSERT ON public.buklod_points_ledger
FOR EACH ROW EXECUTE FUNCTION public.test_points_to_events();
CREATE TABLE storage.buckets(
 id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL,
 file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text NOT NULL REFERENCES storage.buckets(id),name text NOT NULL,
 UNIQUE(bucket_id,name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO auth.users(id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),('cccccccc-cccc-cccc-cccc-cccccccccccc');
INSERT INTO public.profiles(id) SELECT id FROM auth.users;
INSERT INTO public.buklod_scopes(id,scope_type,status)
VALUES ('11111111-1111-1111-1111-111111111111','CLUSTER','ACTIVE');
INSERT INTO public.buklod_scope_memberships(scope_id,user_id,membership_status)
VALUES ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','ACTIVE');
