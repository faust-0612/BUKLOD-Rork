# BUKLOD Main Agent Contract

This repository is BUKLOD Main. All coding agents, chats, IDEs, and release scripts must use the same source-of-truth rules.

## Canonical source

Default Windows workspace:

`%USERPROFILE%\BUKLOD_WORKSPACE`

Only normal writable BUKLOD Main clone:

`%USERPROFILE%\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN`

Expected remote:

`https://github.com/faust-0612/BUKLOD-Rork.git`

Normal product development must start from the canonical SOURCE. Do not develop from Downloads copies, ZIP extractions, recovery snapshots, archive branches, or release staging clones.

If valid work is found elsewhere, forward-port only the smallest required delta into canonical `main`. Do not whole-merge an old branch merely because it contains one desired feature.

## Branch roles

- `main` = canonical integrated product source and only production release base.
- feature branches = temporary development only; merge/forward-port back into `main` after verification.
- `recovery/r31-r40-approved-local-20260910` = protected R31/R40 recovery source only.
- `archive/*` = immutable historical/reference pointers; never production source.
- `RELEASE\WEB\current` = disposable build/deploy staging only; never an editing source.

## Protected recovery

Approved R31/R40 recovery material is centralized under:

`%USERPROFILE%\BUKLOD_WORKSPACE\RECOVERY\R31_R40_APPROVED`

Treat it as read-only. Recovery is overlaid into disposable release staging by verified manifest/hash contract. Never replace current `main` wholesale with an old snapshot.

## Canonical release

Canonical web release entry point:

`scripts\RUN_CANONICAL_WEB_RELEASE.ps1`

Production release must originate from canonical `main`, pass source identity checks, R31/R40 contract, Kingdom/Game contract, TypeScript, export/build checks, compiled-bundle checks, and visible live verification.

## Stability

STABILITY FIRST — ZERO REGRESSION.

Preserve unrelated completed features, standalone Focus App doors/integrations, routing, auth, points/rank, character/game contracts, IGPAT, ads, push, and Supabase protections unless the task explicitly supersedes them.

For release-affecting work:

`EDIT → QA → WEB BUILD → DEPLOY/PREVIEW → VISIBLE LIVE VERIFICATION → NEXT PHASE`

A commit/build/deploy command alone is not proof of completion.

## Engineering Contract V2 (mandatory for new work)

