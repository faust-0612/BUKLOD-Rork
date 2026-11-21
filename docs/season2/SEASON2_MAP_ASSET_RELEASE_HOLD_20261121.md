# Genesis Season 2 — Map-first consolidation intake, HARD HOLD (2026-11-21)

Branch baseline: 44d07a65d5e19f4cfb8f70aaff4f9d24545eb097 (draft PR #1047). Status: DEV source, no EAS OTA/APK, no Supabase write, no production change.

## Integrated here
- Existing auth/maintenance/mandatory update/compliance/age/onboarding and PUBLIC boot gates now lead Genesis-preview clients to `/buklod-map` only; all other clients keep existing Wall.
- Existing native Galaxy and green B become the fallback map gateway, eight single-owner districts to original BUKLOD routes and optional faith logic.
- Preview-only removal of persistent bottom bar, swipe header and dashboard context bar. One guarded compact back-to-map button appears on nonimmersive mapped routes.
- Bundled, previously provenance-reviewed CC0 Kingdom music remains opt-in through original audio-focus module, map view owns Home first-view native ad placement. No wallet or backend mutation.
- Existing World preview, Arena simulations, learning, Market, Faith, Focus Apps and released features from PR #1047 are preserved unchanged.

## Non-negotiable incomplete work before staging OTA
1. The approved Valley artwork **was imported into this DEV branch** as SHA-verified local 1448/1024 WebPs. Source: user Library `/BUKLOD_Genesis_S2_Map_Asset_Handoff_20261121.zip`: `community-world-map-1448.webp` as high-resolution `assets/season2/genesis/world/buklod-community-map.webp`, and 1024 low-RAM fallback. The source now renders all 14 anchored destinations with an overview/explore zoom, horizontal pan, reduced-motion gate, selected detail card and accessible directory. Actual device alignment and native image decoding remain UNVERIFIED (owner waived visual test); no OTA release proof.
2. `/Buklod V2/buklod_assets_catalog.json` lists 40 Lot/House/Community/Business level art paths, not actual PNG presence. Five sequential construction stages per tier require up to 200 verified stage visuals and server approved stages/values. Reuse available licensed originals/approved art only.
3. `/Sound and voice effects/Animation` contains hero pack archives and 3D GLBs. Gameplay practice has 151 frames and 11 FX but the full 13 approved, original animated character rigs and all combat/skill/impact movement are not verified. Native Godot embedding must stay within BUKLOD MAIN and requires a new signed staging APK, NOT an OTA.
4. `assets/sounds/kingdom-premium/LICENSES.md` documents already-bundled CC0: kingdom-theme/village/great-hall .ogg, Kenney UI-SFX. Prefer these now. The 20 tracks in `/BUKLOD_AUDIO_LIBRARY/music` must not be redistributed: the Library licenses folder is empty. Imported audio must stop on blur, call, video, ad, background, user opt-out, and not compete with media.
5. Economy: verify earned lifetime BP != transferable available BP, no BP purchase/mint by business, item escrow ownership, permanent lvl 1–10 + Mastery, character BP eligibility plus each verified obtainable item (Show Faith OFF parity), separate QMP/Character Diamond/season Token ledgers and signed receipts. Draft 46 active/16 inactive BP rows, 1300 items, 469 badges and 40 rank artwork appear in full guide PR #997; neither those proposals nor rank sale profits may be advertised as live.
6. Arena authentic server-authoritative 1v1/3v3/5v5, ranked losses, matchmaking, disconnect/anti-cheat, equipment/inventory ownership, gameplay/skill feedback and Diamond settlement remains missing. Offline HTML is test/practice only.
7. GitHub exact-head build + performance/AdMob/video/audio/nav/native gate, isolated Postgres RLS+serializable concurrency tests and wallet reconciliation, native Godot/Media3/Play Core/Google OAuth signed staging APK identity, no live account backends, authorized staging EAS channel and staging OTA receipt are missing. Device visual verification owner-waived != passed.

## Source protection
No production main changes. No migration deployment. No release or update workflow touched. DO NOT PROMOTE from DEV until all blockers resolved with test evidence.

## New asset import proof (DEV only)
- High-res 1448×1086 WebP SHA256 `1ecc69c1886eebc18ad5cc3971c944e3bceee65a757b85a2fcf1c91bf5d2dd0c`; compact 1024×768 `226465e86d69b99a4666ba934c1b90690dc04d2fce4a768ea4e6cda0a089f88a`.
- `GenesisValleyMap.tsx` implements source-level actual illustration and 14 tap-select destinations; each existing Expo Router route retains its real guards, focus/ads and Show Faith filtering.
- No licensed Genesis soundtrack imported from unverified Library music; existing local CC0 music remains.
- **Release still HARD HOLD:** no signed native staging APK, no Supabase test backend, no authoritative arena server, no E2E BP/QMP/trade/Character Diamond settlement. Automated source checks cannot replace those.

## Gold-icon touchpoint and audio-focus refinement
- The 14 anchors were visually aligned to the *gold icon circles* in the supplied 1024 reference, rather than covering the location labels. Source coordinate verification is not Android runtime touch proof.
- Existing CC0 Kingdom soundtrack now listens for competing audio-focus ownership and pauses the Genesis map music when another ad, user video, call or audio source requests focus; it does not automatically resume over competing playback.
- Music button is opt-in; tapping Music On sends an explicit map focus request; status shows 'Music paused' when external media interrupts. User controls volume/quiet hours through existing sound settings.
- No automated test can prove ad fill or exact native audio-focus timing; release remains HARD HOLD.

## Integrated single-app Arena offline practice — DEV source only
- Pure Arena V2 combat, 13 art portraits and 3 maps, 1v1 / 3v3 / 5v5 offline practice controls imported. Entry only from Genesis Kingdom portal. Real ranked and server settlement unimplemented.
- Original /games/index source and production behavior untouched. No BP, QMP, Diamond, inventory, token ledger, credentials or backend mutations.
- Native Android compilation and visual acceptance still unverified; no OTA release authorization.

## Arena privacy/auth direct-link gate
The /games/empire-arena route now checks session, profile/onboarding, consent, maintenance, forced update, pilot access, and Genesis-only build before mounting the offline practice component. Production clients remain redirected. This source security gate is not proof of Android behavior.
