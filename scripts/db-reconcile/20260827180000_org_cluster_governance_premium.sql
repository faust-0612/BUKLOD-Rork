-- ============================================================
-- BUKLOD Organization / Cluster governance + Focus Apps premium
-- 20260827180000
-- Additive / idempotent. Does not rewrite historical payments.
-- Supersedes ₱249/year as a sellable Focus Apps product.
-- New sellable prices: ₱59/month and ₱499/year.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. Focus Apps catalog: monthly ₱59 + annual ₱499
-- Historical payment rows keep their original amount_php.
-- ------------------------------------------------------------
ALTER TABLE public.buklod_commercial_products
  ADD COLUMN IF NOT EXISTS deprecated_note text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

INSERT INTO public.buklod_commercial_products (
  code, title, description, product_kind, tier_code, feature_keys, limits, is_active, metadata, updated_at
) VALUES
  (
    'organization_focus_apps_monthly',
    'BUKLOD Focus Apps Monthly',
    'P59/month per Organization. Unlocks Organization-level Focus App portals. Not a registration fee.',
    'SUBSCRIPTION',
    'STANDARD',
    '["focus_apps"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 59,
      'billing_kind', 'MONTHLY',
      'scope_kind', 'ORGANIZATION',
      'lesson_stages', '[]'::jsonb,
      'includes_daily_bible', false
    ),
    now()
  ),
  (
    'organization_focus_apps_annual',
    'BUKLOD Focus Apps Annual',
    'P499/year per Organization. Unlocks Organization-level Focus App portals. Not a registration fee. Replaces the retired P249/year sellable price.',
    'SUBSCRIPTION',
    'STANDARD',
    '["focus_apps"]'::jsonb,
    '{}'::jsonb,
    true,
    jsonb_build_object(
      'amount_php', 499,
      'billing_kind', 'ANNUAL',
      'scope_kind', 'ORGANIZATION',
      'lesson_stages', '[]'::jsonb,
      'includes_daily_bible', false,
      'supersedes_amount_php', 249
    ),
    now()
  )
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    is_active = true,
    metadata = COALESCE(public.buklod_commercial_products.metadata, '{}'::jsonb) || EXCLUDED.metadata,
    updated_at = now();

UPDATE public.buklod_commercial_products
SET display_name = COALESCE(NULLIF(display_name, ''), title, code),
    billing_kind = CASE code
      WHEN 'organization_focus_apps_monthly' THEN 'MONTHLY'
      WHEN 'organization_focus_apps_annual' THEN 'ANNUAL'
      ELSE COALESCE(NULLIF(billing_kind, ''), metadata->>'billing_kind', billing_kind)
    END,
    scope_kind = 'ORGANIZATION',
    amount_php = CASE code
      WHEN 'organization_focus_apps_monthly' THEN 59
      WHEN 'organization_focus_apps_annual' THEN 499
      ELSE amount_php
    END,
    deprecated_note = CASE
      WHEN code = 'organization_focus_apps_annual'
        THEN 'Sellable price is P499/year. Historical P249 payments remain valid for audit.'
      ELSE deprecated_note
    END,
    updated_at = now()
WHERE code IN (
  'organization_focus_apps_monthly',
  'organization_focus_apps_annual'
);

-- Do not rewrite historical GCash payment amounts.
-- Existing ₱249 approved rows stay as-is.

