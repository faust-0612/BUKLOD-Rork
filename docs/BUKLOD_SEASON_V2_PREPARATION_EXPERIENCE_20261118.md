# BUKLOD Season V2 — Preparation, Notices, Adventure Preview
**2026-11-18 | DEV, read-only scope | Parent issue #936 | No RC, no OTA**

## Verified existing baseline
GitHub main d23cd882f7d34c4bca3a110dadd04ee4cb2240a9 and read-only connected Supabase were inspected. At 2026-11-18:
- public.buklod_rank_seasons contains Season 1: 2026-08-01 through 2026-10-31, still status='active'. This is overdue; do NOT falsely advertise it as currently live.
- public.buklod_rank_season_results count was **zero** when inspected.
- public.get_my_buklod_rank_dashboard picks the latest status='active' row without filtering out past-due ends_on and calculates season points from *claimed BP* credits within the Manila season dates; its separate lifetime BP comes from the canonical ledger.
- public.admin_create_buklod_rank_season creates 'planned' only; it does not close/archive Season 1. No verified automatic close pipeline was found in the inspected function-name search.
- Monthly QMP is a separate finance allocation weight/period. Rank Season V2 must never rewrite, reset or finalize QMP, AdMob estimates, earnings, withdrawal, or member BP.
- Character V3 per-character level, immutable item ownership, badges, Kingdom shards and 1,300 artwork catalog must not be reset.

### Critical backend HOLD
Before an actual rollover, freeze and reconcile Season 1 with an approved BP event/claim cutoff, Manila time-zone verification, all qualified pending/offline activities, cross-account RLS, audit of official/nonmember exclusion, eligibility, exact result snapshots and immutable publishing. Verify current database snapshots and backups; do not introduce retroactive reward changes or simply change status to 'closed' while result_count=0. User selected **December 6, 2026** as the target Season 2 opening in this conversation. This is a **planning target only**: no actual Season 2 row, published schedule, live countdown, final rewards or notifications have been verified or activated.

## What users can actually see in DEV
The existing Points screen fetches get_my_buklod_rank_dashboard already. Immediately after the 40-rank progression link, a lightweight *collapsed by default* Season Journey teaser reuses that existing response, with **no additional request, automatic page navigation, native dependencies, timers, ad changes, or extra media loading**.
- At today's expired Season 1 dates: "Scheduled period ended; results unverified" instead of "active".
- If no trustworthy snapshot: honest "Refresh to verify" or "No current Season verified".
- At a verified future start date: visual-only preparation countdown. At a verified live date: schedule progress meter, never an earned-reward meter.
- Tapping the teaser opens three selectable local preview paths: Explorer (stories/learning), Creator (authentic social posts/discussion), Together (co-op/community).
- Concept-only four chapters: Discover -> Create -> Unite -> Finale. Lock icons deliberately indicate NOT unlocked/published.
- A rewards teaser previews future themed cosmetics, permanent earned badges, team celebrations and trophies; nothing is minted, claimed, purchased or assigned.
- Scope parity: these general paths require no mandatory prayer/faith declarations and do not invent nonfaith reward-eligible sources. Real source verification is pending.
- UI remains compact; no extra Ads request at tab-open, no navigation delay, no new account state or offline-triggered account lock.

## Player journey and actual exciting content to build next
**Preseason: The Reveal** (14d): official theme, Character/costume trailer, optional creator and team missions, collectible silhouettes and current rank hall of fame.
**Preparation** (7d): user previews three tracks without enrollment, can choose later; personal vs Cluster/team comparison with explicit opt-in.
**Countdown** (3d and 1d): first story scene teaser, spoiler-free collectibles and dynamic countdown from signed official schedule.
**Opening**: server-published chapter 1, Character enters a themed environment, first verified story/mastery receipts, group collaboration start. Do not confuse a preview concept with live game content.
**Chapter unlocks**: later weeks publish approved routes, episodic story scenes, optional co-op goals and noncash cosmetic reward receipts, all server-gated.
**Finale**: catch-up paths, final co-op goals, celebration, source reconciliation, winners and season-specific titles, historical trophies after finalized snapshots.
**Next season**: fresh optional competition and content, not confiscation of lifetime BP, Character level, items, badges or cash. Zero seasonal Momentum means recovery options, never deletion.

