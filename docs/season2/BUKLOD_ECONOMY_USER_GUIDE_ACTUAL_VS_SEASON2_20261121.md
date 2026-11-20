# BUKLOD Season 2 — Economy, BP, QMP, Tokens, Items & Levels: Authoritative User Guide + Integration Audit

**Snapshot date:** 2026-11-21 (read-only query against BUKLOD Supabase) · **Status:** DRAFT FOR SEASON 2, NOT AN ACTIVE SEASON 2 WALLET OR FINANCE RELEASE. 

This guide separates **configured today**, **approved Season 2 target**, and **unapproved illustrations**. A configured rule is not proof that the specific awarding event occurred; backend verification is required. The actual payout and settlement switches are all disabled in current database configuration.

## How the six core values differ

| Value | Owner and acquisition | Consumed/changes through | Hard prohibition |
|---|---|---|---|
| Lifetime Earned BP (Circle Rank) | Server-verified participation reward events; permanent historical measurement | Rank eligibility; not used as a payment balance | Gift/market/business operations never increase historical earned BP |
| Available / Spendable BP | Server awards plus existing BP legitimately transferred from others | Actual BP purchase/transfer/construction debits | Never sell new BP, duplicate wallet entries, or mint BP by business activity |
| QMP (qualified monthly participation) | Finance-controlled monthly allocation weight under live version | Relevant monthly AdMob-only revenue allocation after provider reconciliation | No guaranteed cash from BP, ad views, gifts, fake purchases or QMP previews |
| Character item and verified level | Specific verified task item receipts per individual Character; BP determines eligibility only | Items unlock actual visible evolution in the authoritative server character state | No BP-only automatic evolution, no Show Faith penalty, no unearned legacy reset |
| Arena Character Diamonds | Noncash, nontransferable verified participation and ranked result policy | Ranked losses may debit Diamonds, causing actual effective combat-level demotion | No cash/QMP conversion or client-authored result; game engine unactivated |
| Inventory, construction materials and consumable Arena Flux | Verifiable inventory events and local match state respectively | Atomic construction/craft/market item movement; Flux expires per game | Not interchangeable with BP/QMP and cannot be minted by UI |

## Current backend Finance (NOT yet live payouts)

The database's canonical Finance configuration is **canonical_finance_v3**. All four current execution switches are **off**:

| Control | Current state |
|---|---|
| Economics | **DISABLED** |
| Monthly settlement | **DISABLED** |
| Withdrawal | **DISABLED** |
| Payout processing | **DISABLED** |
| User pool configured | 30.00% |
| First line configured | 10.00% |
| Cluster fund configured | 5.00% |
| Organization fund configured | 7.00% |
| Minimum withdrawal configured | ₱200.00 |

The percentages above are existing policy settings, **not settled payments**. Never activate this policy or modify current user balances from the client. BUKLOD Season 2's spend-qualified QMP proposal is separate, and `WORLD_QMP_ACTIVATION_ENABLED=false` in this DEV source.

### QMP tiers configured on the current server

| Tier | Min QMP | Max QMP | Rule | Status |
| --- | --- | --- | --- | --- |
| STARTER | 0 | 24 | community_qmp_v1 | Enabled definition |
| ACTIVE | 25 | 74 | community_qmp_v1 | Enabled definition |
| CONTRIBUTOR | 75 | 149 | community_qmp_v1 | Enabled definition |
| BUILDER | 150 | 299 | community_qmp_v1 | Enabled definition |
| COMMUNITY CHAMPION | 300 | No limit | community_qmp_v1 | Enabled definition |

### QMP mission definitions (not proof of awarded funds)

| Mission | QMP value | Policy | Status |
| --- | --- | --- | --- |
| COMMUNITY BUILDER | 20 | community_qmp_v1 | Enabled definition |
| COMMUNITY CREATOR | 15 | community_qmp_v1 | Enabled definition |
| HELPFUL VOICE | 10 | community_qmp_v1 | Enabled definition |
| VIDEO STORYTELLER | 15 | community_qmp_v1 | Enabled definition |

## Current BP reward rule catalog (62 total; 46 active; 16 inactive)

A dash cap means the policy column is NULL, **not unlimited rewarding**: the event source can still have anti-farming and duplicate protection. Many source-specific prerequisites exist. On-screen values must be tied to these effective rule versions, not to fixed app labels.

