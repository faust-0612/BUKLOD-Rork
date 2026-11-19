-- KL manuscript-only private previews. Scene illustrations are optional (0–12).
-- Preserve the current admin gate, editorial unlock, individual media approval,
-- existing chapters, attached media and release eligibility checks.
-- NO production migration is executed merely by committing this file.
CREATE OR REPLACE FUNCTION public.kl_admin_prepare_preview_v1(p_episode_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.kl_episodes%rowtype;
  v_total integer;
  v_valid integer;
  v_unique integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'system_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v FROM public.kl_episodes
    WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND OR v.manuscript IS NULL OR length(btrim(v.manuscript)) < 30 THEN
    RAISE EXCEPTION 'Complete and save an editable manuscript first';
  END IF;

  -- Zero uploaded illustrations is valid. For any uploaded illustration, its
  -- saved passage must be unique and occur exactly once in the manuscript.
  -- Checking all uploaded rows prevents an unfinished scene from being silently
  -- omitted from the preview or approved release.
  SELECT count(*),
         count(*) FILTER (
           WHERE m.paragraph_anchor IS NOT NULL
             AND length(btrim(m.paragraph_anchor)) >= 12
             AND (length(v.manuscript)
                 - length(replace(v.manuscript, m.paragraph_anchor, '')))
                  = length(m.paragraph_anchor)
         ),
         count(DISTINCT m.paragraph_anchor)
    INTO v_total, v_valid, v_unique
    FROM public.kl_episode_media m
    WHERE m.episode_id = p_episode_id
      AND m.media_kind = 'illustration';

  IF v_total > 12 OR v_valid <> v_total OR v_unique <> v_total THEN
    RAISE EXCEPTION 'Uploaded illustrations need distinct valid manuscript placements (maximum 12); remove unfinished photos or finish their placements';
  END IF;

  IF v.preview_prepared_at IS NOT NULL THEN
    RETURN jsonb_build_object('ready', true, 'changed', false,
      'preview_version', v.preview_version,
      'location', 'Community Wall KL Admin card');
  END IF;

  -- Preserve the live RPC's released-chapter engagement/reward guard.
  PERFORM public.kl_admin_unlock_unread_release_v1(p_episode_id);

  UPDATE public.kl_episodes
    SET preview_version = preview_version + 1,
        preview_prepared_at = now()
    WHERE id = p_episode_id;

  RETURN jsonb_build_object('ready', true, 'changed', true,
    'preview_version', v.preview_version + 1,
    'location', 'Community Wall KL Admin card');
END;
$function$;

-- Do not modify EXECUTE ACLs; the existing authenticated caller gate remains.
