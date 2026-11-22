-- Public profile lifetime BP: verified balance, never available cash/earnings.
-- Canonical source: buklod_user_points_balances.lifetime_points.
-- One authenticated read-only result; locked and Official profiles are private.
-- Harden legacy direct helpers which previously bypassed profile privacy.
REVOKE ALL ON FUNCTION public.buklod_lifetime_points_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buklod_points_for(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_buklod_member_lifetime_points_v1(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $points$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
  v_points bigint;
BEGIN
  IF v_viewer IS NULL OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.is_active = true
  ) THEN
    RETURN NULL;
  END IF;

  IF private.buklod_is_platform_official_v1(p_user_id) THEN
    RETURN NULL;
  END IF;

  IF v_viewer <> p_user_id AND EXISTS (
    SELECT 1 FROM public.buklod_user_preferences u
    WHERE u.user_id = p_user_id AND u.profile_locked IS TRUE
  ) THEN
    RETURN NULL;
  END IF;

  SELECT GREATEST(0, COALESCE(b.lifetime_points, 0))::bigint
    INTO v_points
  FROM public.buklod_user_points_balances b
  WHERE b.user_id = p_user_id;
  RETURN COALESCE(v_points, 0)::bigint;
END;
$points$;

REVOKE ALL ON FUNCTION public.get_buklod_member_lifetime_points_v1(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_buklod_member_lifetime_points_v1(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_buklod_member_lifetime_points_v1(uuid)
IS 'Read-only exact lifetime earned Points for authenticated viewers of unlocked active member profiles; no balances, earnings or Official points exposed.';
