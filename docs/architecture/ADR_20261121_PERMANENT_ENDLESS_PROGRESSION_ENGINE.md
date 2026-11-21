# ADR-2026-11-21: Permanent Endless Progression Engine
**BUKLOD owner decision — APPROVED design direction**  
**Status:** Permanent product/architecture contract; implementation NOT yet verified  
**Scope:** BUKLOD MAIN Season 2 Genesis and all future seasons, including Character, Circle Rank, Lot, House, Cluster, Organization, Community, Kingdom, Market, Empire and Arena.  
**Repository isolation:** This ADR lives on a DEV-only branch. It is not permission to merge, publish an OTA, modify production SQL, or change the live APK.

## 1. Non-negotiable vision
Endless meaningful progress must NOT depend on creating endless new art, sound, maps, items, characters or features. Existing reusable assets and properly verified gameplay/community activity must support durable, visible progress for years. New content remains an additive option; it is not a prerequisite to continue progressing.

Progress should be **earned, visible, useful and socially meaningful**. Repeating a number without changing the user experience is not sufficient. No season reset may erase permanent levels, legally earned inventory, audited lifetime BP, contribution history or other protected progress.

## 2. Three permanent progression layers
1. **Finite visual development:** Personal Lot, House, Cluster development and other major constructible assets have distinct permanent Levels 1–10. Each level requires several progressive visible construction milestones (ground markers, foundations, frames, walls, roofing, amenities and expansions as appropriate), with realistic but increasingly demanding material, time, verified contribution and Development XP requirements. Tracks are independent; neither Circle Rank nor a season cosmetically gates these development tracks.
2. **Unbounded mastery:** After a track reaches its applicable major-level cap, mastery continues as M1, M2, M3... Mastery measures verified specialization, maintenance, redesign, community impact and achievement; it is not an unlimited multiplier to earnings or combat damage. Use existing modular visual states, decor/layout permutations, VFX, ambient audio, upgraded scene behavior, achievement presentation and unlockable configurations. Unlocks must have demonstrable visual or functional value; milestone labels alone are not enough.
3. **Repeatable varied challenges:** The challenge engine recombines existing maps, enemy behaviors, item use, approved tasks, objectives and environmental conditions using server-versioned templates and seeds. It has role-aware difficulty, caps, diminishing repeated-reward value, viable alternative paths, fairness constraints and anti-farming. Never fabricate a new canonical item or claim a piece of art is a newly owned item.

## 3. Authority boundaries per system
| Domain | Permanent progression | Authoritative invariants |
|---|---|---|
| Circle Rank | Lifetime *earned* BP from verified participation | Credit earned BP once at original valid source; transfer, sale, purchase, donation, return, wallet movement and challenge escrow do NOT add lifetime earned BP, or QMP |
| Character (13 canon) | Each Character's own persistent L1–L20, 5 collectible slots per level (1,300 canonical entries), and bounded post-cap mastery | BP establishes level eligibility only; verified required item receipts + tasks enact evolution; changing Characters cannot reset another Character's progress; ownership is server-authoritative |
| Character fairness | Equivalent obtainable mandatory items | When Show Faith is OFF, an equivalent non-faith path exists for every mandatory item/level, with comparable difficulty/time; no compulsory religious activity |
| Lot / House | Independent L1–L10 staged builds, then mastery | Permanent physical progress; earned inputs verified; no season-based reset |
| Cluster / Organization / Community | Independently verified development, cooperation, reputation and projects | Per-member and per-scope contribution receipts; quorum, independence and fraud review for cross-community projects; community challenge reward budgets are not personal earned BP |
| Business / Market | Expansion, customization, reputation and earned sales records | Business operation and transactions cannot mint BP; selling permitted goods can transfer only existing legitimate spendable BP via transactional settlement, never duplicate earned lifetime totals |
| Kingdom / Empire | Persistent construction/equipment ownership, mastery and dynamic exploration | One inventory provenance and validated transfer authority, never a shadow wallet; use existing item/media library, additive new content permitted |
| Arena | Real-time competitive seasons, promotion/demotion, skill and equipment mastery, win/loss | Genuine server-decided results, ranked Diamond deductions where applicable, capped combat eligibility and fair matching; infinite mastery must not grant infinite PvP strength; historical BP and item ownership never erased by ranked losses |
| QMP and finances | Existing separately governed distribution logic | No generation from Mastery, business tasks, speculative trading, arena simulation, or wallet movements; independent settlement and anti-fraud gates |

The 1–10 development-level cap does **not** replace the canon Character L1–L20. Arena in-match XP and temporary combat resources are NOT persistent Character levels, BP, Diamonds or inventories.

