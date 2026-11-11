import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const sql = read('supabase/migrations/20261111100000_buklod_canonical_admin_economy_snapshot_v1.sql');
const helper = read('src/lib/buklodCanonicalAdminEconomy.ts');
const ops = read('src/app/admin/economy-operations.tsx');
const home = read('src/app/admin/bayanihan.tsx');
const center = read('src/app/admin/reports-center.tsx');
const opsLibrary = read('src/lib/buklodR38AdminEconomy.ts');

test('admin snapshot is one verified Manila month and one consistent server response', () => {
  assert.match(sql,/security definer set search_path to ''/);
  assert.match(sql,/buklod_is_system_admin\(\)/);
  assert.match(sql,/p_period_key text/);
  assert.match(sql,/admin_get_buklod_pf_finance_console_v3\(v_key\)/);
  assert.match(sql,/admin_get_buklod_pf_qmp_readiness_v1\(v_key\)/);
  assert.match(sql,/admin_get_buklod_community_admob_estimate_v1\(v_key\)/);
  assert.match(sql,/v_finance->>'period_key'/);
  assert.match(sql,/v_qmp->>'period_key'/);
  assert.match(sql,/v_admob->>'period_key'/);
  assert.match(sql,/revoke all on function public.admin_get_buklod_canonical_economy_snapshot_v1\(text\)/);
  assert.doesNotMatch(sql,/\b(update|insert|delete)\s+private\./i);
  assert.doesNotMatch(sql,/\badmin_get_buklod_r38_economy_report_v1\b/);
});
test('canonical response fails closed on mismatched, incomplete or outdated settlement', () => {
  assert.match(helper,/snapshot\.source !== 'CANONICAL_FINANCE_V3'/);
  assert.match(helper,/snapshot\.finance\.period_key !== expectedMonth/);
  assert.match(helper,/snapshot\.qmp\.period_key !== expectedMonth/);
  assert.match(helper,/snapshot\.finance\.settlement\.period_key !== expectedMonth/);
  assert.match(helper,/!Array\.isArray\(snapshot\.finance\.financial_entries\)/);
  assert.match(helper,/\(0\[1-9\]\|1\[0-2\]\)/);
  assert.match(helper,/8 \* 60 \* 60 \* 1000/);
});
test('both System Admin report views use only the same canonical service', () => {
  for (const src of [home, center, ops]) {
    assert.match(src,/loadCanonicalAdminEconomy\(/);
    assert.doesNotMatch(src,/loadAdminBuklodR38EconomyReport/);
    assert.doesNotMatch(src,/admin_get_buklod_r38_economy_report_v1/);
  }
  assert.doesNotMatch(ops,/<BuklodCommunityEconomyAdminCard/);
  assert.doesNotMatch(ops,/adminResolveBuklodQmpEvent/);
  assert.match(home,/No finalized settlement for this month/);
  assert.match(center,/Missing settlement means not finalized, not zero revenue/);
});
test('month selection is explicit, with stale requests isolated', () => {
  assert.match(ops,/draftPeriodKey/);
  assert.match(ops,/requestSerial\.current/);
  assert.match(ops,/if \(generation !== requestSerial\.current\) return/);
  assert.match(ops,/!monthLoaded \|\| loading \|\| !snapshot/);
  assert.match(home,/draftMonth/);
  assert.match(home,/if \(next === monthKey\) void load\(\)/);
  assert.match(center,/loadCanonicalAdminEconomy\(manilaEconomyMonth\(\)\)/);
});
test('Finance reporting degrades safely when the separate payout queue fails', () => {
  assert.match(ops,/Promise\.allSettled\(/);
  assert.match(ops,/financeResult\.status !== 'fulfilled'/);
  assert.match(ops,/setSnapshot\(financeResult\.value\)/);
  assert.match(ops,/setQueue\(payoutResult\.status === 'fulfilled'/);
  assert.match(ops,/Withdrawal queue could not be verified/);
  assert.doesNotMatch(opsLibrary,/export (?:async )?function adminResolveBuklodQmpEvent/);
  assert.doesNotMatch(opsLibrary,/export (?:async )?function adminGetBuklodQmpMonthReviewQueue/);
});
test('unfinalized and provisional amounts are never presented as actual cash', () => {
  assert.match(helper,/if \(!finalized/);
  assert.match(ops,/formatSettlement\(settlement\?\.user_pool_php\)/);
  assert.match(ops,/financeMoneyOrUnavailable/);
  assert.doesNotMatch(ops,/settlement\?\.user_pool_php \?\? 0/);
  assert.match(center,/Provisional AdMob, not cash/);
  assert.match(home,/Provisional AdMob · separate noncash estimate/);
  assert.match(home,/Legacy R38 BCU\/RCU allocations and Community Wall analytics/);
});
test('money activation and payout gates are not altered', () => {
  assert.doesNotMatch(sql,/set\s+(?:economics_enabled|settlement_enabled|withdrawal_enabled|payout_processing_enabled)/i);
  assert.match(ops,/controls\?\.economics_enabled === true/);
  assert.match(ops,/controls\?\.settlement_enabled === true/);
  assert.match(ops,/qmpReadiness\?\.ready_for_finalization === true/);
  assert.match(ops,/adminFinalizeBuklodPfMonthV3/);
});
