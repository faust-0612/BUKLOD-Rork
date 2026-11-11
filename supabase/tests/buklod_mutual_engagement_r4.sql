-- Source migration history parity (Nov 11, 2026).
-- Read-only contract for R4 rewards; no content or ledger mutation.
DO $$
DECLARE fn text; rollout boolean; enabled boolean;
BEGIN
 IF to_regclass('private.buklod_engagement_r4_rollout') IS NULL
 OR to_regclass('private.buklod_engagement_r4_helpful_comment_state') IS NULL THEN
  RAISE EXCEPTION 'R4 private tables missing';
 END IF;
 SELECT EXISTS(SELECT 1 FROM private.buklod_engagement_r4_rollout WHERE id=1) INTO rollout;
 IF NOT rollout THEN RAISE EXCEPTION 'R4 rollout switch missing'; END IF;
 SELECT pg_get_functiondef(
  'private.buklod_r36_settle_creator_impact_v1(text,uuid,text)'::regprocedure)
 INTO fn;
 IF position('v_r4_progress' in fn)=0
 OR position('greatest(' in fn)=0
 OR position('r4:creator-impact:' in fn)=0 THEN
  RAISE EXCEPTION 'R37 creator impact not integrated with R4';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_trigger WHERE tgrelid='public.comments'::regclass
  AND tgname='zz_buklod_engagement_r4_comment' AND tgenabled<>'D') THEN
  RAISE EXCEPTION 'R4 mutual support trigger unavailable';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM pg_trigger WHERE tgrelid='public.comment_reactions'::regclass
  AND tgname='zz_buklod_engagement_r4_comment_reaction' AND tgenabled<>'D') THEN
  RAISE EXCEPTION 'R4 helpful commenter reward trigger unavailable';
 END IF;
 IF has_function_privilege('anon','private.buklod_engagement_r4_post_bonus_v1(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','private.buklod_engagement_r4_settle_support_chain_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'R4 private reward endpoints exposed'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='private' AND c.relname='buklod_engagement_r4_helpful_comment_state'
  AND c.relrowsecurity
 ) THEN RAISE EXCEPTION 'Private helpful-comment state RLS disabled'; END IF;
END $$;
