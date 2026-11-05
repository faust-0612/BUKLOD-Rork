import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReconciliation } from '../scripts/staging-reconciliation-gate.mjs';

test('blocks a staging candidate that is behind canonical main', () => {
  const result = assessReconciliation({ baseOnly: 31, candidateOnly: 0 });
  assert.equal(result.status, 'BLOCKED_STALE_OR_DIVERGED');
  assert.equal(result.releaseAllowed, false);
});

test('blocks a diverged candidate instead of silently preferring either side', () => {
  const result = assessReconciliation({ baseOnly: 31, candidateOnly: 4 });
  assert.equal(result.status, 'BLOCKED_STALE_OR_DIVERGED');
  assert.equal(result.releaseAllowed, false);
  assert.match(result.reason, /forward-porting only approved deltas/);
});

test('allows a candidate that contains the entire canonical baseline plus isolated changes', () => {
  const result = assessReconciliation({ baseOnly: 0, candidateOnly: 7 });
  assert.equal(result.status, 'CANDIDATE_AHEAD');
  assert.equal(result.releaseAllowed, true);
});

test('reports exact sync when refs have identical history', () => {
  const result = assessReconciliation({ baseOnly: 0, candidateOnly: 0 });
  assert.equal(result.status, 'IN_SYNC');
  assert.equal(result.releaseAllowed, true);
});

test('rejects invalid ancestry counts', () => {
  assert.throws(() => assessReconciliation({ baseOnly: -1, candidateOnly: 0 }), TypeError);
});
