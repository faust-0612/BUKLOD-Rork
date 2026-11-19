'use strict';
/**
 * Expo's authoritative Free plan has no overage billing:
 * https://docs.expo.dev/billing/plans/#plans
 *
 * The account:usage CLI can omit optional *estimated* billing fields. Never
 * interpret omitted estimates as a paid subscription. Require exact EAS owner
 * and explicit Free plan identity at release time; fail on reported nonzero
 * charges or malformed fields. No purchases, upgrades, builds or subscriptions.
 * Existing quota/rate limits remain enforced by Expo, and publication must
 * independently prove the actual staging channel served the expected bundle.
 */
const fs = require('node:fs');
const EXPECTED_EXPO_OWNER = 'faust_0612';

function acceptableCharge(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value === 0;
  return false;
}

function inspectFreePlan(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { free:false, reason:'UNRECOGNIZED_BILLING_RESPONSE' };
  if (data.account?.name !== EXPECTED_EXPO_OWNER)
    return { free:false, reason:'EXPO_ACCOUNT_IDENTITY_MISMATCH' };
  if (typeof data.account?.plan !== 'string' || data.account.plan.trim().toLowerCase() !== 'free')
    return { free:false, reason:'PLAN_NOT_PROVEN_FREE' };

  const estimate = data.billing?.estimated;
  // Estimates are optional on EAS Free and never an authorization to incur
  // charges. Reject any *explicit* nonzero or malformed estimate fail-closed.
  if (estimate != null && (typeof estimate !== 'object' || Array.isArray(estimate)))
    return { free:false, reason:'INVALID_BILLING_ESTIMATE' };
  const reported = [
    estimate?.recurringCents,
    estimate?.overageCents,
    estimate?.totalCents,
    data.updates?.overageCostCents,
  ];
  if (!reported.every(acceptableCharge))
    return { free:false, reason:'EXPLICIT_NONZERO_OR_INVALID_CHARGE' };

  return { free:true, reason:'VERIFIED_EXPO_FREE_PLAN_NO_OVERAGE' };
}

if (require.main === module) {
  let result = { free:false, reason:'BILLING_CHECK_UNAVAILABLE' };
  try {
    if (process.argv.length !== 3) throw Error('Expected private account:usage JSON');
    result = inspectFreePlan(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  } catch { /* Never print account/usage data or credentials. */ }
  console.log(result.free
    ? 'ZERO-COST EAS FREE PLAN CHECK PASSED'
    : 'ZERO-COST EAS PUBLISH BLOCKED: ' + result.reason);
  if (!result.free) process.exitCode = 1;
}
module.exports = { inspectFreePlan, EXPECTED_EXPO_OWNER };
