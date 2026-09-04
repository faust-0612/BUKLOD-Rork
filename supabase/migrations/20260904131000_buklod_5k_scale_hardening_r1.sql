-- BUKLOD 5K SCALE HARDENING R1
-- Goal: remove always-on noncritical CDC pressure and reduce hot startup RPC cost.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notifications',
    'prayer_requests',
    'prayer_responses',
    'buklod_quiz_live_members',
    'buklod_quiz_live_sessions'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime DROP TABLE public.%I',
        t
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS buklod_roles_active_user_scope_role_idx
ON public.buklod_scope_role_assignments (user_id, scope_id, role_key)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS buklod_entitlements_enabled_scope_feature_idx
ON public.buklod_scope_feature_entitlements (scope_id, feature_key)
WHERE enabled = true;

CREATE OR REPLACE FUNCTION public.buklod_my_scopes()
RETURNS TABLE(
  scope_id uuid,
  scope_type text,
  name text,
  scope_status text,
  visibility text,
  geo_level text,
  membership_status text,
  role_keys text[],
  is_admin boolean,
  member_count bigint,
  show_faith_content boolean,
  feature_keys text[],
  is_active_scope boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
WITH actor AS (
  SELECT
    (SELECT auth.uid()) AS user_id,
    public.buklod_is_system_admin() AS is_system_admin,
    COALESCE((
      SELECT p.show_faith_content
      FROM public.buklod_user_preferences p
      WHERE p.user_id = (SELECT auth.uid())
      LIMIT 1
    ), false) AS faith_pref
),
state AS (
  SELECT st.active_scope_id
  FROM public.buklod_user_scope_state st
  JOIN actor a ON a.user_id = st.user_id
  LIMIT 1
),
my_memberships AS (
  SELECT m.scope_id, m.membership_status, m.updated_at
  FROM public.buklod_scope_memberships m
  JOIN actor a ON a.user_id = m.user_id
),
my_roles AS (
  SELECT
    ra.scope_id,
    array_agg(DISTINCT ra.role_key ORDER BY ra.role_key) AS role_keys,
    bool_or(
      upper(ra.role_key) IN (
        'ADMIN',
        'CLUSTER_ADMIN',
        'CHURCH_ADMIN',
        'ORG_ADMIN'
      )
    ) AS has_admin_role
  FROM public.buklod_scope_role_assignments ra
  JOIN actor a ON a.user_id = ra.user_id
  WHERE ra.status = 'ACTIVE'
  GROUP BY ra.scope_id
),
available AS (
  SELECT
    s.id,
    s.scope_type,
    s.name,
    s.status,
    s.visibility,
    s.geo_level,
    s.created_by,
    s.metadata
  FROM public.buklod_scopes s
  CROSS JOIN actor a
  WHERE a.user_id IS NOT NULL
    AND s.status NOT IN ('SUSPENDED', 'DELETED')
    AND (
      s.scope_type = 'PUBLIC'
      OR (s.scope_type = 'SYSTEM' AND a.is_system_admin)
      OR EXISTS (
        SELECT 1
        FROM my_memberships m
        WHERE m.scope_id = s.id
          AND m.membership_status = 'ACTIVE'
      )
      OR s.created_by = a.user_id
    )
)
SELECT
  s.id AS scope_id,
  s.scope_type,
  s.name,
  s.status AS scope_status,
  s.visibility,
  s.geo_level,
  mm.membership_status,
  COALESCE(mr.role_keys, ARRAY[]::text[]) AS role_keys,
  CASE
    WHEN s.scope_type = 'LOCAL' THEN false
    ELSE a.is_system_admin OR COALESCE(mr.has_admin_role, false)
  END AS is_admin,
  COALESCE(mc.member_count, 0)::bigint AS member_count,
  CASE
    WHEN s.scope_type = 'CHURCH' THEN true
    WHEN s.scope_type = 'CLUSTER'
      AND (a.is_system_admin OR COALESCE(mr.has_admin_role, false)) THEN true
    WHEN s.scope_type = 'ORGANIZATION'
      AND lower(
        COALESCE(
          s.metadata ->> 'faith_content_mandatory',
          'false'
        )
      ) IN ('true', '1', 'yes', 'on') THEN true
    ELSE a.faith_pref
  END AS show_faith_content,
  COALESCE(fe.feature_keys, ARRAY[]::text[]) AS feature_keys,
  CASE
    WHEN st.active_scope_id IS NULL THEN s.scope_type = 'PUBLIC'
    ELSE s.id = st.active_scope_id
  END AS is_active_scope
FROM available s
CROSS JOIN actor a
LEFT JOIN state st ON true
LEFT JOIN my_memberships mm ON mm.scope_id = s.id
LEFT JOIN my_roles mr ON mr.scope_id = s.id
LEFT JOIN LATERAL (
  SELECT count(*)::bigint AS member_count
  FROM public.buklod_scope_memberships m2
  WHERE m2.scope_id = s.id
    AND m2.membership_status = 'ACTIVE'
) mc ON true
LEFT JOIN LATERAL (
  SELECT
    array_agg(
      DISTINCT lower(e.feature_key)
      ORDER BY lower(e.feature_key)
    ) AS feature_keys
  FROM public.buklod_scope_feature_entitlements e
  WHERE e.scope_id = s.id
    AND e.enabled = true
) fe ON true
ORDER BY
  CASE s.scope_type
    WHEN 'PUBLIC' THEN 0
    WHEN 'LOCAL' THEN 1
    WHEN 'CLUSTER' THEN 2
    WHEN 'CHURCH' THEN 3
    WHEN 'ORGANIZATION' THEN 4
    WHEN 'SYSTEM' THEN 5
    ELSE 9
  END,
  CASE
    WHEN s.scope_type = 'LOCAL'
      AND upper(COALESCE(s.geo_level, '')) = 'BARANGAY' THEN 10
    WHEN s.scope_type = 'LOCAL'
      AND upper(COALESCE(s.geo_level, '')) IN (
        'MUNICIPALITY_CITY',
        'MUNICIPALITY',
        'CITY'
      ) THEN 11
    WHEN s.scope_type = 'LOCAL'
      AND upper(COALESCE(s.geo_level, '')) = 'PROVINCE' THEN 12
    WHEN s.scope_type = 'LOCAL'
      AND upper(COALESCE(s.geo_level, '')) = 'COUNTRY' THEN 13
    ELSE 99
  END,
  s.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_buklod_points_leaderboard(
  p_period text DEFAULT 'weekly'::text,
  p_limit integer DEFAULT 50,
  p_church_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  rank_position bigint,
  user_id uuid,
  full_name text,
  church_id uuid,
  church_name text,
  total_points bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  start_ts timestamptz;
  end_ts timestamptz;
  normalized_period text;
BEGIN
  normalized_period := lower(trim(coalesce(p_period, 'weekly')));
  normalized_period := CASE normalized_period
    WHEN 'week' THEN 'weekly'
    WHEN 'month' THEN 'monthly'
    WHEN 'quarter' THEN 'quarterly'
    WHEN 'all' THEN 'all_time'
    WHEN 'alltime' THEN 'all_time'
    ELSE normalized_period
  END;

  IF normalized_period NOT IN (
    'weekly',
    'monthly',
    'quarterly',
    'all_time'
  ) THEN
    RAISE EXCEPTION 'Invalid leaderboard period';
  END IF;

  IF normalized_period = 'weekly' THEN
    start_ts :=
      date_trunc(
        'week',
        now() AT TIME ZONE 'Asia/Manila'
      ) AT TIME ZONE 'Asia/Manila';
    end_ts := start_ts + interval '7 days';
  ELSIF normalized_period = 'monthly' THEN
    start_ts :=
      date_trunc(
        'month',
        now() AT TIME ZONE 'Asia/Manila'
      ) AT TIME ZONE 'Asia/Manila';
    end_ts := start_ts + interval '1 month';
  ELSIF normalized_period = 'quarterly' THEN
    start_ts :=
      date_trunc(
        'quarter',
        now() AT TIME ZONE 'Asia/Manila'
      ) AT TIME ZONE 'Asia/Manila';
    end_ts := start_ts + interval '3 months';
  ELSE
    start_ts := NULL;
    end_ts := NULL;
  END IF;

  RETURN QUERY
  WITH totals AS (
    SELECT
      p.id AS user_id,
      p.full_name,
      p.church_id,
      c.name AS church_name,
      CASE
        WHEN normalized_period = 'all_time' THEN
          public.buklod_lifetime_points_for(p.id)
        ELSE COALESCE(
          sum(
            CASE
              WHEN l.direction = 'credit'
                AND coalesce(l.claim_state, 'legacy') IN (
                  'legacy',
                  'claimed'
                ) THEN l.points
              WHEN l.direction = 'debit' THEN -l.points
              ELSE 0
            END
          ),
          0
        )::bigint
      END AS total_points
    FROM public.profiles p
    LEFT JOIN public.churches c
      ON c.id = p.church_id
    LEFT JOIN public.buklod_points_ledger l
      ON l.user_id = p.id
      AND start_ts IS NOT NULL
      AND l.created_at >= start_ts
      AND l.created_at < end_ts
    WHERE p.is_active = true
      AND (
        p_church_id IS NULL
        OR p.church_id = p_church_id
      )
    GROUP BY
      p.id,
      p.full_name,
      p.church_id,
      c.name
  ),
  ranked AS (
    SELECT
      row_number() OVER (
        ORDER BY
          t.total_points DESC,
          t.full_name,
          t.user_id
      ) AS rank_position,
      t.*
    FROM totals t
    WHERE t.total_points > 0
  )
  SELECT
    r.rank_position,
    r.user_id,
    r.full_name,
    r.church_id,
    r.church_name,
    r.total_points
  FROM ranked r
  ORDER BY r.rank_position
  LIMIT greatest(
    1,
    least(coalesce(p_limit, 50), 200)
  );
END;
$function$;
