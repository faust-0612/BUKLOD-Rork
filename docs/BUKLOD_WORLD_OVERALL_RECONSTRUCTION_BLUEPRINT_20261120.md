# BUKLOD WORLD — COMPLETE OVERALL RECONSTRUCTION BLUEPRINT (DEV V1)
**State:** architectural contract + purpose-first guide implemented on isolated DEV branch. World commerce, land registry, ownership, premium construction scenes, transfers, elections and new finance rules are **NOT live or enabled**.  
**Source baseline:** `faust-0612/BUKLOD-Rork` main `536741f8d97fc9dec91503c89f1c1160e5987ce0`, 2026-11-20.  
**Season branding:** Genesis: Let There Be Light, one centrally controlled app-wide theme; honor reduced motion, excellent contrast, and mobile GPU/performance budgets.

## A. The permanent product promise
BUKLOD is a real-people virtual community that strengthens real-world relationships. An individual without an organization, leader, property or spendable BP must be able to enter, meet others with mutual consent, learn, help, and belong. No feature is deleted by this reconstruction. Reorganize discovery and link experiences, not duplicate the existing functions.

**Four layers:**
1. **General BUKLOD World** — universally visible destination map (not a geolocation map), public Wall, Connect, learning, faith, Kingdom, trade and services.
2. **Personal estates** — virtual land, shared residence, rooms, house, decoration, farm, pets, inventory, co-ownership; no property required to participate.
3. **Real community estates** — existing verified Cluster / Organization / Sub-organization / Family-based compounds, subdivision and shared facilities; governance and treasury audited.
4. **World authority services** — product catalog, BP ledger adapter, inventories, property registry, scenes, activities, trade, elections, trust, analytics; preserve existing Character and Finance authorities.

**Non-negotiable exclusions:** No mandatory subscriptions for public access; no shortcut to sensitive private scopes; no synthetic accounts pretending to be people; no artificial earned QMP for buying/trading; no claim of land deeds; no forced screen time.

## B. Navigation and World guide (V1 source implemented)
Canonical route entry: authenticated `src/app/index.tsx` -> `/(tabs)/hub`, preserving existing auth/compliance/maintenance checks and PUBLIC-scope reset; `src/app/(tabs)/_layout.tsx` initial route `hub`. Existing wall `/buklod` is intact and reachable in one tap. Existing five tab nav stays Home, Cluster, Wall, Connect, Profile; no new World tab.

`BuklodWorldGateway` is inserted before existing Home content (native + web). It displays a lightweight map-like interactive layout, purpose welcome ("Ano ang kailangan mo?"), eight purpose intents, grouped directory and links to existing route/permission guards. Offline first render, per-account locally persisted selection. **Preview-only:** My Land and World Resources are explicitly labeled; there are no actual BP or asset transactions.

To reach authentic Google Maps-like polish, replace the current lightweight map rendering with an approved layered authored world art pack in a later renderer release. Do not portray today's native schematic as final premium world graphics. Keep existing Home notices, QMP contribution, maps, SOS, AdMob and other cards; in later UI integration, avoid stacking dense cards before the map and revalidate ad lifecycle/first view.

### Destinations and canonical authority
- Wall -> `/buklod`: shared public discovery, exact scope Wall preserved.
- Connect -> `/messages`: existing chats, voice/call, notes, visibility lifecycle.
- Cluster -> `/clusters`: existing membership scopes and private community interactions.
- Faith -> `/bible`; Learning -> `/learn`; Children -> `/children-stories`.
- Kingdom -> `/games`: existing canonical Character XP, item/badge and rank authority; no secondary character level.
- Bayanihan -> `/bayanihan`; support -> `/support/live`; Health -> `/profile/buklod-health`.
- Market/Business/Government/Family -> `/profile/focus-apps`, still via `BuklodFoundationWorkspaceNav` and existing guards, not duplicate links/tabs.
- Existing household system `buklodBahay`: real household rooms, activities, chores, garden, compound/subdivision invitation, members and roles. Reuse as the social/household authority. New spatial property and decorative scenes must link by optional `bahay_home_id`, not recreate family messaging, shared documents, member roles or gardens in new independent services.
- Existing Profile, points/QMP ledger, legacy navigation aliases, admin/help/settings remain accessible in their current routes.

