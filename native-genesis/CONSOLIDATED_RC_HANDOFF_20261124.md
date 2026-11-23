# BUKLOD Genesis — consolidated staging RC handoff (24 Nov 2026)

**STATUS: PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS. DO NOT PUBLISH.**

## What was actually reconciled
- MAIN `9aed7d6` is now an explicit parent of merge `fe3c4e5`. Exactly **94** MAIN-changed paths were source-audited: **86** byte-identical, **8** intentionally preserved newer Genesis variants with proof tokens and regression contracts under `.buklod/reconciliations/genesis-206-mainline-carryover-20261124.json`. Source SQL/production release markers are retained **without running migrations or releasing production**.
- Added the separate no-Expo Kotlin/Godot DEV Android host source under `native-genesis/`. **It is not the BUKLOD app**; the parity matrix still marks features unimplemented.
- Focused CI <https://github.com/faust-0612/BUKLOD-Rork/actions/runs/45235534758>: **66 cases, 65 passed, 1 skipped, 0 failed**, entirely source-level.
- Fixed malformed older DEV Arena YAML and the old 2.0.4 workflow YAML colon-label bug. That does **not** certify their old release workflows passed.

## Game content vs native runtime
The previous owner-private **54,631,620-byte** Godot ZIP has fixed digest `d690cbab55010a58273a478984ec5aa787310634bdee04a050bded13de4c7a32`. It carries 22 reviewed CC0 GLBs, 70 recording-based cues and 48 private VFX atlases (925 frames), **not** the five license-unverified private GLBs. This ZIP is **not** an Android APK and has **not** been exported, device-tested, or OTA-published as a Godot PCK. Source 3D preview is not a premium finished 39-mode game.

An OTA to `org.mzbministry.buklod.staging` cannot magically replace its installed Expo/React Native bridge with the separate package `org.mzbministry.buklod.genesis.nativeapp`. Any native bridge change requires a correctly signed new Android APK, not an OTA.

## Safe order of work remaining
1. Finish actual **full-app native parity** and isolate a non-production backend, preserving all 94 reconciled production fixes, security/RLS, AdMob first-view and navigation performance.
2. Verify genuine private asset rights; use paid/vendor files only in the specifically authorized game distribution format.
3. Export an exact Godot 4.7.2 PCK from **the consolidated reviewed content**, integrate with the actual native runtime; inspect loader semantics, assets, memory/storage budget and activity process lifecycle.
4. Locally compile with Android SDK/Gradle and owner's legitimate signer. Verify its exact SHA, application ID, certificate, ABI, native engine and game content. Never artificially pad APK to 800 MB.
5. Android RC checks: launch, reentry/recovery, gameplay/combat/Kingdom/House controls, native GIF/splash, call/PTT audio focus, weak-network and offline behavior, instant dashboard tabs, AdMob fill/prefetch, accurate rank/points security, and rollback.
6. **Only** after independent RC passes and owner acceptance should staging distribution be considered. No automatic production or OTA release.

Automated fail-closed preflight: `node scripts/genesis-206-unified-native-ota-gate.mjs`.
No unverified native/gameplay release may be called complete.
