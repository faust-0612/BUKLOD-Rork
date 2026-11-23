# BUKLOD Genesis — local-native migration hold (NOT an app or APK)

**Purpose:** fail closed until a genuinely complete, separately installable, no-Expo BUKLOD Android application exists. Do not create a Godot-only placeholder, inflate binary size, or call an Expo-managed build "native-only". The canonical BUKLOD mainline remains untouched.

## Non-negotiable release contract

- **No Expo, EAS, Vercel, production OTA or release publishing.** An owner-approved exception allows **GitHub Actions Android compile diagnostics** on an isolated DEV branch. Local-only full signed release remains blocked on missing parity, assets, new backend, signer and real device proof.
- Distinct application ID: `org.mzbministry.buklod.genesis.nativeapp`, **not** BUKLOD MAIN `org.mzbministry.buklod` or existing staging `org.mzbministry.buklod.staging`. A brand-new, separately scoped test backend is mandatory; use `GENESIS_NATIVE_STAGING_SUPABASE_URL` and `GENESIS_NATIVE_STAGING_SUPABASE_PUBLISHABLE_KEY` only through a secure local environment. Never reuse MAIN credentials.
- Complete BUKLOD application parity must be migrated from the canonical current product, including protected AdMob first-view/lifecycle, navigation, accounts/RLS, Cluster, Wall, Connect/PTT, Profile, Bible/offline, character and rewards. `parity.json` is **not ready**. Every feature needs actual device evidence before `verified` is ever set.
- Godot Arena **and** all Kingdom/community/house scenes, 13 animated heroes, progression, authoritative points, actual controls, NPC/combat, landscape audio focus and premium effects must run in this Android host, not just as screenshots/previews.
- Native Android splash, real keyboard GIF content input and in-app media/audio must be integrated and tested with UI recreation, process death, weak signal and calls. Do not mark as verified based on a static source check.
- Original licensed art/music may be staged only with rights evidence, real file hash and playable usage in `approved-assets.json`. Library archives must be inventoried and licensed first. A target APK size of **at least 800 MB** is a hard owner gate, **not** permission to add padding, filler, repeated assets or inactive ZIPs.
- Verify source, ABI, package ID, signing fingerprint, embedded Godot assets, first frame and 2nd entry, splash/GIF, offline gameplay, audio, navigation, AdMob and backend isolation against the **exact** signed local APK. Compare current `main` production fixes before creating RC. No production/OTA changes from this directory.

## Zero-credit local preflight

When a real native Android project, gameplay integration, approved assets and evidence exist here, run from repo root:

```bash
node --test tests/genesis-native-local-only-gate-20261123.test.mjs
GENESIS_NATIVE_STAGING_SUPABASE_URL=https://<new-test-project>.supabase.co \
GENESIS_NATIVE_STAGING_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
node scripts/genesis-native-local-only-gate.mjs
```

After a **local** signed build, pass `--apk=/absolute/path/to/buklod-genesis-native-staging.apk` and set `GENESIS_NATIVE_SIGNING_CERT_SHA256` to its independently verified authorized certificate fingerprint. This gate is read-only and cannot create an APK, run Android tests or certify gameplay by itself.

**Initial state:** the source still uses Expo modules and an Expo native bridge. This hold must not be bypassed just because a 39.8 MB Godot preview ZIP exists or an APK reaches 800 MB.

## 23 November 2026 — native Android host DEV foundation

A **real independent Android Gradle source tree** now exists under `native-genesis/android`.
It is **not yet a compiled APK** or migrated BUKLOD app. It is an offline-first engineering
host with these source implementations:

- Java/Kotlin Android app identity `org.mzbministry.buklod.genesis.nativeapp`;
  this never replaces production or the installed BUKLOD staging application.
- Non-exported, landscape Godot Android Activity using Godot Android AAR 4.7.2.
  The only permitted engine payload is bundled `res://godot/empire-arena.pck`.
- Threaded bundled-pack SHA-256 verification *before* enabling the Arena DEV entry.
  The exact PCK must be created with a local Godot export preset; none is fabricated.
- Android 12 system native splash and green-B **temporary DEV** vector. Original
  approved mark is still required for final art parity.
