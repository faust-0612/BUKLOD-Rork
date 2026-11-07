import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const lock = read('scripts/character-release-contract.mjs');
const core = read('src/components/points/BuklodProgressiveCharacterSelector.tsx');
const special = read('src/components/points/BuklodSpecialCharacterSeries.tsx');
const host = read('src/components/points/BuklodCharacterCustomizeSheet.tsx');
const art = read('src/components/points/BuklodProgressiveCharacterArt.tsx');

test('RC lock pins exact currently reviewed source blobs, not the older pre-collectibles layout', () => {
  for (const sha of [
    '1debd5659a96c97f83f32eeebb37c309a527d4ae',
    '4cf837d453c4c33c867e2b0ae714e6f81f1ffeb6',
    '33fdfd5d1c599183f80eb4d7a4e99e7511c3bbc0',
    '3000d9e03b77fc48f345c093fd5bd2a88bfad26d',
  ]) assert.ok(lock.includes(sha), sha);
});
test('Core Character levels, items, and Circle Rank authority remain independently guarded', () => {
  assert.match(core, /Array\.from\(\{ length: 20 \}/);
  assert.match(core, /shownCollectiblePins/);
  assert.match(core, /getMyCharacterCollectibles/);
  assert.match(core, /isCollectibleLevelOpen/);
  assert.match(core, /redeemMyCharacterCollectible/);
  assert.match(core, /useMyCharacterCollectible/);
  assert.match(core, /state\.character_points_since_selection/);
  assert.doesNotMatch(core, /levelForPoints\s*\(\s*lifetimePoints\s*\)/);
  assert.match(host, /getMyBuklodCharacterSelectionV2/);
  assert.match(host, /BuklodSpecialCharacterSeries/);
  assert.match(art, /4940/);
});
test('Special Character identities stay masked before server/rank unlock', () => {
  assert.match(special, /visibleSpecialRail\(/);
  assert.match(special, /state\.visible_special_character_ids/);
  assert.match(special, /SPECIAL_REQUIRED_RANK_ORDER/);
  assert.match(special, /railIds\.map\(/);
  assert.match(special, /unlocked \? \(/);
  assert.match(special, /characterImageHidden/);
  assert.match(special, /NEXT SPECIAL/);
  assert.match(special, /setMyBuklodCharacterActiveV2/);
  assert.match(special, /get_my_buklod_special_collectibles_v2/);
  assert.doesNotMatch(special, /NEXT TO UNLOCK/);
});

test('Execute the exact mandatory R31/R40 production Character source lock including real image assets', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync(process.execPath, ['scripts/character-release-contract.mjs'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 45000,
  });
});
