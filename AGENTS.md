# BUKLOD Main Agent Contract

This repository is BUKLOD Main. All coding agents must follow the same source-of-truth rules regardless of chat, IDE, branch, or task name.

## Canonical source

Default local workspace: `%USERPROFILE%\BUKLOD_WORKSPACE`

Only normal writable BUKLOD Main clone:

`%USERPROFILE%\BUKLOD_WORKSPACE\SOURCE\BUKLOD-MAIN`

Expected remote:

`https://github.com/faust-0612/BUKLOD-Rork.git`

Before editing, verify the repository root, `.buklod-local-canonical.json`, `origin`, current branch, and `git status`. Do not edit a Downloads copy, ZIP extraction, recovery snapshot, release staging clone, or other duplicate BUKLOD-Rork folder.

If valid work is found elsewhere, forward-port the smallest required delta into canonical SOURCE. Do not continue development in the old copy.

## Protected recovery

Approved R31/R40 recovery material belongs under:

`%USERPROFILE%\BUKLOD_WORKSPACE\RECOVERY\R31_R40`

Treat recovery material as read-only source/reference. Never replace newer working files wholesale with older snapshots.

## Canonical release

Canonical web release entry point:

`scripts\RUN_CANONICAL_WEB_RELEASE.ps1`

Release staging:

`%USERPROFILE%\BUKLOD_WORKSPACE\RELEASE\WEB\current`

Release staging is disposable and must never become an editing source.

## Stability

STABILITY FIRST — ZERO REGRESSION.

Preserve unrelated completed features, current standalone Focus App doors/integrations, current routing, auth, points/rank, character/game contracts, ads, push, and Supabase protections unless the task explicitly supersedes them.

For release-affecting work:

`EDIT → QA → WEB BUILD → DEPLOY/PREVIEW → VISIBLE LIVE VERIFICATION → NEXT PHASE`

A successful command alone is not proof of completion.
