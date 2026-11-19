-- KL R4 history plus held S2 forward-only verification.
-- Read-only contract; no activation or ledger writes.
DO $$
DECLARE fn text; v_s2_enabled boolean:=false; v_expected int:=10;
BEGIN
 SELECT pg_get_functiondef('public.kl_reading_progress_v1(uuid,text)'::regprocedure) INTO fn;
 IF to_regprocedure('private.kl_s2_rewards_enabled_v1()') IS NOT NULL THEN
  v_s2_enabled:=private.kl_s2_rewards_enabled_v1();
  IF position('v_user,v_chapter_points,''kl_episode_completion''' in fn)=0
     OR position('v_chapter_points integer:=10' in fn)=0
     OR position('v_chapter_points:=15' in fn)=0
     OR position('v_chapter_awarded then v_chapter_points else 0' in fn)=0 THEN
   RAISE EXCEPTION 'KL S2 +15 award / preactivation +10 / accurate receipt missing';
  END IF;
  IF v_s2_enabled THEN v_expected:=15; END IF;
 ELSE
  IF position('v_user,10,''kl_episode_completion''' in fn)=0 THEN
   RAISE EXCEPTION 'KL legacy verified +10 reward missing';
  END IF;
 END IF;
 IF position('v_user,50,''kl_season_completion''' in fn)=0 THEN
   RAISE EXCEPTION 'KL series +50 reward missing';
 END IF;
 IF position('kl_quiz_attempts' in fn)=0
    OR position('v_season_count=30 and v_finished=30' in fn)=0
    OR position('on conflict do nothing' in lower(fn))=0 THEN
  RAISE EXCEPTION 'KL quiz, series completeness or idempotency regressed';
 END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_point_rules
  WHERE activity_type='kl_episode' AND base_points<>v_expected)
 OR EXISTS(SELECT 1 FROM public.buklod_point_rules
  WHERE activity_type='kl_season' AND base_points<>50) THEN
  RAISE EXCEPTION 'KL reward catalog inconsistent with activated policy';
 END IF;
 IF has_function_privilege('anon','public.kl_reading_progress_v1(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'Anonymous caller may complete a KL chapter';
 END IF;
END $$;
