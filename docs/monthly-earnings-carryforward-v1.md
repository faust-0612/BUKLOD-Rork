# BUKLOD monthly earnings and canonical QMP-to-Finance consolidation

Status: **consolidated OTA source candidate; no production publish**.
Backend migrations are included in the same source candidate but are **not
applied to production**. Finance settlement and withdrawals remain OFF.

## Required user behavior

- **Last month**: fixed `FINALIZED` peso share for the specific prior month,
  or `Awaiting finalization` if source revenue is not reconciled and funded.
  No pending estimate can masquerade as finalized money.
- **This month**: changing AdMob estimate based on this month's qualified QMP
  / total eligible monthly QMP. It increases or decreases with revenue and
  relative contributions. Display as unavailable if the verified preliminary
  source is absent/stale.
- **Projected total** (not withdrawable) = canonical available finalized
  personal cash + verified current monthly estimate, excluding reserved and
  already paid. If estimate is missing, total is unavailable, not a fake zero.
- **Available finalized cash** carries forward independently from month to
  month, even with zero current QMP. Previous monthly history survives payout.
- **Withdrawal** needs a funded, finalized available cash balance of at least
  PHP 200 (config-driven), finance activation, approved payout profile, and
  no conflicting pending withdrawal. Current Finance V3 permits **one
  full-available-balance request**, not partial withdrawals; its reserve,
  cancel, failed payout and paid transactions are untouched by this change.
- Lifetime BP/rank is separate. One qualified QMP in the period allows
  proportional participation; one cent is the minimum cash payout unit.
  The existing largest-remainder allocation distributes exactly the funded
  user-pool centavos and may legitimately leave some tiny contributors with
  zero centavos if the pool itself is extremely small.

## Canonical accounting and identity

1. `private.buklod_community_qmp_accounts` (per Manila calendar month) is
   the **only** source of monthly distribution weights in Finance V3. The old
   `public.buklod_points_ledger` / historical rank does not allocate cash.
2. New and historical qualified accounts are linked to Finance person
   identities by the existing private identity link manager, after checking
   actual active auth/profile records. A retired identity cannot silently be
   restored, and self-service accepts only `auth.uid()`. No funding or
   referral qualification is invented during linking.
3. Qualification thresholds tied to individual attributed ad revenue remain
   relevant to referral earnings only; they no longer suppress a legitimate
   community QMP recipient's eligibility for the **30% user-pool weight**.
4. Only canonical `admin_finalize_buklod_pf_month_v3` can distribute the
   eligible user pool. Prior R38 and legacy Community finalizers cannot
   distribute the same month twice; the legacy Community-only finalizer
   becomes a deliberate error. Its former admin button is removed.
5. Canonical settlement requires: Manila month completed, QMP period exists,
   no held/pending contribution events, active/clear mapped identities,
   source-backed reconciled eligible revenue, zero legacy allocations,
   economics/settlement flags enabled, and the existing accounting/profit
   guards. Audit the finalization action and use unique settlement event keys.
6. Once successfully settled, both QMP events/accounts and QMP period become
   immutable; retries of a previously settled month return the existing
   settlement rather than paying again. Old finalized shares cannot be
   recomputed by new-month rank or withdrawal.
7. Qualified QMP review is admin-only with source excerpts and audited
   approve/reject actions. Hidden/deleted content cannot be approved without
   sufficient source evidence. Pending reviews **must be resolved** before
   financial close. Do not automatically invent qualifying points.
8. User-facing screens show only their own earnings, progress, estimate,
   finalized available cash, reserved/paid status, and withdrawal threshold.
   Gross AdMob revenue, pool allocation formulas and other users' amounts
   are for system admin accounting only.

## Exact source artifacts and ordered deployment

Changes are isolated to main BUKLOD-Rork. Apply DB migrations **in this order,
before the same-source Android Expo OTA and Expo Web build**:

