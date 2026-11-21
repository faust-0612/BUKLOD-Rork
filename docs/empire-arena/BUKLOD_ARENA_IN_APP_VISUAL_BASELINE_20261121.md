# BUKLOD Season 2 — Arena in-app + visual asset baseline (DEV)

**State:** Implementation in an isolated DEV branch; NOT a verified Android build, ranked service, or production OTA.

## Non-negotiable product shape
- ONE BUKLOD Main Android application and package; no standalone BUKLOD Empire install, second login, or separately owned BP/QMP/Character Diamond ledger.
- The Expo route `/games/empire-arena` opens from the existing Kingdom Map. On Android it requests landscape, uses the current full-screen app view, then restores orientation on exit.
- React Native paints the Arena environment and input HUD using the existing Expo image, SVG, audio and orientation modules. This avoids a new native Godot dependency for the first safe integrated slice. A future embedded Godot view is an optional replacement renderer after APK compatibility and performance testing, NEVER a second app.
- `experiments/empire-arena-v2/arena-v2-engine.mjs` remains the ONE offline combat simulation; do not clone, rewrite, or mint a second economy in the screen.
- The in-app Arena currently runs only level-1 equalized offline practice, not real ranked PvP. It reads the active Character ID for identity but never treats unverified BP, items or Diamonds as owned. No offline action settles rank, transfers BP, awards Diamonds or grants cash.

## Approved image -> actual APK baseline
1. Prefer art already in this repo. The current integrated portrait catalog references all 13 canonical BUKLOD characters from `assets/images/characters/` and the previous 3 environment plates from the Kingdom media catalog. No user Library save is necessary.
2. For a newly generated illustration whose **actual image bytes are accessible to the working tools**, the assistant/CI operator runs:
   `node scripts/ingest-buklod-visual-baseline.mjs --source /absolute/path/to/generated.png --kind scene --id genesis_rift`
   `--kind hero --id phan` replaces a portrait; `--kind sprite --id phan` adds an in-game character sprite. Other static art can use `building`, `effect`, or `ui` with a stable lowercase ID.
3. The importer checks image type, declared role, size and SHA-256; it places the image in `assets/season2/arena/generated/`, updates `generated-manifest.json`, and regenerates `src/features/games/empire/arenaGeneratedAssets.ts` with static `require()` entries for Metro.
4. Commit all three output categories **together** in the DEV branch. The Arena automatically renders matching registered `scene:map_id`, `hero:character_id`, and `sprite:character_id` assets; no download/upload action is required from the owner.
5. Art stays a **DEV baseline** until approved source rights, actual device rendering, orientation, visual fidelity and texture/memory regression checks pass. Other generated pictures without actual accessible bytes are *not* silently claimed as imported. If the generation tool cannot expose its image bytes to the repo tooling, the owner must not be told an automatic sync occurred.

## Android / UX acceptance
- A signed in user opens Kingdom -> Empire Arena -> practice -> returns to Kingdom without logout, replacement APK or separate install.
- Landscape works on Infinix X6852; exiting restores the prior app orientation and safe-area/AdMob layouts.
- Joystick movement, targeting, attack, primary skill, dash at match L3, ultimate at L6, resource mining/deposit, training/order, pause/resume and match win/loss all function with bounded frame time.
- All 13 characters have valid source portraits; a newly ingested transparent sprite or scene background appears **in the Android app**, not just a concept image.
- Offline/background/unfocused game pauses, back navigation does not leave audio or endless intervals behind.
- No BP/QMP/Character Diamond, item entitlement, marketplace settlement or ranked record writes from practice. Actual online PvP requires trusted server matchmaking, authoritative outcome validation, anti-cheat, RLS and concurrency gates (SQL #1050 remains unapplied).
- No performance-sensitive production changes, no new AdMob placement over active combat, no production OTA from a DEV PR.

## Commands for focused verification
`node --test tests/empire-arena-v2-inapp-visual-baseline-20261121.test.mjs tests/empire-arena-v2-design-and-simulation.test.mjs tests/empire-arena-v2-world-economy.test.mjs tests/empire-arena-v2-connected-world-preview-20261121.test.mjs`

Passes here mean source/logic checks only. Source tests alone do **not** verify Android visual performance or live multiplayer. A compatible staging APK and actual device run remain mandatory.
