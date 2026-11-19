-- S2 KL reward policy (staging source only). Explicitly OFF until separately approved
-- on/after 2026-12-06 Asia/Manila. NEVER apply to production during Season 1.
-- Completion: after activation, verified Chapter N earns PENDING (5+N) BP;
-- credit it ONLY when Chapter N+1 is verified. Chapter 30 releases when
-- Chapter 1 of the following season is verified. Season 1 stays +10 direct.
-- First qualifying top-level comment per member per released chapter: +5 BP
-- with >=20 trimmed characters. Historical comments/completions are untouched.
-- All claims must be server-authoritative, forward-only and idempotent.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.kl_s2_reward_rollout (
 id smallint PRIMARY KEY CHECK(id=1),
 enabled boolean NOT NULL DEFAULT false,
 effective_at timestamptz NOT NULL DEFAULT '2026-12-06 00:00:00+08'::timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT kl_s2_reward_not_before_dec6
 CHECK(effective_at >= '2026-12-06 00:00:00+08'::timestamptz)
);
INSERT INTO private.kl_s2_reward_rollout(id,enabled,effective_at)
VALUES(1,false,'2026-12-06 00:00:00+08'::timestamptz)
ON CONFLICT(id) DO NOTHING;
ALTER TABLE private.kl_s2_reward_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.kl_s2_reward_rollout FROM PUBLIC,anon,authenticated;

-- New forward-only S2 chapter completions are immutable pending entitlements.
-- Historical Season 1 completions never enter this table, preventing re-credit.
-- A single row per user/chapter survives season boundaries and may remain pending
-- until the next book is actually published and independently completed.
CREATE TABLE IF NOT EXISTS private.kl_s2_chapter_pending (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 episode_id uuid NOT NULL REFERENCES public.kl_episodes(id),
 reward_bp integer NOT NULL CHECK (reward_bp BETWEEN 6 AND 35),
 completed_at timestamptz NOT NULL DEFAULT now(),
 credited_at timestamptz,
 PRIMARY KEY (user_id, episode_id)
);
CREATE INDEX IF NOT EXISTS kl_s2_chapter_pending_uncredited_idx
 ON private.kl_s2_chapter_pending(user_id, completed_at)
 WHERE credited_at IS NULL;
ALTER TABLE private.kl_s2_chapter_pending ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.kl_s2_chapter_pending FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.kl_s2_rewards_enabled_v1()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT coalesce((SELECT enabled AND effective_at<=now()
                  FROM private.kl_s2_reward_rollout WHERE id=1),false)
$fn$;
REVOKE ALL ON FUNCTION private.kl_s2_rewards_enabled_v1() FROM PUBLIC,anon,authenticated;

-- Activation is separate from schema deployment. Synchronize the visible reward
-- catalog only on the explicit future activation; never alter production points now.
CREATE OR REPLACE FUNCTION private.kl_s2_reward_activation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF NEW.enabled AND now()<NEW.effective_at THEN
  RAISE EXCEPTION 'Season 2 KL rewards cannot activate ahead of the approved effective date';
 END IF;
 IF NEW.enabled AND NOT OLD.enabled THEN
  UPDATE public.buklod_point_rules
  SET base_points=5,max_points_per_event=35,
      notes='KL S2 chapter +5 base and +1 per number; pending until next verified chapter, including cross-series final chapter',
      updated_at=now()
  WHERE activity_type='kl_episode';
 ELSIF OLD.enabled AND NOT NEW.enabled THEN
  -- Emergency rollback fails closed to the original Season 1 +10 catalog.
  UPDATE public.buklod_point_rules
  SET base_points=10,max_points_per_event=10,
      notes='KL R4 verified chapter completion +10 BP; S2 reward rollout disabled',
      updated_at=now()
  WHERE activity_type='kl_episode';
 END IF;
 NEW.updated_at:=now();
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.kl_s2_reward_activation_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS kl_s2_reward_activation_guard ON private.kl_s2_reward_rollout;
CREATE TRIGGER kl_s2_reward_activation_guard
BEFORE UPDATE ON private.kl_s2_reward_rollout
FOR EACH ROW EXECUTE FUNCTION private.kl_s2_reward_activation_v1();


