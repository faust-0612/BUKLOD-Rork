-- Production migration 20261030085450: already applied in
-- yhanxndaqbmuzbdqlblu through Supabase's migration API.
-- The preflight demonstrated 545 active cards could be read as anon
-- through the definer view, while the protected profiles table yielded 0.
-- Preserve the projection and enforce RLS using caller permissions.
ALTER VIEW public.public_profile_cards SET (security_invoker = true);

-- A profile-card projection is READ ONLY. It must never expose owner-
-- privileged reads or writes through PostgREST to browser roles.
REVOKE ALL PRIVILEGES ON TABLE public.public_profile_cards
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profile_cards TO authenticated;

-- Fail migration atomically if the caller-RLS and least-privilege
-- contract cannot be enforced; do not alter profiles policies or data.
DO $buklod$
DECLARE
  invoker_enabled boolean;
  profile_rls_enabled boolean;
BEGIN
  SELECT 'security_invoker=true' = ANY(coalesce(c.reloptions, array[]::text[]))
  INTO invoker_enabled
  FROM pg_class c WHERE c.oid='public.public_profile_cards'::regclass;

  SELECT c.relrowsecurity INTO profile_rls_enabled
  FROM pg_class c WHERE c.oid='public.profiles'::regclass;

  IF NOT coalesce(invoker_enabled,false) OR NOT coalesce(profile_rls_enabled,false)
     OR has_table_privilege('anon','public.public_profile_cards','SELECT')
     OR has_table_privilege('anon','public.public_profile_cards','UPDATE')
     OR has_table_privilege('authenticated','public.public_profile_cards','UPDATE')
     OR NOT has_table_privilege('authenticated','public.public_profile_cards','SELECT')
  THEN
    RAISE EXCEPTION 'public_profile_cards security contract not met';
  END IF;
END;
$buklod$;