| Activity code | Name / activity | BP per award | Max/event | Daily BP cap | Weekly BP cap | State |
| --- | --- | --- | --- | --- | --- | --- |
| `abc_growth_lesson` | ABC Christian Growth Lesson | 8 | 8 | — | — | Active |
| `achievement_bible_scholar` | achievement bible scholar | 100 | 100 | 100 | 100 | Active |
| `achievement_community_builder` | achievement community builder | 150 | 150 | 150 | 150 | Active |
| `achievement_faithful_mentor` | achievement faithful mentor | 200 | 200 | 200 | 200 | Active |
| `achievement_kingdom_champion` | achievement kingdom champion | 250 | 250 | 250 | 250 | Active |
| `admin_bonus` | Administrator Performance Bonus | 0 | 1000 | — | — | Active |
| `admin_manual_award` | System Admin Points Award | 0 | — | — | — | Active |
| `bible_arena_monthly` | Monthly Bible Arena verified placement | 15 | 15 | — | — | Active |
| `bible_flash_easy` | Flash Bible Challenge Easy | 1 | 1 | — | — | Active |
| `bible_flash_hard` | Flash Bible Challenge Hard | 6 | 6 | — | — | Active |
| `bible_flash_medium` | Flash Bible Challenge Medium | 3 | 3 | — | — | Active |
| `bible_quiz_easy` | bible quiz easy | 3 | 3 | 3 | 21 | Active |
| `bible_quiz_hard` | bible quiz hard | 12 | 12 | 12 | 84 | Active |
| `bible_quiz_medium` | bible quiz medium | 6 | 6 | 6 | 42 | Active |
| `community_chain_resolve` | Resolve a useful Community chain | 1 | 1 | 3 | 12 | Active |
| `community_challenge_complete` | Community Challenge Complete | 2 | 2 | 6 | 30 | Active |
| `community_comment` | BUKLOD Community Comment | 2 | 2 | — | — | Active |
| `community_dugtong` | Community Dugtong | 1 | 1 | 8 | 40 | Active |
| `community_helpful_dugtong` | Helpful Community Dugtong | 2 | 2 | 6 | 24 | Active |
| `community_poll_vote` | Community Poll Vote | 1 | 1 | 5 | 25 | Active |
| `community_post` | BUKLOD Community Post | 5 | 5 | — | — | Active |
| `community_reaction` | BUKLOD Community Reaction | 1 | 1 | — | — | Active |
| `community_resource_used` | Community Resource Used | 1 | 1 | 5 | 25 | Active |
| `community_takeaway_share` | Share an anonymized Community takeaway | 1 | 1 | 2 | 8 | Active |
| `daily_bible` | Daily Bible Reading | 10 | 10 | — | — | Active |
| `daily_bible_verification` | Daily Bible Reading — Verified | 2 | 2 | — | — | Active |
| `devotional` | Devotional Completion | 12 | 12 | — | — | Active |
| `event_attendance` | Official Activity Attendance | 10 | 10 | — | — | Active |
| `formation_lesson` | Learning Lesson Passed | 25 | 25 | — | — | Active |
| `game_first_qualified` | game first qualified | 2 | 2 | — | — | Active |
| `game_tournament_champion` | game tournament champion | 100 | 100 | 100 | 100 | Active |
| `learning_progress_verification` | Learning Progress — Verified | 5 | 5 | — | — | Active |
| `mentor_session` | Mentoring Session | 15 | 15 | — | — | Active |
| `mentoring_release` | Mentoring Lesson Completion | 20 | 20 | — | — | Active |
| `ministry_activity` | Ministry Participation | 15 | 15 | — | — | Active |
| `ministry_major_milestone` | ministry major milestone | 100 | 100 | 100 | 100 | Active |
| `prayer_response` | Prayer / Encouragement Interaction | 2 | 2 | — | — | Active |
| `referral_rank_bonus` | Referral Circle Rank advancement | 10 | 10 | — | — | Active |
| `reflection_quality_bonus` | Reflection / Requirement Completion | 5 | 5 | — | — | Active |
| `scope_attendance` | Scope Attendance | 10 | 10 | — | — | Active |
| `stage_completion` | BUKLOD Stage Completion | 75 | 75 | — | — | Active |
| `verified_giving_participation` | Verified Giving Participation | 5 | 5 | — | — | Active |
| `verified_volunteer_service` | verified volunteer service | 20 | 20 | 20 | 20 | Active |
| `weekly_consistency` | Weekly Consistency | 20 | 20 | — | — | Active |
| `weekly_tip_dugtong` | BUKLOD Today weekly helpful tip meaningful Dugtong | 2 | 2 | 2 | 2 | Active |
| `weekly_tip_reaction` | BUKLOD Today weekly helpful tip reaction | 1 | 1 | 1 | 1 | Active |
| `bible_weekly_streak` | bible weekly streak | 20 | 20 | — | — | Inactive |
| `consistency_30_day` | consistency 30 day | 50 | 50 | — | — | Inactive |
| `daily_bible_reading` | daily bible reading | 10 | 10 | — | — | Inactive |
| `daily_devotional_reflection` | daily devotional reflection | 12 | 12 | — | — | Inactive |
| `formation_assessment` | formation assessment | 25 | 25 | — | — | Inactive |
| `formation_module` | formation module | 75 | 75 | — | — | Inactive |
| `game_advanced_perfect` | game advanced perfect | 20 | 20 | — | — | Inactive |
| `game_expert_campaign` | game expert campaign | 50 | 50 | — | — | Inactive |
| `game_hard_win` | game hard win | 10 | 10 | — | — | Inactive |
| `game_medium_win` | game medium win | 5 | 5 | — | — | Inactive |
| `game_puzzle_series` | game puzzle series | 25 | 25 | — | — | Inactive |
| `kl_episode` | kl episode | 10 | 10 | — | — | Inactive |
| `kl_season` | kl season | 50 | 50 | — | — | Inactive |
| `r2_verified_challenge` | Verified R2 challenge | 10 | 40 | 80 | 300 | Inactive |
| `verified_cluster_attendance` | verified church attendance | 10 | 10 | — | — | Inactive |
| `verified_mentoring_session` | verified mentoring session | 15 | 15 | — | — | Inactive |