1. `20261111015000_buklod_monthly_earnings_carryforward_readonly_v1.sql`
2. `20261111023000_buklod_qmp_canonical_finance_identity_v1.sql`
3. `20261111024500_buklod_pf_v3_qmp_single_settlement_v1.sql`
4. `20261111025000_buklod_pf_v3_monthly_summary_qmp_v1.sql`
5. `20261111031000_buklod_finance_qmp_readiness_audit_v1.sql`
6. `20261111032000_buklod_qmp_finance_review_queue_v1.sql`

Runtime changes: `src/lib/buklodMonthlyEarnings.ts`,
`src/components/BuklodUnifiedEarningsHomeCard.tsx`,
`src/app/community-contribution.tsx`,
`src/lib/buklodR38AdminEconomy.ts`,
`src/app/admin/economy-operations.tsx`,
`src/components/BuklodCommunityEconomyAdminCard.tsx`.

No native modules, secrets, Expo runtime version or package dependencies change.
Do not use Vercel/AWS or a separate mobile build. Use **one verified compiled
consolidated BUKLOD source SHA** when the other approved workstreams join.

## Verified evidence (2026-11-11)

- Source base `5efb99435243a4bcaeff27fc8d41d58b6a9969c2`
  (main at branch creation; reconfirm before consolidation).
- 306 distinct users have qualified Community QMP across September–November;
  148 had no Finance link on live backend.
- Six ordered migrations compiled in a **production database transaction**
  with 148 new links; simulated 362 total links, zero unlinked qualified
  contributors, no cash credits and no finalized settlements.
- The canonical November QMP sum matched the raw Community QMP sum in that
  same reversible transaction; the finalized-month write guard rejected
  a deliberate QMP edit as expected.
- **ROLLBACK was verified:** live Finance links remained 214, live cash
  ledger and Finance settlements remained empty, September QMP stayed
  OPEN, and the proposed new RPC was not persisted.
- 196 QMP review events were pending at audit (139 November, 53 October,
  4 September); those are **not automatically approved or paid**.
- No verified positive, finalized eligible Finance revenue statements were
  present. Backend gates remained economics=false, settlement=false,
  withdrawal=false, payout_processing=false.
- Contract regressions: `tests/buklod-monthly-earnings-carryforward-20261111.test.mjs`
  and `tests/buklod-qmp-finance-canonical-consolidation-20261111.test.mjs`.
  Physical-device verification is waived by owner; this is not a claim
  that the compiled OTA is live.

## Mandatory release checks and hard stops

1. Reconcile latest main, all approved other workstream branches and frozen
   RC before squash. **Never overwrite or release an older RC**.
2. Validate type-check/web build/relevant tests from the **exact merged SHA**.
   One consolidated CI/Expo cycle only; no standalone OTA or Vercel push.
3. Apply the six migrations once to the authorized production backend from
   the same source. Verify 0 unlinked qualified users, exact monthly QMP
   parity, 0 new cash credits, all financial flags still OFF; inspect auth,
   RLS, advisory and grants.
4. Open admin Economy Operations; confirm QMP review queue and readiness
   numbers match source records. The month-close button must remain disabled
   unless all server checks are true.
5. Freeze and publish one approved RC to Expo Android production channel
   and Expo Hosting Web only after the consolidated release gates pass.
6. **Never turn finance settlement or withdrawals ON merely for OTA.**
   They require finalized source statements, correct attribution,
   resolved monthly QMP reviews, money-profit reconciliation, funded
   payout reserves, compliance/identity approval and explicit audited
   finance activation.
7. Verify exact deployed update ID, runtime compatibility, app bundle SHA,
   web origin, backend migration hashes, and production functionality before
   calling the consolidated release live.

These gates distinguish **OTA source readiness** from actual monetary
distribution readiness. A preliminary AdMob API revenue snapshot is not
cash, and deploying the UI cannot finalize a user's prior month.

## Example

October finalized PHP 125; November provisional PHP 42.50 => projected
PHP 167.50, available PHP 125. November later reconciles PHP 40 =>
available PHP 165, immutable October PHP 125 and November PHP 40.
December finalizes PHP 50 => PHP 215 available: above PHP 200 threshold
but still subject to finance/payout activation. A full payout request
reserves PHP 215 once, so available becomes zero while original monthly
earnings history remains unchanged. Failure/cancel restores the reserved
balance exactly once.
