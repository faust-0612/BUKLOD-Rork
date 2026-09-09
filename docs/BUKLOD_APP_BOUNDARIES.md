# BUKLOD App Boundaries — Canonical Architecture Contract

This document is authoritative for product identity, repository ownership, and deployment targeting.

## Canonical products

### BUKLOD Main

- Product type: **ROOT / HUB APP**
- Repository: `faust-0612/BUKLOD-Rork`
- Main production web: `https://buklod.expo.app`
- Purpose: global BUKLOD experience and doors/entry points to Focus Apps.

### BUKLOD Report

- Product type: **STANDALONE FOCUS APP**
- Relationship to Main: Main may contain a **door/link/integration entry point** only.
- It must have its own repository/project/runtime/database/production target as applicable.
- It must **never** use BUKLOD Main's repository, Expo project, production URL, or release pipeline as a fallback.

### BUKLOD Classroom

- Product type: **STANDALONE FOCUS APP**
- Relationship to Main: Main may contain a **door/link/integration entry point** only.
- It must have its own repository/project/runtime/database/production target as applicable.
- It must **never** use BUKLOD Main's repository, Expo project, production URL, or release pipeline as a fallback.

## Door does not mean ownership

A Focus App door visible inside BUKLOD Main is only an entry/integration surface. It does not make the Focus App part of BUKLOD Main's deployable product.

The following remain independent for every standalone Focus App:

- source repository
- application identity
- Expo/project identity when applicable
- backend/database ownership
- secrets and environment variables
- build artifacts
- production hosting/domain
- release history
- rollback history

## Mandatory deployment decision order

Before any build intended for release, determine the requested **APP_ID** first.

1. Read `.buklod/app-boundaries.json` or the target app's own identity file.
2. Match the requested product to its registered `appId`.
3. Confirm repository identity.
4. Confirm project/hosting identity.
5. Confirm production URL belongs to that same app.
6. Only then build/deploy.

**Never choose a deploy target merely because credentials already exist or because another BUKLOD app is already hosted.**

## Fail-closed rule

If the standalone Focus App has no dedicated repository/project/domain registered yet:

> STOP PRODUCTION DEPLOYMENT.

Do not substitute BUKLOD Main. Do not deploy to `buklod.expo.app`. Do not use the Main Expo project as a temporary verification host.

Local preview, test artifacts, and non-production verification may continue without changing Main production.

## Main-side code rule

Existing or future Main-side routes/components for a Focus App may be retained when they serve a door, compatibility layer, or controlled integration. Their presence in the Main repository is **not evidence that the standalone Focus App should be built or released from Main**.

Main-side QA may test those doors/integrations. A Focus-App-scoped workflow in Main must not perform a production Focus App deployment.

## Release naming

Every release instruction/status should explicitly state one of these identities before deployment:

- `APP_ID=buklod-main`
- `APP_ID=buklod-report`
- `APP_ID=buklod-classroom`

Statements such as "deploy BUKLOD" are insufficient when the context is a Focus App. The app identity must be resolved from the requested product, not guessed from the nearest repository.

## Zero-regression rule

Boundary enforcement must not delete working Main features merely to separate deployment ownership. Correct the release path first. Existing runtime functionality is changed only through a separate, verified product decision.

## Adding another Focus App

Register it in `.buklod/app-boundaries.json` first. Until its dedicated production target is explicitly registered, it is deployment-blocked and must never fall back to Main.