-- Season 2 per-user chapter unlock. Completed prior chapter is server-verified.
-- Chapter numbers are bounded to prevent unexpected award inflation.
CREATE OR REPLACE FUNCTION private.kl_s2_previous_chapter_complete_v1(
 p_user uuid,p_episode_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT EXISTS (
  SELECT 1 FROM public.kl_episodes chapter
  WHERE chapter.id=p_episode_id AND chapter.episode_number BETWEEN 0 AND 30
    AND (chapter.episode_number=0 OR (
      -- Every numbered chapter before this one must be approved, released
      -- AND completed by the SAME account. Missing numbers are blockers.
      NOT EXISTS (
        SELECT 1 FROM pg_catalog.generate_series(1,chapter.episode_number-1) required(n)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.kl_episodes previous
          JOIN public.kl_reading_sessions sessions
            ON sessions.episode_id=previous.id AND sessions.user_id=p_user
          WHERE previous.season_number=chapter.season_number
            AND previous.episode_number=required.n
            AND previous.status='approved' AND previous.approved_at IS NOT NULL
            AND previous.release_at<=now() AND sessions.completed_at IS NOT NULL
        )
      )
      -- Cross-series means the entire earlier 30-chapter series must be
      -- finished, not just its final chapter; skip histories cannot pass.
      AND (chapter.season_number=1 OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.generate_series(1,30) previous_required(n)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.kl_episodes previous_series
          JOIN public.kl_reading_sessions prior_sessions
            ON prior_sessions.episode_id=previous_series.id
           AND prior_sessions.user_id=p_user
          WHERE previous_series.season_number=chapter.season_number-1
            AND previous_series.episode_number=previous_required.n
            AND previous_series.status='approved'
            AND previous_series.approved_at IS NOT NULL
            AND previous_series.release_at<=now()
            AND prior_sessions.completed_at IS NOT NULL
        )
      ))
    ))
 )
$fn$;
REVOKE ALL ON FUNCTION private.kl_s2_previous_chapter_complete_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;

-- Even an old Android client cannot start a *new* chapter session out of order
-- after activation. This trigger has no effect before Season 2 is enabled.
CREATE OR REPLACE FUNCTION private.kl_s2_reading_session_order_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF private.kl_s2_rewards_enabled_v1()
    AND NOT private.kl_s2_previous_chapter_complete_v1(NEW.user_id,NEW.episode_id)
 THEN RAISE EXCEPTION 'previous_chapter_required'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.kl_s2_reading_session_order_v1()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS kl_s2_order_on_session_insert ON public.kl_reading_sessions;
CREATE TRIGGER kl_s2_order_on_session_insert
 BEFORE INSERT OR UPDATE OF episode_id ON public.kl_reading_sessions
 FOR EACH ROW EXECUTE FUNCTION private.kl_s2_reading_session_order_v1();

-- Versioned read gate. Production Season 1 continues using the same original
-- reader function; client falls back when this staging RPC is not installed.
CREATE OR REPLACE FUNCTION public.kl_s2_chapter_access_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_user uuid:=auth.uid();
 v_enabled boolean:=private.kl_s2_rewards_enabled_v1();
 v_allowed boolean;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.kl_episodes WHERE id=p_episode_id) THEN
  RETURN jsonb_build_object('enabled',v_enabled,'allowed',false);
 END IF;
 v_allowed:=NOT v_enabled OR private.kl_s2_previous_chapter_complete_v1(v_user,p_episode_id);
 RETURN jsonb_build_object('enabled',v_enabled,'allowed',v_allowed,
   'reason',CASE WHEN v_allowed THEN null ELSE 'previous_chapter_required' END);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_s2_chapter_access_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_s2_chapter_access_v1(uuid) TO authenticated;

