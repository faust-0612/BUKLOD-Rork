# BUKLOD Empire Arena V2 — offline DEVELOPMENT prototype

**Canonical editable gameplay contract:** [`../../docs/empire-arena/BUKLOD_EMPIRE_ARENA_V2_CANONICAL_DESIGN.md`](../../docs/empire-arena/BUKLOD_EMPIRE_ARENA_V2_CANONICAL_DESIGN.md)

The code under this folder is **offline-only**. The old `experiments/empire-arena` playable demo is preserved; V2 lives separately to prevent regression. No Supabase, wallet, ranked, business, Kingdom, account, native module or OTA access.

`arena-v2-engine.mjs`: deterministic fixed-step simulation. `index.html` + `arena-v2-ui.mjs`: landscape visualizer with in-match commands. `media.mjs`: six licensed game-embedded Magic Spells Lite OGG cues already in the user Library. Hero names and verified asset key identities are canonical from the repo `src/lib/buklodCharacterWorldCatalog.ts`; selecting a demo level does not load actual user receipts.

From the repository root, serve static files (no paid hosting required):

```sh
python3 -m http.server 8000
# Open http://localhost:8000/experiments/empire-arena-v2/
node --test tests/empire-arena-v2-design-and-simulation.test.mjs
```

**Controls**: WASD/arrows or drag joystick to move; Space / attack button = attack selected or nearest target; `1` primary skill, `2` dash (requires in-match L3), `3` ultimate (requires in-match L6); `E` mine when close, `F` deposit near own base. The right-side buttons support train (team treasury), tower upgrade/repair (near own tower), army orders, loot, boss targeting, SFX toggle. Click a visible enemy to set the target. Tall/portrait screens show rotate guidance. For phone file-system loading, local modules require a local HTTP server or hosting.

**Not yet verified as multiplayer, real user item ownership, ranked balance, polished original hero rigs, pathfinding or device-ready Season 2 native integration.** No online PvP or production release is authorized from this folder.

Media: embedded six audio clips from user Library `/Sound and voice effects/magic-spells-sfx-lite-v21-rate-r2.zip` by Willosuna, licensed for project use; no separate redistribution of the media pack. Other VFX packs have not been shipped under V2 without individual license review. No third-party copyrighted songs included.

## Cross-feature BUKLOD Exchange sandbox (V2.2)

`buklod-assets-progression.mjs` adds independent House/Lot/Cluster Map Level 1–10 construction with visible foundation/frame stages, escalating material/XP/time gates and idempotent cross-cluster contribution receipts.

`buklod-exchange.mjs` is an **offline, in-memory and nonpersisting economy simulator**. It models the BUKLOD-wide design contract: separately verified Kingdom/Arena/Community evidence, authentic canonical character-exclusive trade gear, construction supplies, Cluster-owned strategy items, cross-cluster BP balance transfers, escrow/idempotency, House/Lot/Cluster Map construction contributions, and optional team sponsorship. `arena-v2-world-bridge.mjs` connects one committed strategy permit to an Arena practice match without permitting client-side reward or match settlement. `arena-v2-empire.mjs` consumes the one-time engineering bonus when a genuine construction order begins.

**CAUTION:** `sandboxEvidence()` and `simulateApprovedArenaBp()` create test fixtures only and MUST NEVER be used for real auth, item receipts, BP issuance or QMP. The browser game is not connected to this ledger or real user inventories; tests execute the cross-feature flow. Do not mistake mock accounts/tradeable item types for live BUKLOD trading. Live server-only escrow, earned-vs-transferable BP separation, community treasury governance, Character evolution receipt/RLS reconciliation and native UI remain release blockers.

```sh
node --test tests/empire-arena-v2-world-economy.test.mjs
node --test tests/empire-arena-v2-design-and-simulation.test.mjs
```