import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual FIS TypeScript implementation without bringing in an
// unavailable Jest/React Native runtime or changing its canonical finance source.
const source = readFileSync('src/lib/buklodFisReadModel.ts', 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const runtimeExports = {};
vm.runInNewContext(js, {
  exports: runtimeExports,
  require(id) {
    if (id === '@/lib/buklodFinanceMonthCloseBlockers') {
      return { getBuklodFinanceMonthCloseBlockers: () => ['Finance controls not ready'] };
    }
    throw new Error('Unexpected dependency in isolated FIS model: ' + id);
  }
}, { filename: 'buklodFisReadModel.transpiled.js', timeout: 1000 });
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
