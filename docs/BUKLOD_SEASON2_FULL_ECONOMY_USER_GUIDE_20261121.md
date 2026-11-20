# BUKLOD Complete Economy & Reward Guide — SOURCE RECONCILIATION (2026-11-21)

**Status:** Exact read-only snapshot of the **current MAIN backend** and isolated Season 2 DEV contracts. This is not an activated Season 2 rate card. All planned new rules need owner-approved signed version, zero-budget isolated DB proof, idempotent RPCs, client parity and runtime gates. No live data, production source or balances were changed.

## 1. Do not conflate the seven authorities

| System | Earned or assigned through | Can it mint spendable BP? | Can it alter QMP? | Season 2 principle |
| --- | --- | --- | --- | --- |
| **BP — spendable** | Server-verified active participation/claimed canonical ledger credits | **Yes, canonical rewards only** | Only separate approved participation qualification | Do not sell BP; business/trade transfers existing BP only |
| **Circle Rank** | Verified lifetime earned BP / approved rank-only profit credit if later separately authorized | No | No | Rank persists if spendable BP is used |
| **Character BP checkpoint** | Verified BP while each individual character was active | No | No | Only eligibility, never visual evolution without verified items |
| **Tokens/diamonds** | Proposed earned participation battle eligibility/resource | **No** | No | War Challenge may affect character access/progression, not underlying lifetime BP; exact rate pending |
| **Items / collectibles / materials** | Server-verified quests, participation, direct purchase from a real owner | **No** | No | Some bind to character; tradable materials separately cataloged |
| **Community BP treasury** | Independently verified member participation/progress and lawful treasury transfers | **Never personal BP mint** | No | Scope funds not individual stakes or cash; caps, membership and anti-farming |
| **QMP / PHP financial distribution** | Canonical qualified monthly participation and separate actual eligible revenue settlement | No | **This is QMP authority** | Noncash BP purchases, trade, gameplay, land upgrades do not create QMP or peso earnings |

## 2. Live Main BUKLOD Point Rules — all 62 authoritative rows

Snapshot of live `buklod_point_rules` as of November 21, 2026. A row being active means it is configured active, **not** proof the feature awards correctly in the current APK. `—` means the DB column has no cap; it does not bypass server anti-spam/uniqueness checks.