### Version contradictions to reconcile before publishing the Season 2 User Guide

- Current server `referral_rank_bonus` config is **10 BP**; the latest owner-approved prospective **referrer** reward is **20 BP only if the referred member increases their Cluster Rank by at least one**, and a separate **referred-user** 10 BP value. This has **not been migrated/activated**; never claim 20 BP as paid by today's production system. Refer to verified referrals, never grant retroactively by UI.
- Current `kl_episode` and `kl_season` rows are inactive, even if old UI text implies +10/+50; do not show as currently awardable without authoritative restoration.
- Existing `daily_bible` 10 BP is active, `daily_bible_verification` 2 BP is active, but one reading activity must not accidentally double-award without distinct eligible source receipts.
- Existing `admin_bonus` and `admin_manual_award` are configured as active legacy rule definitions. Season 2 BUKLOD Official identity must remain excluded from member rewards; server-side role restrictions and historic policies require explicit verification.

## All current Circle Rank thresholds (40)

| Rank # | Circle Rank | Minimum Lifetime BP | Current definition |
| --- | --- | --- | --- |
| 1 | Circle Starter V | 0 | Active |
| 2 | Circle Starter IV | 200 | Active |
| 3 | Circle Starter III | 450 | Active |
| 4 | Circle Starter II | 750 | Active |
| 5 | Circle Starter I | 1100 | Active |
| 6 | Circle Active V | 1500 | Active |
| 7 | Circle Active IV | 2000 | Active |
| 8 | Circle Active III | 2600 | Active |
| 9 | Circle Active II | 3300 | Active |
| 10 | Circle Active I | 4100 | Active |
| 11 | Circle Steady V | 5000 | Active |
| 12 | Circle Steady IV | 6000 | Active |
| 13 | Circle Steady III | 7200 | Active |
| 14 | Circle Steady II | 8600 | Active |
| 15 | Circle Steady I | 10200 | Active |
| 16 | Circle Builder V | 12000 | Active |
| 17 | Circle Builder IV | 14000 | Active |
| 18 | Circle Builder III | 16300 | Active |
| 19 | Circle Builder II | 19000 | Active |
| 20 | Circle Builder I | 22000 | Active |
| 21 | Circle Impact V | 25000 | Active |
| 22 | Circle Impact IV | 28500 | Active |
| 23 | Circle Impact III | 32500 | Active |
| 24 | Circle Impact II | 37000 | Active |
| 25 | Circle Impact I | 42000 | Active |
| 26 | Circle Vanguard V | 48000 | Active |
| 27 | Circle Vanguard IV | 55000 | Active |
| 28 | Circle Vanguard III | 63000 | Active |
| 29 | Circle Vanguard II | 72000 | Active |
| 30 | Circle Vanguard I | 82000 | Active |
| 31 | BUKLOD Prime V | 95000 | Active |
| 32 | BUKLOD Prime IV | 110000 | Active |
| 33 | BUKLOD Prime III | 127000 | Active |
| 34 | BUKLOD Prime II | 146000 | Active |
| 35 | BUKLOD Prime I | 168000 | Active |
| 36 | BUKLOD Prime Elite V | 195000 | Active |
| 37 | BUKLOD Prime Elite IV | 225000 | Active |
| 38 | BUKLOD Prime Elite III | 260000 | Active |
| 39 | BUKLOD Prime Elite II | 300000 | Active |
| 40 | BUKLOD Prime Elite I | 350000 | Active |


