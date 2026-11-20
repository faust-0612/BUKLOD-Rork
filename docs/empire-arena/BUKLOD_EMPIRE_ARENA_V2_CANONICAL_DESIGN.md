# BUKLOD Empire Arena V2 — canonical editable gameplay design

> **OWNER-LOCKED DESIGN | Genesis: Let There Be Light | 2026-11-21**  
> This file is the single design contract for new Arena V2 work. Edit through an explicit, reviewed change with rationale, gameplay implications and updated focused tests. **Not a production release authorization.**

## 0. Scope, product integrity and source hierarchy

Empire Arena V2 is an original, landscape-first, direct-control action/RPG + RTS + survival competition. **Not a Mobile Legends, MU or Age of Empires clone.** Retain the official 13 BUKLOD Character identities, 20 independently persisted Character levels each, 5 collectible slots per level, total **1,300 canonical items**. Do not invent replacement characters, collectible names, item classes or paid assets merely to fit a skill. Reuse official `src/lib/buklodCharacterWorldCatalog.ts`, `src/lib/buklodCharacterSelectionV2.ts`, the Character Evolution receipts contract `docs/character/CHARACTER_BP_ITEMS_FAITH_OPTIONAL_20261121.md` on the DEV evolution branch, and the Library `Buklod Character System Assets/Collectibles/Processed/collectible-art-manifest.json`. Asset IDs `character_id:Lxx:Ixx` are canonical and never minted client-side.

Priority: 1) protected persistent BP/Circle Rank/Character/diamond authorities; 2) this approved V2 design; 3) latest DEV Arena engine (V1 controls and combat feedback) for compatible forward-port; 4) optional presentation. Existing live APK, OTA, Supabase rewards, wallet, ads, navigation and native runtime must remain unchanged until separate authorized RC/release.

### 0.1 Permanent owner decisions (do not silently remove)

1. Large multi-route world; the player should not immediately encounter opponents by default.
2. Separate match-only Wood/Gold/Stone gathered from resource sites.
3. Renewable, wandering and contested buff creatures; buff bonuses depend on mining/resource specialty.
4. Match XP, random drops, permanent verified item-linked skills, and execution-based loot modifiers.
5. Towers can be built/upgraded/repaired during a match, constrained by damage, cost and structure XP.
6. Player/team manual minion production. Villagers mine, defend themselves and can be killed. **No free automatic waves.**
7. Player-hunting Rift Stalker; Ancient Shellkeeper adds tower/base Structure XP, not automatic level upgrades.
8. A team wins only after enemy Command Seal breach **and** the final elimination of all living opposing *player-controlled heroes*. Towers alone never settle a win.
9. Skill, equal economic opportunity, protected matchmaking bands, anti-farming, bounded RNG, anti-snowball and no pay-to-win.
10. Landscape direct character motion/combat, clear cooldown feedback, minimap and compact tactical team orders.

## 1. Map geography and game formats

| Mode | Human/team | Target world width×height | Target duration | Capacity |
|---|---:|---:|---:|---|
| Duel | 1 | 160×110 | 10–14m | 1 hero/team; units/villagers still viable |
| Cluster | 3 | 240×160 | 14–20m | 3 heroes/team |
| Empire | 5 | 320×220 | 18–25m | 5 heroes/team |

Map units are independent of screen pixels. The production map must be symmetric in resource opportunity, access times, cover and vision, but not necessarily an exact mirrored visual skin. Three broad lane **regions** (Frontier Road, Verdant Trail, Crystal Rift), connecting Wildlands, side routes/underground shortcuts, mining territory, enemy-neutral buffer zones, home base, enemy camp. Avoid an uninteractive 120-second walk: put near-side mining/upgrade options within 5–20 seconds and make central encounters optional. Use fog of war and valid line of sight; a player can scout/ambush. Roaming creatures have leashes. Mines are renewable subject to finite stock and refill. Three lanes are *not* automatic minion conveyor belts.

## 2. Resources and transport

