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

## Nature-first premium Kingdom visual staging intake — 2026-11-21

Owner's four references supersede the earlier flower-heavy/feminine Kingdom scene: cinematic, mature classic-modern architecture in nature-rich landscapes; tropical coast and forests, waterfalls, alpine winter peaks, deep terrain and mist. The new original rendered environment panorama is 1536x864 WebP SHA256 `232c99e995fafde2e018a286f998a39917de32620ee502c8486ca58a1eabf8eb`, with low-RAM 960x540 SHA256 `5e7ed0af9568aa6f9cc8d6753015b3c8ac36fd4e070541d43f017d88975fcc95`. Both are compiled local assets in this DEV branch, no user download/third-party image service required. The 16:9 source composition remains intact on narrow screens. The original 13 character selection and earned rewards are preserved; art is an **environment** asset, not fake animated rig or backend ownership proof.

**Arena excluded from premium Season 2 staging scope:** the portal button and deep-link mount require explicit `EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL=true`; default false. Existing experimental practice code remains in isolated DEV source only; do not include its multiplayer/diamonds requirements in visual-only candidate acceptance, and never imply multiplayer live.

**Still NOT STAGING OTA READY:** this is a source/art preflight only; staging native runtime, active Expo/EAS channel/update group, exact destination bundle, ad-fill/navigation/codec regression and signed APK compatibility have not been verified. The World 5-stage visual authority and spendable BP/QMP/Character item RLS settlement lack isolated backend. Production/main/Play/OTA/Supabase unchanged. Physical visual verification waived by owner but unverified.

## Visual-only premium RC safety hardening — 2026-11-21

The Genesis EAS preview profile previously contained **production Supabase** `https://yhanxndaqbmuzbdqlblu.supabase.co` and explicit shared backend review. These were removed from the isolated Season 2 build profile (all other profiles unchanged). The profile now specifies `EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW=false` and `EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL=false`. This prevents that profile from explicitly selecting the live project, but EAS/CI environment-level credentials must STILL be independently checked before any build or OTA. Missing isolated backend credentials are an intentional release HOLD.

New `scripts/season2-premium-staging-ota-gate.mjs` has separate `--source` and `--release` checks; the former validates bundled premium image SHA, first-view and Kingdom AdMob source, staging profile and native runtime declaration; **only the latter** can state `otaReady=true` and needs a real isolated staging project, real staging publishable credentials, signed EAS build and exact source-commit artifact, plus automated image decode/ad/nav/audio/privacy checks. The gate never publishes. Native runtime target for Genesis is `2.0.0-genesis-preview`, app package `org.mzbministry.buklod.staging`, update channel `season2-genesis-preview`. These require a newly built compatible signed staging APK; not the old runtime 1.3.2 staging-user APK.

The Kingdom panoramic art now supports five direct-to-canonical-region selector hotspots (forest, citadel, winter highlands, river valley, coast) and retains the 13-character directory; selectors change the current featured realm only, without changing any authoritative BP/Character/Inventory data. Premium landscape graphics are a high-fidelity **scene asset**, not a 3D interactive landscape or full progression system. Arena remains excluded.

## Paid canonical Supabase correction — 2026-11-21

**Owner clarification:** zero budget means **zero new subscriptions, external paid applications or purchases**, NOT stopping the existing paid BUKLOD Supabase project. The already paid live project `yhanxndaqbmuzbdqlblu` is and remains the canonical Supabase service for BUKLOD MAIN. The temporary source-only isolation requirement introduced just before this correction is **superseded**: the Genesis EAS staging profile has its original canonical endpoint and original **publishable** key restored; `EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW=true` and `EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL=false`.

**Data-integrity distinction:** The Genesis preview still uses a staging APK/channel/native runtime, but **not a database sandbox**. Ordinary authenticated app posts, chats and other existing server-supported actions may write to the live Supabase and must continue to obey its RLS/authorization. Never run new schema migrations, RLS experiments, finance/points/rewards minting, destructive test fixtures, stress tests, replay tests or test payouts against production. The separate ledger/settlement/market/Character progression proposals remain behind existing backend switches until safe verifiable transactional migration is possible; skipping physical verification does not waive finance/data-integrity gates.

The `season2-premium-staging-ota-gate.mjs` checks only the original paid BUKLOD Supabase URL + publishable key and rejects service/secret keys, accidental redirects to another backend, or artifact backend mismatch. A valid signed EAS APK bound to that exact existing backend, targeted to `season2-genesis-preview` channel and runtime `2.0.0-genesis-preview`, plus objective native ad/nav/audio/privacy and no-unreleased-economy-writes evidence are still required before OTA-ready can be claimed. No new subscription has been purchased or requested. No production database writes or OTA publishing took place in this DEV source reconciliation.
