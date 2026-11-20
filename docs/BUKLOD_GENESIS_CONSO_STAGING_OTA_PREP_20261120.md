# BUKLOD Genesis — Consolidated Staging OTA PREP (20 November 2026)

## Scope and authoritative source
The Android staging APK was reported installed from EAS build `d9e279a6-766b-4bd9-8316-3f700749594c`, Git source `5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0`, runtime `2.0.0-genesis-preview`, package `org.mzbministry.buklod.staging`, and channel `season2-genesis-preview`. The signed artifact has NOT been independently re-attested in this preparation.

This OTA-only branch inherits Genesis avatar reconciliation and Galaxy visual changes, with the missing Connect inbox backdrop and contrast/integrity regression checks. A source-only OTA is not a substitute for native Android verification.

## Exact native isolation
- `app.config.js` has been restored by SHA to the installed APK source version. Other native input files and native module source must match the installed commit byte-for-byte.
- The new **native splash and Android adaptive-icon** source in the DEV branch cannot change an existing installed binary by OTA. It stays in the next signed APK workstream. The existing native startup may still display the old image before JavaScript loads.
- Post-build JavaScript, React Native UI and bundled image assets can be OTA-compatible only when all referenced native modules are actually present in the APK. The existing module tree/package lock are unchanged, but real device behavior remains unverified.

## Existing user-facing functionality preserved
Home, Wall, Connect, Cluster, Organization, Profile, ads, shared live-account backend access as previously authorized, onboarding and Season 2 preview locks. No database mutation, rewards minting, native-version gate, Play Store or production OTA.

## Mandatory publication gate
1. CI must pass native parity source preflight + Galaxy/contrast/wall/Cluster/Connect/Season 2 embargo tests on exact OTA candidate SHA.
2. Run focused TypeScript/Metro bundle regression checks. This source preflight does **not** establish a clean native bundle or successful Android installation.
3. Confirm exact installed APK EAS ID/source SHA/runtime/channel, with currently installed build and test device evidence.
4. Verify first-view ads on all primary dashboards, tab latency, scrolling, note rail, Cluster, Connect, nighttime and light text contrast, weak network/reconnect and no regressions; reverify Android motion/reduced-motion.
5. Only then publish to `season2-genesis-preview` under a separately authorized staging-only step; compare EAS update receipt/branch/runtime and verify the update on installed staging APK. Never publish to `production` or `staging-user` as a substitute.
6. Season 2 production activation stays locked until authorized for December 6, 2026 or later.

## Release state
SOURCE PREPARED; NO OTA PUBLISHED; native build/splash follow-up and real-device acceptance remain open. The current workflow contains no EAS token and no OTA publish command.

## November 20 — Cluster, scoped Community Wall and Connect Seen source consolidation

- Owner screenshot follow-up PR [#1021](https://github.com/faust-0612/BUKLOD-Rork/pull/1021), merged into this **staging-only release-candidate source** at commit `54a5e179d101fbce7aa2c1798d65e88495d0a2bb`. Both Engineering Accountability and Main-side source/TypeScript/web integration CI succeeded on the PR exact head before merge. This is not an OTA receipt.
- Cluster directory reuses the official Genesis Creation artwork behind transparent scrolling, and ambient movement runs only while the screen is focused and reduced motion permits.
- Organization/Cluster scoped Community Wall now renders over the existing Genesis sky, not the previously opaque `#F5F8FD` feed surface. Existing cards, video handling, interaction and AdMob placements are retained.
- Connect Seen avatars use separated slots sized for ranked/note-bearing profile thumbnails. Up to three avatars appear; the balance is shown as `+N`; the visible latest time is taken from an authorized *room* read cursor. Tapping opens the individual readers/time sheet. This does not claim a per-message receipt or create backend writes.
- Added focused read-only source regression checks to the Genesis staging preflight, including ad first-view and navigation contracts. The preflight must pass on the **final current head** before any release authorization.

**Current candidate rules:** Do not trigger the older `BUKLOD_GENESIS_STAGING_OTA_PUBLISH_20261120:` action until its frozen-source guard has been explicitly pinned to the exact consolidated source and an authorized, verified release event has been recorded. A build/runtime EAS check, native-app signed-artifact verification and physical device/AdMob navigation QA are still required. The prior EAS staging update, if any, cannot be used as evidence that these new fixes are on devices.

**Status:** Source merged into consolidated staging branch. Production and main untouched. New fixes NOT published as OTA; Android acceptance still pending.
