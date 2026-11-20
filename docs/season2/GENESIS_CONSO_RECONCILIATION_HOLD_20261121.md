# BUKLOD Genesis Season 2 — Consolidation Intake and Hard Release HOLD (2026-11-21)

**Environment:** isolated DEV source branch based on existing staging Genesis integration `cf99bd23d5e0eea0e56d0921c5b8079f4aeda27c`.
**Live production APK/Play/OTA: UNCHANGED.** **Supabase live project: UNCHANGED.** **Staging OTA: NOT PUBLISHED, NOT READY.**

## Actual integrated source in this change
- From World design PR #1042: earned-only BP wallet/provenance, disabled QMP-spend policy, permanent asset development/planning, future item catalog, community treasuries/challenges, item and development tests. Existing Finance is authoritative.
- From Empire Arena DEV: authoritative fixed-tick game rules, room/matchmaking and planned-not-committed outcomes, 13 heroes, Diamonds, ranked losses and anti-farming tests. No realtime match server or backend settlement deployed.
- From trade PR #1044: BP never minted by business operations or item trade, no unaudited rank or QMP gains.
- From sprite PR #1045: verified PNG sprite frame resolver with stale revision protection and animation renderer. No artwork installed by this import. No runtime import from existing tabs, Home or finance screen, to protect production/staging behavior.

## Required map-first navigation: user-requested end state, NOT implemented by source intake
Authenticated first view: immersive illustrated BUKLOD map `BUKLOD Community Map: A Welcoming Valley.png` from Library; all top-level destinations presented spatially. DO NOT use rough green prototype as final scene. No permanent old menu/tab bar in Genesis. All routes/feature permissions remain behind existing guards. City plan (not geo-location):
- Social Plaza: Community Wall (public posts), scope Wall behind membership, Today's Best, Reels, Connect messaging, Notes, PTT, calls.
- Community/Cluster Village: membership, organizations/suborgs, families, Bayanihan, cluster project challenge, attendance, real-world projects and member help.
- Learning/Faith/Stories: Bible, Daily Reading, Matthew Henry, lessons, Sunday School/children, secular lessons when Show Faith is off.
- Home/Estate: permanent personal Lot, House, farm, interiors, pets, inventory and cooperative Cluster / Org parcels; progressive level 1–10.
- Arena/Kingdom: 13 Characters, BP-item-gated evolution, verified Diamond combat level, true PvP win/loss and ranking (server-authoritative).
- Market/Business: palengke, merchant onboarding, product listings, customer purchases, item trade, construction resources; Focus Apps routes remain canonical.
- Government/Health/Help: Government Focus App, agency staff permission, health, support, BSOC concerns, safety reporting.
- My BUKLOD / services: profile, overall/monthly rank, badges, QMP history, notifications, search/settings, My Drawer, account/deletion/privacy/admin, finance withdrawal where authorized.

**Map entry must preserve:** auth/compliance/maintenance/update/onboarding checks, PUBLIC scope reset, first-view AdMob startup/prewarm, no duplicate Home card/feature bar, backgrounded video offscreen lifecycle, safe area/keyboard, permissioned Focus Apps and legacy deep links.

## Economy and user guide — exact authority boundaries
| Unit/account | How obtained | How used or changed | Do not combine with |
|---|---|---|---|
| Lifetime earned BP / Circle Rank | Canonical verified participation rewards; History never decreases on purchases. | Determines Circle Rank and BP eligibility (not purchase payment). | Marketplace sale/trade/operating business must not mint BP. |
| Available/spendable BP | Newly verified BP plus transferred **existing** BP. | Debited by actual purchases, building, gifts; dual-entry transfer and audit. | Never sell BP for cash, never retro-credit lifetime earned on receipt of a gift. |
| QMP | Production Finance is authoritative; proposed World QMP qualification by settled verified BP spend is DISABLED. | Monthly qualified share of eligible realized AdMob-only member pool; closed periods immutable. | Gifts, fake trades, BP earnings alone (proposed model), sponsor income/fiat, bad receipts. |
| Character items/levels | Earn items via verified tasks, faith-neutral options; BP opens **eligibility only**. | Each Character evolution needs exact items and verified progression receipt; preserve legacy levels. | Do not treat cosmetics, BP alone, another Character or Show Faith as a shortcut. |
| World goods/materials | Authentic verified rewards, store purchase, craft, harvest, member-to-member transferred items. | Inventory reserved/settled atomically for stages and trades, price-versioned SKU/unit receipt. | No phantom inventory or double spending. |
| Arena Diamonds | Verified activity/authoritative ranked result; noncash, nontransferable. | Can be lost on ranked defeats to reduce effective combat level, never historical BP. | No redeemable currency/QMP conversion, no client-scored win. |
| Community Treasury BP | Future approved Cluster share of eligible verified member activity, separately audited. | Approved shared projects / sponsor-funded prize with dual audit. | No member wallet stake or mutual approval as sole proof. |

