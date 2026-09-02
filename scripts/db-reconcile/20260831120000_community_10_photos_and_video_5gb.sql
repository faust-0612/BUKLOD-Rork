-- Community Wall: 10 photos (media_position 0-9) + 5 GiB video storage ceiling.
-- Additive / backward-safe. Apply in the Supabase SQL Editor, or:
--   npx supabase db query -f scripts/db-reconcile/20260831120000_community_10_photos_and_video_5gb.sql
--
-- Inspect the obsolete check (expect BETWEEN 0 AND 4, 1 AND 5, or similar):
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'community_post_media_media_position_check';

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

-- 1. Drop every CHECK that still caps media_position below 0-9.
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.community_post_media') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'community_post_media'
      AND c.contype = 'c'
      AND (
        c.conname ILIKE '%media_position%'
        OR pg_get_constraintdef(c.oid) ILIKE '%media_position%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.community_post_media DROP CONSTRAINT IF EXISTS %I',
      r.conname
    );
  END LOOP;
END
$$;

-- NOT VALID skips legacy rows that may already sit above 9 (earlier 20-photo
-- experiments). New inserts and updates must be 0-based positions 0-9.
ALTER TABLE public.community_post_media
  ADD CONSTRAINT community_post_media_media_position_check
  CHECK (media_position >= 0 AND media_position <= 9) NOT VALID;

-- 2. Relax leftover product file-size CHECKs on community_posts.
DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.community_posts') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'community_posts'
      AND c.contype = 'c'
      AND (
        c.conname ILIKE '%media_size%'
        OR pg_get_constraintdef(c.oid) ILIKE '%media_size_bytes%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS %I',
      r.conname
    );
  END LOOP;

  ALTER TABLE public.community_posts
    ADD CONSTRAINT community_posts_media_size_check
    CHECK (
      media_size_bytes IS NULL
      OR (
        media_size_bytes >= 0
        AND media_size_bytes <= 5368709120
      )
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

-- 3. Raise the community-media bucket ceiling to 5 GiB when Storage allows it.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;

  UPDATE storage.buckets
  SET file_size_limit = 5368709120
  WHERE id = 'community-media'
     OR name = 'community-media';

  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('community-media', 'community-media', false, 5368709120)
  ON CONFLICT (id) DO UPDATE
    SET file_size_limit = 5368709120;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not update storage.buckets.file_size_limit; set 5 GiB in Dashboard → Storage.';
END
$$;

-- 4. Patch live RPC source: 5-photo / 1 GiB / 100 MB leftovers → 10 photos / 5 GiB.
DO $$
DECLARE
  r record;
  def text;
  patched text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_buklod_post_media_v1',
        'set_buklod_post_media_v2',
        'set_buklod_post_media_v3',
        'get_buklod_post_media_v1',
        'create_buklod_community_post_v1',
        'create_buklod_community_post_v2',
        'create_buklod_community_post_v3',
        'buklod_scope_social_create_post_v1',
        'create_buklod_reel_v1'
      )
  LOOP
    def := pg_get_functiondef(r.oid);
    patched := def;
    patched := replace(patched, 'v_count > 20', 'v_count > 10');
    patched := replace(patched, 'v_count > 5', 'v_count > 10');
    patched := replace(patched, 'up to 20 photos', 'up to 10 photos');
    patched := replace(patched, 'up to 5 photos', 'up to 10 photos');
    patched := replace(patched, 'maximum of 5 photos', 'maximum of 10 photos');
    patched := replace(patched, 'Maximum of 5 photos', 'Maximum of 10 photos');
    patched := replace(patched, '1073741824', '5368709120');
    patched := replace(patched, '104857600', '5368709120');
    patched := replace(patched, 'Maximum video size is 1 GB', 'Maximum video size is 5 GB');
    patched := replace(patched, 'maximum video size is 1 GB', 'maximum video size is 5 GB');
    patched := regexp_replace(patched, 'LIMIT 5', 'LIMIT 10', 'gi');
    patched := replace(patched, 'media_position <= 4', 'media_position <= 9');
    patched := replace(patched, 'media_position < 5', 'media_position <= 9');
    patched := replace(patched, 'BETWEEN 0 AND 4', 'BETWEEN 0 AND 9');
    patched := replace(patched, 'BETWEEN 1 AND 5', 'BETWEEN 0 AND 9');

    IF patched IS DISTINCT FROM def THEN
      EXECUTE patched;
    END IF;
  END LOOP;
END
$$;

-- 5. Canonical atomic media setter: DELETE + INSERT 0-based positions in one transaction.
CREATE OR REPLACE FUNCTION public.set_buklod_post_media_v4(
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

  IF v_count > 10 THEN
    RAISE EXCEPTION 'You can add up to 10 photos per post.';
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

GRANT EXECUTE ON FUNCTION public.set_buklod_post_media_v4(uuid, jsonb)
  TO authenticated;

-- Keep v3 aligned with the same 10-photo / 0-based contract.
CREATE OR REPLACE FUNCTION public.set_buklod_post_media_v3(
  p_post_id uuid,
  p_media jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_buklod_post_media_v4(p_post_id, p_media);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_buklod_post_media_v3(uuid, jsonb)
  TO authenticated;

-- 6. Media reader: every position, no leftover 5-row cap.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_buklod_post_media_v1'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.get_buklod_post_media_v1(
  p_post_ids uuid[]
)
RETURNS TABLE (
  post_id uuid,
  media_position integer,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_post_ids IS NULL OR cardinality(p_post_ids) = 0 THEN
    RETURN;
  END IF;

  IF to_regclass('public.community_post_media') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.post_id,
    m.media_position,
    m.media_path,
    m.media_mime_type,
    m.media_size_bytes
  FROM public.community_post_media m
  WHERE m.post_id = ANY (p_post_ids)
  ORDER BY m.post_id, m.media_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_buklod_post_media_v1(uuid[])
  TO authenticated;

COMMIT;
