# BUKLOD Quiz — persistent Re-live history / archived room access (2026-10-29)

## Root cause confirmed

The records were not deleted. `buklod_quiz_exam_sections_v2` and `buklod_quiz_prepare_live_session_v1` deliberately look up only sessions with `status <> 'ENDED'`. The standalone Quiz frontend therefore loses the ended room identity when the faculty navigates away and returns, making existing RELIVE controls inaccessible. In the dedicated database the original 3-D room, its `relive_count=1`, historical attempts and the section's old rooms are all retained.

A 3-D student also had a zero-answer STARTED attempt in an ENDED room and was REMOVED from a newer live room. The existing `buklod_quiz_live_student_action_v2('REOPEN')` can explicitly move a compatible orphan attempt but requires current-room membership ADMITTED first. The normal faculty live room listing excludes REMOVED students, so the recovery was not discoverable from existing screens.

## Implemented in dedicated Quiz backend

Deployed:
- `buklod_quiz_faculty_persistent_relive_history_atomic_recovery_r1_20261029`
- `buklod_quiz_faculty_recovery_membership_eligibility_r2_20261029`

Exact source SQL:
- `supabase/pending/BUKLOD_QUIZ_FACULTY_RELIVE_HISTORY_RECOVERY_R1.sql`
- `supabase/pending/BUKLOD_QUIZ_RECOVERY_ELIGIBILITY_MEMBERSHIP_R2.sql`

New owner/examiner-only RPCs:
1. `buklod_quiz_faculty_room_history_v1(p_exam_id, p_section_id?, p_limit?, p_offset?)` — paginated full room history including ENDED, section, join code, RELIVE count, latest flag, whether re-live is currently allowed, removed-member and stranded-attempt counts.
2. `buklod_quiz_faculty_unfinished_recovery_v1(p_exam_id, p_section_id, p_limit?, p_offset?)` — owned-section orphan STARTED attempts from ENDED rooms, student and roster status, current target room/membership, eligibility and blocker reason. Counts and histories remain available even when the student was REMOVED.
3. `buklod_quiz_faculty_recover_unfinished_v1(p_current_session_id, p_student_user_id, p_minutes?)` — explicit faculty-initiated recovery; atomically READMIT + REOPEN existing zero-answer orphan into the LIVE target room through established validated RPC, preserving attempt ID, assigned K questions, scores/answers/history. Requires same exam/section, an existing target room member, compatible question_count, max_score and snapshot mode, no saved responses, and no other STARTED attempts. No automatic recovery.

All SECURITY DEFINER RPCs explicitly validate `auth.uid()`, examiner and exam ownership; revoked PUBLIC/anon EXECUTE, granted authenticated. Recovery uses current faculty ownership, and the existing REOPEN writes a detailed audit event. No existing student, attempt, score or room rows were changed as part of the migrations.

## Verified

- Compiled R1 in rollback-only transaction.
- Rollback-only E2E against actual 3-D fixture passed: unauthorized history access denied, previous RELIVE room found, zero-answer orphan listed, and atomic REOPEN retained exactly the same attempt ID and 100 selected questions with no saved answers or grades changed. Transaction rolled back.
- Both production migrations successfully applied, and post-deployment read-only checks confirmed history and recoverable orphan visibility. R2 corrected `can_recover_to_current` to require an actual membership entry.
- No user recovery was performed as a real production mutation, and no session was re-lived on behalf of the faculty.

## Standalone frontend wiring required (NOT deployed)

The current source of `buklod-quiz.expo.app` is not available in connected GitHub repositories, so **no web UI button or state persistence is claimed fixed**.

Expected client flow:
- On exam/section selection and on return from another screen, fetch `buklod_quiz_faculty_room_history_v1`. Never infer history from current non-ended session only.
- Render **Current Room** for LIVE/PAUSED/WAITING; separately render **Room History / Re-live** for ENDED sessions, with persisted `session_id` and `relive_count`.
- For ENDED rows with `can_relive=true`, wire a confirmed action to the existing `buklod_quiz_live_control_v3(session_id, 'RELIVE')`; then refetch inventory and navigate to that same room. Disabled with reason if a different room is already LIVE/WAITING/PAUSED or section archived.
- Render **Student Recovery** from `buklod_quiz_faculty_unfinished_recovery_v1`, including previously REMOVED students, target LIVE status and reason/eligibility. For eligible rows, add a faculty-confirmed recovery action calling `buklod_quiz_faculty_recover_unfinished_v1`. Never silently reset, void, grade or transfer student attempts.
- In class roster display clearly distinguish `40 Active / 1 Removed` rather than leaving ambiguity between `40` and `40/41`.
- Keep room history and recovery list refetchable from the backend, not only ephemeral navigation state; retain useful saved view across screen exits without using stale global cache as authority.

**Do not replay either already-deployed migration from GitHub CI. No Expo build, APK, OTA, or website deployment occurred.**
