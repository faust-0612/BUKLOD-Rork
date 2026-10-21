# BUKLOD Engineering Charter — 2026-10-21

## North star
Deliver a fast, reliable, observable BUKLOD Android experience, including on weak networks, and safely deliver verified fixes to users. Success is measured on real devices and user journeys, not commit or test counts. Plan capacity toward 1 million users without claiming current capacity.

## User-visible acceptance outcomes
- Community Wall posts appear promptly under weak Wi-Fi; photos show cached/low-resolution previews where feasible and failed media never block the feed.
- Login, password recovery, signup and referral complete reliably with actionable errors and no unsafe concurrent auth.
- BSOC captures privacy-safe operational failures (including signed-out/offline), queues and deduplicates safely, and delivers after authentication with backend receipt; never collect credentials or raw personal content.
- Video playback and image delivery do not degrade the entire app; diagnose URL validity, signed URL expiry, CDN/thumbnail strategy, cache, request latency and renderer failures with measurements before changing media code.
- Production OTA reaches compatible installed clients with no regression or lost cumulative fixes.

## Engineering rules
1. Use the latest **verified** cumulative production OTA and installed APK evidence as release provenance. Work on an isolated DEV branch and retain all accepted fixes. Never assume the original base or an older OTA is authoritative.
2. Targeted Change Only: smallest evidence-backed diff; freeze unrelated modules; inspect diffs and run focused plus appropriate regression tests.
3. Release order: DEV -> verification -> immutable RC with exact manifest/hash -> compatible Android Production OTA -> post-publish device verification. No main merge that triggers auto-OTA until release gates are approved.
4. Native changes, runtime incompatibility or missing embedded APK parity may require a new APK/AAB; never force an incompatible OTA.
5. Reuse completed test results and committed evidence; distinguish historical PASS from a fresh rerun. Use bounded timeouts and commit safe, focused work promptly instead of losing local patches to stalled sessions.
6. Never label a release READY when TypeScript/Jest, Hermes reproducibility, source-to-APK provenance, relevant backend security/receipt checks, Android acceptance, or RC checks remain mandatory and unverified. Report exact blockers, not generic progress.
7. Photo-loading is a first-class unresolved user issue. Run a dedicated measured Android media diagnosis and narrowly scoped repair; do not silently mix speculative media rewrites into unrelated P0 release candidates.
8. No unverified publication, native build, main merge, or database mutation as a shortcut. Avoid paid infrastructure without explicit approval.

## Current checkpoint (2026-10-21)
Repository: faust-0612/BUKLOD-Rork
DEV branch: dev/v28-p0-reliability-20261020
Last verified before this charter: d7add781b8db22ac237a7c9221b852712f7d1f5d
Prior verified checks: TypeScript PASS, 23 targeted P0 PASS, 5 SDK integration PASS, 5 foundation Jest PASS. Earlier full Jest 89 PASS / 2 FAIL; router and formation test-only corrections committed at d7add781; **full Jest not yet rerun**.
Outstanding: full Jest rerun, Hermes export reproducibility, exact APK-to-source provenance, physical Android weak-network/auth/media acceptance, non-production BSOC end-to-end receipt, immutable RC. Production V28 OTA **NOT READY**.
The V28 native runtime is 1.3.4; previously inspected production OTA groups used runtime 1.3.2 and cannot be assumed compatible.

## Continuation rule
At the start of any new engineering conversation or Work run, read this charter and the latest DEV/RC/release manifests, check actual GitHub/Expo heads, and continue only unfinished tasks. Update the checkpoint with verifiable evidence after each meaningful release milestone. This document is a persistent repository policy, not proof that a chat's memory has been permanently changed.
