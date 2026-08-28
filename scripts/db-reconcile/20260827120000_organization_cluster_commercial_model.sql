-- ============================================================
-- BUKLOD Organization / Cluster commercial model
-- 20260827120000
-- Forward-safe, idempotent where practical.
-- Canonical products:
--   cluster_premium
--   cluster_lessons_ccp
--   cluster_lessons_discipleship
--   cluster_lessons_mentoring
--   organization_focus_apps_annual
-- Does not delete historical payment rows.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. Product catalog
-- Live production already has buklod_commercial_products with:
--   id uuid PK, code UNIQUE, title NOT NULL, description,
--   product_kind, tier_code, feature_keys, limits, is_active, metadata
-- Seed through those columns. Extra commercial-model columns are added
-- after the title-safe INSERT so NOT NULL title is never violated.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_commercial_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  product_kind text NOT NULL DEFAULT 'SUBSCRIPTION',
  tier_code text NOT NULL DEFAULT 'STANDARD',
  feature_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Existing catalog required uppercase codes (FREE/PRO/STANDARD/ENTERPRISE).
-- Widen the check so canonical commercial codes can be stored as specified.
ALTER TABLE public.buklod_commercial_products
  DROP CONSTRAINT IF EXISTS buklod_commercial_products_code_check;
ALTER TABLE public.buklod_commercial_products
  ADD CONSTRAINT buklod_commercial_products_code_check
  CHECK (code ~ '^[A-Za-z0-9_]{2,64}$');

INSERT INTO public.buklod_commercial_products (
  code, title, description, product_kind, tier_code, feature_keys, limits, is_active, metadata, updated_at
) VALUES
  (
    'cluster_premium',
    'Cluster Premium',
    'P49 per Cluster. Daily Bible Reading included. Paid by the Cluster Admin/Head.',
    'ONE_TIME',
    'STANDARD',
    '["daily_reading"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 49,
      'billing_kind', 'ONE_TIME',
      'scope_kind', 'CLUSTER',
      'lesson_stages', '[]'::jsonb,
      'includes_daily_bible', true
    ),
    now()
  ),
  (
    'cluster_lessons_ccp',
    'CCP 101-103',
    'P49 one-time per Cluster. Unlocks BUKLOD 101, 102, and 103.',
    'ONE_TIME',
    'STANDARD',
    '["lesson_101","lesson_102","lesson_103"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 49,
      'billing_kind', 'ONE_TIME',
      'scope_kind', 'CLUSTER',
      'lesson_stages', jsonb_build_array(101, 102, 103),
      'includes_daily_bible', false
    ),
    now()
  ),
  (
    'cluster_lessons_discipleship',
    'Discipleship 104-105',
    'P59 one-time per Cluster. Unlocks BUKLOD 104 and 105.',
    'ONE_TIME',
    'STANDARD',
    '["lesson_104","lesson_105"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 59,
      'billing_kind', 'ONE_TIME',
      'scope_kind', 'CLUSTER',
      'lesson_stages', jsonb_build_array(104, 105),
      'includes_daily_bible', false
    ),
    now()
  ),
  (
    'cluster_lessons_mentoring',
    'Mentoring 106-107',
    'P69 one-time per Cluster. Unlocks BUKLOD 106 and 107.',
    'ONE_TIME',
    'STANDARD',
    '["lesson_106","lesson_107"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 69,
      'billing_kind', 'ONE_TIME',
      'scope_kind', 'CLUSTER',
      'lesson_stages', jsonb_build_array(106, 107),
      'includes_daily_bible', false
    ),
    now()
  ),
  (
    'organization_focus_apps_annual',
    'BUKLOD Organization Portal',
    'P249/year per Organization. Unlocks Organization-level Focus App portals. Not a registration fee.',
    'SUBSCRIPTION',
    'STANDARD',
    '["focus_apps"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 249,
      'billing_kind', 'ANNUAL',
      'scope_kind', 'ORGANIZATION',
      'lesson_stages', '[]'::jsonb,
      'includes_daily_bible', false
    ),
    now()
  )
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = true,
    metadata = COALESCE(public.buklod_commercial_products.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

ALTER TABLE public.buklod_commercial_products
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS billing_kind text,
  ADD COLUMN IF NOT EXISTS scope_kind text,
  ADD COLUMN IF NOT EXISTS amount_php numeric(12, 2),
  ADD COLUMN IF NOT EXISTS lesson_stages integer[] DEFAULT '{}'::integer[],
  ADD COLUMN IF NOT EXISTS includes_daily_bible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deprecated_note text;

UPDATE public.buklod_commercial_products
SET display_name = COALESCE(NULLIF(display_name, ''), title, code),
    billing_kind = COALESCE(NULLIF(billing_kind, ''), metadata->>'billing_kind', 'ONE_TIME'),
    scope_kind = COALESCE(NULLIF(scope_kind, ''), metadata->>'scope_kind', 'CLUSTER'),
    amount_php = COALESCE(NULLIF(metadata->>'amount_php', '')::numeric, amount_php, 0),
    lesson_stages = CASE
      WHEN lesson_stages IS NOT NULL AND cardinality(lesson_stages) > 0 THEN lesson_stages
      ELSE COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(COALESCE(metadata->'lesson_stages', '[]'::jsonb))::int
        ),
        '{}'::integer[]
      )
    END,
    includes_daily_bible = COALESCE(
      NULLIF(metadata->>'includes_daily_bible', '')::boolean,
      includes_daily_bible,
      false
    )
WHERE code IN (
  'cluster_premium',
  'cluster_lessons_ccp',
  'cluster_lessons_discipleship',
  'cluster_lessons_mentoring',
  'organization_focus_apps_annual'
);

-- ------------------------------------------------------------
-- 2. Entitlements (backend-authoritative)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_scope_product_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES public.buklod_scopes(id) ON DELETE CASCADE,
  product_code text NOT NULL REFERENCES public.buklod_commercial_products(code),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS buklod_scope_product_one_time_active_uidx
  ON public.buklod_scope_product_entitlements (scope_id, product_code)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS buklod_scope_product_entitlements_scope_idx
  ON public.buklod_scope_product_entitlements (scope_id, product_code, status);

CREATE INDEX IF NOT EXISTS buklod_scope_product_entitlements_expires_idx
  ON public.buklod_scope_product_entitlements (expires_at)
  WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- ------------------------------------------------------------
