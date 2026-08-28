-- Additive content reporting for posts and comments.
-- System Admin reviews via list_buklod_content_reports_v1 + resolve_content_report.
-- Does not delete historical rows; hide is is_hidden only.

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

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  resolution text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS reporter_id uuid,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_entity_idx
  ON public.content_reports (entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS content_reports_open_unique_idx
  ON public.content_reports (reporter_id, entity_type, entity_id)
  WHERE status IN ('open', 'pending', 'new');

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_reports_insert_own ON public.content_reports;
CREATE POLICY content_reports_insert_own
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS content_reports_select_own_or_admin ON public.content_reports;
CREATE POLICY content_reports_select_own_or_admin
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.buklod_actor_is_system_admin_v1()
  );

GRANT SELECT, INSERT ON public.content_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_hide_reported_entity_v1(
  p_entity_type text,
  p_entity_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  BEGIN
    v_id := p_entity_id::uuid;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  IF lower(coalesce(p_entity_type, '')) IN ('post', 'bulletin') THEN
    IF to_regclass('public.community_posts') IS NOT NULL THEN
      UPDATE public.community_posts
      SET is_hidden = true
      WHERE id = v_id;
    END IF;
    IF to_regclass('public.mission_bulletins') IS NOT NULL THEN
      BEGIN
        UPDATE public.mission_bulletins
        SET is_hidden = true
        WHERE id = v_id;
      EXCEPTION WHEN undefined_column THEN
        NULL;
      END;
    END IF;
  ELSIF lower(coalesce(p_entity_type, '')) = 'comment' THEN
    IF to_regclass('public.comments') IS NOT NULL THEN
      UPDATE public.comments
      SET is_hidden = true
      WHERE id = v_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_content_report(
  p_entity_type text,
  p_entity_id text,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_type text := lower(btrim(coalesce(p_entity_type, 'post')));
  v_reason text := lower(btrim(coalesce(p_reason, 'other')));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to report this.';
  END IF;

  IF btrim(coalesce(p_entity_id, '')) = '' THEN
    RAISE EXCEPTION 'This item can no longer be reported.';
  END IF;

  IF v_type NOT IN ('post', 'comment', 'prayer', 'bulletin') THEN
    v_type := 'post';
  END IF;

  IF v_reason NOT IN (
    'spam',
    'harassment',
    'privacy',
    'misinformation',
    'inappropriate',
    'other'
  ) THEN
    v_reason := 'other';
  END IF;

  UPDATE public.content_reports
  SET
    reason = v_reason,
    details = NULLIF(btrim(coalesce(p_details, '')), ''),
    created_at = now()
  WHERE reporter_id = v_user
    AND entity_type = v_type
    AND entity_id::text = btrim(p_entity_id)
    AND status IN ('open', 'pending', 'new')
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.content_reports (
    reporter_id,
    entity_type,
    entity_id,
    reason,
    details,
    status
  )
  VALUES (
    v_user,
    v_type,
    btrim(p_entity_id),
    v_reason,
    NULLIF(btrim(coalesce(p_details, '')), ''),
    'open'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_content_report(
  p_report_id uuid,
  p_hide_content boolean,
  p_resolution text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.content_reports%ROWTYPE;
BEGIN
  IF NOT public.buklod_actor_is_system_admin_v1() THEN
    RAISE EXCEPTION 'Only a System Admin can resolve reports.';
  END IF;

  SELECT *
  INTO v_row
  FROM public.content_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;

  IF coalesce(p_hide_content, false) THEN
    PERFORM public.buklod_hide_reported_entity_v1(
      v_row.entity_type,
      v_row.entity_id
    );
  END IF;

  UPDATE public.content_reports
  SET
    status = 'actioned',
    resolution = NULLIF(btrim(coalesce(p_resolution, '')), ''),
    resolved_by = auth.uid(),
    resolved_at = now()
  WHERE id = p_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_buklod_content_reports_v1()
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  reason text,
  details text,
  status text,
  resolution text,
  created_at timestamptz,
  reporter_name text,
  snippet text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.buklod_actor_is_system_admin_v1() THEN
    RAISE EXCEPTION 'Only a System Admin can review reports.';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.entity_type,
    r.entity_id,
    r.reason,
    r.details,
    r.status,
    r.resolution,
    r.created_at,
    coalesce(
      NULLIF(btrim(p.full_name), ''),
      'Member'
    ) AS reporter_name,
    CASE
      WHEN r.entity_type = 'comment' AND to_regclass('public.comments') IS NOT NULL THEN (
        SELECT left(btrim(c.body), 180)
        FROM public.comments c
        WHERE c.id::text = r.entity_id
        LIMIT 1
      )
      WHEN to_regclass('public.community_posts') IS NOT NULL THEN (
        SELECT left(btrim(cp.body), 180)
        FROM public.community_posts cp
        WHERE cp.id::text = r.entity_id
        LIMIT 1
      )
      ELSE NULL
    END AS snippet
  FROM public.content_reports r
  LEFT JOIN public.profiles p
    ON p.id = r.reporter_id
  ORDER BY
    CASE
      WHEN r.status IN ('open', 'pending', 'new') THEN 0
      ELSE 1
    END,
    r.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.buklod_hide_reported_entity_v1(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_content_report(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_content_report(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_buklod_content_reports_v1() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_content_report(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_content_report(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_buklod_content_reports_v1() TO authenticated;
