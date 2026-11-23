# BUKLOD Genesis — local-native migration hold (NOT an app or APK)

**Purpose:** fail closed until a genuinely complete, separately installable, no-Expo BUKLOD Android application exists. Do not create a Godot-only placeholder, inflate binary size, or call an Expo-managed build "native-only". The canonical BUKLOD mainline remains untouched.

## Non-negotiable release contract

- **No Expo, EAS, Vercel, cloud builds, OTA, or production deployment.** Android SDK, Gradle and Godot must be installed and run **locally**. This directory is a migration destination, not a current Android project.
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
