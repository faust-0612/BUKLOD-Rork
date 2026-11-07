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

## 2026-11-07 user PC execution — root cause and fix

Owner executed the original `scripts/BUKLOD_QUIZ_CLOUD_RECOVERY_R1.cjs --push` in Windows PowerShell and received `BLOCKER: NOT CANONICAL QUIZ: required file missing: package.json`. The script had resolved its *single default* root to `%USERPROFILE%\\Downloads\\BUKLOD_Quiz_Standalone` and stopped before any file transfer or cloning. **This does not prove source loss**; the intended canonical files may be inside a moved/nested project, e.g. `C:\\BUKLODQ_BUILD\\project`. The tool also over-required two particular `src/lib` helpers even though the older verified forensic locator only required `package.json`, `app/exam.tsx`, `app/live-join.tsx`, and either `lib/supabase.ts` or `src/lib/supabase.ts`.

Committed script improvements on DEV (latest commit `44f00d4c952e2710548dc571cc01ea5e905c11a3`):
- bounded, read-only discovery across historically documented C:/D:/Downloads/OneDrive roots, and one to three levels of nested source folders, prioritizing Quiz-related directory names even in crowded Downloads;
- strict standalone Quiz fingerprint (Expo+Supabase package, both Quiz exam/join screens containing Quiz RPC references, and actual Supabase client file), not BUKLOD Main launcher/SSO copies;
- a single strong source auto-selects; zero returns informative partial candidates without upload; multiple strong sources abort with an explicit `BUKLOD_QUIZ_SOURCE_DIR` instruction to prevent uploading an outdated build;
- `BUKLOD_QUIZ_SOURCE_DIR` explicit override supported, while retaining all source/hash/secret checks; strengthens JWT scanning;
- mock execution tests **5/5 passed**: known alternate root, nested folder root, no valid source, multiple ambiguous sources, and source containing a secret. JavaScript syntax compiles.

**Next user-local operation**: redownload the latest GitHub script (the user's prior temp `$f` is stale), run `node --check $f`, then `node $f` for read-only source discovery and `node $f --push` for authorized archive to the private verified branch when a single correct source is found. This authorizes no production cutover, deletion, or migration of private Storage documents. No PC operation was performed by the ChatGPT connector.

## 2026-11-07 follow-up — TWO verified local sources, preserve both first

User reran the source discovery script pinned at `44f00d4c952e2710548dc571cc01ea5e905c11a3`. **Live Windows evidence**:
- `C:\\BUKLODQ_R10_BUILD\\project`: verified Quiz standalone source fingerprint (`package.json`, `app/exam.tsx`, `app/live-join.tsx`, `src/lib/supabase.ts`, Quiz RPC references).
- `C:\\BUKLODQ_BUILD\\project`: independently verified with the same core source fingerprint.
- `C:\\BUKLODQ_BUILD_R126\\project` and recovered V25 Main AAB trees remain **partial/not canonical**.
- Original run stopped correctly without uploading, because it detected **two valid candidates** and was programmed not to choose an unverified winner.

**Improvement:** The same recovery script was upgraded at commit `f7362bcb49daabf241ef25ce67b53284f35d62a7` to archive **both source candidates** under immutable, fingerprint-named isolated subfolders of `systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES` on private branch `migration/quiz-canonical-source-20261107`. These are expressly tagged `selection_status: UNDETERMINED` and `verified_for_release:false`; no automatic assumption about which source is more recent. Immutable candidate snapshots preserve all source versions for cloud comparison and avoid replacing previously archived files. A digest manifest and Git remote commit SHA check verify upload. Source files are never deleted. Excludes generated dependencies including `node_modules_copied_*`; retains secret scanning.

**Verification completed:** JavaScript compiles, mock dry-run emitted two separate preflight candidates, mock `--push` archived both and passed the simulated remote-commit check with original source preservation, and prior secret scan rejected a hardcoded credential. The simulation itself does **not** create GitHub snapshot files. GitHub branch verified to exist but candidate snapshot manifest fetch returned `404` before a user rerun.

**Next action:** Re-download newly pinned script commit `f7362bcb49daabf241ef25ce67b53284f35d62a7` (previous local cached temp file remains old), then `node --check`, `node ... --push`. Once live output says `CLOUD PUSH VERIFIED; candidate_snapshots=2`, verify both GitHub folder manifests and compare source versions/Exam client wiring before canonical selection.

**Release status remains BLOCKED BEFORE RELEASE** until source upload and independent database/storage/identity/functional/cutover gates finish. Do not delete local Quiz files at this checkpoint.

## 2026-11-07 actual Windows two-candidate archive attempt: whitespace-only Git pre-push blocker

From owner-provided log (file: Pasted text 20261107-055446), both candidates passed the real Windows preflight:
- R10 `C:\\BUKLODQ_R10_BUILD\\project`: 300 files, 65,058,267 bytes, `sha256` manifest fingerprint `04e596c8cfeb04bea54a618686d70ca1560628f06967a0bcc3510ad31b41a1f7`.
- BUILD `C:\\BUKLODQ_BUILD\\project`: 336 files, 75,834,778 bytes, fingerprint `481385774640c64813eafbb7c2451390541bbff3d63b55c9159da74fc835faad`.

Both local snapshots were copied to disposable Git checkout but the script aborted at `git diff --cached --check` on historical trailing whitespace at `...BUKLODQ_BUILD.../android/settings.gradle:9`. Git for Windows also warned about LF/CRLF normalization. No remote push occurred; the temporary clone is removed in `finally`. The owner's source files were never deleted.

**Fix committed:** `a02e44819419b468539c46f5b402fd1a53405ffc` updates `scripts/BUKLOD_QUIZ_CLOUD_RECOVERY_R1.cjs`. For immutable historical source archives, whitespace lint was the wrong gate: formatting is source data. Set `core.autocrlf=false` and `core.safecrlf=true` in the disposable clone, force-add only the scoped candidate archive subtree (so nested historical `.gitignore` does not omit files), and verify every expected file *including both manifests* by comparing the Git index SHA-1 blob object ID against exact local bytes. Any normalized, missing, or altered blob aborts before push. Also verify staged changes remain inside the Quiz archive prefix, retaining Git SHA remote verification after push. No source rewrite or secret-scan weakening.

**Verification:** JavaScript parses; mocked two-source success run verifies both manifests, Git staging, scoped push and unchanged original files. Actual local Git fixture containing trailing whitespace and nested ignored source with `core.autocrlf` initially true was archived with raw Git index parity PASSED; the removed whitespace lint reproduced failure on the same fixture, confirming root cause. Failure mocks for index corruption, unrelated staged files and secrets aborted before push (early asynchronous error formatting in those mocks was inconclusive, but exit/push guards were confirmed). The owner's actual machine has **not** run this new commit; no cloud claim or database cutover.

**Next user's single rerun:** replace old temporary script with raw GitHub `a02e44819419b468539c46f5b402fd1a53405ffc`, check node syntax, run `node $f --push`. Then independently fetch and validate both remote source manifest files via the GitHub connector; choose canonical source only after file and deployed-version comparison.
