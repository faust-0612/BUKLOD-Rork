# BUKLOD Genesis Arena — owner screenshot vs Library visual parity (2026-11-22)

## Basis
- Owner's landscape screenshots, header **Christian • PRACTICE LIVE • genesis-arena-inapp-r1**, show current React Native in-app practice, not the native Godot activity. The route at `src/app/games/empire-arena.tsx` separately exposes `PLAY GODOT EMPIRE ARENA`.
- Library original **BUKLOD Empire Arena: Genesis Blueprint.png** is a *gameplay/concept reference*, not a ready-to-run level scene, mesh pack, or rights-cleared world texture. Required target is an explorable battlefield with recognizable 3 lanes, jungle camps, two faction towers/cores, hero/minion action fidelity and responsive HUD.
- Library `BUKLOD_Empire_Arena_300_Drop_Icons_and_Uses.zip` contains **300 distinct 256×256 transparent PNGs** and an exact catalog, comprising **144 universal and 156 hero-specific temporary match drops**. They are **not** present in the current APK pack; the engine currently draws symbolic pickup geometry.
- Library `buklod_arena_minions_assets.zip` contains **8 original 512×512 RGBA faction minion portraits** (Solar and Nebula: Vanguard, Ranger, Mender, Siege Breaker); current in-repo Godot draws primitive minion silhouettes/role rings.
- Repo has **52 four-pose hero images**, **13 sprites**, **3 scene plates** for React Native and Godot. They exist in source and pack builder, but their real Android decoding, map visual match and physical GPU behavior remain unverified. Existing preview uses flat SVG geometric towers, buildings, cores, wildlife and resource nodes.
- Existing Blender geometry/GLB export is CI proof of original geometry, **not** integrated/visual-matched mobile-native 3D arena terrain or an editable full scene; avoid claiming Unity-level graphics from it.

## Implementation matrix (single BUKLOD MAIN, no separate game/app)

| Visual subsystem | Current source | Required artwork + runtime integration | Release proof |
| --- | --- | --- | --- |
| Entry path | React Native PRACTICE LIVE | New **library 2.0.4** signed package opens bundled Godot first once after guarded auth/consent and orientation; older runtime stays React Native fallback; no launch loop | Real Android back/return, auth, orientation and audio focus |
| Hero rig | 13×4 eight-frame PNG atlases | Match poses, hit reactions, proper scale, collision-grounding, team silhouette, damage visibility; no hero ID swap | Scene smoke + signed physical device frame capture |
| Battlefield | Three static illustrated plates + decorative lanes | Three playable map layouts: correct 3-lane/jungle collisions and natural terrain/height/occlusion, optimized map meshes/tiles and shadows—not a stretched concept infographic | Physical screenshot for each map + FPS/GPU memory |
| Towers/cores | Rectangles/polygons/circles | Original 3D/2.5D tower/core source meshes or sprite atlases, unique team identity, targeting and destruction sequences | Towers and seals visible at all zoom levels |
| Minions | Primitive units + 5 role logic | Pack and render the eight Library faction portraits; reconcile role mapping vs five AI classes and six villagers without pretending art provides missing behaviors | 8/8 art checks + per-team in-match movement/render |
| Drops | 300 match-only IDs; abstract circles | Ingest all 300 original PNGs into optimized indexed atlas + mapping keyed by original item ID, not by random order; correct rarity/tier/hero limits and icon feedback | 300 icon IDs matched; actual pick-up in playable scene |
| HUD | Large mobile React Native SVG overlay / Godot touch | Low-overlap touch HUD, readable cooldown/shield, contextual actions, minimap, pause, small screen/safe area | On-device multi-touch, weak-network/offline, no AdMob/nav regression |
| Audio/VFX | Generated 70 prototype WAV and shader FX | Art-directed original animation/sound triggered only by confirmed gameplay events, Android audio/PTT focus and off-screen cleanup | Physical effects/audio and consent regression |

## Build and release gates
1. Add source-controlled approved minion PNG/WebP, all 300 original Library drop icons (prefer indexed atlas to avoid Android memory pressure), valid identifiers, provenance/hash and packing script; include **actual files** in Godot ZIP and native sign verifier. No replacement procedural icons mislabeled as Library art.
2. Replace 2D placeholder geometry with original game-model/sprite content in the **actual Godot scene**, including map overlay aligning with real collision coordinates; do not simply wallpaper an infographic.
3. Gate all ranked/drop/Character/BP/QMP changes server-side; no new live rewards from visual art. Character System remains original permanent authority.
4. Extend CI to parse assets and exercise draw/render, then verify **signed** APK package, runtime `2.0.4-genesis-library-godot`, pinned certificate, Godot pack hashes and all 13 heroes/3 scenes/300 icons/8 minions. Exact-source new build required after changes.
5. Require Android launch/return, real asset visibility, shader/frame pacing, battery/thermal/GPU memory, dark UI, screen orientation, AdMob first-view and tab responsiveness, PTT/audio focus, 3G network/offline and old-production-fix reconciliation before RC. Physical device verification can be marked *waived/unverified*, **never passed**.
6. Keep draft DEV until all blockers resolved. Do not merge into production, publish OTA or announce release. A currently compiling older-source signed staging APK cannot magically include subsequently added Library images.

Both future signed full APK workflows call the strict visual-readiness gate before runner credentials or signing; this is intended to HOLD any incomplete new APK. The already-started earlier-source CI run is unaffected by this isolated draft branch.

The companion read-only audit is `node scripts/genesis-arena-visual-readiness-20261122.mjs`; `--strict` intentionally fails while source graphics are incomplete. This is an implementation blocker report, not an APK creation command.

## Ingestion and runtime wiring added
The DEV source now resolves the exact 300 `item_id` values to a 1920x1440 atlas and maps original 8 Solar/Nebula minion artworks onto the existing five logical minion roles. The importer `scripts/ingest-buklod-arena-library-art.py` deterministically creates image assets from the original Library ZIPs without modifying the game's authoritative simulation. Those source image binaries are **NOT** in the GitHub branch: the signed-build release hold is intentionally active until the original 12-file handoff is imported into the actual source. Do not claim a finished APK or full premium terrain/structures until proven.
