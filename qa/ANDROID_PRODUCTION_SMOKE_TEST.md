# Android Production Smoke Test

Run against the exact production Release Candidate while ordinary users are still
blocked by Production Maintenance Mode.

Build label: ______________________________
EAS build ID/URL: _________________________
Version: __________________________________
Device model: _____________________________
Android version: __________________________
Tester: __________________________________
Date/time: ________________________________

## Binary identity
- [ ] App name is BUKLOD.
- [ ] Package identifier is `org.mzbministry.buklod`.
- [ ] No `STAGING BUILD • TEST DATA ONLY` badge.
- [ ] App icon/splash are correct.
- [ ] App connects to production Supabase, not staging.

## System Admin / maintenance
- [ ] Production System Admin can log in.
- [ ] Ordinary non-admin user sees Maintenance screen.
- [ ] Command Center opens for System Admin only.
- [ ] Non-admin cannot open Command Center RPC/data.

## Authentication
- [ ] Login works.
- [ ] Invalid password is denied.
- [ ] Password reset email works if production email recovery is enabled.
- [ ] Registration works according to final Auth policy.
- [ ] New account remains Member; no self-promotion path.

## Onboarding
- [ ] Verified production church list loads.
- [ ] Pending request blocks full member tabs.
- [ ] Authorized reviewer can approve.
- [ ] Valid BUKLOD group assignment works.
- [ ] Unauthorized reviewer is denied.

## Devotional / privacy
- [ ] Published devotional loads.
- [ ] Completion saves once.
- [ ] Private reflection is visible to owner.
- [ ] Private reflection is not visible to ordinary Leader.
- [ ] Group reflection is scoped correctly.
- [ ] Cross-church member cannot read protected reflection.

## Prayer
- [ ] Private prayer stays private.
- [ ] Group prayer respects group scope.
- [ ] Church prayer respects church scope.
- [ ] Reporting/moderation works.
- [ ] Hidden prayer disappears from ordinary audience.

## Community
- [ ] Group post creation works.
- [ ] Comments/reactions work.
- [ ] Notifications appear.
- [ ] Report Content works.

## Learning
- [ ] Published track loads.
- [ ] Quiz correct-answer flag is not client-readable.
- [ ] Quiz submission is server-graded.
- [ ] Progress saves.

## Church Life
- [ ] Event loads.
- [ ] Announcement loads.
- [ ] Directory privacy setting works.
- [ ] Cross-church directory boundary works.
- [ ] Attendance/self check-in behaves as configured.

## Notifications
- [ ] In-app notification center works.
- [ ] Push permission denial does not block app.
- [ ] Production push notification arrives on approved test device.
- [ ] Push content contains no unnecessary sensitive prayer/pastoral information.

## Privacy / account
- [ ] Privacy Notice contains verified live organization details.
- [ ] Data Rights request can be submitted.
- [ ] Account deletion tested only on approved disposable production-test user.
- [ ] Deleted account is signed out and cannot resume protected access.

## Offline / recovery
- [ ] Offline banner appears in airplane mode.
- [ ] App does not falsely confirm failed server writes.
- [ ] App recovers after reconnection.

## Command Center
- [ ] Exact build is registered as Release Candidate.
- [ ] P0 count is zero.
- [ ] Required readiness checks have real evidence.
- [ ] Human decision is not yet GO LIVE until all store/release gates are complete.

## Result
PASS / HOLD: ______________________________
P0 found: __________________________________
P1 found: __________________________________
Incident IDs: ______________________________
Notes: _____________________________________
