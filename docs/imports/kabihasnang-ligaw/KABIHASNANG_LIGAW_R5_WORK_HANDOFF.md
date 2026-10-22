# WORK HANDOFF — KABIHASNANG LIGAW R5

## Execution order and authority
This is a **queued release**, to execute **only after** the preceding BUKLOD V28 Android production OTA has actually passed its release gates, been published, and its exact production update group, source SHA, runtime version, channel, and cumulative RC manifest have been verified. Do not assume an OTA was published because a prior chat said so. If V28 is not confirmed, stop before any production mutation and report the blockers.

GitHub private repository: `faust-0612/BUKLOD-Rork`.
Existing story DEV branch: `dev/kabihasnang-ligaw-dashboard-r5`; latest known story commit `c692c923e35897bfc82f9e4589fd1fce1f0036f5`. As checked on 2026-10-20, it was six commits ahead of `main` (base `cbd650bc6113e832d2520986bb76bb1359d4181b`) and not a completed release. Recheck heads when starting. **Do not merge this old base blindly**; reconcile with the actual cumulative production source first. Keep prior V28 fixes.

## Approved creative baseline (do not rewrite)
Read `docs/kabihasnang-ligaw-approved-creative-release-contract-r5.md` on story DEV. Filipino Panimula and Chapter 1, *Ang Gabi ng Pag-ahon*, are approved for narrative voice and event order. If complete approved manuscript is not available in the repository, request/import exact approved text before publication; do not reconstruct it from an outline or substitute preview paragraphs. Season 1 is 30 planned episodes focused on Phan, but episodes 2–30 are **outlines, not approved manuscripts**. Do not automatically publish unfinished chapters. Preserve author credit: `Likha ni Faustino Jr. M. Gabut`.

Images must faithfully portray the adjacent scene and its continuity, not generic fantasy art. Produce a per-image shot manifest mapping scene, paragraph range, action, people, wardrobe, environment, time, light, props, reveal/spoiler limits. Require owner visual approval of every image; don't silently substitute placeholders as final. Do not treat generated art as approval.

## App UX
Community Wall **Dashboard**, precise placement: `<BuklodLifeWallCard />` then `<KabihasnangLigawWallCard />` then `<BuklodTodayCard />`. Permanent feature card, not Community Posting. Isolated story library and full-screen reader, accessible controls, image loading/retry, optional audio and mute, offline/weak-signal behavior, glossary with spoiler control. Do not modify Community Posting, PTT, DZAS, LIFE, BUKLOD TODAY or unrelated native modules. Android-only OTA if compatible; no native build without separate approval.

## Server and rewards
Pre-approved chapter unlock at **06:00 Asia/Manila** using server-controlled UTC release timestamps. No daily OTA, no automatic AI content creation/publication. Admin review, schedule, pause, emergency stop and audit. Existing BUKLOD Points only: +2 once per legitimate first episode completion; +10 once per completed season; server-verified and idempotent with concurrent/retry safety. Cosmetic-only Story Journey; no second points economy. Implement server-side completion validation, transactional reward ledger integration, RLS and migration tests. Existing `supabase/migrations/20261020120000_kabihasnang_ligaw_r5_candidate.sql` is **unapplied candidate**, not production-ready: review schema and policy idempotence, migration ordering, permissions, rewards accounting and data retention before any migration. Do not trust client completion or let client directly insert ledger/rewards.

## Mandatory DEV → RC → Production OTA gates
1. Inspect latest successful V28 production OTA, native installed runtime/channel, authoritative source/RC and update group; prove compatibility and preserve all P0 fixes.
2. Integrate story changes onto the reconciled DEV baseline with minimal scoped diffs. Preserve unrelated files and keep DB changes in reviewed migrations.
3. Finish approved content/media pipeline, server release gates, authenticated completion, transactional rewards, admin controls, and reader UI. Do not invent approval for missing episodes/art.
4. Run lockfile reproducible install, TypeScript, Jest, static/release checks, SQL migration/RLS/idempotence/concurrency tests, Android export comparison and available backend checks. Capture command output, SHA hashes and regression evidence.
5. Freeze exact verified RC, compare DEV ↔ RC, check installed runtime/channel, obtain owner acceptance of final visual and scene illustrations, and check available Expo/EAS quota.
6. **Only when all mandatory gates PASS** publish the **exact RC** to Android `production` OTA (no new APK), then verify update group, channel/runtime, client delivery and rollback readiness. Never use an OTA script blindly if it assumes `main` or runtime `1.3.3`; verify real production configuration.
7. Report READY/NOT READY with exact remaining blockers and evidence. If any gate fails, **do not publish**. No forced merges, speculative changes, paid services or unrelated edits.

## Work reporting
Minimize repetitive manual questions; proceed autonomously on safe DEV work and tests. Contact owner only for actual required access, missing exact approved manuscript/art approval, or release-critical decision. Distinguish committed code, passing tests, frozen RC, and published OTA; never imply production is live before verifying it.
