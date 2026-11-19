# BUKLOD Genesis: native APK first, OTA only after runtime verification (2026-11-20)

Official seasonal identity: **Genesis: Let There Be Light** · Genesis 1:3. Exactly one season-wide theme; no user-selected palettes in Genesis runtime.

## What this branch actually contains
- Dedicated Android staging preview identity: `org.mzbministry.buklod.staging`, runtime `2.0.0-genesis-preview`, EAS channel `season2-genesis-preview`.
- Existing native dependencies for Rive/Skia/Reanimated/Lottie/expo-audio/expo-updates, local-first Drawer/file-provider, and source for a custom Android IME GIF module.
- Canonical wordmark displayed in native and web startup, five-tab header and managed dashboards, without changing production.
- CI-only gate for source, identity and staging credentials. Exact Android Kotlin/Gradle and signed APK artifact remain unverified until the real build returns.

## Owner directive — all four native SDKs MUST ship in the FIRST Genesis staging APK

There is no longer an approved deferral for the following native foundations:
- **Godot 4.7.2 Android library**, non-exported separate-process Kingdom Activity, and a deterministic local Genesis Creation Godot world pack. Requires actual resolved native AAR and launched scene/device proof; source alone is not verified gameplay or premium art.
- **Media3 Transformer 1.11.1**, native H.264/AAC local-video processing bridge with user-initiated run/cancel and original-video preservation. Actual device codec/heat/fallback acceptance is mandatory before release.
- **Google Play Core app-update 2.1.0**, immediate-update and availability native bridge. A sideloaded preview cannot prove Play availability; no mandatory lock before an actual replacement is available to that device.
- **Google Play Services authorization 22.0.0**, native OAuth consent for `drive.file` with Google identity verification. A registered, package/signature-matched Android OAuth client and verified user-to-Google-subject binding are required before cloud operations. The module is included in source; secure live sync is not yet verified.

Native ABI additions cannot arrive by Expo OTA. The first signed Genesis preview build must include all four, or the signed build must remain **BLOCKED**; do not publish a partial foundation and call it complete.

Still eligible for compatible future OTA after native release: reviewed navigation/Drawer UI, original 13 premium .riv files and mastered licensed audio *only after approved rights and actual media bytes exist*, and JS/UI video/ad lifecycle improvements. Their absence must not be described as completed premium character rigs/music.


## Actual gating / operator
1. Run the isolated GH Actions Genesis staging APK workflow (no OTA) using exact commit on `dev/genesis-season-wordmark-appwide-20261120`; source and release checks must pass.
2. Require staging-only Supabase, staging Firebase client and Expo account secrets. Never ship against BUKLOD MAIN prod backend.
3. On actual successful EAS build, inspect immutable build id, git SHA, runtimeVersion, Android package, channel, signing certificate, artifact digest and installation.
4. Test native GIF input, encrypted Drawer export/restore, first-view AdMob, tab latency, calls/PTT, offline data and actual OTA reception on Android. Do not present source CI as device acceptance.
5. Only after that signed APK is confirmed on an eligible staging installation may a separate, explicitly scoped and source-compatible EAS OTA publish to `season2-genesis-preview` occur. Production Play/OTA remains untouched. Season 2 production activation is separately embargoed until at least December 6, 2026.

**Status:** DEV source; signed APK, physical Android QA and OTA are pending. No automatic production promotion.

## 2026-11-20 build attempts (runtime source snapshot)
- First isolated signed Genesis staging APK workflow **#44597116701**: stopped at preflight; staging Firebase and Supabase GitHub secrets absent.
- Corrected EAS preview fallback workflow **#44597661666**: EAS env:pull required installed Expo plugins; fixed ordering.
- Corrected dependency-first workflow **#44597960808**: EAS Preview env returned **no valid isolated staging Supabase URL/publishable key**. It was blocked before Android build; no signed APK, staging OTA or production change.
- Safe fallback: a separate **offline/non-distributable Android Gradle compile smoke** uses an intentionally unreachable placeholder hostname; it MUST NOT be distributed or treated as a functioning staging APK. Production backend is never used.
- To unblock a usable staging APK, provision a *real separately isolated non-production Supabase endpoint + publishable key* in Expo Preview (or GitHub staging secrets), then rerun the signed staging build workflow. This is a genuine external-environment blocker, not something that can be patched by swapping to the live project.

## Addendum — first native SDK source integration
- Isolated source branch `dev/genesis-required-four-native-sdk-20261120`, draft PR #1017.
- GitHub compile-smoke failed before Kotlin initially because locked Skia `2.6.2` library install scripts were intentionally ignored by npm. The native prebuilt copy script was corrected to the version-specific `scripts/install-libs.js` and must be independently compile-verified.
- The new Godot/Media3/Play/Drive source and Gradle dependency declarations are NOT proof of installed Android AARs. A source-only green workflow cannot release any APK.
- Signed staging APK remains blocked by missing isolated staging Supabase URL/publishable key and must not silently point at production.
