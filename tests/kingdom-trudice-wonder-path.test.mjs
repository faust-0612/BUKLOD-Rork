import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWonderChallenge, checkWonderStep, WONDER_TOTAL_ROUNDS } from '../src/features/games/trudice/wonderPathRules.ts';

test('Wonder Path: five genuinely different mechanics with deterministic seeded routes', () => {
  const expected = ['follow', 'spotlight', 'avoid', 'reverse', 'rescue'];
  for (const seed of [0, 1, 123, 10001, 0x7fffffff, 0xffffffff]) {
    for (let round = 1; round <= WONDER_TOTAL_ROUNDS; round++) {
      const a = buildWonderChallenge(round, seed);
      assert.deepEqual(a, buildWonderChallenge(round, seed));
      assert.equal(a.mode, expected[round - 1]);
      assert.ok(a.cues.length >= 4);
      assert.ok(a.answer.length > 0);
      assert.ok(a.cues.every(x => Number.isInteger(x) && x >= 0 && x <= 3));
      assert.ok(a.answer.every(x => Number.isInteger(x) && x >= 0 && x <= 3));
      assert.ok(a.answer.every((step,index) => checkWonderStep(a,index,step) ===
        (index===a.answer.length-1?'cleared':'correct')));
      assert.equal(checkWonderStep(a,0,9),'wrong');
      assert.equal(checkWonderStep(a,-1,a.answer[0]),'wrong');
      assert.equal(checkWonderStep(a,a.answer.length,a.answer[0]),'wrong');
      if (a.blocked !== null) {
        assert.ok(!a.cues.includes(a.blocked));
        assert.ok(!a.answer.includes(a.blocked));
        assert.equal(checkWonderStep(a,0,a.blocked),'wrong');
      }
      if (round === 1) assert.equal(new Set(a.cues).size,4,'all stations used, not two');
      if (round === 2) {
        const hits = new Map();
        for(const station of a.cues) hits.set(station,(hits.get(station)||0)+1);
        assert.deepEqual([...hits.values()].sort(),[1,1,2]);
        assert.equal(hits.get(a.answer[0]),2);
      }
      if (round === 4) assert.deepEqual(a.answer,[...a.cues].reverse());
    }
  }
  assert.throws(()=>buildWonderChallenge(0,42),/Invalid/);
  assert.throws(()=>buildWonderChallenge(6,42),/Invalid/);
  assert.throws(()=>buildWonderChallenge(2,NaN),/Invalid/);
});
test('Wonder Path: replay creates varied encounters across seeds', () => {
  const paths = new Set(Array.from({length:30},(_,i)=>buildWonderChallenge(1,i+11).cues.join('')));
  assert.ok(paths.size>=8,'replay is not a fixed periodic sequence');
});
test('Wonder Path: source remains one original in-app station and preview-only', () => {
  const view=fs.readFileSync(new URL('../src/features/games/trudice/PlaygroundPathGameV2.tsx',import.meta.url),'utf8');
  const screen=fs.readFileSync(new URL('../src/app/games/trudice-playground-memory.tsx',import.meta.url),'utf8');
  assert.match(screen,/PlaygroundPathGameV2/);
  assert.match(screen,/KingdomInteriorCenter/);
  assert.match(view,/buildWonderChallenge/);
  assert.match(view,/trudice-playground-memory/);
  assert.doesNotMatch(view,/supabase|showBuklodRewardedAd|from ['"]@\/lib\/buklodAdOpportunities/);
});
