# BUKLOD Empire Arena — Implemented Domain Logic & Integration Contract (2026-11-21)

**State: ISOLATED DEV IMPLEMENTATION; NOT A PLAYABLE MULTIPLAYER BUILD; NO LIVE BP OR DIAMOND WRITES.**
**Branch:** dev/buklod-empire-arena-logic-20261121.
**Rule version:** 1, Genesis: Let There Be Light visual season is a removable cosmetic layer.
**Scope:** New independent BUKLOD Empire Arena. Its original hybrid combat replaces the previously proposed War Arena name. The older Empire R14 RTS design remains documented and is not silently deleted; its terrain, supply, formations, base-building and strategic lineage informs this new game. Existing Kingdom 13-station / 39-game roadmap, BUKLOD Main, Character, Circle Rank, BP, QMP, personal property and Wall are unchanged.

## 1. True gameplay outcome, not a leaderboard fiction

- Cluster Clash 3v3: 330 seconds (5.5 minutes), Genesis Rift / Aurora Foundry / Verdant Fracture, 3 relays, two team cores.
- Duel 1v1: 180-second limit, first team to two knockouts; health/knockout tiebreak.
- Grand 5v5: 540 seconds, 4 relays, larger skill coordination. Performance and queue-population gate before activation.
- Ranked rosters are human-verified and source-bound; training bots are clearly labeled and never earn ranked BP.
- Server runs fixed 50ms combat ticks; each client command carries actor identity, monotonically increasing sequence and a match-scoped signed ticket checked at gateway. No direct client settlement.
- Combat includes 360-degree movement, obstacle collision and line of sight, attacks, team shield/heal, ranged burst, blink, disruption, dodge/secondary skills, ultimate, knockout/respawn, and leaderboards derived from signed results.
- The 13 canonical IDs are Phan, Quin, Van, Christian, Lhen, Jawo, Trudice, Ace, Mitch, Niel, Angel, Vhen and ELESUR. ELESUR persists as **ellusur**; never remap to legacy **elesur**.
- Every character has a combat archetype in the catalog; at V1 only shared signature-family mechanics run in the headless rules engine. Unique character-specific animation rigs / skill effects are NOT yet final or playable. Do not advertise 13 production-ready heroes.
- Match outcome: core destroyed; or all active relays connected and held for 12 seconds (Network Lock); or most core HP at time limit; if tied, relay-control/knockout tiebreak, then up to 60-second sudden death. A completely inactive, unresolved tie becomes **VOID**: no fabricated loser, BP or Diamonds.

### Signature mechanics versus ML/COD

**Flux supply:** Captured Light Relays produce temporary team Flux; only nodes connected by a graph to the home anchor (directly or through a temporary Bridge) count. This makes movement, relay defense, network severing and construction decisive. Flux resets at match end and has no financial value.

**Buklod Link:** A player links with a nearby living teammate within line of sight, spending 15 Flux; both gain a time-limited shield. Two linked allies accelerate an uncontested relay capture (1.5x). Repeat limited by 20-second cooldown.

**Tactical formations:** A pair of nearby living teammates can activate a guarded formation for 8 seconds at 12 Flux cost, 25-second cooldown. "Guard" reduces damage taken by 15%; "Surge" is reserved for the next tested balancing pass, currently only records formation intent. Never claim Surge attack boost is active before implementing it.

**Construction:** Temporary barrier, healing station and bridge (costs 25/30/20 Flux, architect discount), up to three active per team, 45 seconds per structure; barrier reduces core damage in its zone, heal station restores nearby ally health, bridge creates a local traversal shortcut and extends relay connectivity. Buildings expire; they do not affect permanent houses, lots or Cluster assets.

**Counterplay:** Even a weaker player can capture relays, cut supply, coordinate Link, out-position over cover, choose core siege instead of pursuing eliminations, and win by an objective. Higher combat level provides capped numerical advantage (~11.4% maximum HP / damage scaling at level 20), not immunity or auto-win. Level-gated secondary (3+) and ultimate (6+) are real combat eligibility rules.

**Continuity with Empire R14:** Continuous Evolution, six RTS eras, historical Skirmish saves, military/civilian economies and asset inventory remain separate archived product proposals. The current Arena logic neither imports nor rewrites old saves and must not be used to claim the R14 campaign is already playable.

## 2. Exactly how losses and rewards work

Canonical Character Development Level (CDL) remains attached to each character and still requires verified BP eligibility **and item acquisition/tasks**. Circle Rank remains based on BP. Existing permanent items, collectible history, BP ledger and personal/community assets are NEVER debited for an arena loss.

