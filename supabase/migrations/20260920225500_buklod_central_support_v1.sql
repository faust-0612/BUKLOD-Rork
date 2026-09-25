-- BUKLOD Central Support V1 - live BSOC compatibility
--
-- Production already uses public.user_feedback as the canonical support-case
-- store and the BSOC R1-R14 read/action models consume that table.  Do not
-- create a second support store.  This migration makes the existing store
-- safely accept pre-login cases created only by the service-role Edge Function
-- while preserving authenticated RLS and the current BSOC permission model.
--
-- Contract marker: BSOC_USER_FEEDBACK_COMPAT_V1

begin;

-- Pre-login Help may need to create a case before auth exists.  Authenticated
-- clients still cannot insert another user's/null row because the existing
-- "Users insert own feedback" RLS policy requires user_id = auth.uid().
alter table public.user_feedback
  alter column user_id drop not null;

-- Stable public case code for status lookup.  The actual access decision is
-- still enforced by the Edge Function using either the signed-in user id or a
-- hashed per-case access token.
create unique index if not exists idx_user_feedback_support_case_code
  on public.user_feedback ((diagnostics->>'support_case_code'))
  where diagnostics->>'support_case_code' is not null;

-- One client request id can create at most one support case.  This makes retry
-- after timeout/idempotent network replay safe.
create unique index if not exists idx_user_feedback_support_request_id
  on public.user_feedback ((diagnostics->>'support_request_id'))
  where diagnostics->>'support_request_id' is not null;

-- Bounded abuse-protection lookups for the public pre-login Edge Function.
create index if not exists idx_user_feedback_support_ip_created
  on public.user_feedback ((diagnostics->>'support_ip_hash'), created_at desc)
  where diagnostics->>'support_ip_hash' is not null;

create index if not exists idx_user_feedback_support_identifier_created
  on public.user_feedback ((diagnostics->>'support_identifier_hash'), created_at desc)
  where diagnostics->>'support_identifier_hash' is not null;

-- Fast signed-in "My support cases" reads without changing existing generic
-- feedback behavior.
create index if not exists idx_user_feedback_buklod_help_user_created
  on public.user_feedback (user_id, created_at desc)
  where diagnostics->>'support_source' = 'BUKLOD_HELP_V1';

-- Existing production controls remain authoritative:
--   public.buklod_bsoc_support_queue_v1
--   public.buklod_bsoc_support_lookup_v1
--   public.buklod_bsoc_apply_support_case_action_v1
--   public.buklod_bsoc_preview_support_case_action_v1
--   public.buklod_bsoc_record_support_action_audit_v1
--
-- No grants are widened here.  No new public table is introduced.  BSOC
-- continues to authorize operators through its existing RBAC functions.

commit;
