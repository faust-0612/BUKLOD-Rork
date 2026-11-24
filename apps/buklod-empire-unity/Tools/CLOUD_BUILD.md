# Isolated Android development — local-first
Only the isolated Unity project is in scope. The Unity Cloud target is manually configured by the owner; this repository does not contain tokens, signing credentials, or production backend secrets.

- Consolidated source branch: dev/arena-hybrid-nongraphics-20261124
- Project path: apps/buklod-empire-unity
- Android application ID: org.mzbministry.buklod.empire
- Debug signing for development; APK; automatic builds off.
- Unity 6000.0.86f1 is pinned in ProjectVersion.txt before the first build (the October 2026 Brotli and certificate advisories identify 6000.0.85f2 as the first fixed release). Verify availability in the cloud target; do not silently choose the closest version.
- Use the account's available free machine and verify allowance before compiling. No paid upgrade, automatic overage, or Boost Disk without explicit approval.

The AndroidBuildGuard automatically rejects the wrong application ID and missing/invalid enabled scenes. The guard also requires the pinned editor and a complete visual catalog with nine distinct animation clips per hero, matching Animator parameters and a rights/art review receipt. This is a source safety gate, not a release approval. No additional dashboard script hook is required for this guard.

Before the first build: configure the actual Android player settings and scenes; integrate URP, touch input, navigation, canonical gameplay, and verified original assets; configure working EditMode and PlayMode tests. Package references alone are not implementation. No APK is approved until the actual Unity build, complete offline match, visual acceptance, and device tests succeed. Production/staging remain untouched.

## Current release policy
Use local Unity/Android tooling for the requested APK; this document's earlier cloud instructions are historical fallback only and require separate authorization. No paid builds or Expo/EAS/Vercel. The standalone Empire app is not the MAIN or Genesis integrated mobile app: MAIN OTA markers and unrelated React Native source must not be copied into the standalone Unity APK. Integrated Genesis still requires its own cumulative MAIN fix audit and merge. Current checkout has no Assets/Production visual catalog or committed production scene. Do not bypass AndroidBuildGuard or forge artwork receipts. The local preflight script runs source checkout validation and Unity tests only when a pinned editor is present; it never produces an APK.
