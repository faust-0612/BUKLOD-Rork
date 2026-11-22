# BUKLOD Genesis — Premium Native Arena Workstream (DEV only)

Baseline: \`dev/arena-godot-native-migration-20261122\` at
\`30c62ddbfc7f7dd9de1669d8d0ab139f74a08e20\`.
No production source, OTA, SQL, user Diamonds, or ranked result is changed.

## What is integrated in the embedded Godot offline Arena
- \`hero_animation.gd\` drives the existing approved 13 × 4 × 8 full-body
  pose atlases, with a short locomotion hold to avoid jitter and skill/attack
  event priorities. Artwork, hero roster and simulation rules are unchanged.
- \`arena_effects.gd\` and \`arena_impact.gdshader\` provide additive GPU
  rings, sparks and light blooms for skills, damage, defeat, pickups,
  buildings, respawn, seal damage and level-up. Each Arena owns a maximum
  of 28 short-lived effect sprites and cleans them up on restart.
- The deterministic, APK-embedded Arena ZIP now fails to build if these
  Godot scripts/shaders are absent. The same exact signed native APK
  / SHA / runtime compatibility gates remain mandatory.

## Editable Blender source pipeline (not yet rendered in APK)
\`scripts/generate-arena-blender-kit.py\` creates a local editable .blend
and portable .glb containing modular Genesis plaza, foundry, vegetation,
team-specific towers/seals/villagers and resource crystals with keyed
walking/idle loops. Run on an approved Blender 4.x/5.x host:

\`\`\`bash
blender -b --python scripts/generate-arena-blender-kit.py
\`\`\`

The 3D outputs require a Blender runtime and GLB visual review. They
are **not** already in the 2D Godot scene, are not replacement hero faces,
and are not an accurate claim of final AAA/unity-level visual fidelity.
A later audited 3D/2.5D rendering integration is required.

## Backend
The existing \`services/empire-arena\` authoritative WebSocket match
coordinator remains the only ranked authority. A race guard now aborts
and refunds a reserved match when a player disconnects while the
asynchronous escrow transaction is pending; behavioral regression added
in \`services/empire-arena/tests/core.test.mjs\`.

The actual native Godot process still has no trusted network session bridge,
ranked server deployment, verified TLS endpoint, or verified live ranked
match. Never use the offline GDScript simulation to settle Diamond, BP, QMP
or player ranking. No new paid host or live Supabase schema is authorized.

## Verification needed before release
- Node regressions: \`node --test services/empire-arena/tests/core.test.mjs
  tests/arena-premium-vfx-blender-backend-20261122.test.mjs\`
- Native engine: \`godot --headless --path godot/empire-arena
  -s res://tests/premium_smoke.gd\`
- Blender 4.x/5.x source/export: check .blend and .glb generated, geometry,
  UV/materials, looping motion, view fidelity and Android FPS/memory.
- Existing Godot offline pack/art smoke, Android Gradle compile, signed
  exact-SHA staging RC, physical landscape navigation, audio/AdMob,
  weak-network reentry and multiplayer escrow/refund tests.
- Production remains untouched. No promotion from DEV without gates.