| Activity key | User-facing label | Base BP | Max/event | Daily cap | Weekly cap | Live active |
| --- | --- | ---: | ---: | ---: | ---: | :---: |
| `abc_growth_lesson` | ABC Christian Growth Lesson | 8 | 8 | — | — | Yes |
| `achievement_bible_scholar` | achievement bible scholar | 100 | 100 | 100 | 100 | Yes |
| `achievement_community_builder` | achievement community builder | 150 | 150 | 150 | 150 | Yes |
| `achievement_faithful_mentor` | achievement faithful mentor | 200 | 200 | 200 | 200 | Yes |
| `achievement_kingdom_champion` | achievement kingdom champion | 250 | 250 | 250 | 250 | Yes |
| `admin_bonus` | Administrator Performance Bonus | 0 | 1000 | — | — | Yes |
| `admin_manual_award` | System Admin Points Award | 0 | — | — | — | Yes |
| `bible_arena_monthly` | Monthly Bible Arena verified placement | 15 | 15 | — | — | Yes |
| `bible_flash_easy` | Flash Bible Challenge Easy | 1 | 1 | — | — | Yes |
| `bible_flash_hard` | Flash Bible Challenge Hard | 6 | 6 | — | — | Yes |
| `bible_flash_medium` | Flash Bible Challenge Medium | 3 | 3 | — | — | Yes |
| `bible_quiz_easy` | bible quiz easy | 3 | 3 | 3 | 21 | Yes |
| `bible_quiz_hard` | bible quiz hard | 12 | 12 | 12 | 84 | Yes |
| `bible_quiz_medium` | bible quiz medium | 6 | 6 | 6 | 42 | Yes |
| `bible_weekly_streak` | bible weekly streak | 20 | 20 | — | — | No |
| `community_chain_resolve` | Resolve a useful Community chain | 1 | 1 | 3 | 12 | Yes |
| `community_challenge_complete` | Community Challenge Complete | 2 | 2 | 6 | 30 | Yes |
| `community_comment` | BUKLOD Community Comment | 2 | 2 | — | — | Yes |
| `community_dugtong` | Community Dugtong | 1 | 1 | 8 | 40 | Yes |
| `community_helpful_dugtong` | Helpful Community Dugtong | 2 | 2 | 6 | 24 | Yes |
| `community_poll_vote` | Community Poll Vote | 1 | 1 | 5 | 25 | Yes |
| `community_post` | BUKLOD Community Post | 5 | 5 | — | — | Yes |
| `community_reaction` | BUKLOD Community Reaction | 1 | 1 | — | — | Yes |
| `community_resource_used` | Community Resource Used | 1 | 1 | 5 | 25 | Yes |
| `community_takeaway_share` | Share an anonymized Community takeaway | 1 | 1 | 2 | 8 | Yes |
| `consistency_30_day` | consistency 30 day | 50 | 50 | — | — | No |
| `daily_bible` | Daily Bible Reading | 10 | 10 | — | — | Yes |
| `daily_bible_reading` | daily bible reading | 10 | 10 | — | — | No |
| `daily_bible_verification` | Daily Bible Reading — Verified | 2 | 2 | — | — | Yes |
| `daily_devotional_reflection` | daily devotional reflection | 12 | 12 | — | — | No |
| `devotional` | Devotional Completion | 12 | 12 | — | — | Yes |
| `event_attendance` | Official Activity Attendance | 10 | 10 | — | — | Yes |
| `formation_assessment` | formation assessment | 25 | 25 | — | — | No |
| `formation_lesson` | Learning Lesson Passed | 25 | 25 | — | — | Yes |
| `formation_module` | formation module | 75 | 75 | — | — | No |
| `game_advanced_perfect` | game advanced perfect | 20 | 20 | — | — | No |
| `game_expert_campaign` | game expert campaign | 50 | 50 | — | — | No |
| `game_first_qualified` | game first qualified | 2 | 2 | — | — | Yes |
| `game_hard_win` | game hard win | 10 | 10 | — | — | No |
| `game_medium_win` | game medium win | 5 | 5 | — | — | No |
| `game_puzzle_series` | game puzzle series | 25 | 25 | — | — | No |
| `game_tournament_champion` | game tournament champion | 100 | 100 | 100 | 100 | Yes |
| `kl_episode` | kl episode | 10 | 10 | — | — | No |
| `kl_season` | kl season | 50 | 50 | — | — | No |
| `learning_progress_verification` | Learning Progress — Verified | 5 | 5 | — | — | Yes |
| `mentor_session` | Mentoring Session | 15 | 15 | — | — | Yes |
| `mentoring_release` | Mentoring Lesson Completion | 20 | 20 | — | — | Yes |
| `ministry_activity` | Ministry Participation | 15 | 15 | — | — | Yes |
| `ministry_major_milestone` | ministry major milestone | 100 | 100 | 100 | 100 | Yes |
| `prayer_response` | Prayer / Encouragement Interaction | 2 | 2 | — | — | Yes |
| `r2_verified_challenge` | Verified R2 challenge | 10 | 40 | 80 | 300 | No |
| `referral_rank_bonus` | Referral Circle Rank advancement | 10 | 10 | — | — | Yes |
| `reflection_quality_bonus` | Reflection / Requirement Completion | 5 | 5 | — | — | Yes |
| `scope_attendance` | Scope Attendance | 10 | 10 | — | — | Yes |
| `stage_completion` | BUKLOD Stage Completion | 75 | 75 | — | — | Yes |
| `verified_cluster_attendance` | verified church attendance | 10 | 10 | — | — | No |
| `verified_giving_participation` | Verified Giving Participation | 5 | 5 | — | — | Yes |
| `verified_mentoring_session` | verified mentoring session | 15 | 15 | — | — | No |
| `verified_volunteer_service` | verified volunteer service | 20 | 20 | 20 | 20 | Yes |
| `weekly_consistency` | Weekly Consistency | 20 | 20 | — | — | Yes |
| `weekly_tip_dugtong` | BUKLOD Today weekly helpful tip meaningful Dugtong | 2 | 2 | 2 | 2 | Yes |
| `weekly_tip_reaction` | BUKLOD Today weekly helpful tip reaction | 1 | 1 | 1 | 1 | Yes |

**Known drift:** Live `referral_rank_bonus` and `buklod_referral_rewards_config` remain 10 BP for the referrer; the approved Season 2 rule is **20 BP only when the referral raises the referred member's Cluster Rank by at least one**. The referred member remains at 10 BP. No live config was changed in this audit. Do not announce 20 as already operational. The listed season row is `BUKLOD Season 1`, status `active`, ending `2026-10-31`; stale flags should be audited before next release.