-- 3. Payment requests (GCash reference + admin verify)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_scope_product_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES public.buklod_scopes(id) ON DELETE CASCADE,
  product_code text NOT NULL REFERENCES public.buklod_commercial_products(code),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gcash_reference text NOT NULL,
  amount_php numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_admin'
    CHECK (status IN ('pending_admin', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  admin_note text,
  payment_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS buklod_scope_product_pending_uidx
  ON public.buklod_scope_product_payments (scope_id, product_code)
  WHERE status = 'pending_admin';

CREATE INDEX IF NOT EXISTS buklod_scope_product_payments_status_idx
  ON public.buklod_scope_product_payments (status, created_at DESC);

-- ------------------------------------------------------------
-- 4. Church / Organization structured address
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_organization_locations (
  scope_id uuid PRIMARY KEY REFERENCES public.buklod_scopes(id) ON DELETE CASCADE,
  address_line text,
  barangay text,
  city_municipality text,
  province text,
  country text NOT NULL DEFAULT 'Philippines',
  safe_location_label text,
  latitude double precision,
  longitude double precision,
  geocode_status text NOT NULL DEFAULT 'pending'
    CHECK (geocode_status IN ('pending', 'ok', 'failed', 'manual')),
  geocode_query text,
  geocoded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buklod_organization_locations_lat_chk
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT buklod_organization_locations_lng_chk
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE INDEX IF NOT EXISTS buklod_organization_locations_geo_idx
  ON public.buklod_organization_locations (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Cluster-scoped official approvals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_cluster_formation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.buklod_scopes(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind text NOT NULL
    CHECK (item_kind IN (
      'DAILY_READING', 'LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING'
    )),
  item_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  remarks text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buklod_cluster_formation_approvals_cluster_idx
  ON public.buklod_cluster_formation_approvals (cluster_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS buklod_cluster_formation_approvals_learner_idx
  ON public.buklod_cluster_formation_approvals (learner_id, cluster_id, item_kind);

CREATE UNIQUE INDEX IF NOT EXISTS buklod_cluster_formation_pending_uidx
  ON public.buklod_cluster_formation_approvals (
    cluster_id, learner_id, item_kind, item_id
  )
  WHERE status = 'PENDING';

ALTER TABLE public.buklod_cluster_formation_approvals
  ALTER COLUMN approver_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 6. Cluster -> Organization link
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'buklod_scopes'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.buklod_scopes
      ADD COLUMN organization_id uuid REFERENCES public.buklod_scopes(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS buklod_scopes_organization_id_idx
  ON public.buklod_scopes (organization_id)
  WHERE organization_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'buklod_scopes' AND column_name = 'updated_at'
  ) THEN
    UPDATE public.buklod_scopes AS cluster
    SET organization_id = cluster.parent_scope_id,
        updated_at = COALESCE(cluster.updated_at, now())
    WHERE cluster.scope_type = 'CLUSTER'
      AND cluster.organization_id IS NULL
      AND cluster.parent_scope_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.buklod_scopes AS org
        WHERE org.id = cluster.parent_scope_id
          AND org.scope_type = 'ORGANIZATION'
          AND COALESCE(org.status::text, 'ACTIVE') <> 'DELETED'
      );
  ELSE
    UPDATE public.buklod_scopes AS cluster
    SET organization_id = cluster.parent_scope_id
    WHERE cluster.scope_type = 'CLUSTER'
      AND cluster.organization_id IS NULL
      AND cluster.parent_scope_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.buklod_scopes AS org
        WHERE org.id = cluster.parent_scope_id
          AND org.scope_type = 'ORGANIZATION'
          AND COALESCE(org.status::text, 'ACTIVE') <> 'DELETED'
      );
  END IF;
END
$$;

UPDATE public.buklod_scopes
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'needs_organization_link', true,
      'organization_remediation',
      'Assign this Cluster to an Organization. The Cluster record is preserved until linked.'
    )
WHERE scope_type = 'CLUSTER'
  AND organization_id IS NULL
  AND COALESCE(status::text, 'ACTIVE') <> 'DELETED';

-- ------------------------------------------------------------
-- 7. RLS
-- ------------------------------------------------------------
ALTER TABLE public.buklod_commercial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_scope_product_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_scope_product_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_organization_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buklod_cluster_formation_approvals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.buklod_commercial_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.buklod_scope_product_entitlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.buklod_scope_product_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.buklod_organization_locations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.buklod_cluster_formation_approvals FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.buklod_commercial_products TO authenticated, service_role;
GRANT SELECT ON TABLE public.buklod_scope_product_entitlements TO authenticated, service_role;
GRANT SELECT ON TABLE public.buklod_scope_product_payments TO authenticated, service_role;
GRANT SELECT ON TABLE public.buklod_organization_locations TO authenticated, service_role;
GRANT SELECT ON TABLE public.buklod_cluster_formation_approvals TO authenticated, service_role;
GRANT ALL ON TABLE public.buklod_commercial_products TO service_role;
GRANT ALL ON TABLE public.buklod_scope_product_entitlements TO service_role;
GRANT ALL ON TABLE public.buklod_scope_product_payments TO service_role;
GRANT ALL ON TABLE public.buklod_organization_locations TO service_role;
GRANT ALL ON TABLE public.buklod_cluster_formation_approvals TO service_role;

DROP POLICY IF EXISTS buklod_commercial_products_read ON public.buklod_commercial_products;
CREATE POLICY buklod_commercial_products_read
  ON public.buklod_commercial_products
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS buklod_scope_product_entitlements_read ON public.buklod_scope_product_entitlements;
CREATE POLICY buklod_scope_product_entitlements_read
  ON public.buklod_scope_product_entitlements
  FOR SELECT TO authenticated
  USING (
    public.buklod_is_system_admin()
    OR EXISTS (
      SELECT 1
      FROM public.buklod_scope_memberships m
      WHERE m.scope_id = buklod_scope_product_entitlements.scope_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.membership_status::text, '') IN ('ACTIVE')
    )
  );

DROP POLICY IF EXISTS buklod_scope_product_payments_read ON public.buklod_scope_product_payments;
CREATE POLICY buklod_scope_product_payments_read
  ON public.buklod_scope_product_payments
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR public.buklod_is_system_admin()
  );

DROP POLICY IF EXISTS buklod_organization_locations_read ON public.buklod_organization_locations;
CREATE POLICY buklod_organization_locations_read
  ON public.buklod_organization_locations
  FOR SELECT TO authenticated
  USING (
    public.buklod_is_system_admin()
    OR EXISTS (
      SELECT 1
      FROM public.buklod_scopes s
      WHERE s.id = buklod_organization_locations.scope_id
        AND s.scope_type = 'ORGANIZATION'
        AND COALESCE(s.visibility::text, 'PUBLIC') = 'PUBLIC'
        AND upper(COALESCE(s.metadata->>'organization_type', '')) = 'CHURCH'
        AND buklod_organization_locations.latitude IS NOT NULL
        AND buklod_organization_locations.longitude IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.buklod_scope_memberships m
      WHERE m.scope_id = buklod_organization_locations.scope_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS buklod_cluster_formation_approvals_read ON public.buklod_cluster_formation_approvals;
CREATE POLICY buklod_cluster_formation_approvals_read
  ON public.buklod_cluster_formation_approvals
  FOR SELECT TO authenticated
  USING (
    learner_id = auth.uid()
    OR approver_id = auth.uid()
    OR public.buklod_is_system_admin()
    OR EXISTS (
      SELECT 1
      FROM public.buklod_scope_role_assignments ra
      WHERE ra.scope_id = buklod_cluster_formation_approvals.cluster_id
        AND ra.user_id = auth.uid()
        AND ra.status = 'ACTIVE'
        AND upper(ra.role_key) IN (
          'CLUSTER_ADMIN', 'CLUSTER_HEAD', 'ADMIN', 'PASTOR', 'MENTOR', 'ORG_ADMIN'
        )
    )
  );

-- ------------------------------------------------------------
-- 8. Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_user_is_active_scope_member(
  p_scope_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_scope_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.buklod_scope_memberships m
      WHERE m.scope_id = p_scope_id
        AND m.user_id = p_user_id
        AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
    );
$$;

CREATE OR REPLACE FUNCTION public.buklod_user_has_scope_roles(
  p_scope_id uuid,
  p_user_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.buklod_scope_role_assignments ra
    WHERE ra.scope_id = p_scope_id
      AND ra.user_id = p_user_id
      AND ra.status = 'ACTIVE'
      AND upper(ra.role_key) = ANY (p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.buklod_user_has_functional_approver_role(
  p_scope_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF to_regclass('public.buklod_scope_member_functional_roles') IS NULL
     OR to_regclass('public.buklod_scope_functional_roles') IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.buklod_scope_member_functional_roles a
    JOIN public.buklod_scope_functional_roles r
      ON r.id = a.role_id
    WHERE a.scope_id = p_scope_id
      AND a.user_id = p_user_id
      AND COALESCE(r.is_active, true) = true
      AND (
        r.name ~* '(^|[^a-z])(pastor|mentor|cluster head|cluster admin)([^a-z]|$)'
        OR COALESCE(r.name, '') ILIKE '%pastor%'
        OR COALESCE(r.name, '') ILIKE '%mentor%'
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_is_cluster_billing_manager(
  p_cluster_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created uuid;
BEGIN
  IF p_user_id IS NULL OR p_cluster_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    RETURN true;
  END IF;

  SELECT s.created_by
    INTO v_created
  FROM public.buklod_scopes s
  WHERE s.id = p_cluster_id
    AND s.scope_type = 'CLUSTER';

  IF v_created = p_user_id THEN
    RETURN true;
  END IF;

  IF public.buklod_user_has_scope_roles(
    p_cluster_id,
    p_user_id,
    ARRAY['CLUSTER_ADMIN', 'CLUSTER_HEAD', 'ADMIN']
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_is_organization_billing_manager(
  p_organization_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    RETURN true;
  END IF;

  RETURN public.buklod_user_has_scope_roles(
    p_organization_id,
    p_user_id,
    ARRAY['ORG_ADMIN', 'ORGANIZATION_ADMIN', 'ADMIN']
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_is_cluster_approver(
  p_cluster_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR p_cluster_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    RETURN true;
  END IF;

  IF public.buklod_user_has_scope_roles(
    p_cluster_id,
    p_user_id,
    ARRAY['CLUSTER_ADMIN', 'CLUSTER_HEAD', 'ADMIN', 'PASTOR', 'MENTOR']
  ) THEN
    RETURN true;
  END IF;

  RETURN public.buklod_user_has_functional_approver_role(p_cluster_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_resolve_cluster_organization_id(
  p_cluster_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    s.organization_id,
    CASE
      WHEN parent.scope_type = 'ORGANIZATION' THEN s.parent_scope_id
      ELSE NULL
    END
  )
  FROM public.buklod_scopes s
  LEFT JOIN public.buklod_scopes parent
    ON parent.id = s.parent_scope_id
  WHERE s.id = p_cluster_id
    AND s.scope_type = 'CLUSTER';
$$;

CREATE OR REPLACE FUNCTION public.buklod_expire_annual_entitlements_v1()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.buklod_scope_product_entitlements e
  SET status = 'EXPIRED',
      updated_at = now()
  FROM public.buklod_commercial_products p
  WHERE p.code = e.product_code
    AND COALESCE(p.billing_kind, p.metadata->>'billing_kind') = 'ANNUAL'
    AND e.status = 'ACTIVE'
    AND e.expires_at IS NOT NULL
    AND e.expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_scope_has_product_v1(
  p_scope_id uuid,
  p_product_code text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expires timestamptz;
  v_status text;
  v_kind text;
BEGIN
  PERFORM public.buklod_expire_annual_entitlements_v1();

  SELECT e.status, e.expires_at, COALESCE(p.billing_kind, p.metadata->>'billing_kind')
    INTO v_status, v_expires, v_kind
  FROM public.buklod_scope_product_entitlements e
  JOIN public.buklod_commercial_products p
    ON p.code = e.product_code
  WHERE e.scope_id = p_scope_id
    AND e.product_code = p_product_code
    AND e.status = 'ACTIVE'
  ORDER BY e.activated_at DESC
  LIMIT 1;

  IF v_status IS DISTINCT FROM 'ACTIVE' THEN
    RETURN false;
  END IF;

  IF v_kind = 'ANNUAL' AND v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ------------------------------------------------------------
-- 9. Cluster create requires Organization
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_create_cluster_v2(
  _name text,
  _description text DEFAULT NULL,
  _category text DEFAULT NULL,
  _visibility text DEFAULT 'PUBLIC',
  _organization_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_name text := NULLIF(btrim(_name), '');
  v_visibility text := upper(COALESCE(NULLIF(btrim(_visibility), ''), 'PUBLIC'));
  v_org uuid := _organization_id;
  v_slug text;
  v_org_ok boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Cluster name is required';
  END IF;

  IF v_visibility NOT IN ('PUBLIC', 'PRIVATE', 'INVITE_ONLY') THEN
    RAISE EXCEPTION 'Invalid visibility';
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Every Cluster must belong to an Organization';
  END IF;

  SELECT true
    INTO v_org_ok
  FROM public.buklod_scopes o
  WHERE o.id = v_org
    AND o.scope_type = 'ORGANIZATION'
    AND COALESCE(o.status::text, 'ACTIVE') <> 'DELETED';

  IF v_org_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_billing_manager(v_org, v_user)
    OR public.buklod_user_is_active_scope_member(v_org, v_user)
  ) THEN
    RAISE EXCEPTION 'Join or administer the Organization before creating a Cluster';
  END IF;

  v_slug := trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')));
  IF v_slug = '' THEN
    v_slug := 'cluster';
  END IF;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.buklod_scopes (
    scope_type, name, slug, description, status, visibility,
    created_by, parent_scope_id, organization_id, metadata
  )
  VALUES (
    'CLUSTER',
    v_name,
    v_slug,
    NULLIF(btrim(COALESCE(_description, '')), ''),
    'ACTIVE',
    v_visibility,
    v_user,
    v_org,
    v_org,
    jsonb_build_object(
      'category', NULLIF(btrim(COALESCE(_category, '')), ''),
      'organization_id', v_org,
      'created_from', 'BUKLOD_CREATE_CLUSTER_V2'
    )
  )
  RETURNING id INTO v_id;

  INSERT INTO public.buklod_scope_memberships (
    scope_id, user_id, membership_status, membership_source, joined_at, left_at
  )
  VALUES (v_id, v_user, 'ACTIVE', 'SELF', now(), NULL)
  ON CONFLICT (scope_id, user_id) DO UPDATE
    SET membership_status = 'ACTIVE',
        membership_source = 'SELF',
        joined_at = COALESCE(public.buklod_scope_memberships.joined_at, now()),
        left_at = NULL;

  INSERT INTO public.buklod_scope_role_assignments (
    scope_id, user_id, role_key, status, assigned_by, revoked_at
  )
  VALUES (v_id, v_user, 'CLUSTER_ADMIN', 'ACTIVE', v_user, NULL)
  ON CONFLICT (scope_id, user_id, role_key) DO UPDATE
    SET status = 'ACTIVE', assigned_by = v_user, revoked_at = NULL;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_create_cluster(
  _name text,
  _description text DEFAULT NULL,
  _category text DEFAULT NULL,
  _visibility text DEFAULT 'PUBLIC'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Every Cluster must belong to an Organization. Pass organization_id via buklod_create_cluster_v2.';
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_link_cluster_organization_v1(
  p_cluster_id uuid,
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_scopes
    WHERE id = p_cluster_id AND scope_type = 'CLUSTER'
      AND COALESCE(status::text, 'ACTIVE') <> 'DELETED'
  ) THEN
    RAISE EXCEPTION 'Cluster not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_scopes
    WHERE id = p_organization_id AND scope_type = 'ORGANIZATION'
      AND COALESCE(status::text, 'ACTIVE') <> 'DELETED'
  ) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_cluster_billing_manager(p_cluster_id, v_user)
    OR public.buklod_is_organization_billing_manager(p_organization_id, v_user)
  ) THEN
    RAISE EXCEPTION 'Only a Cluster Admin/Head, Organization Admin, or System Admin can link this Cluster';
  END IF;

  UPDATE public.buklod_scopes
  SET organization_id = p_organization_id,
      parent_scope_id = p_organization_id,
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'organization_id', p_organization_id,
          'needs_organization_link', false
        ),
      updated_at = now()
  WHERE id = p_cluster_id;

  RETURN jsonb_build_object('ok', true, 'cluster_id', p_cluster_id, 'organization_id', p_organization_id);
END;
$$;

DROP TRIGGER IF EXISTS buklod_cluster_require_organization ON public.buklod_scopes;
CREATE OR REPLACE FUNCTION public.buklod_cluster_require_organization_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.scope_type = 'CLUSTER' AND TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'Every Cluster must belong to an Organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER buklod_cluster_require_organization
  BEFORE INSERT ON public.buklod_scopes
  FOR EACH ROW
  EXECUTE PROCEDURE public.buklod_cluster_require_organization_trg();

-- ------------------------------------------------------------
-- 10. Product access + purchase
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_scope_product_access_v1(
  p_scope_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_scope public.buklod_scopes%ROWTYPE;
  v_org uuid;
  v_billing boolean := false;
  v_member boolean := false;
  v_products jsonb := '[]'::jsonb;
  v_row record;
BEGIN
  PERFORM public.buklod_expire_annual_entitlements_v1();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_scope
  FROM public.buklod_scopes
  WHERE id = p_scope_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope not found';
  END IF;

  v_org := CASE
    WHEN v_scope.scope_type = 'ORGANIZATION' THEN v_scope.id
    ELSE COALESCE(v_scope.organization_id, public.buklod_resolve_cluster_organization_id(v_scope.id))
  END;

  v_member := public.buklod_user_is_active_scope_member(p_scope_id, v_user)
    OR public.buklod_is_system_admin();

  IF v_scope.scope_type = 'CLUSTER' THEN
    v_billing := public.buklod_is_cluster_billing_manager(p_scope_id, v_user);
  ELSIF v_scope.scope_type = 'ORGANIZATION' THEN
    v_billing := public.buklod_is_organization_billing_manager(p_scope_id, v_user);
  END IF;

  FOR v_row IN
    SELECT
      p.code,
      COALESCE(p.display_name, p.title, p.code) AS display_name,
      COALESCE(p.amount_php, NULLIF(p.metadata->>'amount_php', '')::numeric, 0) AS amount_php,
      COALESCE(p.billing_kind, p.metadata->>'billing_kind', 'ONE_TIME') AS billing_kind,
      COALESCE(p.scope_kind, p.metadata->>'scope_kind') AS scope_kind,
      e.status AS entitlement_status,
      e.activated_at,
      e.expires_at,
      pay.id AS pending_payment_id
    FROM public.buklod_commercial_products p
    LEFT JOIN LATERAL (
      SELECT e2.status, e2.activated_at, e2.expires_at
      FROM public.buklod_scope_product_entitlements e2
      WHERE e2.scope_id = p_scope_id
        AND e2.product_code = p.code
        AND e2.status IN ('ACTIVE', 'EXPIRED')
      ORDER BY e2.activated_at DESC
      LIMIT 1
    ) e ON true
    LEFT JOIN LATERAL (
      SELECT pay2.id
      FROM public.buklod_scope_product_payments pay2
      WHERE pay2.scope_id = p_scope_id
        AND pay2.product_code = p.code
        AND pay2.status = 'pending_admin'
      ORDER BY pay2.created_at DESC
      LIMIT 1
    ) pay ON true
    WHERE p.is_active
      AND COALESCE(p.scope_kind, p.metadata->>'scope_kind') = v_scope.scope_type
      AND p.code IN (
        'cluster_premium',
        'cluster_lessons_ccp',
        'cluster_lessons_discipleship',
        'cluster_lessons_mentoring',
        'organization_focus_apps_annual'
      )
    ORDER BY p.code
  LOOP
    v_products := v_products || jsonb_build_array(jsonb_build_object(
      'product_code', v_row.code,
      'display_name', v_row.display_name,
      'amount_php', v_row.amount_php,
      'billing_kind', v_row.billing_kind,
      'status', CASE
        WHEN v_row.pending_payment_id IS NOT NULL THEN 'PENDING'
        WHEN v_row.entitlement_status = 'ACTIVE'
          AND (
            v_row.billing_kind = 'ONE_TIME'
            OR v_row.expires_at IS NULL
            OR v_row.expires_at >= now()
          ) THEN 'ACTIVE'
        WHEN v_row.entitlement_status = 'EXPIRED'
          OR (
            v_row.entitlement_status = 'ACTIVE'
            AND v_row.billing_kind = 'ANNUAL'
            AND v_row.expires_at IS NOT NULL
            AND v_row.expires_at < now()
          ) THEN 'EXPIRED'
        ELSE 'NOT_PURCHASED'
      END,
      'activated_at', v_row.activated_at,
      'expires_at', CASE
        WHEN v_row.billing_kind = 'ONE_TIME' THEN NULL
        ELSE v_row.expires_at
      END,
      'pending_payment_id', v_row.pending_payment_id,
      'can_purchase', v_billing,
      'organization_id', v_org,
      'needs_organization_link', COALESCE((v_scope.metadata->>'needs_organization_link')::boolean, false)
        AND v_scope.scope_type = 'CLUSTER'
        AND v_org IS NULL
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'scope_id', p_scope_id,
    'scope_type', v_scope.scope_type,
    'organization_id', v_org,
    'needs_organization_link', COALESCE((v_scope.metadata->>'needs_organization_link')::boolean, false)
      AND v_scope.organization_id IS NULL
      AND v_scope.scope_type = 'CLUSTER',
    'is_billing_manager', v_billing,
    'is_member', v_member,
    'gcash_number', '09811646218',
    'products', v_products
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_submit_scope_product_payment_v1(
  p_scope_id uuid,
  p_product_code text,
  p_gcash_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.buklod_commercial_products%ROWTYPE;
  v_scope public.buklod_scopes%ROWTYPE;
  v_ref text := NULLIF(btrim(p_gcash_reference), '');
  v_id uuid;
  v_scope_kind text;
  v_billing_kind text;
  v_amount numeric(12, 2);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_ref IS NULL OR char_length(v_ref) < 6 THEN
    RAISE EXCEPTION 'GCash reference is required';
  END IF;

  SELECT * INTO v_product
  FROM public.buklod_commercial_products
  WHERE code = p_product_code AND is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown product';
  END IF;

  v_scope_kind := COALESCE(v_product.scope_kind, v_product.metadata->>'scope_kind');
  v_billing_kind := COALESCE(v_product.billing_kind, v_product.metadata->>'billing_kind');
  v_amount := COALESCE(v_product.amount_php, NULLIF(v_product.metadata->>'amount_php', '')::numeric);

  SELECT * INTO v_scope
  FROM public.buklod_scopes
  WHERE id = p_scope_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope not found';
  END IF;

  IF v_scope.scope_type IS DISTINCT FROM v_scope_kind THEN
    RAISE EXCEPTION 'This product cannot be purchased for this scope';
  END IF;

  IF v_scope_kind = 'CLUSTER' THEN
    IF NOT public.buklod_is_cluster_billing_manager(p_scope_id, v_user) THEN
      RAISE EXCEPTION 'Only the Cluster Admin/Head can purchase this package';
    END IF;
    IF v_scope.organization_id IS NULL THEN
      RAISE EXCEPTION 'Link this Cluster to an Organization before purchasing';
    END IF;
  ELSIF v_scope_kind = 'ORGANIZATION' THEN
    IF NOT public.buklod_is_organization_billing_manager(p_scope_id, v_user) THEN
      RAISE EXCEPTION 'Only the Organization Admin can purchase this subscription';
    END IF;
  END IF;

  IF v_billing_kind = 'ONE_TIME'
     AND public.buklod_scope_has_product_v1(p_scope_id, p_product_code) THEN
    RAISE EXCEPTION 'This one-time package is already purchased for this Cluster';
  END IF;

  INSERT INTO public.buklod_scope_product_payments (
    scope_id, product_code, submitted_by, gcash_reference, amount_php, status
  )
  VALUES (
    p_scope_id, p_product_code, v_user, v_ref, v_amount, 'pending_admin'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'payment_id', v_id, 'status', 'pending_admin');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'A pending payment already exists for this product';
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_activate_scope_product_v1(
  p_scope_id uuid,
  p_product_code text,
  p_paid_by uuid,
  p_payment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
  v_existing public.buklod_scope_product_entitlements%ROWTYPE;
  v_start timestamptz;
BEGIN
  SELECT COALESCE(billing_kind, metadata->>'billing_kind') INTO v_kind
  FROM public.buklod_commercial_products
  WHERE code = p_product_code;

  SELECT * INTO v_existing
  FROM public.buklod_scope_product_entitlements
  WHERE scope_id = p_scope_id
    AND product_code = p_product_code
    AND status = 'ACTIVE'
  ORDER BY activated_at DESC
  LIMIT 1;

  IF v_kind = 'ONE_TIME' THEN
    IF v_existing.id IS NOT NULL THEN
      UPDATE public.buklod_scope_product_entitlements
      SET payment_id = COALESCE(p_payment_id, payment_id),
          paid_by = COALESCE(p_paid_by, paid_by),
          updated_at = now()
      WHERE id = v_existing.id;
      RETURN;
    END IF;

    INSERT INTO public.buklod_scope_product_entitlements (
      scope_id, product_code, status, activated_at, expires_at, paid_by, payment_id
    )
    VALUES (
      p_scope_id, p_product_code, 'ACTIVE', now(), NULL, p_paid_by, p_payment_id
    );
    RETURN;
  END IF;

  v_start := now();
  IF v_existing.id IS NOT NULL AND v_existing.expires_at IS NOT NULL AND v_existing.expires_at > now() THEN
    v_start := v_existing.expires_at;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.buklod_scope_product_entitlements
    SET status = 'ACTIVE',
        expires_at = v_start + interval '1 year',
        paid_by = COALESCE(p_paid_by, paid_by),
        payment_id = COALESCE(p_payment_id, payment_id),
        updated_at = now()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.buklod_scope_product_entitlements (
      scope_id, product_code, status, activated_at, expires_at, paid_by, payment_id
    )
    VALUES (
      p_scope_id, p_product_code, 'ACTIVE', now(), now() + interval '1 year',
      p_paid_by, p_payment_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_admin_review_scope_product_payment_v1(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.buklod_scope_product_payments%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin access required';
  END IF;

  SELECT * INTO v_pay
  FROM public.buklod_scope_product_payments
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_pay.status IS DISTINCT FROM 'pending_admin' THEN
    RAISE EXCEPTION 'Payment request is not pending';
  END IF;

  UPDATE public.buklod_scope_product_payments
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_user,
      reviewed_at = now(),
      admin_note = NULLIF(btrim(COALESCE(p_admin_note, '')), ''),
      updated_at = now()
  WHERE id = p_request_id;

  IF p_approve THEN
    PERFORM public.buklod_activate_scope_product_v1(
      v_pay.scope_id, v_pay.product_code, v_pay.submitted_by, v_pay.id
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_admin_list_scope_product_payments_v1(
  p_status text DEFAULT 'pending_admin',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
BEGIN
  IF NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'requests',
    COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT
          p.id,
          p.scope_id,
          s.name AS scope_name,
          p.product_code,
          p.submitted_by,
          COALESCE(pr.full_name, 'Member') AS submitter_name,
          p.gcash_reference,
          p.amount_php,
          p.status,
          p.created_at,
          p.reviewed_at,
          p.admin_note
        FROM public.buklod_scope_product_payments p
        JOIN public.buklod_scopes s ON s.id = p.scope_id
        LEFT JOIN public.profiles pr ON pr.id = p.submitted_by
        WHERE p.status = COALESCE(NULLIF(btrim(p_status), ''), 'pending_admin')
        ORDER BY p.created_at DESC
        LIMIT v_limit
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 11. Faith access overlay (Daily Reading + lesson packages)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_scope_faith_access_status_v1(
  p_scope_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scope public.buklod_scopes%ROWTYPE;
  v_cluster uuid;
  v_premium boolean := false;
  v_ccp boolean := false;
  v_disc boolean := false;
  v_ment boolean := false;
  v_pending_premium uuid;
  v_pending_ccp uuid;
  v_pending_disc uuid;
  v_pending_ment uuid;
  v_mzb boolean := false;
BEGIN
  SELECT * INTO v_scope FROM public.buklod_scopes WHERE id = p_scope_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope not found';
  END IF;

  v_cluster := CASE
    WHEN v_scope.scope_type = 'CLUSTER' THEN v_scope.id
    ELSE NULL
  END;

  v_mzb := (
    lower(COALESCE(v_scope.metadata->>'is_mzb', 'false')) IN ('true', '1', 'yes', 'on')
    OR lower(COALESCE(v_scope.metadata->>'organization_code', '')) = 'mzb'
    OR lower(COALESCE(v_scope.slug, '')) = 'mzb-ministry-inc'
  );

  IF v_cluster IS NOT NULL THEN
    v_premium := v_mzb OR public.buklod_scope_has_product_v1(v_cluster, 'cluster_premium');
    v_ccp := v_mzb OR public.buklod_scope_has_product_v1(v_cluster, 'cluster_lessons_ccp');
    v_disc := v_mzb OR public.buklod_scope_has_product_v1(v_cluster, 'cluster_lessons_discipleship');
    v_ment := v_mzb OR public.buklod_scope_has_product_v1(v_cluster, 'cluster_lessons_mentoring');

    SELECT id INTO v_pending_premium FROM public.buklod_scope_product_payments
      WHERE scope_id = v_cluster AND product_code = 'cluster_premium' AND status = 'pending_admin'
      ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO v_pending_ccp FROM public.buklod_scope_product_payments
      WHERE scope_id = v_cluster AND product_code = 'cluster_lessons_ccp' AND status = 'pending_admin'
      ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO v_pending_disc FROM public.buklod_scope_product_payments
      WHERE scope_id = v_cluster AND product_code = 'cluster_lessons_discipleship' AND status = 'pending_admin'
      ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO v_pending_ment FROM public.buklod_scope_product_payments
      WHERE scope_id = v_cluster AND product_code = 'cluster_lessons_mentoring' AND status = 'pending_admin'
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'scope_id', p_scope_id,
    'gcash_number', '09811646218',
    'is_mzb_scope_exempt', v_mzb,
    'is_mzb_user_exempt', v_mzb,
    'daily_reading', jsonb_build_object(
      'price_php', 49,
      'unlocked', v_premium,
      'pending_request_id', v_pending_premium
    ),
    'devotion_word', jsonb_build_object(
      'price_php', 49,
      'unlocked', v_premium,
      'pending_request_id', v_pending_premium
    ),
    'lesson_stages', jsonb_build_array(
      jsonb_build_object('stage_code', 101, 'title', 'CCP 101', 'price_php', 49, 'scope_unlocked', v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 102, 'title', 'CCP 102', 'price_php', 49, 'scope_unlocked', v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 103, 'title', 'CCP 103', 'price_php', 49, 'scope_unlocked', v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 104, 'title', 'Discipleship 104', 'price_php', 59, 'scope_unlocked', v_disc, 'pending_request_id', v_pending_disc),
      jsonb_build_object('stage_code', 105, 'title', 'Discipleship 105', 'price_php', 59, 'scope_unlocked', v_disc, 'pending_request_id', v_pending_disc),
      jsonb_build_object('stage_code', 106, 'title', 'Mentoring 106', 'price_php', 69, 'scope_unlocked', v_ment, 'pending_request_id', v_pending_ment),
      jsonb_build_object('stage_code', 107, 'title', 'Mentoring 107', 'price_php', 69, 'scope_unlocked', v_ment, 'pending_request_id', v_pending_ment)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_submit_faith_payment_v1(
  p_scope_id uuid,
  p_payment_kind text,
  p_gcash_reference text,
  p_stage_code integer DEFAULT NULL,
  p_feature_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_kind text := upper(COALESCE(NULLIF(btrim(p_payment_kind), ''), ''));
BEGIN
  IF v_kind IN ('DAILY_READING', 'DEVOTION_WORD') THEN
    v_code := 'cluster_premium';
  ELSIF v_kind = 'LESSON_STAGE' THEN
    IF p_stage_code BETWEEN 101 AND 103 THEN
      v_code := 'cluster_lessons_ccp';
    ELSIF p_stage_code BETWEEN 104 AND 105 THEN
      v_code := 'cluster_lessons_discipleship';
    ELSIF p_stage_code BETWEEN 106 AND 107 THEN
      v_code := 'cluster_lessons_mentoring';
    ELSE
      RAISE EXCEPTION 'Unknown lesson stage';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported payment kind. Cluster Admin/Head purchases Cluster packages.';
  END IF;

  RETURN public.buklod_submit_scope_product_payment_v1(p_scope_id, v_code, p_gcash_reference);
END;
$$;

-- ------------------------------------------------------------
-- 12. Organization Focus Apps ₱249/year
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_can_use_organization_focus_app_v1(
  p_organization_id uuid,
  p_app text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_app text := lower(COALESCE(NULLIF(btrim(p_app), ''), ''));
  v_gated boolean;
  v_active boolean := false;
  v_mzb boolean := false;
  v_admin boolean := false;
  v_status text := 'NOT_PURCHASED';
  v_activated timestamptz;
  v_expires timestamptz;
  v_pending uuid;
BEGIN
  PERFORM public.buklod_expire_annual_entitlements_v1();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_scopes
    WHERE id = p_organization_id AND scope_type = 'ORGANIZATION'
  ) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  v_admin := public.buklod_is_system_admin();
  v_gated := v_app IN ('faculty', 'business', 'government', 'family', 'health', 'market', 'local', 'palengke', 'commercial');

  SELECT
    lower(COALESCE(s.metadata->>'is_mzb', 'false')) IN ('true', '1', 'yes', 'on')
    OR lower(COALESCE(s.metadata->>'organization_code', '')) = 'mzb'
    OR lower(COALESCE(s.slug, '')) = 'mzb-ministry-inc'
  INTO v_mzb
  FROM public.buklod_scopes s
  WHERE s.id = p_organization_id;

  SELECT e.status, e.activated_at, e.expires_at
    INTO v_status, v_activated, v_expires
  FROM public.buklod_scope_product_entitlements e
  WHERE e.scope_id = p_organization_id
    AND e.product_code = 'organization_focus_apps_annual'
    AND e.status IN ('ACTIVE', 'EXPIRED')
  ORDER BY e.activated_at DESC
  LIMIT 1;

  IF v_status IS NULL THEN
    v_status := 'NOT_PURCHASED';
  END IF;

  SELECT id INTO v_pending
  FROM public.buklod_scope_product_payments
  WHERE scope_id = p_organization_id
    AND product_code = 'organization_focus_apps_annual'
    AND status = 'pending_admin'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pending IS NOT NULL AND v_status = 'NOT_PURCHASED' THEN
    v_status := 'PENDING';
  END IF;

  v_active := public.buklod_scope_has_product_v1(
    p_organization_id, 'organization_focus_apps_annual'
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'app', v_app,
    'gated', v_gated,
    'can_use', (NOT v_gated) OR v_admin OR v_mzb OR v_active,
    'subscription_active', v_active OR v_mzb OR v_admin,
    'status', CASE
      WHEN v_active THEN 'ACTIVE'
      ELSE v_status
    END,
    'activated_at', v_activated,
    'expires_at', v_expires,
    'is_system_admin', v_admin,
    'is_mzb_exempt', v_mzb,
    'pending_payment_id', v_pending
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_focus_app_access_status_v1(
  p_scope_id uuid,
  p_focus_app_code text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_scope public.buklod_scopes%ROWTYPE;
  v_org uuid;
  v_code text := lower(COALESCE(NULLIF(btrim(p_focus_app_code), ''), 'commercial'));
  v_access jsonb;
  v_names jsonb := jsonb_build_object(
    'faculty', 'BUKLOD Faculty',
    'local', 'BUKLOD Local',
    'government', 'BUKLOD Local',
    'family', 'BUKLOD Family',
    'palengke', 'BUKLOD Palengke',
    'market', 'BUKLOD Palengke',
    'health', 'BUKLOD Health',
    'commercial', 'BUKLOD Commercial',
    'business', 'BUKLOD Commercial',
    'attendance', 'BUKLOD Attendance',
    'giving', 'BUKLOD Giving',
    'report', 'BUKLOD Report'
  );
BEGIN
  SELECT * INTO v_scope FROM public.buklod_scopes WHERE id = p_scope_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope not found';
  END IF;

  v_org := CASE
    WHEN v_scope.scope_type = 'ORGANIZATION' THEN v_scope.id
    ELSE COALESCE(v_scope.organization_id, public.buklod_resolve_cluster_organization_id(v_scope.id))
  END;

  IF v_org IS NULL THEN
    v_access := jsonb_build_object(
      'can_use', false,
      'subscription_active', false,
      'status', 'NOT_PURCHASED',
      'activated_at', NULL,
      'expires_at', NULL,
      'is_system_admin', public.buklod_is_system_admin(),
      'is_mzb_exempt', false,
      'pending_payment_id', NULL
    );
  ELSE
    v_access := public.buklod_can_use_organization_focus_app_v1(v_org, v_code);
  END IF;

  RETURN jsonb_build_object(
    'scope_id', p_scope_id,
    'focus_app_code', v_code,
    'display_name', COALESCE(v_names->>v_code, 'Focus App'),
    'annual_amount_php', 249,
    'currency', 'PHP',
    'gcash_number', '09811646218',
    'billing_interval', 'YEARLY',
    'is_system_admin', COALESCE((v_access->>'is_system_admin')::boolean, false),
    'is_mzb_exempt', COALESCE((v_access->>'is_mzb_exempt')::boolean, false),
    'is_scope_admin', public.buklod_is_organization_billing_manager(COALESCE(v_org, p_scope_id), v_user)
      OR public.buklod_is_cluster_billing_manager(p_scope_id, v_user),
    'subscription_active', COALESCE((v_access->>'subscription_active')::boolean, false),
    'valid_until', v_access->>'expires_at',
    'is_focus_app_admin', public.buklod_is_organization_billing_manager(COALESCE(v_org, p_scope_id), v_user),
    'can_access', COALESCE((v_access->>'can_use')::boolean, false),
    'pending_payment', CASE
      WHEN v_access->>'pending_payment_id' IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_access->>'pending_payment_id',
        'status', 'pending_admin',
        'gcash_reference', '',
        'submitted_at', now()
      )
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_focus_app_submit_payment_v1(
  p_scope_id uuid,
  p_focus_app_code text,
  p_gcash_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scope public.buklod_scopes%ROWTYPE;
  v_org uuid;
BEGIN
  SELECT * INTO v_scope FROM public.buklod_scopes WHERE id = p_scope_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope not found';
  END IF;

  v_org := CASE
    WHEN v_scope.scope_type = 'ORGANIZATION' THEN v_scope.id
    ELSE COALESCE(v_scope.organization_id, public.buklod_resolve_cluster_organization_id(v_scope.id))
  END;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization subscription is billed per Organization';
  END IF;

  RETURN public.buklod_submit_scope_product_payment_v1(
    v_org,
    'organization_focus_apps_annual',
    p_gcash_reference
  );
END;
$$;

-- ------------------------------------------------------------
-- 13. Organization type CHURCH + registration + discovery
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_upsert_organization_location_v1(
  p_scope_id uuid,
  p_address_line text DEFAULT NULL,
  p_barangay text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_province text DEFAULT NULL,
  p_country text DEFAULT 'Philippines',
  p_safe_label text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_geocode_status text DEFAULT NULL,
  p_geocode_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text := COALESCE(NULLIF(btrim(p_geocode_status), ''), 
    CASE WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN 'ok' ELSE 'pending' END);
  v_label text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_billing_manager(p_scope_id, v_user)
  ) THEN
    RAISE EXCEPTION 'Organization Admin access required';
  END IF;

  v_label := NULLIF(btrim(COALESCE(p_safe_label, '')), '');
  IF v_label IS NULL THEN
    v_label := NULLIF(btrim(concat_ws(', ',
      NULLIF(btrim(COALESCE(p_barangay, '')), ''),
      NULLIF(btrim(COALESCE(p_city, '')), ''),
      NULLIF(btrim(COALESCE(p_province, '')), '')
    )), '');
  END IF;

  INSERT INTO public.buklod_organization_locations (
    scope_id, address_line, barangay, city_municipality, province, country,
    safe_location_label, latitude, longitude, geocode_status, geocode_query,
    geocoded_at, updated_at
  )
  VALUES (
    p_scope_id,
    NULLIF(btrim(COALESCE(p_address_line, '')), ''),
    NULLIF(btrim(COALESCE(p_barangay, '')), ''),
    NULLIF(btrim(COALESCE(p_city, '')), ''),
    NULLIF(btrim(COALESCE(p_province, '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_country, '')), ''), 'Philippines'),
    v_label,
    p_latitude,
    p_longitude,
    v_status,
    NULLIF(btrim(COALESCE(p_geocode_query, '')), ''),
    CASE WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (scope_id) DO UPDATE
  SET address_line = COALESCE(EXCLUDED.address_line, public.buklod_organization_locations.address_line),
      barangay = COALESCE(EXCLUDED.barangay, public.buklod_organization_locations.barangay),
      city_municipality = COALESCE(EXCLUDED.city_municipality, public.buklod_organization_locations.city_municipality),
      province = COALESCE(EXCLUDED.province, public.buklod_organization_locations.province),
      country = COALESCE(EXCLUDED.country, public.buklod_organization_locations.country),
      safe_location_label = COALESCE(EXCLUDED.safe_location_label, public.buklod_organization_locations.safe_location_label),
      latitude = COALESCE(EXCLUDED.latitude, public.buklod_organization_locations.latitude),
      longitude = COALESCE(EXCLUDED.longitude, public.buklod_organization_locations.longitude),
      geocode_status = EXCLUDED.geocode_status,
      geocode_query = COALESCE(EXCLUDED.geocode_query, public.buklod_organization_locations.geocode_query),
      geocoded_at = CASE
        WHEN EXCLUDED.latitude IS NOT NULL THEN now()
        ELSE public.buklod_organization_locations.geocoded_at
      END,
      updated_at = now();

  UPDATE public.buklod_scopes
  SET latitude = COALESCE(p_latitude, latitude),
      longitude = COALESCE(p_longitude, longitude),
      safe_location_label = COALESCE(v_label, safe_location_label),
      map_location_updated_at = CASE
        WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN now()
        ELSE map_location_updated_at
      END,
      map_location_updated_by = CASE
        WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN v_user
        ELSE map_location_updated_by
      END
  WHERE id = p_scope_id;

  RETURN jsonb_build_object(
    'ok', true,
    'scope_id', p_scope_id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'safe_location_label', v_label
  );
END;
$$;

DROP FUNCTION IF EXISTS public.buklod_find_existing_church_scope_v1(text);

CREATE OR REPLACE FUNCTION public.buklod_find_existing_church_scope_v1(
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := lower(regexp_replace(COALESCE(p_name, ''), '[^a-zA-Z0-9]+', ' ', 'g'));
  v_row record;
BEGIN
  v_key := btrim(v_key);
  IF char_length(v_key) < 6 THEN
    RETURN NULL;
  END IF;

  SELECT
    s.id,
    s.name,
    s.visibility,
    s.status,
    loc.latitude,
    loc.longitude,
    loc.safe_location_label
  INTO v_row
  FROM public.buklod_scopes s
  LEFT JOIN public.buklod_organization_locations loc ON loc.scope_id = s.id
  WHERE COALESCE(s.status::text, 'ACTIVE') <> 'DELETED'
    AND (
      (s.scope_type = 'ORGANIZATION' AND upper(COALESCE(s.metadata->>'organization_type', '')) = 'CHURCH')
      OR s.scope_type = 'CHURCH'
    )
    AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]+', ' ', 'g')) = v_key
  ORDER BY s.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'scope_id', v_row.id,
    'scope_name', v_row.name,
    'visibility', v_row.visibility,
    'scope_status', v_row.status,
    'can_setup', public.buklod_is_organization_billing_manager(v_row.id, auth.uid())
      OR public.buklod_is_system_admin(),
    'already_registered', true,
    'has_worship_pin', v_row.latitude IS NOT NULL AND v_row.longitude IS NOT NULL,
    'has_pastor_or_mentor', public.buklod_is_cluster_approver(v_row.id, auth.uid()),
    'safe_location_label', v_row.safe_location_label
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_register_church_setup_v1(
  p_name text,
  p_safe_location_label text,
  p_latitude double precision,
  p_longitude double precision,
  p_visibility text DEFAULT 'PUBLIC',
  p_leader_kind text DEFAULT 'pastor',
  p_authority_confirmed boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_existing_scope_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := p_existing_scope_id;
  v_profile jsonb;
BEGIN
  IF p_authority_confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'Confirm that you are authorized to register this church';
  END IF;

  v_profile := jsonb_build_object(
    'description', NULLIF(btrim(COALESCE(p_description, '')), ''),
    'leader_kind', COALESCE(NULLIF(btrim(p_leader_kind), ''), 'pastor'),
    'safe_location_label', NULLIF(btrim(COALESCE(p_safe_location_label, '')), ''),
    'address_line', NULLIF(btrim(COALESCE(p_safe_location_label, '')), '')
  );

  IF v_id IS NULL THEN
    v_id := public.buklod_create_organization_v3(
      p_name,
      'CHURCH',
      v_profile,
      COALESCE(NULLIF(btrim(p_visibility), ''), 'PUBLIC'),
      'APPROVAL_REQUIRED'
    );
  ELSIF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_billing_manager(v_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'You cannot continue setup for this church';
  END IF;

  PERFORM public.buklod_upsert_organization_location_v1(
    v_id,
    p_safe_location_label,
    NULL, NULL, NULL, 'Philippines',
    p_safe_location_label,
    p_latitude,
    p_longitude,
    'manual',
    p_safe_location_label
  );

  UPDATE public.buklod_scopes
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'organization_type', 'CHURCH',
    'leader_kind', COALESCE(NULLIF(btrim(p_leader_kind), ''), 'pastor')
  )
  WHERE id = v_id;

  RETURN jsonb_build_object(
    'scope_id', v_id,
    'name', (SELECT name FROM public.buklod_scopes WHERE id = v_id),
    'has_name', true,
    'safe_location_label', p_safe_location_label,
    'has_safe_location_label', NULLIF(btrim(COALESCE(p_safe_location_label, '')), '') IS NOT NULL,
    'has_worship_pin', p_latitude IS NOT NULL AND p_longitude IS NOT NULL,
    'visibility', COALESCE(NULLIF(btrim(p_visibility), ''), 'PUBLIC'),
    'scope_status', 'ACTIVE',
    'has_pastor_or_mentor', true,
    'verification_status', 'REGISTERED',
    'nearby_discoverable', p_latitude IS NOT NULL AND p_longitude IS NOT NULL
      AND upper(COALESCE(NULLIF(btrim(p_visibility), ''), 'PUBLIC')) = 'PUBLIC',
    'reused', p_existing_scope_id IS NOT NULL,
    'already_registered', true,
    'can_setup', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_find_church_organizations_v1(
  p_query text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  scope_id uuid,
  scope_name text,
  scope_type text,
  organization_type text,
  safe_location_label text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  visibility text,
  join_policy text,
  membership_state text,
  accountability_ready boolean,
  is_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 30), 60));
  v_q text := lower(btrim(COALESCE(p_query, '')));
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name::text,
    'CHURCH'::text,
    'CHURCH'::text,
    COALESCE(loc.safe_location_label, s.safe_location_label, s.metadata->>'safe_location_label'),
    COALESCE(loc.latitude, s.latitude),
    COALESCE(loc.longitude, s.longitude),
    CASE
      WHEN p_latitude IS NULL OR p_longitude IS NULL
        OR COALESCE(loc.latitude, s.latitude) IS NULL
        OR COALESCE(loc.longitude, s.longitude) IS NULL
        THEN NULL
      ELSE (
        6371 * acos(LEAST(1::double precision, GREATEST(-1::double precision,
          cos(radians(p_latitude)) * cos(radians(COALESCE(loc.latitude, s.latitude))) *
          cos(radians(COALESCE(loc.longitude, s.longitude)) - radians(p_longitude)) +
          sin(radians(p_latitude)) * sin(radians(COALESCE(loc.latitude, s.latitude)))
        )))
      )
    END,
    COALESCE(s.visibility::text, 'PUBLIC'),
    COALESCE(s.metadata->>'join_policy', 'APPROVAL_REQUIRED'),
    m.membership_status::text,
    (COALESCE(loc.latitude, s.latitude) IS NOT NULL
      AND COALESCE(loc.longitude, s.longitude) IS NOT NULL
      AND COALESCE(s.visibility::text, 'PUBLIC') = 'PUBLIC'),
    public.buklod_is_organization_billing_manager(s.id, v_user)
  FROM public.buklod_scopes s
  LEFT JOIN public.buklod_organization_locations loc ON loc.scope_id = s.id
  LEFT JOIN public.buklod_scope_memberships m
    ON m.scope_id = s.id AND m.user_id = v_user
  WHERE s.scope_type = 'ORGANIZATION'
    AND upper(COALESCE(s.metadata->>'organization_type', '')) = 'CHURCH'
    AND COALESCE(s.status::text, 'ACTIVE') <> 'DELETED'
    AND (
      COALESCE(s.visibility::text, 'PUBLIC') = 'PUBLIC'
      OR m.user_id IS NOT NULL
      OR public.buklod_is_organization_billing_manager(s.id, v_user)
      OR public.buklod_is_system_admin()
    )
    AND (
      v_q = ''
      OR lower(s.name) LIKE '%' || v_q || '%'
      OR lower(COALESCE(loc.safe_location_label, '')) LIKE '%' || v_q || '%'
      OR lower(COALESCE(loc.city_municipality, '')) LIKE '%' || v_q || '%'
    )
  ORDER BY
    CASE WHEN COALESCE(loc.latitude, s.latitude) IS NULL THEN 1 ELSE 0 END,
    distance_km NULLS LAST,
    lower(s.name)
  LIMIT v_limit;
END;
$$;

-- Patch organization v3 allowed types to include CHURCH without rewriting the whole function.
CREATE OR REPLACE FUNCTION public.buklod_create_organization_v3(
  _name text,
  _organization_type text,
  _profile jsonb DEFAULT '{}'::jsonb,
  _visibility text DEFAULT 'PUBLIC',
  _join_policy text DEFAULT 'APPROVAL_REQUIRED'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_name text := NULLIF(btrim(_name), '');
  v_type text := upper(COALESCE(NULLIF(btrim(_organization_type), ''), ''));
  v_visibility text := upper(COALESCE(NULLIF(btrim(_visibility), ''), 'PUBLIC'));
  v_join text := upper(COALESCE(NULLIF(btrim(_join_policy), ''), 'APPROVAL_REQUIRED'));
  v_slug text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  IF v_type NOT IN (
    'CHURCH', 'MINISTRY_FAITH', 'NGO_FOUNDATION', 'SCHOOL_EDUCATION',
    'BUSINESS_COMPANY', 'ASSOCIATION_PROFESSIONAL', 'COMMUNITY_CIVIC', 'OTHER',
    'MINISTRY', 'NONPROFIT', 'ASSOCIATION', 'EDUCATION', 'BUSINESS',
    'GOVERNMENT_CIVIC', 'HEALTHCARE', 'PROFESSIONAL', 'COMMUNITY_ADVOCACY',
    'MZB_MINISTRY'
  ) THEN
    RAISE EXCEPTION 'Unsupported organization type';
  END IF;
  IF v_visibility NOT IN ('PUBLIC', 'PRIVATE') THEN
    RAISE EXCEPTION 'Invalid visibility';
  END IF;
  IF v_visibility = 'PRIVATE' THEN
    v_join := 'INVITE_ONLY';
  ELSIF v_join NOT IN ('OPEN', 'APPROVAL_REQUIRED', 'INVITE_ONLY') THEN
    RAISE EXCEPTION 'Invalid join policy';
  END IF;

  v_slug := trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')));
  IF v_slug = '' THEN v_slug := 'organization'; END IF;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.buklod_scopes (
    scope_type, name, slug, description, status, visibility, created_by,
    parent_scope_id, logo_url, cover_url, metadata
  )
  VALUES (
    'ORGANIZATION',
    v_name,
    v_slug,
    NULLIF(btrim(COALESCE(_profile->>'description', '')), ''),
    'ACTIVE',
    v_visibility,
    v_user,
    NULL,
    NULLIF(btrim(COALESCE(_profile->>'logo_url', '')), ''),
    NULLIF(btrim(COALESCE(_profile->>'cover_url', '')), ''),
    COALESCE(_profile, '{}'::jsonb) || jsonb_build_object(
      'organization_type', v_type,
      'join_policy', v_join,
      'created_from', 'BUKLOD_ORGANIZATION_CREATE_V3'
    )
  )
  RETURNING id INTO v_id;

  INSERT INTO public.buklod_scope_memberships (
    scope_id, user_id, membership_status, membership_source, joined_at, left_at
  )
  VALUES (v_id, v_user, 'ACTIVE', 'SELF', now(), NULL)
  ON CONFLICT (scope_id, user_id) DO UPDATE
    SET membership_status = 'ACTIVE',
        membership_source = 'SELF',
        joined_at = COALESCE(public.buklod_scope_memberships.joined_at, now()),
        left_at = NULL;

  INSERT INTO public.buklod_scope_role_assignments (
    scope_id, user_id, role_key, status, assigned_by, revoked_at
  )
  VALUES (v_id, v_user, 'ORG_ADMIN', 'ACTIVE', v_user, NULL)
  ON CONFLICT (scope_id, user_id, role_key) DO UPDATE
    SET status = 'ACTIVE', assigned_by = v_user, revoked_at = NULL;

  IF v_type = 'CHURCH' THEN
    PERFORM public.buklod_upsert_organization_location_v1(
      v_id,
      _profile->>'address_line',
      _profile->>'barangay',
      COALESCE(_profile->>'city_municipality', _profile->>'city'),
      _profile->>'province',
      COALESCE(_profile->>'country', 'Philippines'),
      COALESCE(_profile->>'safe_location_label', _profile->>'location'),
      NULLIF(_profile->>'latitude', '')::double precision,
      NULLIF(_profile->>'longitude', '')::double precision,
      CASE
        WHEN NULLIF(_profile->>'latitude', '') IS NOT NULL THEN 'ok'
        ELSE 'pending'
      END,
      _profile->>'location'
    );
  END IF;

  RETURN v_id;
END;
$$;

-- ------------------------------------------------------------
-- 14. Cluster-scoped approval
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_cluster_approval_setup_status_v1(
  p_cluster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_scopes
    WHERE id = p_cluster_id AND scope_type = 'CLUSTER'
  ) THEN
    RAISE EXCEPTION 'Cluster not found';
  END IF;

  v_has := EXISTS (
    SELECT 1
    FROM public.buklod_scope_role_assignments ra
    WHERE ra.scope_id = p_cluster_id
      AND ra.status = 'ACTIVE'
      AND upper(ra.role_key) IN ('CLUSTER_ADMIN', 'CLUSTER_HEAD', 'ADMIN', 'PASTOR', 'MENTOR')
  ) OR EXISTS (
    SELECT 1
    FROM public.buklod_scope_memberships m
    WHERE m.scope_id = p_cluster_id
      AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
      AND public.buklod_user_has_functional_approver_role(p_cluster_id, m.user_id)
  );

  RETURN jsonb_build_object(
    'cluster_id', p_cluster_id,
    'has_authorized_approver', v_has,
    'message', CASE
      WHEN v_has THEN NULL
      ELSE 'This Cluster has no authorized Cluster Head, Mentor, or Pastor yet. Official completion cannot be approved until one is assigned.'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_approve_cluster_formation_item_v1(
  p_cluster_id uuid,
  p_learner_id uuid,
  p_item_kind text,
  p_item_id text,
  p_approve boolean,
  p_remarks text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_kind text := upper(COALESCE(NULLIF(btrim(p_item_kind), ''), ''));
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_kind NOT IN ('DAILY_READING', 'LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING') THEN
    RAISE EXCEPTION 'Unsupported approval item';
  END IF;

  IF v_user = p_learner_id AND NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'Members cannot approve their own completion';
  END IF;

  IF NOT public.buklod_is_cluster_approver(p_cluster_id, v_user) THEN
    RAISE EXCEPTION 'Approval requires Cluster Head, Mentor, or Pastor authority in this Cluster';
  END IF;

  IF NOT public.buklod_user_is_active_scope_member(p_cluster_id, p_learner_id) THEN
    RAISE EXCEPTION 'Learner is not an active member of this Cluster';
  END IF;

  UPDATE public.buklod_cluster_formation_approvals
  SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      approver_id = v_user,
      remarks = NULLIF(btrim(COALESCE(p_remarks, '')), ''),
      decided_at = now(),
      updated_at = now()
  WHERE cluster_id = p_cluster_id
    AND learner_id = p_learner_id
    AND item_kind = v_kind
    AND item_id = NULLIF(btrim(p_item_id), '')
    AND status = 'PENDING'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.buklod_cluster_formation_approvals (
      cluster_id, learner_id, approver_id, item_kind, item_id, status, remarks, decided_at
    )
    VALUES (
      p_cluster_id,
      p_learner_id,
      v_user,
      v_kind,
      NULLIF(btrim(p_item_id), ''),
      CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      NULLIF(btrim(COALESCE(p_remarks, '')), ''),
      now()
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'approval_id', v_id, 'status', CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_cluster_learning_validation_queue_v1(
  p_cluster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.buklod_is_cluster_approver(p_cluster_id, auth.uid()) THEN
    RAISE EXCEPTION 'Approval requires Cluster Head, Mentor, or Pastor authority in this Cluster';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x))
    FROM (
      SELECT
        a.id AS progress_id,
        a.learner_id AS user_id,
        a.item_id AS lesson_id,
        a.item_kind,
        a.status,
        a.created_at AS studied_at,
        a.remarks,
        a.cluster_id
      FROM public.buklod_cluster_formation_approvals a
      WHERE a.cluster_id = p_cluster_id
        AND a.status = 'PENDING'
      ORDER BY a.created_at
    ) x
  ), '[]'::jsonb);
END;
$$;

-- ------------------------------------------------------------
-- 14b. Cluster-scoped formation approval overlays
-- Replaces Local Church pastor gating for official completion.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_validate_formation_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL
    AND p_user_id <> auth.uid()
    AND (
      (to_regprocedure('public.is_system_admin()') IS NOT NULL AND public.is_system_admin())
      OR public.buklod_is_system_admin()
      OR EXISTS (
        SELECT 1
        FROM public.buklod_scope_memberships m
        JOIN public.buklod_scopes s
          ON s.id = m.scope_id
         AND s.scope_type = 'CLUSTER'
        WHERE m.user_id = p_user_id
          AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
          AND public.buklod_is_cluster_approver(m.scope_id, auth.uid())
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.pastor_get_learning_validation_queue_v2()
RETURNS TABLE (
  progress_id uuid,
  user_id uuid,
  member_name text,
  church_id uuid,
  church_name text,
  enrollment_id uuid,
  lesson_id uuid,
  lesson_number integer,
  lesson_title text,
  track_title text,
  studied_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  v_can boolean := false;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_can := public.buklod_is_system_admin()
    OR (to_regprocedure('public.is_system_admin()') IS NOT NULL AND public.is_system_admin())
    OR (to_regprocedure('public.has_app_role(uuid,text)') IS NOT NULL AND (
      public.has_app_role(actor, 'pastor') OR public.has_app_role(actor, 'mentor')
    ))
    OR EXISTS (
      SELECT 1
      FROM public.buklod_scope_role_assignments ra
      JOIN public.buklod_scopes s ON s.id = ra.scope_id AND s.scope_type = 'CLUSTER'
      WHERE ra.user_id = actor
        AND ra.status = 'ACTIVE'
        AND upper(ra.role_key) IN ('CLUSTER_ADMIN', 'CLUSTER_HEAD', 'ADMIN', 'PASTOR', 'MENTOR')
    );

  IF NOT v_can THEN
    RAISE EXCEPTION 'Cluster Head, Mentor, Pastor, or System Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    lp.id,
    p.id,
    p.full_name,
    p.church_id,
    COALESCE(c.name, 'Cluster')::text,
    lp.enrollment_id,
    l.id,
    l.lesson_number,
    l.title,
    t.title,
    lp.updated_at
  FROM public.lesson_progress lp
  JOIN public.profiles p ON p.id = lp.user_id
  LEFT JOIN public.churches c ON c.id = p.church_id
  JOIN public.learning_lessons l ON l.id = lp.lesson_id
  JOIN public.learning_tracks t ON t.id = l.track_id
  JOIN public.track_enrollments e ON e.id = lp.enrollment_id
  WHERE p.is_active = true
    AND COALESCE(p.is_verified, false) = true
    AND t.formation_program IN ('ccp', 'discipleship')
    AND e.user_id = p.id
    AND (
      public.buklod_is_system_admin()
      OR public.can_validate_formation_member(p.id)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.member_lesson_attempts a
      WHERE a.user_id = p.id
        AND a.lesson_id = l.id
        AND a.reset_at IS NULL
        AND a.review_status IN ('pending_admin', 'approved')
    )
  ORDER BY c.name NULLS LAST, p.full_name, t.title, l.lesson_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_enqueue_cluster_formation_approvals_v1(
  p_learner_id uuid,
  p_item_kind text,
  p_item_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind text := upper(COALESCE(NULLIF(btrim(p_item_kind), ''), 'LESSON'));
  v_item text := NULLIF(btrim(p_item_id), '');
BEGIN
  IF p_learner_id IS NULL OR v_item IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.buklod_cluster_formation_approvals (
    cluster_id, learner_id, approver_id, item_kind, item_id, status
  )
  SELECT
    m.scope_id,
    p_learner_id,
    NULL,
    v_kind,
    v_item,
    'PENDING'
  FROM public.buklod_scope_memberships m
  JOIN public.buklod_scopes s
    ON s.id = m.scope_id
   AND s.scope_type = 'CLUSTER'
  WHERE m.user_id = p_learner_id
    AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1
      FROM public.buklod_cluster_formation_approvals a
      WHERE a.cluster_id = m.scope_id
        AND a.learner_id = p_learner_id
        AND a.item_kind = v_kind
        AND a.item_id = v_item
        AND a.status IN ('PENDING', 'APPROVED')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_enqueue_lesson_cluster_approval_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.buklod_enqueue_cluster_formation_approvals_v1(
    NEW.user_id,
    'LESSON',
    NEW.lesson_id::text
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.learning_lesson_responses') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS buklod_enqueue_lesson_cluster_approval_trg
      ON public.learning_lesson_responses;
    CREATE TRIGGER buklod_enqueue_lesson_cluster_approval_trg
      AFTER INSERT OR UPDATE OF question_answers, reflection_text
      ON public.learning_lesson_responses
      FOR EACH ROW
      EXECUTE PROCEDURE public.buklod_enqueue_lesson_cluster_approval_trg();
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 15. Grants
-- ------------------------------------------------------------
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'buklod_user_is_active_scope_member',
        'buklod_user_has_scope_roles',
        'buklod_user_has_functional_approver_role',
        'buklod_is_cluster_billing_manager',
        'buklod_is_organization_billing_manager',
        'buklod_is_cluster_approver',
        'buklod_resolve_cluster_organization_id',
        'buklod_expire_annual_entitlements_v1',
        'buklod_scope_has_product_v1',
        'buklod_create_cluster_v2',
        'buklod_create_cluster',
        'buklod_link_cluster_organization_v1',
        'buklod_scope_product_access_v1',
        'buklod_submit_scope_product_payment_v1',
        'buklod_activate_scope_product_v1',
        'buklod_admin_review_scope_product_payment_v1',
        'buklod_admin_list_scope_product_payments_v1',
        'buklod_scope_faith_access_status_v1',
        'buklod_submit_faith_payment_v1',
        'buklod_can_use_organization_focus_app_v1',
        'buklod_focus_app_access_status_v1',
        'buklod_focus_app_submit_payment_v1',
        'buklod_upsert_organization_location_v1',
        'buklod_find_existing_church_scope_v1',
        'buklod_register_church_setup_v1',
        'buklod_find_church_organizations_v1',
        'buklod_create_organization_v3',
        'buklod_cluster_approval_setup_status_v1',
        'buklod_approve_cluster_formation_item_v1',
        'buklod_cluster_learning_validation_queue_v1',
        'buklod_enqueue_cluster_formation_approvals_v1',
        'can_validate_formation_member',
        'pastor_get_learning_validation_queue_v2'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', fn.schema, fn.proname, fn.args);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
      fn.schema, fn.proname, fn.args
    );
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.buklod_activate_scope_product_v1(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_activate_scope_product_v1(uuid, text, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.buklod_cluster_require_organization_trg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_cluster_require_organization_trg() TO service_role;

-- Deprecated per-stage lesson prices remain in historical tables if present.
-- New authorization uses buklod_scope_product_entitlements only.

COMMENT ON TABLE public.buklod_commercial_products IS
  'Canonical BUKLOD commercial products. Authorization uses product codes, not display names.';
COMMENT ON TABLE public.buklod_scope_product_entitlements IS
  'Backend-authoritative Cluster/Organization entitlements. Clients cannot self-grant.';
COMMENT ON COLUMN public.buklod_scopes.organization_id IS
  'Required parent Organization for CLUSTER rows created after 20260827120000.';


