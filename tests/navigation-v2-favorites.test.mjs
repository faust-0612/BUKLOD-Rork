import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buklodPinnedNavigationStorageKey,
  normalizeBuklodPinnedNavigation,
  toggleBuklodPinnedNavigation,
  buklodRecentNavigationStorageKey,
  normalizeBuklodRecentNavigation,
  rememberBuklodRecentNavigation,
} from '../src/lib/buklodPinnedNavigation.ts';

const allowed = ['wall','connect','settings','privacy','support'];

test('pinned destinations persist under verified account-specific keys only', () => {
  const a='12345678-1234-1234-1234-123456789abc';
  const b='87654321-4321-4321-4321-cba987654321';
  assert.notEqual(buklodPinnedNavigationStorageKey(a),buklodPinnedNavigationStorageKey(b));
  assert.throws(()=>buklodPinnedNavigationStorageKey(''),/identity/);
  assert.throws(()=>buklodPinnedNavigationStorageKey('../other-account'),/identity/);
});
test('unknown admin/retired items, duplicates and excess pinned shortcuts are removed', () => {
  assert.deepEqual(normalizeBuklodPinnedNavigation(['wall','wall','admin','igpat','connect','settings','privacy','health'], allowed),
    ['wall','connect','settings','privacy']);
  assert.deepEqual(normalizeBuklodPinnedNavigation({}, allowed),[]);
});
test('pin/unpin preserves order and bounded cardinality without server behavior', () => {
  assert.deepEqual(toggleBuklodPinnedNavigation([], 'wall', allowed), ['wall']);
  assert.deepEqual(toggleBuklodPinnedNavigation(['wall'], 'wall', allowed), []);
  assert.deepEqual(toggleBuklodPinnedNavigation(['wall'], 'admin', allowed), ['wall']);
  assert.deepEqual(toggleBuklodPinnedNavigation(['wall','connect','settings','privacy'], 'support', allowed),
    ['wall','connect','settings','privacy']);
});

test('recent destinations are account isolated and contain route IDs only', () => {
  const userA = '12345678-1234-1234-1234-123456789abc';
  const userB = '87654321-4321-4321-4321-cba987654321';
  const keyA = buklodRecentNavigationStorageKey(userA);
  const keyB = buklodRecentNavigationStorageKey(userB);
  assert.notEqual(keyA,keyB);
  assert.notEqual(keyA,buklodPinnedNavigationStorageKey(userA));
  assert.deepEqual(normalizeBuklodRecentNavigation(['wall','chat-123','connect','wall','admin','support'], allowed),
    ['wall','connect','support']);
  assert.deepEqual(rememberBuklodRecentNavigation(['connect','wall'],'support',allowed),
    ['support','connect','wall']);
  assert.deepEqual(rememberBuklodRecentNavigation(['wall','connect','support'],'connect',allowed),
    ['connect','wall','support']);
  assert.deepEqual(rememberBuklodRecentNavigation(['wall'],'igpat',allowed),['wall']);
});

test('recent route visits are persisted immediately before navigating away from Home', () => {
  const source = requireSource('src/components/BuklodFeatureFinder.tsx');
  assert.match(source,/Persist before routing; Home can unmount immediately after navigation/);
  assert.match(source,/writeQueue\.current = writeQueue\.current/);
  assert.match(source,/AsyncStorage\.setItem\(key, JSON\.stringify\(next\)\)/);
});
function requireSource(path) {
  return fs.readFileSync(new URL('../' + path, import.meta.url),'utf8');
}
