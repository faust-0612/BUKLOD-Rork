-- Retire all direct human-approval RPC exposure for reflection and lesson rewards.
-- Retained stubs are for backward-compatible error messages in privileged audits.
REVOKE EXECUTE ON FUNCTION public.review_daily_bible_reflection_quality_v2(uuid,boolean,text)
  FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.pastor_validate_learning_progress_v2(uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_daily_bible_submission(uuid,boolean,text)
  FROM PUBLIC,anon,authenticated;
