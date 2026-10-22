# KABIHASNANG LIGAW — Publishing Architecture R5
Status: APPROVED SPECIFICATION / NOT DEPLOYED
Timezone: Asia/Manila. Daily release: 06:00 local time, one pre-approved episode per day.

## Publishing architecture
- Authoring and QA in isolated staging; immutable approved content revision with SHA-256 content/asset manifest.
- Entities: series, seasons, episodes, episode_revisions, episode_blocks, media_assets, glossary_terms, glossary_reveals, release_slots, reading_progress, episode_completions, story_journey, story_rewards, publication_audit, publication_alerts.
- Each episode has a season, sequence number, revision, editorial approval, assets validated, release_at timestamptz, status (draft/review/approved/scheduled/published/held), and optional content warning.
- Release schedule calculated in Asia/Manila (06:00), stored as UTC timestamptz. Never use device clock to grant access.
- Preapproved scheduled content only. No AI generation or auto-approval at publish time.
- Preferred publishing mechanism: server-side read access based on approved + release_at <= server now(), without daily content copying. A lightweight scheduled checker monitors missing/late releases and alerts; no daily OTA.
- Row-level security: anonymous/public can see only published-and-due approved revisions; future episodes and spoiler glossary remain inaccessible. Editorial actions limited to privileged server-side roles; never expose service-role keys in app.
- Pause/kill switch at season and global level, with audit log. Edits to scheduled content require new revision and explicit reapproval. Published revisions immutable; corrections via separately approved revision, preserving reader history.
- Idempotent scheduling and monitoring, retry/backoff, alerts on missing assets, failed validation, blocked release, or unexpected reward spikes.

## Reading and Story Journey
- Mobile card roughly Community post size; illustrated reader with original realistic, uncluttered magical-fantasy art, consistent character and scene bible, author credit.
- Dictionary contextual popups and spoiler-safe unlock by completed episode.
- Opt-in audio, user-controlled volume, manual play, pause on competing audio focus (DZAS and other players), network-conscious asset loading; reading works when audio fails.
- Reader progress and Story Journey are independent of existing character levels. Milestones may grant non-tradable cosmetic/lore achievements without farming.

## Rewards (approved business rules, pending technical validation)
- +2 BUKLOD Points on first validated completion of each episode per account, once only, including replay/device changes.
- +10 BUKLOD Points exactly once when all required episodes in that season are validly completed.
- Use existing BUKLOD points ledger/rules and character progression services; do not write direct balance increments from client.
- Server-verified authenticated user, released episode, completion eligibility, reasonable reading engagement, idempotency key e.g. `kl:episode:<user_id>:<episode_id>` and `kl:season:<user_id>:<season_id>`; unique constraint and transaction for ledger + completion. Avoid punitive time-only tests and avoid collecting unnecessary personal data.
- Anti-abuse: one award per unique episode, server checks, anomaly monitoring, no point purchase, no repeated credit for replay. Any rule mismatch blocks rewards without blocking reading.
- A 30-episode season yields at most 70 BUKLOD Points: 30*2+10.

## Release gates
1. Verify authoritative GitHub DEV and current installed APK/native runtime, latest production OTA cumulative baseline; avoid large local writes.
2. Inspect existing Supabase schemas/RLS/reward APIs/AdMob/audio; read-only until change approved.
3. Implement standalone staging backend + tests, isolated from production; author/approve full season or preapproved batch before scheduling.
4. Test UTC/PHT boundaries, duplicate events, concurrency, offline replay, permission/RLS leakage, skipped/held episodes, failed audio/images, network degradation, character points integrity, ads policy, accessibility.
5. Freeze RC manifest and diff, zero unrelated changes, verify rollback and pause controls.
6. Separate explicit production authorization required before any database change or BUKLOD DEV→RC→Production OTA.

## Monetization safeguards
- Free core episodes. Optional native ads at natural breaks (not interrupting prose), with consent/privacy/policy checks and performance tests.
- Optional supporter cosmetics/art and future licensed digital collections; do not sell points or mandatory story access. Measure fill, revenue, storage/egress/audio costs before scaling.

## Editorial responsibilities
- Creative director approves season arcs, episode manuscripts, imagery, audio, dictionary and release calendar. AI may assist with preparation but cannot publish unapproved material.
- Daily operation automated once deployed; owner notified only for exceptional action/approval, not routine releases.
- Prepare 7–14 episode buffer; ideally freeze full 30-episode season before launch.

## Current state
This file is a specification only. No scheduling automation, backend tables, source modifications, APK changes, or OTA were performed by this document.
