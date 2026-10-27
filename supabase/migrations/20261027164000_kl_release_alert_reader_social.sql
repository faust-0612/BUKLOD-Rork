-- One release event per chapter, opt-in push alerts, and verified-completion social proof.
-- No live-reader/presence tracking and no per-reader writes on ordinary page views.
CREATE TABLE IF NOT EXISTS public.kl_reader_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  release_alerts boolean NOT NULL DEFAULT false,
  show_completion boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kl_reader_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kl_reader_preferences_self_select ON public.kl_reader_preferences;
CREATE POLICY kl_reader_preferences_self_select ON public.kl_reader_preferences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.kl_public_readers (
  episode_id uuid NOT NULL REFERENCES public.kl_episodes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL,
  PRIMARY KEY (episode_id, user_id)
);
ALTER TABLE public.kl_public_readers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS kl_public_readers_recent_idx
  ON public.kl_public_readers (episode_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.kl_reader_totals (
  episode_id uuid PRIMARY KEY REFERENCES public.kl_episodes(id) ON DELETE CASCADE,
  completed_readers bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kl_reader_totals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS kl_reading_sessions_completed_episode_idx
  ON public.kl_reading_sessions (episode_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.kl_release_events (
  episode_id uuid PRIMARY KEY REFERENCES public.kl_episodes(id) ON DELETE CASCADE,
  release_at timestamptz NOT NULL,
  last_user_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  dispatched_at timestamptz
);
ALTER TABLE public.kl_release_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS kl_release_events_pending_idx
  ON public.kl_release_events (release_at) WHERE dispatched_at IS NULL;
CREATE INDEX IF NOT EXISTS kl_reader_preferences_alert_cursor_idx
  ON public.kl_reader_preferences (user_id) WHERE release_alerts = true;

-- Users choose separately whether to receive release push and to be named as a
-- verified reader. Names are never shown just because an account opened a page.
CREATE OR REPLACE FUNCTION public.kl_reader_preferences_v1(
  p_release_alerts boolean DEFAULT NULL,
  p_show_completion boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_user uuid := auth.uid(); v public.kl_reader_preferences%rowtype;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_release_alerts IS NOT NULL OR p_show_completion IS NOT NULL THEN
    INSERT INTO public.kl_reader_preferences(user_id, release_alerts, show_completion)
      VALUES(v_user, coalesce(p_release_alerts, false), coalesce(p_show_completion, false))
    ON CONFLICT(user_id) DO UPDATE SET
      release_alerts = coalesce(p_release_alerts, public.kl_reader_preferences.release_alerts),
      show_completion = coalesce(p_show_completion, public.kl_reader_preferences.show_completion),
      updated_at = now();
    IF p_show_completion IS TRUE THEN
      INSERT INTO public.kl_public_readers(episode_id,user_id,completed_at)
        SELECT s.episode_id,s.user_id,s.completed_at FROM public.kl_reading_sessions s
        WHERE s.user_id = v_user AND s.completed_at IS NOT NULL
      ON CONFLICT(episode_id,user_id) DO UPDATE SET completed_at = excluded.completed_at;
    ELSIF p_show_completion IS FALSE THEN
      DELETE FROM public.kl_public_readers WHERE user_id = v_user;
    END IF;
  END IF;
  SELECT * INTO v FROM public.kl_reader_preferences WHERE user_id = v_user;
  RETURN jsonb_build_object('release_alerts',coalesce(v.release_alerts,false),
    'show_completion',coalesce(v.show_completion,false));
END;
$function$;

CREATE OR REPLACE FUNCTION private.kl_record_public_completion_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.completed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.completed_at IS NULL)
      AND EXISTS(SELECT 1 FROM public.kl_reader_preferences
        WHERE user_id = NEW.user_id AND show_completion = true) THEN
    INSERT INTO public.kl_public_readers(episode_id,user_id,completed_at)
      VALUES(NEW.episode_id,NEW.user_id,NEW.completed_at)
    ON CONFLICT(episode_id,user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS kl_record_public_completion ON public.kl_reading_sessions;
CREATE TRIGGER kl_record_public_completion AFTER INSERT OR UPDATE OF completed_at
ON public.kl_reading_sessions FOR EACH ROW EXECUTE FUNCTION private.kl_record_public_completion_v1();

-- Small, cached card payload; latest eligible release only. All reader names
-- originate from voluntary visibility + verified completed_at, never pings.
CREATE OR REPLACE FUNCTION public.kl_latest_release_card_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v public.kl_episodes%rowtype; v_total bigint; v_names jsonb; v_preferences jsonb;
BEGIN
  SELECT * INTO v FROM public.kl_episodes
    WHERE status = 'approved' AND approved_at IS NOT NULL AND release_at <= now()
    ORDER BY release_at DESC, season_number DESC, episode_number DESC LIMIT 1;
  v_preferences := public.kl_reader_preferences_v1();
  IF v.id IS NULL THEN
    RETURN jsonb_build_object('latest',null,'completed_readers',0,'readers','[]'::jsonb,
      'preferences',v_preferences,'points_per_chapter',7,'season_bonus',10);
  END IF;
  SELECT coalesce(completed_readers,0) INTO v_total FROM public.kl_reader_totals WHERE episode_id=v.id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name',q.reader_name)),'[]'::jsonb) INTO v_names
    FROM (SELECT coalesce(nullif(btrim(p.username),''),nullif(btrim(p.first_name),''),'Mambabasa') AS reader_name
      FROM public.kl_public_readers r JOIN public.profiles p ON p.id=r.user_id
      WHERE r.episode_id=v.id AND p.is_active=true
      ORDER BY r.completed_at DESC LIMIT 5) q;
  RETURN jsonb_build_object(
    'latest',jsonb_build_object('id',v.id,'title',v.title,
      'season_number',v.season_number,'episode_number',v.episode_number,'release_at',v.release_at),
    'completed_readers',coalesce(v_total,0),'readers',v_names,
    'preferences',v_preferences,'points_per_chapter',7,'season_bonus',10);
END;
$function$;

-- Periodic aggregation prevents a hot counter row on simultaneous completions.
CREATE OR REPLACE FUNCTION private.kl_refresh_reader_totals_v1()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_count integer;
BEGIN
  WITH counts AS (
    SELECT episode_id,count(*)::bigint AS total FROM public.kl_reading_sessions
      WHERE completed_at IS NOT NULL GROUP BY episode_id
  ), refreshed AS (
    INSERT INTO public.kl_reader_totals(episode_id,completed_readers,updated_at)
      SELECT e.id,coalesce(c.total,0),now() FROM public.kl_episodes e
      LEFT JOIN counts c ON c.episode_id=e.id
      WHERE e.status='approved' AND e.approved_at IS NOT NULL AND e.release_at<=now()
    ON CONFLICT(episode_id) DO UPDATE SET completed_readers=excluded.completed_readers,
      updated_at=excluded.updated_at RETURNING 1
  ) SELECT count(*) INTO v_count FROM refreshed;
  RETURN v_count;
END;
$function$;

-- A release queues one durable event. Fan-out to opted-in users is bounded and
-- resumable, including scheduled releases that become due without an UPDATE.
CREATE OR REPLACE FUNCTION private.kl_release_alert_worker_v1(p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_event public.kl_release_events%rowtype;
  v_reader record;
  v_title text;
  v_last uuid;
  v_sent integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_notif_id uuid;
BEGIN
  INSERT INTO public.kl_release_events(episode_id,release_at)
    SELECT id,release_at FROM public.kl_episodes
      WHERE status='approved' AND approved_at IS NOT NULL AND release_at<=now()
  ON CONFLICT(episode_id) DO NOTHING;
  SELECT e.* INTO v_event FROM public.kl_release_events e
    JOIN public.kl_episodes ch ON ch.id=e.episode_id
    WHERE e.dispatched_at IS NULL AND ch.status='approved'
      AND ch.approved_at IS NOT NULL AND ch.release_at<=now()
    ORDER BY e.release_at FOR UPDATE OF e SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('sent',0,'pending',false); END IF;
  SELECT title INTO v_title FROM public.kl_episodes WHERE id=v_event.episode_id;
  v_last := v_event.last_user_id;
  FOR v_reader IN
    SELECT s.user_id FROM public.kl_reader_preferences s
      JOIN public.profiles p ON p.id=s.user_id AND p.is_active=true
      WHERE s.release_alerts=true AND s.user_id>v_event.last_user_id
      ORDER BY s.user_id LIMIT v_limit
  LOOP
    v_notif_id := public.queue_notification(v_reader.user_id,
      '📖 Bagong Kabihasnang Ligaw!',
      left('Inilabas na: '||v_title||'. Basahin ang bagong kabanata at makakuha ng +7 BUKLOD Points sa verified completion.',350),
      'kl_chapter_release',
      jsonb_build_object('episode_id',v_event.episode_id,'route',
        '/kabihasnang-ligaw?episodeId='||v_event.episode_id::text,
        'dedupe_key','kl-release:'||v_event.episode_id::text));
    IF v_notif_id IS NULL THEN RAISE EXCEPTION 'Could not queue KL release notification'; END IF;
    v_last := v_reader.user_id;
    v_sent := v_sent + 1;
  END LOOP;
  UPDATE public.kl_release_events
    SET last_user_id=v_last,dispatched_at=CASE WHEN v_sent < v_limit THEN now() ELSE NULL END
    WHERE episode_id=v_event.episode_id;
  RETURN jsonb_build_object('sent',v_sent,'episode_id',v_event.episode_id,
    'pending',v_sent=v_limit);
END;
$function$;

-- Only scheduled database workers can perform global fan-out or statistics refresh.
REVOKE ALL ON FUNCTION private.kl_release_alert_worker_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kl_refresh_reader_totals_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kl_record_public_completion_v1() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('kl-release-alerts-bounded-v1','* * * * *',
  'select private.kl_release_alert_worker_v1(100)');
SELECT cron.schedule('kl-reader-completion-rollup-v1','*/10 * * * *',
  'select private.kl_refresh_reader_totals_v1()');