- **Wood:** workers, barracks training, repairs and construction. **Gold:** technology, elite units, equipment specialization. **Stone:** towers, defense, siege construction.
- Heroes and villagers gather into **unsecured carried inventory** with capacity and must bring it to a depot, then team resources are credited. Villagers auto-walk to a dropoff (not magic transmission). Carried loot may be lost on death, but immutable ledger and protected BP are never affected.
- Villagers are killable, have low self-defense, retreat rules and require paid re-training. Their mining flow is intentionally visible; opponents may raid supply routes. Resource sites replenish slowly and are visible when scouted.
- Team treasury is match-only. Production/build choices spend it atomically and reject underfunded commands. A command cannot drive balances negative. Multiplayer must protect treasury from malicious teammates using leadership/vote/limits and audit events.
- Proposed starter/team: W150 G100 S110; capacity 65 per hero; finite minion population 18 live fighters plus 6 live villagers per team (prototype). All balance values adjustable, design immutable.

### Unit production (candidate prices; tune empirically)

| Unit | W | G | S | Training | Strategic use |
|---|---:|---:|---:|---:|---|
| Villager | 35 | 10 | 0 | 6s | mine, repair, limited self-defense |
| Scout | 30 | 20 | 0 | 6s | vision + mobility |
| Warrior | 55 | 25 | 0 | 9s | front line |
| Archer | 65 | 30 | 0 | 10s | ranged cover |
| Guardian | 35 | 45 | 55 | 14s | defense/bodyguard |
| Siege Unit | 100 | 65 | 85 | 18s | tower/Seal pressure |

Minions are produced **only** from explicit team orders and a paid queue, never timed free waves. RTS commands: Mine, Escort, Defend, Push, Patrol, Retreat. The hero remains directly controllable while issuing commands.

## 3. Buff ecosystem and bosses

Buffs wander within a bounded biome, can retaliate/be hunted, respawn on a timer, and cannot be permanently exterminated. They remain contestable. Forest Guardian: +20% Wood extraction (90s), Golden Burrower: +15% Gold (90s), Stone Colossus: +25% Stone (90s), Lumen Beast: temporary mobility/energy (60s), Ancient Forager: villager efficiency (90s), Rift Wisp: scouting/detection (75s; adapter planned). All same-type buff stacking is capped; combined mining extraction boost target <=35% until simulation proves safe. Items are nontransferable persistent unless owner separately changes BUKLOD item policy. In-match buffs expire.

Rift Stalker (Lord alternative) hunts *heroes*, not towers: threat/aggro, target switches, leash, telegraphed attacks, anti-spawn-camping, temporary combat reward. Ancient Shellkeeper (Turtle alternative) awards Structure XP to alive towers and base plus bounded defensive opportunity; requires resource-funded upgrades later. Public boss arrival windows with balanced contest rights. Neither boss forces an unavoidable win.

## 4. Character identity / 1,300-item skill linkage

### 4.1 Exact authoritative identities and representative canon items

| Character ID | Display | Exact existing story collectible (level, slot) | Skill identity (new gameplay behavior, **not new item name**) |
|---|---|---|---|
| phan | Phan | L1/I3 Hand-Forged Farm Hoe | field mining, engineering, repairs |
| quin | Quin | L7/I3 Explorer Hiking Compass | scouting, path intelligence, dash |
| van | Van | L1/I3 Joy Tambourine | heal, ally protection |
| christian | Christian | L10/I3 Team Leader Radio Set | formation, barrier, command |
| lhen | Lhen | L13/I3 Outreach Loudhailer | rally/tempo, production support |
| ace | Ace | L10/I3 Junior Nurse BP Cuff | precision burst, tactical assessment |
| ellusur | ELESUR | L20/I3 Legacy Shepherd Crook Staff | protection, crowd control |
| jawo | Jawo | L15/I3 Community Organizer Radio Set | flanking, dash, team coordination |
| mitch | Mitch | L13/I3 Workshop Facilitator Tool Caddy | field defenses/traps |
| niel | Niel | L13/I3 Outreach Trainer Loudhailer | signal, disrupt, slowing |
| angel | Angel | L15/I3 Financial Trainer Demo Ledger | resource planning, restoration |
| vhen | Vhen | L1/I3 Seed Kit Hand Trowel | sustainable farming and sustain |
| trudice | Trudice | L13/I3 Children's Ministry Teacher Puppet Kit | decoy, disruption and protection |

