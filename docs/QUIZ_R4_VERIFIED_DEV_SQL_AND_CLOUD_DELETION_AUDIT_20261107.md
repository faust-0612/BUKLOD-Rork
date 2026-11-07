# BUKLOD Quiz R4 — verified DEV functional restoration and 1–6 cloud-deletion audit
Date: 2026-11-07 (Philippines)

## Boundaries / exact evidence

**No production database or OTA was changed in this continuation.** The client and SQL fixes are on separate DEV branches. The original Quiz archive at `9cef155f2378fc77a46e20325259e81136525e45` remains preserved.

### Quiz source changes

Private repo: `faust-0612/BUKLOD-Migrated-Sources`.
- DEV source branch: `dev/quiz-r10-main-db-reconciliation-20261107`.
- Verified source commit: `2e1a1366465427fad35682b5a34e31928d7c4c81`.
- Restored class-specific selected-student batch operations (admit, remove, submit, release graded, reset selected); these were present in earlier BUILD but absent from the modern R10 room.
- Fixed RESET ALL client action mismatch: Dedicated v2 delegates to v1 and accepts RESET_SELECTED, not RESET_ALL.
- Uses Dedicated `buklod_quiz_live_student_action_v2` for per-student controls rather than the older v1, to preserve R10 snapshot/reset behavior.
- Stale room loading results are rejected by exact session id when faculty switches classes; no previous classroom content may populate another class. UI now offers actionable error/retry instead of indefinite loading.
- Confirmations for student/whole-class destructive actions and visible transient network error feedback.
- Earlier DEV redesign retained: professional dark sidebar, context Back, responsive two-column login, modernized faculty/student design tokens; original submit/save/release scoring and Auth flows kept.

**Cloud CI verified**: [Quiz web run #42354535310](https://github.com/faust-0612/BUKLOD-Migrated-Sources/actions/runs/42354535310), exact HEAD `2e1a1366465427fad35682b5a34e31928d7c4c81` status **completed/success**. Fresh runner: `npm ci`, 8/8 project-key/target checks, full static route/button check (including Supported Dedicated action literals, v2 student action and room guard), `tsc --noEmit`, `expo export --platform web`, and HTML export verification. A successful static build **does not** establish authenticated click functionality against the deployed production Quiz.

### Five missing Dedicated management functions

Private Main DEV repo: `faust-0612/BUKLOD-Rork`, `dev/quiz-consolidation-identity-audit-20261107`.

Functions absent from Dedicated but referenced in R10 UI:
`buklod_quiz_publish_exam_v1`, `buklod_quiz_unpublish_exam_v1`,
`buklod_quiz_archive_exam_v1`, `buklod_quiz_restore_exam_v1`, `buklod_quiz_delete_exam_v1`.

Implementation is staged at `supabase/pending/quiz_consolidation/20261107_dedicated_exam_management_five_rpc_rc_only.sql`. No production apply.

**Actual isolated PostgreSQL 16 test PASSED**: [GitHub Actions run #42354823729](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/42354823729), exact commit `6d4f7e1d5e84e28312af0afa96faeda9ee077649`.
- Synthesized a disposable Dedicated-compatible schema and all 7 dependent foreign-key tables.
- Executed the complete five-function SQL without syntax errors.
- Verified `anon` denied / `authenticated` and `service_role` grants, unauthorized identity rejection, zero-question publish denial, publish scoring, LIVE/PAUSED archive/unpublish restriction, archive of WAITING sessions, restore + unpublish, rejection of delete for populated exam, deletion only for empty DRAFT, and audit row preservation.
- No Supabase service keys, live student records, or network connection to a Supabase database were used.
- **This is synthetic contract verification, not true RLS/authenticated RC acceptance.**

Live Dedicated READ ONLY schema check following CI: 20/20 required columns available, examiner/audit helpers present, **16 LIVE/PAUSED live rooms**, 0 STARTED attempts, 952 attempts, 61,959 responses and 98 private source documents. Rooms may be stale but must be treated as live until their statuses are reconciled. Do not run a production DB migration simply because no attempts are STARTED.

### Actual recovery gate evidence

Previous independent GitHub-only cloud checkout: [#42344793806](https://github.com/faust-0612/BUKLOD-Migrated-Sources/actions/runs/42344793806) passed; 42,515 tracked files and nine manifest-bearing source roots. 43,049 prior excluded entries require classification, including 33,049 unitemized and 2,049 asset/noncode review. The main app GitHub repo contains source directories, but cloud restore of every connected subsystem is NOT certified. The connected Vercel Classroom project metadata has a latest CANCELED deployment and reports live=false; this scoped observation is not proof another Classroom deployment/domain is offline and cannot be used as a source backup.

R4 read-only Windows safety audit bundle (created in current ChatGPT artifact session): `BUKLOD_Cloud_Safety_Audit_R4.zip`. Script `scripts/Start-BuklodQuizSafetyAudit.ps1` uses immutable, sparse private GitHub checkouts and checks:
- exact SHA-256 and size for all 300 R10 and 336 BUILD archived files;
- **all additional local files not listed in source manifests**, including source/assets, local credentials, generated or skipped folders, symlink anomalies, inaccessible trees and files modified since archive;
- optional extra BUKLOD root inventories via `-InventoryRoots`;
- optional clean TEMP web build; no deletion commands.

Both JS audit test suites pass. `localDeletionCandidateReady` and aggregate `deleteClearance` deliberately never become true until independent recoverability proof.

### Gates 1–6 — fail closed

| Gate | Status | Evidence still missing |
| --- | --- | --- |
| 1: Complete original PC inventory | BLOCKED | R4 must be executed on actual Windows folders; not all other BUKLOD systems are included by default |
| 2: Every project/source backed up | PARTIAL | R10 and BUILD backed up; Main/other systems need authoritative source-to-cloud manifest parity |
| 3: Every unique asset/config secured | BLOCKED | Excluded files require classification; secrets must be in a separate encrypted vault |
| 4: Clean cloud-only restore/build | PARTIAL | Quiz R10 clean web build passed; production runtime, native, Classroom and other systems are unverified |
| 5: Safe signing credentials recovery | BLOCKED | EAS/Android keystore, distribution/config keys and recovery access not independently certified |
| 6: Independent secondary backup+restore | BLOCKED | A separately stored, encrypted copy and independent restoration drill not verified |

**Risk boundary:** Do not delete local original files, retire Dedicated Quiz, or assert full Main-only Quiz integration. Main private staging is not a live cutover: two historical student ID exceptions (234 Auth links) and 86 missing source document paths remain, with 0/98 SHA verifications recorded.

**Outcome:** DEV SOURCE / CI **VERIFIED**, DEDICATED FIVE FUNCTION SQL **ISOLATED CONTRACT VERIFIED**, RC/PRODUCTION **BLOCKED BEFORE RELEASE**, LOCAL BLANKET DELETION **NOT CLEARED**.