## Proposed notification cadence (currently delivery OFF)
Only after **official server-published season schedule**, per-user opt-in and quiet-hours check:
- Start -14: season reveal
- Start -7: optional adventure choice
- Start -3: rules and preparation
- Start -1: opening tomorrow
- Start day: season premiere
- End -7: optional last-week chapter
- End last day: finale
- End +1: closing/reconciliation underway, **not** prize finalization
- Final awards: separate explicit server-finalized event *after* result snapshot. Not inferred from a timer.
- New chapters: independent publication evidence; do not send merely because calendar day elapsed.

The pure client function returns at most one exact-day **notice candidate** with deterministic key season_id+stage, requires opt-in and verified schedule, defers when offline reconciliation is pending. It is NOT a push sender, scheduler, delivery receipt, notification permission handler or database function. Deduplicated in-app fallback preferred when push is off/quiet hours. Future server delivery must add RLS-backed opt-in, bounded retries, permanent dedupe, user account isolation, no private faith/child content, no coercive messages and flood protection.

## Server-side lifecycle and migration requirements (not implemented)
planned -> preparation -> active -> closing -> finalized -> archived.
- Single live Season; unique conflict protection; compare official Manila boundaries and rule_version; race-safe locking.
- Late event grace based on original verified activity time, not arbitrary claim timestamp; pending offline work prevents finalization until reconciled or published cutoff.
- Idempotent snapshot of rank results and audit manifest with exact source keys; after finalization immutable rankings, explicit moderation/correction appeal path.
- Show Faith/non-Show Faith and new member opportunity parity; anti-farming, unique legitimate actors/contents, solo catch-up if no team.
- Canonical BP and Character progression untouched; separate season-only Momentum, quests and cosmetics receipts. QMP finance independent.
- Automated notices only after server-published rule and user preference; no noncompliance-driven account deletion.

## Release gates
This PR touches only a read-only Points journey UI, pure presentation logic, docs and focused behavior tests. GitHub CI and TypeScript/Expo, profile/Points regression, AdMob first-view, dashboard instantaneous navigation, weak-network/loading, accessible overflow, and account privacy must pass before an RC. No production migration, Expo OTA, android artifact, offline reward synchronization, notification dispatch or new user reward is part of this PR. Record exact SHA/runtime/installed-client evidence before any release claim. Related disabled policy draft: PR #937.

**Status: DEV preview only. Backend rollover, story chapter publishing, notices, league settlement, new payouts and Season 2 remain BLOCKED until separately verified.**

## Owner-selected Season 2 opening target — December 6, 2026

The BUKLOD owner selected **December 6, 2026 (Asia/Manila)** as the opening target. This is not an instruction to force an unsafe Season 1 close, fabricate a live row, start a cron, grant rewards or send push today.

| Milestone | Manila date | Preview intent |
|---|---|---|
| Season reveal T-14 | 2026-11-22 | Theme, story, proposed rewards |
| Adventure paths T-7 | 2026-11-29 | Explorer / Creator / Together optional previews |
| Preparation T-3 | 2026-12-03 | Rules, season consent, readiness |
| Final countdown T-1 | 2026-12-05 | One opt-in generic reminder |
| Target opening T=0 | 2026-12-06 | Publish only if Season1 settled and new authoritative season approved |

**End date and season length are not specified by owner.** Do not invent a 90-day closing date or finale notification. Real notification jobs and countdown require a signed, published server schedule and delivery consent, and must be deduplicated across devices. The read-only Points preview now displays these owner-selected **unpublished** target milestones with explicit non-live labels.

**Release gate:** audit & reconcile 869 claimed/legacy vs 609 pending Season 1 credit entries (counts captured 2026-11-18) across 326 accounts, verify historic claims and cutoff, atomic unique results, backups and approved closing report, then separate planned/live transition with server-trusted dates. Keep QMP/AdMob 30%, BP, Character V3 and existing inventories untouched.
