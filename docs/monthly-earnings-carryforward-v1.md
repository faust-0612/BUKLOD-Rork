# BUKLOD monthly earnings: immutable past, live current, cumulative balance

Status: read-only UI/RPC candidate. Does **not** activate Finance V3 settlement,
withdrawals, AdMob disbursement, or migration of historical balances. Release
requires canonical QMP/Finance V3 reconciliation and finance controls.

## Accounting rules

1. **Monthly QMP** resets on the first day of each calendar month in
   `Asia/Manila`. It is a **weight** within that month's user revenue pool;
   lifetime points/ranks have no influence on current month's split. QMP events
   must be qualified, deduplicated, anti-abuse reviewed, and period-scoped.
2. **This month** is a preliminary, source-backed AdMob estimate weighted by
   the same month's qualified QMP. It can rise or fall as confirmed revenue,
   user QMP, or the pool denominator changes. It is never withdrawable.
   If AdMob data is absent or stale, display *unavailable*, not zero.
3. **Last month** is a historical row. Before *canonical* reconciliation show
   "Awaiting finalization" (not a cash amount). After one reconciled,
   funded, idempotent monthly settlement, freeze the user share in cents.
   Later QMP changes affect the new month, not the finalized month.
   A withdrawal never rewrites historical income.
4. **Previous months carry forward**: finalized credits accumulate in the
   canonical available cash ledger. A month with zero QMP still retains its
   prior finalized available cash. Month-by-month history remains visible.
5. **Withdrawable** is available *finalized, funded* personal cash ONLY,
   after a minimum available balance of PHP 200.00 and payout readiness checks.
   Current estimates, held QMP, reserved payouts, community funds, and unpaid
   provisional AdMob reports do not qualify.
6. **Projected balance for display** = available finalized cash + current
   preliminary monthly estimate, if both are known, explicitly labeled
   "not withdrawable." A balance in RESERVED is omitted from this projected
   available figure and displayed separately. Never add estimates to the
   finalized withdrawable amount. If current estimate is unavailable,
   projected total is unavailable rather than asserting an exact balance.
7. **After withdrawal request**: available cash transfers atomically to
   RESERVED (no second claim). On success, RESERVED moves to PAID. On
   cancellation/failure, it returns to AVAILABLE once. Every transition
   is idempotent; historical earnings stay unchanged. Existing canonical
   full-available-balance payout rule is preserved; partial withdrawals
   would require a separate audited policy change.
8. **Ledger integrity**: one canonical settlement per month; one user-month
   share; unique cash event key; no negative or unfunded credits; all user
   allocations sum exactly to funded user pool via largest remainder;
   retain fractions before centavo settlement; distinguish lifetime gross
   earned, available, reserved, paid and pending. Historical adjustments
   use explicit audited correction transactions rather than silent mutation.
9. **Privacy**: own-account authenticated read APIs only; never expose gross
   AdMob revenue, allocation percentages, or other users' shares in UI.
   Admin accounting separately retains those details.
10. **Backend release blockers (observed 2026-11-11)**: Community QMP
    accounts have active contributors while Finance V3 has zero activated
    CLEAR recipients; two different monthly-weight sources coexist.
    Finance V3 settlement/withdrawal gates are OFF, zero finalized
    settlements. Do not enable payout or backfill cash before reconciling
    identities, canonical QMP sourcing, revenue finalization, and
    double-entry reconciliation.

## Example

Month A settled: PHP 125 credited; Month B estimated PHP 42.50;
projected display PHP 167.50 but available withdrawal PHP 125.00.
If Month B ultimately settles for PHP 40.00, available cash increases to
PHP 165.00, and Month B's earnings history is immutable. If Month C
settles PHP 50.00, available becomes PHP 215.00 (meets PHP 200.00
amount threshold). Requesting a full available payout reserves PHP 215,
so available becomes 0 and projected display excludes that reserved
amount. Last Month, Month B, Month C historical earned figures remain
unchanged. Payout failures restore the reserved money once.

## AdMob cutoff

AdMob performance reports are estimated; source-of-truth finalized
earnings are Google Payments/transactions after invalid-traffic
adjustments. Official AdMob help:
https://support.google.com/admob/answer/6147072

Use a monthly period mapping to reconcile AdMob billing's timezone to
BUKLOD's Asia/Manila contribution window before funded settlement.