## 3. Lifetime Circle Rank — all 40 Main thresholds

Rank derives from verified cumulative Rank-authoritative BP, not a cash account or items. Spending transferable BP must not decrease historical lifetime rank.

| No. | Circle Rank | Lifetime threshold (BP) | Active |
| ---: | --- | ---: | :---: |
| 1 | Circle Starter V | 0 | Yes |
| 2 | Circle Starter IV | 200 | Yes |
| 3 | Circle Starter III | 450 | Yes |
| 4 | Circle Starter II | 750 | Yes |
| 5 | Circle Starter I | 1,100 | Yes |
| 6 | Circle Active V | 1,500 | Yes |
| 7 | Circle Active IV | 2,000 | Yes |
| 8 | Circle Active III | 2,600 | Yes |
| 9 | Circle Active II | 3,300 | Yes |
| 10 | Circle Active I | 4,100 | Yes |
| 11 | Circle Steady V | 5,000 | Yes |
| 12 | Circle Steady IV | 6,000 | Yes |
| 13 | Circle Steady III | 7,200 | Yes |
| 14 | Circle Steady II | 8,600 | Yes |
| 15 | Circle Steady I | 10,200 | Yes |
| 16 | Circle Builder V | 12,000 | Yes |
| 17 | Circle Builder IV | 14,000 | Yes |
| 18 | Circle Builder III | 16,300 | Yes |
| 19 | Circle Builder II | 19,000 | Yes |
| 20 | Circle Builder I | 22,000 | Yes |
| 21 | Circle Impact V | 25,000 | Yes |
| 22 | Circle Impact IV | 28,500 | Yes |
| 23 | Circle Impact III | 32,500 | Yes |
| 24 | Circle Impact II | 37,000 | Yes |
| 25 | Circle Impact I | 42,000 | Yes |
| 26 | Circle Vanguard V | 48,000 | Yes |
| 27 | Circle Vanguard IV | 55,000 | Yes |
| 28 | Circle Vanguard III | 63,000 | Yes |
| 29 | Circle Vanguard II | 72,000 | Yes |
| 30 | Circle Vanguard I | 82,000 | Yes |
| 31 | BUKLOD Prime V | 95,000 | Yes |
| 32 | BUKLOD Prime IV | 110,000 | Yes |
| 33 | BUKLOD Prime III | 127,000 | Yes |
| 34 | BUKLOD Prime II | 146,000 | Yes |
| 35 | BUKLOD Prime I | 168,000 | Yes |
| 36 | BUKLOD Prime Elite V | 195,000 | Yes |
| 37 | BUKLOD Prime Elite IV | 225,000 | Yes |
| 38 | BUKLOD Prime Elite III | 260,000 | Yes |
| 39 | BUKLOD Prime Elite II | 300,000 | Yes |
| 40 | BUKLOD Prime Elite I | 350,000 | Yes |

## 4. Character evolution — approved DEV contract; NOT operational

13 characters: Phan, Quin, Van, Christian, Lhen, Jawo, Trudice, Ace, Mitch, Niel, Angel, Vhen, Ellusur. Switching characters does not wipe prior character milestones. Every character's individual BP checkpoint is distinct from Circle Rank and from spendable balance. **BP is not consumed to change appearance.**

| Character level | Per-character BP eligibility | Mandatory item slots to progress from level |
| ---: | ---: | ---: |
| 1 | 0 | 2 |
| 2 | 50 | 2 |
| 3 | 100 | 2 |
| 4 | 250 | 2 |
| 5 | 500 | 3 |
| 6 | 1,000 | 3 |
| 7 | 2,500 | 3 |
| 8 | 5,000 | 3 |
| 9 | 10,000 | 3 |
| 10 | 25,000 | 4 |
| 11 | 50,000 | 4 |
| 12 | 75,000 | 4 |
| 13 | 100,000 | 4 |
| 14 | 150,000 | 4 |
| 15 | 200,000 | 5 |
| 16 | 250,000 | 5 |
| 17 | 300,000 | 5 |
| 18 | 350,000 | 5 |
| 19 | 400,000 | 5 |
| 20 | 500,000 | 0 |