## C. Living Commons — real relationship loop
Purpose selection -> choose activity -> availability or invitation -> consented paired/small-group collaboration -> optional follow-up -> optional offline-world bridge. No attendance for its own sake; do not optimize purely for screen time. Asynchronous invitations and solo value preserve a viable path when no partner is online. Presence must have TTL, opt-in visibility and abuse/report controls. Never reveal precise user location or expose child accounts to unrestricted strangers.

Actions: find companions; guided conversation; collaborative learning and play; assist or request help; community projects; hosted home visits; shared garden/farm; mutual trade; invite external contacts via explicit user share links, no contact scraping. Any real-world meetup location-sharing requires opt-in and safe defaults.

## D. Virtual land and world continuity
- General world remains ONE shared hub across ranks. Rank does not create separate disconnected maps.
- Within each scope, introduce `world_id`, `region_id`, `district_id`, `parcel_id`, stable scene cells, occupancy, revision, zoning and coordinate bounds.
- Parcel kinds: residential, agricultural, commercial, community, protected public, resource/industry. Virtual square-meter price is server-listed per zone, not equal to a real land title. Virtual parcels cannot overlap; bought parcels must be reserved/locked inside a single DB transaction.
- Starter users have no ownership and can access public spaces or shared residences.
- Multiple properties are allowed by verified BP resources and anti-monopoly/zone caps, not simply by rank. Starter housing stays realistically attainable.
- Virtual host invites visitors, house residents and editors by separate permissions. Guest is NOT a co-owner. For co-ownership, fractional shares sum exactly to 100%; legal-like buyout/transfer contract is explicit, audited and server checked.
- Personal buildings occupy specified blueprint footprints + required setbacks and zoning; upgrading may require larger lots. Parcels can contain house, porch, workshops, farm areas, pets and decor; forbid invalid overlaps.
- Cluster world formation uses current community scope identity; initial shared world contains public/vacant land, not automatically owned property. Community buys sites with treasury BP (or other approved resource contributions), builds shared facilities, sets permissions through governance. Leaders never personally inherit community assets.
- World progression = physical changes in persistent map (new buildings, vegetation, roads, facilities), not artificial rank-mapped isolated worlds.

## E. Economy and material catalog
### E1. Canonical separated authorities
- **Spendable BP:** balance changes when earning, buying, transferring or using assets; historical lifetime earned BP cannot drop due to a purchase.
- **QMP:** monthly qualified participation share weight; open-period adjustments and Finance rules are authoritative; closed/finalized periods immutable. Existing verified AdMob-only member revenue; purchase income/sponsors/other commercial fees cannot silently mix into the payout pool.
- **Inventory:** digital goods and quantities owned by account, household or Cluster; gift of items without BP transfer is distinct from sending BP.
- **Real money:** separate payment compliance, refunds, verification and tax/financial reporting. World BP is not cash, not automatically cashable, and must not generate cash entitlement by conversion.
- **Character items/XP:** authority remains Character System, not the new property service.
- **User-funded BP top-ups:** optional future feature, off by default and subject to Google Play payments rules, local regulations, redemption/transfer restrictions and policy approvals. “Sell it outside the app” is NOT itself a Play Billing exemption.

### E2. Catalog structure
`item_sku`, `category`, `display_name`, `base_unit` (pc/kg/liter/bag/sheet/bundle/set/m2), `unit_precision`, `pack_size`, `pack_discount`, `sample_price_bp` until approved, `mass/storage_weight`, `asset_pack_id`, `tags`, `tradeable`, `giftable`, `vendor_type`, `quality_tier`, `approved_version`.

Categories: raw wood, board, plywood, cement/bag, blocks/pcs, sand/kg, gravel/kg, rebar/pcs, steel, roofing sheets/tiles, paints/liter, primer, doors/windows, electrical, plumbing, floor tiles, glass, kitchen utensils/cabinets/appliances, dining furniture, living room couch/table/TV/rugs, bedroom bed/wardrobes/curtains, bath fixtures, outdoor plants/ornamentals/fences, farm tools/seeds/soil/feed, pet items, energy/fuel, vehicles, decorative cosmetics, construction equipment, workshop machinery and community infrastructure.

