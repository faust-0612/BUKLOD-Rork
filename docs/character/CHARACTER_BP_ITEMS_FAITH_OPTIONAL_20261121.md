# Character Evolution V1 — BP eligibility + verified items (DEV candidate)

Status: **DEV SOURCE ONLY / NOT DEPLOYED**. Generated changeset is in `supabase/changesets/character_bp_verified_items_faith_neutral_v1.dev.sql`. Not a numbered or applied migration. No live backend, RC, staging OTA or production mutation is authorized by this document.

## Canonical division of authority

- **Circle Rank** remains exclusively determined by lifetime **BUKLOD Points (BP)**, using the existing server rank function. There is no item prerequisite for Circle Rank.
- Each of the **13 Characters** retains its own BP earned while selected and its own saved state across switches. BP alone makes the *next Character level eligible*, never grants item ownership and never directly grants the appearance change.
- **Visible Character evolution** requires BOTH the existing BP threshold and authenticated server-verified **item acquisition receipts** for the current transition. No BP deduction, BP purchase, stake, cash, QMP or Bayanihan involvement.
- **Show Faith is never a prerequisite.** These mandatory tasks derive from already-validated, non-faith public social activity. Verified Kingdom first mastery is an alternative for items 1–4. Participation in Show Faith can remain voluntary and may later qualify through a separate *equally accessible* adapter, but turning it OFF never prevents any mandatory level.
- Character visual levels are *server-capped*. Clients must never calculate, grant, or force a level from BP, images, cosmetic collectibles, or local preferences.

## Graduated transitions (L1→L20)

| Transition from | Mandatory earned items | Available validated sources |
|---|---:|---|
| Level 1–4 | 2 | Meaningful public Wall posts; helpful public Wall comments; each permits first verified Kingdom mastery instead |
| Level 5–9 | 3 | Adds eligible public reactions or first verified Kingdom mastery |
| Level 10–14 | 4 | Adds qualifying public shares or first verified Kingdom mastery |
| Level 15–19 | 5 | Adds qualifying active weeks; this final gate cannot be substituted by repeated game actions |

Each item represents one of the Character's **1,300 existing named story-asset slots** (13 × 20 × 5). Only required slots per transition gate progress; other collectibles remain cosmetic. Requirements rise monotonically with level. Each level uses *cumulative activity since the Character's applicable baseline*, so identical social actions do not instantly satisfy every later transition. Requirements remain finite and visible in the user interface.

The source of truth is a private per-Character activity attribution table populated only by validated server events, plus a private per-transition item receipt table. The claim RPC checks `auth.uid()`, active Character, current stage, required verified event count, and idempotent item uniqueness. A client-supplied photo, point count, unverified post, arbitrary task declaration or cosmetic collectible cannot self-issue an evolution item.

## Existing assets and legacy protection

The pre-cutover actual BP-derived Character levels are snapshotted into a private **legacy floor** before the getter is changed. Existing earned levels, items, profile appearance, Circle Rank and activity history are preserved. A user resumes from their saved level and only performs new item tasks **after** that floor. Switching Characters cannot transfer BP or item receipts between them. A cutover is one-time; NEVER rerun the legacy backfill after enabling gated levels or it would improperly inflate floors.

Historical auto-redeemed core cosmetics are NOT treated as new evolution receipts, otherwise BP would indirectly bypass tasks. The legacy auto cosmetic feature should be reconciled separately with the visible level before launch.

## Verification and release gates

1. Reconcile this changeset against the most recent DEV branches and actual production schema/functions. Use `supabase migration new` in the checked-out project to create the correctly numbered migration. The Supabase CLI is unavailable in the current execution environment, so this document deliberately does not fabricate a migration filename.
2. Apply only to an isolated, authorized test database first; verify private grants/RLS, trigger event attribution, per-account and per-Character isolation, duplicate/retry idempotency, weak-network recoverability, Show Faith OFF, late switch, and cross-session behavior.
3. Test a BP-eligible L2 member with no items (must remain L1); award one verified item (still L1); award both (L2); then attempt replay, cross-character claims, wrong level, arbitrary game event, and historical cosmetic ownership (all must fail to bypass).
4. Test all 13 Characters and the 20-level thresholds, including legacy floor levels and lower-level new users. Verify zero regressions in Circle Rank, QMP, ad first-view and dashboard navigation. Confirm native visual parity using protected R31/R40 layouts.
5. Make the Special Character item task panel discoverable without bypassing the existing hard visual hash gate; backend gating already covers all 13. Do not promote before this UX gap is closed.
6. Follow DEV → verified RC → staging verification → owner acceptance → consolidated production release. No production database changes or OTA from this branch.

Known limitation: the initial verified sources cover Public Wall and Kingdom first mastery, not every Organization/Cluster/Government/Market action. Add new source adapters only after their authoritative validators, scope permissions, rate limits and evidence of anti-collusion are verified. Do not promise those adapters as live.
