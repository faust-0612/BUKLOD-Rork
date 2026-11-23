# BUKLOD Genesis · verified 3D asset intake (DEV)
20 real binary glTF 2.0 models from **Kenney** via the pinned `Hidencod/tge-assets` CC0 mirror. License: Creative Commons Zero 1.0; the upstream license is linked in `verified_cc0_3d_manifest.json`.

Each downloaded binary is checked against its exact pinned Git blob SHA and GLB v2 mesh structure before the staging game pack is assembled. No Studio/Unity/paid-asset assumptions. These imported models supplement the 13 existing BUKLOD character atlases; they are **not** rigged variants of the original characters and do not grant inventory/property/game rewards.

**Owner Library status:** The previously uploaded `t1-sentinel.glb`, `azure-champion.glb`, `hooded-blade.glb`, `desert-watchtower.glb`, mocap ZIP, Unity packages and premium sound packs have Library file references. Their bytes were materialized for inspection, but binary processing in this session is unavailable; no model or license hash was verified for those private files. They MUST NOT be mislabeled imported or approved. The 20 CC0 models below are an independently verified supplementary asset set, not a replacement for that inventory.

Release rule: no automatic production or staging OTA publication. Only publish when the exact GLB-containing Godot 4.7.2 main ZIP, Android capabilities, ad/nav regression checks and device update/rollback are verified. Status: DEV candidate.

## Verified animated 3D character imports
- `rig_knight.glb`, `rig_mage.glb` — KayKit Adventurers 1.0, creator Kay Lousberg, **CC0 1.0**, pinned commit `672074b73ba276876a19e8816ecdc5241817ab47`. Each contains a skeletal skin and real animation tracks. Runtime chooses an Idle/Walk/Attack clip where available, otherwise gracefully keeps the current animation or still model. These rigs are generic demo character bodies, not official BUKLOD character identities.
- Exact binaries, Git blob SHA and glTF mesh/skin/animation presence checked before packaging. No raw Library Unity or .rar assets treated as approved.
