-- Season 2 DEV only: 3/3 auto-verified reading quiz + a genuine, active
-- top-level post-quiz comment before the NEXT chapter can be opened.
-- Depends on 20261119150000, 20261119221000, 20261119221500.
-- NO Season 2 activation, grants to private objects, or production changes.
--
-- Quiz grading remains server-side kl_quiz_submit_v1; no admin answer approval.
-- A comment cannot bypass quiz completion, and a verified quiz cannot bypass
-- the mandatory comment. Existing chapter read, media, quiz, session and
-- old-client RPCs all call kl_s2_previous_chapter_complete_v1.

CREATE OR REPLACE FUNCTION private.kl_s2_verified_comment_v1(
  p_user uuid, p_episode_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.kl_episodes episode
    JOIN public.kl_reading_sessions session
      ON session.episode_id=episode.id AND session.user_id=p_user
      AND session.completed_at IS NOT NULL
    JOIN public.kl_quiz_sets bank
      ON bank.episode_id=episode.id AND bank.manuscript_hash=md5(episode.manuscript)
      AND bank.status='ready'
    JOIN public.kl_quiz_attempts attempt
      ON attempt.episode_id=episode.id AND attempt.user_id=p_user
      AND attempt.manuscript_hash=bank.manuscript_hash
      AND attempt.verified_at IS NOT NULL
    JOIN public.kl_episode_comments comment
      ON comment.episode_id=episode.id AND comment.author_id=p_user
      AND comment.parent_id IS NULL AND comment.deleted_at IS NULL
      AND comment.created_at>=attempt.verified_at
      AND char_length(btrim(comment.body)) BETWEEN 20 AND 500
      AND btrim(comment.body) ~ '[[:alnum:]]'
    WHERE episode.id=p_episode_id
      AND episode.status='approved' AND episode.approved_at IS NOT NULL
      AND episode.release_at IS NOT NULL AND episode.release_at<=now()
  );
$fn$;
REVOKE ALL ON FUNCTION private.kl_s2_verified_comment_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;

-- Applies to both legacy readers and brand-new series. Requiring each
-- preceding chapter individually prevents missing-chapter and old-session
-- bypass. Cross-series gating covers the next series' panimula too.
CREATE OR REPLACE FUNCTION private.kl_s2_previous_chapter_complete_v1(
  p_user uuid,p_episode_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT p_user IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.kl_episodes chapter
   WHERE chapter.id=p_episode_id AND chapter.season_number BETWEEN 1 AND 12
     AND chapter.episode_number BETWEEN 0 AND 30
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.generate_series(1,chapter.episode_number-1) required(n)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.kl_episodes previous
         WHERE previous.season_number=chapter.season_number
           AND previous.episode_number=required.n
           AND private.kl_s2_verified_comment_v1(p_user,previous.id)
       )
     )
     AND (chapter.season_number=1 OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.generate_series(1,30) previous_required(n)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.kl_episodes previous_series
         WHERE previous_series.season_number=chapter.season_number-1
           AND previous_series.episode_number=previous_required.n
           AND private.kl_s2_verified_comment_v1(p_user,previous_series.id)
       )
     ))
 );
$fn$;
REVOKE ALL ON FUNCTION private.kl_s2_previous_chapter_complete_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;

