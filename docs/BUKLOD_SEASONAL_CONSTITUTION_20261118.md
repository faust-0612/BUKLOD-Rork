# BUKLOD Seasonal Constitution — proposal contract (2026-11-18)

Status: **DEV-only, not approved for production**. This document and `scripts/seasonal-constitution.cjs` supplement, not replace, existing Season 2 governance, drift monitor, production embargo, or release gates.

## Non-negotiable defaults
- Lifetime Circle Rank, per-character XP/levels, inventory, permanent badges, owned collectibles, verified history, memberships, and all financial balances/ledgers survive season transitions.
- Only seasonal score, seasonal missions and seasonal competition tier may be reset under published rules. Monthly rankings retain their separate monthly cadence.
- Character System owns XP/items/badges; Kingdom consumes verified states. Finance/QMP is not a seasonal reward ledger.
- Multiple accessible participation tracks: faith/formation, social/community, mentorship/service, creative/exploration and cooperative cluster goals. No compulsory faith participation for unrelated participation; no reward farming via duplicate submissions.
- Each season needs its own theme, campaign, rewards, meaningful midseason additions, finale, immutable Hall of Fame snapshots and transparent member-facing rules.
- Publish token expiration and carry-over terms before earning; no silent forfeiture. Preserve user entitlement and audit trails.
- Season 1 production behavior and data are unchanged. No Season 2 production release before December 6, 2026 Asia/Manila AND separately recorded SHA-bound owner approval and existing verified gates.

## Change control
When an instruction conflicts with this constitution, produce a **warning with affected systems, user impact, migration/rollback plan, and tests** before changing it. Owner may explicitly approve a rule change; approval does not bypass financial integrity, security, evidence, or production release gates. Record the version, owner decision, effective season, code SHA and migration plan. No silent retroactive changes.

## Mandatory implementation inventory
1. Versioned server-authoritative season configurations, immutable historical results and member-visible effective dates.
2. Idempotent, transaction-safe rollover with concurrency locks, checkpoints, retries, reconciliation and dry-run reports.
3. Separate seasonal/lifetime/monthly rank projections and deterministic badge award ledger.
4. Per-character persistence, inventory ownership, crafting/cosmetic unlock rules and non-destructive migrations.
5. Multiple track eligibility rules, anti-farming and fair newcomer routes; explicit faith/non-faith separation.
6. Event token issuance/expiry policy and ledger proofs; independent QMP/AdMob/withdrawals.
7. Staging-only previews, fixture tests, migration rehearsals, recovery and rollback tests.
8. Production release embargo + owner approval + AdMob rendering and instant navigation regression gates.
9. Monitoring by exact build/runtime/OTA and rolling 15/30/60-minute windows; season-specific error budgets.
10. Owner-facing RED/YELLOW/GREEN alerting: notify only actionable exceptions; auto-retry safe transient failures; daily digest of nonurgent issues; no repeated alerts for same incident.

## Verification matrix
- Replay rollover twice: no duplicate awards, token changes or rank resets.
- Crash midway: resume from checkpoint with exactly-once externally visible outcomes.
- Parallel rollover workers: only one effective transition.
- Offline client sync after rollover: no lost comments, submissions, inventory or duplicated credits.
- New user and legacy user: equal published rules, correct historic rank.
- Character switch: each character retains prior level.
- Membership and lifetime rank remain unchanged.
- Ledger totals and withdrawable balances reconcile before/after.
- AdMob and navigation remain release blockers; validate device evidence.
- Missing monitoring or release evidence: no production promotion.

## Implementation accountability
Every inventory item must have code paths, migration IDs, focused tests, staging evidence and an owner-facing status of NOT STARTED / IMPLEMENTED / VERIFIED. A document or test stub alone is NOT implementation completion. Keep outstanding items visible until verified. CI should execute `node scripts/seasonal-constitution.test.cjs` and integrate `evaluateSeasonProposal` into proposal/change review; neither wiring is claimed complete by this document.
