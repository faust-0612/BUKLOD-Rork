# BUKLOD Navigation 2.0 — Staging-first release contract (2026-11-13)

**Current state: DEV ONLY. No production, web, staging APK, or staging OTA has been published as part of this work.**

## Separate authoritative facts
- GitHub `main` at initial fork: `a43e1813d62a151e8294a52989a80fe21b36057c`. This is a source observation, not a live Android or Web fingerprint.
- The historical staging user branch `release/staging-user-current-main-apk-20261108` was 333 commits behind initial `main`; other staging branches diverged. Never merge old staging branches into BUKLOD Main.
- Live Android native package: `org.mzbministry.buklod`; separate staging package: `org.mzbministry.buklod.staging`; expected runtime 1.3.2, staging EAS channel `staging-user`, environment `preview`. These are source configurations, **not verified installed facts**.
- Staging uses a separate package/Firebase and preview environment. Source/UI parity **must not be confused with copying production credentials, member data, notifications, or financial records**.
- The existing staging-user APK builder is main-only, requires an explicit prefix and does not automatically update on every commit. A new approved build/install is needed if the installed staging binary is stale/incompatible or native IME functionality changes.

## Required continuous release phases
1. **Baseline freeze.** Independently obtain live Android installed APK/version/runtime/channel/update ID/source SHA and current production readback. Record verified source and timestamp in `release/navigation-v2-staging-evidence.json`; do not invent blank IDs.
2. **Rebuild/install a staging baseline if necessary.** Use canonical live runtime source, current green-B branding, `staging-user` package and preview EAS profile. Verify actual APK link, Firebase registration, exact EAS build ID and installed build fingerprint. Compare UI/features with live. Existing branch names are not proof. Verify preview backend supports the same features, permissions, and data contracts using nonproduction accounts. Do not sync private production data.
3. **Implement full Navigation 2.0.** Update every item in `docs/navigation-v2-completion.json`. `verified` requires actual QA evidence URL; `in_progress` or a skipped task never counts. The 21 mandatory categories include font scaling, native keyboard GIF, compact controls, context menus, safe gestures, back/state, offline/retry, role scopes, accessibility, ads/media and full regression suite.
4. **Frozen verified RC.** Run focused tests and source scopes plus TypeScript, Expo Android compile, exact runtime/OTA compatibility checks, security and feature regression matrix. Preserve current prod source; do not use a stale earlier compiled RC as evidence for changed source.
5. **Staging prepublish approval.** All items *except final staging publication/device verification* must be marked verified. Run:
   `node scripts/navigation-v2-staging-gate.mjs --prepublish --commit=EXACT_40_CHAR_RC_SHA --evidence=release/navigation-v2-staging-evidence.json`
   Failures prohibit publishing. The stage baseline must be freshly evidenced (6 hours), protected source/channel mappings distinct, and any required native staging APK installed before JS OTA.
6. **Isolated staging Android OTA.** After verified preflight and release authorization, use `.github/workflows/navigation-v2-staging-ota.yml` manual `workflow_dispatch` on canonical `main` with exact frozen head and `publish=true`. The workflow checks staging package/runtime, preview env, source, channel isolation, tests and completion gate before `eas update --channel staging-user --platform android --environment preview`. No production or web step is authorized. A push/build success alone does **not** prove the staging client received it.
7. **Postpublish staging validation.** Capture actual published update ID, installed update source SHA and post-update device evidence. Mark last item verified only after confirmed installed behavior. Run:
   `node scripts/navigation-v2-staging-gate.mjs --release --commit=EXACT_40_CHAR_RC_SHA --evidence=release/navigation-v2-staging-evidence.json`
   This must pass before calling staging "verified complete". If it fails, no production or web promotion.
8. **Owner approval → later web + production APK/OTA.** This is a separate decision and requires the then-current production baseline, verification and existing canonical release prefixes/gates; don't reuse stale staging output or publish automatically.

## Mandatory staging acceptance journeys
- First-time user finds Settings, password recovery, support, Cluster, Wall and Connect without instructions.
- Profile gear remains available after hiding a customizable Profile section. Home feature search has safe Tagalog/English aliases and no admin/retired entries.
- Font size follows Android at default/125%/150%/200% and smaller screen; texts/caret/Send remain visible. Test Gboard/Samsung keyboard GIF from exact active comment/chat composer, preview + explicit Send, no forced Wall jump.
- Long-press always has tap alternative; animations respect reduced-motion; 48dp effective tap target and accessible names where feasible.
- Verify personal/Cluster/Organization authorization, saved drafts, notification deep links, Android Back, video/audio continuation, ad loading, uploads, failed/retried network calls and safe session switching. The live app must remain unchanged.
- Read recent telemetry in 15/30/60-minute windows by exact build/runtime/update; don't mix different app versions in a 24-hour aggregate.

## Decision record
- `main` is integrated canonical source but only live EAS readback can establish production deployment.
- Unknown/expired fingerprint, missing QA, unverified backend, unregistered staging Firebase, shared EAS channel branch, failed focused tests or unverified installed staging build **blocks** publication.
- The new workflow is intentionally unavailable for dispatch until present in the default branch through reviewed merge. Merge does not automatically trigger production since canonical prod jobs require separate explicitly prefixed commit messages; verify release triggers again at merge time.
- Avoid claiming manual prerequisites are none if exact installed staging and live OTA records still require owner/device/operator verification.