Every material has **BP item value**. Tasks may award validated BP and/or discrete inventory item grants where a rule explicitly permits, but materials do not constitute a second fungible currency. User-to-user sales can use agreed BP prices (with anti-fraud ranges/limits); gifts can be BP or inventory only.

### E3. Transaction matrix
1. **World store purchase**: account BP debited to system; inventory delivered atomically; no person-to-person QMP transfer penalty.
2. **User-to-user item sale**: buyer spendable BP debit; seller spendable BP credit; seller item debit; buyer item credit; buyer's outgoing BP invokes a **policy-versioned QMP adjustment** only when policy approved. Never award seller QMP or lifetime earned BP for received transferred BP.
3. **BP gift**: sender BP debit, recipient BP credit, applicable sender QMP adjustment. Idempotent; show before confirmation. No new recipient qualified QMP.
4. **Item gift**: ownership transfer of inventory only; no BP transfer and therefore no *transfer-derived* QMP deduction.
5. **Community contribution**: BP or item contribution belongs to a named project/treasury; receipts and member rights are explicit. BP transfers to treasury need policy definition.
6. **Blueprint construction**: reserve required materials and BP, verify land zoning/capacity, then commit a single construction event; no hidden charges.
7. **Craft/produce/harvest**: deterministic capped recipe/yield, cooldown or task verification; item movement in inventory ledger; cannot mint new qualified BP or QMP without a separate canonical award rule.
8. **Refund/chargeback**: compensating journal with original idempotent receipt references; no destructive history rewriting.

**QMP deduction policy remains BLOCKED FOR ACTIVATION** until owner approves actual formula, monthly caps/minimums, recipient rules, community treasury exceptions, closed period behavior, and finance simulation against live historical aggregates. No negative or retrospective finalized QMP; no transaction without clear pre-confirmation cost preview.

### E4. Core accounting invariants
All state transitions server-transactional; immutable dual entry for BP user-to-user flows; matching item ownership ledger; policy version and reason code required; quote expires; stale price invalidates quote; balance never goes negative; same idempotency key cannot post twice; concurrent buyers cannot double-spend or oversell. RLS does not use user metadata for authorities. Admin restrictions extend to new world ledger; current production admin remains excluded from financial rewards.

## F. House blueprints, building and customization
World property editor must be a **premium scene renderer**, NOT a collection of emoji/flat icons/color panels.
- Curated architecture series: starter bungalow -> family residence -> villa -> mansion; alternate industrial/rural/subdivision options. On blueprint selection show virtual land area needed, footprint, materials by exact quantity, inventory available, deficits, BP price and style variants.
- One-click `Acquire materials`, `Start construction`, `Complete build` only when authoritative server capabilities exist; until then preview and design only.
- Separate `design_id` / `scene_version` from immutable property ownership and finance ledger. A room arrangement is not a financial asset transfer.
- Layered scenes: environment, terrain/base, foundation and walls, doors/windows, roof, interior floors, furniture, curtains, plants/ornamentals, pets, lighting, shadows, FX, UI hit targets. Render occlusion and depth consistently.
- Cosmetic editor actions: choose wallpaper/paint colors by validated material masks (not tint whole image), roofing textures, floor styles, furniture preset, curtain fabric/pattern, garden vegetation and ornamentals, rotate/move/scale object within approved anchors/slots. Tapping a preset applies a coherent room configuration. Advanced users may fine-tune position within valid bounds.
- Asset manifest: `asset_id`, checksum SHA256, license provenance, pack version, 512px+ quality floor per piece, material/depth/mask layers, LOD variants, palette masks, clickable polygons, compression/transparency test, complete fallback. Use original, legally cleared, mastered assets; reject unauthorized remote assets. No watermarked/cheap placeholders or unapproved reused assets.
- Do not release asset-light crude houses to fulfill a milestone. Show explicit `design preview` until mastered house / room / farm art packs are approved.
- Device target: stable Android UI at slow network, compressed atlas/texture streams, visible map tiles only, bounded asset cache with eviction, memory limits, decode on demand, render quality profiles high/balanced/battery and per-scene budget. Offscreen scenes MUST unmount; media or animation must stop on blur/background. Honor reduced motion and touch targets, text contrast, screen reader, dark/light support.
- Edit draft is client-side reversible with undo/redo and non-blocking save queue. Server uses revision compare-and-swap to prevent stale co-owner overwrites; collaboration conflicts are presented as new revision, never silently destroy changes. Local draft is *not* proof of ownership.
- Home visits have configurable privacy levels and explicit invitation/room access; visitors cannot freely edit rooms/inventory or infer a private member address. Non-owners require audited decorator privileges.
- Existing **Bahay** real household roles, room messages, chores, real reminders, shared files, plant/water garden and compound/subdivision data remain source of truth; new 2.5D World Property scenes *attach optionally* to a Bahay home, never migrate/delete historical Bahay records to a parallel world database.

