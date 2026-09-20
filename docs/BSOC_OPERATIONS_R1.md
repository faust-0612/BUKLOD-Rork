# BUKLOD System Operations Center — R1 Source Contract

## Purpose

BSOC is the BUKLOD operational control plane. Its working sequence is:

**OBSERVE → UNDERSTAND → INVESTIGATE → ACT → VERIFY → AUDIT**

It is not a generic database editor, not a finance dashboard, and not a wall of permanent admin buttons.

## R1 scope

R1 establishes the desktop-first operations shell, the official BSOC brand surface, the first truthful operational overview, and **Apps & System → Ads & Monetization Health**.

The shell keeps primary navigation small and context-oriented. It uses the existing System Admin gate until narrower staff-role permissions and scoped BSOC roles are backed by authoritative server policy.

## Ads operations boundary

BSOC answers **“Are ads working correctly?”** It may surface operational request/load/render/impression behavior, failures, provider/configuration state, placement registration, application/version context, and data freshness.

It must not expose gross revenue, owner profit, eCPM financial projections, user cash balances, user revenue-pool amounts, Community Fund balances, tax reserve, payout totals, or payment credentials. Those belong to the separate Finance Control Center.

## Truthful telemetry rule

The existing native ad diagnostics are local in-process counters. R1 labels them **LOCAL RUNTIME** and does not present them as ecosystem-wide production truth.

A missing centralized feed is shown as **NOT CONNECTED / UNAVAILABLE**, never as zero incidents or zero traffic. Provider-wide AdMob/AdSense metrics, central incident correlation, durable placement telemetry, and historical release correlation require a server-side telemetry source before BSOC may claim those capabilities are live.

## Placement registry rule

Known placements are registered centrally in source with stable IDs, app, platform, provider, format, route, environment, status, and diagnostic mapping where available.

The current Home placement remains **ACTIVE** because current source still renders it. It must only become **LEGACY** after a verified release removes current-version traffic. Old-build traffic and current-version regressions must remain distinguishable.

## Content-first invariant

**AD FAILURE MUST NOT BLOCK CONTENT.**

Ad unavailability, no-fill, timeout, or provider degradation must not make Community Wall or another BUKLOD content surface unavailable. Any violation is release-blocking.

## Safe-control rule

R1 intentionally does not add fake or client-only production kill switches. Disable Placement, Disable Ads For App, format disable, or an emergency ads kill switch must be implemented only through permission-controlled, scope-aware, reversible, audited backend operations with preview and verification.

## Release gate

Do not merge or release this branch solely because the UI compiles. Before release, verify the exact release candidate with role/permission checks, navigation/dead-end checks, stale-data handling, ad-provider failure handling, request-storm behavior, content-first behavior, placement status accuracy, and audit safety.
