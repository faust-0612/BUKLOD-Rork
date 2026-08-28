# BUKLOD Pilot Rollout Plan

## Principle

Do not move to a wider group simply because the app "works." Move only when privacy,
authorization, data integrity, and core ministry workflows have passed the previous
gate.

## Phase 0 — Technical/Staging Gate

Participants: developer/admin QA only.

Required:
- all SQL migrations apply cleanly to a fresh local/staging database
- `supabase test db` passes
- Jest tests pass
- Expo Doctor has no unresolved launch blocker
- Android preview build installs
- account deletion is tested with a disposable user
- no client-side secret key
- privacy placeholders are replaced before any real-member pilot

Exit gate: zero open P0 defects.

## Phase 1 — Internal Leadership Pilot

Suggested size: 8–15 trusted internal testers representing:
- ordinary member
- group leader
- pastor
- local admin
- system admin

Duration: approximately 5–7 days.

Focus:
- role boundaries
- onboarding approvals
- devotional/reflection privacy
- prayer privacy
- pastoral follow-up
- moderation
- notifications
- offline behavior

No real sensitive pastoral notes during this stage; use test data.

Exit gate:
- zero P0
- no more than two accepted/mitigated P1 defects
- all privacy/RLS tests passed
- tester sign-off

## Phase 2 — One Local Church Pilot

Suggested size: 30–60 consenting members in one local church.

Duration: approximately 2 weeks.

Enable:
- devotional
- prayer
- BUKLOD community
- announcements
- basic events
- learning tracks

Keep higher-risk features limited:
- pastoral notes only for trained pastoral users
- visitor data only for authorized users
- no broad analytics publication

Measure:
- successful sign-in/onboarding
- daily active use
- push delivery success
- support tickets
- privacy misunderstandings
- accidental oversharing
- crashes
- leader workload

Exit gate:
- no unresolved privacy/security P0/P1
- support process can handle real users
- written pilot retrospective completed

## Phase 3 — Multi-Church Pilot

Suggested size: 100–250 members across 2–4 local churches.

Focus:
- cross-church isolation
- church/group analytics
- scaling of real-time community
- notification volume
- admin workload
- visitor/member-care separation
- backup and restore

Run the cross-church RLS matrix again with production-like staging data.

## Phase 4 — Production Rollout

Prerequisites:
- production privacy notice approved
- official privacy contact published
- retention schedule approved
- backup/restore drill passed
- store privacy declarations completed accurately
- production Auth/email/CAPTCHA/rate-limit settings reviewed
- P0/P1 defect gate passed
- rollback owner named

Prefer staged rollout rather than immediately enabling every ministry and every feature
for all users.

## Stop/Rollback Triggers

Pause expansion immediately for:
- private reflection/prayer leakage
- cross-church data leakage
- unauthorized pastoral-note access
- privilege escalation
- incorrect account deletion
- widespread login failure
- data corruption
- notification disclosure of sensitive content
- repeated crashes blocking core use

A rollback decision should prioritize member privacy and data integrity over maintaining
feature availability.
