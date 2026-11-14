import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');

test('LIFE and Kabihasnang Ligaw are independently rendered without a Community highlights drawer', () => {
  assert.doesNotMatch(wall, /communityHighlightsOpen|setCommunityHighlightsOpen|accessibilityLabel="Community highlights"/);
  assert.equal((wall.match(/<BuklodLifeWallCard\s*\/>/g) ?? []).length, 1);
  assert.equal((wall.match(/<KabihasnangLigawWallCard\s*\/>/g) ?? []).length, 1);
  const wallHeader = wall.slice(wall.indexOf('ListHeaderComponent='), wall.indexOf('<BuklodMaritesBoard'));
  assert.match(wallHeader, /<BuklodCommunitySponsoredAd[^>]*\/>[\s\S]*<BuklodLifeWallCard\s*\/>[\s\S]*<KabihasnangLigawWallCard\s*\/>/);
  assert.doesNotMatch(wallHeader, /\{communityHighlightsOpen\s*&&/);
});

test('Marites remains independently mounted after both direct cards', () => {
  const life = wall.indexOf('<BuklodLifeWallCard />');
  const kl = wall.indexOf('<KabihasnangLigawWallCard />');
  const marites = wall.indexOf('<BuklodMaritesBoard');
  assert.ok(life >= 0 && life < kl && kl < marites);
  assert.equal((wall.match(/<BuklodMaritesBoard\b/g) ?? []).length, 1);
});