## 4. Player-facing progression experience
Every eligible asset/character/community has:
- Current major level and stage, current mastery, exact next objective, owned/required materials, visible progress and transparent estimated effort.
- Before/after construction states, nearby attainable tasks, required verified receipts, stable completed history, and genuinely unlocked layouts/equipment/abilities where permitted.
- Separate customization and recognition (non-power), with user-selected layouts from prelicensed/owned assets. No requirement for a new illustration at every mastery point.
- Clear disabled/locked states with alternative acquisition path. Offline work can queue *intent* safely but may not award authoritative progress until verified server reconciliation.
- Consistent Genesis seasonal appearance as a centralized cosmetic overlay. Future seasons may restyle existing progress, never revoke it.

## 5. Technical contract (implementation target)
An authoritative, versioned Progression Rules Registry defines tracks, templates, major-level stages, mastery thresholds, asset permutations, reward policies and source-verification adapters. Implement separate domains with a common event contract rather than a single mixed wallet or single global level.

Suggested logical records (design only; NOT a migration): progression_tracks, progression_instances, progression_milestones, verified_activity_events, reward_ledger, item_provenance_receipts, community_contribution_attestations, challenge_templates, challenge_instances, seasonal_cosmetic_overlays, audit_events.

Required event fields include server-owned actor and scope identity, event type, immutable source/reference, policy version, deduplication/idempotency key, verification status, occurrence time, canonical ownership, and optional rollback/reversal reference. Client-submitted quantities, signatures, rank/results, item ownership and balance are never authoritative.

For requirements use a monotone increasing but bounded-cost curve, for example a tunable sublinear/logarithmic or capped multiplicative mastery-cost growth beyond major levels, with periodic meaningful goal variety. The target is **perpetual attainability**, not unbounded inflation, unfair grind or numeric overflow. Persist counters as safe integer representations; define overflow/archival behavior and retain audit traceability. Any future configurable mastery rewards must be separately reviewed for duplication, inflation, seasonal manipulation and nonfaith parity.

## 6. Anti-abuse, concurrency and economy protections
- Source-event deduplication and idempotent processing: one actual action cannot create multiple earned BP awards, item receipts, mastery claims or transfers.
- Server-verified task completion, participation provenance, rate limits, cooldowns and anti-collusion checks; no self-approval of a materially rewarded two-party challenge.
- Atomic wallet/item transfers with escrow and audit, row locking/transaction isolation where applicable, cancellation/timeout/reversal behavior, no negative balances, and tamper-resistant scope validation.
- Distinct ledgers for *spendable BP balance*, *lifetime earned BP*, *QMP*, *nontransferable Character Diamonds* and *community challenge reserves*. Match-only resources are ephemeral.
- Repeatable tasks can award repeatable *mastery progression* within verified anti-farming rules; do not assume unlimited repeatable BP/QMP minting.
- Fail closed on unverifiable ranked results, forged item receipts, untrusted offline caches, stale concurrent progress, or unverifiable economic sources.
- Protect privacy, user consent and minimal role-based data access with Supabase RLS and server-owned functions; service-role credentials never shipped to the client.

## 7. Required acceptance gates before any live behavior
1. **Catalog reconciliation:** Link all canonical 13×20×5 item keys, existing Lot/House/Cluster staged Level 1–10 contracts, actual inventory provenance and already approved Arena/gameplay rules; no duplicate parallel authority.
2. **Behavior tests:** Stage transitions; M1/M100+ continuity; consistent threshold calculations; legacy state migration; item acquisition with Show Faith OFF; character switch preservation; visual state correctness and season cosmetic swaps without lost progress.
3. **Integrity tests:** Duplicate and reordered events; concurrency races; same receipt replay across tracks; wallet conserved across sales; transfer cannot credit lifetime BP; no business/QMP inflation; item forgery, fake tasks, collusive challenges and reversed or timed-out transactions.
4. **Gameplay tests:** Arena MMR/matchmaking and rank demotion with separate Diamond authority; caps for new versus veteran players; reliable real-time results; no client/offline settlement or pay-to-win.
5. **Reliability/performance:** Large history pagination, weak networks/reconnect, independent track recovery, offline replay safety, bounded writes/queries, efficient art/audio reuse and performance on low-end Android.
6. **Release:** DEV evidence -> exact frozen RC and staging device/runtime/AdMob/navigation/privacy checks -> owner-authorized consolidated production release. Main production app, Supabase, Play APK/AAB and OTA remain untouched until every applicable gate passes. Respect existing Season 2 embargo and release authorizations.

## 8. Change control and compatibility
This is a permanent cross-season *direction*, not an irrevocable numerical balance sheet: balancing factors, content variety and media may improve without changing the fundamental rules. Any later exception to BP earning, item eligibility, power caps, Show Faith parity, community proof or progress permanence requires explicit owner approval, documented migration impact, focused regression tests and an updated ADR. Existing Arena canonical gameplay contract remains authoritative for match mechanics; this ADR governs how long-term cross-BUKLOD progression composes with that contract.

**Acceptance of this ADR is not acceptance of an implemented engine.** No production or staging deployment is asserted here.
