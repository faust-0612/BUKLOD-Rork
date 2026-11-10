-- KL automatic simple reading verification quiz.
-- New approval queues 5 grounded questions; reader answers 3 randomized items.
-- Legacy timer remains during OTA transition; do not enable enforcement before client rollout.
CREATE TABLE IF NOT EXISTS public.kl_quiz_sets (
  episode_id uuid PRIMARY KEY REFERENCES public.kl_episodes(id) ON DELETE CASCADE,
  manuscript_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','draft')),
  generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.kl_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.kl_quiz_sets(episode_id) ON DELETE CASCADE,
  item_number int NOT NULL CHECK (item_number BETWEEN 1 AND 5),
  question_text text NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options)='array' AND jsonb_array_length(options)=4),
  correct_index int NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  evidence text NOT NULL,
  UNIQUE (episode_id,item_number)
);
CREATE TABLE IF NOT EXISTS public.kl_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.kl_episodes(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  manuscript_hash text NOT NULL,
  question_ids uuid[] NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  verified_at timestamptz
);
CREATE INDEX IF NOT EXISTS kl_quiz_attempts_user_idx
  ON public.kl_quiz_attempts(user_id,episode_id,started_at DESC);
CREATE TABLE IF NOT EXISTS public.kl_quiz_rollout (
  id int PRIMARY KEY DEFAULT 1 CHECK(id=1),
  enforce_quiz boolean NOT NULL DEFAULT false
);
INSERT INTO public.kl_quiz_rollout(id,enforce_quiz) VALUES(1,false) ON CONFLICT DO NOTHING;
ALTER TABLE public.kl_quiz_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kl_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kl_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kl_quiz_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kl_quiz_sets,public.kl_quiz_questions,public.kl_quiz_attempts,public.kl_quiz_rollout FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.kl_quiz_sync_approval_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.status='approved' AND NEW.approved_at IS NOT NULL AND length(btrim(coalesce(NEW.manuscript,'')))>=100 THEN
    INSERT INTO public.kl_quiz_sets(episode_id,manuscript_hash,status)
    VALUES(NEW.id,md5(NEW.manuscript),'pending')
    ON CONFLICT(episode_id) DO UPDATE
      SET manuscript_hash=excluded.manuscript_hash,status='pending',generated_at=null,updated_at=now()
      WHERE public.kl_quiz_sets.manuscript_hash IS DISTINCT FROM excluded.manuscript_hash
         OR public.kl_quiz_sets.status='draft';
  ELSE
    UPDATE public.kl_quiz_sets SET status='draft',updated_at=now() WHERE episode_id=NEW.id AND status<>'draft';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS kl_quiz_sync_approval_trigger ON public.kl_episodes;
CREATE TRIGGER kl_quiz_sync_approval_trigger
AFTER INSERT OR UPDATE OF status,approved_at,manuscript ON public.kl_episodes
FOR EACH ROW EXECUTE FUNCTION public.kl_quiz_sync_approval_v1();
-- Seed pending sets for already published chapters without editing their reading history or points.
INSERT INTO public.kl_quiz_sets(episode_id,manuscript_hash,status)
SELECT id,md5(manuscript),'pending' FROM public.kl_episodes
WHERE status='approved' AND approved_at IS NOT NULL AND length(btrim(coalesce(manuscript,'')))>=100
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.kl_quiz_admin_context_v1(p_episode_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.kl_episodes%rowtype; v_status text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role::text='system_admin' AND is_active=true)
    THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v FROM public.kl_episodes WHERE id=p_episode_id;
  IF NOT FOUND OR v.status<>'approved' OR v.approved_at IS NULL
    THEN RAISE EXCEPTION 'Approve manuscript first'; END IF;
  SELECT status INTO v_status FROM public.kl_quiz_sets WHERE episode_id=p_episode_id AND manuscript_hash=md5(v.manuscript);
  RETURN jsonb_build_object('episode_id',v.id,'title',v.title,'manuscript',v.manuscript,
    'manuscript_hash',md5(v.manuscript),'quiz_status',coalesce(v_status,'pending'));