-- ------------------------------------------------------------
-- 2. Cross-organization access grants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_organization_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_org_id uuid NOT NULL REFERENCES public.buklod_scopes(id) ON DELETE CASCADE,
  target_org_id uuid NOT NULL REFERENCES public.buklod_scopes(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  permission_scope text[] NOT NULL DEFAULT ARRAY[
    'org_details',
    'clusters',
    'members',
    'ranks',
    'lesson_progress',
    'reading_progress',
    'devotion_progress',
    'cluster_reports',
    'leadership',
    'progress_summaries'
  ],
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buklod_org_access_distinct_chk
    CHECK (requesting_org_id <> target_org_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS buklod_org_access_open_uidx
  ON public.buklod_organization_access_grants (requesting_org_id, target_org_id)
  WHERE status IN ('PENDING', 'APPROVED');

CREATE INDEX IF NOT EXISTS buklod_org_access_target_idx
  ON public.buklod_organization_access_grants (target_org_id, status);

ALTER TABLE public.buklod_organization_access_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.buklod_organization_access_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.buklod_organization_access_grants TO authenticated, service_role;
GRANT ALL ON TABLE public.buklod_organization_access_grants TO service_role;

DROP POLICY IF EXISTS buklod_org_access_grants_read ON public.buklod_organization_access_grants;
CREATE POLICY buklod_org_access_grants_read
  ON public.buklod_organization_access_grants
  FOR SELECT TO authenticated
  USING (
    public.buklod_is_system_admin()
    OR requested_by = auth.uid()
    OR approved_by = auth.uid()
    OR public.buklod_is_organization_billing_manager(requesting_org_id, auth.uid())
    OR public.buklod_is_organization_billing_manager(target_org_id, auth.uid())
  );

-- ------------------------------------------------------------
-- 3. System Admin lifecycle audit (soft actions only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buklod_admin_lifecycle_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_kind text NOT NULL
    CHECK (target_kind IN ('ORGANIZATION', 'CLUSTER', 'USER', 'ROLE')),
  target_id uuid NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS buklod_admin_lifecycle_audit_created_idx
  ON public.buklod_admin_lifecycle_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS buklod_admin_lifecycle_audit_target_idx
  ON public.buklod_admin_lifecycle_audit (target_kind, target_id);

ALTER TABLE public.buklod_admin_lifecycle_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.buklod_admin_lifecycle_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.buklod_admin_lifecycle_audit TO authenticated, service_role;
GRANT ALL ON TABLE public.buklod_admin_lifecycle_audit TO service_role;

DROP POLICY IF EXISTS buklod_admin_lifecycle_audit_read ON public.buklod_admin_lifecycle_audit;
CREATE POLICY buklod_admin_lifecycle_audit_read
  ON public.buklod_admin_lifecycle_audit
  FOR SELECT TO authenticated
  USING (public.buklod_is_system_admin());

ALTER TABLE public.buklod_cluster_formation_approvals
  DROP CONSTRAINT IF EXISTS buklod_cluster_formation_approvals_item_kind_check;
ALTER TABLE public.buklod_cluster_formation_approvals
  ADD CONSTRAINT buklod_cluster_formation_approvals_item_kind_check
  CHECK (item_kind IN (
    'DAILY_READING', 'DEVOTION_WORD', 'LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING'
  ));

-- ------------------------------------------------------------
-- 4. Subscription helpers (monthly + annual)
-- ------------------------------------------------------------
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
    AND COALESCE(p.billing_kind, p.metadata->>'billing_kind') IN ('ANNUAL', 'MONTHLY')
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

  IF v_kind IN ('ANNUAL', 'MONTHLY') AND v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_org_has_focus_apps_v1(
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.buklod_scope_has_product_v1(p_organization_id, 'organization_focus_apps_annual')
      OR public.buklod_scope_has_product_v1(p_organization_id, 'organization_focus_apps_monthly');
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
  v_interval interval;
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

  v_interval := CASE
    WHEN v_kind = 'MONTHLY' THEN interval '1 month'
    ELSE interval '1 year'
  END;

  v_start := now();
  IF v_existing.id IS NOT NULL AND v_existing.expires_at IS NOT NULL AND v_existing.expires_at > now() THEN
    v_start := v_existing.expires_at;
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.buklod_scope_product_entitlements
    SET status = 'ACTIVE',
        expires_at = v_start + v_interval,
        paid_by = COALESCE(p_paid_by, paid_by),
        payment_id = COALESCE(p_payment_id, payment_id),
        updated_at = now()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.buklod_scope_product_entitlements (
      scope_id, product_code, status, activated_at, expires_at, paid_by, payment_id
    )
    VALUES (
      p_scope_id, p_product_code, 'ACTIVE', now(), now() + v_interval,
      p_paid_by, p_payment_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_scope_lifecycle_status(p_scope_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_meta text;
BEGIN
  SELECT
    upper(COALESCE(s.status::text, 'ACTIVE')),
    upper(COALESCE(s.metadata->>'lifecycle_status', ''))
  INTO v_status, v_meta
  FROM public.buklod_scopes s
  WHERE s.id = p_scope_id;

  IF v_meta IN ('SUSPENDED', 'DELETED', 'ARCHIVED') THEN
    RETURN v_meta;
  END IF;

  IF v_status IN ('SUSPENDED', 'DELETED', 'ARCHIVED', 'INACTIVE') THEN
    RETURN v_status;
  END IF;

  RETURN 'ACTIVE';
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_scope_is_active_lifecycle(p_scope_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.buklod_scope_lifecycle_status(p_scope_id) = 'ACTIVE';
$$;

-- ------------------------------------------------------------
-- 5. Cluster membership / formation context
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_user_has_active_cluster(
  p_user_id uuid DEFAULT auth.uid(),
  p_organization_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.buklod_scope_memberships m
    JOIN public.buklod_scopes s
      ON s.id = m.scope_id
     AND s.scope_type = 'CLUSTER'
    WHERE m.user_id = p_user_id
      AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
      AND public.buklod_scope_is_active_lifecycle(s.id)
      AND (
        p_organization_id IS NULL
        OR COALESCE(s.organization_id, s.parent_scope_id) = p_organization_id
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_require_active_cluster_membership(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cluster uuid;
BEGIN
  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    SELECT s.id
      INTO v_cluster
    FROM public.buklod_scope_memberships m
    JOIN public.buklod_scopes s ON s.id = m.scope_id AND s.scope_type = 'CLUSTER'
    WHERE m.user_id = p_user_id
      AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
    ORDER BY m.joined_at DESC NULLS LAST
    LIMIT 1;
    RETURN v_cluster;
  END IF;

  SELECT s.id
    INTO v_cluster
  FROM public.buklod_scope_memberships m
  JOIN public.buklod_scopes s ON s.id = m.scope_id AND s.scope_type = 'CLUSTER'
  WHERE m.user_id = p_user_id
    AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
    AND public.buklod_scope_is_active_lifecycle(s.id)
  ORDER BY m.joined_at DESC NULLS LAST
  LIMIT 1;

  IF v_cluster IS NULL THEN
    RAISE EXCEPTION 'Join a Cluster before using Daily Bible Reading, Daily Devotion, or BUKLOD Lessons. Organization membership alone is not enough.';
  END IF;

  RETURN v_cluster;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_user_formation_context_v1(
  p_organization_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid := p_organization_id;
  v_primary jsonb;
  v_clusters jsonb;
  v_pending jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_org IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.buklod_scopes
      WHERE id = v_org AND scope_type = 'ORGANIZATION'
    ) THEN
      RAISE EXCEPTION 'Organization not found';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    INTO v_clusters
  FROM (
    SELECT
      s.id AS cluster_id,
      s.name AS cluster_name,
      COALESCE(s.organization_id, s.parent_scope_id) AS organization_id,
      o.name AS organization_name,
      COALESCE(m.membership_status::text, '') AS membership_status,
      public.buklod_scope_lifecycle_status(s.id) AS cluster_status,
      COALESCE((
        SELECT array_agg(upper(ra.role_key))
        FROM public.buklod_scope_role_assignments ra
        WHERE ra.scope_id = s.id
          AND ra.user_id = v_user
          AND ra.status = 'ACTIVE'
      ), ARRAY[]::text[]) AS role_keys,
      public.buklod_user_has_scope_roles(
        s.id,
        v_user,
        ARRAY['CLUSTER_ADMIN', 'CLUSTER_HEAD', 'ADMIN']
      ) AS is_admin,
      m.joined_at
    FROM public.buklod_scope_memberships m
    JOIN public.buklod_scopes s
      ON s.id = m.scope_id
     AND s.scope_type = 'CLUSTER'
    LEFT JOIN public.buklod_scopes o
      ON o.id = COALESCE(s.organization_id, s.parent_scope_id)
    WHERE m.user_id = v_user
      AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
      AND (v_org IS NULL OR COALESCE(s.organization_id, s.parent_scope_id) = v_org)
    ORDER BY m.joined_at DESC NULLS LAST
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    INTO v_pending
  FROM (
    SELECT
      s.id AS cluster_id,
      s.name AS cluster_name,
      COALESCE(m.membership_status::text, '') AS membership_status
    FROM public.buklod_scope_memberships m
    JOIN public.buklod_scopes s
      ON s.id = m.scope_id
     AND s.scope_type = 'CLUSTER'
    WHERE m.user_id = v_user
      AND COALESCE(m.membership_status::text, '') IN ('PENDING', 'INVITED')
      AND (v_org IS NULL OR COALESCE(s.organization_id, s.parent_scope_id) = v_org)
    ORDER BY m.joined_at DESC NULLS LAST
  ) x;

  IF jsonb_array_length(v_clusters) > 0 THEN
    v_primary := v_clusters->0;
  ELSE
    v_primary := NULL;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org,
    'has_active_cluster', jsonb_array_length(v_clusters) > 0
      AND COALESCE(v_primary->>'cluster_status', 'ACTIVE') = 'ACTIVE',
    'primary_cluster', v_primary,
    'clusters', v_clusters,
    'pending_clusters', v_pending,
    'join_path', '/clusters'
  );
END;
$$;

-- Formation write gate: do not record official progress outside a Cluster.
CREATE OR REPLACE FUNCTION public.buklod_formation_requires_cluster_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_json jsonb := to_jsonb(NEW);
BEGIN
  v_user := COALESCE(
    NULLIF(v_json->>'user_id', '')::uuid,
    NULLIF(v_json->>'submitted_by', '')::uuid,
    NULLIF(v_json->>'member_id', '')::uuid,
    v_user
  );

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.buklod_is_system_admin() THEN
    RETURN NEW;
  END IF;

  PERFORM public.buklod_require_active_cluster_membership(v_user);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'daily_bible_submissions',
    'learning_lesson_responses',
    'learning_progress'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS buklod_formation_requires_cluster_trg ON public.%I',
        t
      );
      EXECUTE format(
        'CREATE TRIGGER buklod_formation_requires_cluster_trg
           BEFORE INSERT ON public.%I
           FOR EACH ROW
           EXECUTE PROCEDURE public.buklod_formation_requires_cluster_trg()',
        t
      );
    END IF;
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 6. Product access snapshot includes monthly + annual
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
        'organization_focus_apps_monthly',
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
            AND v_row.billing_kind IN ('ANNUAL', 'MONTHLY')
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
  v_code text;
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
  v_gated := v_app IN (
    'faculty', 'business', 'government', 'family', 'health', 'market',
    'local', 'palengke', 'commercial', 'report', 'connect'
  );

  SELECT
    lower(COALESCE(s.metadata->>'is_mzb', 'false')) IN ('true', '1', 'yes', 'on')
    OR lower(COALESCE(s.metadata->>'organization_code', '')) = 'mzb'
    OR lower(COALESCE(s.slug, '')) = 'mzb-ministry-inc'
  INTO v_mzb
  FROM public.buklod_scopes s
  WHERE s.id = p_organization_id;

  SELECT e.status, e.activated_at, e.expires_at, e.product_code
    INTO v_status, v_activated, v_expires, v_code
  FROM public.buklod_scope_product_entitlements e
  WHERE e.scope_id = p_organization_id
    AND e.product_code IN (
      'organization_focus_apps_annual',
      'organization_focus_apps_monthly'
    )
    AND e.status IN ('ACTIVE', 'EXPIRED')
  ORDER BY
    CASE WHEN e.status = 'ACTIVE' AND (e.expires_at IS NULL OR e.expires_at >= now()) THEN 0 ELSE 1 END,
    e.expires_at DESC NULLS LAST
  LIMIT 1;

  IF v_status IS NULL THEN
    v_status := 'NOT_PURCHASED';
  END IF;

  SELECT id INTO v_pending
  FROM public.buklod_scope_product_payments
  WHERE scope_id = p_organization_id
    AND product_code IN (
      'organization_focus_apps_annual',
      'organization_focus_apps_monthly'
    )
    AND status = 'pending_admin'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pending IS NOT NULL AND v_status = 'NOT_PURCHASED' THEN
    v_status := 'PENDING';
  END IF;

  v_active := public.buklod_org_has_focus_apps_v1(p_organization_id);

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
    'active_product_code', v_code,
    'monthly_amount_php', 59,
    'annual_amount_php', 499,
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
    'report', 'BUKLOD Report',
    'connect', 'BUKLOD Connect'
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
    'annual_amount_php', 499,
    'monthly_amount_php', 59,
    'currency', 'PHP',
    'gcash_number', '09811646218',
    'billing_interval', 'MONTHLY_OR_YEARLY',
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

-- ------------------------------------------------------------
-- 7. Faith access overlay: Cluster membership required
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
  v_user uuid := auth.uid();
  v_scope public.buklod_scopes%ROWTYPE;
  v_cluster uuid;
  v_cluster_name text;
  v_cluster_role text;
  v_org uuid;
  v_org_name text;
  v_has_cluster boolean := false;
  v_premium boolean := false;
  v_ccp boolean := false;
  v_disc boolean := false;
  v_ment boolean := false;
  v_pending_premium uuid;
  v_pending_ccp uuid;
  v_pending_disc uuid;
  v_pending_ment uuid;
  v_mzb boolean := false;
  v_join text := 'NONE';
BEGIN
  SELECT * INTO v_scope FROM public.buklod_scopes WHERE id = p_scope_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scope not found';
  END IF;

  v_org := CASE
    WHEN v_scope.scope_type = 'ORGANIZATION' THEN v_scope.id
    ELSE COALESCE(v_scope.organization_id, public.buklod_resolve_cluster_organization_id(v_scope.id))
  END;

  SELECT name INTO v_org_name FROM public.buklod_scopes WHERE id = v_org;

  v_mzb := (
    lower(COALESCE(v_scope.metadata->>'is_mzb', 'false')) IN ('true', '1', 'yes', 'on')
    OR lower(COALESCE(v_scope.metadata->>'organization_code', '')) = 'mzb'
    OR lower(COALESCE(v_scope.slug, '')) = 'mzb-ministry-inc'
  );

  IF v_scope.scope_type = 'CLUSTER'
     AND public.buklod_user_is_active_scope_member(v_scope.id, v_user)
     AND public.buklod_scope_is_active_lifecycle(v_scope.id) THEN
    v_cluster := v_scope.id;
  ELSE
    SELECT s.id
      INTO v_cluster
    FROM public.buklod_scope_memberships m
    JOIN public.buklod_scopes s
      ON s.id = m.scope_id
     AND s.scope_type = 'CLUSTER'
    WHERE m.user_id = v_user
      AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
      AND public.buklod_scope_is_active_lifecycle(s.id)
      AND (v_org IS NULL OR COALESCE(s.organization_id, s.parent_scope_id) = v_org)
    ORDER BY m.joined_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_cluster IS NOT NULL THEN
    v_has_cluster := true;
    SELECT name INTO v_cluster_name FROM public.buklod_scopes WHERE id = v_cluster;
    SELECT upper(ra.role_key)
      INTO v_cluster_role
    FROM public.buklod_scope_role_assignments ra
    WHERE ra.scope_id = v_cluster
      AND ra.user_id = v_user
      AND ra.status = 'ACTIVE'
    ORDER BY CASE upper(ra.role_key)
      WHEN 'CLUSTER_HEAD' THEN 1
      WHEN 'CLUSTER_ADMIN' THEN 2
      WHEN 'PASTOR' THEN 3
      WHEN 'MENTOR' THEN 4
      ELSE 9
    END
    LIMIT 1;
    v_join := 'ACTIVE';

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
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.buklod_scope_memberships m
      JOIN public.buklod_scopes s ON s.id = m.scope_id AND s.scope_type = 'CLUSTER'
      WHERE m.user_id = v_user
        AND COALESCE(m.membership_status::text, '') IN ('PENDING', 'INVITED')
        AND (v_org IS NULL OR COALESCE(s.organization_id, s.parent_scope_id) = v_org)
    ) THEN
      v_join := 'PENDING';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'scope_id', p_scope_id,
    'gcash_number', '09811646218',
    'is_mzb_scope_exempt', v_mzb,
    'is_mzb_user_exempt', v_mzb,
    'has_active_cluster', v_has_cluster,
    'cluster_id', v_cluster,
    'cluster_name', v_cluster_name,
    'cluster_role', v_cluster_role,
    'organization_id', v_org,
    'organization_name', v_org_name,
    'join_status', v_join,
    'daily_reading', jsonb_build_object(
      'price_php', 49,
      'unlocked', v_has_cluster AND v_premium,
      'pending_request_id', v_pending_premium
    ),
    'devotion_word', jsonb_build_object(
      'price_php', 49,
      'unlocked', v_has_cluster AND v_premium,
      'pending_request_id', v_pending_premium
    ),
    'lesson_stages', jsonb_build_array(
      jsonb_build_object('stage_code', 101, 'title', 'CCP 101', 'price_php', 49, 'scope_unlocked', v_has_cluster AND v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 102, 'title', 'CCP 102', 'price_php', 49, 'scope_unlocked', v_has_cluster AND v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 103, 'title', 'CCP 103', 'price_php', 49, 'scope_unlocked', v_has_cluster AND v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 104, 'title', 'Discipleship 104', 'price_php', 59, 'scope_unlocked', v_has_cluster AND v_disc, 'pending_request_id', v_pending_disc),
      jsonb_build_object('stage_code', 105, 'title', 'Discipleship 105', 'price_php', 59, 'scope_unlocked', v_has_cluster AND v_disc, 'pending_request_id', v_pending_disc),
      jsonb_build_object('stage_code', 106, 'title', 'Mentoring 106', 'price_php', 69, 'scope_unlocked', v_has_cluster AND v_ment, 'pending_request_id', v_pending_ment),
      jsonb_build_object('stage_code', 107, 'title', 'Mentoring 107', 'price_php', 69, 'scope_unlocked', v_has_cluster AND v_ment, 'pending_request_id', v_pending_ment)
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 8. Cross-organization access
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_is_organization_admin_v1(
  p_org_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_org_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  RETURN public.buklod_is_organization_billing_manager(p_org_id, p_user_id)
      OR public.buklod_user_has_scope_roles(
        p_org_id, p_user_id, ARRAY['ORG_ADMIN', 'ADMIN', 'ORGANIZATION_ADMIN']
      );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_has_org_access_grant_v1(
  p_target_org_id uuid,
  p_permission text DEFAULT 'org_details',
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perm text := lower(COALESCE(NULLIF(btrim(p_permission), ''), 'org_details'));
BEGIN
  IF p_target_org_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  IF public.buklod_is_organization_admin_v1(p_target_org_id, p_user_id) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.buklod_organization_access_grants g
    WHERE g.target_org_id = p_target_org_id
      AND g.status = 'APPROVED'
      AND v_perm = ANY (g.permission_scope)
      AND public.buklod_is_organization_admin_v1(g.requesting_org_id, p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_request_org_access_v1(
  p_requesting_org_id uuid,
  p_target_org_id uuid,
  p_permission_scope text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_scope text[] := COALESCE(
    NULLIF(p_permission_scope, ARRAY[]::text[]),
    ARRAY[
      'org_details','clusters','members','ranks','lesson_progress',
      'reading_progress','devotion_progress','cluster_reports',
      'leadership','progress_summaries'
    ]
  );
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_requesting_org_id IS NULL OR p_target_org_id IS NULL THEN
    RAISE EXCEPTION 'Both Organizations are required';
  END IF;
  IF p_requesting_org_id = p_target_org_id THEN
    RAISE EXCEPTION 'An Organization cannot request access to itself';
  END IF;
  IF NOT public.buklod_is_organization_admin_v1(p_requesting_org_id, v_user) THEN
    RAISE EXCEPTION 'Only an Organization Admin can request access';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_scopes
    WHERE id = p_target_org_id AND scope_type = 'ORGANIZATION'
  ) THEN
    RAISE EXCEPTION 'Target Organization not found';
  END IF;

  INSERT INTO public.buklod_organization_access_grants (
    requesting_org_id, target_org_id, requested_by, permission_scope, status
  )
  VALUES (p_requesting_org_id, p_target_org_id, v_user, v_scope, 'PENDING')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'grant_id', v_id, 'status', 'PENDING');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'An open access request already exists for these Organizations';
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_review_org_access_v1(
  p_grant_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.buklod_organization_access_grants%ROWTYPE;
  v_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_row
  FROM public.buklod_organization_access_grants
  WHERE id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found';
  END IF;
  IF v_row.status IS DISTINCT FROM 'PENDING' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;
  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_admin_v1(v_row.target_org_id, v_user)
  ) THEN
    RAISE EXCEPTION 'Only the target Organization Admin can review this request';
  END IF;

  v_status := CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END;

  UPDATE public.buklod_organization_access_grants
  SET status = v_status,
      approved_by = v_user,
      approved_at = CASE WHEN p_approve THEN now() ELSE NULL END,
      reviewed_at = now(),
      reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      updated_at = now()
  WHERE id = p_grant_id;

  INSERT INTO public.buklod_admin_lifecycle_audit (
    actor_id, action, target_kind, target_id, reason, metadata
  )
  VALUES (
    v_user,
    CASE WHEN p_approve THEN 'APPROVE_ORG_ACCESS' ELSE 'REJECT_ORG_ACCESS' END,
    'ORGANIZATION',
    v_row.target_org_id,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    jsonb_build_object(
      'grant_id', p_grant_id,
      'requesting_org_id', v_row.requesting_org_id
    )
  );

  RETURN jsonb_build_object('ok', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_revoke_org_access_v1(
  p_grant_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.buklod_organization_access_grants%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_row
  FROM public.buklod_organization_access_grants
  WHERE id = p_grant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access grant not found';
  END IF;
  IF v_row.status IS DISTINCT FROM 'APPROVED' THEN
    RAISE EXCEPTION 'Only an approved grant can be revoked';
  END IF;
  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_admin_v1(v_row.target_org_id, v_user)
    OR public.buklod_is_organization_admin_v1(v_row.requesting_org_id, v_user)
  ) THEN
    RAISE EXCEPTION 'Not authorized to revoke this grant';
  END IF;

  UPDATE public.buklod_organization_access_grants
  SET status = 'REVOKED',
      revoked_at = now(),
      reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      updated_at = now()
  WHERE id = p_grant_id;

  INSERT INTO public.buklod_admin_lifecycle_audit (
    actor_id, action, target_kind, target_id, reason, metadata
  )
  VALUES (
    v_user, 'REVOKE_ORG_ACCESS', 'ORGANIZATION', v_row.target_org_id,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    jsonb_build_object('grant_id', p_grant_id, 'requesting_org_id', v_row.requesting_org_id)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'REVOKED');
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_list_org_access_v1(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_admin_v1(p_organization_id, v_user)
  ) THEN
    RAISE EXCEPTION 'Organization Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'outgoing', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT g.*, rs.name AS requesting_org_name, ts.name AS target_org_name
        FROM public.buklod_organization_access_grants g
        JOIN public.buklod_scopes rs ON rs.id = g.requesting_org_id
        JOIN public.buklod_scopes ts ON ts.id = g.target_org_id
        WHERE g.requesting_org_id = p_organization_id
        ORDER BY g.requested_at DESC
      ) x
    ), '[]'::jsonb),
    'incoming', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT g.*, rs.name AS requesting_org_name, ts.name AS target_org_name
        FROM public.buklod_organization_access_grants g
        JOIN public.buklod_scopes rs ON rs.id = g.requesting_org_id
        JOIN public.buklod_scopes ts ON ts.id = g.target_org_id
        WHERE g.target_org_id = p_organization_id
        ORDER BY g.requested_at DESC
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 9. Cluster / Organization progress
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_can_view_cluster_progress_v1(
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
  v_org uuid;
BEGIN
  IF p_cluster_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF public.buklod_is_system_admin() AND p_user_id = auth.uid() THEN
    RETURN true;
  END IF;
  IF public.buklod_is_cluster_approver(p_cluster_id, p_user_id) THEN
    RETURN true;
  END IF;
  v_org := public.buklod_resolve_cluster_organization_id(p_cluster_id);
  IF v_org IS NOT NULL AND public.buklod_is_organization_admin_v1(v_org, p_user_id) THEN
    RETURN true;
  END IF;
  IF v_org IS NOT NULL AND public.buklod_has_org_access_grant_v1(v_org, 'cluster_reports', p_user_id) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_cluster_general_progress_v1(
  p_cluster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cluster public.buklod_scopes%ROWTYPE;
  v_members jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO v_cluster FROM public.buklod_scopes WHERE id = p_cluster_id AND scope_type = 'CLUSTER';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cluster not found';
  END IF;
  IF NOT public.buklod_can_view_cluster_progress_v1(p_cluster_id, v_user) THEN
    RAISE EXCEPTION 'Cluster progress is limited to Cluster leadership and the parent Organization Admin';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    INTO v_members
  FROM (
    SELECT
      m.user_id,
      COALESCE(pr.full_name, 'Member') AS member_name,
      COALESCE((
        SELECT array_agg(upper(ra.role_key))
        FROM public.buklod_scope_role_assignments ra
        WHERE ra.scope_id = p_cluster_id
          AND ra.user_id = m.user_id
          AND ra.status = 'ACTIVE'
      ), ARRAY[]::text[]) AS role_keys,
      COALESCE(m.membership_status::text, '') AS membership_status,
      m.joined_at,
      COALESCE((
        SELECT count(*)
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id
          AND a.learner_id = m.user_id
          AND a.status = 'PENDING'
      ), 0) AS pending_approvals,
      COALESCE((
        SELECT count(*)
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id
          AND a.learner_id = m.user_id
          AND a.status = 'APPROVED'
      ), 0) AS approved_items,
      COALESCE((
        SELECT count(*)
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id
          AND a.learner_id = m.user_id
          AND a.item_kind = 'DAILY_READING'
          AND a.status = 'APPROVED'
      ), 0) AS reading_approved,
      COALESCE((
        SELECT count(*)
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id
          AND a.learner_id = m.user_id
          AND a.item_kind = 'DEVOTION_WORD'
          AND a.status = 'APPROVED'
      ), 0) AS devotion_approved,
      COALESCE((
        SELECT max(a.item_id)
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id
          AND a.learner_id = m.user_id
          AND a.item_kind IN ('LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING')
          AND a.status = 'APPROVED'
      ), NULL) AS latest_lesson_item,
      (
        SELECT max(a.updated_at)
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id AND a.learner_id = m.user_id
      ) AS latest_activity
    FROM public.buklod_scope_memberships m
    LEFT JOIN public.profiles pr ON pr.id = m.user_id
    WHERE m.scope_id = p_cluster_id
      AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
    ORDER BY COALESCE(pr.full_name, 'Member')
  ) x;

  RETURN jsonb_build_object(
    'cluster_id', p_cluster_id,
    'cluster_name', v_cluster.name,
    'organization_id', COALESCE(v_cluster.organization_id, v_cluster.parent_scope_id),
    'member_count', jsonb_array_length(v_members),
    'members', v_members
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_cluster_member_progress_v1(
  p_cluster_id uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.buklod_can_view_cluster_progress_v1(p_cluster_id, v_user) THEN
    RAISE EXCEPTION 'Cluster member progress is limited to assigned Cluster leadership';
  END IF;
  IF NOT public.buklod_user_is_active_scope_member(p_cluster_id, p_member_id) THEN
    RAISE EXCEPTION 'This person is not an active member of this Cluster';
  END IF;

  RETURN jsonb_build_object(
    'cluster_id', p_cluster_id,
    'member_id', p_member_id,
    'member_name', COALESCE((SELECT full_name FROM public.profiles WHERE id = p_member_id), 'Member'),
    'history', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT a.id, a.item_kind, a.item_id, a.status, a.remarks, a.created_at, a.decided_at, a.approver_id
        FROM public.buklod_cluster_formation_approvals a
        WHERE a.cluster_id = p_cluster_id AND a.learner_id = p_member_id
        ORDER BY a.created_at DESC
        LIMIT 200
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_organization_clusters_oversight_v1(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org public.buklod_scopes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO v_org FROM public.buklod_scopes
  WHERE id = p_organization_id AND scope_type = 'ORGANIZATION';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  IF NOT (
    public.buklod_is_system_admin()
    OR public.buklod_is_organization_admin_v1(p_organization_id, v_user)
    OR public.buklod_has_org_access_grant_v1(p_organization_id, 'clusters', v_user)
  ) THEN
    RAISE EXCEPTION 'Organization Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'organization_name', v_org.name,
    'lifecycle_status', public.buklod_scope_lifecycle_status(p_organization_id),
    'clusters', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT
          s.id AS cluster_id,
          s.name AS cluster_name,
          public.buklod_scope_lifecycle_status(s.id) AS cluster_status,
          (
            SELECT count(*) FROM public.buklod_scope_memberships m
            WHERE m.scope_id = s.id AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
          ) AS member_count,
          (
            SELECT jsonb_agg(jsonb_build_object(
              'user_id', ra.user_id,
              'role_key', upper(ra.role_key),
              'full_name', COALESCE(pr.full_name, 'Member')
            ))
            FROM public.buklod_scope_role_assignments ra
            LEFT JOIN public.profiles pr ON pr.id = ra.user_id
            WHERE ra.scope_id = s.id
              AND ra.status = 'ACTIVE'
              AND upper(ra.role_key) IN ('CLUSTER_ADMIN','CLUSTER_HEAD','ADMIN','PASTOR','MENTOR')
          ) AS leadership,
          public.buklod_scope_has_product_v1(s.id, 'cluster_premium') AS cluster_premium,
          (
            SELECT count(*) FROM public.buklod_cluster_formation_approvals a
            WHERE a.cluster_id = s.id AND a.status = 'PENDING'
          ) AS pending_approvals
        FROM public.buklod_scopes s
        WHERE s.scope_type = 'CLUSTER'
          AND COALESCE(s.organization_id, s.parent_scope_id) = p_organization_id
        ORDER BY s.name
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

-- ------------------------------------------------------------
-- 10. System Admin control center + lifecycle
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buklod_admin_lifecycle_action_v1(
  p_action text,
  p_target_kind text,
  p_target_id uuid,
  p_reason text DEFAULT NULL,
  p_role_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_action text := upper(COALESCE(NULLIF(btrim(p_action), ''), ''));
  v_kind text := upper(COALESCE(NULLIF(btrim(p_target_kind), ''), ''));
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_lifecycle text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin access required';
  END IF;
  IF v_reason IS NULL AND v_action IN (
    'SUSPEND_ORG','SUSPEND_CLUSTER','SUSPEND_USER','DELETE_ORG','DELETE_CLUSTER','REMOVE_ROLE'
  ) THEN
    RAISE EXCEPTION 'A reason is required for this action';
  END IF;

  IF v_action IN ('SUSPEND_ORG', 'REACTIVATE_ORG', 'DELETE_ORG') THEN
    IF NOT EXISTS (SELECT 1 FROM public.buklod_scopes WHERE id = p_target_id AND scope_type = 'ORGANIZATION') THEN
      RAISE EXCEPTION 'Organization not found';
    END IF;
    v_lifecycle := CASE v_action
      WHEN 'SUSPEND_ORG' THEN 'SUSPENDED'
      WHEN 'DELETE_ORG' THEN 'DELETED'
      ELSE 'ACTIVE'
    END;
    UPDATE public.buklod_scopes
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('lifecycle_status', v_lifecycle)
    WHERE id = p_target_id;
  ELSIF v_action IN ('SUSPEND_CLUSTER', 'REACTIVATE_CLUSTER', 'DELETE_CLUSTER') THEN
    IF NOT EXISTS (SELECT 1 FROM public.buklod_scopes WHERE id = p_target_id AND scope_type = 'CLUSTER') THEN
      RAISE EXCEPTION 'Cluster not found';
    END IF;
    v_lifecycle := CASE v_action
      WHEN 'SUSPEND_CLUSTER' THEN 'SUSPENDED'
      WHEN 'DELETE_CLUSTER' THEN 'DELETED'
      ELSE 'ACTIVE'
    END;
    UPDATE public.buklod_scopes
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('lifecycle_status', v_lifecycle)
    WHERE id = p_target_id;
  ELSIF v_action IN ('SUSPEND_USER', 'REACTIVATE_USER') THEN
    UPDATE public.buklod_scope_memberships
    SET membership_status = CASE WHEN v_action = 'SUSPEND_USER' THEN 'SUSPENDED' ELSE 'ACTIVE' END
    WHERE user_id = p_target_id
      AND COALESCE(membership_status::text, '') IN ('ACTIVE', 'SUSPENDED');
  ELSIF v_action = 'REMOVE_ROLE' THEN
    IF COALESCE(NULLIF(btrim(p_role_key), ''), '') = '' THEN
      RAISE EXCEPTION 'Role key is required';
    END IF;
    UPDATE public.buklod_scope_role_assignments
    SET status = 'REVOKED',
        revoked_at = now()
    WHERE scope_id = p_target_id
      AND upper(role_key) = upper(p_role_key)
      AND status = 'ACTIVE';
  ELSE
    RAISE EXCEPTION 'Unsupported administrative action';
  END IF;

  INSERT INTO public.buklod_admin_lifecycle_audit (
    actor_id, action, target_kind, target_id, reason, metadata
  )
  VALUES (
    v_user, v_action, v_kind, p_target_id, v_reason,
    jsonb_build_object('role_key', p_role_key, 'lifecycle_status', v_lifecycle)
  );

  RETURN jsonb_build_object('ok', true, 'action', v_action, 'target_id', p_target_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.buklod_system_admin_org_cluster_center_v1(
  p_organization_id uuid DEFAULT NULL,
  p_cluster_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 80
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 80), 200));
BEGIN
  IF NOT public.buklod_is_system_admin() THEN
    RAISE EXCEPTION 'System Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'organizations', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT
          s.id,
          s.name,
          COALESCE(s.metadata->>'organization_type', s.scope_type) AS organization_type,
          public.buklod_scope_lifecycle_status(s.id) AS lifecycle_status,
          public.buklod_org_has_focus_apps_v1(s.id) AS focus_apps_active,
          (
            SELECT count(*) FROM public.buklod_scopes c
            WHERE c.scope_type = 'CLUSTER'
              AND COALESCE(c.organization_id, c.parent_scope_id) = s.id
          ) AS cluster_count,
          (
            SELECT count(*) FROM public.buklod_scope_memberships m
            WHERE m.scope_id = s.id AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
          ) AS member_count,
          s.created_at
        FROM public.buklod_scopes s
        WHERE s.scope_type = 'ORGANIZATION'
          AND (p_organization_id IS NULL OR s.id = p_organization_id)
        ORDER BY s.created_at DESC
        LIMIT v_limit
      ) x
    ), '[]'::jsonb),
    'clusters', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT
          s.id,
          s.name,
          COALESCE(s.organization_id, s.parent_scope_id) AS organization_id,
          o.name AS organization_name,
          public.buklod_scope_lifecycle_status(s.id) AS lifecycle_status,
          public.buklod_scope_has_product_v1(s.id, 'cluster_premium') AS cluster_premium,
          (
            SELECT count(*) FROM public.buklod_scope_memberships m
            WHERE m.scope_id = s.id AND COALESCE(m.membership_status::text, '') = 'ACTIVE'
          ) AS member_count,
          s.created_at
        FROM public.buklod_scopes s
        LEFT JOIN public.buklod_scopes o ON o.id = COALESCE(s.organization_id, s.parent_scope_id)
        WHERE s.scope_type = 'CLUSTER'
          AND (p_cluster_id IS NULL OR s.id = p_cluster_id)
          AND (p_organization_id IS NULL OR COALESCE(s.organization_id, s.parent_scope_id) = p_organization_id)
        ORDER BY s.created_at DESC
        LIMIT v_limit
      ) x
    ), '[]'::jsonb),
    'leadership', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT
          ra.user_id,
          COALESCE(pr.full_name, 'Member') AS full_name,
          upper(ra.role_key) AS role_key,
          ra.scope_id,
          s.name AS scope_name,
          s.scope_type,
          COALESCE(s.organization_id, s.parent_scope_id) AS organization_id
        FROM public.buklod_scope_role_assignments ra
        JOIN public.buklod_scopes s ON s.id = ra.scope_id
        LEFT JOIN public.profiles pr ON pr.id = ra.user_id
        WHERE ra.status = 'ACTIVE'
          AND upper(ra.role_key) IN (
            'CLUSTER_ADMIN','CLUSTER_HEAD','ADMIN','PASTOR','MENTOR','ORG_ADMIN','ORGANIZATION_ADMIN'
          )
          AND (p_organization_id IS NULL OR s.id = p_organization_id OR COALESCE(s.organization_id, s.parent_scope_id) = p_organization_id)
          AND (p_cluster_id IS NULL OR ra.scope_id = p_cluster_id)
        ORDER BY s.name, upper(ra.role_key)
        LIMIT v_limit
      ) x
    ), '[]'::jsonb),
    'access_grants', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT g.*, rs.name AS requesting_org_name, ts.name AS target_org_name
        FROM public.buklod_organization_access_grants g
        JOIN public.buklod_scopes rs ON rs.id = g.requesting_org_id
        JOIN public.buklod_scopes ts ON ts.id = g.target_org_id
        ORDER BY g.requested_at DESC
        LIMIT v_limit
      ) x
    ), '[]'::jsonb),
    'recent_audit', COALESCE((
      SELECT jsonb_agg(row_to_json(x))
      FROM (
        SELECT a.*, COALESCE(pr.full_name, 'System Admin') AS actor_name
        FROM public.buklod_admin_lifecycle_audit a
        LEFT JOIN public.profiles pr ON pr.id = a.actor_id
        ORDER BY a.created_at DESC
        LIMIT 40
      ) x
    ), '[]'::jsonb)
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

  IF v_kind NOT IN ('DAILY_READING', 'DEVOTION_WORD', 'LESSON', 'CCP', 'DISCIPLESHIP', 'MENTORING') THEN
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

  IF NOT public.buklod_scope_is_active_lifecycle(p_cluster_id) THEN
    RAISE EXCEPTION 'This Cluster is not active';
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

-- ------------------------------------------------------------
-- 11. Grants
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
        'buklod_expire_annual_entitlements_v1',
        'buklod_scope_has_product_v1',
        'buklod_org_has_focus_apps_v1',
        'buklod_scope_lifecycle_status',
        'buklod_scope_is_active_lifecycle',
        'buklod_user_has_active_cluster',
        'buklod_require_active_cluster_membership',
        'buklod_user_formation_context_v1',
        'buklod_scope_product_access_v1',
        'buklod_can_use_organization_focus_app_v1',
        'buklod_focus_app_access_status_v1',
        'buklod_scope_faith_access_status_v1',
        'buklod_is_organization_admin_v1',
        'buklod_has_org_access_grant_v1',
        'buklod_request_org_access_v1',
        'buklod_review_org_access_v1',
        'buklod_revoke_org_access_v1',
        'buklod_list_org_access_v1',
        'buklod_can_view_cluster_progress_v1',
        'buklod_cluster_general_progress_v1',
        'buklod_cluster_member_progress_v1',
        'buklod_organization_clusters_oversight_v1',
        'buklod_admin_lifecycle_action_v1',
        'buklod_system_admin_org_cluster_center_v1',
        'buklod_approve_cluster_formation_item_v1'
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

REVOKE ALL ON FUNCTION public.buklod_formation_requires_cluster_trg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_formation_requires_cluster_trg() TO service_role;

