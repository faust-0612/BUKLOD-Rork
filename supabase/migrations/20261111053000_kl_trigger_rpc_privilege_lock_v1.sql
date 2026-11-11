-- BUKLOD KL reading quiz privilege hardening. Trigger functions are not RPCs.
-- Keep the existing AFTER INSERT/UPDATE and BEFORE UPDATE trigger attachments intact.
REVOKE ALL ON FUNCTION public.kl_quiz_sync_approval_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kl_quiz_release_ready_guard_v1() FROM PUBLIC, anon, authenticated;