END $fn$;
REVOKE ALL ON FUNCTION public.kl_quiz_admin_context_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_quiz_admin_context_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.kl_quiz_store_generated_v1(p_episode_id uuid,p_manuscript_hash text,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.kl_episodes%rowtype; v_i jsonb; v_number int:=0; v_q text; v_e text; v_options jsonb; v_answer text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role::text='system_admin' AND is_active=true)
    THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v FROM public.kl_episodes WHERE id=p_episode_id FOR UPDATE;
  IF NOT FOUND OR v.status<>'approved' OR v.approved_at IS NULL OR md5(v.manuscript)<>p_manuscript_hash
    THEN RAISE EXCEPTION 'Approved manuscript changed; regenerate'; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<>5
    THEN RAISE EXCEPTION 'Exactly five questions required'; END IF;
  -- Validate all 5 before touching stored questions.
  FOR v_i IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_number:=v_number+1;
    v_q:=btrim(coalesce(v_i->>'question','')); v_e:=btrim(coalesce(v_i->>'evidence',''));
    v_options:=v_i->'options'; v_answer:=v_i->>'correct_index';
    IF length(v_q) NOT BETWEEN 12 AND 260 OR length(v_e) NOT BETWEEN 15 AND 500
      OR position(v_e in v.manuscript)=0
      OR jsonb_typeof(v_options)<>'array' OR jsonb_array_length(v_options)<>4
      OR v_answer !~ '^[0-3]$'
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_options) AS o(value)
        WHERE length(btrim(o.value)) NOT BETWEEN 1 AND 160)
      THEN RAISE EXCEPTION 'Generated question lacks exact manuscript evidence or valid choices'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_options) a
      JOIN jsonb_array_elements_text(v_options) b ON a.value=b.value
      GROUP BY a.value HAVING count(*)>1)
      THEN RAISE EXCEPTION 'Question has duplicate choices'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT lower(btrim(value->>'question'))) FROM jsonb_array_elements(p_items))<>5
    THEN RAISE EXCEPTION 'Duplicate questions not accepted'; END IF;
  -- Never regenerate a current, approved bank on retries (attempts may already be in progress).
  IF EXISTS(SELECT 1 FROM public.kl_quiz_sets
    WHERE episode_id=p_episode_id AND manuscript_hash=p_manuscript_hash AND status='ready')
    THEN RETURN jsonb_build_object('ok',true,'changed',false,'count',5); END IF;
  INSERT INTO public.kl_quiz_sets(episode_id,manuscript_hash,status)
  VALUES(p_episode_id,p_manuscript_hash,'pending')
  ON CONFLICT(episode_id) DO UPDATE SET manuscript_hash=excluded.manuscript_hash,status='pending',updated_at=now();
  DELETE FROM public.kl_quiz_questions WHERE episode_id=p_episode_id;
  v_number:=0;
  FOR v_i IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_number:=v_number+1;
    INSERT INTO public.kl_quiz_questions(episode_id,item_number,question_text,options,correct_index,evidence)
    VALUES(p_episode_id,v_number,btrim(v_i->>'question'),v_i->'options',(v_i->>'correct_index')::int,btrim(v_i->>'evidence'));
  END LOOP;
  UPDATE public.kl_quiz_sets SET status='ready',generated_at=now(),updated_at=now()
    WHERE episode_id=p_episode_id AND manuscript_hash=p_manuscript_hash;
  RETURN jsonb_build_object('ok',true,'changed',true,'count',5);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_quiz_store_generated_v1(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_quiz_store_generated_v1(uuid,text,jsonb) TO authenticated;

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
      'allow_legacy',NOT coalesce((SELECT enforce_quiz FROM public.kl_quiz_rollout WHERE id=1),false)); END IF;
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

