-- TRACKED MIRROR ONLY. Do not apply this file with supabase db query -f.
-- Canonical migration:
--   supabase/migrations/20260823010000_buklod_church_map_accountability_discovery.sql
-- Canonical apply path:
--   npx.cmd supabase db push
-- Nearby Churches v1: p_scope_types defaults to ARRAY['CHURCH'].
-- Additive / backward-safe. Do not store learner GPS.

BEGIN;

ALTER TABLE public.buklod_scopes
  ADD COLUMN IF NOT EXISTS latitude double precision;

ALTER TABLE public.buklod_scopes
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.buklod_scopes
  ADD COLUMN IF NOT EXISTS safe_location_label text;

ALTER TABLE public.buklod_scopes
  ADD COLUMN IF NOT EXISTS map_location_updated_at timestamptz;

ALTER TABLE public.buklod_scopes
  ADD COLUMN IF NOT EXISTS map_location_updated_by uuid;

CREATE INDEX IF NOT EXISTS buklod_scopes_church_map_idx
  ON public.buklod_scopes (scope_type)
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL;

-- Drop every existing signature of these new v1 helpers/RPCs so CREATE cannot
-- collide on a changed return type if a draft was applied outside db push.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'buklod_haversine_km_v1',
        'buklod_role_is_pastor_or_mentor_v1',
        'buklod_role_is_pastor_v1',
        'buklod_role_is_mentor_v1',
        'buklod_actor_is_system_admin_v1',
        'buklod_actor_can_manage_scope_v1',
        'buklod_scope_visibility_text_v1',
        'buklod_scope_status_text_v1',
        'buklod_church_safe_location_label_v1',
        'buklod_church_place_search_text_v1',
        'buklod_scope_is_search_visible_v1',
        'buklod_church_has_active_pastor_or_mentor_v1',
        'buklod_church_leader_people_v1',
        'buklod_accountability_search_scopes_v1',
        'buklod_set_church_map_location_v1',
        'buklod_church_readiness_summary_v1'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.buklod_haversine_km_v1(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN NULL
    ELSE 6371 * 2 * asin(
      sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) *
        power(sin(radians(lon2 - lon1) / 2), 2)
      )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.buklod_role_is_pastor_or_mentor_v1(
  p_name text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(p_name, '') ~* '(^|[^a-z])(pastor|mentor)([^a-z]|$)'
$$;

CREATE OR REPLACE FUNCTION public.buklod_role_is_pastor_v1(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(p_name, '') ~* '(^|[^a-z])pastor([^a-z]|$)'
$$;

CREATE OR REPLACE FUNCTION public.buklod_role_is_mentor_v1(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(p_name, '') ~* '(^|[^a-z])mentor([^a-z]|$)'
$$;

CREATE OR REPLACE FUNCTION public.buklod_actor_is_system_admin_v1()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := false;
BEGIN
  IF to_regprocedure('public.buklod_is_system_admin()') IS NOT NULL THEN
    EXECUTE 'SELECT public.buklod_is_system_admin()' INTO v_ok;
    RETURN coalesce(v_ok, false);
  END IF;

  IF to_regprocedure('public.is_system_admin()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_system_admin()' INTO v_ok;
    RETURN coalesce(v_ok, false);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_actor_can_manage_scope_v1(
  p_scope_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := false;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_scope_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.buklod_actor_is_system_admin_v1() THEN
    RETURN true;
  END IF;

  IF to_regprocedure('public.buklod_is_exact_scope_admin_v1(uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.buklod_is_exact_scope_admin_v1($1)'
      INTO v_ok
      USING p_scope_id;
    IF coalesce(v_ok, false) THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regclass('public.buklod_scope_role_assignments') IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.buklod_scope_role_assignments a
      WHERE a.scope_id = p_scope_id
        AND a.user_id = v_user
        AND a.status = 'ACTIVE'
        AND upper(coalesce(a.role_key, '')) IN (
          'ADMIN',
          'ORG_ADMIN',
          'CLUSTER_ADMIN',
          'CHURCH_ADMIN',
          'SYSTEM_ADMIN'
        )
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_scope_visibility_text_v1(
  p_scope_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  BEGIN
    EXECUTE
      'SELECT upper(coalesce(visibility::text, ''PUBLIC'')) FROM public.buklod_scopes WHERE id = $1'
      INTO v_text
      USING p_scope_id;
  EXCEPTION WHEN undefined_column THEN
    v_text := 'PUBLIC';
  END;

  RETURN coalesce(nullif(trim(v_text), ''), 'PUBLIC');
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_scope_status_text_v1(
  p_scope_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  BEGIN
    EXECUTE
      'SELECT upper(coalesce(scope_status::text, status::text, ''ACTIVE'')) FROM public.buklod_scopes WHERE id = $1'
      INTO v_text
      USING p_scope_id;
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      EXECUTE
        'SELECT upper(coalesce(status::text, ''ACTIVE'')) FROM public.buklod_scopes WHERE id = $1'
        INTO v_text
        USING p_scope_id;
    EXCEPTION WHEN undefined_column THEN
      v_text := 'ACTIVE';
    END;
  END;

  RETURN coalesce(nullif(trim(v_text), ''), 'ACTIVE');
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_church_safe_location_label_v1(
  p_scope_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_barangay text;
  v_city text;
  v_table text;
  v_scope_col text;
  v_sql text;
BEGIN
  SELECT nullif(trim(s.safe_location_label), '')
  INTO v_label
  FROM public.buklod_scopes s
  WHERE s.id = p_scope_id;

  IF v_label IS NOT NULL THEN
    RETURN v_label;
  END IF;

  SELECT c.table_name,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = 'public'
          AND x.table_name = c.table_name
          AND x.column_name = 'scope_id'
      ) THEN 'scope_id'
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = 'public'
          AND x.table_name = c.table_name
          AND x.column_name = 'church_scope_id'
      ) THEN 'church_scope_id'
      ELSE NULL
    END
  INTO v_table, v_scope_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name = 'city_municipality'
    AND c.table_name ~* 'church'
  ORDER BY c.table_name
  LIMIT 1;

  IF v_table IS NOT NULL AND v_scope_col IS NOT NULL THEN
    v_sql := format(
      'SELECT nullif(trim(coalesce(barangay::text, '''')), ''''), nullif(trim(coalesce(city_municipality::text, '''')), '''') FROM public.%I WHERE %I = $1 LIMIT 1',
      v_table,
      v_scope_col
    );
    BEGIN
      EXECUTE v_sql INTO v_barangay, v_city USING p_scope_id;
    EXCEPTION WHEN OTHERS THEN
      v_barangay := NULL;
      v_city := NULL;
    END;
  END IF;

  IF v_barangay IS NOT NULL AND v_city IS NOT NULL THEN
    RETURN v_barangay || ', ' || v_city;
  END IF;

  RETURN coalesce(v_city, v_barangay);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_church_place_search_text_v1(
  p_scope_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text := '';
  v_table text;
  v_scope_col text;
  v_sql text;
  v_extra text;
BEGIN
  SELECT concat_ws(
    ' ',
    s.name,
    s.safe_location_label,
    p.name
  )
  INTO v_text
  FROM public.buklod_scopes s
  LEFT JOIN public.buklod_scopes p
    ON p.id = s.parent_scope_id
  WHERE s.id = p_scope_id;

  SELECT c.table_name,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = 'public'
          AND x.table_name = c.table_name
          AND x.column_name = 'scope_id'
      ) THEN 'scope_id'
      WHEN EXISTS (
        SELECT 1
        FROM information_schema.columns x
        WHERE x.table_schema = 'public'
          AND x.table_name = c.table_name
          AND x.column_name = 'church_scope_id'
      ) THEN 'church_scope_id'
      ELSE NULL
    END
  INTO v_table, v_scope_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name IN ('barangay', 'city_municipality', 'province')
    AND c.table_name ~* 'church'
  GROUP BY c.table_name
  ORDER BY c.table_name
  LIMIT 1;

  IF v_table IS NOT NULL AND v_scope_col IS NOT NULL THEN
    v_sql := format(
      'SELECT concat_ws('' '', barangay, city_municipality, province) FROM public.%I WHERE %I = $1 LIMIT 1',
      v_table,
      v_scope_col
    );
    BEGIN
      EXECUTE v_sql INTO v_extra USING p_scope_id;
    EXCEPTION WHEN OTHERS THEN
      v_extra := NULL;
    END;
  END IF;

  RETURN lower(concat_ws(' ', v_text, v_extra));
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_scope_is_search_visible_v1(
  p_scope_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility text;
  v_status text;
BEGIN
  IF p_scope_id IS NULL THEN
    RETURN false;
  END IF;

  v_visibility := public.buklod_scope_visibility_text_v1(p_scope_id);
  v_status := public.buklod_scope_status_text_v1(p_scope_id);

  IF v_visibility = 'PUBLIC' AND v_status = 'ACTIVE' THEN
    RETURN true;
  END IF;

  IF p_user_id IS NOT NULL AND to_regclass('public.buklod_scope_memberships') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.buklod_scope_memberships m
      WHERE m.scope_id = p_scope_id
        AND m.user_id = p_user_id
        AND m.membership_status IN ('ACTIVE', 'PENDING', 'INVITED')
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN public.buklod_actor_can_manage_scope_v1(p_scope_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_church_has_active_pastor_or_mentor_v1(
  p_scope_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.buklod_scope_member_functional_roles a
    JOIN public.buklod_scope_functional_roles r
      ON r.id = a.role_id
     AND r.scope_id = a.scope_id
    JOIN public.buklod_scope_memberships m
      ON m.scope_id = a.scope_id
     AND m.user_id = a.user_id
    WHERE a.scope_id = p_scope_id
      AND coalesce(r.is_active, true)
      AND m.membership_status = 'ACTIVE'
      AND public.buklod_role_is_pastor_or_mentor_v1(r.name)
  )
  OR EXISTS (
    SELECT 1
    FROM public.buklod_scope_role_assignments a
    JOIN public.buklod_scope_memberships m
      ON m.scope_id = a.scope_id
     AND m.user_id = a.user_id
    WHERE a.scope_id = p_scope_id
      AND a.status = 'ACTIVE'
      AND m.membership_status = 'ACTIVE'
      AND upper(coalesce(a.role_key, '')) IN ('PASTOR', 'MENTOR')
  )
$$;

CREATE OR REPLACE FUNCTION public.buklod_church_leader_people_v1(
  p_scope_id uuid,
  p_kind text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', p.id,
        'display_name', coalesce(
          nullif(trim(p.full_name), ''),
          nullif(trim(p.username), ''),
          'Member'
        )
      )
      ORDER BY coalesce(nullif(trim(p.full_name), ''), p.username)
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT a.user_id
    FROM public.buklod_scope_member_functional_roles a
    JOIN public.buklod_scope_functional_roles r
      ON r.id = a.role_id
     AND r.scope_id = a.scope_id
    JOIN public.buklod_scope_memberships m
      ON m.scope_id = a.scope_id
     AND m.user_id = a.user_id
    WHERE a.scope_id = p_scope_id
      AND coalesce(r.is_active, true)
      AND m.membership_status = 'ACTIVE'
      AND (
        (
          p_kind = 'pastor'
          AND public.buklod_role_is_pastor_v1(r.name)
        )
        OR (
          p_kind = 'mentor'
          AND public.buklod_role_is_mentor_v1(r.name)
        )
      )
    UNION
    SELECT DISTINCT a.user_id
    FROM public.buklod_scope_role_assignments a
    JOIN public.buklod_scope_memberships m
      ON m.scope_id = a.scope_id
     AND m.user_id = a.user_id
    WHERE a.scope_id = p_scope_id
      AND a.status = 'ACTIVE'
      AND m.membership_status = 'ACTIVE'
      AND (
        (
          p_kind = 'pastor'
          AND upper(coalesce(a.role_key, '')) = 'PASTOR'
        )
        OR (
          p_kind = 'mentor'
          AND upper(coalesce(a.role_key, '')) = 'MENTOR'
        )
      )
  ) leaders
  JOIN public.profiles p
    ON p.id = leaders.user_id
$$;

DROP FUNCTION IF EXISTS public.buklod_accountability_search_scopes_v1(
  text,
  double precision,
  double precision,
  integer,
  integer,
  uuid
);

DROP FUNCTION IF EXISTS public.buklod_accountability_search_scopes_v1(
  text,
  double precision,
  double precision,
  integer,
  integer,
  uuid,
  text[]
);

CREATE OR REPLACE FUNCTION public.buklod_accountability_search_scopes_v1(
  p_query text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_scope_id uuid DEFAULT NULL,
  p_scope_types text[] DEFAULT ARRAY['CHURCH']::text[]
)
RETURNS TABLE (
  scope_id uuid,
  scope_name text,
  scope_type text,
  safe_location_label text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  visibility text,
  join_policy text,
  membership_state text,
  accountability_ready boolean,
  pastors jsonb,
  mentors jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_q text := lower(trim(coalesce(p_query, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 60);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_types text[];
BEGIN
  SELECT coalesce(
    array_agg(DISTINCT upper(trim(x))),
    ARRAY['CHURCH']::text[]
  )
  INTO v_types
  FROM unnest(coalesce(p_scope_types, ARRAY['CHURCH']::text[])) AS x
  WHERE trim(coalesce(x, '')) <> '';

  IF v_types IS NULL OR array_length(v_types, 1) IS NULL THEN
    v_types := ARRAY['CHURCH']::text[];
  END IF;

  RETURN QUERY
  WITH church_rows AS (
    SELECT
      s.id,
      s.name,
      s.scope_type::text AS scope_type,
      public.buklod_church_safe_location_label_v1(s.id) AS place_label,
      s.latitude,
      s.longitude,
      public.buklod_haversine_km_v1(
        p_latitude,
        p_longitude,
        s.latitude,
        s.longitude
      ) AS distance_km,
      public.buklod_scope_visibility_text_v1(s.id) AS visibility,
      public.buklod_scope_status_text_v1(s.id) AS scope_status,
      mem.membership_status,
      public.buklod_church_has_active_pastor_or_mentor_v1(s.id) AS accountability_ready,
      public.buklod_church_place_search_text_v1(s.id) AS search_text
    FROM public.buklod_scopes s
    LEFT JOIN public.buklod_scope_memberships mem
      ON mem.scope_id = s.id
     AND mem.user_id = v_user
    WHERE upper(s.scope_type::text) = ANY (v_types)
      AND (p_scope_id IS NULL OR s.id = p_scope_id)
      AND public.buklod_scope_is_search_visible_v1(s.id, v_user)
  )
  SELECT
    c.id,
    c.name,
    c.scope_type,
    c.place_label,
    CASE
      WHEN c.visibility = 'PUBLIC' OR c.membership_status IS NOT NULL
        THEN c.latitude
      ELSE NULL
    END,
    CASE
      WHEN c.visibility = 'PUBLIC' OR c.membership_status IS NOT NULL
        THEN c.longitude
      ELSE NULL
    END,
    CASE
      WHEN c.visibility = 'PUBLIC' OR c.membership_status IS NOT NULL
        THEN c.distance_km
      ELSE NULL
    END,
    c.visibility,
    CASE
      WHEN c.visibility IN ('INVITE_ONLY', 'INVITE') THEN 'INVITE'
      WHEN c.visibility = 'PRIVATE' THEN 'PRIVATE'
      ELSE 'REQUEST'
    END,
    c.membership_status,
    c.accountability_ready,
    CASE
      WHEN c.visibility = 'PUBLIC' OR c.membership_status IN ('ACTIVE', 'PENDING', 'INVITED')
        THEN public.buklod_church_leader_people_v1(c.id, 'pastor')
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN c.visibility = 'PUBLIC' OR c.membership_status IN ('ACTIVE', 'PENDING', 'INVITED')
        THEN public.buklod_church_leader_people_v1(c.id, 'mentor')
      ELSE '[]'::jsonb
    END
  FROM church_rows c
  WHERE
    v_q = ''
    OR c.search_text ILIKE '%' || v_q || '%'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        public.buklod_church_leader_people_v1(c.id, 'pastor') ||
        public.buklod_church_leader_people_v1(c.id, 'mentor')
      ) person
      WHERE lower(coalesce(person->>'display_name', '')) ILIKE '%' || v_q || '%'
    )
  ORDER BY
    c.distance_km NULLS LAST,
    c.name
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_set_church_map_location_v1(
  p_scope_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_safe_location_label text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_type text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF p_scope_id IS NULL THEN
    RAISE EXCEPTION 'Church is required';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
    OR abs(p_latitude) > 90
    OR abs(p_longitude) > 180
  THEN
    RAISE EXCEPTION 'Enter a valid church map location';
  END IF;

  SELECT s.scope_type::text
  INTO v_type
  FROM public.buklod_scopes s
  WHERE s.id = p_scope_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Church was not found';
  END IF;

  IF v_type <> 'CHURCH' THEN
    RAISE EXCEPTION 'Map location can only be set for a church';
  END IF;

  IF NOT public.buklod_actor_can_manage_scope_v1(p_scope_id) THEN
    RAISE EXCEPTION 'Only a church admin can set the map location';
  END IF;

  UPDATE public.buklod_scopes
  SET
    latitude = p_latitude,
    longitude = p_longitude,
    safe_location_label = nullif(trim(p_safe_location_label), ''),
    map_location_updated_at = now(),
    map_location_updated_by = v_user
  WHERE id = p_scope_id;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata
      )
      VALUES (
        v_user,
        'church_map_location_set',
        'buklod_scopes',
        p_scope_id,
        jsonb_build_object(
          'has_coordinates', true,
          'safe_location_label', nullif(trim(p_safe_location_label), '')
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.buklod_church_readiness_summary_v1();

CREATE OR REPLACE FUNCTION public.buklod_church_readiness_summary_v1()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public.buklod_actor_is_system_admin_v1() THEN
    RAISE EXCEPTION 'System Admin access is required';
  END IF;

  SELECT coalesce(
    jsonb_agg(row_to_json(x)::jsonb ORDER BY x.scope_name),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      s.id AS scope_id,
      s.name AS scope_name,
      CASE
        WHEN public.buklod_scope_status_text_v1(s.id) <> 'ACTIVE'
          THEN 'pending_setup'
        WHEN public.buklod_scope_visibility_text_v1(s.id) IN ('PRIVATE', 'INVITE_ONLY', 'INVITE')
          THEN 'private_invite'
        WHEN NOT public.buklod_church_has_active_pastor_or_mentor_v1(s.id)
          THEN 'missing_pastor_mentor'
        WHEN s.latitude IS NULL OR s.longitude IS NULL
          THEN 'missing_map'
        ELSE 'ready'
      END AS bucket,
      public.buklod_church_has_active_pastor_or_mentor_v1(s.id) AS accountability_ready,
      (s.latitude IS NOT NULL AND s.longitude IS NOT NULL) AS has_map,
      public.buklod_scope_visibility_text_v1(s.id) AS visibility,
      public.buklod_scope_status_text_v1(s.id) AS scope_status
    FROM public.buklod_scopes s
    WHERE s.scope_type::text = 'CHURCH'
  ) x;

  RETURN jsonb_build_object(
    'ready', (
      SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'bucket' = 'ready'
    ),
    'missing_pastor_mentor', (
      SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'bucket' = 'missing_pastor_mentor'
    ),
    'missing_map', (
      SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'bucket' = 'missing_map'
    ),
    'private_invite', (
      SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'bucket' = 'private_invite'
    ),
    'pending_setup', (
      SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'bucket' = 'pending_setup'
    ),
    'rows', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buklod_haversine_km_v1(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buklod_accountability_search_scopes_v1(text, double precision, double precision, integer, integer, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buklod_set_church_map_location_v1(uuid, double precision, double precision, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buklod_church_readiness_summary_v1() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.buklod_haversine_km_v1(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_accountability_search_scopes_v1(text, double precision, double precision, integer, integer, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_set_church_map_location_v1(uuid, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_church_readiness_summary_v1() TO authenticated;

COMMIT;
