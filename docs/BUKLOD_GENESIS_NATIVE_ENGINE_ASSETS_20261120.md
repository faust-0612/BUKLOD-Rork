# BUKLOD Season 2 — native-engine and premium asset intake
Status: DEV-only research and integrity foundation · 2026-11-20 · NOT AN APK/OTA.

## Approved artistic target
Genesis: **Let There Be Light**, Creation cosmos. Real planets, starfields, moving light fragments, divine creation expressed through illumination without depicting God's physical appearance. No cheap placeholder 2D circles, rigid bobbing sprites, or unmastered beeps should pass graphical acceptance.

## Technology architecture
- **Kingdom immersive scene: Godot Android Library (AAR)** hosted inside a separate Android Activity/Fragment, bridged to React Native by a small scoped native module. Godot scene returns *events only*; backend Character System remains the sole XP, ranks, inventory and reward authority. Built-in 3D particles, material shaders, skeletal characters, occlusion, animation trees, glTF environment. Android fragment embedding documented at https://docs.godotengine.org/en/stable/tutorials/platform/android/embedding_in_android_projects.html .
- **Rive Nitro** for authored Character rig state machines, interactive badges, illuminated menu elements; do not substitute animated PNG translation for real joint animation. Expo SDK 57 and RN 0.86 compatibility must be compiled and checked on exact AAB; inspect current package API (useRiveFile URL vs URI) before changing imports. See https://github.com/rive-app/rive-nitro-react-native .
- **Skia 2.6 + Reanimated 4.5** for screen-level GPU background shader, emission, orbit lines, reward particles; avoid GL on feed/AdMob and stop loops on tab blur or AppState background.
- **expo-audio** for user-enabled, mastered real music and layered SFX; honor focus against ads, calls, video, mute, and no autoplay in social feed.
- Alternative: Godot as standalone APK is lower-risk for fast native proving but would split member sessions/UI; use embedded SDK only after exact experimental build. A React Native-only painted atlas cannot deliver the requested 3D Kingdom or fully rigged 13 characters.

## Sourced original/open candidates (not downloaded or integrated)
- Kenney Skyboxes Space CC0: https://kenney.nl/assets/skyboxes-space
- Kenney Modular Space Kit CC0: https://kenney.nl/assets/modular-space-kit
- Kenney Space Kit CC0: https://kenney.nl/assets/space-kit
- Poly Haven HDRIs/textures/models are CC0, choose exact model/page: https://polyhaven.com/license
- Freesound is per-sound licensing (not site-wide CC0); choose individual CC0 cues: https://freesound.org/help/faq/
- Owner-approved BUKLOD badges/character paintings remain the only source of character identity. Do not claim 73px thumbnails are hi-res segmented rigs.

No binaries, .riv files, approved master recordings or new Kotlin/Godot AAR were obtained during this task. Current connector can inspect public text files but rejects binary GitHub files; external downloads from the tool runtime were unavailable. License clearance and a high-quality asset-authoring pass are separate work.

## Asset intake & fail-closed acceptance
Run `node scripts/genesis-native-asset-gate.mjs --audit` to inspect metadata (candidate mode, no assertion assets acquired).
Run `node scripts/genesis-native-asset-gate.mjs --release` to block release without **four physically present approved roles**, checked exact SHA-256, bounded file size, license and attribution/rights evidence, plus audio mastering metadata.
After bytes imported, verify *real media decode*, alpha-edge quality, source resolution, texture compression, Rive state transitions, audio rights and listening tests. Integrity hash is not image/audio quality proof.
Benchmark actual Android low-end/3G navigation, first-view AdMob rendering/fill, 30/60 FPS dynamic quality targets, memory, audio focus, accessibility and crash-free scene switching. Scene should unload when leaving Kingdom.
Full Kingdom Godot integration requires a **new signed native APK/AAB**, never merely an Expo OTA. Keep Season 2 preview behind nonproduction flags until earliest December 6 and separately authorized verified RC. Production Season 1 untouched.
