# BUKLOD Production Cutover Checklist

This checklist starts only after the staging pilot has passed its required gates.

## 48–72 hours before cutover
- [ ] Final production Privacy Notice contains verified organization/privacy contact details.
- [ ] Production Supabase project is separate from staging.
- [ ] Production environment variables point only to production Supabase.
- [ ] Production migration dry-run reviewed.
- [ ] No staging seed/demo user data will be pushed to production.
- [ ] Approved release candidate is registered in the Command Center.
- [ ] Zero unresolved P0 incidents.
- [ ] Every required Go-Live check is PASS.
- [ ] Open P1 incidents have explicit resolution/accepted-risk decision.
- [ ] Account deletion tested on disposable staging account.
- [ ] Backup/restore procedure tested.
- [ ] Support/escalation owner confirmed.
- [ ] Store/privacy declarations match actual app behavior.

## Database cutover
- [ ] Take/document pre-change backup state.
- [ ] Run `supabase db push --dry-run` against production.
- [ ] Review migration list one final time.
- [ ] Run `supabase db push` WITHOUT staging seed.
- [ ] Deploy `push` and `delete-account` Edge Functions.
- [ ] Configure production notifications webhook.
- [ ] Verify RLS/security tests against production-equivalent staging schema.

## Application build
- [ ] Production app label is BUKLOD, not BUKLOD Staging.
- [ ] Production identifier is `org.mzbministry.buklod`.
- [ ] Production EAS environment contains production public Supabase values.
- [ ] Final Android/iOS build ID/URL recorded as Release Candidate.
- [ ] Approved candidate matches the binary submitted/distributed.

## Smoke test after deployment
- [ ] Login
- [ ] New member registration
- [ ] Church approval/onboarding
- [ ] Devotional
- [ ] Private reflection isolation
- [ ] Prayer privacy
- [ ] Community
- [ ] Notifications
- [ ] Learning
- [ ] Church Life
- [ ] Account deletion test only with approved disposable production-test account if policy allows
- [ ] Admin access and Command Center

## Final decision
- [ ] System Admin/authorized rollout lead opens Go-Live Command Center.
- [ ] Advisory readiness is READY FOR FINAL SIGNOFF.
- [ ] Human reviewer records GO LIVE with rationale and exact Release Candidate.
- [ ] Launch time and rollback owner recorded outside the app as well.

## Development-to-production performance isolation gate
- [ ] Source editing, GitHub commits, and CI builds do not invoke production database migrations, seed jobs, load tests, or data backfills.
- [ ] DEV/staging tests use a distinct Supabase project and non-production credentials; production secrets are never used for preview/test jobs.
- [ ] Inspect CI workflow triggers and environment bindings before enabling any automated production operation.
- [ ] Production migrations/backfills require an explicit release window, backup/recovery plan, lock/timeout review, and measured query impact.
- [ ] Check production database CPU/connection saturation, slow queries, and API latency before attributing app lag to development activity.
- [ ] Avoid aggressive refresh/polling; deduplicate safe reads and preserve authentication, mutations, and RLS isolation.
- [ ] OTA RC verification uses a frozen artifact and records its runtime and production channel; do not force reload during an active user operation.
- [ ] If performance metrics are unavailable or monitoring times out, mark the performance gate UNVERIFIED rather than declaring production healthy.
