# BUKLOD Genesis consolidated native APK — source reconciliation (2026-11-20)

Status: **DEV AUDIT / BUILD HOLD**, not a signed APK, staging OTA, or production change.

## Authoritative sources
- Genesis visuals, 13 realms, 162 item designs, 40 rank badges: draft PRs #1007, #1009; native truth gate #1011.
- Pending native lab / Smart Drawer / Android keyboard GIF / encrypted Drive SAF / Godot native bridge / scroll-video + AdMob: draft PR #814 (based on an older staging lineage).
- Navigation V2 / drawer / compact Home and Profile: PRs #790, #791, #793, #800, #801, #803. The previously published #791 visual OTA was rejected on device; never blindly port its source.
- Silent OTA next cold launch: draft #1003 (staging), #1005 (production); preserve calls, uploads, offline edits.
- Season 2 rewards are separate, remain locked until an explicitly approved release on/after Dec 6.

## Native APK capability decision
| Capability | Current evidence | Build treatment |
| --- | --- | --- |
| Rive, Skia, Reanimated, Lottie, expo-audio, expo-haptics | Declared in Genesis package.json; actual installed native binary unverified | Keep existing versions; compile and device-test, do not duplicate dependencies |
| Genesis splash, preview runtime | app.config.js / eas.json: non-prod preview runtime 2.0.0-genesis-preview, separate channel | Build only exact preview identity; do not send to staging-user runtime 1.3.2 |
| 13 Rive rigs, mastered Genesis audio | Approved registry empty | Static artwork fallback, no invented media or autoplay |
| Smart Drawer | #814 contains encrypted user-initiated SAF backup and modern Drawer source | Three-way merge by file/function with latest Genesis + navigation, validate per-account encryption and restore; no unapproved cloud sync |
| Android GIF keyboard commitContent | #814 contains bridge code; installed behavior unverified | Port bridge/plugin + composer integration together, preserve ACTION_SEND; test MIME, permissions and cancellation |
| Google Drive OAuth | #814 explicitly lacks registered Android OAuth and authorized token provider | Do NOT activate cloud sync or reuse staging/production credentials; keep SAF picker optional |
| Kingdom native lab / Godot | #814 contains native lab bridge and scenes | Evaluate Android Gradle/ABI, performance, size and licensing before enabling; no assumed full 3D |
| Native media / AdMob prewarm | #814 reviewed changes from #813, but source diverged | Port only verified missing hunks; ensure no offscreen impressions, instant first-view ads and immediate video pause |
| Native OTA download | #1003/#1005 queued, not proven included in Genesis | Integrate carefully with update channel and no forced reload while calls/composition/upload active |
| Navigation V2 and Drawer | Different pending branches and rejected visual staging precedent | Reconcile current Home/Wall/Connect/Profile routes, remove duplicated cards and prohibited drawer items; 21-item acceptance required |

## Mandatory release invariants
1. No production package `org.mzbministry.buklod`, runtime 1.3.2, Play AAB, or Season 1 reward mutation.
2. No nativeqa credentials copied into Genesis staging; any independent Firebase/OAuth identity requires genuine registered credentials and a protected secret.
3. Verify branch ancestry and exact changed-file diff against latest production, Genesis, and each pending source. Never merge old native-lab branch wholesale (diverged 132 ahead / 168 behind at audit).
4. Scope manifest and protected-feature regression tests must include changed source and native plugins, plus ads, navigation, auth, media, offline and privacy.
5. Exact APK must be built, downloaded and verified: package, signing cert, runtime, EAS channel, artifact SHA-256 and successful startup.
6. Android tests: Rive fallback, audio focus/quiet hours, reduced motion, thermal/low-memory fallback, Smart Drawer SAF restore account isolation, keyboard GIF, scroll video, first-view AdMob, instant tab navigation, 21 navigation checks.
7. Publish only compatible preview-channel OTA after matching APK is installed; no Season 2 production activation by date alone.

## Blockers at this audit
Native lab branch and Genesis branch have diverged substantially; no three-way implementation has been verified. Android OAuth credentials for cloud Drive are absent. Approved Rive rigs and mastered audio absent. Signed Genesis APK and on-device acceptance absent. **Do not mark build-ready.**
