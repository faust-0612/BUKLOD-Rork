# Genesis Season 2 — Map-first consolidation intake, HARD HOLD (2026-11-21)

Branch baseline: 44d07a65d5e19f4cfb8f70aaff4f9d24545eb097 (draft PR #1047). Status: DEV source, no EAS OTA/APK, no Supabase write, no production change.

## Integrated here
- Existing auth/maintenance/mandatory update/compliance/age/onboarding and PUBLIC boot gates now lead Genesis-preview clients to `/buklod-map` only; all other clients keep existing Wall.
- Existing native Galaxy and green B become the fallback map gateway, eight single-owner districts to original BUKLOD routes and optional faith logic.
- Preview-only removal of persistent bottom bar, swipe header and dashboard context bar. One guarded compact back-to-map button appears on nonimmersive mapped routes.
- Bundled, previously provenance-reviewed CC0 Kingdom music remains opt-in through original audio-focus module, map view owns Home first-view native ad placement. No wallet or backend mutation.
- Existing World preview, Arena simulations, learning, Market, Faith, Focus Apps and released features from PR #1047 are preserved unchanged.

## Non-negotiable incomplete work before staging OTA
1. The actual approved Valley **illustration is not in GitHub**. Import user Library `/BUKLOD_Genesis_S2_Map_Asset_Handoff_20261121.zip`: `community-world-map-1448.webp` to `assets/season2/genesis/world/buklod-community-map.webp`, and `community-world-map-1024.webp` as low-RAM fallback. Replace the schematic 8-node map with a real touchable/pannable 14-building hotspot canvas (source MAP_HOTSPOT_GUIDE.md); double-check drawn positions after aspect fit. Do not pretend the fallback is the finished asset.
2. `/Buklod V2/buklod_assets_catalog.json` lists 40 Lot/House/Community/Business level art paths, not actual PNG presence. Five sequential construction stages per tier require up to 200 verified stage visuals and server approved stages/values. Reuse available licensed originals/approved art only.
3. `/Sound and voice effects/Animation` contains hero pack archives and 3D GLBs. Gameplay practice has 151 frames and 11 FX but the full 13 approved, original animated character rigs and all combat/skill/impact movement are not verified. Native Godot embedding must stay within BUKLOD MAIN and requires a new signed staging APK, NOT an OTA.
4. `assets/sounds/kingdom-premium/LICENSES.md` documents already-bundled CC0: kingdom-theme/village/great-hall .ogg, Kenney UI-SFX. Prefer these now. The 20 tracks in `/BUKLOD_AUDIO_LIBRARY/music` must not be redistributed: the Library licenses folder is empty. Imported audio must stop on blur, call, video, ad, background, user opt-out, and not compete with media.
5. Economy: verify earned lifetime BP != transferable available BP, no BP purchase/mint by business, item escrow ownership, permanent lvl 1–10 + Mastery, character BP eligibility plus each verified obtainable item (Show Faith OFF parity), separate QMP/Character Diamond/season Token ledgers and signed receipts. Draft 46 active/16 inactive BP rows, 1300 items, 469 badges and 40 rank artwork appear in full guide PR #997; neither those proposals nor rank sale profits may be advertised as live.
6. Arena authentic server-authoritative 1v1/3v3/5v5, ranked losses, matchmaking, disconnect/anti-cheat, equipment/inventory ownership, gameplay/skill feedback and Diamond settlement remains missing. Offline HTML is test/practice only.
7. GitHub exact-head build + performance/AdMob/video/audio/nav/native gate, isolated Postgres RLS+serializable concurrency tests and wallet reconciliation, native Godot/Media3/Play Core/Google OAuth signed staging APK identity, no live account backends, authorized staging EAS channel and staging OTA receipt are missing. Device visual verification owner-waived != passed.

## Source protection
No production main changes. No migration deployment. No release or update workflow touched. DO NOT PROMOTE from DEV until all blockers resolved with test evidence.
