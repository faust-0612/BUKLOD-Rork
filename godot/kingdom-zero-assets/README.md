# BUKLOD Kingdom Godot 4 – Zero-asset, local 3D prototype

**DEV-only source. Not an APK, staging OTA, production or a replacement for the separate BUKLOD Empire R14 RTS.**

Open `godot/kingdom-zero-assets/project.godot` in the free Godot 4.3+ editor and run `scenes/Main.tscn`. No paid models, remote textures, music, hosted servers or subscriptions are needed.

## Playable scope
- 13 canonical BUKLOD character stations with unchanged IDs and original 2D map coordinates projected into 3D.
- 13 connected roads; terrain with 72 procedurally batched trees and rivers.
- 8 animated workers walking across the routes.
- Click/tap a station, or use Previous/Next buttons, then BUILD to construct a larger visible settlement structure.
- Building consumes **four demo-only supplies**, capped at 16, with one supply collected every six active seconds. Duplicate builds are blocked and all 13 stations can be upgraded.
- Orthographic isometric camera: drag/swipe to pan, scroll/buttons to zoom.
- Pause simulation when backgrounded. Compatibility renderer, limited instances and no dynamic shadows target lower-end Android capability.

## Scope and security
This is an **ephemeral standalone prototype**: no file storage, no Supabase, account access, AdMob, points, Shards, QMP, or official BUKLOD Kingdom rewards. The existing React Native Kingdom map, 39-game catalog, server rights and production remain unchanged. **No Godot integration into the current Expo APK was attempted**: the Godot Android library is a native dependency that requires an isolated signed build, host lifecycle management and runtime/channel reconciliation. Existing OTA cannot install that native bridge.

## Quality gates
The repo test `node --test tests/kingdom-godot-zero-assets-20261114.test.mjs` verifies source IDs/coordinates, route endpoints, no external assets/network, and offline construction constraints. **It does not execute the Godot interpreter.** On this session no Godot binary was available for GDScript parsing, real render performance, touch behavior or Android packaging.

Before native staging: run the exact-source Godot headless/editor test, Android game playtesting, integration bridge and no-regression tests, sign/freeze a staging RC, and independently confirm installed runtime/APK. No auto cloud build, store deployment, paid asset use or production OTA.

Official Godot documentation:
- https://docs.godotengine.org/en/stable/tutorials/platform/android/android_library.html
- https://docs.godotengine.org/en/stable/tutorials/platform/android/embedding_in_android_projects.html
