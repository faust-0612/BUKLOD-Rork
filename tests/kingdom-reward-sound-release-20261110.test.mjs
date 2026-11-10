import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const native = readFileSync('src/features/games/runtime/BuklodGameFeedback.native.ts','utf8');
const web = readFileSync('src/features/games/runtime/BuklodGameFeedback.web.ts','utf8');
const contract = readFileSync('scripts/game-kingdom-release-contract.mjs','utf8');

test('native success uses shipped points-claim reward, while unlock keeps achievement cue', () => {
  assert.ok(existsSync('assets/sounds/buklod-points-claim.wav'));
  assert.match(native, /const rewardSound = require\('\.\.\/\.\.\/\.\.\/\.\.\/assets\/sounds\/buklod-points-claim\.wav'\)/);
  assert.match(native, /event === 'unlock' \? unlockSound : rewardSound/);
  assert.match(native, /case 'success':/);
  assert.match(native, /case 'unlock':/);
  assert.match(contract, /buklod-points-claim\.wav/);
});

test('game feedback retains existing preferences, effects, bounded players, and other sounds', () => {
  assert.match(native, /isBuklodGameSoundEnabled\(\)/);
  assert.match(native, /getBuklodGameSoundVolume\(\)/);
  assert.match(native, /MAX_ACTIVE_FALLBACK_PLAYERS = 6/);
  assert.match(native, /tryPlayRorkGameFeedback\(event, volume\)/);
  assert.match(native, /const reactionSound = require\(/);
  assert.match(native, /const impactSound = require\(/);
  assert.match(native, /const failSound = require\(/);
  assert.match(native, /Haptics\.notificationAsync/);
  assert.match(web, /tryPlayRorkGameFeedback/);
});
