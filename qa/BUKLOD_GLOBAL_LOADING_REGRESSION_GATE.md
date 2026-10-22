# BUKLOD Global Loading Regression Gate (2026-10-23)

Status: **GUARD SPEC — not a claim that production is fixed.**

Applies to every DEV → RC → Android Production OTA and web release, including unrelated edits. Runtime compatibility: Android 1.3.2. Never change authorization, consent, maintenance, or required-update gates to improve perceived speed.

## Required invariants
1. Every user-visible async load reaches success, empty, offline, timeout, or actionable error; never indefinite spinner.
2. An expired request must not overwrite a newer result. Abort or use generation tokens where supported.
3. Noncritical remote refresh must not block navigation; cached authorized reads remain visible with stale/offline indication.
4. Retrying reads is bounded with backoff/jitter and deduplication. Never replay privileged mutations, account creation, payments, or posting automatically.
5. Each submit action displays pending, server-confirmed success, or actionable failure and prevents duplicate taps.
6. Realtime subscriptions and timers clean up on unmount and reconnect; no duplicate listeners.
7. Scope and auth loading are distinct from unauthorized/not-found. Never expose scoped data from stale cached authorization.
8. Media load failure must not block feed text or navigation.
9. Capture sanitized latency, operation, screen, network quality, app runtime, and OTA fingerprint; never capture secrets.
10. Changes outside approved scope remain frozen; compare against the latest published OTA baseline and inspect the full cumulative diff.

## Known reconciliation items (not yet verified in production)
- R20 report says AUTH_SESSION_TIMEOUT_MS=2500; inspected AuthProvider declares 8000. Reconcile actual runtime behavior before changing either.
- Root index has 4000ms PUBLIC reset watchdog; auth spinner uses AuthProvider loading and needs separate test.
- Offline R1 report lists incomplete screen integrations; verify each before claiming offline coverage.
- Historical navigation audit says some RPC deployments pending; check live schema before altering code.

## Release-blocking checks
- Cold boot: signed-out, signed-in, expired session, slow network, offline, reconnect.
- Wall, scope/org/cluster, chat, notifications, media: no permanent spinner; no false unauthorized; no stale cross-scope data.
- Simulate timeout and concurrent responses; confirm cancellation/deduplication and stable content.
- Confirm creation flow does not duplicate when pressed twice or on uncertain network response.
- Typecheck, focused tests, regression diff, RC fingerprint and exact production OTA bundle check.
- If any check lacks evidence, mark BLOCKED, do not publish, and report exact missing evidence.

## Change control
This file is an enforceable review checklist only when the repository CI/branch protection references it. Do not assert automated enforcement until checks and branch rules are actually installed and verified.