## G. Farms, pets, workshops and resource generation
Farm zoning/plot and planting slots. Seed/soil/water/tool requirements come from approved catalog. Growth stage evolves by bounded server timestamps / care actions; fair yields and season rules, no infinite exploit. Harvest mints specific inventory item quantity, not automatic cash or QMP. Weather visuals may be cosmetic unless verified weather integration separately authorized.

Pets have housing, feed, grooming, play/interactions. Pet well-being must not punish irregular access with irreversible death or loss. Casual social interaction with pets does not require cash purchase. Sharing, gifting, breeding, trading require entitlement, welfare-safe controls, anti-bot quotas and adult/minor review.

Workshops produce exact items from recipes and energy/fuel; transactions atomically consume inputs, reserve capacity, produce outputs when approved. Distinguish play production from a real-world market service.

## H. Two markets, and optional real money
**World Market**: virtual BP-priced inventory, land/house cosmetic catalog, resource trade, auctions only if later legally cleared, maker commissions/transaction policy version. Prevent self-dealing, circular trades, automated wash-trading, abusive multi-account BP laundering, negative stock and duplicate receipts.
**Real BUKLOD Market**: existing Market Focus App sells physical goods and services for fiat; separately verified business identity, delivery/return/dispute handling, taxes and payment provider compliance. Never mingle World inventory with physical orders.
**Future paid BP acquisition**: separate opt-in monetization proposal, disabled; confirm Google Play Billing policies, eligibility for alternative billing, and financial/legal controls before any activation. Purchased BP cannot masquerade as earned participation or qualified QMP.

## I. Governance and trust
- Distinguish character/Kingdom royal rank (cosmetic), world development titles (earned accomplishments), elected Cluster officers (limited scope governance), verified real Government agency staff (government authority).
- No BP purchase of voting power; no virtual "king" permission to control other users. All organizational leadership changes server-validated.
- Governance: candidate eligibility, membership freeze, voting windows, one eligible member one vote, integrity audits, transparent outcomes, appeal, term expiry and safe transfer of treasury control; regional elections are optional and separate from civil elections.
- Public spaces require reporting, blocking, anti-harassment, minors/stranger safety, transparent moderation, rate limits, privacy controls and no precise location by default.
- Child/family spaces use stricter age-appropriate access; no random adult-to-minor invitation flows.
- Account deletion, identity verification and payout protection remain external canonical services.

## J. Proposed server modules (not yet deployed)
- `world_regions`, `world_parcels`, `world_parcel_ownership`, `world_estates`, `world_scene_revisions`, `world_room_access`, `world_asset_manifests`
- `world_item_catalog`, `world_item_packs`, `world_inventories`, `world_inventory_ledger`, `world_blueprints`, `world_buildings`, `world_build_projects`
- `world_store_orders`, `world_trade_offers`, `world_trades`, `world_trade_receipts`, `world_bp_transfer_adjustments` (only after policy approval)
- `world_farm_plots`, `world_crop_cycles`, `world_pet_state`, `world_crafting_orders`
- `world_events`, `world_activity_rooms`, `world_invites`, `world_user_purpose_preferences` (only explicit opt-in), `world_elections`, `world_ballots`, `world_election_audit`.
- For any new exposed table, RLS on creation; least-privilege grants. Prefer isolated service RPC with tightly scoped auth checks, idempotency token, bounded pagination. Never expose service-role credentials to clients. Secrets and proprietary visual assets must be protected.
- Write APIs: `quote_land`, `reserve_parcel`, `acquire_land`, `quote_blueprint`, `build_property`, `quote_trade`, `settle_trade`, `gift_item`, `gift_bp`, `edit_scene`, `invite_resident`, `join_activity`, `cast_eligible_ballot`. These are proposed names, not live endpoints.
- Read APIs: `world_map_tiles`, `world_community_summary`, `world_public_house_preview`, `world_item_catalog`, `world_land_availability`, `world_blueprint_requirements`. No geolocation inference or covert tracking.

