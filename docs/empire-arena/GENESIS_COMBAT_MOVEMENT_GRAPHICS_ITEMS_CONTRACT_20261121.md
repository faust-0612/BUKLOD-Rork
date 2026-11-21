# Genesis Empire Arena — Explicit Combat and Presentation Contract
Status: DEV-only, standalone browser OFFLINE PRACTICE, not Android APK, ranked PvP, OTA or live economy. Date: 2026-11-21.

## Verified input root cause and fix
Queued Attack/Skill commands had older sequence IDs than newly generated Move/Capture commands. The previous browser processed those newer commands first; the engine correctly rejected subsequent older commands as replayed. The client now drains up to three queued commands first, and refuses to generate a new Move/Capture sequence while older input is pending. This preserves one-player command ordering, anti-replay checks and the three-command tick limit.

## Controls and combat
| Input | Exact behavior |
|---|---|
| Joystick / WASD | Direct eight-direction movement, physical collision and idle when stationary |
| Tap enemy | Select enemy target; character target ring and range readout |
| ATTACK | 18 base damage scaled by hero level, 600ms cooldown. Target must be within character range (3.6–6.1m) and clear line of sight. Tap outside range starts user-requested auto-approach; joystick overrides. Hold repeats. Visible damage floats and impact cue |
| ATTACK at enemy Core | Requires two connected team Light Relays and distance no greater than 4.5m; when no enemy is within reach, Core takes approximately 16 scaled damage |
| SKILL | Hero-specific primary, 5s cooldown, explicit outcome text and sound |
| DASH | Level 3+; move 3m in aimed direction, 7.5s cooldown, blocked by terrain |
| ULT | Level 6+; 30 team Flux, 45s cooldown. Targeted heroes need an enemy within 6m and clear line of sight |
| LINK | Living allied hero within 5m; 15 Flux, 20s cooldown; grants each 24 Shield |
| BUILD | Temporary barrier, 45s duration; owned Relay nearby; 25 team Flux or 20 for PHAN, 8s cooldown; maximum three team buildings |
| GUARD | Requires nearby ally; 12 Flux, 25s cooldown, team takes approximately 15% less damage for 8s |
| SOUND | Toggle existing sound cues and original low-volume synthesized music ambience |

Invalid controls explain the blockage, rather than silently discarding inputs. User-selected auto-approach is not a replacement for direct player control.

## Every hero and primary skill
| Hero | Role | Primary |
|---|---|---|
| PHAN | Architect | NEXUS: +12 Flux, +14 personal Shield |
| QUIN | Scout | BLINK: teleport forward 4m |
| VAN | Support | MEND: +32 HP |
| CHRISTIAN | Commander | AEGIS: +32 personal Shield |
| LHEN | Tempo | NEXUS |
| JAWO | Skirmisher | BLINK |
| TRUDICE | Illusionist | JAM: +21 damage and slow to nearby enemy, or +30 Relay progress |
| ACE | Vanguard | STRIKE: +32 damage within 5.5m |
| MITCH | Terrain | AEGIS |
| NIEL | Signal | JAM |
| ANGEL | Medic | MEND |
| VHEN | Growth | MEND |
| ELLUSUR | Rift | STRIKE |

**Ultimate distinctions:** heal archetypes restore +48 HP and +12 Shield to nearby allies; guard grants allies +40 Shield and nearby enemies 14 damage; supply grants allies +24 Shield and nearby enemies 24 damage; burst deals 66 targeted damage; blink and disrupt deal 55 targeted damage, with disrupt additionally slowing the opponent. Values here are provisional OFFLINE practice balance, not official BP/Character progression.

## Three distinct maps
- Genesis Rift: 40x24 with crystalline cracks, galactic light lanes and glowing Core and Relay prisms.
- Aurora Foundry: 44x26, industrial hex patterns and CC0 KayKit props.
- Verdant Fracture: 38x24, botanical light patterns and CC0 vegetation.
- Each has cover collisions, spawn zones, own terrain palette and up to four Relays. A landscape-follow camera fills the screen, while a minimap tracks relays, heroes, cores and pickups.
- The GUI uses compressed joystick and skills, damage numbers, skill FX, dash trails, role-colored hero auras, name collision avoidance, enemy range and cooldown status.
- Browser fullscreen/rotation requests are best-effort, not Android native orientation support.

## Consumable match-only items
| Item | Effect | Availability |
|---|---|---|
| Vital Spark | +30 HP, capped at max | Auto-pickup within 1.15m, 30s respawn |
| Aegis Rune | +26 Shield, capped at 60 | Same |
| Lumen Shard | +18 team Flux, capped at 120 | Same |

No item persists in real inventory; no money, BP, QMP, Character Diamond, Circle Rank, monthly rewards or account ledger mutations. This is not an in-game economy launch.

## Modes and results
- Duel 1v1: 180 seconds, first two KOs wins, score/health timeout tie breakers.
- Cluster Clash 3v3: 330 seconds, 1000 Core HP.
- Grand War 5v5: 540 seconds, 1600 Core HP.
- Objective wins include Core destruction, sufficient connected Relays, or three-Relay hold lasting 12 seconds. Unresolved sudden-death ties are VOID after a 60-second overtime.
- Opponents are training bots only. No authenticated real-time online gameplay or ranked defeat exists in this artifact.

## Current audio and licensing
The self-contained prototype retains 156 licensed game-use images/props and 11 embedded licensed Magic Spells Lite SFX: attacks, spell casts, knockouts, shields, healing, teleport/dash, structure creation, objective capture and item pickup. Background ambience is originally synthesized. Real music mastering, three map-specific compositions and professional voice cues are not present; browser autoplay restrictions still apply.

## Asset / engine gaps before finished Arena
1. Thirteen distinctive character rigs and frame sets with idle, eight-direction movement, attack, skill, dash, hit, knockout, respawn and ultimate; the current shared rogue sprite sheet is a placeholder.
2. Fully authored arena landscapes, camera and lighting assets, terrain materials, item models and role-authentic particles for all three worlds.
3. Licensed original seamlessly looping music and polished individual ability/footstep/ambience sound sets. Existing SFX remain fallback. Never insert an asset with unclear license rights.
4. For a real native game: signed Android landscape-capable runtime (e.g. a Godot integration requiring an APK), with touch/graphics/audio profiling on the target device.
5. For genuine ranked PvP: trusted realtime game server, authenticated parties and anti-cheat, disconnect replay, server-only validated settlement of Character Diamonds and protected BP/QMP/account isolation.
6. Existing app AdMob first-view, dashboard/navigation latency, consent, build/runtime compatibility and production regression gates remain release blockers.

Zero-budget source first: existing Buklod V2 licensed/CC0 props, Sound and voice effects archives, original code and procedural rendering. No paid Unity/Godot packages, stock music, cloud matches, paid design assets or unapproved backend changes.

## Verification boundary
Focused deterministic engine and browser-mock checks validate action+movement coexistence, approach, six primary abilities, temporary item effects, nine map/mode renders and game wallet isolation. This is not device visual verification, Android UI touch certification, production CI clearance, signed APK or staging OTA. Previous Vercel status had a build-rate-limit failure. Keep production APK and production data unchanged. **No consolidated OTA ready declaration.**