-- Server-side credit: original chapter comment RPC remains unchanged and is
-- covered through the physical table INSERT (old and new client versions).
-- No payout on repeats, replies, hidden comments, unreleased chapters, or
-- before the S2 rollout flag is deliberately enabled.
CREATE OR REPLACE FUNCTION private.kl_s2_comment_reward_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
 v_row jsonb:=to_jsonb(NEW);
 v_uid uuid;
 v_episode uuid;
 v_comment uuid;
 v_body text;
BEGIN
 IF NOT private.kl_s2_rewards_enabled_v1() THEN RETURN NEW; END IF;
 v_uid:=nullif(v_row->>'user_id','')::uuid;
 v_episode:=nullif(v_row->>'episode_id','')::uuid;
 v_comment:=nullif(v_row->>'id','')::uuid;
 v_body:=btrim(coalesce(v_row->>'body',v_row->>'comment_text',
                        v_row->>'content',v_row->>'message',''));
 IF v_uid IS NULL OR v_episode IS NULL OR v_comment IS NULL
    OR v_uid IS DISTINCT FROM auth.uid()
    OR char_length(v_body) NOT BETWEEN 20 AND 500
    OR coalesce((v_row->>'is_hidden')::boolean,false)
    OR nullif(v_row->>'parent_id','') IS NOT NULL
 THEN RETURN NEW; END IF;
 IF NOT private.kl_s2_previous_chapter_complete_v1(v_uid,v_episode)
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=v_uid AND p.is_active=true)
    OR NOT EXISTS (
       SELECT 1 FROM public.kl_episodes e WHERE e.id=v_episode
       AND e.status='approved' AND e.approved_at IS NOT NULL
       AND e.release_at IS NOT NULL AND e.release_at<=now()
    )
 THEN RETURN NEW; END IF;
 -- The unique (user_id,source_key) ledger constraint prevents duplicate
 -- reward grants across retries, chapters with many comments, and old clients.
 PERFORM public.buklod_award_verification_points_v1(
   v_uid,5,'kl_comment_reflection',
   'kl:comment:s2:'||v_uid::text||':'||v_episode::text,
   v_comment,'KL first qualified 20+ character chapter reflection +5 BP',null
 );
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.kl_s2_comment_reward_v1() FROM PUBLIC,anon,authenticated;
DO $install$
BEGIN
 IF to_regclass('public.kl_episode_comments') IS NULL
    AND to_regclass('private.kl_episode_comments') IS NULL THEN
  RAISE EXCEPTION 'KL comment storage missing: abort reward installation rather than silently skip';
 END IF;
 IF to_regclass('public.kl_episode_comments') IS NOT NULL THEN
  DROP TRIGGER IF EXISTS kl_s2_comment_reward_insert ON public.kl_episode_comments;
  CREATE TRIGGER kl_s2_comment_reward_insert
   AFTER INSERT ON public.kl_episode_comments
   FOR EACH ROW EXECUTE FUNCTION private.kl_s2_comment_reward_v1();
 END IF;
 IF to_regclass('private.kl_episode_comments') IS NOT NULL THEN
  DROP TRIGGER IF EXISTS kl_s2_comment_reward_insert ON private.kl_episode_comments;
  CREATE TRIGGER kl_s2_comment_reward_insert
   AFTER INSERT ON private.kl_episode_comments
   FOR EACH ROW EXECUTE FUNCTION private.kl_s2_comment_reward_v1();
 END IF;
END $install$;

-- Preserve the existing verified +50 BP series bonus, anti-abuse requirements,
-- source keys, and one-time completion semantics; only future activated
-- chapter completions switch to PENDING (5 + numbered chapter) BP, released only by verified next chapter.
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
  if v_season_count=30 and v_finished=30 then
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