A separate character-specific **Diamond balance** (not Kingdom Shards, not cash, not tradeable and never purchasable) is earned through verified BUKLOD participation. Its threshold defines Diamond-Supported Level (DSL). Effective Combat Level is min(CDL, verified-BP-gate, verified-item-gate, DSL). A ranked defeat decreases that character's Diamond balance and therefore can decrease actual usable combat level and ability eligibility without erasing earned permanent items. Switching characters does not restore that depleted character's wallet. Minimum effective combat level is 1; a player is always eligible for a free baseline fighter.

**Sample thresholds, server-controlled rule V1 (not live):**
L1 0; L2 15; L3 35; L4 55; L5 75; L6 100; L7 120; L8 155; L9 200; L10 260; L11 340; L12 440; L13 570; L14 730; L15 930; L16 1180; L17 1490; L18 1870; L19 2330; L20 2900.
For a verified Level-7 player with 125 Diamonds, a ranked loss of 10 gives 115 Diamonds and effective Level 6. The visible unlocked permanent Level 7 and items survive.

**Current DEV simulation values, not activated in the production reward catalog:**

| Outcome | Character Diamonds | BP | War rating |
| --- | --- | --- | --- |
| Qualified ranked Duel win | +6, capped | +2, capped | ↑ relative to opponent |
| Qualified ranked Cluster Clash win | +6, capped | +3, capped | ↑ relative to opponent |
| Qualified ranked Grand War win | +6, capped | +4, capped | ↑ relative to opponent |
| Valid ranked defeat | −min(current, daily remaining loss allowance, 3+effective level capped at 12) | 0 lost | ↓ relative to opponent |
| Verified non-war participation event | +10 to active eligible character, daily capped | from separate existing policy only | unaffected |
| Casual/practice/AI match | 0 | 0 | unaffected |
| Unverified/void/incident-held match | 0 pending verification | 0 | 0 pending verification |

Daily War BP cap 12; pair-win reward cap twice per 24 hours; Diamond earnings cap 50/day and daily losses cap 30. Winners must meet verified minimum match duration, human eligibility, 40% active time up to 60 seconds, and material contribution. Ratings use a team-average Elo-like policy with K=24; both winning and losing teams change by symmetric upset amounts. Competitive rank divisions: Pioneer, Builder, Pathfinder, Guardian, Vanguard, Luminary. Names are War divisions only; never rename Circle Rank.

The V1 policy is a *pure planning function*. It returns a **settlement intent**, not a live award. Additional BP will enter the legitimate existing participation economy ONLY when the canonical BP evaluator approves the new activity, risk policies and daily budget. Winning never transfers BP from the losing players, and businesses never mint BP.

**Faith-neutral parity:** Show Faith is optional. Every required Diamond source, level item or competitive option has a practical non-faith path. No faith participation required for War access. No bonus combat damage for religious expression.

## 3. Matchmaking, scopes and optional microphone

- Only server-validated authenticated active human members with a legitimate loadout and session join ranked matchmaking. A client-provided Cluster name/ID is never proof of membership.
- Balanced team assignment searches rating + effective combat level + latency; gradually widens tolerance after 45/90 seconds; validates exact 1v1, 3v3 or 5v5 roster size.
- Cluster vs Cluster challenges use server-verified locked memberships of two distinct active Cluster scopes and can be rematched; random matchmaking does not require a Cluster challenge.
- No fake competitors, silent bots or guaranteed wins. Colluding repeated matches can still count toward competitive record review but stop earning extra BP.
- Voice session is separate from BUKLOD Connect, enabled only after mic consent; team A and B have distinct short-lived voice channels, default Push-to-Talk, mute/report controls, no voice recording by default. Do not reuse a Connect room or expose cross-team audio.
- AFK / disconnection grace, server incident voiding, appeal and verified results must be enforced before ranked release. Device/network outages MUST NOT automatically destroy canonical progression.

## 4. Runtime boundaries

~~~text
BUKLOD Main / React Native / Expo
  + lobby + character selection + community verified scopes + display-only wallets
             |
             | authenticated matchmaking, trusted loadout/level snapshot
             v
  Empire Arena Gateway (signature-checked short lived match ticket)
             |
             | commands: move, attack, skill, build, capture, link, formation
             | actor id, room id, sequence, monotonic tick
             v
  Headless deterministic Arena engine (arenaCore.mjs at trusted runtime)
             |
             | authoritative snapshots and client-side reconciliation
             v
  Godot native rendering/input module (future; separate Android build)
             |
             v
  Trusted signed terminal result (WIN / LOSS / VOID)
             |
             v
  Settlement policy planner (settlementPolicy.mjs)
             |
             | transactionally deduped outbox + signed receipt hash
             v
  Private Arena Diamond/Rank Ledgers + canonical BP evaluator
             |
             v
  Player result screen / profile War division / eligible Wall share
