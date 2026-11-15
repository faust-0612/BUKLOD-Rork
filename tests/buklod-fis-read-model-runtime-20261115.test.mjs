import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the actual FIS model without extra packages: the governance job
// intentionally runs Node tests before npm ci. Node 22 strips its TypeScript.
const source = readFileSync('src/lib/buklodFisReadModel.ts', 'utf8');
const dependency = /^import \{ getBuklodFinanceMonthCloseBlockers \} from ['"]@\/lib\/buklodFinanceMonthCloseBlockers['"];?$/m;
if (!dependency.test(source)) throw new Error('FIS finance dependencies changed: update focused test');
const isolated = source.replace(dependency,
  "const getBuklodFinanceMonthCloseBlockers = () => ['Finance controls not ready'];");
const js = stripTypeScriptTypes(isolated, { mode: 'transform' })
  .replace(/\bexport (function|const) /g, '$1 ');
const runtimeExports = vm.runInNewContext(
  js + '\n;({ previousFisMonth, buildFisReadModel, createFisCsv })',
  {}, { filename: 'buklodFisReadModel.stripped.js', timeout: 1000 });
const { previousFisMonth, buildFisReadModel, createFisCsv } = runtimeExports;

const specimen = {
  period_key: '2026-11',
  finance: {
    settlement: null,
    financial_entries: [
      { id: 'a', entry_type: 'AD_REVENUE', direction: 'CREDIT', amount_php: 25, reconciliation_state: 'RECONCILED', source_system: 'admob', created_at: '2026-11-10' },
      { id: 'b', entry_type: 'OTHER_COST', direction: 'DEBIT', amount_php: 10, reconciliation_state: 'RECONCILED', source_system: 'ops', created_at: '2026-11-10' },
      { id: 'c', entry_type: '=FORMULA', direction: 'CREDIT', amount_php: 999, reconciliation_state: 'ESTIMATED', source_system: '=bad', created_at: '2026-11-10' }
    ]
  },
  qmp: { ready_for_finalization: false }
};

test('actual FIS model rolls Manila months safely', () => {
  assert.equal(previousFisMonth('2026-01'), '2025-12');
  assert.equal(previousFisMonth('2026-02'), '2026-01');
  assert.throws(() => previousFisMonth('2026-13'));
});

test('actual FIS model excludes provisional entries and never converts estimates into cash', () => {
  const result = buildFisReadModel(specimen, null);
  assert.equal(result.journalReconciledCredits, 25);
  assert.equal(result.journalReconciledDebits, 10);
  assert.equal(result.journalPendingCount, 1);
  assert.equal(result.journalPendingAmount, 999);
  assert.equal(result.finalized, false);
  assert.equal(result.settlementNet, null);
  assert.equal(result.retained, null);
  assert.equal(result.closeReady, false);
  assert.equal(result.payoutDataAvailable, false);
});

test('actual FIS CSV export blocks spreadsheet formulas and omits payout credentials', () => {
  const csv = createFisCsv(specimen);
  assert.ok(csv.includes("'=FORMULA"));
  assert.ok(csv.includes("'=bad"));
  assert.ok(!csv.includes('payout_destination'));
  assert.ok(!csv.includes('account_number'));
});