Total artwork: **1,300 story-asset slots**, 100 per character; mandatory progression receipts per character: **68**. Tasks gradually increase (verified meaningful public posts, helpful comments, reactions, shares, distinct active weeks). **Show Faith OFF must always have equivalent attainable non-faith paths** including server-verified gameplay mastery. A local image, fake client score, unclaimed credit, already reused evidence or merely buying business stock is not proof of character evolution. Pending `get_my_buklod_character_evolution_v1`/claim RPCs are in an isolated DEV changeset, not confirmed on live Main.

## 5. Permanent virtual world & business — DEV, not purchased property

Personal Lot, House, Farm, Cluster and Organization each evolve independently to permanent **L1–L10**. Every level has several *visible* stages, starting with bare land, stakes, foundation and framework; do not display a complete mansion at L1. Shared Scope stages require independently verified community contribution and authorized collective governance. Season cosmetics never wipe progress; Circle Rank must not gate asset development.

A DEV business recipe proposes **5 verified distinct participation credits and 40 earned available BP** as entry capital; 10 business tiers each with 5 construction stages: **Survey/Posts → Frame → Walls → Roof → Finishing**. A market business does not mint BP by registering, selling or completing a task. A genuine purchase atomically debits buyer available BP and credits seller available BP for the **same total**, with inventory escrow, nonce/idempotency, receipts, profit/cost-basis and no self-dealing. An approved separate rank-only **net-profit** policy must not credit spendable BP a second time; this remains proposed not released.

DEV catalog materials: wood, stone, nails, metal, glass, fabric. Comprehensive high-resolution, 1,300-character and 72+ world item catalogs remain unapproved/missing; sample DEV SKU prices in `worldEconomyBlueprint.ts` are **not authoritative real trading prices**. No exact purchase price is published until a versioned server catalog, backed wallet, inventory, RLS and refund/reversal flows pass.

## 6. War challenge & strategic progression — approved direction, not deployed

Main War Challenge should be real-time, short, replayable, genuinely competitive with skill, tactics, team coordination and optional mic. Legitimately acquired token/diamond resources can affect character competitive eligibility or resource progression, with genuine win/loss. A winning participant may earn **server-verified, capped BP** from a separately budgeted reward authority; losers do not forfeit their historic earned lifetime BP. No user-staked spendable BP, no betting, no unbounded token farming, no outcome-only client mint. The exact reward amounts, token source caps, matchmaking, anti-collusion and disconnect outcomes are not yet authorized by a deployed server; **no numeric values can be represented as live**.

## 7. QMP, member funds & withdrawal — preserve financial authority

QMP is qualified monthly participation weight, not BP balance. `buklodEconomyQmp.ts` validates period and totals; `get_my_buklod_financial_summary_v3` is the separate peso/earnings endpoint. Current-month numbers are provisional; last finalized period is fixed/withdrawable only after finance rules and real revenue are settled. No direct income or Peso minting from game wins, BP transfers, store sales or land upgrades. Cash withdrawal must require approved membership, independent government-ID verification and matching payout beneficiary, server enforced, preserving audit trail. Retain owner-approved withdrawal minimum and percentage settings only after checking the versioned finance rules—do not infer from outdated client labels.

## 8. Referral, verification and split faith/non-faith paths

Live referral config snapshot: referrer **10 BP**, referred **10 BP**, separate Bayanihan config referrer **5.00**, referred **0.00**; owner approved Season 2 referrer 20 BP on independently verified Cluster Rank advancement ≥1. Until the server rule is actually migrated, display live truth with a clear "upcoming policy" label. Verified task completion is required; no fake accounts, self-referral or device rings.

Show Faith ON provides Bible, devotional, reflection and faith-track tasks; Show Faith OFF must provide equal accessible item/character/asset achievement via social, learning, service or genuine game mastery. Never force prayer, Bible reading or religious identity for generic rank, community or economy access. Faith-specific content can remain opt-in without lowering fairness.

## 9. Why the Season 2 consolidated economy is still gated

No connected Supabase development branch was available. The separate World PR #1042, Character PR #1041, BP Trade PR #1043, policy PR #1044 and Market PR #1039 are OPEN DEV/HOLD, with current migrations and RPCs not certified against an isolated DB. New team/War token ledger and fully replay-safe authoritative gameplay server remain incomplete. Most unapproved World prices are previews. The production APK and production economy must remain unchanged. Run release-bounded integration, RLS, authority and backward-compatibility tests before activation.
