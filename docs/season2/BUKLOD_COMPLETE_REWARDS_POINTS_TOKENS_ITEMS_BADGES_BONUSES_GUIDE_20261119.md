# BUKLOD — COMPLETE MEMBER REWARDS GUIDE (SEASON 1 + SEASON 2)
**November 19, 2026 source snapshot · Season 2 earliest target December 6 · NOT LIVE**

This complete, shareable user guide contains **all configured and approved numbers**, not just a short poster:
- 46 active / 16 inactive legacy BUKLOD Points (BP) catalog rules, exact eligibility notes, milestones and daily limits
- All configured Community QMP event bonuses, four missions, five monthly classification bands, proportional financial accounting and verification restrictions
- The exact 10 locked Season 2 exclusive features, full 12-week Rise Together narrative quests, 4 seasonal awards and 4 weekly performance classes
- KL chapter-by-chapter pending BP formula, one 20-character +5 comment and 50-character +50 full series reflection requirements
- Journey Tokens 9/day supported-source total, 12/day global cap, optional proposed cosmetic prices and source verification
- Weekly P0 Foundation, grace/Flex, opt-in Momentum deductions (not approved/live)
- Special referrals (+20 referrer target, +10 qualified referred member target), ID-verified financial withdrawal, and season carryover/reset rules
- The **complete 1,300 individually named collectibles**, **all 469 named Character badges**, **all 40 Circle Rank visual classifications**, Special Character rank gates, and 4 Kingdom Shard items/prices
- All technical/economy readiness gates and distinction of **configured / planned / pending / disabled**

**Crucial:** This is an informational guide, not an instruction to grant rewards. Neither the 1,300 art assets nor the 469 badge names prove eligibility or ownership. Production Season 1 remains unchanged. Exact Android/SQL/financial/owner release verification is required before any new Season 2 grants.

**For member navigation after verified staging integration:** Points/Season Journey → **Full Rewards** → BP · QMP · SEASON 2 · ITEMS/BADGES · CARRYOVER. In the item guide choose one of 13 Characters, any of 20 levels, and one of the 5 named item prerequisites; browse badges, all rank families and Kingdom prices separately.

---

# PART I — Points, QMP, rewards, missions, eligibility, deductions and launch gates

**Verified-source preparation dated November 19, 2026 (Asia/Manila)**

**Status: DEV SOURCE PREP — NOT A LIVE SEASON 2 REWARD ENGINE OR PRODUCTION RELEASE.** This document is generated from `contracts/season2-dec6-complete-reward-inventory-20261119.json`. Source references and amounts are traceable, but preview/backend gaps are deliberately not marked as deployed.

## 0. Hard owner decisions and release scope

- The owner-approved **10 exclusive Season 2 items (and only those 10)** must remain the exact allowlist in `contracts/season2-owner-approved-exclusives-20261119.json`. Approved read-only Daily Proverbs on Show Faith Wall is supplementary content and **not** an 11th exclusive/game reward.
- **Season 1 LIVE unchanged** until separately authorized. BUKLOD BP, monthly QMP, Character V3, Kingdom Shards, finance/payouts, social publishing, security, AdMob, migration history, claims and inventory must not be silently changed.
- Opening target **December 6, 2026, 00:00 PHT, earliest possible**. No auto-launch on that date; there must be separate exact-SHA owner authorization, reconciled signed Season 1, stage backend proof, complete verified RC and production manifest matching the approved source.
- DEV preparation uses the isolated branch. Do not merge unfinished Season 2 reward migrations into `main` or apply SQL candidate to connected production-like Supabase. `org.mzbministry.buklod.staging` is the dedicated staging package; Android native runtime & AdMob evidence require independent release gates.
- Standalone retired Buklod Quiz, Focus apps and IGPAT must not mint new Season 2 rewards; preserved IGPAT history is not erased.

## 1. Currencies, lifetime vs monthly vs season

| Currency/asset | Authoritative ledger | Retention/uses |
|---|---|---|
| BP | S1 canonical points ledger | lifetime; not redeemable directly for peso |
| QMP | Existing private community QMP rules/events | monthly qualified weight; not redeemable directly for peso |
| CHARACTER_EARNED_POINTS | Character V3 from canonical BP | per character lifetime; not redeemable directly for peso |
| KINGDOM_SHARDS | Kingdom-only backend | game wallet; not redeemable directly for peso |
| S2_JOURNEY_TOKEN | Not-yet-deployed isolated S2 ledger | nontransferable noncash; not redeemable directly for peso |
| S2_SEASONAL_MOMENTUM | Opt-in future seasonal scoreboard | seasonal; not redeemable directly for peso |
| PESO_AVAILABLE | Finalized funded finance ledger | carryforward until authorized withdrawal; only finalized funded peso is withdrawable |

**Never** convert 1 QMP to a fixed peso rate, apply cash payout from ordinary BP, transfer Journey Tokens, exchange Kingdom Shards for Journey Tokens, or treat art files as owned items. Circle Rank/lifetime BP and per-Character earned points survive season changes. Cash withdrawals and redeemed available BP are separately accounted; lifetime earned history is preserved.

## 2. ALL active Season 1 BP catalog values to carry forward unchanged

**Live catalog snapshot** from BUKLOD Connect Supabase on Nov 19. *Active rule ≠ all triggers proven active*. Each award requires existing validated source, source-level limits and deduplication. NULL in `day_cap_points` is **not** an unlimited farm permission.

| Activity key | BP per qualified event | Catalog daily cap BP |
|---|---:|---:|
| `abc_growth_lesson` | 8 | — / trigger-specific |
| `achievement_bible_scholar` | 100 | 100 |
| `achievement_community_builder` | 150 | 150 |
| `achievement_faithful_mentor` | 200 | 200 |
| `achievement_kingdom_champion` | 250 | 250 |
| `admin_bonus` | 0 | — / trigger-specific |
| `admin_manual_award` | 0 | — / trigger-specific |
| `bible_arena_monthly` | 15 | — / trigger-specific |
| `bible_flash_easy` | 1 | — / trigger-specific |
| `bible_flash_medium` | 3 | — / trigger-specific |
| `bible_flash_hard` | 6 | — / trigger-specific |
| `bible_quiz_easy` | 3 | 3 |
| `bible_quiz_medium` | 6 | 6 |
| `bible_quiz_hard` | 12 | 12 |
| `community_chain_resolve` | 1 | 3 |
| `community_challenge_complete` | 2 | 6 |
| `community_comment` | 2 | — / trigger-specific |
| `community_dugtong` | 1 | 8 |
| `community_helpful_dugtong` | 2 | 6 |
| `community_poll_vote` | 1 | 5 |
| `community_post` | 5 | — / trigger-specific |
| `community_reaction` | 1 | — / trigger-specific |
| `community_resource_used` | 1 | 5 |
| `community_takeaway_share` | 1 | 2 |
| `daily_bible` | 10 | — / trigger-specific |
| `daily_bible_verification` | 2 | — / trigger-specific |
| `devotional` | 12 | — / trigger-specific |
| `event_attendance` | 10 | — / trigger-specific |
| `formation_lesson` | 25 | — / trigger-specific |
| `game_first_qualified` | 2 | — / trigger-specific |
| `game_tournament_champion` | 100 | 100 |
| `learning_progress_verification` | 5 | — / trigger-specific |
| `mentor_session` | 15 | — / trigger-specific |
| `mentoring_release` | 20 | — / trigger-specific |
| `ministry_activity` | 15 | — / trigger-specific |
| `ministry_major_milestone` | 100 | 100 |
| `prayer_response` | 2 | — / trigger-specific |
| `referral_rank_bonus` | 10 | — / trigger-specific |
| `reflection_quality_bonus` | 5 | — / trigger-specific |
| `scope_attendance` | 10 | — / trigger-specific |
| `stage_completion` | 75 | — / trigger-specific |
| `verified_giving_participation` | 5 | — / trigger-specific |
| `verified_volunteer_service` | 20 | 20 |
| `weekly_consistency` | 20 | — / trigger-specific |
| `weekly_tip_dugtong` | 2 | 2 |
| `weekly_tip_reaction` | 1 | 1 |

### Disabled catalog rules (NOT additional automatic Season 2 rewards)

| Inactive key | Historical configured amount (BP) |
|---|---:|
| `bible_weekly_streak` | 20 |
| `consistency_30_day` | 50 |
| `daily_bible_reading` | 10 |
| `daily_devotional_reflection` | 12 |
| `formation_assessment` | 25 |
| `formation_module` | 75 |
| `game_advanced_perfect` | 20 |
| `game_expert_campaign` | 50 |
| `game_hard_win` | 10 |
| `game_medium_win` | 5 |
| `game_puzzle_series` | 25 |
| `kl_episode` | 10 |
| `kl_season` | 50 |
| `r2_verified_challenge` | 10 |
| `verified_cluster_attendance` | 10 |
| `verified_mentoring_session` | 15 |

**Exception: KL** `kl_episode` and `kl_season` catalog rows are inactive, but a separate existing verified KL direct RPC reports a **+10 BP first chapter and +50 BP full series** path. Do not reactivate catalog rows and double-award. Current source has known reported-vs-awarded point discrepancy and quiz enforcement was observed **OFF**; correct forward-only in appropriate rollout without retroactive credit.

**Exception: referrals** the active `referral_rank_bonus` catalog is **+10 BP**; latest Season 2 referrer target is **+20 BP** after legitimate verified rank advancement. This is an OPEN effective-rule conflict requiring isolated rollout, not permission to change production now.

## 3. Existing Community QMP (separate from BP and from Season 2)

| Qualified source | QMP | Requirements |
|---|---:|---|
| Useful original post | +5 | >=40 actual characters OR valid accepted media; visible and moderated |
| Qualified eligible video | +10 | Valid user-owned eligible video, real source; quality/anti-farm checks |
| Meaningful reply | +3 | >=20 characters, nonspam; identical text excluded within 7 days |
| Creator distinct reaction bonus | +1 | Reaction by another real user; self-reactions excluded |
| Creator qualified comment engagement bonus | +1 | Independently validated engagement event |
| Internal share configured bonus | +2 | Only if active validated backend share trigger exists; configuration alone is not proof |

QMP monthly engagement-bonus cap **250**; per-content engagement bonus cap **25**; velocity exclusion threshold **30/hour**. This applies to qualified QMP bonuses, not a client throttle that prevents lawful posting.

### Existing QMP missions

| Mission | Trigger and minimum | Reward |
|---|---|---:|
| COMMUNITY_BUILDER | 3 × `ACTIVE_DAY` | +20 QMP |
| COMMUNITY_CREATOR | 3 × `USEFUL_POST` | +15 QMP |
| HELPFUL_VOICE | 5 × `MEANINGFUL_REPLY` | +10 QMP |
| VIDEO_STORYTELLER | 1 × `QUALIFIED_VIDEO` | +15 QMP |

### Existing QMP tiers

| Tier | QMP in period |
|---|---|
| Starter | 0–24 |
| Active | 25–74 |
| Contributor | 75–149 |
| Builder | 150–299 |
| Community Champion | 300–∞ |

The designated community user pool is **30% of eligible settled earnings**, proportionally assigned by qualified monthly member QMP over total qualifying QMP. This is **not 30% of gross app revenue guaranteed to every user**. Current provider estimate is provisional; last-month finalized payable amount requires finance activation, sufficient funded balance and legal eligibility. At audit time QMP financial finalization remained OFF.

## 4. Exactly 10 Season 2 owner-approved exclusives — complete requirements and gaps

### 1. rise_together_campaign
**Required member behavior / formula:** 12 weeks; 4 acts (CALL 1-3, MAKE 4-6, BOND 7-9, LEGACY 10-12); 13 characters; Explorer/Creator/Together voluntary routes; no forced activity
**Current source state:** `STAGING_PREVIEW_ONLY`. **Remaining before activation:** Story preview exists; full published missions/season schedule, server receipts and earned finale require implementation
**Authority/evidence:** `src/lib/buklodSeason2CampaignR1.ts`, `src/components/points/BuklodSeasonJourneyPreview.tsx`

### 2. journey_token_wallet
**Required member behavior / formula:** Source-verified Today +2 (1/day), KL +3 (1/day), original Wall +2 (1/day), meaningful nonself comment +1 (2/day), 9 supported/day, global ceiling 12; cosmetic only, no cash
**Current source state:** `SOURCE_ONLY`. **Remaining before activation:** Isolated ledger/RLS/mint/spend, atomic idempotency, caps, transfer ban, actual stage backend, receipts and rollback
**Authority/evidence:** `src/lib/season2/buklodSeason2RewardContractR1.ts`, `docs/season2/sql/BUKLOD_S2_ISOLATED_REWARD_CORE_DRAFT_NOT_DEPLOY.sql`

### 3. character_mastery_1300
**Required member behavior / formula:** 13 characters x 20 levels x 5 items; selected character + level; slots: I1 stage, I2 unique learning, I3 unique community, I4 claimed Foundation, I5 certified I1-I4; special rank gate
**Current source state:** `DEV_PREVIEW`. **Remaining before activation:** Server-owned inventory and durable claim/equip, unique evidence per item; no art-to-ownership or existing item re-lock
**Authority/evidence:** `src/lib/season2/buklodSeason2CollectibleGuideR1.ts`, `docs/season2/sql/BUKLOD_S2_COLLECTIBLE_MASTERY_DRAFT_NOT_DEPLOY.sql`

### 4. weekly_performance_class
**Required member behavior / formula:** Mon 00:00 Manila week; active days 5x7; learning 6x5; community impact 7x5; quality creation 6x5; cap100; Emerging1, Active25, Thrive60, Exceptional85; tier diversity/day requirements
**Current source state:** `DEV_PR_ONLY`. **Remaining before activation:** Backend batch <=32 and per-user read, verified claimed evidence; only highest eligible closed-week noncash reward
**Authority/evidence:** https://github.com/faust-0612/BUKLOD-Rork/pull/965

### 5. four_season_awards
**Required member behavior / formula:** Beacon Trail Frame (Call), Maker Ribbon (Makers), Alliance Crest (Alliance), Constellation Finale Scene (Legacy); verified milestones; permanent audit of earned rewards
**Current source state:** `PREVIEW_ONLY`. **Remaining before activation:** Source-linked Character-owned badge/award grant and render; one grant per milestone, no auto-award from preview
**Authority/evidence:** `src/lib/buklodSeason2CampaignR1.ts`

### 6. kingdom_cooperative_missions
**Required member behavior / formula:** Kingdom first server-confirmed mastery; cooperative cluster/org with per-member verified inputs and solo equivalent; no invite farming
**Current source state:** `PLANNED`. **Remaining before activation:** Real game authority/adapters, balanced faith/nonfaith routes, account-scope protection, optional cosmetics
**Authority/evidence:** `src/lib/season2/buklodSeason2RewardContractR1.ts`

### 7. foundation_momentum_grace_antifarm
**Required member behavior / formula:** P0: 1 unique verified learning + 1 distinct community per week, 7+3 days, two opt-in Flex credits of 7 days each; P1/P2 only optional; Momentum +5 active day, after grace -5 inactivity/-2 reading/-2 creator max-9 optional
**Current source state:** `SOURCE_ONLY`. **Remaining before activation:** Authenticated stage backend and stored weekly outcomes, accessible equivalent routes, offline grace and appeal; no permanent deductions
**Authority/evidence:** `src/lib/season2/buklodSeason2RewardContractR1.ts`