**Existing example rewards, not all active in staging S2:** daily verified reading +10 BP, series completion +50 BP; referred member 10 and referrer 20 BP only once a qualifying Cluster rank rise occurs. Review exact configured reward effective versions before publication. Arena proposed example win +3 BP, ranked defeat -10 Diamonds subject to anti-farming cap; never display as live rate without verified backend. World sample prices (wood plank 6 BP, plywood 40 BP, cement bag 60 BP, hollow block 3 BP) are **illustrative only**.

## Source discrepancies: mandatory fixes before release
1. `Buklod V2/buklod_assets_catalog.json` lists 10 tiers but BP, materials, DXP and construction-day requirements are NULL/empty. **No production-valid price or ability to buy these levels.**
2. Library house art catalog lists **5 stage IDs per tier**; World design and copied PNG renderer have **3**, separate Business DEV has **5**. Unify 5-stage authority and matching verified server receipt + art keys, not by silently skipping stages.
3. QMP spend qualification is a new proposal and must be reconciled to existing Finance version; seller does not mint earned BP nor QMP just because buyer pays. Resolve buyer spends, refunds, gift vs purchase and settlement provenance under Finance approvals.
4. Character PR #1041 and trade/business PR #1043 require private SQL changesets on isolated staging DB; market #1039, scoped Wall #1038 and Government #1040 alter shared UI/SQL/permissions, not safe to blindly merge.
5. Arena is headless logic only; no authenticated lobby, authoritative multiplayer transport, durable receipt settlement, anti-cheat/multiplayer disconnect recovery or device-level 60fps proof.
6. Existing Genesis staging integration is 111 commits ahead / 1 behind main; reconcile the source divergence before identifying an RC.
7. Legacy header/nav and Home cards remain in live source; map-first removal is not implemented by this intake. AdMob/nav performance regression tests mandatory.

## Asset import and license matrix (zero budget)
| Library source | Intended use | Status |
|---|---|---|
| `BUKLOD Community Map: A Welcoming Valley.png` | Main illustrated World map and tappable locations | Present in Library, **not committed into APK** |
| `Galaxy assets/`, existing `assets/season2/genesis/galaxy/`, Green B transparent | Cinematic intro, cosmics, premium background | Some bundled; reuse existing animation/performance guards |
| `Buklod V2/` furniture 128/256/512, KayKit, Fantasy Village, Tavern, catalog PNG level entries | Lot/House interiors, progressive buildings and market kiosks | Asset inventory present; needs exact SKU/frame mapping and individual license |
| `Sound and voice effects/Animation/` many sprite/GLB/VFX archives | Arena heroes, FX and motions | Archived assets only; file licenses and native renderer integration pending |
| `Sound and voice effects/` WAV ambience/arpeggios and ZIP/OGG packs | Tap, unlock, crafting, build, footsteps, arena hits | Some candidate files; provenance and redistribution clearance pending |
| `BUKLOD_AUDIO_LIBRARY/music/` cinematic fantasy MP3/M4A | Contextual map/arena/estate looping music | **LICENSES FOLDER EMPTY** — do not embed unreleased tracks |
| `Sound effects/` game-ready and commercial-game-named MP3 | UI reward FX | Licensing unclear, block game-sourced samples |

No paid asset purchase is required. Use confirmed CC0, correctly credited CC-BY, original generated SVG/code FX and original app assets; do not assume downloadable packs or “No Copyright” music are licensed. Apply in-app credits when needed. Optimize static art to WebP, frame atlases and audio to OGG/MP3 only when source license allows.

## Premium AV and native gates
- Startup: center animated transparent Green B over first-light galaxy; no legacy thorn-on-black splash; native splash may require fresh APK.
- First map: whole-city high-resolution artwork, smooth pan/accessibility hotspots/zoom, district entry, no card clutter. Additional scenes self-contained and character-rich.
- Music: explicit toggle ON/OFF, default respectful consent, prefetch bounded local tracks, focus and audio interruption handling (calls, video, system media), never autoplay over Bible, Connect calls or active videos; fade scene changes; pause in background; obey reduced motion.
- Construction: five verified visual sub-stages per level, discrete haptics/SFX, no missing art presented as final, stage receipt CAS version and rollback/anti-double-spend.
- Arena: native 60fps target only after measured proof, deterministic inputs, signed server results and client prediction/reconciliation, anti-cheat and weak-network reconnect; avoid unauthenticated match outcomes.
- Native package: `org.mzbministry.buklod.staging` and `2.0.0-genesis-preview` runtime only; compare 4 SDK additions against exact signed APK. New native means build new staging APK before compatible OTA.

## RELEASE GATES (fail closed)
- Source CI + TypeScript/Metro + navigation, scope Wall and AdMob startup/regression pass on exact SHA.
- Verified licensed map, sound/music and complete animated assets in the actual bundled APK.
- All economy values ratified; isolated DB RLS/ledger/provenance, concurrent settlement and backwards compatibility tested.
- Native runtime, signed APK installation build ID, channel, EAS update receipt and exact OTA SHA verified.
- Physical/device visual verification **waived by owner**, therefore visually unverified, not implied passed.

**Conclusion:** Partial source integration only. No claimed Staging OTA readiness and no deployment.