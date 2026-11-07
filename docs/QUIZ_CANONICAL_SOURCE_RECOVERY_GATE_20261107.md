# BUKLOD Quiz canonical cloud-source recovery — 2026-11-07

## Outcome: GitHub archive access confirmed, canonical Quiz frontend still MISSING

Connected GitHub installation can now access private `faust-0612/BUKLOD-Migrated-Sources`, including branch `migration/recovery-20261107023554`. This closes the earlier repository-permission blocker, **not** the source-parity blocker.

The recovery log inventory contains 5,460 tracked paths in 3 `systems/quiz` trees:
- `BUKLODQ_BUILD_3ba50f387f`: 2,294 files, SDK and build-template intermediates, not the canonical Quiz exam UI.
- `BUKLOD_QUIZ_SSO_WEB_dd9a7e8ab2`: 1,710 files, Expo BUKLOD Main source/SSO worktree, not standalone Quiz exam UI.
- `BUKLOD_Quiz_Standalone_1085d094bb`: 1,456 files, V25 Main Android AAB source copy and patches, **not** the standalone Expo Quiz frontend despite its misleading folder name.

Verified via connected GitHub reads: both source candidates have package name `buklod`, Expo SDK57 dependencies, Main-specific routes, `BuklodQuizStudentEntry` and Main→Dedicated bridge code. No standalone `app/exam.tsx`, `app/live-join.tsx`, `src/lib/quizSecureLocal.ts` or `src/lib/buklodQuizWebFetch.ts` could be found at the relevant paths. GitHub returned 404 for all six explicit canonical-source path probes. The recovery repository default branch `main` only identifies the repository as an isolated recovery archive, not a production deploy.

**Authoritative historical provenance:** actual deployed `https://buklod-quiz.expo.app` source was `%USERPROFILE%\\Downloads\\BUKLOD_Quiz_Standalone`, featuring `app/exam.tsx`, `app/live-join.tsx`, `src/lib/quizSecureLocal.ts`, and `src/lib/buklodQuizWebFetch.ts`. Do not treat BUKLOD Main source as a substitute. Distinct local build workspace `C:\\BUKLODQ_BUILD\\project` is a possible backup but not a proven match to the latest Expo production source.

## Safe one-time recovery tool (committed, not executed against user's PC)

- Script: `scripts/BUKLOD_QUIZ_CLOUD_RECOVERY_R1.cjs` on DEV branch `dev/quiz-consolidation-identity-audit-20261107`.
- Prepared private cloud destination: `faust-0612/BUKLOD-Migrated-Sources`, branch `migration/quiz-canonical-source-20261107`, path `systems/quiz/BUKLOD_Quiz_Standalone_CANONICAL`.
- Script checks actual exam/UI/local-persistence source files before copying. It scans files for likely secret material, excludes credentials and generated/build/cache output, never mutates original files, creates a SHA-256 manifest for copied files, pushes without force, verifies the remote branch SHA, then removes its temporary checkout. **It does not delete the original files.**
- Syntax validation passed in V8; three mock behavior tests passed: accepted canonical file fixture, rejected wrong source lacking `app/exam.tsx`, rejected hardcoded `sb_secret_` token. Real Windows/GitHub push and production build not executed in this chat because the user's local source is not directly accessible.
- Default command is preflight-only; `--push` performs the upload.

## Existing Supabase cutover gates (unchanged)

Current source/live vs Main staging: 61,959 saved responses / 952 attempts and 475 non-secret Auth/profile snapshots, 0 unexpired STARTED attempts when rechecked. Five identities remain review-required, 24 source-only and 62 differing RPC signatures need behavioral reconciliation. Source private Storage still has 98 objects, Main has 12 source-path matches, 86 source paths still missing. Prior secured transfer worker was retired after connector blocked the authorized transfer; both workers are inert HTTP 410 and no temporary transfer credential remains.

**Completion contract:** NOT DONE. No source deletion or dedicated DB retirement until canonical source is cloud-verified, deployable standalone Quiz exam UI is rebuilt/verified, 86 files checksum-transferred, identity/RPC parity is secure, end-to-end student/faculty scenarios pass, and production cutover to BUKLOD Main is monitored and verified. 
