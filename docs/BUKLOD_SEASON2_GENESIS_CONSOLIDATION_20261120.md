# BUKLOD Season 2 Genesis — Consolidated DEV source (20 Nov 2026)
Official theme: **Genesis: Let There Be Light** · Genesis 1:3 · GALACTIC CREATION.

## Integrated in current isolated branch
- Canonical Season 2 Home/startup brand and one app-wide semantic theme authority, with user palette switches disabled only in non-production Genesis preview.
- Galaxy, orbits, planets, first light and luminous shards in Home and reward ceremony.
- Kingdom portal preserves all thirteen game destinations and the live production fallback, adds a focus-gated vector orbital halo, explicit native Rive display slot and image fallback for unavailable rigs.
- Collection Vault uses previously uploaded owner-source WebP crops (20 core art sheets and 42 individually cut classic designs; 162 class design previews total).
- Preview Kingdom exposes an opt-in cinematic soundscape via the existing local game audio hook. Sound never loads in production from this preview path, and existing game preferences/quiet hours govern it.
- Native dependencies already in repository: expo-audio, @rive-app/react-native, react-native-reanimated, react-native-svg, @shopify/react-native-skia. None newly installed.

## Accuracy and remaining work
No 13 approved production-grade character Rive rig files are present; static original art is displayed until separately sourced and tested. Real-time 3D gameplay, individually mastered Season 2 soundtrack, complete high-resolution original badges, frame-perfect Android rendering, navigation/AdMob runtime tests, and full screen-by-screen audit are **not verified**. Do not market this as ML/COD graphical equivalence.
Neither staging nor production has been modified. No APK, AAB or OTA has been built or served. No automatic activation by date; the earliest authorized launch is Dec 6 with independent release gates.

## Validate
node --experimental-strip-types --test tests/buklod-genesis-living-engine.test.mjs tests/season2-genesis-cinematic-assets-20261120.test.mjs tests/season2-genesis-full-experience-20261120.test.mjs
npx tsc --noEmit
Expo Android bundle/export + device motion/first-view ad/instant navigation checks; verify live EAS hashes before promotion.
