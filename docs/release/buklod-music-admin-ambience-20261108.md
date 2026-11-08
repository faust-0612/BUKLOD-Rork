# BUKLOD Music Admin + Auto Photo Ambience — RC handoff (2026-11-08)

## Scope and live isolation
- Branch: `dev/admin-music-library-ambience-ota-ready-20261108`. Built atop production SHA `9a560caaec9befc0d54c70be36eaca619d587797`.
- **Migration was applied and SQL-verified on 2026-11-08. Do not reapply it, merge, publish Android OTA, or deploy Expo Hosting without release authorization.**
- The native V28 code 28 / runtime 1.3.2 must stay unchanged; no new native dependencies or rebuild.
- Current live music catalog: 42 active entries before this change; preserve all existing rows and media unless System Admin explicitly deletes them.

## New admin workflow
Open System Admin → Formation & Content → Music Library:
1. Select supported audio <=25 MB, enter title and optional artist/source.
2. Upload to private bucket `buklod-music-library`, immutable `library/admin/<UUID>.<ext>` (no upsert).
3. Insert active catalog metadata only after successful upload. Best-effort orphan cleanup on DB failure.
4. Signed playback URL is only generated on explicit Play; no eager native audio on Wall startup.
5. Delete requires two deliberate taps. First retire catalog row, then Storage API file removal, then delete metadata. On interruption or partial failure, catalog remains hidden and retryable.
6. In all other devices, music list is refreshed on picker open; the previous 2-minute catalog read cache is bypassed. No OTA is needed for later individual music uploads, once this code and its schema are released.

## Animation & ambiance
- Legacy presets: None, Zoom, Pan, Float, Fade.
- New: Rain, Storm, Snow, Mist, Sparkles, Fireflies, Petals, Sunrays, Dust, Bokeh, Stars, Autumn, Underwater.
- Publishing saves only the preset, never generates or stores an animated video; motion starts automatically on published post when visible, stops offscreen/on route blur/app background and respects system reduced-motion preference.
- All effects are vector/lightweight React Native Animated overlays. No new native module and no forced music autoplay.

## Backend production activation (applied 2026-11-08)
`supabase/migrations/20261108030015_buklod_music_admin_and_ambience_v1_20261108.sql`:
- Expands `buklod_post_creatives.motion_preset` CHECK; preserves existing records.
- Enables System Admin-only music catalog INSERT/UPDATE/DELETE and read of inactive rows.
- Enables private signed read for active catalog objects; upload/remove only for authenticated System Admin under bucket RLS. No service keys in client.
- Storage cleanup uses official Storage API; no direct mutation of `storage.objects` metadata.
- **Release order:** reconcile migration ledger → apply and verify RLS/constraint on target DB → verify authenticated admin vs ordinary member policies → compile Android and web RC from exact same SHA → publish ONLY on explicit approval.

## QA / Remaining non-published checks
- `node --test tests/admin-music-ambience-contract-20261108.test.mjs tests/wall-post-music-motion-contract.test.mjs tests/wall-post-music-navigation-scroll.test.mjs`
- `npx tsc --noEmit`
- `npx expo export --platform android --output-dir /tmp/buklod-music-admin-android`
- `npx expo export --platform web --output-dir /tmp/buklod-music-admin-web`
- Regression: Android Wall startup lazy native audio PR #576; music sign/seek/play; Ads/Marites/media; reduced-motion; SQL security boundaries.
- Device upload/delete and actual Supabase migration intentionally **not executed** while OTA is on hold. Passing static/CI checks does not prove those live flows.
