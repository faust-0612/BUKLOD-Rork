-- Public profile lifetime BP: verified balance, never available cash/earnings.
-- Canonical source: buklod_user_points_balances.lifetime_points.
-- One authenticated read-only result; public lifetime BP is visible on locked profiles.
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

  -- Profile Lock does not conceal the user-approved public earned lifetime BP.

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
IS 'Read-only earned Lifetime BP for authenticated viewers of active members including locked profiles; never balance, finance or BUKLOD Official.';
-- The member identity summary is public even when Profile Lock is enabled:
-- avatar, background, note, active cluster names, Circle Rank and all-time rank.
-- Keep username/member-since/shared-community history and personal posts restricted.
CREATE OR REPLACE FUNCTION public.get_buklod_member_public_profile_v1(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $profile$
DECLARE
  viewer uuid := (SELECT auth.uid());
  target uuid := p_user_id;
  profile_row public.profiles%ROWTYPE;
  locked boolean := false;
  quick_note text := null;
  clusters jsonb := '[]'::jsonb;
  shared_scopes jsonb := '[]'::jsonb;
  circle_rank text := null;
  lifetime_rank bigint := null;
  member_since text := null;
  display_name text := 'BUKLOD Member';
BEGIN
  IF viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;
  SELECT * INTO profile_row
  FROM public.profiles p WHERE p.id = target AND p.is_active = true LIMIT 1;
  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  display_name := COALESCE(
    NULLIF(btrim(profile_row.full_name), ''),
    NULLIF(btrim(profile_row.username), ''), 'BUKLOD Member'
  );

  SELECT COALESCE(pref.profile_locked, false)
    INTO locked
  FROM public.buklod_user_preferences pref
  WHERE pref.user_id = target;
  locked := COALESCE(locked, false);

  SELECT NULLIF(btrim(st.quick_note), '') INTO quick_note
  FROM public.buklod_profile_status st
  WHERE st.user_id = target
    AND (st.quick_note_expires_at IS NULL OR st.quick_note_expires_at > now())
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(c.name ORDER BY c.name), '[]'::jsonb)
    INTO clusters
  FROM (
    SELECT DISTINCT s.name
    FROM public.buklod_scope_memberships m
    JOIN public.buklod_scopes s ON s.id = m.scope_id
    WHERE m.user_id = target
      AND m.membership_status = 'ACTIVE'
      AND m.left_at IS NULL
      AND s.scope_type = 'CLUSTER'
      AND s.status = 'ACTIVE'
      AND s.name IS NOT NULL
    ORDER BY s.name
    LIMIT 8
  ) c;

  -- Canonical Circle Rank resolver excludes BUKLOD Official identity.
  SELECT r.rank_name INTO circle_rank
  FROM public.get_member_circle_ranks_v1(ARRAY[target]) r
  WHERE r.user_id = target LIMIT 1;

  -- Same all-time ordering and Official exclusion as the public BP leaderboard.
  SELECT ranked.rank_position INTO lifetime_rank
  FROM (
    SELECT p.id,
      row_number() OVER (ORDER BY b.lifetime_points DESC, p.full_name, p.id)::bigint AS rank_position
    FROM public.buklod_user_points_balances b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.is_active = true AND b.lifetime_points > 0
      AND NOT private.buklod_is_platform_official_v1(p.id)
  ) ranked
  WHERE ranked.id = target;

  -- Profile lock protects private details, not the approved public identity.
  IF viewer <> target AND locked THEN
    RETURN jsonb_build_object(
      'user_id', target, 'is_self', false, 'is_locked', true,
      'can_view_details', false, 'display_name', display_name,
      'username', null, 'member_since', null,
      'shared_scope_labels', '[]'::jsonb,
      'avatar_url', NULLIF(btrim(profile_row.avatar_url), ''),
      'background_url', NULLIF(btrim(profile_row.profile_background_url), ''),
      'quick_note', quick_note, 'cluster_labels', clusters,
      'circle_rank', circle_rank, 'all_time_rank', lifetime_rank
    );
  END IF;

  member_since := to_char(COALESCE(profile_row.created_at, now()), 'Mon YYYY');
  SELECT COALESCE(jsonb_agg(shared.name ORDER BY shared.name), '[]'::jsonb)
  INTO shared_scopes
  FROM (
    SELECT DISTINCT s.name
    FROM public.buklod_scope_memberships mine
    JOIN public.buklod_scope_memberships theirs
      ON theirs.scope_id = mine.scope_id
      AND theirs.user_id = target AND theirs.membership_status = 'ACTIVE'
    JOIN public.buklod_scopes s ON s.id = mine.scope_id
    WHERE mine.user_id = viewer AND mine.membership_status = 'ACTIVE'
    ORDER BY s.name LIMIT 8
  ) shared(name);

  RETURN jsonb_build_object(
    'user_id', target, 'is_self', viewer = target,
    'is_locked', locked, 'can_view_details', true,
    'display_name', display_name,
    'username', NULLIF(btrim(profile_row.username), ''),
    'member_since', member_since,
    'shared_scope_labels', COALESCE(shared_scopes, '[]'::jsonb),
    'avatar_url', NULLIF(btrim(profile_row.avatar_url), ''),
    'background_url', NULLIF(btrim(profile_row.profile_background_url), ''),
    'quick_note', quick_note, 'cluster_labels', clusters,
    'circle_rank', circle_rank, 'all_time_rank', lifetime_rank
  );
END;
$profile$;
REVOKE ALL ON FUNCTION public.get_buklod_member_public_profile_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_buklod_member_public_profile_v1(uuid)
  TO authenticated, service_role;

