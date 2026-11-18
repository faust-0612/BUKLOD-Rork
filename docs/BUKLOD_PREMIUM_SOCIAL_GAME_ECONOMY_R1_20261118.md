# BUKLOD Premium Social Game Economy — R1

2026-11-18 | Parent #936 | **DEV design + disabled pure simulation; NOT a live reward system.**

## Verified authoritative systems

GitHub main source SHA d23cd882f7d34c4bca3a110dadd04ee4cb2240a9 was inspected. Read-only live Supabase SQL inspected project yhanxndaqbmuzbdqlblu. Exact installed Android OTA/update group was not established.

**BP**: Existing public.buklod_point_rules entries include community_post **5 BP**, community_comment **2 BP**, community_reaction **1 BP**, formation_lesson **25 BP**, event_attendance **10 BP**, bible quiz easy/medium/hard **3/6/12 BP** and prayer_response **2 BP**. KL direct verified chapter grant is **10 BP**; series of 30 verified chapters earns **50 BP**. Some point-rule caps are NULL: do not assume this means safe unlimited awards. Inspect actual triggers. Live KL completion RPC returns chapter_points=10 but erroneous points_awarded=5 for new chapter: separately fix with SQL regression; no historical recredit.

**QMP**: Active private.buklod_community_qmp_rule_versions community_qmp_v1 config records useful post **5 QMP**, qualified video **10 QMP**, meaningful reply **3 QMP**, creator's validated reaction **+1 QMP bonus** and internal share **+2 configured bonus**. Existing server verifies minimum 40 characters/legitimate media for posts, >=20 characters for meaningful comments, 7-day duplicate comments and excludes self-thread QMP. Caps: 250 monthly bonus, 25 per-content bonus, 30-event hourly velocity exclusion. Active QMP missions: 3 active days +20 QMP, 3 useful posts +15 QMP, 5 meaningful replies +10 QMP, 1 qualified video +15 QMP. Levels: STARTER 0–24, ACTIVE 25–74, CONTRIBUTOR 75–149, BUILDER 150–299, COMMUNITY CHAMPION >=300.

QMP is monthly source-verified participation **weight** for eligible finance person share of the designated **30% AdMob user pool** (live rule config pool_bps=3000). It is not an exchange rate: **1 QMP != fixed pesos**, and **1 BP != QMP**. private.buklod_pf_monthly_points_v3 calculates monthly qualified QMP, not lifetime BP. Monthly provider estimates are provisional; finalized, funded and withdrawable values follow independent settlement gates. Tokens, badges and item purchases must never mint QMP or change money.

**Character**: Per-character progression V3 persists BP-derived earned_points under private.buklod_character_progress_v3. Circle Rank stays lifetime BP. Existing 13-character x 20-stage x 5 collectible catalog holds **1,300 assets**, not automatic ownership. Existing collectible state/redeemed ownership and loadout stay authoritative. Kingdom Shards and Kingdom XP are separate game-only units. Open draft PR #879 is not live inventory. Existing CharacterEventAdapters are prepare-only and KingdomBadgeTrials local practice is not a server badge.

## The premium experience: delight, meaningful reasons to return, no forced tasks

Provide free starter character/outfit and a first-session 3-minute choice: Create / Connect / Learn / Explore. Give daily optional, source-backed cards for Today/Dugtong, KL, meaningful social reply, learning and Kingdom. Deliver a 7-day character-specific narrative and weekly themes with optional catch-up. Co-op Club/Cluster Quests reward real diverse contributions, not reciprocal spam or self-react rings. Friends' replies, ongoing community conversations, creator series, saved collections and joint milestones should naturally invite users back, without forced ads or endless notification spam.

Build profile/game showcase for Overall Circle Rank (permanent BP), Monthly QMP tier (finance participation), Active Character level (BP-derived), owned Character items, earned badges and optional seasonal Momentum. Never mix QMP with BP or show cash for unfinalized estimates. Support private/locked profiles and opt-out showcase.

### Feature award proposal — flags OFF

