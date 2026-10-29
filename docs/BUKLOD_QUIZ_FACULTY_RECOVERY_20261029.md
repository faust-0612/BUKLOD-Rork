# BUKLOD Quiz faculty recovery and controls audit (2026-10-29)

## Confirmed issue
A student with a zero-answer STARTED attempt in an ENDED room was admitted into a newly created room but appeared as ADMITTED / NOT STARTED / 0/100. The prior STARTED attempt was still enforced by `buklod_quiz_live_start_attempt_v1` as a conflicting active attempt. Server logs confirmed six `Another active attempt already exists for this exam.` errors between 10:55 and 11:08 UTC.

The student had 3 attempts in this exam: #1 and #2 VOID (historical response records preserved), and #3 STARTED in an ended room with zero saved answers and `LIVE_CLASS_ENDED_ZERO_ANSWER_RECOVERY_REQUIRED`. The new-room membership was later marked REMOVED. No attempt or roster was changed during inspection.

## Targeted production patch
Applied dedicated Quiz DB migration `quiz_faculty_ended_room_zero_answer_recovery_r2_20261029`.

`buklod_quiz_live_student_action_v2` now lets **faculty explicitly** choose RESET_ATTEMPT for a student who has no attempt in the current LIVE room but has exactly one eligible zero-answer STARTED attempt stranded in a prior ENDED room. Required: student already ADMITTED, old room ENDED, zero saved answers, explicit recovery event, no pending offline lease, no other non-VOID official attempt. The old attempt is VOID-audited, its history preserved, and a new K-of-N snapshot-backed attempt is started in the current room. This is not an automatic reset and does not modify grades or answers without faculty action.

The same targeted patch makes FORCE_SUBMIT's event expected-count use the attempt-assigned K questions instead of full bank N. Zero-answer force-submission continues to be blocked.

## Evidence
- Before deployment: rollback-only function SQL compiled; an E2E on a temporary membership in a valid LIVE room passed, with fresh 100-question assignment and exactly one old attempt voided.
- Deployment succeeded through Supabase migration.
- After deployment: production-runtime rollback-only E2E passed, including new attempt, stable assigned-question count, and protection against zero-answer force-submit.
- All temporary attempts, memberships and roster changes were rolled back; actual student records are unchanged.

## Faculty button behavior findings
- REMOVE changes both live member and exam roster to REMOVED. Affected student was recorded REMOVED after the screenshot.
- RESET ATTEMPT previously failed when no current-room attempt existed, even if another ended room held a stranded STARTED attempt. Now handles narrowly eligible cross-room recovery when the faculty presses it in a LIVE room.
- + ATTEMPT grants allowance only, not cross-room conflict resolution.
- REOPEN requires a completed attempt in the same room; timer controls require STARTED attempt.
- FORCE SUBMIT requires at least one server-saved answer; RELEASE requires eligible graded submission.
- Bulk FORCE SUBMIT skips zero-answer attempts; RELEASE ALL handles only GRADED; bulk RESET uses per-student function and may fail atomically if any member is ineligible.
- Faculty UI buttons are rendered by the standalone `buklod-quiz.expo.app` frontend; its current source is not in connected GitHub repositories. The backend was validated but no claim that disabled-button states, toast feedback, and actual browser clicks have been E2E tested.

**Do not replay already applied database migration via CI or merge.** No Android OTA or website deployment is part of this source reconciliation.
