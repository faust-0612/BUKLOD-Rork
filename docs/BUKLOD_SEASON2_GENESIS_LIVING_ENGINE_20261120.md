# BUKLOD Season 2 — Genesis Living Engine implementation ledger
Date: 2026-11-20 | APP_ID=buklod-main | Status: DEV CANDIDATE, NEVER A PRODUCTION RECEIPT

## Scope actually implemented in source
- Isolated from canonical main in `dev/season2-genesis-living-engine-20261120`.
- App-wide design/motion/audio contracts and premium-safe, reusable Genesis visual primitives.
- A compact, atmospheric seasonal Home hero on the canonical `/(tabs)/hub` route (both Android and web branch), exclusively behind a **non-production preview flag**.
- A replacement pathway for the existing award/claim celebration: engraved luminous seal, botanical line art, elongated drifting light fragments, premium colors and cinematic reveal. The existing caller remains the sole owner of audio, haptics, verification and reward text.
- Motion is paused when scene loses focus, on reduced-motion settings, app background, video/call focus, or quality constraints. No looping audio, synthetic beeps, backend writes or fabricated rewards.
- No native dependency additions: currently declared `react-native-svg`, Expo gradients and React Native Animated deliver this first foundation.

## Preview switch and embargo
`EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW=true` and `EXPO_PUBLIC_APP_ENV=staging` or `preview` or `development` are both required. The visual gate refuses production unconditionally.
Do not merge into main or publish web, staging OTA or production until the independent Train A production receipt, current Season 2 release restrictions, automated checks and device acceptance are satisfied. December 6 is an earliest launch date, not automatic authorization.
No production runtimeVersion, channel, app.config, points/rewards, character entitlement or RLS changes.

## Premium quality bar / work NOT claimed complete
- No premium original/mastered music or cinematic SFX pack has been delivered and verified. Existing short .wav cues are not a substitute. The feature intentionally remains silent until a licensed and mastered cue registry is approved and device-tested.
- Rive characters need approved segmented rigs and high-resolution artwork. Existing 73–85px collectible thumbnails cannot be promoted into crisp character animation.
- Kingdom requires a separate scene/asset integration, preserving the canonical 13-station map and all route IDs.
- Further screen integration is needed for Wall, Connect, Profile, Character, Kingdom, Bible/KL, seasonal backgrounds, icons, and per-feature reward ceremonies; do not count the shared contracts as completed screens.
- Expo SDK upgrade or new native plugin is NOT performed. Check Firebase, Stream/WebRTC, AdMob, Skia, Rive, and release build compatibility first.
- Actual Android render, GPU/battery/audio performance, accessibility, first-view ads/navigation and downloadable asset integrity NOT verified from this connector-only editing environment.

## Focused source contracts
`node --experimental-strip-types --test tests/buklod-genesis-living-engine.test.mjs`
Then TypeScript/typecheck, Android staging build and real device visual acceptance. Never claim build passed without evidence.

## Completion standard
No generic cartoon fallback, arbitrary random dot confetti, fake level-up, fake reward receipts or beep replacement; make the actual artwork and soundtrack feel game-grade before release. In social surfaces preserve feed speed, audio focus, media ownership, ad visibility and scrolling.
