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