The full, definitive 1,300 exact item **names** live in `BUKLOD_CHARACTER_COLLECTIBLE_ITEMS`, 20 arrays × 5 slots × 13 IDs. Do not manually maintain a parallel 1,300-name list; use `buklodCollectibleName(characterId, level, itemIndex)` and asset manifest `character_id:Lxx:Ixx`. If a name/slot changes in the canonical catalog, review the Arena mapping and license metadata. An image being present does **not** prove that the user owns its item.

### 4.2 Item-to-skill mapping for **every** collectible

For each stage L1–L20 and each hero: **I1 Memory/Origin** unlocks passive personal context/small sustain; **I2 Learning/Growth** improves awareness, telegraph reading or cooldown precision; **I3 Practical Tool** unlocks/extents active signature skill; **I4 Milestone Object** grants a role-tuned tactical modifier; **I5 Master/Legacy Object** grants a rare mastery specialization. Each level increases opportunity, not guaranteed damage advantage. Use complete `item_key`, verified receipt ownership, user/character id, stage, slot, tier; do **not** grant item mastery from BP alone, client images, local save state, redeemed cosmetics, or previous character items.

One character can own 100 collectible art objects. Not every collectible becomes a new skill button: aggregate verified receipt mastery into a small number of bounded per-character skill families. Baseline: all heroes can move, mine, use basic attack and one role-specific *basic* ability. Verified items improve cooldown/duration/precision or unlock **extra tactics**, not unreliable random skill firing. In-match XP gates skill slot 2 around L3 and ultimate around L6, while relevant verified item/level/rank gates cap long-term ability mastery and variants.

**Current DEV Character Evolution PR #1041 is an unmerged SQL changeset; NOT live.** Integration must fetch server-verified receipts only after isolated DB/RLS QA. Non-faith activity routes must remain equally attainable with Show Faith OFF. Historical BP and visuals remain protected. Character switches retain each Character's independent level/items. Core/special character rank unlock gate remains canonical (Ace rank 5, ELESUR 6, Jawo 7, Mitch 8, Niel 9, Angel 10, Vhen 11, Trudice 13).

## 5. Rank, Diamond risk and competitive matching

Four DISTINCT player authorities: Circle Rank (global BP), per-character verified development level, per-character item receipts, and Character Diamonds / Arena competitive rank. An effective combat eligibility level may be capped by each gate, without rewriting historical BP/Character items. **Rank must matter** in eligibility, kit options and competitive bracket. Proposed matchmaking bands: levels 1–4 / 5–8 / 9–12 / 13–16 / 17–20, further constrained by Arena MMR, role composition, ping and party composition. Do not mix beginners with endgame powers to fill a queue. Normalize starting resource allocations and enforce max power budget within ranked brackets. Lower-level users can outplay and out-strategize higher-level users *within fair limits*; winning is not predetermined. Offer an explicitly labeled open-power casual option separately.

Ranked losses may result in legitimate Character Diamond deductions, demotion and effective power eligibility loss on **next match**, only after trusted ranked server results and transaction-safe settlement. Offline/PvE/HTML practice MUST NEVER award, debit, settle, or imply real Diamond, BP or QMP transactions. No XP/loot from fake user claims. Double settlement and disconnect abuse forbidden. Character level/ownership must not roll back when Diamond balance falls; only combat eligibility/queueing changes.

## 6. XP, combat, loot and skill measurement