| Source | Existing BP/QMP | Optional Journey Token preview | Verification |
|---|---|---|---|
| Today/Dugtong | Weekly tip BP separate; QMP not established | 2 / first current-cycle/day | Accepted real Dugtong, no screen-open reward |
| Kabihasnang Ligaw | First verified chapter +10 BP; series +50 BP, no KL QMP known | 3 / unique chapter/day | Authenticated reading completion, quiz or temporary legacy gate |
| Original Wall post | BP catalog 5; qualifying post +5 QMP, video +10 QMP | 2 / qualified post/day | Accepted server source, moderation and duplicates |
| Meaningful comments | BP catalog 2, qualified meaningful reply +3 QMP | 1 each; max 2/day | Distinct creator/thread, anti-farm evidence |
| Reactions/shares | BP reaction 1, qualified creator QMP bonuses possible | 0 | Legitimate unique engagement, anti-self |
| Formation | BP catalog 25, no QMP established | 4 / first verified unit | Automatic server rubric, scope authorization |
| Main Bible quiz | BP easy3/med6/hard12; no QMP established | 3 / first verified daily quiz | Real Main quiz only, never standalone Focus Quiz |
| Nonfaith learning | Real eligible source still needs confirmation | 4 / qualifying unit | No fake task or cross-Focus credit |
| Community challenge | BP catalog 2; QMP only if separately verified | 3 / qualified challenge | Must confirm real source/UI before activation |
| Kingdom | Game-only mastery BP / Shard rules | 0 until verified integration | Never grant from local client victory |
| Child story | Child reward not verified | 0; private opt-in Story Explorer badge | Guardian/child privacy and safety review |
| Prayer | Existing prayer_response BP needs review | 0; private voluntary recognition only | Never evaluate sincerity or punish refusal |

**Fairness:** Illustrative Show Faith potential Today2 + KL3 + post2 + 2 comments2 + formation4 + Bible quiz3 = 16. Nonfaith uses equivalent 4 from verified general learning +3 community challenge, also 16. Both illustrative daily cap 12. **This is not a claim that all alternative Main source UIs already exist**; demonstrate real availability across scope types before activation.

### Items, badges and tokens

Do not sell permanent badges or the 1,300 earned level-gated collectibles. Character domain alone owns badge receipts, validated item ownership and loadout. Optional cosmetics bought using a future noncash Journey Token must be separate, auditable, and nontransferable. Proposed prices (OFF): accessory finish 30, gallery theme 60, skin variant 80, premium effect 150. Show Earned/Pending/Claimable/Owned/Equipped/Locked reasons and previews. No loot boxes, paid skip-to-level, in-app money conversion or mandatory rewarded ads.

### Inactivity and mission consequences

**Never deduct lifetime BP, qualified QMP, historical cash, level, items, or verified badges just for absence.** Those units relate to earned work and/or financial rights, and unstable connectivity makes punitive deductions unfair. Instead offer explicit opt-in **seasonal Momentum Points** (a distinct score, never BP). Disabled preview: +5 after server-confirmed active day; first **2 missed days grace**, then **-5 seasonal Momentum/day**, minimum zero; optional seasonal ladder placement can decline. Missed voluntary quest loses only its *unearned bonus*. Offline queued operations defer settlement; no prayer, child, medical, school, illness or network penalties. A real fraudulent grant may be reversed with evidence, authorization, audit and appeal in its original ledger. No generic BP-debit inactivity function.

### Integration architecture / gaps

P0: unify display language for BP vs monthly QMP vs provisional/available cash; audit uncapped BP triggers and source idempotency; repair KL summary discrepancy in an isolated SQL fix; durable offline sync; show faith/nonfaith real opportunity parity.

P1: server-owned source receipts, future optional token ledger and atomic wallet, append-only purchase/reversal and inventory integration; Character v3 level preservation; source-referenced true badge claims; item/gallery showcase; seasonal Momentum opt-in with grace.

P2: full 7-day story chapters, cooperative quests, social follow-ups, opt-in leaderboards and earned cosmetic catalog. Do not touch production auth, finance, AdMob, QMP, navigation, media or native runtimes as a side effect.

**Proof gate:** backend verifies auth.uid, event ownership, scope and Show Faith at event time, content moderation and canonical completion; no client input controlling amount, actor, score, source age or event timestamp. One immutable source id = one award, concurrent spend serialized, RLS deny by default, offline replay safe. Evaluate real data rates and actual source availability before any owner activation.

**Release:** DEV isolated branch and V2 scope contract -> focused Node + SQL security/behavior tests -> TypeScript/Expo and actual Android low-network validation -> exact staging RC and AdMob/instant navigation regression -> verified production OTA. No new DB table, credits or client wiring in this R1 commit. All switches stay OFF. No RC/OTA claimed.

Sources: GitHub main AGENTS.md; src/lib/buklodCharacterWorldCatalog.ts, src/lib/buklodCharacterSelectionV2.ts, src/lib/buklodCharacterEventAdapters.ts, src/features/games/kingdom/KingdomBadgeTrials.tsx, src/lib/buklodMonthlyEarnings.ts, supabase/migrations/20261111082405_buklod_qmp_automatic_qualification_v2.sql and 20261111085702_kl_verified_reading_10_series_50.sql; production Supabase read-only information_schema and QMP policy/functions. This source review does NOT verify every installed-client flow.
