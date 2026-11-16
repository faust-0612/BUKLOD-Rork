# BUKLOD Kingdom — Living Relics & Mastery Badges V2

**Status:** architecture direction + safe read-only Treasury Journey prototype in isolated DEV. **Not a deployed reward or approved database migration.**
**Baseline:** `main` at `1aebc901e77089c7f3e926c76dfff4a4a8e34972` (source only).

## Reconciled existing foundations
- 13 character worlds × 20 levels × 5 story objects = 1,300 *catalog* collectibles. This is not the same as 1,300 verified owned objects; legacy `buklodCharacterCollectibles.ts` exposes the five core IDs. Protect existing server collection gates and special-character rank requirements.
- Character items: server-claimed `expression`, `speech`, `profile_frame`, `visual_effect`, `title_badge`. Badge trials currently pass 3/3 multiple-choice locally and explicitly grant **zero** BP, XP, Shards or cash.
- Treasury: four server-priced, persistent practice-only powers (`wisdom_lens`, `guardian_shield`, `explorer_compass`, `aura_emerald`), with verified/atomic spending. The Shard ledger uses only first verified mastery and claimed-collectible sources and is separate from BUKLOD Points and financial earnings.
- Visual tier finish (Bronze L1–4, Silver L5–9, Gold L10–14, Legendary L15–20) is a presentation of verified character level, not an independently earned badge tier.
- Existing gameplay progress and each character's level are independent. Switching characters cannot reset an inactive character.

## Proposed gameplay loop (design target, not activated)
1. **Discover**: see a silhouette of one story object, its meaning, source, and exact unlock requirement.
2. **Unlock + claim**: server verifies character identity, level and prerequisite. Never generate client-side entitlements.
3. **Awaken**: choose a themed task (different mechanisms by character: evidence, puzzle, dialogue, memory, stewardship). Reward clear audiovisual celebration and meaningful lore.
4. **Master**: progress from Bronze → Silver → Gold → Legendary based on *server-verified unique* achievements, not number of taps or repeats. Optional local practice never displays a cloud-certified badge.
5. **Equip and showcase**: one authoritative loadout per cosmetic slot per character, accessible on profile and in Kingdom; restore previous loadout when switching back.
6. **Legacy collection**: combine complementary earned badges into an album chapter and unlock only cosmetic scene effects, a player-selected title/frame, or new free practice variations. No cash, rank or real-world reward effect.

### Meaningful badges (target)
- **Explorer:** solve separate genuine game routes, not repeated identical prompts.
- **Guardian:** complete evidence/safety mini-challenges with feedback.
- **Wisdom:** pass distinct Bible/story comprehension and logic tasks, accessibility-first.
- **Steward:** complete verified collaborative tasks, with abuse/consent protections.
- **Legacy:** combine achievements across different days and skill types, no money requirement.

Avoid artificial random rarity, mystery purchase odds, timed loss of earned property, paid boosts, false superiority, or punitive streaks.

## Trust boundaries
```
Server-verified activity / character-level / game mastery
  -> policy catalog (stable versioned IDs + immutable milestones)
  -> transactional earned-claim receipt (unique user/character/milestone/source)
  -> user-owned item/badge ledger + per-character loadout
  -> read-only sync to app (cache keyed by authenticated user)
  -> presentation (animated reveal, wardrobe, journal, next challenge)
```

Future tables should be additive with RLS and authenticated ownership checks. Derive achievements from authoritative source records only; store idempotent receipts. Never trust client score, timestamp, ad view, redeemed amount, or quiz answer for credits. A cached client badge is expressly labeled practice only until server confirmation. Bound retries, reject stale responses from other signed-in accounts and reconcile unknown purchase outcomes with a fresh server read.

## Current scoped DEV change
- The read-only Shard Treasury path displays **owned / total**, a progress bar, four item icons and the cheapest next unowned power. It derives state from the existing verified `KingdomShardsSnapshot`; cached purchases are blocked, unavailable records grant nothing.
- No schema, migration, RPC, runtime/native dependency, scores, original games, ads placements, character levels, points or financial logic changed.
- The Hall of Legacy route remains the entry to existing badges; it is not represented as granting newly introduced master tiers.
- Focused behavioral tests verify progress, unknown/duplicate ownership, offline purchase lock, invalid balance and completion.
- Follow-on implementation requires separate additive backend/UX scope, SQL RLS/idempotency tests, full app QA, staging RC, then explicit release verification. Do not infer production readiness from this prototype.
