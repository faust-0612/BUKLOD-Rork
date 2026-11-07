-- BUKLOD Word November 2026 date-specific publishing regression checks.
-- Read-only postdeployment assertions; run on production/staging after migration.
DO $word_qa$
DECLARE n integer; invalid integer;
BEGIN
  SELECT count(*) INTO n FROM public.devotionals d
    JOIN public.devotional_series s ON s.id=d.series_id
    WHERE s.title='BUKLOD Daily Devotion — November 2026'
      AND s.is_published=true AND d.is_published=true
      AND d.publish_date BETWEEN date '2026-11-01' AND date '2026-11-30';
  IF n<>30 THEN RAISE EXCEPTION 'Expected exactly 30 November Word records, got %',n; END IF;
  SELECT count(*) INTO n FROM (
    SELECT d.publish_date
    FROM public.devotionals d JOIN public.devotional_series s ON s.id=d.series_id
    WHERE s.title='BUKLOD Daily Devotion — November 2026'
      AND d.is_published=true GROUP BY d.publish_date
  ) dates;
  IF n<>30 THEN RAISE EXCEPTION 'Missing/duplicate November publication dates: %',n; END IF;
  SELECT count(*) INTO n FROM public.devotionals WHERE publish_date<date '2026-11-01';
  IF n<>69 THEN RAISE EXCEPTION 'Historical Word archive changed unexpectedly: %',n; END IF;
  SELECT count(*) INTO invalid FROM public.devotionals d
    JOIN public.devotional_series s ON s.id=d.series_id
    WHERE s.title='BUKLOD Daily Devotion — November 2026'
     AND (nullif(trim(d.title),'') IS NULL OR d.bible_passage IS NULL OR d.key_verse IS NULL
      OR d.scripture_text IS NULL OR length(d.reflection_text)<350 OR d.think_about_it IS NULL
      OR d.application_text IS NULL OR d.prayer_text IS NULL);
  IF invalid<>0 THEN RAISE EXCEPTION 'Incomplete Word records: %',invalid; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.devotionals d JOIN public.devotional_series s ON s.id=d.series_id
    WHERE d.publish_date=(timezone('Asia/Manila',now()))::date
      AND s.title='BUKLOD Daily Devotion — November 2026' AND d.is_published=true
  ) AND (timezone('Asia/Manila',now()))::date BETWEEN '2026-11-01' AND '2026-11-30' THEN
    RAISE EXCEPTION 'Today''s November daily Word is missing';
  END IF;
  SELECT count(*) INTO invalid
  FROM public.notifications n LEFT JOIN public.devotionals d
    ON d.id::text=n.data->>'devotional_id'
  WHERE n.kind='devotional_reminder'
    AND n.data->>'date' BETWEEN '2026-11-01' AND '2026-11-07'
    AND (d.publish_date IS DISTINCT FROM (n.data->>'date')::date);
  IF invalid<>0 THEN RAISE EXCEPTION 'Stale November in-app devotion notification targets: %',invalid; END IF;
  IF has_function_privilege('anon','public.queue_formation_reminders_v1()','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous caller can dispatch all devotional reminders';
  END IF;
  IF NOT has_function_privilege('authenticated','public.get_my_daily_devotional()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated Cluster members lost devotional RPC access';
  END IF;
  IF position('d.publish_date=v_today' in pg_get_functiondef('public.queue_formation_reminders_v1()'::regprocedure))=0 THEN
    RAISE EXCEPTION 'Reminder worker still falls back to stale dates';
  END IF;
  IF public.ensure_buklod_daily_devotion_schedule((timezone('Asia/Manila',now()))::date)<>1 THEN
    RAISE EXCEPTION 'Word scheduler health gate failed';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.devotionals'::regclass)
      OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.devotional_series'::regclass) THEN
    RAISE EXCEPTION 'Devotional table RLS is no longer enabled';
  END IF;
END;
$word_qa$;
