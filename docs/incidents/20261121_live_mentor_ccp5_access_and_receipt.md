# BUKLOD MAIN: live mentoring and CCP5 report incident — 2026-11-21

## Scope / release isolation
User report from the live Android app: teaching-report lesson picker is empty and a member says CCP5 Lesson 2 answers are not reflected. **Production database, production APK, and production OTA must remain unchanged by this DEV work.** Do not merge these changes directly into production, bypass release gates, or enable mentor capabilities in bulk.

## Observed facts (privacy-safe read-only checks)
- The production mentor teaching catalog RPC returns `[]` when `public.has_capability(actor,'mentor')` is false.
- The production lesson catalog contains 68 CCP/discipleship lessons (21 CCP, 47 discipleship).
- CCP 5 lessons 1, 2, and 3 are published and content-ready.
- There are zero active mentor capability grants; five historical mentor capabilities are inactive.
- Exactly one active mentor-to-learner relationship exists; its mentor is the protected official System Admin identity (role `system_admin`), so it must **not** be auto-promoted into a rewarded mentor.
- A privacy-minimized prefix lookup from the support screenshot matched **two** active profiles. Neither has an active mentor permission or assigned learners, and neither has a CCP5 Lesson 2 response/progress record in the legacy learning tables. This is **not sufficient** to identify the correct account or prove whether text was entered but not submitted.
- No relevant mentor role activation/deactivation audit entry was found in the examined legacy audit tables. The reason for historical inactivation is unknown.

## DEV changes in this isolated branch
1. Mentor report UI distinguishes permission revoked, empty course catalog, search miss, and network failure, and offers retry. Submission remains server-authorized.
2. Reportable lesson display now combines track title, lesson sequence and title, so `CCP5` and `CCP 5` searches find the correct lesson after migration.
3. Admin mentor assignment no longer equates a relationship with active mentor permission. Only explicit System Admin review can activate non-protected member permission, with a reason, an idempotent request key and private audit.
4. Server-side guard blocks activating the protected official/System Admin as mentor even through legacy direct capability updates.
5. Learner Quick Check now queries the current account's saved response, distinguishes unsaved typed answers, requires a server receipt before confirming a saved completion, and keeps a committed submission successful if the subsequent dashboard refresh fails.

## Outstanding release blockers
- **No isolated BUKLOD MAIN staging database is available** from the connected Supabase account. Do not apply the two migrations to the live database as an experiment or create a paid project/branch for zero-budget work.
- Source-level checks passed, but the Node test suite, SQL migrations, RLS negative-path cases, actual concurrent RPC calls, and Android device behavior remain unverified.
- The screenshot name prefix matches two profiles; establish the affected account through a trusted admin identity lookup using its verified phone/email before any individual permissions or historical data are changed.
- Investigate whether the learner actually tapped `COMPLETE LESSON`, received an RPC receipt, and saw a status/error. Input text without a server receipt cannot be treated as submitted.
- Never mint BP from historical responses, invent lesson completion, or give rewards to the protected official identity.

## Required staged acceptance checks
- Migrate and test the catalog on an isolated, nonproduction database with source-complete CCP5 content.
- Assert unauthenticated/ordinary member cannot invoke the mentor admin capability RPC; system admin can explicitly grant only an eligible, active non-protected member.
- Direct table update, RPC update, and account role changes cannot activate mentor for the protected official identity.
- Verify audit reason, grant actor, request idempotency, revoke, repeated request, distinct request-key reuse, and concurrent updates.
- A verified mentor with a real assigned learner can search `CCP5` and `CCP 5`, select Lesson 2, attach consented private evidence and submit exactly once; unauthorized user cannot submit.
- Existing lesson responses, previous approvals, BP ledger, QMP and audit logs remain unaltered.
- Simulate incomplete validation, weak network, expired session, save success followed by UI refresh failure, reopen, and duplicate submission retries.
- Run `node --test tests/mentor-report-selector-access-20261121.test.mjs tests/buklod-points-r2-live-integration.test.mjs`, focused UI verification on Android, and standing Ads/navigation/compact-spacing gates.
- Merge only through the verified consolidated DEV → RC → Production OTA release process. Record exact native runtime/build and production smoke evidence.

## Current status
**PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS.** Code and draft migrations exist on isolated DEV; no database migration was executed and no production behavior has changed.
