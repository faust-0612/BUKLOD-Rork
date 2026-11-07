import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { insertCodeGem } from '../src/features/games/quin/codeBreakerRules.ts';

test('Code Breaker: deliberate slot replacement, auto-advance and uniqueness are correct', () => {
  const start = [null, null, null];
  const first = insertCodeGem(start, 0, 1, 5, false);
  assert.deepEqual(first.digits, [1, null, null]);
  assert.equal(first.nextIndex, 1);
  const second = insertCodeGem(first.digits, 1, 2, 5, false);
  assert.deepEqual(second.digits, [1, 2, null]);
  assert.equal(second.nextIndex, 2);
  // Tap slot 0 specifically: replace slot 0, NOT first empty slot 2.
  const replaced = insertCodeGem(second.digits, 0, 4, 5, true);
  assert.deepEqual(replaced.digits, [4, 2, null]);
  assert.equal(replaced.nextIndex, 2);
  const third = insertCodeGem(replaced.digits, 2, 3, 5, false);
  assert.deepEqual(third.digits, [4, 2, 3]);
  const fullReplace = insertCodeGem(third.digits, 1, 5, 5, true);
  assert.deepEqual(fullReplace.digits, [4, 5, 3]);
  assert.equal(fullReplace.nextIndex, 1);
  assert.deepEqual(start, [null, null, null], 'original code draft immutable');
  assert.throws(() => insertCodeGem(third.digits, 1, 4, 5, true), /unique/);
  assert.throws(() => insertCodeGem(start, 3, 1, 5, false), /Invalid/);
  assert.throws(() => insertCodeGem(start, 0, 6, 5, false), /Invalid/);
  assert.throws(() => insertCodeGem(start, 0, 1.5, 5, false), /Invalid/);
});

test('Bible Crown: Mentor clue only renders on the one question where the lifeline was consumed', () => {
  const src = fs.readFileSync(new URL('../src/features/games/christian/BibleCrownGameV1.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('const [mentorQuestionIndex, setMentorQuestionIndex]'));
  assert.ok(src.includes('setMentorQuestionIndex(index)'));
  assert.ok(src.includes('setMentorQuestionIndex(null)'));
  assert.ok(src.includes('mentorUsed && mentorQuestionIndex === index &&'));
  assert.ok(src.includes('mentorUsed) return;'), 'cannot use mentor twice');
  assert.ok(!src.includes('{mentorUsed && <Text style={s.hint}>'));
  assert.ok(src.includes('reward: { xp: 0, kingdomXp: 0 }'));
});

test('Code Breaker UI routes selected slot intent into pure rule and does not send economic rewards', () => {
  const src = fs.readFileSync(new URL('../src/features/games/quin/CodeBreakerGameV1.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('insertCodeGem(draftRef.current, slotRef.current, value, spec.palette, explicitSlotRef.current)'));
  assert.ok(src.includes('explicitSlotRef.current = true'));
  assert.ok(src.includes('explicitSlotRef.current = false'));
  assert.ok(src.includes('reward: { xp: 0, kingdomXp: 0 }'));
  assert.ok(!src.includes('.rpc('));
});


test('Kingdom account switching remounts all five pilot game scenes, preventing old game sessions from crossing into a new profile', () => {
  const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const shared = read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
  const christian = read('src/app/games/christian-civic-leadership.tsx');
  const mitch = read('src/app/games/mitch-restore-mural.tsx');
  assert.ok(shared.includes("key={(user?.id ?? 'guest') + ':' + active.id}"));
  assert.ok(christian.includes("<BibleCrownGameV1 key={user?.id ?? 'guest'}"));
  assert.ok(christian.includes("<ScriptureWordSearchGameV1 key={user?.id ?? 'guest'}"));
  assert.ok(mitch.includes("<BlockForgeGameV1 key={user?.id ?? 'guest'}"));
  assert.ok(christian.includes("<CivicLeadershipGameV1 key={user?.id ?? 'guest'}"));
  assert.ok(mitch.includes("<RestoreMuralGameV1 key={user?.id ?? 'guest'}"));
});