Circle Rank measures BP achievement; spending existing Available BP must not reduce Lifetime Earned BP or Circle Rank. Monthly Rank is a distinct leaderboard view. Character evolution is not itself a Circle Rank update.

## Season 2 permanent virtual-world progression — NOT active commerce

Personal Lot, Personal House, Cluster/Community and Business each have 10 permanent tiers independent of seasons. Each tier must include **five authenticated sequential visible construction stages**, with distinct assets, stage receipts and progress. The current supplied V2 asset catalog has **NULL BP costs, materials, DXP effort and build times for all 40 tiers**. Therefore there is no authoritative purchasable pricing or level schedule. World DEV planning and PNG resolver now use five phases with exact integer preview allocation, but approved artwork and authoritative backend stage receipts remain missing; no BP charges are enabled.

Tasks must be accessible for users with Show Faith off. Level requirements should increase gradually and stay attainable with free verified participation. No free-money shortcuts, paid BP, or rank-gated property development.

### World Materials and Items (DEV sample pricing, NOT purchase offers)

The draft catalog provides sample BP values for wood plank 6 BP/pc, plywood board 40 BP/sheet, cement bag 60 BP/bag, hollow block 3 BP/pc, but these **are illustrative**. Every item's SKU, unit, source-image rights, quantity, price version and expiry must be confirmed on a staging server first. The V2 catalog's actual 40-tier material costs remain unassigned.

### Character items and levels

There are **13 canonical Characters**: Phan, Quin, Van, Christian, Lhen, Jawo, Trudice, Ace, Mitch, Niel, Angel, Vhen and Ellusur. Evolution requires BP eligibility plus item/quest receipts for the selected Character; collected cosmetic items are not automatic transition certificates. Faith-neutral equivalent acquisition paths are mandatory. The unmerged Character migration/SQL changeset must be verified before enabling.

### Arena game tokens, win/loss and fairness

Headless DEV Arena rules support short ranked matches, 13 playable Characters and noncash Diamond loss on real defeat. Example proposal: ranked winner +3 BP under antifarming caps and a ranked loss -10 Character Diamonds, potentially demoting effective combat level, **not** Circle Rank or Lifetime BP. These are NOT active live reward rules and must not be shown as guaranteed. Server-owned match tickets, authoritative 50 ms ticks, signed settlement, disconnect recovery, fraud monitoring, matchmaking and live state are mandatory before use.

### Cluster challenge treasury

Future Cluster BP is a separate treasury from member Available BP. One eligible member contribution receipt may produce bounded Cluster-progress BP from a verified grant rule, but is not a debit of member BP. In a challenge, award comes from the sponsor's **already reserved** Cluster treasury—zero stakes collected from losers, zero newly minted winner BP, and independent neutral evidence verification. Release flags currently disabled. Real-world project evidence must be consented/private and not treated as proof based solely on both teams clicking Approve.

## Transaction flow (future implementation, not live)

1. Server verifies a qualifying participation event and awards exactly once to Lifetime Earned BP and Available BP per canonical reward rule.
2. User selects a real, versioned item / property stage; server quotes exact material quantities and BP, locks inventory and wallet while fulfilling atomically.
3. Legitimate peer-to-peer sale debits the customer's Available BP, credits the seller's Available BP from the **same existing balance**, and atomically moves the item. Seller earns no new BP and no QMP merely by receiving BP.
4. Proposed QMP weighting applies **only** to qualifying delivered purchases and eligible unused BP origin receipts if Finance eventually approves; gifts and self-trades do not qualify. Refunds reverse the original receipts.
5. Character item progression, virtual construction, and Arena results are independent authoritative receipts; no local score, purchased badge or visual animation is a receipt.
6. Settlement may distribute actual eligible AdMob-only pool after closed-period reconciliation and independent cash identity verification. **Today's Finance switches are disabled**, so no cash payout is claimed.

## Non-negotiable server release tests

RLS isolation; no balance below zero; optimistic/CAS world revisions; idempotent BP and item ledger; serializable/locked concurrent checkout; no user-initiated QMP mint; exact category/monthly caps; anti-referral farming; no earnings from business operations; receipts and refunds; valid verified legal identity for withdrawals; anti-cheat and replay-resistant Arena tickets; handling offline clients and failed network callbacks; existing season/legacy read compatibility.

**Status:** This document is the auditable source-of-truth reconciliation guide, **not proof that Season 2 economy has been released or end-to-end tested**.