## K. Data migration and release
- First reconcile main + current Genesis DEV + release-candidate branches; use additive changes, explicit feature flags and merge conflict review. No wholesale overwrite of the many concurrent DEV/Genesis branches.
- Phase 0 **DEV gateway**: purpose-first Home, discovery registry, preview-only economy and personalization contracts, regression tests. No Supabase migrations, no native dependencies, no financial mutations. **Current session target.**
- Phase 1 **world map renderer**: premium authored world atlas and location cards; optional scene preview, local cosmetics and accessibility/performance. Real land remains gated.
- Phase 2 **property and inventory backend**: migrations staged, security tests, owned/non-owned isolation, race/idempotency tests; paid currency still disabled.
- Phase 3 **build/farm/home visits**: approved premium 3D/2.5D scene assets, Bahay integration, offline draft recovery, permissions, in-world social actions.
- Phase 4 **world market and policy**: cost/versioned BP catalog and trades, explicit QMP formula, Finance QA, anti-fraud and manual owner decision on monetization.
- Phase 5 **governance/online multiplayer**: consented presence, election service, co-owner controls, moderation and safety pilots.
- Release only via DEV -> verified RC -> staging OTA/APK (as compatible) -> production approval; protect AdMob first-view, instant tab navigation, navigation state, Wall/Connect functionality and release identity. Never claim a design-only visual is a finished delivered asset.

## L. Test matrix and completion contract
- Navigation: fresh and resumed login, deep links, no extra bottom tab, no missing features, Focus Apps authorization, active Cluster scope isolation, public post-as-scope identity.
- Slow network/offline: map first paint and purpose actions remain local; preview does not fake balance; independently loading Home widgets cannot block initial interaction.
- Economy: item units, weighted bundle quotes, stale price, concurrent double-spend, duplicate call, funds depletion, same-person self-sale, seller inventory drain, BP ledger parity, QMP open vs closed, anti-wash trading, cash-pool separation, proper refund.
- Property: no overlap, no overbuild, plot min m2, atomic material consumption, house preset, edit slot/collision, co-owner concurrent edits, visitor denied mutation, room privacy.
- Graphics: original high-quality assets checksum/license, no 1x stretched icons, proper occlusion, texture LOD, frame/memory budgets, reduced motion, accessible contrast, dark mode, offscreen paused.
- Community: empty network solo path, mutual invitation, blocked users, minors safety, Real World Bridge opt-in.
- Release: snapshot test/route tests, APK rendering on intended device, RC real ads/navigation, runtime version and OTA channel confirmation, production verification separately after approval.

## M. CURRENT IMPLEMENTATION STATUS
Already changed in isolated DEV branch:
- `src/features/world/worldCatalog.ts`: all-purpose feature map and destinations.
- `src/features/world/worldEconomyBlueprint.ts`: no-op typed catalog, land and starter blueprint illustrative prices.
- `src/features/world/worldCustomization.ts`: premium asset manifest contract + validated scenes, slots, palette, placements.
- `src/components/world/BuklodWorldGateway.tsx`: light native purpose guide with map-inspired overview, districts, preview capability labels.
- `src/app/(tabs)/hub.tsx`: inserts gateway before existing Home content.
- `src/app/index.tsx`: authentic root chooses Home after PUBLIC scope reset.
- `src/app/(tabs)/_layout.tsx`: initial tab route hub, no changes to actual five destinations.

Not done: mastered art assets, saved edit APIs, world persistence, BP/QMP transfers, land and inventory tables, social sessions, paid purchases, device verification, staging/production deployment. No inference of completion beyond evidence.
