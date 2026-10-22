# BUKLOD Engineering Accountability Contract — all workstreams

**Scope:** Every BUKLOD architecture, engineering, database, app, web, CI, OTA and release task. Not limited to Character or Global Stability.

## Mandatory pre-change contract
Before changing anything, record internally: (1) user's current objective; (2) authorized deliverable; (3) production baseline evidence; (4) specific allowlisted files/services; (5) protected unrelated components; (6) acceptance checks; (7) release authorization and blockers. Missing objective/baseline/permission means inspect only, not guess.

## Execution invariants
- Do not treat a symptom in a different module as authorization to edit that module.
- The verified *currently live* app/web and cumulative OTA source are the approved functional baseline. Never silently substitute historical R31/R40, main, a draft PR or a stale APK.
- Every code change must be justified against the objective and checked against the explicit per-task file allowlist; out-of-scope diffs stop the release.
- Keep separate workstreams and branches. Do not mix unrelated PRs into a release candidate.
- Preserve security boundaries (RLS, auth, least privilege), user data, native baseline, and approved UI.
- Root cause is a hypothesis until corroborated by logs/tests; label it accordingly.
- Verify fixes with focused tests, regression checks and real runtime behavior. Never declare fixed, locked or published based only on a commit.
- Follow DEV → exact verified RC → Production OTA. Do not publish on failed or unknown gates.
- Avoid wasteful GitHub pushes, CI retry loops, unnecessary cloud builds and local disk writes. Batch coherent changes; investigate failed runs before rerun.
- If the user is busy or delegates judgment, apply *more* safeguards, not fewer. Never treat silence or lack of review as approval for expanded scope.

## Before every merge/release
Fail closed unless: objective still matches, approved baseline verified, full diff reviewed against scope, tests pass, no unrelated files, rollback known, RC fingerprint recorded, production deployment verified. Record each evidence item. No evidence = HOLD.

## Reporting
Report completed actions, verified results, unresolved risks and only genuinely necessary user action. Do not hide failures, claim success prematurely, or send the user in repeated circles.

## Enforcement status
This contract is a policy artifact. A fully automated repository-wide gate requires integration into each relevant CI/release workflow and task-specific scope manifests; do not represent this document alone as that enforcement.
