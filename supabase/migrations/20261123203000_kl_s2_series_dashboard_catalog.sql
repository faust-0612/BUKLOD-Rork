-- SEASON 2 DEV ONLY. Additive series-level metadata; does NOT publish any episode.
-- Existing chapter approval/release, public reader RPC and S1 runtime remain authoritative.
-- Apply only to an isolated, independently verified staging database after prerequisite KL migrations.
CREATE TABLE IF NOT EXISTS private.kl_s2_series_metadata (
  season_number integer PRIMARY KEY CHECK (season_number BETWEEN 1 AND 12),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 600),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.kl_s2_series_metadata ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.kl_s2_series_metadata FROM PUBLIC, anon, authenticated;

-- Admin can write a series name/description before drafting chapter one.
-- It is never exposed to readers until a chapter has passed the existing release gates.
CREATE OR REPLACE FUNCTION public.kl_s2_admin_save_series_v1(
  p_season_number integer, p_title text, p_description text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_description text := btrim(coalesce(p_description,''));
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_user
      AND p.is_active IS TRUE AND p.role::text='system_admin'
  ) THEN
    RAISE EXCEPTION 'System admin required' USING ERRCODE='42501';
  END IF;
  IF p_season_number NOT BETWEEN 1 AND 12
     OR char_length(v_title) NOT BETWEEN 3 AND 120
     OR char_length(v_description) > 600 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_series_metadata');
  END IF;
  INSERT INTO private.kl_s2_series_metadata(season_number,title,description,updated_by)
    VALUES(p_season_number,v_title,v_description,v_user)
  ON CONFLICT (season_number) DO UPDATE SET
    title=EXCLUDED.title, description=EXCLUDED.description,
    updated_by=EXCLUDED.updated_by, updated_at=now();
  RETURN jsonb_build_object('ok',true,'season_number',p_season_number);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_admin_save_series_v1(integer,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_admin_save_series_v1(integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.kl_s2_admin_series_catalog_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
      AND p.is_active IS TRUE AND p.role::text='system_admin'
  ) THEN RAISE EXCEPTION 'System admin required' USING ERRCODE='42501'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'season_number', s.season_number,
    'title', coalesce(m.title,CASE WHEN s.season_number=1
      THEN 'Ang Lupang Hindi Namamatay' ELSE 'Serye '||s.season_number::text END),
    'description', coalesce(m.description,''),
    'total_chapters', s.total_chapters,
    'approved_chapters', s.approved_chapters,
    'released_chapters', s.released_chapters
  ) ORDER BY s.season_number),'[]'::jsonb) INTO v_result
  FROM (
    SELECT n.season_number,
      count(e.id) FILTER(WHERE e.episode_number BETWEEN 1 AND 30) AS total_chapters,
      count(e.id) FILTER(WHERE e.episode_number BETWEEN 1 AND 30
        AND e.status='approved' AND e.approved_at IS NOT NULL) AS approved_chapters,
      count(e.id) FILTER(WHERE e.episode_number BETWEEN 1 AND 30
        AND e.status='approved' AND e.approved_at IS NOT NULL
        AND e.release_at<=now()) AS released_chapters
    FROM (
      SELECT season_number FROM private.kl_s2_series_metadata
      UNION SELECT DISTINCT season_number FROM public.kl_episodes
        WHERE season_number BETWEEN 1 AND 12
    ) n LEFT JOIN public.kl_episodes e ON e.season_number=n.season_number
    GROUP BY n.season_number
  ) s
  LEFT JOIN private.kl_s2_series_metadata m ON m.season_number=s.season_number;
  RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_admin_series_catalog_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_admin_series_catalog_v1() TO authenticated;

-- Public listing only includes already released chapters. Never return a private
-- manuscript, image path, future release date, draft title or unreleased series.
-- This RPC is presentation metadata only: it cannot grant reading/quiz access.
CREATE OR REPLACE FUNCTION public.kl_s2_reader_series_catalog_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'season_number', x.season_number, 'title', x.title,
    'description', x.description, 'available_chapters', x.available_chapters,
    'has_panimula', x.has_panimula
  ) ORDER BY x.season_number),'[]'::jsonb) INTO v_result
  FROM (
    SELECT e.season_number,
      coalesce(m.title,CASE WHEN e.season_number=1
        THEN 'Ang Lupang Hindi Namamatay' ELSE 'Serye '||e.season_number::text END) AS title,
      coalesce(m.description,'') AS description,
      count(*) FILTER (WHERE e.episode_number BETWEEN 1 AND 30) AS available_chapters,
      bool_or(e.episode_number=0) AS has_panimula
    FROM public.kl_episodes e
    LEFT JOIN private.kl_s2_series_metadata m ON m.season_number=e.season_number
    WHERE e.season_number BETWEEN 1 AND 12 AND e.episode_number BETWEEN 0 AND 30
      AND e.status='approved' AND e.approved_at IS NOT NULL
      AND e.release_at IS NOT NULL AND e.release_at<=now()
    GROUP BY e.season_number,m.title,m.description
  ) x;
  RETURN v_result;
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_reader_series_catalog_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kl_s2_reader_series_catalog_v1() TO anon, authenticated;
