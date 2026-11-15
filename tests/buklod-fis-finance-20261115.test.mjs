import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const screen = readFileSync('src/app/admin/fis.tsx', 'utf8');
const model = readFileSync('src/lib/buklodFisReadModel.ts', 'utf8');
const nav = readFileSync('src/app/admin/index.tsx', 'utf8');
const manifest = JSON.parse(readFileSync('.buklod/scopes/buklod-fis-expo-20261115.json', 'utf8'));

test('FIS stays behind existing system-admin gate with canonical finance RPCs', () => {
  assert.match(screen, /<AdminGate>/);
  assert.match(screen, /loadCanonicalAdminEconomy/);
  assert.match(screen, /adminListBuklodR38Withdrawals/);
  assert.match(nav, /path="\/admin\/fis"/);
  assert.doesNotMatch(screen, /adminRecordBuklodPfFinancialEntryV3|adminFinalizeBuklodPfMonthV3|adminMarkBuklodR38WithdrawalPaid/);
});
test('financial amounts are not promoted from non-finalized estimates', () => {
  assert.match(model, /settlement\?\.status === 'FINALIZED'/);
  assert.match(model, /settlementNet: net/);
  assert.match(model, /journalPendingCount: pendingCount/);
  assert.match(screen, /finalized \? formatFisMoney\(value\) : '—'/);
  assert.match(screen, /No finalized allocations for this month/);
});
test('private payout details are not exported and CSV fields are sanitized', () => {
  assert.match(model, /createFisCsv/);
  assert.ok(model.includes('replace(/[\\r\\n]+/g'));
  assert.match(model, /replace\(\/"\/g, '""'\)/);
  assert.doesNotMatch(model, /payout_destination|account_name|destination_masked/);
  assert.match(model, /slice\(0, 2000\)/);
});
test('change scope explicitly preserves finance policy and app runtime', () => {
  assert.equal(manifest.contractVersion, 2);
  assert.ok(manifest.lockedFeatureChanges.some(group => group.id === 'app-runtime'));
  assert.ok(manifest.regressionTests.includes('tests/buklod-fis-finance-20261115.test.mjs'));
});