In-match hero level is separate from permanent L1–L20. Match experience L1–15 with increasing XP requirement. Sources: verified combat, effective assists/support, bounded mining contribution, objective captures, engineering and roaming enemies. Prevent idle farm scoring and repeated kill trading. Match equipment drops are temporary, max three combat slots/strong bonuses capped, may be sourced from monsters or defeated heroes. Hero death may drop *unsecured carried resources*, **never** persistent Character items/BP/Diamonds.

Performance-based loot quality is bounded by validated attack accuracy, timing windows, threat avoided, team assist, meaningful objective value and efficient resource spending; role normalization avoids bias against healers/builders. Example special drop chance 10–18% and anti-repeat-victim decay; random seed server-owned for ranked. Provide deterministic alternate crafting/mission paths to mitigate pure RNG. Skills must always show real range/cooldown, line-of-sight, impact and clear hit/miss cues. No fake animation without actual damage/defense state change.

Six weighted performance dimensions for post-match insight (not winner selector): Combat 25%, Strategy 20%, Teamwork 20%, Resource 15%, Survival 10%, Engineering/Objectives 10%; normalize by role, opponent skill and time alive. Ranked wins/losses, not inflated stats, determine outcome.

## 7. Structures and warfare

Three towers/team across lanes. Structures have HP, attack range, construction level (1–5), Structure XP, specializations, damage timestamps and fortification requirements. Tower upgrade consumes Wood/Gold/Stone and required Structure XP; tower repair consumes Wood/Stone, is range-gated, interruptible after recent damage, rate-limited, and must never permit immortality. L5 Genesis tower requires high-level tech/objective. Construction visually evolves through stages rather than instantly swapping a finished asset. No existing permanent Lot/House/Cluster progress is consumed or altered by in-match upgrades.

Command Seal/bases have durable HP. Prerequisite: enemy must lose two of its three towers (or an equivalent verified siege breach requirement) before its Seal becomes attackable. Siege minions support the assault, but cannot override seal prerequisites. Base loss starts final hunt; **base destruction alone never wins**.

## 8. Match-state lifecycle, overtime and authoritative result

`LOBBY -> DEPLOYMENT -> EXPANSION -> TERRITORY -> SIEGE -> FINAL_HUNT -> FINISHED/VOID`.

- Before FINAL_HUNT: hero death triggers bounded respawn, but villagers/minions/towers don't magically resurrect. Match state is fully deterministic under server-authoritative fixed ticks.
- When either Command Seal reaches zero: `FINAL_HUNT` starts, **normal hero respawn disabled for BOTH teams**. Defenders may counter-breach. Primary victory `enemySeal.breached === true && livingEnemyHeroes === 0`.
- At hard deadline, both Seals are force-breached, spawn disabled, then survival elimination resolves. Terrain circle shrinks after 2m of final hunt; progressive environmental damage prevents hiding. Both teams simultaneously dead -> `VOID`, never arbitrary winner. If winner cannot be proven, game and Diamond settlement must fail closed.
- Heroes are the only units relevant to final elimination; villagers/minions do not prevent a valid win. Disconnect is not a safe reset/death exploit: protected reconnection window + constrained bot proxy and server-timeout; no infinite safety.
- Keep match clocks and phase transitions explicit; do not silently change the owner-locked victory predicate.

## 9. Gameplay controls, UX, audio and assets

Landscape-only battle field, player-follow camera, minimap, 3 lanes plus optional cross-routes, field target reticle, visible HP/XP, sound cues, touch joystick, four large combat actions (basic attack/primary/dash/ultimate), contextual Mine/Deposit/Loot/Train/Upgrade/Repair/Army Order and clear invalid-action explanations. Input cadence and event rendering must remain responsive on weak Android hardware; off-screen effects/audio suspended, capped NPC counts and asset budgets, 2D/2.5D scenes. Ensure items/attacks really deal damage when in range, no silent failures.

