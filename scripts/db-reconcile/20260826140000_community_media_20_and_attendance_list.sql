-- Raise community photo attach limit to 20 and list created attendance events.
-- Additive / backward-safe. Apply with:
--   npx.cmd supabase db query -f scripts/db-reconcile/20260826140000_community_media_20_and_attendance_list.sql
-- or copy into a new unused supabase/migrations timestamp if db push is required.

BEGIN;

CREATE TABLE IF NOT EXISTS public.community_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  media_position integer NOT NULL DEFAULT 0,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_post_media_post_idx
  ON public.community_post_media (post_id, media_position);

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
        'set_buklod_post_media_v3',
        'buklod_list_attendance_events_v1'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.set_buklod_post_media_v3(
  p_post_id uuid,
  p_media jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_first jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_post_id IS NULL THEN
    RAISE EXCEPTION 'Post is required';
  END IF;

  IF to_regclass('public.community_posts') IS NULL THEN
    RAISE EXCEPTION 'Community posts are unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.community_posts p
    WHERE p.id = p_post_id
      AND (
        (to_jsonb(p)->>'user_id') = v_uid::text
        OR (to_jsonb(p)->>'author_id') = v_uid::text
        OR (to_jsonb(p)->>'created_by') = v_uid::text
      )
  ) THEN
    RAISE EXCEPTION 'You can only edit your own post.';
  END IF;

  v_count := coalesce(jsonb_array_length(coalesce(p_media, '[]'::jsonb)), 0);

  IF v_count > 20 THEN
    RAISE EXCEPTION 'You can add up to 20 photos per post.';
  END IF;

  IF to_regclass('public.community_post_media') IS NOT NULL THEN
    DELETE FROM public.community_post_media
    WHERE post_id = p_post_id;

    INSERT INTO public.community_post_media (
      post_id,
      media_position,
      media_path,
      media_mime_type,
      media_size_bytes
    )
    SELECT
      p_post_id,
      ordinality - 1,
      nullif(item->>'media_path', ''),
      nullif(item->>'media_mime_type', ''),
      nullif(item->>'media_size_bytes', '')::bigint
    FROM jsonb_array_elements(coalesce(p_media, '[]'::jsonb))
      WITH ORDINALITY AS t(item, ordinality);
  END IF;

  v_first := coalesce(p_media, '[]'::jsonb)->0;

  UPDATE public.community_posts
  SET
    media_path = nullif(v_first->>'media_path', ''),
    media_mime_type = nullif(v_first->>'media_mime_type', ''),
    media_size_bytes = nullif(v_first->>'media_size_bytes', '')::bigint
  WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_buklod_post_media_v3(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_list_attendance_events_v1(
  p_scope_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_scope_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF to_regclass('public.attendance_events') IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF to_regclass('public.buklod_scope_memberships') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.buklod_scope_memberships m
      WHERE m.scope_id = p_scope_id
        AND m.user_id = v_uid
        AND coalesce(m.membership_status, 'ACTIVE') IN (
          'ACTIVE',
          'PENDING',
          'INVITED'
        )
    )
    INTO v_allowed;
  END IF;

  IF NOT v_allowed AND to_regclass('public.attendance_scope_operators') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.attendance_scope_operators o
      WHERE o.scope_id = p_scope_id
        AND o.user_id = v_uid
        AND coalesce(o.is_active, true) = true
    )
    INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    BEGIN
      v_allowed := public.buklod_actor_can_manage_scope_v1(p_scope_id);
    EXCEPTION WHEN undefined_function THEN
      v_allowed := false;
    END;
  END IF;

  IF NOT v_allowed THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT e.*
    FROM public.attendance_events e
    WHERE (
      (to_jsonb(e)->>'scope_id') = p_scope_id::text
      OR (to_jsonb(e)->>'organization_id') = p_scope_id::text
      OR (to_jsonb(e)->>'cluster_id') = p_scope_id::text
    )
    ORDER BY e.starts_at DESC NULLS LAST, e.created_at DESC NULLS LAST
    LIMIT 100
  ) x;

  RETURN coalesce(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buklod_list_attendance_events_v1(uuid)
  TO authenticated;

COMMIT;
