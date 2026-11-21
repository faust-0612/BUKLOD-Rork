# BUKLOD Community-to-Product coverage — isolated Season 2 DEV wave (2026-11-21)

## Outcome and exact limits
Added a practical *Community Facilities* explorer inside both existing premium **Community Village** and **My Home** scenes, with canonical links to working BUKLOD entry routes and explicitly non-clickable future facility records. The registry catalogs social, government, household, commerce, transport/roads, infrastructure, safety, health, education, culture, family, environmental, agriculture, giving, gaming and accessibility/community service areas. Every record is a proposed *counterpart*, not a claim that every real-world service is implemented or available.

The approved 12-landmark Entry Map remains byte-for-byte unchanged, including direct one-tap access to Village and Home, distinct Kingdom and Empire Arena, first-view ad placement and the animated outside-map guide. Existing Village/Home stage-1 WebPs, six visible spatial doors and five-stage construction previews remain intact.

### Navigation rules
- Tapping a **linked** record directly pushes its already-existing Expo Router route. That route retains auth, role, scope, privacy, Show Faith and service-specific access enforcement.
- A **planned** facility has `route: null` and no action button. No synthetic virtual property ownership, BP, item, QMP, Diamond or community-fund changes.
- Directory starts collapsed beneath the interactive scene so first view, loading cost, ads and 1-tap doors remain prioritized.
- Text search is local/offline, case/diacritic-normalized, up to 80 characters, paginated 16 cards per batch; selecting categories resets the batch size. No personal data or location collection.
- Show Faith OFF hides faith-only entries but leaves generic learning, culture, social and development services available.
- Distinct world and category filter ensures shared village facility list never impersonates personal property, and vice versa.

### Included and deferred
The registry is an authoritative **navigation/coverage taxonomy** for DEV only. Linked status does not assert a complete user journey or service SLA. Fully interactive roads, buildings, title registries, cooperative businesses, supply manufacturing, public transport, healthcare directory, welfare referrals, elections, treasury and other planned facilities still need independent UX, licensed assets, policy decisions, backend transactions and permission reviews. Reuse existing BUKLOD Bahay, Connect, Wall, Focus Apps, Community and Finance services rather than duplicating authoritative data.

### Release protections
No new native dependencies, no Supabase schema/migrations or mutation, no changes to existing AdMob banner placement, no production merge, APK or OTA. Staging compatibility, current native runtime, responsive Android visual checks, first-view ad/nav and scope/regression tests remain mandatory. Never declare consolidated OTA ready based solely on this DEV wave.
