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
