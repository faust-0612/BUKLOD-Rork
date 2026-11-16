import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.BUKLOD_TREASURY_TEST_CHILD) {
  test('Kingdom Treasury journey behavioral suite executes with Node TypeScript stripping', () => {
    const run = spawnSync(process.execPath, [
      '--experimental-strip-types', '--test', fileURLToPath(import.meta.url),
    ], {
      encoding: 'utf8',
      env: { ...process.env, NODE_TEST_CONTEXT: undefined, BUKLOD_TREASURY_TEST_CHILD: '1' },
      timeout: 15_000,
    });
    assert.equal(run.status, 0, (run.stdout || '') + (run.stderr || ''));
    assert.match(run.stdout, /# pass 7/);
  });
} else {
const { buildKingdomTreasuryJourney } = await import('../src/lib/buklodKingdomTreasuryJourney.ts');

const catalog = Object.freeze([
  { key: 'wisdom_lens', name: 'Wisdom Lens', price: 2 },
  { key: 'guardian_shield', name: 'Guardian Shield', price: 3 },
  { key: 'explorer_compass', name: 'Explorer Compass', price: 2 },
  { key: 'aura_emerald', name: 'Emerald Aura', price: 10 },
]);
const snapshot = (ownedItems = [], balance = 0, source = 'server') => ({ ownedItems, balance, source });

test('fresh verified user has no fictitious unlocks and a concrete next goal', () => {
  const s = buildKingdomTreasuryJourney(snapshot([], 1), catalog);
  assert.equal(s.ownedCount, 0);
  assert.equal(s.completionPercent, 0);
  assert.equal(s.next?.price, 2);
  assert.equal(s.shardsAway, 1);
  assert.equal(s.steps.some(i => i.canUnlock), false);
});
test('only server-owned keys count; duplicates and foreign keys never inflate progression', () => {
  const s = buildKingdomTreasuryJourney(snapshot(['guardian_shield', 'guardian_shield', 'foreign'], 5), catalog);
  assert.equal(s.ownedCount, 1);
  assert.equal(s.completionPercent, 25);
  assert.equal(s.steps.find(i => i.key === 'guardian_shield')?.canUnlock, false);
  assert.equal(s.steps.find(i => i.key === 'wisdom_lens')?.canUnlock, true);
});
test('offline cached holdings remain visible but cannot authorize any purchase', () => {
  const s = buildKingdomTreasuryJourney(snapshot(['wisdom_lens'], 100, 'cached'), catalog);
  assert.equal(s.ownedCount, 1);
  assert.equal(s.steps.some(i => i.canUnlock), false);
  assert.equal(s.source, 'cached');
});
test('unavailable records never display an unverified entitlement', () => {
  const s = buildKingdomTreasuryJourney(snapshot(['aura_emerald'], 100, 'unavailable'), catalog);
  assert.equal(s.ownedCount, 0);
  assert.equal(s.steps.some(i => i.canUnlock), false);
});
test('all purchased permanent powers show completion without a phantom next reward', () => {
  const s = buildKingdomTreasuryJourney(snapshot(catalog.map(x => x.key), 0), catalog);
  assert.equal(s.ownedCount, 4);
  assert.equal(s.completionPercent, 100);
  assert.equal(s.next, null);
  assert.equal(s.shardsAway, 0);
});
test('empty catalog is safe and duplicate catalog IDs fail closed', () => {
  assert.equal(buildKingdomTreasuryJourney(snapshot(), []).completionPercent, 0);
  assert.throws(() => buildKingdomTreasuryJourney(snapshot(), [catalog[0], catalog[0]]), /duplicate/);
});
test('invalid balances cannot show spend eligibility', () => {
  assert.equal(buildKingdomTreasuryJourney(snapshot([], Number.NaN), catalog).steps.some(x=>x.canUnlock), false);
  assert.equal(buildKingdomTreasuryJourney(snapshot([], -100), catalog).shardsAway, 2);
});

}
