# BUKLOD Season 2: Map-first world reconstruction — staging implementation

**Source:** descendant of Genesis preview staging source `d15de62b11e9d6b2660370423fade2e4bf2d430b`, not production main. **No live database migration and no OTA publication.** Existing production must remain unchanged. The navigation hub is enabled *only* when `EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW=true` and `EXPO_PUBLIC_APP_ENV=staging|preview|dev|development`.

## One-map information architecture

After login and the existing privacy/auth/runtime guards, the first route is `/buklod-map`. There is **no top dashboard navigation header, side hamburger nav or bottom navigation bar** for Genesis preview. The only persistent navigation chrome on eligible feature pages is a small "MAP" return shortcut; calls, keyboard overlays, login and immersive media are exempt. Existing route code, permissions, ads and loaders remain intact; category tiles merely navigate to existing authorized feature routes.

District taxonomy:
1. My Place: Personal Home, Profile, BP/character.
2. Community: Public Wall, Reels, Today's Best inside Wall.
3. Connect: Messages/Calls, Notifications.
4. Communities: Clusters, Organizations/sub-orgs, Bayanihan.
5. Growth: Learning, progression; Bible and Life only when Show Faith is enabled.
6. Kingdom: Existing Kingdom, Genesis collection, Practice.
7. Market & Economy: Market, Business, Economy Guide.
8. Services: Focus Apps including Government, Health, Support, Settings.

Do not expose Admin or agency-management screens as public map shortcuts. Government stays under existing Focus Apps, permissioned server-side. Legacy deep links remain navigable.

## Native and asset reuse (zero new services)

- Bundled Genesis image: `assets/season2/genesis/galaxy/nebula.jpg`; original transparent B: `assets/season2/genesis/genesis-green-b-transparent.png`.
- Scene FX: native React Native Animated + SVG `GenesisCosmicSky`; GPU-backed transform only while focused, app foreground, no reduced motion.
- Map ambient: already bundled `assets/sounds/kingdom-premium/kingdom-theme.ogg`, through existing `useRorkGameAmbience('kingdom-map')`. The user can turn it on/off; respects sound setting, audio lifecycle, app state and quiet hours. Do not loop social feed or calls. Local fallback is existing `buklod-kingdom-cinematic-ambient.wav`.
- Existing `kingdom-village.ogg`, `kingdom-great-hall.ogg`, and 9 Kenney CC0 WAV effects are licensed and pinned in `assets/sounds/kingdom-premium/LICENSES.md` and `manifest.json`.
- Zero backend calls added to launch the map; no asset upload mandatory **for this navigation screen**.

## Assets still required for full premium specification

The exact owner named "BUKLOD V2" folder was not discoverable in the connected Drive/Library searches. Upload or link the owner-approved content with provenance (source, author, permitted distribution) and checksum. Destination paths:

| Asset | Repo destination | Requirement |
| --- | --- | --- |
| Fully rigged 13 character animations, idle/walk/turn/action/evolution | `assets/season2/genesis/rigs/<character-id>.riv` | True approved Rive file, rig version, state machine, sha256, license; **currently absent** |
| Character-specific level/evolution art and collectible layers | `assets/season2/genesis/characters/` | 13 characters, 1,300 verified collectible references, level/item mapping, source/license |
| Land/house/cluster L1-L10 staged build artwork | `assets/season2/genesis/world/` | Each level must have sequential foundation/frame/wall/roof/milestone stages; high-res atlas, overlay states |
| Real-time War Challenge character animations/arena/match effects | `assets/season2/genesis/war/` | Playable assets with balanced states and safe sound design, **game/network logic separate** |
| Licensed mastering-approved seasonal hub/area music (if replacing current CC0) | `assets/season2/genesis/audio/` | Loop points, quiet-hours policy, verified usage rights, LUFS, sample rate, checksum |
| 3D environments (optional only if native runtime already supports) | `assets/season2/genesis/3d/` | Avoid changing native dependencies without new APK; use approved alternative SVG/Skia if unavailable |

Do **not** invent or insert placeholder Rive files, fake image assets or music attributed to unknown creators. No paid acquisition or external SaaS.

## Economy reconciliation blockers (do not activate against live DB)

Main backend currently carries its own points ledger, point rules, rank levels, QMP/financial summary, redemption configurations, and reward event records. New economy branches are **not** present in the signed Genesis APK source and are **not confirmed deployed to production DB**. Relevant isolated source:
- `dev/character-bp-item-faith-neutral-evolution-20261121` — BP eligibility plus verified item task/evolution schema.
- `dev/buklod-permanent-trade-economy-20261121` and `dev/permanent-asset-trade-economy-20261121` — trade, asset ownership, transfers and no-BP-mint invariant.
- `dev/buklod-market-palengke-phase1-2-20261120` — Marketplace and scoped Wall integration.

**Required integrated contracts before any OTA activation:** authoritative canonical points ledger, earned BP only through verified activities, receipt & reversal, non-negative balance and idempotent grants, no BP mint from business, trade atomic double-entry and anti-self-trade abuse; user-earned items and task evidence independent of BP, Show Faith equivalent tasks, per-character level state, token/diamond competition risks capped & anti-farming; personal lot/house/cluster stage construction persisted; cluster-wide rewards funded from legitimate pools not external staked BP; QMP remains separate, finalized monthly funds based on actual revenue with verified withdrawal identity; scope isolation and member verification; audit/reconciliation dashboards, rollback and client compatibility. Exact item values/requirements and per-activity points must come from signed-off config, not fabricated labels.

**DB:** The connected live Supabase project has no development branches. All schema and privileged operations must be tested on local disposable DB or a verified zero-cost isolated test environment. Do not run DEV migrations directly on live production. Preserve historical transactions and RLS; signed old clients must not receive new economy endpoints before release cutover.

## Non-negotiable gates

1. Reconcile the above divergent November branches, latest main production source and existing Genesis staging source. Never bulk-merge stale branches; use path-level diff, authoritative schema and explicit collision review.
2. Run typecheck, Expo Metro compile, Jest/route tests, offline/reduced-motion and navigation/back-path tests, performance+AdMob first-view regression, Android native parity and AdMob SDK compatibility; no fake test success.
3. Verify signed staging APK source `5bd80dbcafd85b0e8dc3c78f8d555b4aff2193d0`, runtime `2.0.0-genesis-preview`, package `org.mzbministry.buklod.staging`, channel `season2-genesis-preview`, and all native inputs/installed modules byte-for-byte.
4. A published OTA must return an exact EAS update ID & Git SHA and receive readback from **staging**; production channel and package untouched. If owner skips physical visual approval, mark **SKIPPED**, never VERIFIED/PASSED.
5. Even after Dec 6, 2026, production is locked until separate explicit release authorization and finance/ad/navigation gates.

**Current status: source-only map navigation work in DEV; consolidated Season 2 OTA is NOT READY.**
