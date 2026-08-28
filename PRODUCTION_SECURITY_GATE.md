# BUKLOD Production Security Gate

The following are launch blockers, not optional polish.

## Identity & access
- [ ] Separate development, staging, and production Supabase projects.
- [ ] No secret/service-role key in Expo source, browser bundle, Git history, screenshots, or docs.
- [ ] RLS reviewed for every public table.
- [ ] Separate test accounts for member, leader, pastor, local_admin, system_admin.
- [ ] System-admin account protected with strong MFA outside the app as well.
- [ ] Self-registration cannot grant privileged roles.
- [ ] Deactivated users lose intended access.

## Privacy
- [ ] Final PIC/controller name confirmed.
- [ ] Official privacy/DPO contact inserted.
- [ ] Final organization address inserted where required.
- [ ] Privacy notice reviewed by responsible privacy/legal lead.
- [ ] Data inventory completed.
- [ ] Retention schedule approved.
- [ ] Data-subject request owner/process defined.
- [ ] Account deletion tested.
- [ ] Visitor consent language reviewed.
- [ ] Pastoral note policy approved.
- [ ] No health/medical or highly intimate data requested unless genuinely necessary and properly governed.

## Abuse & moderation
- [ ] Auth rate limits reviewed.
- [ ] CAPTCHA/bot protection configured for registration if needed.
- [ ] Community reporting tested.
- [ ] Moderator access tested.
- [ ] Hidden content disappears from ordinary audiences.
- [ ] Moderation actions are auditable.

## Reliability
- [ ] Preview build tested on at least two Android devices.
- [ ] iOS preview/TestFlight tested before iOS production release.
- [ ] Poor-network/offline behavior tested.
- [ ] Push-token retry tested after reconnection.
- [ ] Notification permission denial tested.
- [ ] App recovers from route/component error.
- [ ] App icon/splash verified in preview or production build.

## Database
- [ ] Supabase Production Checklist reviewed.
- [ ] SSL Enforcement enabled.
- [ ] Network Restrictions considered/configured.
- [ ] Backups verified.
- [ ] Restore procedure documented and tested.
- [ ] PITR decision documented.
- [ ] Security Advisor reviewed.
- [ ] Migration rollback/recovery plan exists.

## Store release
- [ ] Android application ID final.
- [ ] iOS bundle identifier final.
- [ ] App name final.
- [ ] App icon approved.
- [ ] Store screenshots prepared.
- [ ] Privacy declarations completed accurately.
- [ ] Account deletion path demonstrated.
- [ ] Support/contact information published.
- [ ] Internal pilot completed before public rollout.


## v10 QA evidence
- [ ] `npm test` passed on release candidate.
- [ ] `supabase test db` passed on release candidate schema.
- [ ] Expo Doctor passed or all warnings are formally accepted.
- [ ] Android Maestro smoke workflow passed.
- [ ] iOS Maestro smoke workflow passed before iOS public release.
- [ ] Every P0 row in `qa/TEST_MATRIX.csv` passed.
- [ ] Defect log contains zero open P0 items.
- [ ] Pilot UAT sign-off completed.


## Pilot operations
- [ ] Runtime controls cannot be changed by non-system-admin accounts.
- [ ] System Admin bypass tested before enabling maintenance/pilot locks.
- [ ] Feature flags are treated only as rollout controls, never authorization controls.
- [ ] Pilot access is separate from church membership/role authorization.
- [ ] Feedback diagnostics contain no prayer/reflection/pastoral-note text or credentials.
- [ ] Version-blocking is enabled only after a replacement build is available.


## Pilot content
- [ ] Support articles do not promise privacy/access behavior that differs from tested RLS.
- [ ] Checklist progress is not treated as spiritual/ministry performance.
- [ ] Seeded devotional/discipleship content reviewed before production.
- [ ] Announcement templates contain no confidential information.
- [ ] Pilot support screenshots are redacted when they contain personal data.


## Go-Live Command Center
- [ ] Non-system-admin accounts cannot read incident/readiness/decision records.
- [ ] P0 incident automatically blocks advisory readiness.
- [ ] Required failed/not-checked readiness item blocks advisory readiness.
- [ ] Approved Release Candidate is exact binary/build actually tested.
- [ ] Rollout decision always contains written human rationale.
- [ ] External crash monitoring status is not represented as connected unless actually configured.


## v15 production cutover
- [ ] Production Supabase project is not the staging project.
- [ ] Production EAS variables do not contain staging Supabase URL/key.
- [ ] Production client uses a publishable key only.
- [ ] Staging seed is excluded from production push.
- [ ] Production cutover requires reviewed dry-run and typed confirmation.
- [ ] First production System Admin bootstrap is performed once and audited.
- [ ] Production launches from Maintenance Mode only after smoke tests and Command Center approval.
