import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buklodPinnedNavigationStorageKey,
  normalizeBuklodPinnedNavigation,
  toggleBuklodPinnedNavigation,
} from '../src/lib/buklodPinnedNavigation.ts';

test('pinned destinations persist under verified account-specific keys only', () => {
  const a='12345678-1234-1234-1234-123456789abc';
  const b='87654321-4321-4321-4321-cba987654321';
  assert.notEqual(buklodPinnedNavigationStorageKey(a),buklodPinnedNavigationStorageKey(b));
  assert.throws(()=>buklodPinnedNavigationStorageKey(''),/identity/);
  assert.throws(()=>buklodPinnedNavigationStorageKey('../other-account'),/identity/);
});
test('unknown admin/retired items, duplicates and excess pinned shortcuts are removed', () => {
  assert.deepEqual(normalizeBuklodPinnedNavigation(['wall','wall','admin','igpat','connect','settings','privacy','health']),
    ['wall','connect','settings','privacy']);
  assert.deepEqual(normalizeBuklodPinnedNavigation({}),[]);
});
test('pin/unpin preserves order and bounded cardinality without server behavior', () => {
  assert.deepEqual(toggleBuklodPinnedNavigation([], 'wall'), ['wall']);
  assert.deepEqual(toggleBuklodPinnedNavigation(['wall'], 'wall'), []);
  assert.deepEqual(toggleBuklodPinnedNavigation(['wall'], 'admin'), ['wall']);
  assert.deepEqual(toggleBuklodPinnedNavigation(['wall','connect','settings','privacy'], 'support'),
    ['wall','connect','settings','privacy']);
});
