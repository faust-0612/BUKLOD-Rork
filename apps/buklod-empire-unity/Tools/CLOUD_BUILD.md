# Cloud-first Android development
Only the isolated Unity project is in scope. The Unity Cloud target is manually configured by the owner; this repository does not contain tokens, signing credentials, or production backend secrets.

- Branch: dev/empire-integrated-apk-readiness-20261124
- Project path: apps/buklod-empire-unity
- Android application ID: org.mzbministry.buklod.empire
- Debug signing for development; APK; automatic builds off.
- Unity 6000.0.86f1 is pinned in ProjectVersion.txt before the first build (the October 2026 Brotli and certificate advisories identify 6000.0.85f2 as the first fixed release). Verify availability in the cloud target; do not silently choose the closest version.
- Use the account's available free machine and verify allowance before compiling. No paid upgrade, automatic overage, or Boost Disk without explicit approval.

The AndroidBuildGuard automatically rejects the wrong application ID and missing/invalid enabled scenes. The guard also requires the pinned editor and a complete visual catalog with nine distinct animation clips per hero, matching Animator parameters and a rights/art review receipt. This is a source safety gate, not a release approval. No additional dashboard script hook is required for this guard.

Before the first build: configure the actual Android player settings and scenes; integrate URP, touch input, navigation, canonical gameplay, and verified original assets; configure working EditMode and PlayMode tests. Package references alone are not implementation. No APK is approved until the actual Unity build, complete offline match, visual acceptance, and device tests succeed. Production/staging remain untouched.

## Integrated hybrid readiness (local-first, no automatic build)
Use the integrated branch, not the separate historical graphics or gameplay branches. Production assets are still required: `Assets/Production/VisualCatalog.asset`, its genuine provenance receipt and approved prefab/animation references, URP settings, scene and NavMesh. Assemble via `ArenaSceneComposer.PrepareCloud` only after importing approved assets. The catalog now also requires separate building models, all wilderness/resource prefabs and distinct pickup types. Review-only imports are not acceptable for APKs. Run EditMode and PlayMode tests and retain real XML/logs for the exact source SHA; verify a full match and Android package identity. Do not start a paid cloud build or bypass gates. This document is not an approval receipt.

### Local read-only audit
From this project directory run `node Tools/apk-readiness.mjs`. It checks the committed project inputs without invoking Unity, npm install, cloud builds, or deployment. A missing production catalog, URP settings, scene or generated NavMesh is a hard blocker. Even a passing file check is not Unity compilation, asset-rights verification, EditMode/PlayMode acceptance, or an approved APK. The actual Android build guard remains authoritative for editor-side catalog and scene validation.

## Integrated editor-only rehearsal
Run `node Tools/wildlife-review.mjs` before `BUKLOD Empire/Assemble offline gameplay review` (after the existing hero/faction candidate import and URP configuration). The offline review composer now imports hash-checked wildlife/resource candidate prefabs directly and binds them to match simulation. This is still editor-only. No catalog receipt, production scene or APK is created by review assembly. The Android guard requires the exact production scene and its genuine catalog dependency, not a substitute review scene.

## Explicit local offline test APK (supersedes earlier blanket APK prohibition only for the isolated test package)
No Unity Cloud build is authorized. On the licensed local Unity 6000.0.86f1 workstation with Android SDK/NDK/OpenJDK and a configured Universal Renderer URP asset, run `node Tools/prepare-offline-review.mjs` (Node 18+, Python/NumPy/Pillow). Switch the Unity project to Android. Choose `BUKLOD Empire/Build isolated offline test APK (local)` from the menu. The method assembles the exact validated review scene, verifies the 39-skill bank and all hybrid visual references, then creates an ARM64 IL2CPP development APK under `Builds/OfflineReview/`. It temporarily assigns `org.mzbministry.buklod.empire.review`, debug signing and review scene only, using a player-only compile define; settings are restored in finally. Production builds still require the original approved catalog, exact production package and provenance. The isolated test is explicitly unapproved, cannot replace MAIN or production Empire, and is not an online or reward-settlement build. The assembly currently requires an actual graphics-capable local Editor due to existing shader support checks. Do not run it on a null graphics device and call that a visual test.
After a successful build, use `node Tools/verify-offline-test-apk.mjs <apk-path> <Android-SDK/build-tools/version>` with the matching local JDK (JAVA_HOME) and Python available. It checks the exact build receipt SHA and size, actual Android package/debuggable flag, apksigner v2/v3 result, ZIP entries and ARM64 Unity/IL2CPP libraries. It writes a verified artifact receipt only after success. Device acceptance remains separate. No actual Unity compile, build, signature or device check was executed in this session. The verification predicate passed 11 synthetic fixture cases; these are not APK tests.

## Final delivery scope
The local isolated offline test APK is an optional interim diagnostic artifact. The final APK must include both offline and fully online modes and satisfy `Tools/ONLINE_COMPLETION.md`. No live backend migration or hosting purchase is authorized here.