### Source of truth, baseline and change isolation
- GitHub faust-0612/BUKLOD-Rork is the cloud-first authoritative repository; a local clone is optional and must never override current GitHub main, the current verified RC, or the exact production runtime/source fingerprint.
- On every new engineering session inspect current source, open related PRs, prior attempts, dependent modules, DEV work, and known release state. Record what is *verified* versus inferred. Do not reapply an old patch or silently overwrite unrelated changes.
- Keep each fix on a temporary DEV branch with a scoped .buklod/scopes/*.json version-2 manifest. Its baseRef is a concrete commit; productionBaselineEvidence must identify real production verification or clearly disclose its absence.
- List changed paths, preserved behaviors, real acceptance scenarios, risk areas, and tests. Broad refactors and unrelated cleanup are out of scope. The existing scope gate remains mandatory.

### Problem solving before modification
1. Define the user's exact desired interaction and non-negotiable existing behaviors. Reproduce the failing state when feasible, including offline/weak-network, recycled component, concurrency and app-resume cases.
2. Trace the actual cause through data, UI state, lifecycles, auth, cache, storage, network and deployment version. Distinguish backend failure from client visual/rendering failure.
3. Compare at least two credible alternatives, consult official documentation when necessary, and choose the smallest maintainable intervention. Explain why rejected approaches are less safe.
4. Implement coordinated, isolated changes with bounded retries, cancellation, idempotency, scoped authorization, offline fallback and stability where relevant. Never patch symptoms repeatedly without revisiting the diagnosis.
5. Reassess changed behavior from an independent regression-review perspective and check downstream screens, account boundaries, historical data, and performance.

### Test evidence and regression requirements
- Every new PR that changes product/runtime or release-sensitive code must include a changed focused regression test. Multi-area changes must cover each impacted area; a Supabase migration/function requires a SQL test, and OTA/release changes require release-specific tests.
- The existing Engineering Accountability workflow executes scripts/engineering-regression-gate.mjs and the gate's adversarial tests, alongside existing scope/feature checks. Run relevant Jest, Node, database, typecheck, Expo and integration checks when applicable; do not claim that Node static/source checks alone prove native functionality.
- Prefer behavioral tests over string-matching: simulate state transitions, stale completions, offline/retry, reordering, double-tap, scope switching, unmount, duplicate requests and permission denial. Maintain the critical regression inventory: Wall/media and scroll; Connect/read/unread/calls; navigation/notifications; Cluster/Show Faith; registration/auth; Quiz/Classroom/grades; story scene persistence; release/identity/backend.
- Fail closed when baseline, required tests, or evidence is missing. No artificial green pass, test deletion, empty test, or permissive waiver merely to move a release.
- Avoid full builds/CI loops for documentation-only or isolated pure logic changes. Do not re-enable disabled backend health-watch workflows.

### Safety and release protocol
- DEV → verified RC → Production OTA. No direct push to production, no accidental publishing triggered by governance or unrelated patches. Record exact SHA, source diff, runtime, intended channel, update group and installed-client compatibility.
- A green pull request, successful upload, downloaded image, passing regex, or OTA CLI exit is **not** a verified user-facing behavior. Record RC evidence, real test results, and the exact deployed artifact and production checks before saying VERIFIED COMPLETE.
- When physical device verification is explicitly skipped, record it as unverified; still perform all feasible automated and source checks. Do not silently treat skipped checks as passed.
- Protect existing BUKLOD features and sensitive student/medical/member data, RLS, permissions, and Supabase production boundaries. No destructive migrations or unreviewed data moves.
- After the work, report one of VERIFIED COMPLETE, PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS, or BLOCKED BEFORE RELEASE, separating DEV, CI, RC and production. Never imply continued background execution.

### Contract limitations
- The PR gate enforces scope and changed-test presence plus runnable Node tests. Human/agent review is still needed to ensure tests are behavioral and adequate. GitHub branch protection must mark the gate as required to block bypass merges; this is an independent repository-setting gate, not something AGENTS.md alone can enforce.

## Permanent protected-feature lock (2026-11-12)

- GitHub main SHA `219507f387c8f75af98a4489fbd26abbce1a62ed` is a **source-only snapshot**, not proof of the live OTA/Android version. Do not label an unverified source snapshot as production-functional.
- Existing repository ruleset requires a PR and the `objective-scope-gate` check. The same required job now runs `scripts/protected-feature-lock.mjs` and adversarial tests; protected areas are blocked on missing declarations and changed feature-focused tests.
- Any future application, media, database, auth, navigation, Connect/PTT, advertising, points, Kingdom, education, CI or release edit must use a V2 `.buklod/scopes/*.json` manifest. In addition to normal allowedPaths/regressionTests, specify `lockedFeatureChanges: [{ id, reason, preservedBehaviors, tests }]` for **every** impacted id reported by the gate. The declared tests must be changed in that PR and run successfully.
- Unrelated modules are not permitted in a patch. Regression test deletion is blocked. A functional feature may be intentionally updated only with a directly scoped change, preserved behaviors, new regression evidence and required review. Do not weaken tests to make a failed change green.
- Preserve the existing mandatory RC and production-OTA verification gates. This governance PR does not release an APK, web build, Supabase migration, or OTA.
- Structural enforcement is not runtime proof. For a stronger administrative lock, GitHub branch rules should additionally require an independent code-owner approval of security/CI changes; current ruleset permits zero approving reviews and that setting is **not** changed by this PR.
