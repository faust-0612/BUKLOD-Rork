# BUKLOD MAIN — Genesis Full-Game Native Completion Gate (2026-11-22)

## Canonical release target
One BUKLOD MAIN staging Android APK, official Season 2 **Genesis: Let There Be Light**, with the Godot 4.7.2 engine embedded natively inside React Native/Expo 57. Android staging package `org.mzbministry.buklod.staging`. The existing React Native/social/profile/navigation backend and production package stay intact. No second game app.

## Already present in unified native source
- Android: Godot 4.7.2 AAR, embedded zip main-pack with 4 guarded scenes (Arena, Kingdom, Personal Community, House/Lot) and Expo native bridge.
- Other baseline native Android capabilities: Media3 transformer; Play Core in-app updates; Google Drive AuthorizationClient; GIF keyboard/IME support; Skia/Rive and media/audio runtime from Expo/React Native stack.
- Approved local image/sound packs: 68 Godot Arena map/actor assets and Genesis Kingdom, Community, House preview art + four existing estate sound cues.
- Offline Godot practice: 13 hero catalog IDs, three maps, temporary 300-pickup definitions, combat/CPU, villagers, buildings, towers, resource mining, team bases and no financial reward authority.
- This isolated DEV change: owner-approved **13-hero combat design JSON**, six original `.gd` scripts embedded in Godot main pack, seven individually named special hero GDScript actions (21), fixed skill cooldowns and shield/LOS bounds; Godot-native automated tests.

**Important:** Owner hero design source identifies exactly 13 heroes: 5 base (Phan, Quin, Van, Christian, Lhen) and 8 special (Ace, ELESUR, Jawo, Mitch, Niel, Angel, Vhen, Trudice). The internal ID `ellusur` is preserved for compatibility; the displayed canonical name is **ELESUR**. The source design remains **DESIGN ONLY** until gameplay and art are independently verified.

## Source branches not yet reconciled into this native RC
- `dev/arena-genesis-minion-waves-art-20261122` — new minion wave behavior/assets/animations
- `dev/arena-villager-actors-art-motion-20261122` — two-team villager identity sprites and movement
- `release/genesis-ptt-sos-conso-staging-ota-prep-20261122` — emergency audible/overlay + PTT persistence; includes server migration which must NEVER be blindly applied to production
- `fix/lesson-checking-all-mentor-options-20261122` and `integration/nonseason2-production-ota-intake-20261122` — lessons/mentoring/admin/notification and PTT feature changes on a divergent source baseline; require audited three-way source merge and separate DB migration proof
- Last existing React Native Arena retains additional audio, tactics, UI/animation, camera and multiplayer display paths not yet equivalently implemented natively. **Do not remove fallback until parity checks.**

## Mandatory before claiming FULL native game
1. **Arena:** native Godot 13 hero animations/skills/passives/ultimate, hit effects, cover/LOS, all minion waves, villagers, tower destruction and item acquisition/visual effects, premium art/audio, controller/HUD customization, audio focus/PTT. Full bot/online match parity in gameplay, authority and anti-cheat, plus usable social/inventory integration.
2. **Kingdom:** actual interactive scenes, real characters and distinct station activities (not cosmetic station markers); 39 planned variants, proper Character System authority; cosmetics and inventory are verified server events, not player/client-controlled.
3. **Personal Community and House/Lot:** real playable villager/world activities, distinct Level 1–10 construction stages, materials, server-verified contribution and endless Mastery; no BP minting from businesses, no forged ownership.
4. **New native/Android:** include every required native module in one APK with exact versions, ABI support and game/audio lifecycle/keyboard/ads/3G performance. Do not add unrelated SDKs just to appear complete.
5. **Backend isolation:** dedicated Genesis staging Supabase project, authorization/RLS, SOS permissions, world/match snapshots and published migration tests. Do not use the live BUKLOD MAIN project for unverified simulation.
6. **Source reconciliation:** compare all pending named workstreams against the exact unified head, integrate only compatible changes; run comprehensive anti-regression tests for AdMob first-view fill/nav responsiveness, spacing, SOS, PTT, Wall/Connect, lesson/mentoring, user privacy and rewards.
7. **Installation/release:** EAS signed release requires exact current staging signing certificate `b2470c2dfa865dd670293ee283cbb55463faf486af4e33a514c3e843289e41a9`, new native runtime, actual downloaded APK byte-for-byte Godot pack check, installation over existing staging on Android, device QA and explicit verified RC. Never distribute Gradle debug APK as an EAS update.
8. **Production:** remains unchanged; no Play/Expo OTA/forced minimum native version until accepted and available in production.

## Evidence discipline
A `BUILD SUCCESS` from an offline arm64 Gradle debug APK or Godot headless script **does not mean** EAS signing continuity, installability over existing staging, all-world gameplay parity, functional isolated Supabase, physical-device UX or production release. `signedReleaseReady` stays **false** until the release gates are evidenced; never flip the boolean merely to run a paid EAS build.

## Source docs consulted for packaging approach
- Godot 4.7 Android Library embedding: https://docs.godotengine.org/en/4.7/tutorials/platform/android/android_library.html
- Godot embedding with main pack relative to Android assets: https://docs.godotengine.org/en/stable/tutorials/platform/android/android_library.html
- Expo SDK 57 native prebuild/module configuration: https://docs.expo.dev/workflow/continuous-native-generation/