~~~

**Do not use Supabase Realtime, Edge Functions or Postgres for per-frame movement/attack events.** Supabase stores verified account, scope, wallet, rank, settlement audit and result only. An isolated real-time game server (and optional voice SFU) is needed for real human matches. Network packet transport/latency/reconnect engineering, runtime costs and anti-cheat require validation and funding before activation. Keep secrets outside clients. Native Godot embedding is a spike; existing Expo app has Skia and Rive but no verified embedded Godot runtime. Adding Godot requires a new APK/AAB, not a JavaScript OTA alone.

Proposed transport: 20Hz fixed server simulation, 10–20Hz deltas and visual client interpolation to target smooth 60fps presentation (adaptive 30fps under low-end thermal constraints), per-input monotonic sequence, server rewind buffer and short rollback only after profiling. No claims of measured latency or frame performance at this stage.

The current code has real side-effect-free deterministic transitions and receipt-planning, but not a deployable multiplayer gateway, signed packet implementation, dedicated headless game server process, Godot scene, app launch screen or verified mic transport.

## 5. Identity, data persistence and anti-fraud

The existing database already has BUKLOD scopes/memberships, BP ledger, Character collectible state and Character level persistence. The Arena will be **additive**, never rename or overwrite these tables.

See: docs/empire-arena/PRIVATE_DATABASE_DRAFT_20261121.sql (UNAPPLIED).
- Private match roster/result, character-scoped Diamond wallet/ledger, rating, settlement and canonical BP outbox.
- Private RLS enabled and public/anon/authenticated privileges revoked. Do not expose service-role or settlement signer keys to client.
- Result handler checks actual trusted match server signature, room, account, roster, immutable rule version, hash and state before any mutations; hold for review if disputed or server outage.
- Settlement transaction locks relevant wallet/rank rows in deterministic user-id order and creates *one* match settlement receipt plus matching intent outbox events. On retries return exact same receipt; never apply Diamond loss twice.
- Canonical BP grant worker consumes outbox with an idempotent source key; never directly writes to user-provided balances. BP grant confirmation must precede user-facing **credited** badge; pending BP must be labeled pending.
- No double replay of a match, duplicate service job or concurrent settlement may increase BP. Monitoring tracks repeated opponents, short AFK wins, scripted movement, colluding Clusters, lag abuse and suspicious client update spikes.
- Staging must use a separate payout/economy ledger or a disabled-economic-impact flag even if authenticating through live BUKLOD identity.

## 6. Release evidence and blockers

### Implemented in the isolated DEV branch
- Deterministic engine: 13-character combat catalog, 3 maps, 3 match modes, genuine end conditions, fixed tick, collision/line-of-sight, skills, respawn, structures, relay network, Buklod Link and formations.
- Pure verified settlement intent including rank gains/losses, Diamond reduction and bounded BP awards, with anti-farming and faith-neutral participation source validation.
- Verified-human matchmaking planner with Cluster challenge membership filter and team-only microphone policy metadata.
- Regression test suite in tests/empire-arena-logic.test.mjs.

### Not yet implemented / mandatory blockers
- Actual Godot player controls, cinematic art, 13 distinct fully rigged fighters, mobile/audio UX and real Android runtime.
- Server endpoint, live sockets, match replay signatures, long-running rooms, NAT/reconnect, anti-cheat evidence and team voice SFU.
- Private-schema migration review, transactional execution, integration with canonical BP award path and production-point-budget review.
- 6 independent real accounts/devices end-to-end, live matchmaking, failure simulations, actual Infinix X6852 GPU/battery tests and accessibility.
- Main app launcher/feature flag, APK/AAB with native engine, regression against Wall/Connect/AdMob/Genesis and owner-approved RC.

**Release:** DEV → separately verified RC APK (new native runtime) → Google Play Production when gates permit → enable real matches and rewards after evidence. Do not ship a partial engine via OTA or change existing Main/Genesis release artifacts.

## 7. Test command

At a checkout of this DEV branch, run:

~~~bash
node --test tests/empire-arena-logic.test.mjs
~~~

The pure JavaScript engine has no new NPM/native dependencies. Domain tests executed through isolated exact-source V8 evaluation during authoring; a checked-out Node/Expo/Android runtime and live server tests are still required. Every release gate must distinguish these stages.
