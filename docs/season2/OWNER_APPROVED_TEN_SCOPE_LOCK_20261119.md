# BUKLOD Season 2 — Owner-approved 1–10 scope freeze (November 19, 2026)

**Authority:** The owner explicitly approved ONLY the ten areas already discussed. No unrequested feature insertion or removal, no app-wide theme changes. Freeze is recorded in `contracts/season2-owner-approved-exclusives-20261119.json`. This document does not approve production activation or spending.

**Production embargo:** At least until 2026-12-06 00:00 Asia/Manila. It remains locked afterward until a separately approved, exact-SHA production release with Season1 signed reconciliation, verified staging RC, AdMob/navigation evidence and no user-data regression. Staging previews do not authorize grants. Neither a code merge nor Dec6 launches anything automatically.

## Exact approved ten
1. **Rise Together — 13 Guides / 12 Weeks** (`rise_together_campaign`): 13 guides, four arcs, three optional paths and replayable prologue. Stage/source: **STORY_PREVIEW**.
2. **Journey Tokens / Noncash Wallet** (`journey_token_wallet`): Wallet, token earn/spend and cosmetics are source contracts only; no real grants. Stage/source: **BACKEND_HELD**.
3. **1,300 Character Mastery Items** (`character_mastery_1300`): 13 characters × 20 levels × 5 slots; prerequisite and benefits guide. Stage/source: **CATALOG_PREVIEW**.
4. **Weekly Performance Classification** (`weekly_performance_class`): Emerging / Active / Thrive / Exceptional; cosmetic reward intents held. Stage/source: **BACKEND_HELD**.
5. **Four Earned Seasonal Awards** (`four_season_awards`): Beacon Trail Frame / Maker Ribbon / Alliance Crest / Constellation Finale Scene. Stage/source: **AWARDS_HELD**.
6. **Kingdom & Cooperative Missions** (`kingdom_cooperative_missions`): Character-owned receipts, genuine cooperative evidence, solo alternatives. Stage/source: **BACKEND_HELD**.
7. **Foundation, Momentum & Fair Play** (`foundation_momentum_grace_antifarm`): 7+3-day grace, 2 optional 7-day Flex, server anti-farm and no BP/QMP deductions. Stage/source: **BACKEND_HELD**.
8. **KL Progressive Chapter BP** (`kl_progressive_pending_bp`): Chapter N: 5+N pending until chapter N+1 verified; chapter 30 rolls to next series. Stage/source: **BACKEND_HELD**.
9. **Season Carryover & Hall of Fame** (`seasonal_archival_carryover`): Signed archive before reset; preserve lifetime, monthly, per-character and finance. Stage/source: **BACKEND_HELD**.
10. **Qualified Referral Rank Reward** (`qualified_referral_rank_reward`): Conditional referrer +20 BP only on verified cluster-rank gain; referred +10 BP; avoid double grants. Stage/source: **RECONCILIATION_HELD**.

## Implementation and isolation (evidence-driven)
- Existing Story Journey and 13 character previews are read only, and the 1,300 item guides describe requirements without issuing items.
- The wallet, token purchase, weekly foundation, outbox, mastery and server season archive still need a distinct BUKLOD Main staging backend, verified authenticated adapters/RLS, concurrency replay, no-cost approval and production launch gates. There is no verified isolated staging database at this writing. They MUST NOT be pointed at the live Main/Connect or Quiz Supabase databases.
- Weekly performance classification is queued source-only in PR #965. New KL pending chapter formula source is in PR #973; its SQL must not be applied on the live database until isolated integration is approved. Both are part of the approved list, not a license to merge their backend changes into production.
- Conditional +20 referrer / +10 referred award must reconcile the existing verified server rule, NOT award a second Season2 referral bonus for a referral already credited.
- No extra content or theme overhaul is permitted by this scope.
- The safe staging output can show the ten approved items, prerequisites, and explicit LOCKED descriptions with all reward/action switches OFF. This is NOT equivalent to fully verified live functionality.
- A physical device verification waiver is not a test pass. No staging OTA should be attempted when Expo zero-charge billing cannot be positively proven; last attempt 7 blocked as `NONZERO_OR_UNKNOWN_BILLING`.

## Scope change control
Any insertion/removal or policy change needs a new explicit owner decision and reviewed proposal. The gate `scripts/season2-owner-scope-lock.cjs` is run in source CI and staged release checks. Keep `main` and the canonical Season1 production runtime untouched. Release proceeds DEV → verified staging RC → explicit owner-approved Production OTA no earlier than Dec6.
