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
- Register Connect in AdMob and supply CONNECT_ADMOB_ANDROID_APP_ID before any production build. When absent during local/dev, only the Google test app ID is used. Ads and push delivery require their own full end-to-end verification.
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