### 8. kl_progressive_pending_bp
**Required member behavior / formula:** Chapter N awards 5+N BP pending until verified N+1, chapter30 until next series ch1, one chapter comment >=20 chars +5, full 30 chapters +50 requires >=50-char genuine personal series reflection; no reading-duration requirement; sequential chapter gate; no required photo
**Current source state:** `DEV_PR_ONLY`. **Remaining before activation:** Reconcile existing S1 +10/chapter and direct RPC, migrate S2 forward-only without historical recredit, quiz verification and no client bypass; pending flow + ads without reward interruption
**Authority/evidence:** https://github.com/faust-0612/BUKLOD-Rork/pull/973

### 9. seasonal_archival_carryover
**Required member behavior / formula:** Sign and archive final S1; only seasonal score/missions/tier reset; permanent BP, monthly QMP history, per-character level, inventory, badges, pesos and withdrawal history survive; Hall of Fame
**Current source state:** `SOURCE_ONLY`. **Remaining before activation:** Atomic idempotent rollover, locks/steps/recovery, signed finality, UTC/PHT period certainty, retro-event reconciliation
**Authority/evidence:** `src/lib/season2/buklodSeason2CarryoverContractR1.ts`, `contracts/season2-implementation-ledger.json`

### 10. qualified_referral_rank_reward
**Required member behavior / formula:** Referrer +20 BP only when one verified referred member advances >=1 eligible cluster-associated Circle Rank, 1x/referral; new-member +10 BP on independent qualification; financial referral separate
**Current source state:** `GAP_CONFLICT`. **Remaining before activation:** Current S1 referral catalog still +10; S2 must not mutate S1, require ledger isolation, rank evidence, no retro double-claims
**Authority/evidence:** `supabase/migrations/20261116130306_buklod_verified_referral_circle_rank_20bp_v2.sql`

## 5. Rise Together — editorial path (12 weeks, not an automatically opened season)

| Weeks | Story arc | Character/mission emphasis | Earned seasonal prize preview |
|---|---|---|---|
| 1–3 | The Call (Ang Tawag) | Choose among Explorer/Creator/Together, discovery and genuine first connection | Beacon Trail Frame |
| 4–6 | The Makers (Mga Tagapagbuo) | Story creativity, legitimate video/text/photos, verified contributions | Maker Ribbon |
| 7–9 | The Alliance (Ang Ugnayan) | Cooperative friendship, optional Kingdom mastery, nonfaith/solo equivalents | Alliance Crest |
| 10–12 | The Legacy (Ang Pamana) | Owned-inventory gallery, verified catch-up and season finale | Constellation Finale Scene |

**13 Characters** use the canonical Character catalog. Story reading, free baseline avatar/cosmetics and core social features remain accessible without paid upgrades, forced rewarded ads, required prayer or public disclosure. All four awards require qualified server event receipts. The finale story itself must stay accessible if the member chooses not to compete.

## 6. Season 2 Journey Tokens — actual source proposal and price preview

| Token source | Tokens | Max qualifying events/day | Evidence |
|---|---:|---:|---|
| `today_dugtong` | +2 | 1 | Accepted real Today/Dugtong, actor-owned, one source/cycle |
| `kl_verified_chapter` | +3 | 1 | Published, completed chapter + verified evidence; no phantom client quiz |
| `wall_original_post` | +2 | 1 | Meaningful original still-visible moderated post |
| `wall_meaningful_comment` | +1 | 2 | Nonself distinct accepted >=20 chars; no duplicates |

- Configured eligible max is **9 tokens/day** from these four sources. Overall future ceiling is **12/day**, not a promise that the remaining 3 can be earned. No points from opening tabs, spam, ads alone or fake video views.
- Formation and Bible quiz counterpart, nonfaith equivalent learning, general challenge, Kingdom mastery, children's story and private prayer presently mint **0 S2 tokens** until a fair real source and privacy/owner rules are independently approved. Children's prayer/reflection never becomes a spendable-token incentive.
- Token state: **Locked / Pending verification / Eligible / Credited / Spent / Owned / Equipped / Reversed**. The server is sole grant/spend authority, one durable source claim across version updates. Account-bound receipts and transaction-locked item purchase are mandatory.

| Optional cosmetic (UNAPPROVED price proposal) | Token price |
|---|---:|
| accessory_finish | 30 |
| gallery_theme | 60 |
| skin_variant | 80 |
| premium_visual_effect | 150 |

All token prices, rollover/expiry/carryover policy and exact award conditions are OPEN for final owner signoff. Never buy rank, earned achievement badge, level-gated collectible, BP/QMP multiplier, cash, required access or a child-targeted reward.

### Optional rewarded ads and badge-name proposals (not additional exclusive features)

- Current rewarded-ad source permits only an **opt-in noncash in-game benefit** after the provider's actual `EARNED_REWARD` event. An existing BUKLOD Bahay UI example says **+1 Garden Energy**; this is **not** independently confirmed as a server award. No automatic BP, QMP, peso, Journey Token, Bayanihan or other redeemable value is granted just for watching an ad. The historical idea of +5 BP per ad / 15 BP daily must **not** be silently activated: current source expressly forbids direct Circle Points from rewarded ads.
- Optional Character-authority badge *name candidates* are Story Explorer, Helpful Voice, Learning Mentor, Community Builder, Knowledge Keeper and Kingdom Explorer. These are **not issued badges or an 11th exclusivity category**. Exact criteria, evidence, duplicate rules and owner economic/cosmetic approval are still required.
- Safe ad delivery remains subject to consent, cooldown, filled inventory and nonintrusive natural breaks. Failed/no-fill ads do not interrupt verified reading, comments, P0 completion or any existing entitlement.

## 7. Weekly Performance (the small avatar 2 o'clock class)

Score is derived from **verified, claimed, eligible, distinct days** rather than raw spam volume. The Manila week starts Monday 00:00. One daily category receipt maximum for score; `pending` / non-claimed / reactions / basic comment taps do not count.

| Dimension | Formula | Maximum score |
|---|---|---:|
| Active days | 5 × 7 days | 35 |
| Learning days | 6 × 5 days | 30 |
| Community impact days | 7 × 5 days | 35 |
| Quality creator days | 6 × 5 days | 30 |
| TOTAL | Capped at 100 | 100 |

| Tier | Minimum score | Active days | Distinct category types | Highest weekly reward preview |
|---|---:|---:|---:|---|
| Unrated | 0 | 0 | 0 | none |
| Emerging | 1 | 1 | 1 | class only |
| Active | 25 | 2 | 1 | weekly emblem |
| Thrive | 60 | 3 | 2 | cosmetic frame |
| Exceptional | 85 | 4 | 2 | weekly collectible |

One highest-class cosmetic grant per **closed week** only; no multiple payouts for traversing tiers. Existing Circle Rank badge remains at **10 o'clock**, weekly icon replaces small N at **2 o'clock**, blue verified-online dot at **6 o'clock**, and private Connect Note display must not be erased. Weekly performance does **not** deduct permanent BP/QMP or Character levels.

## 8. 1,300 Character items — exact prerequisite by slot

13 Characters × 20 level/stages × 5 items = **1,300 catalog entries**. Artwork availability is not ownership. Special Characters have server-verified Circle Rank gate. All new S2 mastery claims are additional to legacy ownership; old owned items must never be relocked.

| Slot | Prerequisite | Utility |
|---|---|---|
| I1 | Correct selected Character, canonical level and special-rank eligibility | Character gallery/stage memento |
| I2 | Unique qualifying verified learning receipt, not previously consumed | Learning mastery collectible |
| I3 | Unique verified real community contribution, nonself and moderated | Community impact collectible |
| I4 | Unique claimed weekly P0 Foundation badge/receipt | Weekly balance prestige |
| I5 | Existing server-certified I1, I2, I3 and I4 at same Character + stage | Five-item stage mastery display |

All item unlocks need user-facing **How to Get**, **Why It Matters**, exact missing prerequisites, Claim/Owned/Equipped states, and persisted per-Character equipped items. No legitimate purchased or earned inventory is silently expired at season rollover. Kingdom consumes Character-owned receipts without creating a second XP/ownership authority.

## 9. KL reading: FINAL approved future Season 2 formula (supercedes fixed +15)

- Chapter n = **5 + n BP**, chapter 1 +6, chapter 5 +10, chapter 30 +35.
- On verified Chapter n, that Chapter BP stays **Pending** and is credited **only when Chapter n+1 is independently verified**. Chapter 30 waits for Chapter 1 of the following series. Do not show a pending amount as credited.
- Unlock any next chapter only when **all previous chapters are verified**, including published prerequisite sequence; Chapter 1 of next series needs all 30 of previous.
- Real answer/quiz verification required; **no minimum reading-time timer** under latest approved Season 2 rule. Passage-based questions, retries, transparent result and automatic approval when rubric passes; never a human-review queue.
- Up to one valid **>=20-character** chapter discussion/reflection comment per member per chapter earns **+5 BP** independently of delayed reading credit.
- The full 30-chapter series awards **+50 BP** only after all chapters and a **genuine >=50-character** personal series reflection about what was learned, related or understood about human life and self. No forced public spiritual disclosure.
- Chapter illustration/photo remains optional for author progression, not required.
- Sum of 30 chapter formula awards = **615 BP** (last +35 pending until next series Chapter 1). Plus **50 BP** series completion and optionally up to **150 BP** total for 30 individually eligible comments: **815 BP potential** after all conditions and deferred credit. No backpay/retro rewrite of S1.
- Relevant AdMob: optional inline banner below discussion, interstitial at natural chapter approval break if consent/cooldown/fill permits; no blocking reading, verification, unlocking or reward when ads are unavailable; protect children and existing navigation performance.

## 10. Foundation, optional Momentum, deadlines and deductions

**Foundation P0** is ONE distinct verified learning receipt AND ONE different verified social contribution each weekly period. P1 Growth and P2 Cosmetic/Bonus quests may use additional evidence. P0 failure restricts only **optional Season 2 milestone bonus**; it does NOT block normal BP, QMP, posts, comments, basic lessons, Bible, Connect, attendance, prayer, cash or safety features.

- Normal period **7 days**; automatic grace **3 days**. There are **2 opt-in Flex Credits per season**, each **7 additional days**, allocated before the original weekly deadline; member must see deadlines in Asia/Manila.
- Source unavailable, weak network, valid queued offline event, outage, privacy/age exception, illness/legitimate absence must not create a negative permanent consequence. Offline late sync requires server event-time reconciliation.
- Optional Momentum is currently **OFF** and economic deductions are **NOT FINAL APPROVED**: +5 for a server-verified active day; first 2 missed days grace; after grace −5 inactive, −2 missed applicable reading, −2 missed applicable creator obligation, bounded at −9/day and floor 0.
- Never deduct lifetime BP, QMP, actual money, bought items, permanent badges, per-Character XP, membership, safety access or account for optional inactivity. Missed voluntary mission bonus is not a debt; fraud reversal requires real source evidence, audit and appeal.

## 11. Referral, finance, withdrawal, benefits and other deductions

- **Approved Season 2 referral target:** +20 BP to referrer only on one independently verified post-invite Circle Rank improvement by a genuine referred member actively in a Cluster; once per qualified referred person. Referred member target +10 BP on its separately verified eligibility. Fake/ineligible/duplicate/pending referrals receive 0.
- **Live legacy conflict:** existing rank bonus catalog still +10 BP. Resolve forward-only in isolated Season 2 activation, never double-grant or overwrite Season 1 history.
- Cash referral program is separate from BP referral and from QMP. No automatic conversion of token/achievement to cash.
- QMP allocation uses the designated **30% eligible funded user pool**, current month provisional, last month finalized only when finance is active. No manual QMP review for routine qualified events. Maintain full historical records of withdrawn/available monthly balances.
- Withdraw only funded finalized available balance meeting **₱200 minimum** after required approval; independently government-ID-verified legal name, approved membership and matching payout beneficiary. Alias cannot serve as verified legal identity. No early cash from preliminary AdMob numbers.
- Optional money spent on eligible purchases/contributions is not an arbitrary BP penalty. Cash withdrawals debit only available authorized cash. BP redemption affects available/redeemable balance rather than erasing lifetime achievements.
- Cluster funding manual member 5% and organization 7% remains separate from individual withdrawable money and requires proper treasurer/record authorization before any automation.

## 12. Fraud/anti-farming and integrity checklist

1. actor/user and source ID server verified
2. source unique across rule upgrades
3. moderation current state
4. no self-response/reaction farming
5. source not reused for two claims
6. cross-account RLS and scope membership check
7. bounded and explicit daily/monthly caps
8. offline outbox same operation ID
9. no reward for fake attendance, referrals or generated spam
10. fraud reversal with immutable audit and appeal

Additional must-pass tests: two devices submitting same source, account switch, deleted/moderated content, replay over version upgrades, EAS OTA stale app, invalid/referrer farm, fake QR attendance, failure then resend, offscreen ad lifecycle, large-Cluster scope, conflicting simultaneous token purchase, duplicate weekly badges and bad source claim reversal.

## 13. Exact Season 2 readiness gates — none auto-satisfied by this contract

| Gate | Required outcome | Current evidence/state |
|---|---|---|
| `approved_ten_scope_unchanged` | Owner exact 1-10 allowlist; no unauthorized 11th reward exclusive | **SOURCE_VERIFIED — OPEN** |
| `season1_live_baseline_snapshotted` | Preserve exact S1 BP/QMP ledger, financial triggers, installed runtime | **READ_ONLY_CHECKED — OPEN** |
| `dec6_embargo_and_signed_approval` | No auto-open on Dec6; SHA-specific owner approval + runtime EAS manifest | **HOLD — OPEN** |
| `signed_season1_archive` | Validate S1 final period, pending credits, signed evidence and appeal/reconciliation | **BLOCKED — OPEN** |
| `independent_staging_backend` | Prove distinct BUKLOD MAIN staging database, never use connected production-like Connect database by assumption | **BLOCKED — OPEN** |
| `s2_rls_and_service_grants` | Private schema, RLS denied anon/auth; no service secrets in app; restricted RPCs | **NOT_VERIFIED — OPEN** |
| `s2_source_validation` | Original immutable source, actor, membership, moderation, cross-scope, real event timestamp | **NOT_VERIFIED — OPEN** |
| `s2_receipts_replay_concurrency` | Exactly once per immutable source over rule upgrades; concurrent devices and retries | **DEV_SOURCE_ONLY — OPEN** |
| `s2_wallet_atomic_spend` | No negative balance, no double spend, noncash, no transfers, atomic item grant and refund | **NOT_VERIFIED — OPEN** |
| `kl_chapter_chain_and_rewards` | Sequential quiz gate, delayed chapter BP, 20-char comment, 50-char final reflection, next-series carry | **DEV_PR_ONLY — OPEN** |
| `referral_20_vs_10_policy_reconciled` | Owner-approved 20 target without S1 10 mutation/double-credit; referred 10 independently verified | **CONFLICT_OPEN — OPEN** |
| `character_inventory_mastery` | Mastery vs existing Character ownership, switch persistence, special gates, server equip | **DEV_PREVIEW_ONLY — OPEN** |
| `weekly_classification_actual_backend` | No client authority, closed-week verified claimed evidence, score/tier boundaries | **DEV_PR_ONLY — OPEN** |
| `awards_hall_of_fame_and_rollover` | Four server-backed seasonal grants, historical archive and no destructive season reset | **NOT_VERIFIED — OPEN** |
| `co_op_and_mode_parity` | No compulsory faith, real nonfaith alternatives and solo paths, no farming | **NOT_VERIFIED — OPEN** |
| `offline_outbox_end_to_end` | Durable operation IDs, replay/dedupe, pending visibility, account isolation, outage grace | **PURE_SOURCE_ONLY — OPEN** |
| `momentum_optional_safe_settlement` | Opt-in, grace, excused days, no BP/QMP/item/cash effects, no child pressure | **PREVIEW_ONLY — OPEN** |
| `ads_and_ui_regression` | AdMob first view/fill, native video offscreen lifecycle, instant tabs, safe area, low data mode | **NOT_VERIFIED — OPEN** |
| `privacy_moderation_security` | Child protections, prayer privacy, ID-only cash withdrawal, RLS, fraud reversal audit/appeal | **NOT_VERIFIED — OPEN** |
| `runtime_rc_and_full_stage_readback` | Exact staging package, EAS update ID, Hermes/runtime, source sha, installed test or separately waived device with remaining gate | **NOT_VERIFIED — OPEN** |
| `economy_rates_and_expiry_owner_signoff` | Resolve preview token prices, Momentum deductions, valid expiry/carryover and full Season2 award terms | **AWAITING_FINAL_SIGNOFF — OPEN** |
| `financial_qmp_monthly_reconciliation` | Keep monthly 30% eligible pool, finalized vs provisional, strict payout KYC and accounting | **READ_ONLY_CHECKED — OPEN** |

