# BUKLOD Character Evolution — complete logic and authority schema (DEV candidate)

**Status:** DEV source design and changeset only. No numbered migration, isolated database validation, staging acceptance, production migration or production OTA has occurred. The backend changeset is `supabase/changesets/character_bp_verified_items_faith_neutral_v1.dev.sql`; do not run it on live production. This document is the implementation contract, not evidence of deployment.

## 1. Four independent progression authorities

| Authority | Canonical value | Can it advance Character visuals? | Can it create BP? |
| --- | --- | --- | --- |
| Circle Rank | Existing lifetime verified BUKLOD Points ledger and rank RPC | **No** | Existing separate audited BP-reward system only |
| Character BP eligibility | Verified BP earned while that character was active, persisted separately across switches | **No, unlocks eligibility only** | No |
| Character evolution item inventory | Private per-user/per-character/per-level verified item receipt | **Yes, only alongside BP eligibility and all required slots** | No |
| Character equipment/cosmetic inventory | Existing character-specific cosmetics, artwork, profile effects, badges | **No — displaying or redeeming cosmetics is not an evolution receipt** | No |

No points deduction or conversion occurs when claiming an item. BP is neither sold, wagered, minted by businesses, nor issued by this system. QMP, cash, Bayanihan, Cluster BP and War Challenge results are separate authorities.

Each of the 13 Character IDs — phan, quin, van, christian, lhen, jawo, trudice, ace, mitch, niel, angel, vhen and ellusur — has its own checkpoint BP and permanent earned item records. A switch never resets, copies or spends another Character's progress. Special Character **access** keeps its existing Circle Rank gate; character **evolution** additionally requires its own verified items, even after access is unlocked.

## 2. State machine / formal invariant

For user `u`, character `c`, and transition `L → L+1`:

- `BPearned(u,c) = saved_character_BP + max(0, current_lifetime_BP - active_selection_baseline)` for the active character; inactive characters use their saved checkpoint only.
- `EligibleBPLevel(u,c) = level_for_delta(BPearned(u,c))` on the existing 20-level BP threshold table. Any valid pre-cutover visible level is a protected lower bound.
- `RequiredSlots(L) = 2` at L1–4, `3` at L5–9, `4` at L10–14, `5` at L15–19, `0` at L20.
- `HasAllItems(u,c,L) = every required (u,c,L,item_index) receipt was server-issued from qualifying evidence`.
- `VisibleLevel(u,c)` starts from `LegacyFloor(u,c)` (or L1 if none), and advances sequentially one transition at a time **only while** `EligibleBPLevel ≥ L+1 AND HasAllItems(u,c,L)`.

Permitted states: `BP_LOCKED` (can earn materials early, no level change), `ITEMS_PENDING` (BP ready, one or more items missing), `CLAIMABLE` (verified requirement reached; authenticated item claim pending), `READY_TO_EVOLVE` (all stage items owned and BP ready), `EVOLVED` (server computes next visible level), `MAX_LEVEL` (L20). No local action, animation, UI preview, social rank, costume, or point threshold changes `VisibleLevel` on its own. A claim does not retroactively unlock skipped levels.

**Example:** a Phan L4 user qualifies for BP Level 5 but has only one of two L4-stage item receipts. The actual visual remains L4. A second verified item raises the actual level to L5 without deducting BP. If the user switches to Quin, Phan's checkpoint, level and items remain unchanged; Quin has separate BP and item receipts.

## 3. Exact Character BP threshold table (pre-existing, not changing)

| Level | Character BP earned | Level | Character BP earned |
| ---: | ---: | ---: | ---: |
| 1 | 0 | 11 | 50,000 |
| 2 | 50 | 12 | 75,000 |
| 3 | 100 | 13 | 100,000 |
| 4 | 250 | 14 | 150,000 |
| 5 | 500 | 15 | 200,000 |
| 6 | 1,000 | 16 | 250,000 |
| 7 | 2,500 | 17 | 300,000 |
| 8 | 5,000 | 18 | 350,000 |
| 9 | 10,000 | 19 | 400,000 |
| 10 | 25,000 | 20 | 500,000 |

These are **per-character verified BP eligibility thresholds**, not the global Circle Rank threshold list. The value is not a currency cost. BP already earned toward a character is preserved while inactive.

## 4. Item count, asset mapping and attainable difficulty

There are 20 × 5 = 100 story-asset slots per Character, **1,300 across 13 Characters**. A new non-grandfathered Character needs 68 mandatory transition receipts for L1→20: 8 across L1–4, 15 across L5–9, 20 across L10–14, and 25 across L15–19. Nonmandatory art slots and existing special collectible rewards remain cosmetic. A mandatory earned item receipt is stored separately and maps to the asset key `character_id:L{two-digit from_level}:I{item_index}`, for example `phan:L04:I2`. That identifier is immutable and cannot be forged by submitting a local image or a legacy cosmetic ID.