- Android keyboard GIF MIME receipt with temporary URI permission, 8 MiB limit,
  GIF magic check, app-private atomic cache copy, and local animated preview.
  There is intentionally no message publish/upload or member-data network access.
- Gradle-only, local-only build gate; owner signing env and real full-app verification
  required for release. No wrapper executable/JAR is invented. Generate via a
  locally trusted Gradle distribution once Android SDK and Godot are installed.

Godot 4.7 documentation: https://docs.godotengine.org/en/4.7/tutorials/platform/android/android_library.html

### Source test and actual hold

`node --test tests/genesis-native-local-only-gate-20261123.test.mjs tests/genesis-native-android-host-20261123.test.mjs`

`node scripts/genesis-native-local-only-gate.mjs`

The second command **must fail** until real app parity, approved local assets,
backend isolation, real native build toolchain, signer and device evidence exist.
Do not set `implemented` or `verified` true based on this new Android host.
`native-genesis/prepare-pack-local.sh` exports a genuine local PCK only if a
Godot export preset is already present; it does not certify gameplay quality.

### Verified vs unverified

Current source and 11 Node checks: examined; Android SDK, Godot editor, wrapper,
APK, app startup, Gboard GIF delivery, green-B splash, ads and device UI: NOT VERIFIED.
No owner auth, Cluster, Wall, Connect, Bible, economy, ad SDK or full 39-game
integration is claimed. A temporary lab launcher is deliberately gated.

## Native next increment — 23 November 2026 (DEV, not Android build)

- Four fixed local engine choices: Arena development gameplay; Kingdom, Personal Community and House **visual previews**. Only in-APK `empire-arena.pck` and verified SHA-256 are eligible. Every other scene string is rejected by a shared, Android-independent Kotlin contract.
- Native launcher persists `pending_unconfirmed_launch` synchronously **before** starting a private Godot process. Returning from/crashing that process never counts as successful gameplay. The user must explicitly reset this DEV safety marker to retry. There is no forced relaunch or unverified success claim.
- GIF input uses a single bounded worker (maximum two queued tasks), MIME/size/magic checks, temporary content permissions, atomic app-cache copy, and a ten-file preview cache. There is no network upload or member message send.
- `scripts/genesis-native-local-only-gate.mjs` now checks `assets/godot/empire-arena.pck` rather than the previous ZIP filename; this matches `prepare-pack-local.sh` and the Godot Activity. It still rejects the missing backend/asset parity and absent Android toolchain.
- The essential launcher/pack policy is **actually compiled with `kotlinc` on JVM and executed** in `tests/native/GenesisNativeContractSmoke.kt`; that is not an Android compile, Godot runtime test, or proof of premium gameplay.
- `MAIN_CARRYOVER_20261123.md` records outstanding MAIN features; no production release, OTA, or full BUKLOD replacement is authorized.

## GitHub Actions narrow exception — 23 November 2026

- Diagnostic workflow: `.github/workflows/genesis-native-gha-diagnostic-20261123.yml` on isolated `dev/genesis-native-gha-diagnostic-20261123`; only a matching workflow-file push and `GENESIS_NATIVE_GHA_DIAG:` commit is eligible. It runs focused source tests and `processDebugMainManifest/compileDebugKotlin/compileDebugJavaWithJavac` only.
- Runner has read-only access, no credentials/secrets, no Expo/EAS/Vercel, no Godot game export, no APK assembly, no upload/publish, no backend access. Bounded to 16 minutes, concurrency-cancelled, Gradle cache disabled to avoid Actions cache storage costs.
- The run is intentionally **not evidence of full BUKLOD app parity** and cannot turn any `parity.json` entry verified. The existing release gate must remain red for incomplete backend, approved assets and game/application functionality.
- GitHub allows manual `workflow_dispatch` from the Actions UI **only after a workflow file exists on the default branch**. This exception does not authorize adding anything to `main` solely to activate the manual button; this one-shot, exact DEV-branch push is the diagnostic trigger.
- No GitHub hosted runner can prove real Android device compatibility, premium 39-game gameplay, 800+ MB asset quality or production safety merely by compiling Kotlin.
