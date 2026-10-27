-- KL private media workflow: independent scene state and approvals.
-- Each RPC retains its existing signature and system-admin authorization gate.
CREATE OR REPLACE FUNCTION public.kl_admin_media_list_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Story admin access denied';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'kind', media_kind, 'placement', placement,
      'path', storage_path, 'approved', approved,
      'anchor', paragraph_anchor, 'side', placement_side,
      'effect', effect, 'intensity', effect_intensity
    ) ORDER BY media_kind, placement), '[]'::jsonb)
    FROM public.kl_episode_media WHERE episode_id = p_episode_id);
END;
$function$;

-- Repeated Save Manuscript must not invalidate a prepared preview. If the text
-- actually changes, invalidate only illustration approvals with broken anchors.
CREATE OR REPLACE FUNCTION public.kl_admin_save_content_v1(
  p_episode_id uuid, p_title text, p_manuscript text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_existing public.kl_episodes%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF length(btrim(coalesce(p_title, ''))) < 3 OR length(btrim(coalesce(p_manuscript, ''))) < 30 THEN
    RAISE EXCEPTION 'Title or manuscript too short';
  END IF;
  SELECT * INTO v_existing FROM public.kl_episodes
    WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter missing or already released'; END IF;
  IF v_existing.title IS NOT DISTINCT FROM left(btrim(p_title), 250)
      AND v_existing.manuscript IS NOT DISTINCT FROM p_manuscript THEN
    RETURN jsonb_build_object('ok', true, 'changed', false);
  END IF;
  UPDATE public.kl_episodes SET title = left(btrim(p_title), 250),
      manuscript = p_manuscript, status = 'draft', approved_at = NULL,
      approved_by = NULL, preview_prepared_at = NULL
    WHERE id = p_episode_id;
  UPDATE public.kl_episode_media SET approved = false
    WHERE episode_id = p_episode_id AND media_kind = 'illustration'
      AND (paragraph_anchor IS NULL OR
        (length(p_manuscript) - length(replace(p_manuscript, paragraph_anchor, '')))
        <> length(paragraph_anchor));
  RETURN jsonb_build_object('ok', true, 'changed', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.kl_admin_place_media_v1(
  p_episode_id uuid, p_kind text, p_placement integer, p_anchor text, p_side text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_manuscript text;
  v_current public.kl_episode_media%rowtype;
  v_anchor text := btrim(coalesce(p_anchor, ''));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT manuscript INTO v_manuscript FROM public.kl_episodes
    WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  IF p_kind <> 'illustration' OR p_placement NOT BETWEEN 1 AND 3
      OR p_side NOT IN ('before', 'after') OR length(v_anchor) < 12
      OR v_manuscript IS NULL
      OR (length(v_manuscript) - length(replace(v_manuscript, v_anchor, ''))) <> length(v_anchor) THEN
    RAISE EXCEPTION 'Use one exact, unique passage from the saved manuscript for this scene';
  END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = 'illustration' AND placement = p_placement
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Illustration not uploaded'; END IF;
  IF v_current.paragraph_anchor IS NOT DISTINCT FROM v_anchor
      AND v_current.placement_side IS NOT DISTINCT FROM p_side THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', v_current.approved);
  END IF;
  UPDATE public.kl_episode_media SET paragraph_anchor = v_anchor,
      placement_side = p_side, approved = false WHERE id = v_current.id;
  UPDATE public.kl_episodes SET preview_prepared_at = NULL,
      approved_at = NULL, approved_by = NULL, status = 'draft' WHERE id = p_episode_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.kl_admin_scene_effect_v1(
  p_episode_id uuid, p_placement integer, p_effect text, p_intensity integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_current public.kl_episode_media%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_effect NOT IN ('none','rain','fog','fireflies','embers','lightning')
      OR p_intensity NOT BETWEEN 0 AND 100 OR p_placement NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Invalid scene effect';
  END IF;
  PERFORM 1 FROM public.kl_episodes WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = 'illustration' AND placement = p_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Illustration not uploaded'; END IF;
  IF v_current.effect IS NOT DISTINCT FROM p_effect
      AND v_current.effect_intensity IS NOT DISTINCT FROM p_intensity THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', v_current.approved);
  END IF;
  UPDATE public.kl_episode_media SET effect = p_effect,
      effect_intensity = p_intensity, approved = false WHERE id = v_current.id;
  UPDATE public.kl_episodes SET preview_prepared_at = NULL,
      approved_at = NULL, approved_by = NULL, status = 'draft' WHERE id = p_episode_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.kl_admin_media_approve_v1(
  p_episode_id uuid, p_kind text, p_placement integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_manuscript text;
  v_current public.kl_episode_media%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Story admin access denied';
  END IF;
  SELECT manuscript INTO v_manuscript FROM public.kl_episodes
    WHERE id = p_episode_id AND release_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not editable'; END IF;
  SELECT * INTO v_current FROM public.kl_episode_media
    WHERE episode_id = p_episode_id AND media_kind = p_kind AND placement = p_placement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Media not found'; END IF;
  IF p_kind = 'illustration' AND (
      v_current.paragraph_anchor IS NULL OR length(btrim(v_current.paragraph_anchor)) < 12
      OR v_manuscript IS NULL
      OR (length(v_manuscript) - length(replace(v_manuscript, v_current.paragraph_anchor, '')))
          <> length(v_current.paragraph_anchor)) THEN
    RAISE EXCEPTION 'Save a valid, unique paragraph placement for this scene before approval';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects
      WHERE bucket_id = 'kl-publishing' AND name = v_current.storage_path) THEN
    RAISE EXCEPTION 'Private media file missing; re-upload before approval';
  END IF;
  IF v_current.approved THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'approved', true);
  END IF;
  UPDATE public.kl_episode_media SET approved = true WHERE id = v_current.id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'approved', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.kl_admin_preview_bundle_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v public.kl_episodes%rowtype; v_media jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO v FROM public.kl_episodes WHERE id = p_episode_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not found'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'kind', media_kind, 'placement', placement, 'path', storage_path,
      'anchor', paragraph_anchor, 'side', placement_side,
      'effect', effect, 'intensity', effect_intensity, 'approved', approved
    ) ORDER BY media_kind, placement), '[]'::jsonb) INTO v_media
    FROM public.kl_episode_media WHERE episode_id = p_episode_id;
  RETURN jsonb_build_object('title', v.title, 'manuscript', v.manuscript,
      'version', v.preview_version, 'media', v_media, 'status', v.status,
      'prepared', v.preview_prepared_at IS NOT NULL);
END;
$function$;
