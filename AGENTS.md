# BUKLOD cloud-only engineering policy (2026-10-22)

This policy supersedes any Windows-local canonical-source or local-build instructions below. GitHub private repository is the source of truth. Local copies are disposable and never authoritative.

- All future engineering: scoped DEV branch -> reviewed/frozen immutable RC SHA -> gated Production OTA. Never publish from mutable main or on ordinary push.
- Run CI, builds, exports, tests, artifact comparisons, and releases in cloud runners. Do not require a laptop, local keystore, or local working tree for normal operations.
- Pin the exact approved source SHA, runtime, channel, and artifact manifest. Require reproducibility/feature parity, secret scan, regression tests, and a successful release verification. Workflow success alone does not prove device success.
- Secrets must live in protected cloud secret stores; never commit or upload keystores or credentials. A local RC branch containing a debug keystore in history must never be pushed.
- Original V28 reference: AAB SHA256 E735885E20F222B03CD91184F7D0FB5281523EC846667B9FB935D50E9FF7C5C2; bundled JS SHA256 38A36B0A5AB7533F487EA227D47450805B4AC39CB7A5E96F3E2A57A8FADFC939; Android versionCode 28; runtime 1.3.2; channel production. These hashes are reference evidence, NOT proof that the cloud source or OTA is verified.
- Do not remove local originals until restricted cloud backups and a cloud-only recovery drill are independently verified AND user expressly authorizes deletion.
- No unrelated changes, no new AAB, web deployment, or database mutation during V28 rollback. Preserve current production OTA until replacement passes all gates.
- Do not bypass legitimate release safety checks, fabricate SQL migrations, or silently restore removed PTT/IGPAT features.
- See issue #249 for migration completion gates. If cloud release prerequisites are missing, stop safely and report only the actual blocker.

---

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
