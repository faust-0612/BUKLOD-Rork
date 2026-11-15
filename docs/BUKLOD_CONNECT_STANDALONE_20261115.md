# BUKLOD Connect — separate Android app / isolated DEV target

BUKLOD Connect is a separately installed Android client. Its private login session, native package identity, OTA channel, and branded apple-green design are isolated from Main. Existing Supabase users, org/sub-org/cluster membership, personal/community inbox and threads, media, message reactions and requests, user search, in-thread audio/video calls, Stream presence, PTT CH01–CH10, scoped floors, press-and-hold RX/TX, SOS/priority, and consent-gated PTT transcript/chat are reused from BUKLOD; do not fork the messaging database or invent new permissions.

| | Connect staging | Connect production |
|---|---|---|
| Android package | org.mzbministry.buklod.connect.staging | org.mzbministry.buklod.connect |
| Deep link | buklod-connect-staging | buklod-connect |
| EAS build profile | connect-staging (APK) | connect-production (AAB) |
| EAS OTA channel | connect-staging | connect-production |
| Runtime | connect-1.0.0 | connect-1.0.0 |

Both build profiles set BUKLOD_APP_TARGET=connect and EXPO_PUBLIC_BUKLOD_APP_TARGET=connect. Main remains unaffected. Existing MAIN OTA channel and runtime 1.3.2 are not reused.

## Build prerequisites — fail closed, no guessing
- Create a dedicated Expo/EAS project ID and set CONNECT_EAS_PROJECT_ID in the relevant build environment. DO NOT reuse Main's EAS_PROJECT_ID.
- Register the two Connect Android package IDs separately in Firebase (and configure Stream's connect-specific push providers), save the appropriate config JSON as CONNECT_GOOGLE_SERVICES_FILE for each profile. DO NOT reuse BUKLOD's production/staging google-services file.
- Connect ads are deliberately disabled until independent monetization is approved; native SDK uses Google's test app ID, never Main's AdMob ID. No separate Connect AdMob registration is required to build the initial staging app.
- Configure Android signing for the new package without reusing Main application signing by default.
- Verify routing back to Connect from auth, message/call/PTT channel state and hard end-to-end security on actual Android hardware. A source test cannot certify microphone or incoming call behavior.

## Build & rollout
1. With the dedicated EAS/Firebase setup: eas build --platform android --profile connect-staging.
2. Install the separate staging APK and run device QA on auth, personal/community rooms, attachments, notifications, calls, mic, SOS, channel switching, background PTT, captions opt-in and network recovery.
3. Only after signed build + native acceptance: freeze Connect RC, publish only to Connect production channel, then verify the exact target runtime. Never auto-publish to Main.

## Existing limitations
Offline Nearby PTT options already exist in the reused screen, but the screen itself explicitly reports when proximity transport is not available. Do not claim offline-nearby voice works on unsupported devices. A fresh native APK is required to include the PTT hardware plugin; an OTA cannot install new native libraries.

## Status
This source integration is DEV-only until EAS credentials, Android build, push configs and end-to-end verification succeed.

## Focused staging build automation

The isolated `BUKLOD Connect — Isolated Staging APK` workflow performs source tests and *gates costly builds* on dedicated `EXPO_TOKEN`, `CONNECT_EAS_PROJECT_ID`, `CONNECT_STAGING_FIREBASE_JSON_B64` (new Firebase Android app for `org.mzbministry.buklod.connect.staging`), `CONNECT_EXPO_PUBLIC_SUPABASE_URL`, and `CONNECT_EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It validates Firebase package identity, writes temporary client config only in the runner, runs TypeScript and Expo config checks, then invokes `eas build --profile connect-staging`. No main or production OTA is published.

## Verified Expo account — 2026-11-15
Dedicated Expo project successfully created at `@faust_0612/buklod-connect`, ID `fbc71093-6abb-43e6-9493-14b2c8117df8` (Expo CLI GitHub Actions log). The CLI returned nonzero only because the dynamic app config could not be written automatically; this commit pins the independent ID explicitly in code and build profiles. No Main Expo ID changes. Firebase standalone Android client still requires registration to build the staging APK.

## Independent update policy

Connect's first version is `1.0.0`, and the existing `get_client_runtime_config` RPC currently computes Main's mandatory native minimum version. To avoid directing Connect users to install an incompatible Main APK, the standalone root does not adopt Main's `update_required` cutoff. Global maintenance mode, pilot access, authentication and privacy gates remain in place. An explicit per-Connect feature flag `features.connect_standalone_update_required === true` displays a Connect-only blocking update screen, without a fabricated download URL. Dedicated Connect release-version policy and a verified distribution URL must be provisioned before production rollout.
