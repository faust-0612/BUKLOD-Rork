-- S2 KL reward policy (staging source only). Explicitly OFF until separately approved
-- on/after 2026-12-06 Asia/Manila. NEVER apply to production during Season 1.
-- Completion: verified chapter +15 BP AFTER activation; Season 1 remains +10.
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
  SET base_points=15,max_points_per_event=15,
      notes='KL S2 verified chapter completion +15 BP; forward only',
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
 IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=v_uid AND p.is_active=true)
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
-- chapter completions switch from 10 to 15 BP.
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
 v_series_awarded boolean:=false;
 v_season_count integer;v_finished integer;v_ledger_id uuid;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 -- Season 1 stays at +10 until a separately authorized, dated S2 activation.
 IF private.kl_s2_rewards_enabled_v1() THEN v_chapter_points:=15; END IF;
 select * into v_episode from public.kl_episodes
 where id=p_episode_id and status='approved' and approved_at is not null
   and release_at<=now() for share;
 if not found then raise exception 'Chapter not released';end if;
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
   perform public.buklod_award_verification_points_v1(
      v_user,v_chapter_points,'kl_episode_completion',
      'kl:episode:'||v_user::text||':'||p_episode_id::text,p_episode_id,
      'KL verified chapter completion +'||v_chapter_points::text||' BP',null);
   v_chapter_awarded:=true;
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
   'chapter_points',case when v_chapter_awarded then v_chapter_points else 0 end,
   'series_points',case when v_series_awarded then 50 else 0 end,
   'points_awarded',(case when v_chapter_awarded then v_chapter_points else 0 end)+
      (case when v_series_awarded then 50 else 0 end));
end;
$function$;


REVOKE ALL ON FUNCTION public.kl_reading_progress_v1(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_reading_progress_v1(uuid,text) TO authenticated;
