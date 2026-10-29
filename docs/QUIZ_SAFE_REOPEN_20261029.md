# BUKLOD Quiz — Faculty REOPEN orphaned zero-answer attempt (2026-10-29)

## Confirmed incident
Faculty view displayed an admitted student as NOT STARTED in the latest LIVE 3-D room. The student had three exam attempts from a prior room: two VOID attempts with 100 saved response rows each (audited history retained), and a third STARTED zero-response attempt. The third attempt was linked to an ENDED room; the latest LIVE room had an ADMITTED membership but no local attempt. Student start RPC rejects cross-room STARTED attempts with "Another active attempt already exists for this exam"; observed repeatedly in PostgreSQL logs.

## Already-applied production backend correction
Dedicated Quiz database migration: `quiz_faculty_safe_reopen_orphan_attempt_r1_20261029`.
Exact source: `supabase/pending/BUKLOD_QUIZ_SAFE_REOPEN_ORPHAN_R1.sql`.

When an authorized examiner clicks **REOPEN** in the new LIVE room, and there is no current-room attempt, the RPC may recover exactly one previous STARTED attempt from an ENDED room, provided:
- Same student, exam, section, question-selection mode, item count, and maximum score;
- Student is ADMITTED in the current LIVE room;
- Previous attempt has zero saved response rows;
- No other STARTED attempt exists for that exam;
- The previous attempt is locked and the room reference is updated atomically;
- The same attempt ID and question assignment are retained, no extra attempt or VOID is made;
- Time extension is an explicit faculty REOPEN action; an audit event records prior/current room and duration.

If any condition fails, the RPC raises a clear error without changing grades, responses, attempts, or student membership. Existing REOPEN behavior for a completed attempt in the current room is left intact.

Force-submit diagnostics were also corrected to count the actual per-attempt assigned K questions, not the full N-question bank. Zero-answer force submission remains blocked.

### Verification
- Pre-release rollback-only E2E using the affected case: existing attempt ID retained; room reassignment possible; zero saved responses remain zero; audit event recorded; no extra attempt. Passed.
- Post-release production-runtime rollback-only E2E: passed; all test writes rolled back.
- Final read-only check: production function installed; affected student attempt remained STARTED in its old room with zero saved responses; current LIVE room retained ADMITTED membership. No actual student attempt, grades or timer was changed by this release.
- All faculty controls are state-dependent. The standalone `buklod-quiz.expo.app` frontend source is not present in the connected repositories, so button tap wiring cannot be asserted verified in a real browser. The visible REOPEN action is expected to call `buklod_quiz_live_student_action_v2` but actual site wiring must be confirmed with its source or authorized UI.

Do not replay the migration from this GitHub PR. This PR only reconciles the already-deployed source and release record. No Android APK, Expo OTA, or standalone web deployment was performed.