CREATE OR REPLACE FUNCTION public.kl_quiz_submit_v1(p_attempt_id uuid,p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v public.kl_quiz_attempts%rowtype; v_count int; v_correct int; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v FROM public.kl_quiz_attempts WHERE id=p_attempt_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','attempt_unavailable'); END IF;
  IF v.submitted_at IS NOT NULL THEN
    IF v.verified_at IS NOT NULL THEN
      -- Safe replay when the network failed after a successful transaction.
      SELECT public.kl_reading_progress_v1(v.episode_id,'complete') INTO v_result;
      RETURN jsonb_build_object('ok',true,'passed',true,'already_submitted',true,'completion',v_result);
    END IF;
    RETURN jsonb_build_object('ok',true,'passed',false,'already_submitted',true);
  END IF;
  IF v.started_at<now()-interval '2 hours' OR
    NOT EXISTS(SELECT 1 FROM public.kl_episodes e JOIN public.kl_quiz_sets s ON s.episode_id=e.id
      WHERE e.id=v.episode_id AND s.manuscript_hash=v.manuscript_hash
      AND s.status='ready' AND e.status='approved' AND e.approved_at IS NOT NULL
      AND e.release_at<=now() AND md5(e.manuscript)=v.manuscript_hash)
    THEN RETURN jsonb_build_object('ok',false,'reason','attempt_expired'); END IF;
  IF jsonb_typeof(p_answers)<>'object' THEN RETURN jsonb_build_object('ok',false,'reason','invalid_answers'); END IF;
  SELECT count(*) INTO v_count FROM jsonb_object_keys(p_answers);
  IF v_count<>3 OR EXISTS(SELECT 1 FROM jsonb_each_text(p_answers) a
    WHERE a.key<>ALL(SELECT unnest(v.question_ids)::text) OR a.value !~ '^[0-3]$')
    THEN RETURN jsonb_build_object('ok',false,'reason','invalid_answers'); END IF;
  SELECT count(*) INTO v_correct FROM public.kl_quiz_questions q
    WHERE q.id=ANY(v.question_ids) AND p_answers ? q.id::text
      AND (p_answers->>q.id::text)::int=q.correct_index;
  IF v_correct=3 THEN
    UPDATE public.kl_quiz_attempts SET submitted_at=now(),verified_at=now() WHERE id=v.id;
    -- The legacy routine keeps the same idempotent +5/+30 awarding rules.
    SELECT public.kl_reading_progress_v1(v.episode_id,'complete') INTO v_result;
    RETURN jsonb_build_object('ok',true,'passed',true,'correct',3,'completion',v_result);
  END IF;
  UPDATE public.kl_quiz_attempts SET submitted_at=now() WHERE id=v.id;
  RETURN jsonb_build_object('ok',true,'passed',false,'correct',v_correct,'total',3);
END $fn$;
REVOKE ALL ON FUNCTION public.kl_quiz_submit_v1(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_quiz_submit_v1(uuid,jsonb) TO authenticated;

-- Quiz-verified completion bypasses timer; existing clients use legacy path until rollout flag is enabled.
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
 v_series_awarded boolean:=false;
 v_season_count integer;v_finished integer;v_ledger_id uuid;
begin
 if v_user is null then raise exception 'Sign in required';end if;
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
      v_user,5,'kl_episode_completion',
      'kl:episode:'||v_user::text||':'||p_episode_id::text,p_episode_id,
      'KL verified chapter completion +5 BP',null);
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
    v_user,30,'kl_season_completion',
    'kl:season:'||v_user::text||':'||v_episode.season_number::text,p_episode_id,
    'KL all 30 chapters verified: full series +30 BP',null);
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
   'chapter_points',case when v_chapter_awarded then 5 else 0 end,
   'series_points',case when v_series_awarded then 30 else 0 end,
   'points_awarded',(case when v_chapter_awarded then 5 else 0 end)+
      (case when v_series_awarded then 30 else 0 end));
end;
$function$;


-- Under quiz-only enforcement, prevent new chapter scheduling/release without verified questions.
-- This does not affect existing published chapters or the staged legacy rollout.
CREATE OR REPLACE FUNCTION public.kl_quiz_release_ready_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
  IF NEW.status='approved' AND NEW.release_at IS NOT NULL
     AND (OLD.release_at IS DISTINCT FROM NEW.release_at)
     AND coalesce((SELECT enforce_quiz FROM public.kl_quiz_rollout WHERE id=1),false)
     AND NOT EXISTS(
       SELECT 1 FROM public.kl_quiz_sets q
       WHERE q.episode_id=NEW.id AND q.status='ready' AND q.manuscript_hash=md5(NEW.manuscript)
     ) THEN
     RAISE EXCEPTION 'Prepare verified KL reading questions before scheduling or releasing the chapter';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS kl_quiz_release_guard_trigger ON public.kl_episodes;
CREATE TRIGGER kl_quiz_release_guard_trigger
BEFORE UPDATE OF release_at ON public.kl_episodes
FOR EACH ROW EXECUTE FUNCTION public.kl_quiz_release_ready_guard_v1();
