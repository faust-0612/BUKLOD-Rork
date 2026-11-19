# BUKLOD Season 2 Genesis — Premium Kingdom/Collections DEV candidate
Date 2026-11-20. Starting source: `fcd437a70da9ce0a878822af719fcba15a1a0587` (Genesis Living Engine).

## Actually integrated in DEV source
- Production keeps the original 13-station Kingdom map and current footer advertising.
- Only a specifically enabled **non-production** Genesis preview replaces the map with a character-first, illustrated cosmic realm selector. All 13 canonical station routes are retained.
- A new preview-only Collection Vault shows 20 owner-supplied class sheets (120 individually viewport-cropped item designs), seven classic collections (42 separately extracted items), 13 × 20 × 5 character art references, and the existing 40 vector Circle Rank tiers.
- Drifting artwork and elongated light fragments use bounded GPU-friendly transforms. Animation stops when the route is no longer focused, app backgrounded or Reduce Motion is enabled.
- Existing approved level-art sprites and special-character art are reused. No fake inventory, Shards, BP, withdrawals, claims, bonus, server writes, or app-wide sound change.

## Quality limitations, not waived
- These class sprites are reference thumbnails (original 176×150 cells); zoom does **not** manufacture 4K detail. The 1,300 external character collectible thumbnails are also not high-resolution rigs.
- 40 rank grades currently use pre-existing scalable SVG emblems, **not** newly cropped high-resolution owner-approved rank badge image sheets.
- This is a premium visual preview with existing painted artwork and motion, **not** real-time 3D, a segmented Rive hero rig, ML/COD-grade gameplay, or newly mastered cinematic audio. A full graphics upgrade needs approved high-resolution layered art/rigs and actual device QA.
- Scene illustration URLs have a static fallback if offline. Verified CDN image quality and visual layout must be accepted on the device before any production claim.
- Existing text, music and gameplay routes remain untouched, so production and Season 1 money/rules are unchanged.

## Gates
Run `node --test tests/season2-genesis-cinematic-assets-20261120.test.mjs`, typecheck, source/feature lock gate and targeted AdMob/navigation lifecycle checks. Stage OTA only after exact target runtime and CI/RC validation. Production remains embargoed until explicitly authorized.
