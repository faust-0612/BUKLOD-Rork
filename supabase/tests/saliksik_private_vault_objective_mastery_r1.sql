-- SALIKSIK R1 DB contract, intended for a local/isolated migrated DB.
BEGIN;
DO $test$
DECLARE n text; v_pub boolean; v_n int;
BEGIN
 SELECT public INTO v_pub FROM storage.buckets WHERE id='saliksik-source-originals';
 IF v_pub IS DISTINCT FROM false THEN RAISE EXCEPTION 'Private source bucket missing'; END IF;
 FOREACH n IN ARRAY ARRAY[
 'saliksik_sources','saliksik_collections','saliksik_investigations','saliksik_question_keys',
 'saliksik_attempts','saliksik_mastery','saliksik_series_mastery','saliksik_rollout'
 ] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
   WHERE s.nspname='public' AND c.relname=n AND c.relrowsecurity=true)
   THEN RAISE EXCEPTION 'RLS missing for %',n; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.saliksik_rollout WHERE member_enabled) THEN
  RAISE EXCEPTION 'Unapproved member launch switch enabled'; END IF;
 SELECT count(*) INTO v_n FROM public.buklod_point_rules WHERE activity_type
 IN ('saliksik_discover','saliksik_investigate','saliksik_master','saliksik_series');
 IF v_n<>4 THEN RAISE EXCEPTION 'Four isolated point rules missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_point_rules WHERE activity_type='saliksik_master'
 AND is_active=true) THEN RAISE EXCEPTION '+35 master must remain disabled'; END IF;
 IF has_table_privilege('authenticated','public.saliksik_question_keys','SELECT') THEN
  RAISE EXCEPTION 'Member can query answer keys directly'; END IF;
 IF has_table_privilege('authenticated','public.saliksik_attempts','INSERT') THEN
  RAISE EXCEPTION 'Member can forge attempts'; END IF;
 IF has_table_privilege('anon','public.saliksik_sources','SELECT') THEN
  RAISE EXCEPTION 'Anonymous raw source leak'; END IF;
END $test$;
ROLLBACK;
