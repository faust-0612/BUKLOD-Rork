import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const native = readFileSync('src/features/games/runtime/BuklodGameFeedback.native.ts','utf8');
const web = readFileSync('src/features/games/runtime/BuklodGameFeedback.web.ts','utf8');
const contract = readFileSync('scripts/game-kingdom-release-contract.mjs','utf8');

test('native success and unlock use separate offline CC0 Kingdom cues', () => {
 for (const name of ['victory','unlock','collect-crystal','impact-wood','failure','ui-soft'])
   assert.ok(existsSync('assets/sounds/kingdom-premium/'+name+'.wav'),name);
 assert.match(native,/const rewardSound = require\('.*kingdom-premium\/victory\.wav'\)/);
 assert.match(native,/const unlockSound = require\('.*kingdom-premium\/unlock\.wav'\)/);
 assert.match(native,/event === 'unlock' \? unlockSound : rewardSound/);
 assert.match(native,/case 'success':/);
 assert.match(native,/case 'unlock':/);
 assert.match(contract,/kingdom-premium\/victory\.wav/);
});
test('game feedback retains preferences, haptics, bounded players and web support', () => {
 assert.match(native,/isBuklodGameSoundEnabled\(\)/);
 assert.match(native,/getBuklodGameSoundVolume\(\)/);
 assert.match(native,/MAX_ACTIVE_FALLBACK_PLAYERS = 6/);
 assert.match(native,/tryPlayRorkGameFeedback\(event, volume\)/);
 assert.match(native,/const reactionSound = require\(/);
 assert.match(native,/const impactSound = require\(/);
 assert.match(native,/const failSound = require\(/);
 assert.match(native,/Haptics\.notificationAsync/);
 assert.match(web,/tryPlayRorkGameFeedback/);
 for (const old of ['buklod_message_sent','buklod_community','buklod_error','buklod-points-claim'])
   assert.doesNotMatch(native,new RegExp(old));
});
