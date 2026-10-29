# BUKLOD Quiz — Class Join, Roster, and Archival (29 Oct 2026)

Production Quiz backend release:
- `buklod_quiz_class_alias_and_safe_archive_r1_20261029` applied and verified.
- `quiz_faculty_class_inventory_all_roster_statuses_r1_20261029` applied and verified.

## Root cause and resolution
The old `3F` and current `3-F` had separate class IDs in the same exam. The class-code join rejected matching labels because it compared punctuation literally. Live code `B678B5` was valid. The faculty Consolidated Records page counts ACTIVE roster members only; removing a student for reentry retains their `REMOVED` roster row and historical attempts.

The deployed join backend now accepts normalized same-exam aliases, but still rejects unrelated class codes and protects faculty approval and active attempts. Rollback-only production E2E passed. The legacy `3F` class was archived after checking 0 active enrollment, 0 running attempts and 0 live rooms. Two removed roster rows and 18 historical attempts were preserved. Current `3-F` was not modified by this archival.

## Faculty class management API
- `buklod_quiz_faculty_class_inventory_v1(p_exam_id,p_include_archived)`: class status, total/active/removed roster counts, attempts, active attempt count, safe-archive flag and normalized-name collision count.
- `buklod_quiz_faculty_class_roster_v1(p_exam_id,p_section_id,p_status,p_search,p_limit,p_offset)`: exam-owner-only all-status enrollment listing, search, page limits, latest attempt context.
- Existing `buklod_quiz_delete_section_v1` archives a class with history and rejects active-exam deletion. Existing `buklod_quiz_exam_sections_v2` continues to hide archived classes.
- Only authenticated exam owners with examiner permission can read the new roster RPC. Anonymous access is revoked.

Tests included SQL compilation, denied anonymous access, correct roster filtering, pagination, historical preservation, and post-deployment archived-versus-active inventory reads. No exam scores or ongoing attempts were changed.

**Already deployed:** do not replay the SQL files in `supabase/pending/` through CI.

## Remaining frontend limitation
The deployed website at `buklod-quiz.expo.app` has its own standalone frontend not present in the connected GitHub repositories. No claim is made that buttons were added to that site. The website should expose Manage Class (all enrollment statuses), Archive/Delete Class, and a warning when Records shows 0 active students despite historical rows. Integration requires the authoritative Quiz frontend source or deployment access.