| Transition | Required slots | Verified normal route | Equal non-faith alternative |
| --- | ---: | --- | --- |
| L1–4 → next | 1, 2 | Meaningful public Wall post; helpful public Wall comment | Verified first Kingdom mastery may count for each slot |
| L5–9 → next | 1, 2, 3 | Above, plus qualified public reaction | Verified first Kingdom mastery may count for slots 1–3 |
| L10–14 → next | 1, 2, 3, 4 | Above, plus qualifying public share | Verified first Kingdom mastery may count for slots 1–4 |
| L15–19 → next | 1, 2, 3, 4, 5 | Above, plus distinct active BUKLOD weeks | Kingdom may substitute 1–4; active-week requirement for slot 5 is never replaced with game replays |

Every source must have verifiable real activity and a bounded daily/weekly cap. Existing Public Wall validators reject low-quality/duplicate content, self-comments, hidden/deleted sources at creation, abusive reaction patterns, and non-public/scope-ineligible events. Verified Kingdom mastery must come from a canonical claimed server ledger event, never a client-submitted score. No purchase, item sale, merely running a business, inviting fake accounts, or uploading unverified photo may create mandatory receipts.

**Finite cumulative quotas.** For a required item with index `i` at transition `L`, its target is the sum of the following per-step quota from `max(protected_floor,first_tier_of_item_i)` through L. The first eligible tiers for indexes 1–5 are L1, L1, L5, L10, L15. Per-step quotas:

```text
slot 1, meaningful posts:       1 + floor((step-1)/4)
slot 2, helpful comments:       2 + floor((step-1)/4)
slot 3, eligible reactions:     3 + floor((step-1)/3)   (starts L5)
slot 4, verified shares:        1 + floor((step-1)/5)   (starts L10)
slot 5, distinct active weeks:  1 + floor((step-1)/6)   (starts L15)
```

At L1 the first stage needs 1 post and 2 comments (or sufficient verified Kingdom mastery). L5 adds **4** reaction events for its first required reaction item. L10 adds **2** verified shares for the first share item. L15 adds **3 distinct active weeks** for its first weekly item, rising cumulatively at L16–19. Do not retrospectively charge weeks, shares or reactions for levels at which those items were not required. This avoids an impossible or artificially inflated first unlock for late-tier slots.

A valid Kingdom mastery receipt may count toward the aggregate for slots 1–4, but each mastery event is unique in the ledger, is first-time qualification only, and can be credited to one active Character. It is not replayable for unlimited items. The primary/Kingdom evidence counts are persisted on each receipt for audit. Quotas are cumulative and increase; repeated claims do not multiply receipts. Later tiers cannot be skipped using excess early BP.

## 5. Show Faith policy (ON and OFF parity)

- **OFF:** no Scripture, prayer, church role, Bible quiz, devotional, faith requirement, religious subscription, or faith-mode toggle may be a prerequisite to any mandatory evolution item. The verified public Wall / Kingdom routes remain reachable to every member and must always complete the full L1→L20 path.
- **ON:** the same full non-faith routes are still offered. Optional verified faith activities may later be added as an **extra** route, not as a stricter gate, but only when real server-side validators and equivalent attainable quotas are available. Optional faith reward eligibility is separate from mandatory item ownership.
- Preference changes cannot clear, regress, manufacture or invalidate saved item receipts, BP eligibility, visible levels, Circle Rank or cosmetics. Preference is read from the server profile/scope policy and must never be used as an authorization requirement inside the mandatory claim.
- Character story asset names may reflect each Character's canonical storyline; requirements shown to opt-out users must remain secular and avoid prompting them to switch on Show Faith.

**Non-faith opportunity must be realistic, not theoretical:** mandatory first-tier proof requires only low-quantity meaningful participation, later-stage requirements rise gradually, weekly goals are finite, and a member is not forced to spend, buy subscriptions, join a church, own a government ID for game progression, or find a particular religious community.

## 6. Database authority and indexes

**Existing unchanged authorities:** `public.buklod_user_points_balances` (global BP), `private.buklod_character_selection_v2` (active character/baseline), `private.buklod_character_progress_v3` (saved BP per character), `private.buklod_character_public_events_v3` (qualified public events), `public.buklod_points_ledger` (claimed verified Kingdom mastery), original cosmetic inventories and Circle Rank RPC.

**New private tables in changeset:**

| Table | Primary key | Important fields | Privilege |
| --- | --- | --- | --- |
| `private.buklod_character_evolution_legacy_v1` | (user_id, character_id) | legacy_level, recorded_at | One-time pre-cutover immutable floor |
| `private.buklod_character_evolution_activity_v1` | (source_kind, source_id) | user_id, character_id, metric_key, occurred_at | Server-trigger-only verified source receipt; indexed by user/character/metric |
| `private.buklod_character_evolution_items_v1` | (user_id, character_id, from_level, item_index) | asset_key (generated), earned_at, verified_metric_key, observed_event_count, primary_event_count, kingdom_event_count | Server-RPC-only item ownership; per-user/per-stage unique |