**Final release rule:** A green static contract test is never evidence of on-device AdMob first-view, navigation speed, external financial funding, production backend RLS or exact OTA served artifact. The closed Season 1 results and distinct staging project must be verified; any production Season 2 source before Dec 6 is embargoed. On Dec 6 itself there is no automatic deployment or toggle—owner must approve exact SHA and all verified gates; otherwise HOLD.

## 14. Preparation implementation inventory

Prepared in a **separate DEV branch**, not merged into main/staging: 

- Authoritative typed-data-compatible manifest: `contracts/season2-dec6-complete-reward-inventory-20261119.json` (10 exclusives, active/inactive S1 reward catalog, QMP, 1,300 item gates, reward formulas, limitations, 22 gates).
- Read-only fail-closed checker: `scripts/season2-dec6-economy-audit.cjs`; command `node scripts/season2-dec6-economy-audit.cjs` reports HOLD and all pending gates. Use `--require-ready` only in a release review; it must exit nonzero while gates remain open.
- Focused tests: `node --test tests/season2-dec6-complete-reward-inventory-20261119.test.cjs` guards exact 10, Season 1 isolation, KL math/escrow, token caps, deductions and version drift.
- Related incomplete source PRs are deliberately not merged as unverified complete: [KL deferred chapter rewards PR #973](https://github.com/faust-0612/BUKLOD-Rork/pull/973), [weekly Performance PR #965](https://github.com/faust-0612/BUKLOD-Rork/pull/965), [Daily Proverbs PR #995](https://github.com/faust-0612/BUKLOD-Rork/pull/995).

**Outstanding engineering work:** apply isolated database candidates only in verified dedicated staging, finish end-to-end adapters for all ten, implement true offline mobile transport and signed rollover, perform SQL/RLS/concurrency + RC/AdMob/nav checks, reconcile exact S1/QMP/referral and owner-decided economy values, and only then create signed owner authorization for the correct final SHA.

**Current status:** PARTIALLY PREPARED / PRODUCTION HOLD. The contract is a source-of-truth implementation checklist, not proof that December 6 features already exist or that launch is guaranteed.

## 15. Specific in-app member guide integrated for staging review (not live)

Source additions (DEV-only):

- `src/lib/season2/buklodSeason2MemberRewardMatrixR1.ts` holds the dated exact 46 active and 16 inactive BP catalog snapshots, clear caveats on server-side award triggers, QMP event/mission rates and five monthly classification bands (Starter 0-24, Active 25-74, Contributor 75-149, Builder 150-299, Community Champion 300+).
- `src/components/points/BuklodS2CompleteRewardsReference.tsx` is a **collapsed, searchable** read-only member reference. The four accessible tabs are BP / QMP / SEASON 2 / CARRYOVER. BP group selectors let the member find exact rates/daily caps; admin-only configuration stays out of public listings. All controls change only local presentation state; no extra backend fetch or reward grant.
- The existing `BuklodSeasonJourneyPreview` renders this guide only after the parent Season Journey is opened, preserving first paint, video/ad lifecycle and instant tab navigation.
- Separate section distinguishes **unverified social milestone proposals** (helpful-comment reaction tiers: 3 distinct -> +2 BP, 10 -> +5 BP total, 25 -> +10 BP total; three-member support chain -> +3 BP/qualified participant) from active catalog entries. These must not award any BP until the real corresponding server trigger/rollout is independently verified.
- Optional rewarded-ad energy UI (example +1 Garden Energy) is distinct from BP/QMP/cash/Journey Tokens; the ad earned-event alone is not a permitted new money/points grant.
- Approved separate daily Proverbs reading content now has an **915-day KJV Proverbs verse rotation**, not only a 31-verse reset. This is read-only Show Faith Community content and not an 11th Season2 reward area.
- The live-read-only 2026-11-19 check confirmed Season1 end_date 2026-10-31 is **still active and not closed**; KL quiz enforcement FALSE; isolated `buklod_s2` schema absent; QMP financial finalization disabled. These are independently verified concrete launch blockers.
- Focused in-app guide regression: `tests/season2-member-rewards-full-reference-20261119.test.cjs`, release hold regression: `tests/season2-dec6-rewards-release-hold-20261119.test.cjs`, and corrected protected-feature fixture for approved later Connect source.
- New scope includes an exact-feature review proposal: `contracts/season2-proposals/complete-member-reward-guide-20261119.json`; no new exclusive ID, backend rewards or production release authorization.

The above is **member documentation and DEV source integration**, not a claim that any Season 2 reward, balance, item or payout is activated. The December 6 launch still requires a dedicated verified staging Supabase backend, signed Season1 reconciliation, complete independent financial/KL/referral tests, exact Android RC/AdMob/navigation evidence and owner SHA-bound approval.


## 16. Exact all-item and all-badge catalog

The complete named catalogue is in `docs/season2/BUKLOD_ALL_1300_ITEMS_469_BADGES_40_RANKS_20261119.md`, generated from canonical Character source: **1,300 individually named items**, **469 exact badge titles**, **40 Circle Rank visual classes**, **8 Special Character Circle Rank gates**, **4 priced Kingdom Shard items**. All are now accessible through the expandable Season Journey -> full rewards guide -> Items/Badges tab. This is **read-only** and respects original Character levels, ownership, ranks, badge art, AdMob performance and Season 1 economy. The addition is not a claim of live Season 2 grants.

## 17. All 46 configured BP rules — exact member qualification notes

**Read-only legacy configuration snapshot — not automatic cash nor proof that every source trigger is currently functional.** The table below includes the two restricted admin-only entries so that the complete source inventory is auditable; public member UI hides them. An absent daily cap in the catalog means **no catalog cap reported**, not infinite farming permission. Server rules may enforce stricter eligibility. All Season 2 source changes are forward-only.

| Exact activity source | BP/event | Catalog daily BP cap | Requirement before credit |
|---|---:|---:|---|
| `abc_growth_lesson` | 8 | Not configured | Tapusin ang 1 tunay at verified ABC Growth lesson; no repeat credit for the same lesson. |
| `achievement_bible_scholar` | 100 | 100 | Milestone: 28 verified ABC lessons, supporting records, application/evidence verification. +100 BP once eligible. |
| `achievement_community_builder` | 150 | 150 | Milestone: real, documented community project with beneficiaries and independently verified evidence. +150 BP. |
| `achievement_faithful_mentor` | 200 | 200 | Milestone: 4 approved teaching sessions with real mentor/mentee records and supporting evidence. +200 BP. |
| `achievement_kingdom_champion` | 250 | 250 | Milestone: 20 recorded Kingdom levels PLUS independent event verification; client score alone cannot award. +250 BP. |
| `admin_bonus` | 0 | Not configured | Admin-controlled only. No public self-claim or automatic +BP. |
| `admin_manual_award` | 0 | Not configured | Restricted, audited administrative grant only. Default +0, not a member action. |
| `bible_arena_monthly` | 15 | Not configured | Valid verified eligible monthly Bible Arena activity/event; source-controlled, not automatic for opening. |
| `bible_flash_easy` | 1 | Not configured | Passed/accepted verified Bible Flash Easy event; server validates source. |
| `bible_flash_medium` | 3 | Not configured | Passed/accepted verified Bible Flash Medium event; server validates source. |
| `bible_flash_hard` | 6 | Not configured | Passed/accepted verified Bible Flash Hard event; server validates source. |
| `bible_quiz_easy` | 3 | 3 | Five questions, passing threshold 4/5, one legitimate daily qualified attempt/account (Manila date). |
| `bible_quiz_medium` | 6 | 6 | Five questions, passing threshold 4/5, one legitimate daily qualified attempt/account (Manila date). |
| `bible_quiz_hard` | 12 | 12 | Five questions, passing threshold 4/5, one legitimate daily qualified attempt/account (Manila date). |
| `community_chain_resolve` | 1 | 3 | Server-verified meaningful support-chain completion with distinct qualified members; catalog cap 3 BP/day. Related +3 BP three-member proposal is NOT confirmed live. |
| `community_challenge_complete` | 2 | 6 | Complete an eligible accepted community challenge; source and duplicate protection, up to 6 BP/day catalog cap. |
| `community_comment` | 2 | Not configured | Real accepted community comment by member, no self-farming or repeat replay; no second credit on edit. |
| `community_dugtong` | 1 | 8 | Valid original approved Today/Dugtong response; catalog cap 8 BP/day. |
| `community_helpful_dugtong` | 2 | 6 | Distinct verified helpful Dugtong response; catalog cap 6 BP/day. |
| `community_poll_vote` | 1 | 5 | One valid member-owned poll vote per eligible poll; catalog cap 5 BP/day. |
| `community_post` | 5 | Not configured | One genuine originally published and moderated Wall post; rejected/deleted/spam posts excluded. |
| `community_reaction` | 1 | Not configured | One genuine reaction to eligible content; do not farm self-reactions, bots or repeats. |
| `community_resource_used` | 1 | 5 | Server-confirmed eligible community resource usage, not merely opening screen; cap 5 BP/day. |
| `community_takeaway_share` | 1 | 2 | Server-verified substantive community takeaway share; cap 2 BP/day. |
| `daily_bible` | 10 | Not configured | Real completed verified Daily Bible participation; opening reader alone is not proof. |
| `daily_bible_verification` | 2 | Not configured | Distinct server-approved Bible verification event, not a second grant from the same unqualified source. |
| `devotional` | 12 | Not configured | Complete and verify eligible devotional entry; not rewarded merely for viewing. |
| `event_attendance` | 10 | Not configured | Check-in only for an actual scheduled live event with recorded date/location; +10 BP when independently verified. |
| `formation_lesson` | 25 | Not configured | Complete eligible approved Formation lesson and required evidence; one award per distinct lesson. |
| `game_first_qualified` | 2 | Not configured | First independently verified eligible game achievement only; scores alone do not count. |
| `game_tournament_champion` | 100 | 100 | Independently verified real tournament championship; cap 100 BP/day catalog. |
| `learning_progress_verification` | 5 | Not configured | Submitted lesson/reading progress approved from independent server evidence; duplicate submissions excluded. |
| `mentor_session` | 15 | Not configured | Registered mentor, actual mentees, teaching notes/date/place, proper evidence/consent and validated session. No self-report credit. |
| `mentoring_release` | 20 | Not configured | Genuine approved mentoring or lesson-release milestone distinct from the mentor-session receipt. |
| `ministry_activity` | 15 | Not configured | Real documented and verified ministry/service activity by member; no forged participation. |
| `ministry_major_milestone` | 100 | 100 | Documented major ministry achievement including date, participants and independent supporting proof; cap 100 BP/day. |
| `prayer_response` | 2 | Not configured | Only a legitimate voluntary qualifying response; never score private prayer sincerity, text or beliefs. |
| `referral_rank_bonus` | 10 | Not configured | Legacy +10 BP configured; independent rank gain evidence required. New S2 +20 BP referrer is isolated target, NOT live, no double grant. |
| `reflection_quality_bonus` | 5 | Not configured | Genuine original, approved substantive reflection according to its source rubric; duplicate templates excluded. |
| `scope_attendance` | 10 | Not configured | Actual open/live Cluster/scope event with validated attendance; no fake or duplicate check-in. |
| `stage_completion` | 75 | Not configured | Verified completion of an entire assigned formation stage, not each opened lesson. |
| `verified_giving_participation` | 5 | Not configured | Independently verified voluntary participation, not donation amount; protect financial privacy and no paid reward multiplier. |
| `verified_volunteer_service` | 20 | 20 | Validated real volunteer service with documented evidence; cap 20 BP/day. |
| `weekly_consistency` | 20 | Not configured | Verified qualifying weekly pattern under applicable server rule; not one-time tab opening. |
| `weekly_tip_dugtong` | 2 | 2 | Accepted meaningful Dugtong response to official Weekly Tip; cap 2 BP/day. |
| `weekly_tip_reaction` | 1 | 1 | Distinct real approved reaction to an official Weekly Tip; cap 1 BP/day. |

### Important award classification

- **Configured legacy BP:** Current active catalog amount with required real source evidence; do not assume exact event trigger status from catalog alone.
- **Legacy inactive rule:** Historical placeholder catalog entry, no automatic duplicate new grant. Some live rewards use separate canonical RPCs (notably KL), so this catalog is not the entire backend settlement proof.
- **Pending new Season 2 BP:** KL `5 + chapter number`, pending until next verified chapter; +5 per eligible chapter comment; +50 for verified series + genuine final reflection; +20 rank-qualified referrer and +10 independently qualified referred member (separate target). These are **not live**.
- **Proposed but unverified bonuses:** Three/five/ten BP helpful-comment reaction thresholds and +3 mutual-support chain proposal require independent event-source and server activation proof; never advertise as claimable yet.
- **Disabled/noncash:** Journey Tokens, seasonal cosmetic awards, 469 badge names and 1,300 item art cannot mint or redeem cash/BP just by being displayed.

The existing `src/components/points/BuklodPointsR2Guide.tsx` describes source-specific milestones: Bible Scholar needs 28 verified ABC lessons, Faithful Mentor needs 4 approved mentoring sessions, and Kingdom Champion needs 20 recorded Kingdom levels plus independent proof. These are the **configured eligibility descriptions**, not evidence that the backend has granted every claim. Community Builder requires a genuine documented project and beneficiary evidence.

## 18. Kingdom Shards — exact verified earn and spend guide (separate from Season 2 Tokens)

Read-only inspection on November 19 found `private.buklod_kingdom_sync_shards_v1(uuid)` and the canonical wallet/source tables installed in connected BUKLOD MAIN. The existing SQL source verifies the following game-only grants, while user-specific eligibility and purchase status must still be read from their own authenticated server account:

| Kingdom earning event | Shards | Requirement | Repeat limit |
|---|---:|---|---|
| First independently verified Kingdom game mastery | +1 Shard | Credited mastery attempt, with matching official `game_first_qualified` **+2 BP** in immutable points ledger for the same `game_id`; no client score substitutes | One per `game_id` source key |
| Redeemed existing canonical Character collectible | +2 Shards | Server-owned Character collectible record with non-null `redeemed_at`; not just artwork or unredeemed preview | One per distinct `collectible_id` source key |

| Permanent Kingdom power | Shard price | Purpose |
|---|---:|---|
| Wisdom Lens | 2 | Practice-answer hint |
| Guardian Shield | 3 | Protection on a retrying practice challenge |
| Explorer Compass | 2 | Remove two wrong practice answers |
| Emerald Aura | 10 | Permanent practice-hero visual glow |

The Kingdom Shard wallet conserves `earned - spent = balance`, prevents negative balances, and uses server-source uniqueness. Shards do **not** convert to Journey Tokens, BP, QMP, cash, payout, or other characters' XP. Season 2 cooperative quest rewards and new collectible mastery grants remain separately **DISABLED**, even though this legacy Kingdom source exists.

## 19. Proposed full badge-category eligibility for all 469 catalog titles

The exact proposed conditions for 13 signature, 260 Stage Mastery, 65 Era Mastery, 13 Character Mastery, 52 Journey, 58 starter, and 8 shared Series/World badges appear under Section J in the complete item/badge catalogue. The UI lets a member select the Character and badge category to see its specific stage, era, halfway/complete journey, special rank and server receipt requirements. **Status is PROPOSED / NOT LIVE**; neither artwork nor preview generates a badge or BP. Formal grants and final criteria require the isolated backend and owner release approval.



---

# PART II — Full catalogue of 1,300 items, 469 badges and 40 ranks

**Exact names from the generated canonical Character catalog, November 19, 2026.**

**STATUS — FULL SOURCE CATALOG, NOT AUTOMATICALLY OWNED OR CLAIMABLE.** This is a review/education document for the Season 2 December 6 target. All Season 2 item/badge grants are disabled pending isolated backend RLS, canonical Character authority, idempotent claim receipts and RC/owner release approval. Existing historically owned items and badges remain protected.

## How to read this catalog

- **1,300 collectible item names**: 13 Characters × 20 stages × 5 items. Every item is shown by its exact catalog name, not an invented generic token.
- **Five item slots per level**: I1 Origin/Memory, I2 Learning/Growth, I3 Practical Tool, I4 Milestone Object, I5 Legacy Object. Proposed Season 2 mastery requires selected Character, qualifying canonical stage/level, unique verified learning for I2, unique authentic community participation for I3, claimed weekly Foundation receipt for I4, and server-certified I1–I4 for I5; Special Characters require rank gates. Not every item literally works as a gameplay tool.
- **469 badge titles**: signature (13), stage mastery (260), era mastery (65), Character mastery (13), journey (52), starter packs (58), shared series (8). A catalog title does not prove an earning trigger or ownership.
- **40 Circle Rank visual classes**: eight families × V/IV/III/II/I; distinct from the 469 Character badge titles and from four Season 2 proposed seasonal awards. They do not automatically multiply BP or QMP.
- **Credit vs artwork**: art asset ≠ earned certificate; an existing Season 1 item is not relocked by a newly proposed Season 2 mastery system. Qualified source receipts may not be reused for multiple item claims; only an authenticated backend can mint/equip.
- **Full economy matrix**: See `BUKLOD_DEC6_ALL_POINTS_REWARDS_REQUIREMENTS_DEDUCTIONS_20261119.md` for legacy BP/QMP, Journey Tokens, seasonal awards, KL, referrals and money rules.

## A. Every named collectible item — Character × level × slots

| Character | Level | Stage | I1 • Origin/Memory | I2 • Learning/Growth | I3 • Practical Tool | I4 • Milestone Object | I5 • Master/Legacy |
|---|---:|---|---|---|---|---|---|
| Phan | 1 | Farmer | Heirloom Rice Seed Pouch | Farmer's Field Notebook | Hand-Forged Farm Hoe | First Harvest Rice Basket | Family Seed Chest |
| Phan | 2 | Fisherman | Riverbank Shell Keepsake | Tide Chart Study Pad | Handwoven Fishing Net | First Catch Wicker Creel | Fisherman Heritage Tackle Chest |
| Phan | 3 | Student | School ID Lanyard | Student Lecture Binder | Student Study Lamp | Passing Grade Certificate Frame | Student Memory Trunk |
| Phan | 4 | Worker | First Payday Envelope | Worker Skills Manual | Worker Tool Belt | First Completed Work Order | Worker Craft Chest |
| Phan | 5 | Service | Service Shift Pin | Service Playbook | Service Clipboard | Service Excellence Token | Service Legacy Crate |
| Phan | 6 | College | College Acceptance Letter | College Course Planner | College Lab Calculator | College Midterm Honor Ribbon | College Alumni Chest |
| Phan | 7 | Intern | Intern Desk Nameplate | Intern Mentorship Journal | Intern Badge Scanner | Intern Project Milestone Cup | Intern Growth Keepsake Box |
| Phan | 8 | First Job | First Job Time Card | First Job Training Log | First Job Desk Organizer | First Salary Milestone Coin | First Job Memory Trunk |
| Phan | 9 | Professional | Professional Credential Sleeve | Professional Practice Binder | Professional Briefcase | Professional License Folio | Professional Legacy Case |
| Phan | 10 | Team Lead | Team Lead Briefcase Tag | Leadership Field Notes | Team Lead Whiteboard Marker Set | Team Lead Promotion Pin | Team Lead Mentorship Chest |
| Phan | 11 | Manager | Manager Office Keyring | Manager Strategy Notebook | Manager Scheduling Tablet | Manager Quarter Win Trophy | Manager Legacy Cabinet |
| Phan | 12 | Entrepreneur | Entrepreneur Pitch Folder | Entrepreneur Market Journal | Entrepreneur Pitch Clicker | Entrepreneur First Client Contract | Entrepreneur Foundation Chest |
| Phan | 13 | Business Owner | Business Owner Seal Stamp | Owner Operations Manual | Owner Inventory Scanner | Owner Storefront Key | Owner Heritage Strongbox |
| Phan | 14 | Investor | Investor Portfolio Sleeve | Investor Research Folio | Investor Analysis Stylus | Investor First Return Seal | Investor Legacy Vault |
| Phan | 15 | Philanthropist | Philanthropy Dedication Plaque | Giving Impact Journal | Charity Grant Quill Set | Philanthropy Grant Award | Philanthropist Giving Chest |
| Phan | 16 | Influencer | Influencer Studio Mic Flag | Content Craft Workbook | Creator Ring Light Stand | Influencer Reach Milestone Medal | Influencer Archive Chest |
| Phan | 17 | Industry Leader | Industry Gavel Token | Industry Briefing Dossier | Industry Conference Badge Reel | Industry Summit Invitation | Industry Legacy Reliquary |
| Phan | 18 | Visionary | Visionary Blueprint Tube | Vision Roadmap Atlas | Visionary Planning Compass | Visionary Breakthrough Banner | Visionary Horizon Chest |
| Phan | 19 | Executive | Executive Corner Desk Clock | Executive Decision Journal | Executive Fountain Pen | Executive Year Seal | Executive Heritage Vault |
| Phan | 20 | CEO | CEO Legacy Ledger Chest | CEO Stewardship Codex | CEO Boardroom Gavel | CEO Legacy Crown Crest | CEO Dynasty Legacy Chest |
| Quin | 1 | Innocent | Childhood Ribbon Keepsake | Innocent Daydream Sketchbook | First Camera Toy Viewfinder | First Village Fair Ribbon | Childhood Memory Suitcase |
| Quin | 2 | Province Girl | Province Home Photo Locket | Province Dialect Phrasebook | Province Handwoven Map Pouch | Province Debut Photo Frame | Province Heritage Travel Chest |
| Quin | 3 | Student | Campus ID Charm | Student Travel Atlas | Student Compact Camera | Student Field Trip Pass | Student Journey Trunk |
| Quin | 4 | Youth Helper | Youth Helper Friendship Band | Youth Helper Activity Log | Youth Helper Megaphone | Youth Helper Appreciation Medal | Youth Helper Tip Jar Chest |
| Quin | 5 | Volunteer | Volunteer Event Wristband | Volunteer Service Journal | Volunteer Sign-In Clipboard | Volunteer Hours Milestone Pin | Volunteer Legacy Crate |
| Quin | 6 | College Girl | College Dorm Key Charm | College Culture Notebook | College Trip Backpack | College Exchange Acceptance | College Wanderlust Chest |
| Quin | 7 | Explorer | Explorer Trail Ticket Stub | Explorer Field Guide | Explorer Hiking Compass | Explorer Summit Stamp | Explorer Relic Trunk |
| Quin | 8 | Travel Enthusiast | Travel Postcard Bundle | Travel Enthusiast Itinerary Book | Travel Enthusiast DSLR Strap | Travel Enthusiast Country Stamp Book | Travel Enthusiast Keepsake Chest |
| Quin | 9 | Tourism Advocate | Tourism Advocacy Pin | Tourism Briefing Folio | Tourism Advocate Mic Flag | Tourism Advocate Campaign Award | Tourism Advocacy Archive |
| Quin | 10 | Travel Planner | Planner Destination Stamp Card | Travel Planner Master Book | Travel Planner Route Stylus | Planner First Full Itinerary Seal | Planner Legacy Atlas Chest |
| Quin | 11 | Team Leader | Team Leader Tour Badge | Team Leader Ops Journal | Team Leader Tour Radio | Team Leader Tour Success Banner | Team Leader Tour Legacy Case |
| Quin | 12 | Project Manager | Project Roadmap Bookmark | Project Manager Timeline Pad | Project Manager Gantt Board | Project Manager Delivery Trophy | Project Manager Portfolio Vault |
| Quin | 13 | Content Creator | Creator Content Clapper | Content Creator Shot List | Content Creator Gimbal | Creator Viral Moment Plaque | Creator Archive Hard Drive Chest |
| Quin | 14 | Tour Operator | Tour Operator Route Token | Tour Operator Manual | Tour Operator Ticket Punch | Tour Operator License Folio | Tour Operator Route Archive |
| Quin | 15 | Business Founder | Founder Business Card Case | Founder Business Playbook | Founder Pitch Tablet | Founder Incorporation Seal | Founder Vision Strongbox |
| Quin | 16 | Tourism Entrepreneur | Tourism Venture Passport Sleeve | Tourism Entrepreneur Ledger | Tourism Venture Booking Terminal | Tourism Entrepreneur Grand Opening Key | Tourism Empire Founders Chest |
| Quin | 17 | Resort Owner | Resort Guest Welcome Key | Resort Owner Guest Handbook | Resort Owner Concierge Tablet | Resort Owner Five-Star Pennant | Resort Heritage Guest Chest |
| Quin | 18 | Brand Leader | Brand Signature Scarf | Brand Leader Style Guide | Brand Leader Campaign Light | Brand Leader Signature Campaign Cup | Brand Legacy Showcase Case |
| Quin | 19 | Industry Influencer | Industry Spotlight Locket | Industry Influencer Media Kit | Industry Influencer Softbox | Industry Influencer Keynote Invitation | Industry Influencer Hall Chest |
| Quin | 20 | Tourism Business Owner | Tourism Empire Memory Chest | Tourism Owner Strategy Codex | Tourism Empire Command Desk | Tourism Empire Legacy Passport | Tourism Dynasty Legacy Chest |
| Van | 1 | Innocent | Childhood Joy Cross Charm | Joyful Prayer Notebook | Joy Tambourine | First Joy Service Ribbon | Joy Memory Keepsake Box |
| Van | 2 | Young Boy | Young Boy Church Pew Bookmark | Young Boy Bible Story Pad | Young Boy Wooden Cross | Young Boy Dedication Certificate | Young Boy Faith Chest |
| Van | 3 | Student | Student Chapel ID | Student Devotion Journal | Student Pocket Bible | Student Chapel Award | Student Chapel Trunk |
| Van | 4 | Altar Boy | Altar Boy Vestment Pin | Altar Boy Liturgy Guide | Altar Boy Candle Snuffer | Altar Boy First Serving Medal | Altar Boy Vestment Chest |
| Van | 5 | Youth Helper | Youth Helper Friendship Cross | Youth Helper Mentorship Log | Youth Helper Activity Bag | Youth Helper Appreciation Badge | Youth Helper Legacy Crate |
| Van | 6 | College | College Fellowship Card | College Theology Notes | College Chapel Hymnal | College Ministry Scholarship Seal | College Fellowship Chest |
| Van | 7 | Church Worker | Church Worker Name Tag | Church Worker Ministry Manual | Church Worker Service Clipboard | Church Worker Faithful Service Cup | Church Worker Ministry Trunk |
| Van | 8 | Worship Leader | Worship Leader Setlist Card | Worship Leader Chord Chart Book | Worship Leader Guitar Capo | Worship Leader First Full Set Banner | Worship Leader Setlist Archive |
| Van | 9 | Community Volunteer | Community Volunteer Armband | Community Volunteer Service Log | Community Volunteer Care Kit | Community Volunteer Impact Pin | Community Volunteer Care Chest |
| Van | 10 | Ministry Worker | Ministry Worker Calling Card | Ministry Worker Discipleship Binder | Ministry Worker Counseling Pen Set | Ministry Worker Ordination Path Token | Ministry Worker Calling Chest |
| Van | 11 | Outreach Leader | Outreach Leader Field Tag | Outreach Leader Field Journal | Outreach Leader Loudhailer | Outreach Leader Campaign Banner | Outreach Leader Field Reliquary |
| Van | 12 | Bible Teacher | Bible Teacher Lesson Marker | Bible Teacher Exegesis Notebook | Bible Teacher Whiteboard Markers | Bible Teacher Class Completion Seal | Bible Teacher Lesson Archive |
| Van | 13 | Mission Trainee | Mission Trainee Passport Cross | Mission Trainee Language Book | Mission Trainee Field Pack | Mission Trainee Field Pass | Mission Trainee Journey Chest |
| Van | 14 | Field Worker | Field Worker Trail Band | Field Worker Context Notes | Field Worker Water Filter Bottle | Field Worker First Village Seal | Field Worker Trail Chest |
| Van | 15 | Missionary | Missionary Commission Letter | Missionary Culture Journal | Missionary Translation Headset | Missionary Commissioning Medallion | Missionary Heritage Strongbox |
| Van | 16 | Program Director | Program Director Seal Card | Program Director Curriculum Folio | Program Director Planning Tablet | Program Director Launch Trophy | Program Director Legacy Vault |
| Van | 17 | Training Leader | Training Leader Cohort Pin | Training Leader Facilitation Guide | Training Leader Facilitation Clicker | Training Leader Cohort Graduation Cup | Training Leader Mentorship Chest |
| Van | 18 | Mission Strategist | Mission Strategist Map Token | Mission Strategist Ops Atlas | Mission Strategist Ops Compass | Mission Strategist Blueprint Award | Mission Strategist Ops Vault |
| Van | 19 | International Missionary | International Mission Stamp | International Mission Briefing | International Mission Radio | International Mission Field Flag | International Mission Archive Chest |
| Van | 20 | Global Mission Leader | Global Mission Leader Crest | Global Mission Stewardship Codex | Global Mission Command Briefcase | Global Mission Legacy Crown | Global Mission Dynasty Chest |
| Christian | 1 | Student | Student Homeroom Pin | Student Strategy Notebook | Student Debate Timer | Student Honor Roll Frame | Student Memory Trunk |
| Christian | 2 | Class Officer | Class Officer Gavel Charm | Class Officer Agenda Binder | Class Officer Meeting Gavel | Class Officer Election Certificate | Class Officer Legacy Chest |
| Christian | 3 | Youth Leader | Youth Leader Camp Band | Youth Leader Mentorship Log | Youth Leader Facilitation Cards | Youth Leader Camp Leadership Medal | Youth Leader Mentorship Chest |
| Christian | 4 | Athlete | Athlete Team Jersey Patch | Athlete Training Playbook | Athlete Captain Whistle | Athlete Championship Ribbon | Athlete Trophy Case Chest |
| Christian | 5 | College | College Org ID Sleeve | College Governance Reader | College Org Ballot Box | College Dean List Seal | College Leadership Vault |
| Christian | 6 | Organization Head | Organization Head Seal Card | Organization Head Bylaws Folio | Organization Head Chair Mallet | Organization Head Charter Award | Organization Head Charter Chest |
| Christian | 7 | Intern | Intern Desk Badge | Intern Policy Briefing Pad | Intern Document Scanner | Intern Project Completion Cup | Intern Growth Keepsake Box |
| Christian | 8 | Professional | Professional Business Card Case | Professional Ethics Manual | Professional Briefcase | Professional License Folio | Professional Legacy Case |
| Christian | 9 | Community Volunteer | Community Volunteer Armband | Community Volunteer Impact Journal | Community Volunteer Clipboard | Community Volunteer Service Star | Community Volunteer Care Chest |
| Christian | 10 | Team Leader | Team Leader Brief Tag | Team Leader Ops Notebook | Team Leader Radio Set | Team Leader Promotion Banner | Team Leader Ops Archive |
| Christian | 11 | Public Service Staff | Public Service Staff ID Holder | Public Service Staff Handbook | Public Service Staff Form Stamp | Public Service Staff Merit Pin | Public Service Staff Heritage Case |
| Christian | 12 | Public Servant | Public Servant Oath Card | Public Servant Civic Primer | Public Servant Desk Seal | Public Servant Oath Medal | Public Servant Civic Chest |
| Christian | 13 | Government Staff | Government Staff Clearance Sleeve | Government Staff Procedure Manual | Government Staff Secure Folder | Government Staff Commendation | Government Staff Archive Vault |
| Christian | 14 | Local Leader | Local Leader Town Pin | Local Leader Town Forum Notes | Local Leader Town Hall Mic | Local Leader Town Mandate Seal | Local Leader Town Reliquary |
| Christian | 15 | Councilor | Councilor Chamber Token | Councilor Ordinance Binder | Councilor Chamber Voting Card | Councilor Resolution Award | Councilor Chamber Chest |
| Christian | 16 | Mayor | Mayor Office Key Charm | Mayor City Briefing Dossier | Mayor Office Desk Bell | Mayor Inauguration Medallion | Mayor City Legacy Strongbox |
| Christian | 17 | Provincial Leader | Provincial Leader Seal Ring | Provincial Leader Policy Atlas | Provincial Leader Briefing Tablet | Provincial Leader Governance Trophy | Provincial Leader Heritage Vault |
| Christian | 18 | Congressional Leader | Congressional Leader Floor Pass | Congressional Leader Floor Journal | Congressional Leader Floor Tablet | Congressional Leader Session Gavel Award | Congressional Leader Floor Archive |
| Christian | 19 | National Leader | National Leader Crest Pin | National Leader Strategy Codex | National Leader Secure Briefcase | National Leader Unity Banner | National Leader Unity Chest |
| Christian | 20 | Popular Politician | Popular Politician Legacy Locket | Popular Politician Legacy Memoir | Popular Politician Legacy Podium Seal | Popular Politician Legacy Crown | Popular Politician Dynasty Chest |
| Lhen | 1 | Gas Station Worker | Gas Station Name Tag | Shift Safety Notebook | Fuel Pump Key Ring | First Perfect Shift Star | First Job Memory Chest |
| Lhen | 2 | Service Crew | Service Crew Cap Pin | Service Crew Playbook | Service Crew Cleaning Caddy | Service Crew Appreciation Medal | Service Crew Legacy Crate |
| Lhen | 3 | Cashier | Cashier Drawer Key Charm | Cashier Procedure Pad | Cashier Receipt Printer Roll Set | Cashier Accuracy Award | Cashier Keepsake Box |
| Lhen | 4 | Fast Food Crew | Fast Food Crew Badge | Food Service Training Manual | Fast Food Order Tablet | Fast Food Crew Milestone Pin | Fast Food Crew Memory Trunk |
| Lhen | 5 | Sales Associate | Sales Associate Lanyard | Sales Script Journal | Sales Associate Product Scanner | Sales Associate Top Seller Cup | Sales Associate Career Chest |
| Lhen | 6 | Community Volunteer | Community Volunteer Wristband | Community Volunteer Care Log | Community Volunteer Care Kit | Community Volunteer Hours Banner | Community Volunteer Care Chest |
| Lhen | 7 | Church Youth | Church Youth Cross Charm | Church Youth Devotion Journal | Church Youth Activity Bag | Church Youth Dedication Certificate | Church Youth Faith Chest |
| Lhen | 8 | Choir Member | Choir Member Robe Pin | Choir Member Music Binder | Choir Member Pitch Pipe | Choir Member First Solo Frame | Choir Member Music Archive |
| Lhen | 9 | Bible Student | Bible Student Ribbon | Bible Student Study Notebook | Bible Student Highlighter Set | Bible Student Completion Seal | Bible Student Study Chest |
| Lhen | 10 | College Student | College Student ID Sleeve | College Course Planner | College Study Lamp | College Midterm Honor Ribbon | College Journey Trunk |
| Lhen | 11 | Sunday School Teacher | Sunday School Teacher Apple Pin | Sunday School Lesson Guide | Sunday School Craft Kit | Sunday School Class Launch Banner | Sunday School Teacher Legacy Chest |
| Lhen | 12 | Worship Leader | Worship Leader Setlist Card | Worship Leader Chord Book | Worship Leader Capo | Worship Leader Full Set Award | Worship Leader Setlist Archive |
| Lhen | 13 | Community Outreach | Community Outreach Armband | Outreach Field Journal | Outreach Loudhailer | Outreach Campaign Medal | Outreach Field Reliquary |
| Lhen | 14 | Mission Volunteer | Mission Volunteer Passport Cross | Mission Volunteer Language Pad | Mission Volunteer Field Pack | Mission Volunteer Field Pass | Mission Volunteer Heritage Strongbox |
| Lhen | 15 | Education Coordinator | Education Coordinator Seal Card | Education Coordinator Curriculum Folio | Education Coordinator Whiteboard Set | Education Coordinator Launch Trophy | Education Coordinator Curriculum Vault |
| Lhen | 16 | Trainer | Trainer Facilitation Pin | Trainer Facilitation Workbook | Trainer Clicker Pointer | Trainer Cohort Graduation Cup | Trainer Mentorship Chest |
| Lhen | 17 | Missionary-Educator | Missionary-Educator Field Tag | Missionary-Educator Culture Journal | Missionary-Educator Translation Headset | Missionary-Educator Commissioning Medal | Missionary-Educator Legacy Case |
| Lhen | 18 | Program Director | Program Director Charter Card | Program Director Ops Manual | Program Director Planning Tablet | Program Director Launch Seal | Program Director Ops Vault |
| Lhen | 19 | National Advocate | National Advocate Crest Pin | National Advocate Briefing Dossier | National Advocate Briefcase | National Advocate Keynote Invitation | National Advocate Heritage Chest |
| Lhen | 20 | Missionary-Educator Global | Global Missionary Legacy Locket | Global Educator Stewardship Codex | Global Educator Command Desk Seal | Global Educator Legacy Crown | Global Educator Dynasty Chest |
| Ace | 1 | Curious Learner | Childhood Chessboard Tile | Care Study Flashcards | Pocket First-Aid Pouch | School Helper Armband | Opening Strategy Case |
| Ace | 2 | Caring Student | Caring Student Empathy Pin | Caring Student Empathy Journal | Caring Student Care Kit | Caring Student Kindness Medal | Caring Student Memory Trunk |
| Ace | 3 | Chess Beginner | Chess Beginner King Pawn | Chess Opening Manual | Travel Chess Clock | Chess Beginner First Win Ribbon | Chess Beginner Practice Chest |
| Ace | 4 | School Helper | School Helper Duty Band | School Helper Duty Log | School Helper Clipboard | School Helper Appreciation Star | School Helper Legacy Crate |
| Ace | 5 | Youth Encourager | Youth Encourager Friendship Band | Youth Encourager Mentorship Pad | Youth Encourager Megaphone | Youth Encourager Impact Pin | Youth Encourager Keepsake Box |
| Ace | 6 | Nursing Student | Nursing Student Scrub Clip | Nursing Anatomy Notebook | Nursing Student Stethoscope | Nursing Student Clinical Pass | Nursing Student Scrub Chest |
| Ace | 7 | Chess Competitor | Chess Competitor Score Card | Chess Competitor Match Journal | Chess Competitor Magnetic Board | Chess Competitor Tournament Cup | Chess Competitor Trophy Case |
| Ace | 8 | Community Helper | Community Helper Care Band | Community Helper Care Manual | Community Helper Triage Bag | Community Helper Service Banner | Community Helper Care Chest |
| Ace | 9 | Campus Leader | Campus Leader Org Pin | Campus Leader Ops Binder | Campus Leader Radio Set | Campus Leader Election Certificate | Campus Leader Org Archive |
| Ace | 10 | Junior Nurse | Junior Nurse Cap Badge | Junior Nurse Clinical Log | Junior Nurse BP Cuff | Junior Nurse First Shift Medal | Junior Nurse Cap Chest |
| Ace | 11 | Board Passer | Board Passer License Sleeve | Board Review Master Folio | Board Exam Timer Watch | Board Passer License Frame | Board Passer License Vault |
| Ace | 12 | Staff Nurse | Staff Nurse Name Badge | Staff Nurse Protocol Handbook | Staff Nurse Med Cart Key | Staff Nurse Unit Excellence Cup | Staff Nurse Unit Reliquary |
| Ace | 13 | Wellness Advocate | Wellness Advocate Ribbon | Wellness Advocate Program Guide | Wellness Advocate Activity Tracker | Wellness Advocate Campaign Award | Wellness Advocate Program Vault |
| Ace | 14 | Chess Mentor | Chess Mentor Coach Pin | Chess Mentor Coaching Playbook | Chess Mentor Demo Board | Chess Mentor Protégé Graduation Seal | Chess Mentor Coaching Archive |
| Ace | 15 | Community Health Leader | Community Health Leader Crest | Community Health Briefing Dossier | Community Health Mobile Clinic Kit | Community Health Clinic Launch Banner | Community Health Legacy Strongbox |
| Ace | 16 | Mission Nurse | Mission Nurse Field Tag | Mission Nurse Field Primer | Mission Nurse Field Pack | Mission Nurse Field Commission | Mission Nurse Field Chest |
| Ace | 17 | Strategic Mentor | Strategic Mentor Seal Card | Strategic Mentor Decision Journal | Strategic Mentor Planning Tablet | Strategic Mentor Breakthrough Trophy | Strategic Mentor Decision Vault |
| Ace | 18 | Healing Servant Leader | Healing Servant Cross Pin | Healing Servant Leadership Codex | Healing Servant Care Briefcase | Healing Servant Leadership Medallion | Healing Servant Heritage Chest |
| Ace | 19 | Regional Health Mentor | Regional Health Mentor Medallion | Regional Health Policy Atlas | Regional Health Command Tablet | Regional Health Unity Flag | Regional Health Archive Vault |
| Ace | 20 | Legacy Care Champion | Legacy Care Champion Locket | Legacy Care Stewardship Codex | Legacy Care Champion Desk Seal | Legacy Care Crown Crest | Legacy Care Dynasty Chest |
| ELESUR | 1 | Little Learner | Little Learner Pew Bookmark | Little Learner Picture Bible | Little Learner Colored Pencil Set | Little Learner First Verse Seal | Little Learner Memory Box |
| ELESUR | 2 | Church Boy | Church Boy Cross Charm | Church Boy Catechism Pad | Church Boy Offering Basket Handle | Church Boy Dedication Certificate | Church Boy Faith Chest |
| ELESUR | 3 | Student Helper | Student Helper Name Tag | Student Helper Duty Log | Student Helper Eraser Set | Student Helper Appreciation Star | Student Helper Keepsake Crate |
| ELESUR | 4 | Youth Volunteer | Youth Volunteer Armband | Youth Volunteer Service Journal | Youth Volunteer Care Kit | Youth Volunteer Hours Medal | Youth Volunteer Care Chest |
| ELESUR | 5 | Bible Learner | Bible Learner Ribbon | Bible Learner Study Notebook | Bible Learner Highlighter Pack | Bible Learner Completion Ribbon | Bible Learner Study Trunk |
| ELESUR | 6 | Classroom Assistant | Classroom Assistant Apple Pin | Classroom Assistant Lesson Guide | Classroom Assistant Whiteboard Markers | Classroom Assistant Class Launch Banner | Classroom Assistant Lesson Archive |
| ELESUR | 7 | Farm Helper | Farm Helper Seed Pouch | Farm Helper Crop Journal | Farm Helper Hand Hoe | Farm Helper First Harvest Basket | Farm Helper Seed Chest |
| ELESUR | 8 | Community Volunteer | Community Volunteer Care Band | Community Volunteer Care Manual | Community Volunteer Clipboard | Community Volunteer Impact Pin | Community Volunteer Legacy Crate |
| ELESUR | 9 | Sunday Helper | Sunday Helper Bulletin Clip | Sunday Helper Order of Service | Sunday Helper Bulletin Folder | Sunday Helper Faithful Service Cup | Sunday Helper Bulletin Archive |
| ELESUR | 10 | Teacher-in-Service | Teacher-in-Service Chalk Pin | Teacher-in-Service Pedagogy Binder | Teacher-in-Service Lesson Pointer | Teacher-in-Service License Folio | Teacher-in-Service Pedagogy Vault |
| ELESUR | 11 | Ministry Worker | Ministry Worker Calling Card | Ministry Worker Discipleship Folio | Ministry Worker Counseling Pen Set | Ministry Worker Calling Medallion | Ministry Worker Calling Chest |
| ELESUR | 12 | Field Mentor | Field Mentor Trail Tag | Field Mentor Mentorship Log | Field Mentor Trail Compass | Field Mentor Protégé Graduation Seal | Field Mentor Mentorship Reliquary |
| ELESUR | 13 | Faith Leader | Faith Leader Seal Pin | Faith Leader Homily Journal | Faith Leader Pulpit Mic Flag | Faith Leader Congregation Banner | Faith Leader Homily Archive |
| ELESUR | 14 | Community Teacher | Community Teacher Desk Charm | Community Teacher Curriculum Atlas | Community Teacher Chalk Case | Community Teacher Cohort Trophy | Community Teacher Curriculum Vault |
| ELESUR | 15 | Pastor | Pastor Stole Clip | Pastor Pastoral Care Codex | Pastor Pastoral Visit Bag | Pastor Ordination Frame | Pastor Heritage Strongbox |
| ELESUR | 16 | Agricultural Advocate | Agricultural Advocate Crop Pin | Agricultural Advocate Soil Manual | Agricultural Advocate Seed Planter | Agricultural Advocate Harvest Award | Agricultural Advocate Crop Vault |
| ELESUR | 17 | Volunteer Coordinator | Volunteer Coordinator Roster Band | Volunteer Coordinator Ops Playbook | Volunteer Coordinator Roster Tablet | Volunteer Coordinator Campaign Flag | Volunteer Coordinator Ops Chest |
| ELESUR | 18 | Mission Pastor | Mission Pastor Commission Card | Mission Pastor Field Primer | Mission Pastor Field Pack | Mission Pastor Commissioning Medal | Mission Pastor Field Chest |
| ELESUR | 19 | Community Builder | Community Builder Key Charm | Community Builder Strategy Dossier | Community Builder Planning Tablet | Community Builder Town Seal | Community Builder Town Reliquary |
| ELESUR | 20 | Legacy Shepherd | Legacy Shepherd Crook Locket | Legacy Shepherd Stewardship Codex | Legacy Shepherd Crook Staff | Legacy Shepherd Crown Crest | Legacy Shepherd Dynasty Chest |
| Jawo | 1 | Young Dreamer | Campfire Dream Locket | Forest Trail Journal | First Practice Guitar Pick | Seedling Starter Kit | Harmony Keepsake Case |
| Jawo | 2 | Nature Lover | Nature Lover Leaf Press Card | Nature Lover Field Sketchbook | Nature Lover Trail Compass | Nature Lover Summit Stamp | Nature Lover Relic Trunk |
| Jawo | 3 | Student Musician | Student Musician Rehearsal Band | Student Musician Theory Pad | Student Musician Tuner | Student Musician Recital Ribbon | Student Musician Practice Chest |
| Jawo | 4 | Campus Volunteer | Campus Volunteer Armband | Campus Volunteer Service Log | Campus Volunteer Clipboard | Campus Volunteer Hours Medal | Campus Volunteer Care Chest |
| Jawo | 5 | Youth Encourager | Youth Encourager Friendship Pick | Youth Encourager Mentorship Journal | Youth Encourager Megaphone | Youth Encourager Impact Pin | Youth Encourager Mentorship Box |
| Jawo | 6 | Choir Member | Choir Member Robe Pin | Choir Member Harmony Binder | Choir Member Pitch Pipe | Choir Member First Anthem Banner | Choir Member Music Archive |
| Jawo | 7 | Guitar Learner | Guitar Learner First Pick | Guitar Learner Chord Book | Guitar Learner Practice Amp Cable | Guitar Learner First Song Frame | Guitar Learner Practice Chest |
| Jawo | 8 | Worship Music Helper | Worship Music Helper Capo Charm | Worship Music Helper Setlist Folio | Worship Music Helper Capo | Worship Music Helper Full Set Award | Worship Music Helper Setlist Vault |
| Jawo | 9 | Community Singer | Community Singer Event Wristband | Community Singer Repertoire Book | Community Singer Portable Mic | Community Singer Crowd Appreciation Cup | Community Singer Memory Trunk |
| Jawo | 10 | Music Team Member | Music Team Member Setlist Card | Music Team Member Arrangement Pad | Music Team Member In-Ear Pack | Music Team Member Tour Seal | Music Team Member Tour Chest |
| Jawo | 11 | Youth Mentor | Youth Mentor Coach Pin | Youth Mentor Coaching Playbook | Youth Mentor Facilitation Cards | Youth Mentor Protégé Graduation | Youth Mentor Coaching Archive |
| Jawo | 12 | Worship Leader | Worship Leader Mic Flag | Worship Leader Liturgy Journal | Worship Leader Stage Tablet | Worship Leader Commissioning Medal | Worship Leader Stage Reliquary |
| Jawo | 13 | Creative Ministry Worker | Creative Ministry Worker Palette Pin | Creative Ministry Worker Idea Atlas | Creative Ministry Worker Craft Kit | Creative Ministry Worker Showcase Trophy | Creative Ministry Worker Idea Vault |
| Jawo | 14 | Forest Advocate | Forest Advocate Trail Tag | Forest Advocate Ecology Manual | Forest Advocate Seedling Trowel | Forest Advocate Grove Dedication Flag | Forest Advocate Seed Chest |
| Jawo | 15 | Community Organizer | Community Organizer Key Charm | Community Organizer Ops Binder | Community Organizer Radio Set | Community Organizer Campaign Banner | Community Organizer Ops Strongbox |
| Jawo | 16 | Music Trainer | Music Trainer Metronome Charm | Music Trainer Pedagogy Workbook | Music Trainer Conductor Baton | Music Trainer Cohort Graduation Cup | Music Trainer Pedagogy Vault |
| Jawo | 17 | Mission Volunteer | Mission Volunteer Passport Pick | Mission Volunteer Field Songbook | Mission Volunteer Field Guitar Stand | Mission Volunteer Field Commission | Mission Volunteer Field Chest |
| Jawo | 18 | Discipleship Worker | Discipleship Worker Cross Pick | Discipleship Worker Study Journal | Discipleship Worker Study Lamp | Discipleship Worker Pathway Seal | Discipleship Worker Study Chest |
| Jawo | 19 | Church Planting Partner | Church Planting Partner Seed Card | Church Planting Partner Planting Primer | Church Planting Partner Tool Roll | Church Planting Partner Planting Key | Church Planting Partner Heritage Chest |
| Jawo | 20 | Purposeful Leader | Purposeful Leader Crest Locket | Purposeful Leader Stewardship Codex | Purposeful Leader Command Briefcase | Purposeful Leader Legacy Crown | Purposeful Leader Dynasty Chest |
| Mitch | 1 | Little Dreamer | Little Dreamer Crayon Charm | Little Dreamer Color Journal | Little Dreamer Watercolor Set | Little Dreamer First Drawing Frame | Little Dreamer Memory Art Box |
| Mitch | 2 | Young Creator | Young Creator Sketch Locket | Young Creator Sketchbook | Young Creator Charcoal Kit | Young Creator Showcase Ribbon | Young Creator Sketch Chest |
| Mitch | 3 | Art Helper | Art Helper Apron Pin | Art Helper Technique Pad | Art Helper Brush Roll | Art Helper Appreciation Star | Art Helper Brush Chest |
| Mitch | 4 | Story Drawer | Story Drawer Bookmark | Story Drawer Storyboard Book | Story Drawer Ink Pen Set | Story Drawer Published Page Seal | Story Drawer Story Archive |
| Mitch | 5 | Classroom Assistant | Classroom Assistant Chalk Clip | Classroom Assistant Lesson Log | Classroom Assistant Craft Scissors | Classroom Assistant Class Launch Banner | Classroom Assistant Craft Vault |
| Mitch | 6 | Student Teacher | Student Teacher Desk Charm | Student Teacher Pedagogy Notebook | Student Teacher Demo Easel | Student Teacher First Lesson Medal | Student Teacher Pedagogy Chest |
| Mitch | 7 | Creative Mentor | Creative Mentor Palette Pin | Creative Mentor Coaching Journal | Creative Mentor Critique Pointer | Creative Mentor Protégé Graduation | Creative Mentor Mentorship Reliquary |
| Mitch | 8 | Community Artist | Community Artist Event Band | Community Artist Portfolio Binder | Community Artist Portable Easel | Community Artist Mural Dedication | Community Artist Portfolio Vault |
| Mitch | 9 | Arts Teacher | Arts Teacher Apple Pin | Arts Teacher Curriculum Folio | Arts Teacher Classroom Projector | Arts Teacher Cohort Trophy | Arts Teacher Curriculum Chest |
| Mitch | 10 | Tribal Educator | Tribal Educator Bead Charm | Tribal Educator Culture Atlas | Tribal Educator Bead Loom | Tribal Educator Culture Fair Award | Tribal Educator Bead Heritage Chest |
| Mitch | 11 | Culture Advocate | Culture Advocate Heritage Pin | Culture Advocate Heritage Reader | Culture Advocate Display Frame Kit | Culture Advocate Heritage Exhibit Seal | Culture Advocate Heritage Strongbox |
| Mitch | 12 | Creative Leader | Creative Leader Studio Key | Creative Leader Studio Playbook | Creative Leader Studio Light | Creative Leader Studio Opening Key | Creative Leader Studio Archive |
| Mitch | 13 | Workshop Facilitator | Workshop Facilitator Name Tag | Workshop Facilitator Session Guide | Workshop Facilitator Tool Caddy | Workshop Facilitator Series Completion Cup | Workshop Facilitator Session Vault |
| Mitch | 14 | Arts Ministry Worker | Arts Ministry Worker Cross Brush | Arts Ministry Worker Devotion Sketchbook | Arts Ministry Worker Worship Art Kit | Arts Ministry Worker Worship Exhibit Flag | Arts Ministry Worker Worship Art Chest |
| Mitch | 15 | Community Inspiration Builder | Community Inspiration Builder Banner Pin | Community Inspiration Builder Impact Log | Community Inspiration Builder Banner Kit | Community Inspiration Builder Town Banner | Community Inspiration Builder Legacy Case |
| Mitch | 16 | Education & Arts Coordinator | Education Arts Coordinator Seal | Education Arts Coordinator Ops Manual | Education Arts Coordinator Planning Tablet | Education Arts Coordinator Program Launch | Education Arts Coordinator Ops Vault |
| Mitch | 17 | Missionary-Educator | Missionary-Educator Field Tag | Missionary-Educator Culture Journal | Missionary-Educator Field Art Pack | Missionary-Educator Commissioning Medal | Missionary-Educator Field Chest |
| Mitch | 18 | Regional Creative Trainer | Regional Creative Trainer Crest | Regional Creative Trainer Briefing Dossier | Regional Creative Trainer Demo Case | Regional Creative Trainer Summit Invitation | Regional Creative Trainer Archive Vault |
| Mitch | 19 | Heritage Advocate | Heritage Advocate Relic Locket | Heritage Advocate Archive Catalog | Heritage Advocate Archival Gloves | Heritage Advocate Relic Dedication | Heritage Advocate Reliquary Chest |
| Mitch | 20 | Legacy Art Mentor | Legacy Art Mentor Crown Pin | Legacy Art Mentor Stewardship Codex | Legacy Art Mentor Master Brush Chest Tools | Legacy Art Mentor Crown Crest | Legacy Art Mentor Dynasty Chest |
| Niel | 1 | Young Singer | Young Singer Lyric Charm | Young Singer Song Journal | Young Singer Karaoke Mic | Young Singer First Solo Frame | Young Singer Lyric Chest |
| Niel | 2 | Faith Listener | Faith Listener Pew Bookmark | Faith Listener Devotion Pad | Faith Listener Pocket Bible | Faith Listener Dedication Certificate | Faith Listener Devotion Trunk |
| Niel | 3 | Youth Helper | Youth Helper Camp Band | Youth Helper Activity Log | Youth Helper Activity Bag | Youth Helper Appreciation Medal | Youth Helper Care Chest |
| Niel | 4 | Small Group Member | Small Group Member Circle Pin | Small Group Member Study Guide | Small Group Member Discussion Cards | Small Group Member Covenant Seal | Small Group Member Covenant Box |
| Niel | 5 | Worship Volunteer | Worship Volunteer Mic Flag | Worship Volunteer Liturgy Binder | Worship Volunteer Capo | Worship Volunteer Full Set Award | Worship Volunteer Setlist Archive |
| Niel | 6 | Bible Learner | Bible Learner Ribbon | Bible Learner Exegesis Notebook | Bible Learner Highlighter Set | Bible Learner Completion Ribbon | Bible Learner Study Chest |
| Niel | 7 | Student Mentor | Student Mentor Coach Pin | Student Mentor Coaching Journal | Student Mentor Facilitation Cards | Student Mentor Protégé Graduation | Student Mentor Mentorship Reliquary |
| Niel | 8 | Young Teacher | Young Teacher Desk Charm | Young Teacher Lesson Plan Book | Young Teacher Whiteboard Markers | Young Teacher Class Launch Banner | Young Teacher Lesson Vault |
| Niel | 9 | Worship Leader | Worship Leader Setlist Card | Worship Leader Homily Journal | Worship Leader Stage Tablet | Worship Leader Commissioning Medal | Worship Leader Stage Archive |
| Niel | 10 | Youth Pastor | Youth Pastor Stole Clip | Youth Pastor Pastoral Care Log | Youth Pastor Visit Care Bag | Youth Pastor Ordination Path Token | Youth Pastor Pastoral Care Chest |
| Niel | 11 | Discipleship Leader | Discipleship Leader Pathway Pin | Discipleship Leader Pathway Folio | Discipleship Leader Pathway Binder | Discipleship Leader Pathway Trophy | Discipleship Leader Pathway Vault |
| Niel | 12 | Mission Volunteer | Mission Volunteer Passport Cross | Mission Volunteer Field Primer | Mission Volunteer Field Pack | Mission Volunteer Field Commission | Mission Volunteer Field Chest |
| Niel | 13 | Outreach Trainer | Outreach Trainer Field Tag | Outreach Trainer Facilitation Guide | Outreach Trainer Loudhailer | Outreach Trainer Campaign Flag | Outreach Trainer Campaign Chest |
| Niel | 14 | Church Planting Apprentice | Church Planting Apprentice Seed Card | Church Planting Apprentice Planting Manual | Church Planting Apprentice Tool Roll | Church Planting Apprentice Planting Key | Church Planting Apprentice Seed Chest |
| Niel | 15 | Community Shepherd | Community Shepherd Crook Charm | Community Shepherd Care Codex | Community Shepherd Care Clipboard | Community Shepherd Flock Seal | Community Shepherd Heritage Strongbox |
| Niel | 16 | Ministry Coordinator | Ministry Coordinator Seal Card | Ministry Coordinator Ops Playbook | Ministry Coordinator Planning Tablet | Ministry Coordinator Launch Cup | Ministry Coordinator Ops Vault |
| Niel | 17 | Discipleship Pastor | Discipleship Pastor Crest Pin | Discipleship Pastor Theology Atlas | Discipleship Pastor Pulpit Mic | Discipleship Pastor Congregation Banner | Discipleship Pastor Theology Chest |
| Niel | 18 | Church Planting Leader | Church Planting Leader Key Charm | Church Planting Leader Strategy Dossier | Church Planting Leader Radio Set | Church Planting Leader Planting Medallion | Church Planting Leader Planting Reliquary |
| Niel | 19 | Regional Mission Mentor | Regional Mission Mentor Medallion | Regional Mission Mentor Briefing Codex | Regional Mission Mentor Command Tablet | Regional Mission Mentor Unity Flag | Regional Mission Mentor Archive Vault |
| Niel | 20 | Legacy Disciple-Maker | Legacy Disciple-Maker Locket | Legacy Disciple-Maker Stewardship Codex | Legacy Disciple-Maker Desk Seal | Legacy Disciple-Maker Crown Crest | Legacy Disciple-Maker Dynasty Chest |
| Angel | 1 | Little Helper | Little Helper Coin Purse Charm | Little Helper Counting Journal | Little Helper Coin Counter | Little Helper First Errand Star | Little Helper Memory Coin Box |
| Angel | 2 | Savings Learner | Savings Learner Piggy Bank Token | Savings Learner Habit Tracker | Savings Learner Envelope System | Savings Learner First Goal Seal | Savings Learner Habit Chest |
| Angel | 3 | Student Organizer | Student Organizer Planner Clip | Student Organizer Planner Book | Student Organizer Color Tabs | Student Organizer Class Award | Student Organizer Planner Trunk |
| Angel | 4 | Class Treasurer | Class Treasurer Ledger Pin | Class Treasurer Ledger Notebook | Class Treasurer Receipt Book | Class Treasurer Balanced Books Medal | Class Treasurer Ledger Chest |
| Angel | 5 | Young Steward | Young Steward Seal Charm | Young Steward Stewardship Primer | Young Steward Desk Calculator | Young Steward Faithful Giving Pin | Young Steward Giving Chest |
| Angel | 6 | Record Keeper | Record Keeper Stamp Card | Record Keeper Filing Manual | Record Keeper Date Stamp | Record Keeper Perfect File Ribbon | Record Keeper Archive Vault |
| Angel | 7 | Budget Assistant | Budget Assistant Receipt Clip | Budget Assistant Spreadsheet Pad | Budget Assistant USB Ledger Drive | Budget Assistant Forecast Hit Cup | Budget Assistant Forecast Chest |
| Angel | 8 | Community Volunteer | Community Volunteer Care Band | Community Volunteer Care Log | Community Volunteer Clipboard | Community Volunteer Hours Banner | Community Volunteer Care Chest |
| Angel | 9 | Stewardship Worker | Stewardship Worker Offering Pin | Stewardship Worker Offering Guide | Stewardship Worker Offering Basket | Stewardship Worker Campaign Award | Stewardship Worker Offering Reliquary |
| Angel | 10 | Finance Coordinator | Finance Coordinator Seal Card | Finance Coordinator Ops Folio | Finance Coordinator Tablet | Finance Coordinator Quarter Seal | Finance Coordinator Ops Vault |
| Angel | 11 | Ministry Treasurer | Ministry Treasurer Key Charm | Ministry Treasurer Audit Binder | Ministry Treasurer Secure Lockbox | Ministry Treasurer Clean Audit Frame | Ministry Treasurer Secure Strongbox |
| Angel | 12 | Resource Planner | Resource Planner Map Token | Resource Planner Allocation Atlas | Resource Planner Allocation Board | Resource Planner Allocation Trophy | Resource Planner Allocation Chest |
| Angel | 13 | Budget Manager | Budget Manager Desk Seal | Budget Manager Forecast Journal | Budget Manager Forecast Stylus | Budget Manager Year-End Banner | Budget Manager Forecast Vault |
| Angel | 14 | Community Treasurer | Community Treasurer Town Pin | Community Treasurer Civic Ledger | Community Treasurer Town Seal Stamp | Community Treasurer Town Mandate Seal | Community Treasurer Town Reliquary |
| Angel | 15 | Financial Trainer | Financial Trainer Coach Pin | Financial Trainer Facilitation Guide | Financial Trainer Demo Ledger | Financial Trainer Cohort Graduation | Financial Trainer Mentorship Chest |
| Angel | 16 | Stewardship Leader | Stewardship Leader Crest | Stewardship Leader Strategy Codex | Stewardship Leader Briefing Tablet | Stewardship Leader Impact Medallion | Stewardship Leader Heritage Vault |
| Angel | 17 | Development Coordinator | Development Coordinator Grant Card | Development Coordinator Grant Dossier | Development Coordinator Grant Binder | Development Coordinator Grant Win Flag | Development Coordinator Grant Archive |
| Angel | 18 | Resource Director | Resource Director Vault Key | Resource Director Portfolio Manual | Resource Director Vault Tablet | Resource Director Portfolio Crown | Resource Director Portfolio Chest |
| Angel | 19 | Community Finance Head | Community Finance Head Gavel Charm | Community Finance Head Policy Atlas | Community Finance Head Chamber Gavel | Community Finance Head Unity Banner | Community Finance Head Chamber Chest |
| Angel | 20 | Legacy Steward | Legacy Steward Locket | Legacy Steward Stewardship Codex | Legacy Steward Desk Seal | Legacy Steward Crown Crest | Legacy Steward Dynasty Chest |
| Vhen | 1 | Farm Helper | Farm Helper Seed Pouch | Farm Helper Crop Journal | Seed Kit Hand Trowel | Harvest Basket First Yield | Seed Kit Family Chest |
| Vhen | 2 | Garden Learner | Garden Learner Sprout Charm | Garden Learner Soil Notebook | Garden Learner Watering Can | Garden Learner Sprout Ribbon | Garden Learner Sprout Trunk |
| Vhen | 3 | Student Worker | Student Worker Time Card | Student Worker Shift Log | Student Worker Tool Belt | Student Worker Perfect Shift Star | Student Worker Shift Chest |
| Vhen | 4 | Youth Volunteer | Youth Volunteer Armband | Youth Volunteer Service Pad | Youth Volunteer Care Kit | Youth Volunteer Hours Medal | Youth Volunteer Care Chest |
| Vhen | 5 | Field Assistant | Field Assistant Trail Tag | Field Assistant Context Notes | Field Assistant Soil Probe | Field Assistant First Survey Seal | Field Assistant Survey Chest |
| Vhen | 6 | Crop Care Worker | Crop Care Worker Leaf Pin | Crop Care Worker Pest Manual | Crop Care Worker Knapsack Sprayer | Crop Care Worker Healthy Field Banner | Crop Care Worker Field Reliquary |
| Vhen | 7 | Community Helper | Community Helper Care Band | Community Helper Care Journal | Community Helper Clipboard | Community Helper Impact Pin | Community Helper Care Vault |
| Vhen | 8 | Agriculture Learner | Agriculture Learner Soil Card | Agriculture Learner Textbook Folio | Agriculture Learner Sample Kit | Agriculture Learner Certification Folio | Agriculture Learner Study Chest |
| Vhen | 9 | Farm Technician | Farm Technician Tool Tag | Farm Technician Ops Binder | Farm Technician Calibration Meter | Farm Technician Calibration Cup | Farm Technician Ops Vault |
| Vhen | 10 | Harvest Organizer | Harvest Organizer Basket Charm | Harvest Organizer Schedule Book | Harvest Organizer Crate Dolly | Harvest Organizer Peak Season Trophy | Harvest Organizer Crate Archive |
| Vhen | 11 | Agribusiness Starter | Agribusiness Starter Seal Card | Agribusiness Starter Playbook | Agribusiness Starter Inventory Scanner | Agribusiness Starter First Sale Seal | Agribusiness Starter Founders Chest |
| Vhen | 12 | Small Business Owner | Small Business Owner Key Charm | Small Business Owner Ledger | Small Business Owner POS Tablet | Small Business Owner Grand Opening Key | Small Business Owner Strongbox |
| Vhen | 13 | Community Grower | Community Grower Town Pin | Community Grower Coop Manual | Community Grower Coop Radio | Community Grower Coop Charter | Community Grower Coop Reliquary |
| Vhen | 14 | Agriculture Specialist | Agriculture Specialist Crest | Agriculture Specialist Research Dossier | Agriculture Specialist Lab Sampler | Agriculture Specialist Research Award | Agriculture Specialist Research Vault |
| Vhen | 15 | Family Provider | Family Provider Locket | Family Provider Budget Journal | Family Provider Market Scale | Family Provider Provision Banner | Family Provider Heritage Chest |
| Vhen | 16 | Farm Entrepreneur | Farm Entrepreneur Brand Pin | Farm Entrepreneur Market Atlas | Farm Entrepreneur Brand Stamp | Farm Entrepreneur Brand Launch Flag | Farm Entrepreneur Brand Archive |
| Vhen | 17 | Community Business Leader | Community Business Leader Seal | Community Business Leader Strategy Codex | Community Business Leader Briefcase | Community Business Leader Town Seal | Community Business Leader Town Chest |
| Vhen | 18 | Resource Steward | Resource Steward Vault Charm | Resource Steward Allocation Folio | Resource Steward Allocation Board | Resource Steward Clean Audit Frame | Resource Steward Allocation Vault |
| Vhen | 19 | Agriculture Mentor | Agriculture Mentor Coach Pin | Agriculture Mentor Coaching Guide | Agriculture Mentor Demo Kit | Agriculture Mentor Protégé Graduation | Agriculture Mentor Mentorship Chest |
| Vhen | 20 | Legacy Builder | Legacy Builder Crown Locket | Legacy Builder Stewardship Codex | Legacy Builder Command Desk Seal | Legacy Builder Crown Crest | Legacy Builder Dynasty Chest |
| Trudice | 1 | Little Learner | First Storybook Bookmark | Sunday School Lesson Card | Classroom Craft Kit | Children Helper Ribbon | Little Teacher Memory Box |
| Trudice | 2 | Story Listener | Story Listener Pew Charm | Story Listener Story Journal | Story Listener Felt Board | Story Listener First Story Frame | Story Listener Story Chest |
| Trudice | 3 | Sunday School Helper | Sunday School Helper Armband | Sunday School Helper Activity Log | Sunday School Helper Activity Bag | Sunday School Helper Appreciation Star | Sunday School Helper Care Chest |
| Trudice | 4 | Young Teacher | Young Teacher Apple Pin | Young Teacher Lesson Plan Pad | Young Teacher Pointer Stick | Young Teacher First Class Medal | Young Teacher Lesson Trunk |
| Trudice | 5 | Children's Guide | Children's Guide Friendship Band | Children's Guide Care Manual | Children's Guide Care Clipboard | Children's Guide Kindness Banner | Children's Guide Friendship Chest |
| Trudice | 6 | Classroom Assistant | Classroom Assistant Chalk Clip | Classroom Assistant Duty Binder | Classroom Assistant Whiteboard Set | Classroom Assistant Class Launch Seal | Classroom Assistant Craft Vault |
| Trudice | 7 | Student Mentor | Student Mentor Coach Pin | Student Mentor Coaching Journal | Student Mentor Facilitation Cards | Student Mentor Protégé Graduation | Student Mentor Mentorship Reliquary |
| Trudice | 8 | Learning Facilitator | Learning Facilitator Name Tag | Learning Facilitator Session Guide | Learning Facilitator Session Timer | Learning Facilitator Series Completion Cup | Learning Facilitator Session Archive |
| Trudice | 9 | Sunday School Teacher | Sunday School Teacher Cross Pin | Sunday School Teacher Curriculum Folio | Sunday School Teacher Flannel Graph | Sunday School Teacher Cohort Trophy | Sunday School Teacher Curriculum Vault |
| Trudice | 10 | Classroom Teacher | Classroom Teacher Desk Charm | Classroom Teacher Pedagogy Atlas | Classroom Teacher Lesson Tablet | Classroom Teacher Year Excellence Award | Classroom Teacher Pedagogy Chest |
| Trudice | 11 | Creative Educator | Creative Educator Palette Pin | Creative Educator Idea Workbook | Creative Educator Art Caddy | Creative Educator Showcase Flag | Creative Educator Idea Strongbox |
| Trudice | 12 | Values Mentor | Values Mentor Heart Charm | Values Mentor Character Primer | Values Mentor Discussion Cards | Values Mentor Character Campaign Medal | Values Mentor Character Reliquary |
| Trudice | 13 | Children's Ministry Teacher | Children's Ministry Teacher Stole Clip | Children's Ministry Teacher Devotion Guide | Children's Ministry Teacher Puppet Kit | Children's Ministry Teacher Dedication Banner | Children's Ministry Teacher Ministry Chest |
| Trudice | 14 | Learning Coordinator | Learning Coordinator Seal Card | Learning Coordinator Ops Playbook | Learning Coordinator Planning Board | Learning Coordinator Program Launch | Learning Coordinator Ops Vault |
| Trudice | 15 | Teacher-Leader | Teacher-Leader Gavel Charm | Teacher-Leader Leadership Codex | Teacher-Leader Faculty Radio | Teacher-Leader Faculty Mandate Seal | Teacher-Leader Faculty Archive |
| Trudice | 16 | Curriculum Builder | Curriculum Builder Blueprint Card | Curriculum Builder Scope Sequence Book | Curriculum Builder Outline Stylus | Curriculum Builder Adoption Seal | Curriculum Builder Blueprint Chest |
| Trudice | 17 | Mentor of Teachers | Mentor of Teachers Crest Pin | Mentor of Teachers Facilitation Guide | Mentor of Teachers Demo Kit | Mentor of Teachers Mentorship Medallion | Mentor of Teachers Mentorship Vault |
| Trudice | 18 | Education Ministry Leader | Education Ministry Leader Seal | Education Ministry Leader Strategy Dossier | Education Ministry Leader Briefcase | Education Ministry Leader Summit Invitation | Education Ministry Leader Heritage Chest |
| Trudice | 19 | Community Educator | Community Educator Town Pin | Community Educator Civic Reader | Community Educator Town Hall Mic | Community Educator Town Seal | Community Educator Town Reliquary |
| Trudice | 20 | Legacy Teacher | Legacy Teacher Locket | Legacy Teacher Stewardship Codex | Legacy Teacher Desk Seal | Legacy Teacher Crown Crest | Legacy Teacher Dynasty Chest |

## B. Character badge groups (all 461 character-specific titles)

**Mechanic disclosure**: Signature and starter packs are catalog-listed cosmetics; claiming these, just like stage/journey/mastery badges, requires a separately verified canonical source. **Do not invent badge points or automatic item acquisition**. Stage badges are only candidates upon server-verified level mastery. Era badges are candidates for completion of the appropriate four-stage era. Journey badges require published milestone conditions. Character mastery requires complete verified Character progression. None of these exact grant implementations has been verified as live for Season 2.

### Phan — Core Character

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Phan Path Seal | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Phan Farmer Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Fisherman Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Student Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Worker Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Service Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan College Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Intern Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan First Job Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Professional Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Team Lead Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Manager Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Entrepreneur Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Business Owner Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Investor Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Philanthropist Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Influencer Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Industry Leader Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Visionary Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan Executive Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Phan CEO Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Phan BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Phan GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Phan CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Phan LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Phan LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Phan Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Phan Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Phan Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Phan Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Phan Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Phan Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Phan Starter Expression Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Quin — Core Character

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Quin Path Seal | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Quin Innocent Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Province Girl Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Student Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Youth Helper Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Volunteer Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin College Girl Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Explorer Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Travel Enthusiast Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Tourism Advocate Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Travel Planner Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Team Leader Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Project Manager Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Content Creator Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Tour Operator Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Business Founder Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Tourism Entrepreneur Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Resort Owner Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Brand Leader Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Industry Influencer Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Quin Tourism Business Owner Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Quin BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Quin GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Quin CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Quin LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Quin LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Quin Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Quin Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Quin Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Quin Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Quin Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Quin Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Quin Starter Expression Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Van — Core Character

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Van Path Seal | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Van Innocent Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Young Boy Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Student Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Altar Boy Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Youth Helper Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Van College Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Church Worker Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Worship Leader Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Community Volunteer Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Ministry Worker Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Outreach Leader Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Bible Teacher Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Mission Trainee Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Field Worker Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Missionary Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Program Director Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Training Leader Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Mission Strategist Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Van International Missionary Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Van Global Mission Leader Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Van BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Van GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Van CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Van LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Van LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Van Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Van Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Van Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Van Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Van Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Van Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Van Starter Expression Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Christian — Core Character

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Christian Path Seal | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Christian Student Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Class Officer Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Youth Leader Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Athlete Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian College Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Organization Head Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Intern Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Professional Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Community Volunteer Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Team Leader Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Public Service Staff Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Public Servant Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Government Staff Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Local Leader Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Councilor Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Mayor Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Provincial Leader Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Congressional Leader Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian National Leader Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Christian Popular Politician Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Christian BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Christian GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Christian CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Christian LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Christian LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Christian Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Christian Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Christian Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Christian Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Christian Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Christian Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Christian Starter Expression Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Lhen — Core Character

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Lhen Path Seal | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Lhen Gas Station Worker Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Service Crew Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Cashier Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Fast Food Crew Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Sales Associate Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Community Volunteer Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Church Youth Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Choir Member Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Bible Student Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen College Student Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Sunday School Teacher Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Worship Leader Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Community Outreach Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Mission Volunteer Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Education Coordinator Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Trainer Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Missionary-Educator Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Program Director Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen National Advocate Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Lhen Missionary-Educator Global Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Lhen BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Lhen GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Lhen CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Lhen LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Lhen LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Lhen Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Lhen Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Lhen Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Lhen Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Lhen Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Lhen Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Lhen Starter Expression Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Ace — Special (Circle Rank order 5 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Ace Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Ace Curious Learner Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Caring Student Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Chess Beginner Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace School Helper Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Youth Encourager Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Nursing Student Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Chess Competitor Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Community Helper Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Campus Leader Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Junior Nurse Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Board Passer Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Staff Nurse Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Wellness Advocate Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Chess Mentor Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Community Health Leader Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Mission Nurse Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Strategic Mentor Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Healing Servant Leader Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Regional Health Mentor Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Ace Legacy Care Champion Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Ace BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Ace GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Ace CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Ace LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Ace LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Ace Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Ace Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Ace Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Ace Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Ace Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Ace Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Ace Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Ace Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Ace Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Ace Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Ace Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### ELESUR — Special (Circle Rank order 6 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | ELESUR Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | ELESUR Little Learner Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Church Boy Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Student Helper Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Youth Volunteer Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Bible Learner Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Classroom Assistant Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Farm Helper Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Community Volunteer Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Sunday Helper Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Teacher-in-Service Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Ministry Worker Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Field Mentor Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Faith Leader Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Community Teacher Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Pastor Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Agricultural Advocate Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Volunteer Coordinator Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Mission Pastor Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Community Builder Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | ELESUR Legacy Shepherd Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | ELESUR BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | ELESUR GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | ELESUR CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | ELESUR LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | ELESUR LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | ELESUR Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | ELESUR Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | ELESUR Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | ELESUR Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | ELESUR Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | ELESUR Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | ELESUR Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | ELESUR Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | ELESUR Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | ELESUR Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | ELESUR Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Jawo — Special (Circle Rank order 7 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Jawo Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Jawo Young Dreamer Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Nature Lover Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Student Musician Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Campus Volunteer Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Youth Encourager Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Choir Member Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Guitar Learner Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Worship Music Helper Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Community Singer Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Music Team Member Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Youth Mentor Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Worship Leader Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Creative Ministry Worker Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Forest Advocate Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Community Organizer Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Music Trainer Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Mission Volunteer Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Discipleship Worker Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Church Planting Partner Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Jawo Purposeful Leader Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Jawo BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Jawo GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Jawo CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Jawo LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Jawo LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Jawo Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Jawo Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Jawo Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Jawo Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Jawo Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Jawo Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Jawo Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Jawo Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Jawo Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Jawo Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Jawo Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Mitch — Special (Circle Rank order 8 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Mitch Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Mitch Little Dreamer Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Young Creator Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Art Helper Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Story Drawer Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Classroom Assistant Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Student Teacher Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Creative Mentor Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Community Artist Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Arts Teacher Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Tribal Educator Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Culture Advocate Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Creative Leader Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Workshop Facilitator Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Arts Ministry Worker Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Community Inspiration Builder Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Education & Arts Coordinator Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Missionary-Educator Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Regional Creative Trainer Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Heritage Advocate Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Mitch Legacy Art Mentor Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Mitch BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Mitch GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Mitch CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Mitch LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Mitch LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Mitch Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Mitch Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Mitch Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Mitch Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Mitch Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Mitch Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Mitch Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Mitch Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Mitch Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Mitch Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Mitch Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Niel — Special (Circle Rank order 9 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Niel Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Niel Young Singer Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Faith Listener Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Youth Helper Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Small Group Member Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Worship Volunteer Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Bible Learner Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Student Mentor Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Young Teacher Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Worship Leader Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Youth Pastor Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Discipleship Leader Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Mission Volunteer Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Outreach Trainer Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Church Planting Apprentice Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Community Shepherd Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Ministry Coordinator Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Discipleship Pastor Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Church Planting Leader Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Regional Mission Mentor Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Niel Legacy Disciple-Maker Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Niel BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Niel GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Niel CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Niel LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Niel LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Niel Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Niel Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Niel Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Niel Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Niel Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Niel Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Niel Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Niel Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Niel Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Niel Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Niel Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Angel — Special (Circle Rank order 10 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Angel Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Angel Little Helper Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Savings Learner Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Student Organizer Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Class Treasurer Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Young Steward Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Record Keeper Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Budget Assistant Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Community Volunteer Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Stewardship Worker Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Finance Coordinator Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Ministry Treasurer Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Resource Planner Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Budget Manager Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Community Treasurer Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Financial Trainer Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Stewardship Leader Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Development Coordinator Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Resource Director Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Community Finance Head Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Angel Legacy Steward Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Angel BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Angel GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Angel CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Angel LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Angel LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Angel Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Angel Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Angel Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Angel Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Angel Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Angel Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Angel Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Angel Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Angel Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Angel Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Angel Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Vhen — Special (Circle Rank order 11 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Vhen Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Vhen Farm Helper Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Garden Learner Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Student Worker Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Youth Volunteer Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Field Assistant Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Crop Care Worker Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Community Helper Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Agriculture Learner Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Farm Technician Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Harvest Organizer Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Agribusiness Starter Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Small Business Owner Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Community Grower Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Agriculture Specialist Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Family Provider Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Farm Entrepreneur Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Community Business Leader Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Resource Steward Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Agriculture Mentor Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Vhen Legacy Builder Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Vhen BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Vhen GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Vhen CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Vhen LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Vhen LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Vhen Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Vhen Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Vhen Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Vhen Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Vhen Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Vhen Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Vhen Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Vhen Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Vhen Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Vhen Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Vhen Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

### Trudice — Special (Circle Rank order 13 required)

| Badge group | Exact catalog title | Requirement/status |
|---|---|---|
| Signature | Trudice Signature Badge | Signature entitlement and grant authority pending — **catalog only** |
| Stage mastery | Trudice Little Learner Stage Mastery | Character level 1 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Story Listener Stage Mastery | Character level 2 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Sunday School Helper Stage Mastery | Character level 3 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Young Teacher Stage Mastery | Character level 4 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Children's Guide Stage Mastery | Character level 5 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Classroom Assistant Stage Mastery | Character level 6 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Student Mentor Stage Mastery | Character level 7 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Learning Facilitator Stage Mastery | Character level 8 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Sunday School Teacher Stage Mastery | Character level 9 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Classroom Teacher Stage Mastery | Character level 10 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Creative Educator Stage Mastery | Character level 11 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Values Mentor Stage Mastery | Character level 12 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Children's Ministry Teacher Stage Mastery | Character level 13 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Learning Coordinator Stage Mastery | Character level 14 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Teacher-Leader Stage Mastery | Character level 15 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Curriculum Builder Stage Mastery | Character level 16 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Mentor of Teachers Stage Mastery | Character level 17 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Education Ministry Leader Stage Mastery | Character level 18 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Community Educator Stage Mastery | Character level 19 stage mastery; server certified — **catalog only** |
| Stage mastery | Trudice Legacy Teacher Stage Mastery | Character level 20 stage mastery; server certified — **catalog only** |
| Era mastery | Trudice BEGIN Era Mastery | Full verified era BEGIN (1–4) — **catalog only** |
| Era mastery | Trudice GROW Era Mastery | Full verified era GROW (5–8) — **catalog only** |
| Era mastery | Trudice CONTRIBUTE Era Mastery | Full verified era CONTRIBUTE (9–12) — **catalog only** |
| Era mastery | Trudice LEAD Era Mastery | Full verified era LEAD (13–16) — **catalog only** |
| Era mastery | Trudice LEGACY Era Mastery | Full verified era LEGACY (17–20) — **catalog only** |
| Character mastery | Trudice Character Mastery | Server-certified Character mastery — **catalog only** |
| Journey | Trudice Journey Unlocked | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Trudice Collection Half-Way | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Trudice Collection Complete | Server-certified journey milestone, threshold pending — **catalog only** |
| Journey | Trudice Legacy Path Cleared | Server-certified journey milestone, threshold pending — **catalog only** |
| Starter/pack | Trudice Signature Environment Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Trudice Starter Outfit Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Trudice Starter Collectible Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Trudice Starter Animation Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Trudice Speech Pack Badge | Starter pack ownership and grant authority pending — **catalog only** |
| Starter/pack | Trudice Journey Map Badge | Starter pack ownership and grant authority pending — **catalog only** |

## C. Shared series and cross-character badges (8)

| Catalog title | Requirement/status |
|---|---|
| Five Core Path Series Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| Eight Special Path Series Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| Thirteen Character World Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| BEGIN Era Circle Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| GROW Era Circle Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| CONTRIBUTE Era Circle Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| LEAD Era Circle Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |
| LEGACY Era Circle Complete | Verified completion of specified collection/era across eligible Characters; not active in isolated Season 2 backend |

## D. Full Circle Rank classifications (40)

| No. | Exact rank display | Unlock authority |
|---:|---|---|
| 1 | Circle Starter V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 2 | Circle Starter IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 3 | Circle Starter III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 4 | Circle Starter II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 5 | Circle Starter I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 6 | Circle Active V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 7 | Circle Active IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 8 | Circle Active III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 9 | Circle Active II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 10 | Circle Active I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 11 | Circle Steady V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 12 | Circle Steady IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 13 | Circle Steady III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 14 | Circle Steady II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 15 | Circle Steady I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 16 | Circle Builder V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 17 | Circle Builder IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 18 | Circle Builder III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 19 | Circle Builder II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 20 | Circle Builder I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 21 | Circle Impact V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 22 | Circle Impact IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 23 | Circle Impact III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 24 | Circle Impact II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 25 | Circle Impact I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 26 | Circle Vanguard V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 27 | Circle Vanguard IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 28 | Circle Vanguard III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 29 | Circle Vanguard II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 30 | Circle Vanguard I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 31 | BUKLOD Prime V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 32 | BUKLOD Prime IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 33 | BUKLOD Prime III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 34 | BUKLOD Prime II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 35 | BUKLOD Prime I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 36 | BUKLOD Prime Elite V | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 37 | BUKLOD Prime Elite IV | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 38 | BUKLOD Prime Elite III | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 39 | BUKLOD Prime Elite II | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |
| 40 | BUKLOD Prime Elite I | Existing canonical server Circle Rank BP threshold; **not specified by this art catalog** |

## E. Special Character unlock gates

| Special Character | Canonical required Circle Rank order (not raw BP) |
|---|---:|
| Ace | 5 |
| ELESUR | 6 |
| Jawo | 7 |
| Mitch | 8 |
| Niel | 9 |
| Angel | 10 |
| Vhen | 11 |
| Trudice | 13 |

## F. Other rewards outside the 469 / 1,300 Character catalog

| Reward kind | Exact values or titles | Status |
|---|---|---|
| Weekly Performance | Emerging 1+, Active 25+, Thrive 60+, Exceptional 85+ with active-day and category diversity gates; one highest closed-week cosmetic recognition | Proposed, no backend awards |
| Season 2 four special awards | Beacon Trail Frame, Maker Ribbon, Alliance Crest, Constellation Finale Scene | Requires approved published source milestones; locked |
| Journey Token source | Today +2 once/day, KL +3 once/day, Wall post +2 once/day, meaningful comments +1 up to twice/day; max modeled 9/day and global cap 12/day | Source-only, mint/spend disabled |
| Journey Token optional cosmetic previews | Accessory finish 30, Gallery theme 60, skin variant 80, premium visual effect 150 tokens | Prices not final approved, purchases disabled |
| Kingdom Shards optional in-game purchases | Wisdom Lens 2, Guardian Shield 3, Explorer Compass 2, Emerald Aura 10 Shards | Separate Kingdom game-only economy; do not conflate with Journey Tokens |
| Main BP and QMP, QMP missions | Exact 46 active BP catalog, 16 inactive legacy, qualified QMP events/missions, monthly QMP bands | See economy master; grants require active server source |
| Season 2 special referral BP | Referrer 20 BP on verified eligible referred member rank gain; referred user 10 BP after independent qualification | New Season 2 target; legacy +10 rank bonus unreconciled |
| KL Chapter BP and comment bonus | `5 + chapter number` BP pending until next chapter, one +5 BP qualifying comment/chapter, +50 BP for complete series plus 50-character personal reflection | Not active Season 2 release |
| Rewarded ad energy | Optional example +1 Garden Energy after real earned ad callback; no BP/QMP/cash/Token grant | Current UI example, game grant unverified |

## G. Inclusion and anti-farming policy

Members need clear source-specific `How to earn`, `Why it matters`, proof, cooldown, and preview/claim/owned/equipped indicators. Real posting/learning remains available even when optional rewards are held. Show Faith is voluntary and nonfaith paths must have fair equivalents. Never gate ordinary learning, member access, legal withdrawal or historically earned balance on optional weekly challenges. Server alone decides eligibility and paid/pending status.

## H. Production embargo and release proof

Season 2 cannot automatically activate on December 6. It requires the independent BUKLOD Main staging backend, applied isolated RLS, signed/reconciled Season 1, verified replay/caps/offline proof, AdMob and immediate tab performance on Android RC, financial/legal identity gating, and exact SHA-bound separate owner approval. Catalog inspection and passing source tests alone do not satisfy these release gates.

**Source of truth:** `src/lib/buklodCharacterWorldCatalog.ts`, `src/lib/season2/buklodSeason2CollectibleGuideR1.ts`, `src/lib/buklodCircleRankArt.ts`, `src/lib/buklodKingdomShards.ts`.

## I. Exact Kingdom Shards sources and prices

- **+1 Shard** once for each independently credited first Kingdom game mastery (must match official +2 BP `game_first_qualified` ledger receipt, `game_id`-unique).
- **+2 Shards** once for each redeemed, canonical Character collectible with server-owned non-null `redeemed_at` (`collectible_id`-unique). Mere image/preview does not qualify.
- **Spend:** Wisdom Lens 2, Guardian Shield 3, Explorer Compass 2, Emerald Aura 10 Shards. These are permanent Kingdom practice powers, not Season 2 Journey Token cosmetics or cash.
- Existing private Shards sync function and wallet table were observed in the connected BUKLOD MAIN on November 19, 2026. This observation does not prove that every client has earned or spent those Shards.

## J. Complete proposed unlock criteria by badge family (source-only, not live)

These rules are a **proposed deterministic Season 2 target** for the already cataloged 469 named Character badges; they do not change Season 1 ownership and are NOT yet owner-final-approved or deployable grants.

| Badge family | Count | Exact proposed qualification |
|---|---:|---|
| Character signature | 13 | Canonical unlocked/selected Character; special rank gate if applicable; signed one-time entitlement |
| Stage Mastery | 260 | All five distinct I1-I5 collectibles certified by the server for a matching Character and level |
| Era Mastery | 65 | Four respective Stage Mastery badges completed: BEGIN 1-4, GROW 5-8, CONTRIBUTE 9-12, LEAD 13-16, LEGACY 17-20 |
| Character Mastery | 13 | All 20 Stage Mastery badges and all five Era Mastery badges for one Character |
| Character Journey badges | 52 | Journey Unlocked: canonical selected/unlocked Character; Collection Half-Way: 50/100 distinct certified items; Collection Complete: 100/100 items; Legacy Path Cleared: Character Mastery plus verified final Legacy mission or fair solo equivalent |
| Starter/asset badges | 58 | Server-owned, one-time starter entitlement for each catalog asset after Character unlock and special rank gate where applicable; not artwork alone |
| Shared series/world badges | 8 | Five Core Path: all 5 Core Character Mastery; Eight Special Path: all 8 Special Mastery; Thirteen World: all 13 Mastery; five named Era Circle badges: 13/13 corresponding Character Era Mastery certificates |

**Claiming:** one award per canonical badge/source key, server receipt, RLS/account and Character isolation, no retry farming, and no duplicate on season changes. All claim/ownership switches remain OFF. Existing earned badges persist; pending candidate criteria cannot retroactively relock them. None of these visual/title badges automatically adds BP, QMP, cash or a gameplay multiplier.

