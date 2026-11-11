-- Read-only contract for the KL R4 reward migration. Run after new migrations.
DO $$
DECLARE fn text;
BEGIN
 SELECT pg_get_functiondef('public.kl_reading_progress_v1(uuid,text)'::regprocedure) INTO fn;
 IF position('v_user,10,''kl_episode_completion''' in fn)=0
 OR position('v_user,50,''kl_season_completion''' in fn)=0 THEN
  RAISE EXCEPTION 'KL R4 reward rates not installed';
 END IF;
 IF position('kl_quiz_attempts' in fn)=0
 OR position('v_season_count=30 and v_finished=30' in fn)=0
 OR position('on conflict do nothing' in lower(fn))=0 THEN
  RAISE EXCEPTION 'KL verification, 30 chapter guard or idempotency regressed';
 END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_point_rules
  WHERE activity_type='kl_episode' AND base_points<>10)
 OR EXISTS(SELECT 1 FROM public.buklod_point_rules
  WHERE activity_type='kl_season' AND base_points<>50) THEN
  RAISE EXCEPTION 'KL active catalog amounts inconsistent';
 END IF;
 IF has_function_privilege('anon','public.kl_reading_progress_v1(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous caller may complete a KL chapter';
 END IF;
END $$;
