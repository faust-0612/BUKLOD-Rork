# BUKLOD Music Folders + Live Clip Scrubbing — DEV / RC handoff
Date: 2026-11-09
Branch: `dev/music-library-folders-scrub-20261109`
Base main: `97d037834bcba86e27cc50e067cbefb31cd14125`

## Implemented in DEV
- Six virtual System Admin-managed folders: Christian Music, Love Songs, Instrumental, Sound Clips, Ambient & Nature, Others.
- Batch folder, individual uploaded file folder, moving existing tracks without re-upload; no storage key or creative ID changes.
- Debounced title/artist search, deterministic sort, index-backed category filter and 40-row pagination on admin and public pickers; upload batch stays bounded at 20 files, sequential, failure-retained.
- Interactive 30-second clip handle: dragging emits coalesced seeks (~120 ms), preserving currently playing audio, and final release applies exact target. Existing signed-URL cache, media focus, post loop and preview stop-on-close remain.
- Selecting a different song replaces the correct track instead of treating the selection as Pause.

## Production Supabase schema evidence
- Target project: `yhanxndaqbmuzbdqlblu`.
- Applied additive migration `20261109074543_buklod_music_categories_v1_20261109`. Adds `category text not null default 'others'`, fixed allowlist check and `buklod_music_category_browse_idx`.
- Read-back: 41 existing active tracks remain active, all initially in Others; category constraint and index exist. No migration changes track IDs, paths, audio bytes, post creatives or authorization policies.
- Database advisors: newly added index reported unused prior to client rollout (expected). Existing multiple-permissive-read-policy advisory predates this migration; no new RLS policies.

## Focused source checks
- 17 source contract checks passed for paginated music catalog, category admin operations, clip drag and release, no stop-on-change, existing Wall loop, fixed 30-second clips and existing test compatibility.
- A focused regression test was added in `tests/music-library-live-scrub-folders-20261109.test.mjs` but not executed under Node in this session.
- **Not device-verified, not compiled/typechecked, and not end-to-end verified**. QA must cover native Android and web first-load delay, song switching mid-load, rapid scrubbing, audio-focus interruption, offline/weak networks and proper saved segment playback.

## Release gate
- DEV only. The production database additive schema is active, but code has **not** been merged to main, deployed to web, OTA-published, or included in a new APK/AAB.
- Reconcile current main + other consolidated RC changes; run focused Node tests and TypeScript build, confirm current Expo runtime, perform critical Android/web preview smoke tests, freeze verified RC, then publish through authorized DEV -> RC -> Production OTA gate.
- Keep the existing 41 tracks in Others until the System Admin categorizes them; never auto-classify by title or overwrite existing audio.

## Nov09 consolidated RC evidence update
- Consolidated candidate PR: #605; includes independent rank badges, private notifications/PTT, personal earnings UI, and one coherent offline faith prefetch implementation.
- Earlier PR #604 caught a real JSX parser failure at admin Music Library and missing engineering coverage; these were fixed in the candidate before rerunning QA.
- Do not claim production release from PR status alone. Require new exact-head compiled checks, approved source merge, successful Android publication evidence and Expo Hosting deploy evidence.

## Production notification migration reconciliation (2026-11-09)
- Applied version: `20261109102454`, migration name `buklod_notification_latency_v1_20261109`.
- The source SQL file is named with that exact applied version to prevent duplicate future migration runs.
- Read-back: cron job `buklod-living-greetings-dispatch-v1`, `jobid=43`, active schedule `* * * * *`, calls `private.buklod_living_dispatch_batch_v1(6,100)`.
- The private batch function denies EXECUTE to both `authenticated` and `anon`; active tracks remain 41/41. Existing social/earnings/Points ledgers unchanged.
- This database change is live; the corresponding Android/web RC remains publish-gated.