All three tables must have RLS enabled and direct `anon`/`authenticated` table access revoked. All public RPCs require `auth.uid()`; client never supplies user_id, item proof, BP threshold or character id to the item claim RPC. Private helpers and event triggers are not exposed to client roles. Only the active verified Character can claim current-stage materials.

Server RPCs: `get_my_buklod_character_selection_v2()` returns actual `character_level`, `character_levels`, `character_bp_eligible_level` and unchanged Circle Rank; `get_my_buklod_character_evolution_v1()` returns stage requirements, evidence counts and claim states; `claim_my_buklod_character_evolution_item_v1(from_level,item_index)` locks the account's character transition, recomputes authoritative evidence, inserts a unique receipt and returns the resulting stage. The existing core collectible helper is aligned to **actual gated visible level**, not BP eligibility, so legacy BP-auto-granted cosmetics cannot unlock future art prematurely.

## 7. Evidence adapters and future BUKLOD coverage

Only **Public Wall** and **verified Kingdom first mastery** have audited, connected server sources in this initial changeset. They are enough for the complete OFF/ON-neutral mandatory route. The following are future optional adapters: verified Cluster/Organization activities and real-world Bayanihan project milestones, attendance with two-sided evidence, approved learning or mentoring tasks, Connect community teamwork, Government Focus participation and helpful noncommercial marketplace/community contributions. Each adapter MUST supply authenticated source object ID, unique canonical event key, actual actor and eligible scope, validated time, evidence integrity, peer-collusion prevention, caps, moderation/revocation policy and idempotent award. Do **not** credit purchases, sales, game score self-reporting or an admin's unverifiable approval as mere item farming.

For a cross-community activity, both communities may independently confirm participation, but the canonical proof must also be independently checkable (e.g. event/check-in evidence, scoped role, timestamp), not just two collaborating approvals. Duplicate photos, self-votes, reciprocal approvals and repeated activity IDs give no additional item. Never label adapters that have not been connected and verified as live.

## 8. Migration, resilience and rollback

1. Read and freeze the authoritative production schema and current consolidated DEV branches. Review any concurrent Character changes first. This changeset is **not** a numbered migration.
2. In an isolated test backend, create a real migration using the CLI, then run exactly one legacy-floor snapshot **before** switching the getter. This backfill must never run again after gated progression begins.
3. Deploy and test event capture, indexed source receipts, per-character idempotency and the exact Character getter, including the existing core cosmetic helper. Old clients continue reading the getter but receive only server-capped visual levels; unavailable new RPC fails closed rather than awarding level/items.
4. Run private/anonymous/foreign-user permission tests, simultaneous character switch vs award vs claim tests, retry after lost response, forged task evidence, Show Faith toggle, weekly limits, all 13 Characters and all 20 levels, and pre-existing cosmetics. Validate item evidence revocation and moderation/fraud recovery policy before releasing. Unresolved evidence-revocation handling is a **release blocker**, not a claim of completed anti-fraud protection.
5. Verify Android GUI and navigation against current Genesis staging, prefetch/caching behavior, ad first-view and dashboard latency, source CI, exact runtime/package, and RC migrations. Promote only after DEV→verified RC→owner-approved production release gates; never change the live DB or OTA just because source compiles.
6. Rollback MUST preserve legacy floors, earned items and immutable activity receipts; revert RPC behavior or feature flag in a controlled forward migration rather than deleting history or recomputing the cutover snapshot.

## 9. Acceptance cases (must be automated in isolated test backend)

| Scenario | Required outcome |
| --- | --- |
| L1, enough BP for L2, zero mandatory items | Visible L1 |
| L1, one of two verified items | Visible L1 |
| L1, both items, BP below L2 | Visible L1, items preserved |
| L1, both items, ≥50 verified character BP | Visible L2 |
| Historical pre-cutover L10 at any valid BP snapshot | Never visually regress below L10 |
| Switching Phan→Quin→Phan | Independent BP, items and level restored |
| Same item retried after network failure | Exactly one receipt, current authoritative state returned |
| Claimed item from another account / inactive Character / wrong stage | Forbidden or no cross-character grant |
| Cosmetic auto-awarded from BP but missing verified evolution receipt | Does not satisfy item gate |
| Show Faith OFF through all levels | Every mandatory slot has a non-faith verified route |
| Public Wall duplicate, hidden, self-reaction or invalid source | Does not create new verified evidence |
| Kingdom fabricated client score or repeated mastery ID | No new evidence; no fake item |
| Item 5 at L15 | Starts at three genuine distinct active weeks, not retroactive 27-week debt |
| Circle Rank, QMP, BP balances, AdMob | Unchanged by item claims |
| Simultaneous switch/claim/event and account relogin | Correct event attribution, isolation, no duplicate credit |

**Release state:** design and DEV source modifications only. The live Supabase backend was inspected **read-only** to confirm the legacy schema and Kingdom ledger event key; this is not a deployed feature.
