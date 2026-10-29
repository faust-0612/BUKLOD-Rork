# BUKLOD Quiz faculty button and premature timer submission audit — 29 October 2026

## Production incident: Col-long
A 3-D member showed `ADMITTED / NOT STARTED / 0/100` in a stale faculty screenshot. Actual database chronology: attempt 1 started 15:27 PHT and submitted after ~2 seconds with 100 blank responses; attempt 2 was faculty-reset at 18:31 PHT and submitted at 18:39 with 100 blank responses; attempt 3 was faculty-reset at 18:49 and had no saved responses. Student was removed at 18:53 and the room ended shortly afterward. Both earlier attempts are VOID and preserved; attempt 3 remains STARTED with 0 answers for recovery. No automatic grade was assigned to attempt 3.

For attempts 1 and 2, a `TIME_LIMIT_REACHED` event occurred well before the server expiry. This implicates the client countdown/auto-submit path but does not prove its exact UI-level root cause without the current standalone Quiz frontend source.

## Production backend safeguards
Already deployed migrations:
- `buklod_quiz_premature_empty_submit_and_ended_room_control_guard_r1_20261029`
- `buklod_quiz_expired_submit_selected_question_guard_r2_20261029`

Exact sources:
- `supabase/pending/BUKLOD_QUIZ_FACULTY_EARLY_SUBMIT_ENDED_ROOM_GUARDS_R1.sql`
- `supabase/pending/BUKLOD_QUIZ_EXPIRED_SUBMIT_K_OF_N_R2.sql`

The zero-answer guard rejects a premature (server deadline not yet reached) blank submission, leaving the attempt STARTED instead of grading an accidental zero. Expiry remains server-authoritative. On ended rooms, backend refuses Readmit, Remove, Reset Attempt, Allow New Attempt, Reopen, Set Time, Reset Timer, Add Time and corresponding bulk admit/remove/reset/time operations. Post-exam release and review remain independent and supported. Bulk Force Submit already skips attempts with zero saved answers. The expired submit path now fills and scores only the K questions assigned to the attempt, not all N bank questions.

## Verification
- Five RPC function definitions compiled under rollback-only transaction.
- Six rollback-only negative cases passed for early empty submissions and ended-room controls.
- A separate rollback-only E2E simulated expiry with 100 assigned questions from a 400-question bank; exactly 100 responses were processed and no test data persisted.
- Production migration application returned success; deployed function bodies contain the protective guards and selected-question filtering.
- Post-release read-only inspection confirmed Col-long attempt 3 still STARTED, zero saved answers, member REMOVED, room ENDED.
- No student scores, attempts, grades or timers were modified by the migrations.

## Button behavior and frontend gap
- Troubleshoot Student / Troubleshoot: UI-driven diagnostic modal or action; cannot verify actual tap behavior without current standalone frontend code.
- Make a Review: review job RPC for pending manual questions, not a treatment for zero-answer incident.
- Admit All / Remove: membership/roster mutators, now blocked on ended room.
- Force Submit All / Force Submit: only active attempts with server-saved answers should finalize; zero answers are skipped/blocked.
- Release All Graded / Release: works only on eligible graded results, not ongoing attempts or incomplete manual review.
- Reset All / Reset Attempt: creates new STARTED attempts and VOIDs prior attempts, must be used intentionally while a room is active; now blocked on ended rooms.
- +Attempt: grants a further attempt allowance, does not automatically create the student attempt; blocked on ended room.
- Reopen: requires a completed attempt, not already STARTED; now blocked on ended room.
- Set Time / Add Time / Reset Timer: controls on active attempts only, now blocked on ended room.
- Review: read-only or manual faculty review; with 0 answers no student work can be reviewed.
- Faculty v3 room query excludes REMOVED members; stale frontend state may show outdated admitted/not-started. Current `buklod-quiz.expo.app` standalone frontend is not available in the connected GitHub repositories, so timer rendering and button disabled-state UI require that separate source.
- A still STARTED attempt in an ENDED room can block beginning a fresh attempt in a different session; do not automatically void it or invent a grade. Faculty must perform explicit audited recovery/reentry.

**These migrations were already applied to the dedicated Quiz backend. Do not automatically replay them from GitHub CI. No new Android build, Expo OTA or web frontend deployment occurred.**
