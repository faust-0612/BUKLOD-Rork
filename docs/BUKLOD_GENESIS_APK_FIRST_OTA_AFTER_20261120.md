# BUKLOD Genesis: native APK first, OTA only after runtime verification (2026-11-20)

Official seasonal identity: **Genesis: Let There Be Light** · Genesis 1:3. Exactly one season-wide theme; no user-selected palettes in Genesis runtime.

## What this branch actually contains
- Dedicated Android staging preview identity: `org.mzbministry.buklod.staging`, runtime `2.0.0-genesis-preview`, EAS channel `season2-genesis-preview`.
- Existing native dependencies for Rive/Skia/Reanimated/Lottie/expo-audio/expo-updates, local-first Drawer/file-provider, and source for a custom Android IME GIF module.
- Canonical wordmark displayed in native and web startup, five-tab header and managed dashboards, without changing production.
- CI-only gate for source, identity and staging credentials. Exact Android Kotlin/Gradle and signed APK artifact remain unverified until the real build returns.

## Release decision: safely deferred from the *first* foundation APK
- Godot Android Library AAR / 3D Kingdom: **not installed**; requires future **new APK** if implemented.
- Media3 native video compression/transcoding: **not installed**; requires future **new APK** if implemented.
- Google Play Core in-app-update UI: **not installed**; requires future **new APK** if implemented. A server-side mandatory-version gate cannot itself supply Play Core.
- Direct Drive OAuth SDK: held until a verified Android OAuth client, signing SHA and proper account binding; adding native authentication dependency requires a new APK.
- 13 premium rigged .riv files and mastered soundtrack: **not present**. They can follow by compatible OTA/assets only if native runtime supports them; do not advertise uninstalled animation or paid audio.
- Navigation V2/Drawer layout, silent next-launch OTA UI, and media prefetch/scroll-stop algorithms can be integrated later by compatible JS OTA unless they introduce new native code.

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
