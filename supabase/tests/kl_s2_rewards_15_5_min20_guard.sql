-- Read-only staging / RC contract. Do not enable grants or edit rewards.
DO $check$
DECLARE
 v_function text;
 v_trigger_count integer;
 v_rollout record;
BEGIN
 IF to_regclass('private.kl_s2_chapter_pending') IS NULL THEN
  RAISE EXCEPTION 'S2 pending chapter ledger not installed';
 END IF;
 IF to_regprocedure('private.kl_s2_previous_chapter_complete_v1(uuid,uuid)') IS NULL
 OR to_regprocedure('private.kl_s2_reading_session_order_v1()') IS NULL
 OR to_regprocedure('public.kl_s2_chapter_access_v1(uuid)') IS NULL
 OR to_regprocedure('private.kl_s2_rewards_enabled_v1()') IS NULL
 OR to_regprocedure('private.kl_s2_comment_reward_v1()') IS NULL
 OR to_regprocedure('public.kl_reading_progress_v1(uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'KL S2 backend reward functions absent';
 END IF;
 SELECT * INTO v_rollout FROM private.kl_s2_reward_rollout WHERE id=1;
 IF NOT FOUND OR v_rollout.effective_at<'2026-12-06 00:00:00+08'::timestamptz THEN
  RAISE EXCEPTION 'KL S2 rollout schedule missing or unsafe';
 END IF;
 IF now()<'2026-12-06 00:00:00+08'::timestamptz AND v_rollout.enabled THEN
  RAISE EXCEPTION 'Season 2 reward activated before Dec 6';
 END IF;
 IF has_function_privilege('anon','private.kl_s2_comment_reward_v1()','EXECUTE')
 OR has_function_privilege('authenticated','private.kl_s2_comment_reward_v1()','EXECUTE')
 OR has_table_privilege('authenticated','private.kl_s2_reward_rollout','UPDATE')
 OR has_table_privilege('authenticated','private.kl_s2_chapter_pending','INSERT')
 OR has_table_privilege('authenticated','private.kl_s2_chapter_pending','UPDATE') THEN
  RAISE EXCEPTION 'Reward policy bypasses private server trust boundary';
 END IF;
 SELECT pg_get_functiondef('private.kl_s2_comment_reward_v1()'::regprocedure) INTO v_function;
 IF position('char_length(v_body) NOT BETWEEN 20 AND 500' IN v_function)=0
 OR position('kl:comment:s2:' IN v_function)=0
 OR position('v_uid IS DISTINCT FROM auth.uid()' IN v_function)=0
 OR position('e.release_at<=now()' IN v_function)=0 THEN
  RAISE EXCEPTION 'Comment qualifying, identity, release, or idempotency gate missing';
 END IF;
 SELECT count(*) INTO v_trigger_count
 FROM pg_trigger t
 JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE t.tgname='kl_s2_comment_reward_insert'
   AND n.nspname IN ('private','public')
   AND c.relname='kl_episode_comments'
   AND NOT t.tgisinternal
   AND t.tgenabled<>'D';
 IF v_trigger_count<1 THEN
  RAISE EXCEPTION 'No active server-side KL comment reward trigger found';
 END IF;
 SELECT pg_get_functiondef('public.kl_reading_progress_v1(uuid,text)'::regprocedure) INTO v_function;
 IF position('v_chapter_points:=5+v_episode.episode_number' IN v_function)=0
 OR position('previous_chapter_required' IN v_function)=0
 OR position('INSERT INTO private.kl_s2_chapter_pending' IN v_function)=0
 OR position('FOR UPDATE OF pending' IN v_function)=0
 OR position('previous.episode_number=30' IN v_function)=0
 OR position('v_previous_credit:=v_pending_row.reward_bp' IN v_function)=0
 OR position('pending_points' IN v_function)=0 THEN
  RAISE EXCEPTION 'KL S2 progressive chapter reward or sequential gate missing';
 END IF;
END $check$;
