-- DEV-only S2 extension, depends on 20261119150000. OFF until future owner activation.
-- Do not apply to production during Season 1. No client-based point authority.
CREATE TABLE IF NOT EXISTS private.kl_s2_series_reflections (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 season_number integer NOT NULL CHECK (season_number BETWEEN 1 AND 100),
 reflection_text text NOT NULL CHECK(char_length(btrim(reflection_text)) BETWEEN 50 AND 2000),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,season_number)
);
ALTER TABLE private.kl_s2_series_reflections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.kl_s2_series_reflections FROM PUBLIC,anon,authenticated;

-- One request per reader view; no 30-RPC waterfall. Still enforce access in the database.
CREATE OR REPLACE FUNCTION public.kl_s2_reader_progress_v1(p_season_number integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_completed integer[]; v_next integer;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_season_number NOT BETWEEN 1 AND 100 THEN
  RETURN jsonb_build_object('ok',false,'reason','invalid_series'); END IF;
 SELECT coalesce(array_agg(DISTINCT e.episode_number ORDER BY e.episode_number),'{}'::integer[])
 INTO v_completed FROM public.kl_reading_sessions s
 JOIN public.kl_episodes e ON e.id=s.episode_id
 WHERE s.user_id=v_user AND e.season_number=p_season_number
  AND e.episode_number BETWEEN 1 AND 30 AND s.completed_at IS NOT NULL
  AND e.status='approved' AND e.approved_at IS NOT NULL AND e.release_at<=now();
 SELECT min(n) INTO v_next FROM pg_catalog.generate_series(1,30) n
 WHERE NOT (n=ANY(v_completed));
 RETURN jsonb_build_object('ok',true,'enabled',private.kl_s2_rewards_enabled_v1(),
   'completed_numbers',to_jsonb(v_completed),'next_chapter_number',coalesce(v_next,31));
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_reader_progress_v1(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_reader_progress_v1(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.kl_s2_series_reflection_status_v1(p_season_number integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_count integer; v_submitted boolean; v_awarded boolean;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_season_number NOT BETWEEN 1 AND 100 THEN
  RETURN jsonb_build_object('ok',false,'reason','invalid_series'); END IF;
 SELECT count(DISTINCT e.episode_number) INTO v_count FROM public.kl_reading_sessions s
 JOIN public.kl_episodes e ON e.id=s.episode_id
 WHERE s.user_id=v_user AND e.season_number=p_season_number
   AND e.episode_number BETWEEN 1 AND 30 AND s.completed_at IS NOT NULL
   AND e.status='approved' AND e.approved_at IS NOT NULL AND e.release_at<=now();
 SELECT EXISTS(SELECT 1 FROM private.kl_s2_series_reflections r
   WHERE r.user_id=v_user AND r.season_number=p_season_number) INTO v_submitted;
 SELECT EXISTS(SELECT 1 FROM public.buklod_points_ledger l
   WHERE l.user_id=v_user AND l.source_key='kl:season:'||v_user::text||':'||p_season_number::text
   AND l.direction='credit' AND l.points=50) INTO v_awarded;
 RETURN jsonb_build_object('ok',true,'enabled',private.kl_s2_rewards_enabled_v1(),
  'ready',v_count=30,'submitted',v_submitted,'reward_claimed',v_awarded,
  'minimum_characters',50,'series_points',50);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_series_reflection_status_v1(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_series_reflection_status_v1(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.kl_s2_submit_series_reflection_v1(
 p_season_number integer,p_reflection text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_user uuid:=auth.uid();
 v_text text:=btrim(regexp_replace(coalesce(p_reflection,''),'[[:space:]]+',' ','g'));
 v_words integer; v_distinct integer; v_count integer; v_episode_id uuid; v_existing boolean;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT private.kl_s2_rewards_enabled_v1() THEN
  RETURN jsonb_build_object('ok',false,'reason','season_not_active'); END IF;
 IF p_season_number NOT BETWEEN 1 AND 100 THEN
  RETURN jsonb_build_object('ok',false,'reason','invalid_series'); END IF;
 IF char_length(v_text) NOT BETWEEN 50 AND 2000 THEN
  RETURN jsonb_build_object('ok',false,'reason','reflection_minimum_50'); END IF;
 SELECT count(*),count(DISTINCT word) INTO v_words,v_distinct
 FROM regexp_split_to_table(lower(v_text),'[^[:alnum:]]+') word WHERE char_length(word)>=2;
 IF v_words<8 OR v_distinct<6 THEN
  RETURN jsonb_build_object('ok',false,'reason','reflection_needs_personal_thought'); END IF;
 SELECT count(DISTINCT e.episode_number) INTO v_count
 FROM public.kl_reading_sessions s JOIN public.kl_episodes e ON e.id=s.episode_id
 WHERE s.user_id=v_user AND e.season_number=p_season_number
  AND e.episode_number BETWEEN 1 AND 30 AND s.completed_at IS NOT NULL
  AND e.status='approved' AND e.approved_at IS NOT NULL AND e.release_at<=now();
 IF v_count<>30 THEN
  RETURN jsonb_build_object('ok',false,'reason','complete_all_chapters_first'); END IF;
 SELECT e.id INTO v_episode_id FROM public.kl_episodes e
 WHERE e.season_number=p_season_number AND e.episode_number=30
   AND e.status='approved' AND e.approved_at IS NOT NULL AND e.release_at<=now()
 ORDER BY e.approved_at DESC LIMIT 1;
 IF v_episode_id IS NULL THEN
  RETURN jsonb_build_object('ok',false,'reason','final_chapter_not_released'); END IF;
 -- Immutable single personal reflection: retries and concurrent clients are safe.
 INSERT INTO private.kl_s2_series_reflections(user_id,season_number,reflection_text)
 VALUES(v_user,p_season_number,v_text)
 ON CONFLICT (user_id,season_number) DO NOTHING;
 PERFORM 1 FROM private.kl_s2_series_reflections
 WHERE user_id=v_user AND season_number=p_season_number FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM public.buklod_points_ledger l
 WHERE l.user_id=v_user AND l.source_key='kl:season:'||v_user::text||':'||p_season_number::text
 AND l.direction='credit' AND l.points=50) INTO v_existing;
 IF NOT v_existing THEN
  PERFORM public.buklod_award_verification_points_v1(
    v_user,50,'kl_season_completion',
    'kl:season:'||v_user::text||':'||p_season_number::text,v_episode_id,
    'KL member series reflection verified: +50 BP',null);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_points_ledger l
  WHERE l.user_id=v_user AND l.source_key='kl:season:'||v_user::text||':'||p_season_number::text
    AND l.direction='credit' AND l.points=50) THEN
  RAISE EXCEPTION 'KL bonus ledger verification failed'; END IF;
 INSERT INTO public.kl_story_achievements(user_id,achievement_key,episode_id)
 VALUES(v_user,'kl:season:'||p_season_number::text,v_episode_id) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('ok',true,'submitted',true,'reward_claimed',true,
  'new_reward',NOT v_existing,'series_points',CASE WHEN v_existing THEN 0 ELSE 50 END);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_submit_series_reflection_v1(integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_submit_series_reflection_v1(integer,text) TO authenticated;

-- Carry forward all S1 reward behavior unchanged before the S2 rollout flag.
-- Once S2 is ON, only approved 3/3 quizzes grant immediate chapter approval,
-- regardless of time spent. Existing +50 series award awaits reflection submit.

CREATE OR REPLACE FUNCTION public.kl_reading_progress_v1(p_episode_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=auth.uid();
 v_session public.kl_reading_sessions%rowtype;
 v_episode public.kl_episodes%rowtype;
 v_chapter_awarded boolean:=false;
 v_chapter_points integer:=10;
 v_s2_enabled boolean:=false;
 v_pending_points integer:=0;
 v_previous_credit integer:=0;
 v_previous_id uuid;
 v_pending_row private.kl_s2_chapter_pending%rowtype;
 v_previous_ledger_exists boolean:=false;
 v_series_awarded boolean:=false;
 v_season_count integer;v_finished integer;v_ledger_id uuid;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 -- Season 1 stays at +10 until a separately authorized, dated S2 activation.
 select * into v_episode from public.kl_episodes
 where id=p_episode_id and status='approved' and approved_at is not null
   and release_at<=now() for share;
 if not found then raise exception 'Chapter not released';end if;
 v_s2_enabled:=private.kl_s2_rewards_enabled_v1();
 IF v_s2_enabled THEN
  IF v_episode.episode_number NOT BETWEEN 0 AND 30 THEN
   RAISE EXCEPTION 'Invalid Season 2 numbered chapter';
  END IF;
  IF NOT private.kl_s2_previous_chapter_complete_v1(v_user,p_episode_id) THEN
   RETURN jsonb_build_object('ok',false,'completed',false,
      'reason','previous_chapter_required','points_awarded',0,
      'chapter_points',0,'series_points',0);
  END IF;
  -- Panimula retains its previous behavior; progressive rates apply to numbered chapters.
  IF v_episode.episode_number>=1 THEN v_chapter_points:=5+v_episode.episode_number; END IF;
 END IF;
 if p_action='start' then
  insert into public.kl_reading_sessions(user_id,episode_id) values(v_user,p_episode_id)
  on conflict(user_id,episode_id) do nothing;
 elsif p_action='ping' then
  update public.kl_reading_sessions
  set last_ping_at=now(),ping_count=least(10000,ping_count+1)
  where user_id=v_user and episode_id=p_episode_id and completed_at is null
    and last_ping_at<=now()-interval '15 seconds';
 elsif p_action='complete' then
  select * into v_session from public.kl_reading_sessions
  where user_id=v_user and episode_id=p_episode_id for update;
  if not found OR (
   NOT EXISTS (
     SELECT 1 FROM public.kl_quiz_attempts a
     JOIN public.kl_quiz_sets q ON q.episode_id=a.episode_id
     WHERE a.user_id=v_user AND a.episode_id=p_episode_id
       AND a.verified_at IS NOT NULL AND a.manuscript_hash=q.manuscript_hash
       AND q.status='ready'
   )
   AND (
     coalesce((SELECT enforce_quiz FROM public.kl_quiz_rollout WHERE id=1),false)
     OR v_s2_enabled -- always require quiz in S2; timer is irrelevant
     OR v_session.started_at>now()-interval '60 seconds'
     OR v_session.ping_count<2
   )
  ) then
   return jsonb_build_object('completed',false,'reason','reading_engagement_not_verified',
    'points_awarded',0,'chapter_points',0,'series_points',0);
  end if;
  if v_session.completed_at is null then
   update public.kl_reading_sessions set completed_at=now()
   where user_id=v_user and episode_id=p_episode_id;
   v_chapter_awarded:=true;
   IF v_s2_enabled AND v_episode.episode_number BETWEEN 1 AND 30 THEN
    -- Pending is never a balance or a point-ledger credit.
    INSERT INTO private.kl_s2_chapter_pending(user_id,episode_id,reward_bp)
    VALUES (v_user,p_episode_id,v_chapter_points)
    ON CONFLICT (user_id,episode_id) DO NOTHING;
    v_pending_points:=v_chapter_points;

    -- Claim previous chapter only on VERIFIED COMPLETION of the NEXT one.
    -- Chapter 1 of a new series releases Chapter 30 of the preceding series.
    -- No other action, ad impression, comment, mere read, or replay releases it.
    SELECT pending.* INTO v_pending_row
    FROM private.kl_s2_chapter_pending pending
    JOIN public.kl_episodes previous ON previous.id=pending.episode_id
    WHERE pending.user_id=v_user AND pending.credited_at IS NULL
      AND (
        (v_episode.episode_number>1
         AND previous.season_number=v_episode.season_number
         AND previous.episode_number=v_episode.episode_number-1)
        OR
        (v_episode.episode_number=1 AND v_episode.season_number>1
         AND previous.season_number=v_episode.season_number-1
         AND previous.episode_number=30)
      )
    FOR UPDATE OF pending;
    IF FOUND THEN
      v_previous_id:=v_pending_row.episode_id;
      SELECT EXISTS (
        SELECT 1 FROM public.buklod_points_ledger ledger
        WHERE ledger.user_id=v_user
          AND ledger.source_key='kl:episode:'||v_user::text||':'||v_previous_id::text
      ) INTO v_previous_ledger_exists;
      IF NOT v_previous_ledger_exists THEN
        PERFORM public.buklod_award_verification_points_v1(
          v_user,v_pending_row.reward_bp,'kl_episode_completion',
          'kl:episode:'||v_user::text||':'||v_previous_id::text,v_previous_id,
          'KL previous verified chapter released +'||v_pending_row.reward_bp::text||' BP',null);
      END IF;
      -- The release marker must never be committed without a real ledger row.
      IF NOT EXISTS (
        SELECT 1 FROM public.buklod_points_ledger ledger
        WHERE ledger.user_id=v_user
          AND ledger.source_key='kl:episode:'||v_user::text||':'||v_previous_id::text
          AND ledger.direction='credit' AND ledger.points=v_pending_row.reward_bp
      ) THEN RAISE EXCEPTION 'KL pending credit ledger verification failed'; END IF;
      UPDATE private.kl_s2_chapter_pending
      SET credited_at=now()
      WHERE user_id=v_user AND episode_id=v_previous_id AND credited_at IS NULL;
      IF NOT v_previous_ledger_exists THEN
        v_previous_credit:=v_pending_row.reward_bp;
      END IF;
    END IF;
   ELSIF NOT v_s2_enabled THEN
    PERFORM public.buklod_award_verification_points_v1(
      v_user,v_chapter_points,'kl_episode_completion',
      'kl:episode:'||v_user::text||':'||p_episode_id::text,p_episode_id,
      'KL verified chapter completion +'||v_chapter_points::text||' BP',null);
   END IF;
  end if;
  select count(*) into v_season_count from public.kl_episodes
   where season_number=v_episode.season_number and status='approved' and release_at<=now();
  select count(*) into v_finished from public.kl_reading_sessions s
   join public.kl_episodes e on e.id=s.episode_id
   where s.user_id=v_user and s.completed_at is not null
    and e.season_number=v_episode.season_number and e.status='approved'
    and e.release_at<=now();
  if v_season_count=30 and v_finished=30 AND NOT v_s2_enabled then
   perform public.buklod_award_verification_points_v1(
    v_user,50,'kl_season_completion',
    'kl:season:'||v_user::text||':'||v_episode.season_number::text,p_episode_id,
    'KL all 30 chapters verified: full series +50 BP',null);
   insert into public.kl_story_achievements(user_id,achievement_key,episode_id)
    values(v_user,'kl:season:'||v_episode.season_number::text,p_episode_id)
    on conflict do nothing;
   -- Only report new bonus if this verified ledger event was freshly created in this transaction.
   select exists(select 1 from public.buklod_points_ledger l
    where l.user_id=v_user and l.activity_type='kl_season_completion'
     and l.source_key='kl:season:'||v_user::text||':'||v_episode.season_number::text
     and l.created_at>=transaction_timestamp()) into v_series_awarded;
  end if;
 else raise exception 'Invalid reading action';end if;
 return jsonb_build_object('ok',true,'completed',p_action='complete',
   'new_completion',v_chapter_awarded,
   'chapter_points',case when v_chapter_awarded AND NOT v_s2_enabled then v_chapter_points else 0 end,
   'pending_points',v_pending_points,
   'released_previous_chapter_points',v_previous_credit,
   'released_previous_episode_id',v_previous_id,
   'reward_status',case
      when v_s2_enabled AND v_chapter_awarded AND v_pending_points>0 then 'pending_next_chapter'
      when v_chapter_awarded then 'credited'
      else 'already_completed' end,
   'series_points',case when v_series_awarded then 50 else 0 end,
   'points_awarded',v_previous_credit+
      (case when v_chapter_awarded AND NOT v_s2_enabled then v_chapter_points else 0 end)+
      (case when v_series_awarded then 50 else 0 end));
end;
$function$;


REVOKE ALL ON FUNCTION public.kl_reading_progress_v1(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_reading_progress_v1(uuid,text) TO authenticated;

-- Disable questions-preparing legacy completion for S2.
CREATE OR REPLACE FUNCTION public.kl_quiz_begin_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_user uuid:=auth.uid(); v_hash text; v_ids uuid[]; v_items jsonb; v_attempt uuid; v_count int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT md5(manuscript) INTO v_hash FROM public.kl_episodes
    WHERE id=p_episode_id AND status='approved' AND approved_at IS NOT NULL AND release_at<=now();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','chapter_unavailable'); END IF;
  IF EXISTS(SELECT 1 FROM public.kl_reading_sessions WHERE episode_id=p_episode_id AND user_id=v_user AND completed_at IS NOT NULL)
    THEN RETURN jsonb_build_object('ok',true,'already_completed',true); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.kl_quiz_sets WHERE episode_id=p_episode_id AND manuscript_hash=v_hash AND status='ready')
    THEN RETURN jsonb_build_object('ok',false,'reason','questions_preparing',
      'allow_legacy',NOT private.kl_s2_rewards_enabled_v1() AND NOT coalesce((SELECT enforce_quiz FROM public.kl_quiz_rollout WHERE id=1),false)); END IF;
  INSERT INTO public.kl_reading_sessions(user_id,episode_id)
    VALUES(v_user,p_episode_id) ON CONFLICT(user_id,episode_id) DO NOTHING;
  SELECT count(*) INTO v_count FROM public.kl_quiz_attempts
   WHERE user_id=v_user AND episode_id=p_episode_id AND started_at>now()-interval '10 minutes';
  IF v_count>=8 THEN RETURN jsonb_build_object('ok',false,'reason','retry_later'); END IF;
  SELECT array_agg(id),jsonb_agg(jsonb_build_object('id',id,'question',question_text,'options',options))
    INTO v_ids,v_items FROM
    (SELECT id,question_text,options FROM public.kl_quiz_questions WHERE episode_id=p_episode_id ORDER BY random() LIMIT 3) q;
  IF coalesce(array_length(v_ids,1),0)<>3 THEN RETURN jsonb_build_object('ok',false,'reason','questions_preparing'); END IF;
  INSERT INTO public.kl_quiz_attempts(episode_id,user_id,manuscript_hash,question_ids)
    VALUES(p_episode_id,v_user,v_hash,v_ids) RETURNING id INTO v_attempt;
  RETURN jsonb_build_object('ok',true,'attempt_id',v_attempt,'questions',v_items);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_quiz_begin_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_quiz_begin_v1(uuid) TO authenticated;

