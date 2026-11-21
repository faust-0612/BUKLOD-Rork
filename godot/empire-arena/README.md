# BUKLOD Empire Arena — Godot-native migration

This is a **first engine-native offline prototype**, not the full Arena port.
The canonical JS Arena currently remains active; no gameplay route is switched
until feature parity and Android physical-device verification are demonstrated.

## Included
- Godot project with standalone scene, 13 canonical hero IDs and deterministic
  fixed-step practice loop.
- Offline CPU opponent, movement, proximity combat, HP and end-of-match result.
- No BP, QMP, Character Diamonds, ranked results, account or network access.

## Not yet migrated
The canonical JS engine's full heroes/abilities, towers, minions, villagers,
resource economy, maps, loot, inventory, effects, artwork, audio, multiplayer,
network reconciliation, accessibility, and Android lifecycle integration.
No approved PCK is produced or installed by this commit.

## Migration acceptance
Port features against canonical offline JS fixtures, create deterministic
cross-engine command traces, run Godot headless validation, export a signed/
SHA-256-approved PCK, and validate the embedded GodotActivity on a real device.
Do not enable the Godot route or change production until all gates pass.