-- One call per series returns both quiz-completed chapters and true unlock
-- progress. Quiz completion no longer unlocks the next chapter alone.
CREATE OR REPLACE FUNCTION public.kl_s2_reader_progress_v1(p_season_number integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_user uuid:=auth.uid();
  v_quiz_passed integer[];
  v_commented integer[];
  v_next integer;
  v_awaiting_comment integer;
  v_series_unlocked boolean:=true;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_season_number NOT BETWEEN 1 AND 12 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_series');
  END IF;
  SELECT coalesce(array_agg(n ORDER BY n),'{}'::integer[])
    INTO v_quiz_passed
  FROM pg_catalog.generate_series(1,30) n
  WHERE EXISTS (
    SELECT 1 FROM public.kl_episodes e
    JOIN public.kl_reading_sessions s
      ON s.episode_id=e.id AND s.user_id=v_user AND s.completed_at IS NOT NULL
    JOIN public.kl_quiz_attempts a
      ON a.episode_id=e.id AND a.user_id=v_user
      AND a.verified_at IS NOT NULL AND a.manuscript_hash=md5(e.manuscript)
    JOIN public.kl_quiz_sets q
      ON q.episode_id=e.id AND q.manuscript_hash=a.manuscript_hash
      AND q.status='ready'
    WHERE e.season_number=p_season_number AND e.episode_number=n
      AND e.status='approved' AND e.approved_at IS NOT NULL
      AND e.release_at IS NOT NULL AND e.release_at<=now()
  );
  SELECT coalesce(array_agg(n ORDER BY n),'{}'::integer[])
    INTO v_commented
  FROM pg_catalog.generate_series(1,30) n
  WHERE EXISTS (
    SELECT 1 FROM public.kl_episodes e
    WHERE e.season_number=p_season_number AND e.episode_number=n
      AND private.kl_s2_verified_comment_v1(v_user,e.id)
  );
  IF p_season_number>1 THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM pg_catalog.generate_series(1,30) prev(n)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.kl_episodes e
        WHERE e.season_number=p_season_number-1
          AND e.episode_number=prev.n
          AND private.kl_s2_verified_comment_v1(v_user,e.id)
      )
    ) INTO v_series_unlocked;
  END IF;
  IF v_series_unlocked THEN
    SELECT min(n) INTO v_next FROM pg_catalog.generate_series(1,30) n
      WHERE NOT (n=ANY(v_commented));
  ELSE
    v_next:=0; -- all chapters AND panimula remain locked across series
  END IF;
  IF v_next IS NOT NULL AND v_next=ANY(v_quiz_passed) THEN
    v_awaiting_comment:=v_next;
  END IF;
  RETURN jsonb_build_object(
    'ok',true,'enabled',private.kl_s2_rewards_enabled_v1(),
    'completed_numbers',to_jsonb(v_quiz_passed),
    'commented_numbers',to_jsonb(v_commented),
    'next_chapter_number',coalesce(v_next,31),
    'series_unlocked',v_series_unlocked,
    'awaiting_comment_number',v_awaiting_comment,
    'comment_minimum_characters',20
  );
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_reader_progress_v1(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_reader_progress_v1(integer) TO authenticated;

-- The existing +5 BP reward trigger extracted user_id from the comment row,
-- but real public.kl_episode_comments uses author_id. Fix this without paying
-- non-qualifying / deleted / reply / pre-quiz comments or double-crediting.
CREATE OR REPLACE FUNCTION private.kl_s2_comment_reward_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_uid uuid:=NEW.author_id;
  v_episode uuid:=NEW.episode_id;
BEGIN
  IF NOT private.kl_s2_rewards_enabled_v1() THEN RETURN NEW; END IF;
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM auth.uid()
    OR NEW.parent_id IS NOT NULL OR NEW.deleted_at IS NOT NULL
    OR char_length(btrim(NEW.body)) NOT BETWEEN 20 AND 500
    OR btrim(NEW.body) !~ '[[:alnum:]]'
  THEN RETURN NEW; END IF;
  -- An AFTER INSERT trigger cannot rely on a STABLE helper to see the
  -- just-inserted row in its caller's statement snapshot. Inspect NEW directly
  -- and verify the ALREADY-COMMITTED quiz/session instead.
  IF NOT EXISTS (
    SELECT 1 FROM public.kl_episodes e
    JOIN public.kl_reading_sessions s
      ON s.episode_id=e.id AND s.user_id=v_uid AND s.completed_at IS NOT NULL
    JOIN public.kl_quiz_sets q ON q.episode_id=e.id
      AND q.manuscript_hash=md5(e.manuscript) AND q.status='ready'
    JOIN public.kl_quiz_attempts a ON a.episode_id=e.id AND a.user_id=v_uid
      AND a.manuscript_hash=q.manuscript_hash AND a.verified_at IS NOT NULL
      AND NEW.created_at>=a.verified_at
    WHERE e.id=v_episode AND e.status='approved'
      AND e.approved_at IS NOT NULL AND e.release_at<=now()
  ) THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_uid AND p.is_active=true
  ) THEN RETURN NEW; END IF;
  PERFORM public.buklod_award_verification_points_v1(
    v_uid,5,'kl_comment_reflection',
    'kl:comment:s2:'||v_uid::text||':'||v_episode::text,
    NEW.id,'KL verified post-quiz chapter reflection +5 BP',null
  );
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.kl_s2_comment_reward_v1()
  FROM PUBLIC,anon,authenticated;

