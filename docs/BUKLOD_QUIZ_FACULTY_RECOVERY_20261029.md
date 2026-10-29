# BUKLOD Quiz faculty buttons and stranded-attempt recovery — reconciled production audit

## Incident and exact timeline (Philippine time, 29 October 2026)
- Screenshot: student ADMITTED / NOT STARTED / 0/100 in a new room.
- Actual attempt #3 had already started at 6:49 PM in an older room, which ended at approximately 6:53 PM. It had **0 server-saved answers**, status STARTED and a recovery-required event.
- Student admitted to a later room at 6:55 PM; membership was set REMOVED at 7:06 PM.
- Logs recorded six `Another active attempt already exists for this exam` errors, 6:55–7:08 PM. This is not a network or visual-only error.
- Attempts #1 and #2 are VOID with historical response records preserved. Attempt #3 remains the only STARTED attempt in the ENDED room; no actual attempts or scores were modified by our tests.

## Concurrent migrations — CRITICAL
- `quiz_faculty_safe_reopen_orphan_attempt_r1_20261029` was deployed from concurrent work.
- `quiz_faculty_ended_room_zero_answer_recovery_r2_20261029` was then applied and validated, offering an explicit faculty RESET path for an earlier orphan.
- A subsequent independently deployed `buklod_quiz_premature_empty_submit_and_ended_room_control_guard_r1_20261029` replaced the same RPC with safer current behavior. Never replay the superseded R2 RESET definition.
- This branch's SQL file has been reconciled to **the CURRENT live function definition**, with prominent no-replay guidance. Production migration history remains authoritative.

## Current verified recovery path
- The **REOPEN** action, not RESET ATTEMPT, recognizes an unfinished zero-answer attempt in a prior ENDED room of the same exam/section, if the new room is LIVE, the student is ADMITTED, same question count and snapshot selection mode, same max score, zero saved response rows, and no other STARTED attempt.
- It transfers the SAME attempt ID into the new room and updates its expiry; it does not VOID or duplicate any attempt.
- Rollback-only production E2E passed: attempt ID retained, new room assigned, no extra attempt created, 100 preselected questions preserved, and test transaction entirely rolled back.
- FORCE SUBMIT remains blocked with zero saved answers. Its event count now uses assigned K, not full question bank N.
- Actual student recovery was deliberately **not performed**. Faculty must authorize REOPEN in a valid live room after the student rejoins/is admitted. Historical answers are not erased.

## Faculty button classification
- REMOVE sets room membership and roster status REMOVED; the student's later removal is confirmed in database.
- TROUBLESHOOT UI action is not browser-tested: current standalone Quiz frontend source is not available in connected GitHub repos.
- RESET ATTEMPT requires a current-room attempt. It will reject an orphaned attempt from an old room.
- + ATTEMPT grants a bonus allowance but cannot resolve a cross-room STARTED conflict.
- REOPEN is currently the verified non-duplicating cross-room recovery path under its safeguards.
- SET TIME / ADD TIME / RESET TIMER require a STARTED attempt in the current room.
- FORCE SUBMIT blocks zero saved answers. RELEASE requires an eligible graded attempt; MAKE A REVIEW creates/returns a review job for eligible manual responses.
- Bulk ADMIT ALL changes eligible live membership; FORCE SUBMIT ALL skips zero-answer attempts; RELEASE ALL GRADED handles GRADED only; RESET ALL invokes per-student logic and may reject the entire batch if one member is ineligible.

## Verification scope and limitations
- Database RPC implementation and rollback-only test were verified. No actual browser button tap from `buklod-quiz.expo.app` was performed, so visually disabled states, on-screen confirmation, error presentation, and navigation remain an unverified frontend scope.
- The current REOPEN code rejects existing server response rows but does not itself inspect unconsumed offline leases; assess this safeguard before extending recovery to attempts with offline work.
- No APK, OTA, frontend release, or score modification is part of this source-reconciliation PR.
