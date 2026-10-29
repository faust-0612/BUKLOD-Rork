# BUKLOD Quiz — Configured K-of-N question assignment R1 (2026-10-29)

## Production status
- **Dedicated Quiz database:** deployed successfully using Supabase migration `20261029045800_buklod_quiz_configured_k_of_n_snapshot_r1_20261029`.
- **Database project:** dedicated BUKLOD Quiz (not the BUKLOD Main Supabase project).
- **GitHub:** `supabase/pending/quiz_k_of_n/{00..08}_*.sql` holds the exact source SQL used in the applied migration. The folder name is historical source organization, not a pending production action.
- **Android APK / OTA / web frontend:** unchanged. This is an existing RPC backend change. No new native build required.
- **Automatic switch-on:** only newly prepared live rooms having `settings_snapshot.question_selection_mode = SNAPSHOT_R1`. Old rooms and old attempts keep legacy behavior.

## Contract

The configured `question_count=K` is read from `p_settings` of `buklod_quiz_prepare_live_session_v1`. The active question bank contains `N` eligible items, and **1 <= K <= N** is required.

- Shuffle ON: server chooses K distinct questions per attempt using deterministic hash of question ID plus attempt ID, and persists the selection and order in `private.buklod_quiz_attempt_questions_r1`.
- Shuffle OFF: takes the first K active questions in bank order; all students get the same set.
- Resume/refresh/reopen: same attempt ID and stored selection, without re-randomizing. An explicitly fresh attempt or retake gets a new selection.
- Equal point values are required for random subsets (K<N) until a difficulty/weight-stratified sampler is developed. The rule prevents different students receiving unequal possible maximum scores.
- No extra/unassigned answers: both student save RPCs, submission RPCs and a database trigger reject foreign question IDs. Missing answer rows are filled only for assigned questions.
- Grading denominator uses the sum of points of the assigned K questions. Results, faculty room totals, faculty attempt analysis and released-student reviews use assigned questions.
- Old attempts have no assignment rows and continue unchanged. No backfill. No existing grades, student answers, history, or deduction rules were updated.

## Verification performed

1. Production source and table dependencies inspected before editing. Root issue: existing preflight overwrote K with full bank N; existing student RPC shuffled **all** active questions, and submit/review counted all questions.
2. 200-bank / 100-item independent deterministic selection simulation: 100 unique per attempt; 46 overlapping among two simulated attempts; zero difference on refresh.
3. 37-bank / 12-item independent simulation: 12 unique and no changes on refresh.
4. All nine coordinated SQL files compiled inside a single rollback-only transaction before production release.
5. **Pre-production rollback-only E2E against the real dedicated database:** prepare a temporary 37-item room against a 400-item bank, create a temporary attempt, check exactly 37 persisted assignments, stable repeated fetch, reject unassigned answer, save a valid answer, submit 37 responses and verify exact max points. Passed and rolled back completely.
6. **Actual production migration:** success returned and migration history records version `20261029045800`.
7. **Post-deployment rollback-only E2E against the newly installed functions:** all same behaviors passed. Test attempt and session were rolled back.
8. Final read-only check: snapshot table exists with 0 assigned rows (as expected before new attempts), 0 integrity deduction rows, and 0 unexpired STARTED attempts in LIVE/PAUSED rooms.

## Scope and release notes

- The earlier visible 400-item room really had 400 active questions and was configured with `question_count=400`. Historical results must **not** be truncated retroactively.
- The new K-of-N backend is live. The standalone hosted Quiz frontend source is not present in BUKLOD-Rork, so the exact web form payload could not be inspected in GitHub and browser access from this environment was unavailable. A faculty-operated next-session UI check is still necessary to confirm that the existing Item Count form submits `p_settings.question_count` and displays it correctly. The backend handles correctly formatted requests.
- If the web form does not forward `question_count`, the server safely defaults to the full bank; changing that separate frontend requires its authoritative source.
- The integrity monitoring/deduction modernization and AI assessment generator from a separate DEV branch are independent and not included in this deployment.
- Do not deploy these SQL scripts a second time from CI. Supabase migration history is authoritative; compare with that record before future migrations.
