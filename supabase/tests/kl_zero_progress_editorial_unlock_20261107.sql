-- Non-destructive schema-contract regression for editorial zero-progress unlock.
-- Execute against a database with the target KL migration already applied.
BEGIN;
DO $test$
DECLARE
  v_guard text;
BEGIN
  SELECT pg_get_functiondef('public.kl_admin_unlock_unread_release_v1(uuid)'::regprocedure)
  INTO v_guard;

  IF position('v_actor IS NULL' IN v_guard) = 0
    OR position('system_admin' IN v_guard) = 0
    OR position('is_active = true' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'KL editorial guard no longer enforces active system-admin authorization';
  END IF;
  IF position('v_episode.release_at IS NULL' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'KL editorial guard must retain unreleased chapter no-op';
  END IF;
  IF position('coalesce(s.ping_count, 0) > 0' IN v_guard) = 0
    OR position('s.completed_at IS NOT NULL' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'KL guard must protect verified reader progress and completion';
  END IF;
  IF position('public.kl_story_achievements' IN v_guard) = 0
    OR position('public.kl_episode_comments' IN v_guard) = 0
    OR position('public.buklod_points_ledger' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'KL guard must protect comments, achievements and points ledger';
  END IF;
  IF v_guard ~* 'delete[[:space:]]+from[[:space:]]+public[.]kl_reading_sessions' THEN
    RAISE EXCEPTION 'KL editor must never erase original reading sessions';
  END IF;
  IF position('INSERT INTO public.kl_admin_audit' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'KL editorial reopen must retain an audit record';
  END IF;
  RAISE NOTICE 'KL zero-progress guard contract: PASS';
END;
$test$;
ROLLBACK;
