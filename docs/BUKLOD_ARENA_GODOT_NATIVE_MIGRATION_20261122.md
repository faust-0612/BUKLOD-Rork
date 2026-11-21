# BUKLOD MAIN Empire Arena — native Godot migration record (2026-11-22)

**Scope:** non-production, embedded Godot 4.7.2 inside the existing BUKLOD MAIN Android package. Do not create a separate Godot APK, separate app account, ranked reward authority or duplicate BUKLOD navigation.

## Implementation implemented in DEV (not production)
- Native Godot scene: `godot/empire-arena/scenes/Arena.tscn`
- GDScript game simulation, 100-ms fixed tick, CPU, movement, attacks, skills, pickups, towers, villagers, resource mining, building, seal/hunt: `godot/empire-arena/scripts/arena_simulation.gd`
- Native Godot renderer and camera: `godot/empire-arena/scripts/arena_root.gd`
- Touch game HUD and combat controls: `godot/empire-arena/scripts/arena_hud.gd`
- Build-time canonical roster (13), modes/maps (3) and temporary pickups (300) from existing authoritative JavaScript *catalog definitions*, **not** from its JS runtime simulation: `scripts/build-empire-godot-pack.mjs`
- Android staging build bundles the canonical Godot ZIP in APK assets through `plugins/withBuklodGodotArenaPack.js`, exposes Expo native `openBundledArena`, starts non-exported separate-process `GenesisGodotActivity`.
- BUKLOD guarded Arena route has `PLAY GODOT EMPIRE ARENA` launch button; React Native remains the login, profile, main navigation and home layer.
- Staging native runtime `2.0.2-genesis-godot-arena`, gated by `EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED=true`. Existing production runtime `1.3.2` remains unchanged.
- Preserved original (unverified) owner-supplied `.gd` hero code under `godot/hero-originals/` as **reference**. It is NOT yet active scene code; its HP scale/animations/skill definitions must be reconciled before importing into the live Godot game.

## Deliberate release restrictions
- OFFLINE PRACTICE ONLY: no network, account transactions, ranking, BP, QMP, Character Diamonds, permanent item ownership or payouts in the Godot process.
- The `services/empire-arena/` server stays separately authoritative. Never port security-sensitive ranked settlement into client-side GDScript.
- No unreviewed media assets, no misleading 13 "rigged" hero visuals; current rendered heroes are procedural visual prototypes.
- Offline Gradle debug APK is **not** an EAS-signed functional staging release, cannot assume old EAS signing identity, and should never be promoted to production.
- Existing JavaScript Arena remains as fallback while Godot source/binary/device checks are incomplete.

## Remaining work before actual production-quality Godot game
1. Headless parse + scenario tests in real Godot 4.7.2. Fix errors by logged evidence.
2. Android Gradle Kotlin/Java compile, exact signed embedded pack identity, APK checksum, native SDK compatibility.
3. Reconcile all **13** distinct hero abilities, original `.gd` skills, projectile collisions, all effects and playable 3D/2.5D scene/assets. Native current code is **not** gameplay-complete.
4. Port advanced minion wave behaviors, arena AI, all items/armory/economy-in-match and animations, audio, portrait art and UI customization with gameplay parity contracts.
5. Test opening and leaving Godot after calls/PTT/ads/audio focus; orientation, app resume, Android graphics tier, 3G/offline, screen sizes, loading budget.
6. Implement trusted server multiplayer snapshots and reconciliation; preserve sealed ranked reward authority and anti-cheat.
7. Freeze DEV → exact signed staging RC → device regression and security gates → release only after acceptance. Never use current staging legacy OTA runtime or touch production.

**Completion is evidence-backed only.** Source commits and JS tests cannot prove Godot scene fidelity or playable Android performance.