-- Continue to respect published status, rate limits, author identity,
-- reply ownership and the existing exact return payload. Block old clients
-- from posting in unreached chapters (they cannot read them either).
CREATE OR REPLACE FUNCTION public.kl_post_comment_v1(
  p_episode_id uuid,p_body text,p_parent_id uuid DEFAULT NULL::uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_user uuid:=auth.uid();
  v_id uuid;
  v_created timestamptz;
  v_body text:=btrim(coalesce(p_body,''));
  v_name text;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_user AND p.is_active=true
  ) THEN RAISE EXCEPTION 'Sign in with an active account to comment'; END IF;
  IF char_length(v_body) NOT BETWEEN 12 AND 500 OR v_body !~ '[[:alnum:]]' THEN
    RAISE EXCEPTION 'Comment must contain meaningful text (12–500 characters)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kl_episodes e WHERE e.id=p_episode_id
      AND e.status='approved' AND e.approved_at IS NOT NULL
      AND e.release_at IS NOT NULL AND e.release_at<=now()
  ) THEN RAISE EXCEPTION 'This chapter is not yet released'; END IF;
  IF private.kl_s2_rewards_enabled_v1() AND
      NOT private.kl_s2_previous_chapter_complete_v1(v_user,p_episode_id) THEN
    RAISE EXCEPTION 'previous_chapter_required';
  END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.kl_episode_comments c WHERE c.id=p_parent_id
      AND c.episode_id=p_episode_id AND c.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'Reply parent is unavailable for this chapter'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text||':kl-comment',0)
  );
  IF EXISTS (
    SELECT 1 FROM public.kl_episode_comments c
    WHERE c.author_id=v_user AND c.deleted_at IS NULL
      AND c.created_at>now()-interval '10 seconds'
  ) THEN RAISE EXCEPTION 'Please wait a few seconds before another comment'; END IF;
  SELECT coalesce(nullif(btrim(p.full_name),''),
      nullif(btrim(p.username),''),'Miyembro') INTO v_name
    FROM public.profiles p WHERE p.id=v_user;
  INSERT INTO public.kl_episode_comments(episode_id,author_id,parent_id,body)
    VALUES(p_episode_id,v_user,p_parent_id,v_body)
    RETURNING id,created_at INTO v_id,v_created;
  RETURN jsonb_build_object('ok',true,'comment',jsonb_build_object(
    'id',v_id,'body',v_body,'created_at',v_created,
    'display_name',coalesce(v_name,'Miyembro'),'is_self',true
  ));
END $fn$;
-- CREATE OR REPLACE preserves the pre-existing RPC privileges and signature.
-- Previously-installed trigger kl_s2_comment_reward_insert remains attached.


-- Readers who completed a chapter under Season 1 may have a completed_at
-- session but no quiz attempt. Under Season 2 they MUST be allowed to take
-- the 3/3 quiz; marking that old session "completed" cannot skip the quiz.
-- Once a valid quiz is verified, they can post a qualifying reflection.
CREATE OR REPLACE FUNCTION public.kl_quiz_begin_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_user uuid:=auth.uid();
  v_hash text;
  v_ids uuid[];
  v_items jsonb;
  v_attempt uuid;
  v_count int;
  v_s2 boolean:=private.kl_s2_rewards_enabled_v1();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT md5(manuscript) INTO v_hash
    FROM public.kl_episodes
    WHERE id=p_episode_id AND status='approved'
      AND approved_at IS NOT NULL AND release_at<=now();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'reason','chapter_unavailable');
  END IF;
  IF v_s2 AND NOT private.kl_s2_previous_chapter_complete_v1(v_user,p_episode_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','previous_chapter_required');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.kl_reading_sessions s
    WHERE s.episode_id=p_episode_id AND s.user_id=v_user
      AND s.completed_at IS NOT NULL
  ) AND (
    NOT v_s2 OR EXISTS (
      SELECT 1 FROM public.kl_quiz_attempts a
      WHERE a.episode_id=p_episode_id AND a.user_id=v_user
        AND a.manuscript_hash=v_hash AND a.verified_at IS NOT NULL
    )
  ) THEN
    RETURN jsonb_build_object('ok',true,'already_completed',true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kl_quiz_sets q
    WHERE q.episode_id=p_episode_id AND q.manuscript_hash=v_hash AND q.status='ready'
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','questions_preparing',
      'allow_legacy',NOT v_s2 AND NOT coalesce(
        (SELECT enforce_quiz FROM public.kl_quiz_rollout WHERE id=1),false));
  END IF;
  INSERT INTO public.kl_reading_sessions(user_id,episode_id)
    VALUES(v_user,p_episode_id)
    ON CONFLICT(user_id,episode_id) DO NOTHING;
  SELECT count(*) INTO v_count FROM public.kl_quiz_attempts
    WHERE user_id=v_user AND episode_id=p_episode_id
      AND started_at>now()-interval '10 minutes';
  IF v_count>=8 THEN RETURN jsonb_build_object('ok',false,'reason','retry_later'); END IF;
  SELECT array_agg(id),jsonb_agg(jsonb_build_object(
    'id',id,'question',question_text,'options',options))
    INTO v_ids,v_items FROM (
      SELECT id,question_text,options FROM public.kl_quiz_questions
      WHERE episode_id=p_episode_id ORDER BY random() LIMIT 3
    ) q;
  IF coalesce(array_length(v_ids,1),0)<>3 THEN
    RETURN jsonb_build_object('ok',false,'reason','questions_preparing');
  END IF;
  INSERT INTO public.kl_quiz_attempts(episode_id,user_id,manuscript_hash,question_ids)
    VALUES(p_episode_id,v_user,v_hash,v_ids) RETURNING id INTO v_attempt;
  RETURN jsonb_build_object('ok',true,'attempt_id',v_attempt,'questions',v_items);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_quiz_begin_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_quiz_begin_v1(uuid) TO authenticated;
