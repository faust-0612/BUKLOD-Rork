import test from 'node:test';
import assert from 'node:assert/strict';
import { BUKLOD_FEATURE_LINKS, findBuklodFeatures } from '../src/lib/buklodNavigationV2.ts';

test('offline feature search finds common Tagalog/English task synonyms', () => {
  assert.equal(findBuklodFeatures('tulong')[0]?.route, '/support/live');
  assert.equal(findBuklodFeatures('palit password')[0]?.route, '/account/security');
  assert.equal(findBuklodFeatures('magpost')[0]?.route, '/buklod');
  assert.equal(findBuklodFeatures('dokumento')[0]?.route, '/drawer');
  assert.equal(findBuklodFeatures('chat')[0]?.route, '/messages');
  assert.equal(findBuklodFeatures('basa')[0]?.route, '/bible');
  assert.equal(findBuklodFeatures('panalangin')[0]?.route, '/prayer');
  assert.equal(findBuklodFeatures('laro')[0]?.route, '/games');
  assert.equal(findBuklodFeatures('kontribusyon')[0]?.route, '/community-contribution');
});
test('short/noisy queries are bounded, deterministic, and do not expose admin or retired routes', () => {
  assert.deepEqual(findBuklodFeatures(''), []);
  assert.deepEqual(findBuklodFeatures('a'), []);
  assert.equal(findBuklodFeatures('profile', 1).length, 1);
  assert.deepEqual(findBuklodFeatures('xyz-unrecognized-word'), []);
  assert.equal(new Set(BUKLOD_FEATURE_LINKS.map(x => x.id)).size, BUKLOD_FEATURE_LINKS.length);
  // Four distinct, historically pinned task shortcuts intentionally share
  // authenticated routes; do not silently erase legacy saved shortcut IDs.
  const routeCounts = new Map();
  for (const item of BUKLOD_FEATURE_LINKS) routeCounts.set(item.route,(routeCounts.get(item.route)??0)+1);
  assert.deepEqual([...routeCounts.entries()].filter(([,count])=>count>1).map(([route])=>route).sort(),
    ['/me','/profile/buklod-health','/settings','/support/live'].sort());
  assert.ok(BUKLOD_FEATURE_LINKS.every(item => item.aliases.length > 0));
  assert.equal(BUKLOD_FEATURE_LINKS.some(x => /admin|igpat|reels/i.test(x.route)), false);
});
