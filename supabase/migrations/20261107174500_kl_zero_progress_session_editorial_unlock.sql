-- KL editorial guard: opening the reader is not verified reading.
-- A read request creates a session even when the reader never sends a ping.
-- Preserve session rows and all rewards, comments and achievements.
-- This relaxes only the false-positive "opened without progress" case.
-- Consequential content/media edits still take the chapter back to draft,
-- and approved/rewarded/engaged chapters remain protected.
CREATE OR REPLACE FUNCTION public.kl_admin_unlock_unread_release_v1(p_episode_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_episode public.kl_episodes%rowtype;
  v_zero_progress_sessions integer;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor AND p.role::text = 'system_admin' AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Story admin access denied';
  END IF;

  SELECT * INTO v_episode FROM public.kl_episodes
  WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chapter not found'; END IF;
  IF v_episode.release_at IS NULL THEN RETURN false; END IF;

  -- kl_read_episode_v1 creates a session on opening a chapter.
  -- Only an engagement ping or a completion proves reading activity.
  IF EXISTS (
      SELECT 1 FROM public.kl_reading_sessions s
      WHERE s.episode_id = p_episode_id
        AND (coalesce(s.ping_count, 0) > 0 OR s.completed_at IS NOT NULL)
    )
    OR EXISTS (SELECT 1 FROM public.kl_story_achievements WHERE episode_id = p_episode_id)
    OR EXISTS (SELECT 1 FROM public.kl_episode_comments WHERE episode_id = p_episode_id)
    OR EXISTS (
      SELECT 1 FROM public.buklod_points_ledger
      WHERE source_id = p_episode_id
        AND (activity_type LIKE 'kl_%' OR source_key LIKE 'kl:%')
    )
  THEN
    RAISE EXCEPTION 'Released chapter protected: verified reader activity or rewards exist';
  END IF;

  SELECT count(*) INTO v_zero_progress_sessions
  FROM public.kl_reading_sessions s
  WHERE s.episode_id = p_episode_id
    AND coalesce(s.ping_count, 0) = 0 AND s.completed_at IS NULL;

  UPDATE public.kl_episodes
    SET status = 'draft', release_at = NULL, approved_at = NULL,
        approved_by = NULL, preview_prepared_at = NULL, reviewed_at = now()
    WHERE id = p_episode_id;

  INSERT INTO public.kl_admin_audit(episode_id,actor_id,action,notes)
  VALUES (
    p_episode_id, v_actor, 'reopen_unread',
    'Editorial reopen: verified progress/rewards/comments absent; opening-only sessions retained='
    || v_zero_progress_sessions::text || '; previous release_at=' || v_episode.release_at::text
  );
  RETURN true;
END;
$function$;
