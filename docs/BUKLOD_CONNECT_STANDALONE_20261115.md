# BUKLOD Connect — dedicated Android package for QA and release

BUKLOD Connect is a separately installed Android client. Its private login session, native package identity, OTA channel, and branded apple-green design are isolated from Main. Existing Supabase users, org/sub-org/cluster membership, personal/community inbox and threads, media, message reactions and requests, user search, in-thread audio/video calls, Stream presence, PTT CH01–CH10, scoped floors, press-and-hold RX/TX, SOS/priority, and consent-gated PTT transcript/chat are reused from BUKLOD; do not fork the messaging database or invent new permissions.

| | Connect internal QA APK | Connect production |
|---|---|---|
| Android package | org.mzbministry.buklod.connect | org.mzbministry.buklod.connect |
| Deep link | buklod-connect | buklod-connect |
| EAS build profile | connect-qa-apk (APK) | connect-production (AAB) |
| EAS OTA channel | connect-qa | connect-production |
| Runtime | connect-1.0.0 | connect-1.0.0 |

Both build profiles set BUKLOD_APP_TARGET=connect and EXPO_PUBLIC_BUKLOD_APP_TARGET=connect. Main remains unaffected. Existing MAIN OTA channel and runtime 1.3.2 are not reused.

## Build prerequisites — fail closed, no guessing
- Create a dedicated Expo/EAS project ID and set CONNECT_EAS_PROJECT_ID in the relevant build environment. DO NOT reuse Main's EAS_PROJECT_ID.
- Register the single Android package `org.mzbministry.buklod.connect` in Firebase project `buklod-efa4a`. Use that app's `google-services.json` for internal QA and production. Validate its exact `client_info.android_client_info.package_name`; DO NOT reuse the Main Android client configuration. Maintain Connect-specific push identity and credentials for Stream where needed.
- Connect ads are deliberately disabled until independent monetization is approved; native SDK uses Google's test app ID, never Main's AdMob ID. No separate Connect AdMob registration is required to build the initial staging app.
- Configure Android signing for the new package without reusing Main application signing by default.
- Verify routing back to Connect from auth, message/call/PTT channel state and hard end-to-end security on actual Android hardware. A source test cannot certify microphone or incoming call behavior.

## Build & rollout
1. With the dedicated EAS/Firebase setup: eas build --platform android --profile connect-qa-apk. It uses the production Android application ID but the separate `connect-qa` update channel.
2. Install the separate staging APK and run device QA on auth, personal/community rooms, attachments, notifications, calls, mic, SOS, channel switching, background PTT, captions opt-in and network recovery.
3. Only after signed build + native acceptance: freeze Connect RC, publish only to Connect production channel, then verify the exact target runtime. Never auto-publish to Main.

## Existing limitations
Offline Nearby PTT options already exist in the reused screen, but the screen itself explicitly reports when proximity transport is not available. Do not claim offline-nearby voice works on unsupported devices. A fresh native APK is required to include the PTT hardware plugin; an OTA cannot install new native libraries.

## Status
This source integration is DEV-only until EAS credentials, Android build, push configs and end-to-end verification succeed.

## Focused staging build automation

The isolated `BUKLOD Connect — Production-Package QA APK` workflow performs source tests and gates costly builds on `EXPO_TOKEN` and repository Actions secret `CONNECT_FIREBASE_JSON_B64` (Base64 of `google-services.json` for package `org.mzbministry.buklod.connect`). The dedicated EAS project ID and *public* Supabase client configuration are pinned to the Connect QA profile. It verifies Firebase package identity, writes a temporary JSON only in the runner, validates TypeScript/Expo config, and invokes `eas build --profile connect-qa-apk`. No Main OTA or Connect production OTA is published.

## Verified Expo account — 2026-11-15
Dedicated Expo project successfully created at `@faust_0612/buklod-connect`, ID `fbc71093-6abb-43e6-9493-14b2c8117df8` (Expo CLI GitHub Actions log). The CLI returned nonzero only because the dynamic app config could not be written automatically; this commit pins the independent ID explicitly in code and build profiles. No Main Expo ID changes. Firebase standalone Android client and Actions secret `CONNECT_FIREBASE_JSON_B64` still require confirmation before the internal QA APK can build.

## Independent update policy

Connect's first version is `1.0.0`, and the existing `get_client_runtime_config` RPC currently computes Main's mandatory native minimum version. To avoid directing Connect users to install an incompatible Main APK, the standalone root does not adopt Main's `update_required` cutoff. Global maintenance mode, pilot access, authentication and privacy gates remain in place. An explicit per-Connect feature flag `features.connect_standalone_update_required === true` displays a Connect-only blocking update screen, without a fabricated download URL. Dedicated Connect release-version policy and a verified distribution URL must be provisioned before production rollout.