**Available Library candidates:** core/special official BUKLOD Character art; 1300 verified collectible WebP manifest; `/Sound and voice effects/Animation/rogue-hero-128-assets.zip` (8-way sprite prototype); `/Sound and voice effects/magic-spells-sfx-lite-v21-rate-r2.zip` (11 OGG cues, game license); `/Buklod V2/KayKit_Furniture_Bits_1.0_FREE.zip` (CC0 props); multiple labeled FREE VFX/monster packs; galaxy images. Exact rights, attribution, transform compatibility and source dimensions must be checked **per actual used asset**. Do not assume “FREE” filename means redistribution rights. Unknown-licensed songs and Craftpix assets stay excluded pending license verification. New hero art only when a genuine missing capability cannot be derived from existing licensed art.

## 10. Implementation architecture, quality gates, and non-claims

Use one deterministic headless match state engine shared between offline simulations and an eventual trusted server. Input commands are bounded, target/range/speed/ownership/resource/cooldown validated; server owns RNG, damage, spawn, receipt verification, winner, ranked settlement and season/OTA compatibility. No browser localStorage or offline HTML can constitute proof of Character item ownership, BP balance or real PvP wins.

**Development sequencing:** frozen editable contract -> isolated simulation engine -> Node behavioral tests/edge cases -> landscape HTML/UX manual practice -> adversarial server/backend integration -> true matching & multiplayer -> devices/RC -> authorized release. If previous steps are incomplete, label partial. Do not claim online multiplayer or Ranked ready from 14 passing offline unit tests.

### Acceptance / negative tests

- For all 13 × 20 × 5: valid canonical asset key, independent Character inventory, no item forgery or cross-user grant.
- Wide map spawns distant; symmetric resource chance; robust movement speed, collision and LoS; every hero attack/skill has demonstrable effect and cooldown.
- Mine while in range -> carried resources -> deposit -> treasury; expired buffs excluded; spawn/buff renewal bounded; wounded Villager can die, re-training costs materials.
- Empty minion queue -> zero free minion waves; underfunded queue/repair/upgrade rejected atomically; structure repairs blocked under attack, no immortal towers.
- Shellkeeper Structure XP has no free upgrade; Stalker focuses heroes, cannot destroy Seal or spawn-camp.
- Seal only destroyed -> status ACTIVE; final enemy wipe before Seal -> no victory; breach + alive enemies -> no victory; breach + all dead -> exactly one winner; simultaneous wipe -> VOID.
- Reconnect/duplicate command/reordered input/lag and double settlement; forged inventory or manipulated clock cannot win or mint currencies.
- Show Faith OFF can reach every mandatory progression slot; protected BP/Rank, legacy Character levels, QMP, ads and native app remain unchanged.
- Before approved production: actual RLS/migrations, CI exact head, signed multiplayer authority, native device/landscape FPS, thermal/memory, sound licenses, release gates; no backport that regresses previous Arena feedback improvements.

### Implementation status on V2 isolated DEV

The V2 subdirectory implements an **offline headless simulation and optional HTML visualization**, not an online service: 13 identities, wide maps, finite terrain blockers and line-of-sight checks, mining, deposit, paid unit queues, villagers and paid villager repairs, role skills plus identity-specific effects for all 13 heroes, basic rank-eligibility/match-bracket validation helpers, roaming creatures, Stalker and Shellkeeper, tower repairs/upgrades, Seal+Final Hunt victory and fixed-step tests. **Known remaining production blockers**: authoritative connected item receipts and Circle Rank gates, exact original hero animation rigs/1,300 WebP rendering in the Arena, matchmaking/network session server, anti-cheat/RLS, ranked Diamond settlement, advanced playable pathfinding/LoS/ambush map assets, full 13 distinct combat kits at item-specific animation fidelity, robust team voting and failover, balance telemetry, real device/RC. This design contract is *locked*, the implementation is not certified complete.

### Change control

Any future gameplay revision must modify this file alongside executable behavior and at least one new focused behavioral test. Record why the change improves the approved player experience, its impact on fairness/economy/victory, and explicit DEV/CI/RC/production evidence. Never quietly change hardcoded gameplay without updating this source of truth.
