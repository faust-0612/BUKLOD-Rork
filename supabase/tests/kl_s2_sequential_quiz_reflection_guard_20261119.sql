-- Read-only SQL verification. Execute only on an ISOLATED Season2 staging database
-- AFTER installing both KL S2 migrations. Never execute on production Season1.
DO $check$
DECLARE
 v_fn text;
 v_enabled boolean;
 v_effective timestamptz;
BEGIN
 IF to_regclass('private.kl_s2_series_reflections') IS NULL
   OR to_regprocedure('public.kl_s2_reader_progress_v1(integer)') IS NULL
   OR to_regprocedure('public.kl_s2_series_reflection_status_v1(integer)') IS NULL
   OR to_regprocedure('public.kl_s2_submit_series_reflection_v1(integer,text)') IS NULL THEN
   RAISE EXCEPTION 'Missing KL S2 reading/reflection functions or private receipts';
 END IF;
 IF (SELECT NOT relrowsecurity FROM pg_catalog.pg_class
     WHERE oid='private.kl_s2_series_reflections'::regclass)
   OR has_table_privilege('anon','private.kl_s2_series_reflections','SELECT')
   OR has_table_privilege('authenticated','private.kl_s2_series_reflections','SELECT')
   OR has_table_privilege('authenticated','private.kl_s2_series_reflections','INSERT') THEN
   RAISE EXCEPTION 'KL S2 reflection private rows exposed';
 END IF;
 IF has_function_privilege('anon','public.kl_s2_reader_progress_v1(integer)','EXECUTE')
   OR has_function_privilege('anon','public.kl_s2_series_reflection_status_v1(integer)','EXECUTE')
   OR has_function_privilege('anon','public.kl_s2_submit_series_reflection_v1(integer,text)','EXECUTE') THEN
   RAISE EXCEPTION 'KL S2 public anonymous reflection RPC exposure';
 END IF;
 SELECT enabled,effective_at INTO v_enabled,v_effective
 FROM private.kl_s2_reward_rollout WHERE id=1;
 IF NOT FOUND OR v_effective<'2026-12-06 00:00:00+08'::timestamptz
   OR (now()<'2026-12-06 00:00:00+08'::timestamptz AND v_enabled) THEN
   RAISE EXCEPTION 'Season2 activation date not protected';
 END IF;
 SELECT pg_get_functiondef('public.kl_reading_progress_v1(uuid,text)'::regprocedure)
 INTO v_fn;
 IF position('OR v_s2_enabled' IN v_fn)=0
   OR position('AND NOT v_s2_enabled then' IN v_fn)=0
   OR position('a.verified_at IS NOT NULL' IN v_fn)=0 THEN
   RAISE EXCEPTION 'S2 still allows timer-only completion or premature series bonus';
 END IF;
 SELECT pg_get_functiondef('public.kl_s2_submit_series_reflection_v1(integer,text)'::regprocedure)
 INTO v_fn;
 IF position('char_length(v_text) NOT BETWEEN 50 AND 2000' IN v_fn)=0
   OR position('v_count<>30' IN v_fn)=0
   OR position('ON CONFLICT (user_id,season_number) DO NOTHING' IN v_fn)=0
   OR position('FOR UPDATE' IN v_fn)=0
   OR position('v_user,50' IN v_fn)=0 THEN
   RAISE EXCEPTION 'KL finale personal reflection or idempotent award guard missing';
 END IF;
 SELECT pg_get_functiondef('public.kl_read_episode_v1(uuid)'::regprocedure)
 INTO v_fn;
 IF position('private.kl_s2_previous_chapter_complete_v1(auth.uid(),p_episode_id)' IN v_fn)=0
    OR position('previous_chapter_required' IN v_fn)=0 THEN
   RAISE EXCEPTION 'Legacy reading RPC can return locked chapter manuscript';
 END IF;
 SELECT pg_get_functiondef('public.kl_episode_media_v1(uuid)'::regprocedure)
 INTO v_fn;
 IF position('private.kl_s2_previous_chapter_complete_v1(auth.uid(),p_episode_id)' IN v_fn)=0 THEN
   RAISE EXCEPTION 'Legacy media RPC can expose locked chapter storage paths';
 END IF;
END $check$;
