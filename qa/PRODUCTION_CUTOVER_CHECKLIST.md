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
