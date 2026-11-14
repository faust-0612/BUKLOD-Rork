-- Run on ephemeral migrated SQL database; not on production.
BEGIN;
DO $test$
DECLARE n int;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='public' AND c.relname='saliksik_master_submissions' AND c.relrowsecurity)
 THEN RAISE EXCEPTION 'Written submissions must be RLS-enabled'; END IF;
 IF has_table_privilege('authenticated','public.saliksik_master_submissions','SELECT')
  OR has_table_privilege('authenticated','public.saliksik_master_submissions','INSERT')
  OR has_table_privilege('anon','public.saliksik_master_submissions','SELECT')
 THEN RAISE EXCEPTION 'Private written answers are directly accessible'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_point_rules WHERE activity_type='saliksik_master'
 AND is_active=true AND base_points=35 AND max_points_per_event>=35)
 THEN RAISE EXCEPTION 'Source-verified Master rule not active after R2'; END IF;
 IF EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE member_enabled)
 THEN RAISE EXCEPTION 'Member rollout must remain disabled by default'; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public' AND p.proname IN (
 'saliksik_master_submit_v1','saliksik_master_get_v1','saliksik_admin_master_review_v1',
 'saliksik_admin_master_queue_v1','saliksik_master_score_v1');
 IF n<>5 THEN RAISE EXCEPTION 'Written Master RPC contracts missing'; END IF;
END $test$;
ROLLBACK;
