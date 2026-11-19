# BUKLOD Season 2 — December 6 Full Points, Rewards, Requirements & Deductions Master Inventory

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
