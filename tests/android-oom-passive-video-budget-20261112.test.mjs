import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import {
  isBuklodPassiveVideoSlotAdmitted as admitted,
  registerBuklodPassiveVideoSlot as register,
  subscribeBuklodPassiveVideoSlots as subscribe,
  __resetBuklodPassiveVideoBudgetForTests as reset,
} from '../src/lib/buklodPassiveVideoBudget.ts';

test('only one passive decoder; warm scrollback wins over next preload', () => {
  reset();
  const first = {}, next = {}, prior = {};
  let notifications = 0;
  const unwatch = subscribe(() => { notifications += 1; });
  const releaseFirst = register(first, 'preload');
  assert.equal(admitted(first), true);
  const releaseNext = register(next, 'preload');
  assert.equal(admitted(first), true);
  assert.equal(admitted(next), false);
  const releasePrior = register(prior, 'warm');
  assert.equal(admitted(first), false);
  assert.equal(admitted(next), false);
  assert.equal(admitted(prior), true);
  releasePrior();
  assert.equal(admitted(first), true);
  releaseFirst();
  assert.equal(admitted(next), true);
  releaseNext();
  assert.equal(admitted(next), false);
  assert.ok(notifications >= 6);
  unwatch();
  reset();
});

test('release + rapid remount is safe and idempotent', () => {
  reset();
  const one = {};
  const release = register(one, 'warm');
  assert.equal(admitted(one), true);
  release();
  release();
  assert.equal(admitted(one), false);
  const again = register(one, 'preload');
  assert.equal(admitted(one), true);
  again();
  reset();
});

test('existing playback path stays active and unchanged; passive budget only Android', () => {
  const code = fs.readFileSync(new URL('../src/components/CommunityVideo.tsx', import.meta.url),'utf8');
  const rules = fs.readFileSync(new URL('../src/lib/communityVideoPlayback.ts', import.meta.url),'utf8');
  assert.match(code, /const active = props\.active !== false/);
  assert.match(code, /Platform\.OS === 'android' && !active && !imaEligible/);
  assert.match(code, /active \|\| Platform\.OS !== 'android' \|\| passiveAllowed/g);
  assert.match(code, /keepWarm: !imaEligible && recentlyActive/);
  assert.match(code, /setRecentlyActive\(false\), 1_400/);
  assert.match(code, /<ExpoCommunityVideo/);
  assert.match(rules, /if \(!input\.active && !input\.preload && !input\.keepWarm\) return false/);
  assert.match(code, /instance\.audioMixingMode = 'mixWithOthers'/);
});
