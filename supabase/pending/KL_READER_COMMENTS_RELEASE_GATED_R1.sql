-- KL comments/presence RC patch: reuse current production public tables, NOT the
-- unapplied legacy 20261022120000 private.kl_* migration (would duplicate state).
-- Keep RLS on public.kl_episode_comments; writes go through authenticated RPC.
-- Apply only after vetted RC is ready. Never release a client expecting v2 early.

CREATE OR REPLACE FUNCTION public.kl_post_comment_v1(
  p_episode_id uuid, p_body text, p_parent_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_created timestamptz;
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_user AND p.is_active = true
  ) THEN RAISE EXCEPTION 'Sign in with an active account to comment'; END IF;
  IF char_length(v_body) NOT BETWEEN 12 AND 500 OR v_body !~ '[[:alnum:]]' THEN
    RAISE EXCEPTION 'Comment must contain meaningful text (12–500 characters)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kl_episodes e WHERE e.id = p_episode_id
      AND e.status = 'approved' AND e.approved_at IS NOT NULL
      AND e.release_at IS NOT NULL AND e.release_at <= now()
  ) THEN RAISE EXCEPTION 'This chapter is not yet released'; END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kl_episode_comments c WHERE c.id = p_parent_id
      AND c.episode_id = p_episode_id AND c.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Reply parent is unavailable for this chapter'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':kl-comment', 0));
  IF EXISTS (
    SELECT 1 FROM public.kl_episode_comments c
    WHERE c.author_id = v_user AND c.deleted_at IS NULL
      AND c.created_at > now() - interval '10 seconds'
  ) THEN RAISE EXCEPTION 'Please wait a few seconds before another comment'; END IF;
  SELECT coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),'Miyembro')
    INTO v_name FROM public.profiles p WHERE p.id = v_user;
  INSERT INTO public.kl_episode_comments (episode_id, author_id, parent_id, body)
  VALUES (p_episode_id, v_user, p_parent_id, v_body)
  RETURNING id, created_at INTO v_id, v_created;
  RETURN jsonb_build_object('ok', true, 'comment', jsonb_build_object(
    'id',v_id,'body',v_body,'created_at',v_created,
    'display_name',coalesce(v_name,'Miyembro'),'is_self',true));
END;
$body$;
REVOKE ALL ON FUNCTION public.kl_post_comment_v1(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kl_post_comment_v1(uuid,text,uuid) TO authenticated;

-- Dedicated v2 reader endpoint avoids changing the return type/contract of
-- pre-existing public.kl_list_comments_v1(uuid) (TABLE rows).
CREATE OR REPLACE FUNCTION public.kl_reader_comments_v2(
  p_episode_id uuid, p_limit integer DEFAULT 40
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_user uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_user AND p.is_active=true
  ) THEN RETURN jsonb_build_object('ok',false,'comments','[]'::jsonb); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kl_episodes e WHERE e.id=p_episode_id
      AND e.status='approved' AND e.approved_at IS NOT NULL
      AND e.release_at IS NOT NULL AND e.release_at<=now()
  ) THEN RETURN jsonb_build_object('ok',false,'comments','[]'::jsonb); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'body',t.body,'created_at',t.created_at,
    'display_name',t.display_name,'is_self',t.author_id=v_user
  ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.id,c.body,c.created_at,c.author_id,
      coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),'Miyembro') AS display_name
    FROM public.kl_episode_comments c
    LEFT JOIN public.profiles p ON p.id=c.author_id
    WHERE c.episode_id=p_episode_id AND c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT least(greatest(coalesce(p_limit,40),1),40)
  ) t;
  RETURN jsonb_build_object('ok',true,'comments',v_rows);
END;
$body$;
REVOKE ALL ON FUNCTION public.kl_reader_comments_v2(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kl_reader_comments_v2(uuid,integer) TO authenticated;

-- Keep previously agreed visible reader list, derived from existing
-- reading sessions; no second presence table, idle background write, or user polling job.
CREATE OR REPLACE FUNCTION public.kl_list_readers_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  v_user uuid := auth.uid();
  v_rows jsonb;
  v_count integer;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_user AND p.is_active=true
  ) OR NOT EXISTS (
    SELECT 1 FROM public.kl_episodes e WHERE e.id=p_episode_id
      AND e.status='approved' AND e.approved_at IS NOT NULL
      AND e.release_at IS NOT NULL AND e.release_at<=now()
  ) THEN RETURN jsonb_build_object('ok',false,'count',0,'readers','[]'::jsonb); END IF;
  SELECT count(*)::integer INTO v_count
    FROM public.kl_reading_sessions s WHERE s.episode_id=p_episode_id
    AND s.last_ping_at >= now()-interval '2 minutes';
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id',r.user_id,'display_name',r.display_name,
    'last_seen_at',r.last_seen_at,'is_self',r.user_id=v_user
  ) ORDER BY r.last_seen_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT s.user_id,s.last_ping_at AS last_seen_at,
      coalesce(nullif(btrim(p.full_name),''),nullif(btrim(p.username),''),'Miyembro') AS display_name
    FROM public.kl_reading_sessions s
    LEFT JOIN public.profiles p ON p.id=s.user_id
    WHERE s.episode_id=p_episode_id AND s.last_ping_at>=now()-interval '2 minutes'
    ORDER BY s.last_ping_at DESC LIMIT 25
  ) r;
  RETURN jsonb_build_object('ok',true,'count',v_count,'readers',v_rows);
END;
$body$;
REVOKE ALL ON FUNCTION public.kl_list_readers_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kl_list_readers_v1(uuid) TO authenticated;
