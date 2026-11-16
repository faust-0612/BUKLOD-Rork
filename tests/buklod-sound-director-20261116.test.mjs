import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');

test('all gameplay fallbacks are licensed local CC0, bounded and quiet-hour controlled', () => {
 const native = read('src/features/games/runtime/BuklodGameFeedback.native.ts');
 for (const name of ['collect-crystal','impact-wood','victory','unlock','failure','ui-soft']) {
   assert.ok(existsSync('assets/sounds/kingdom-premium/'+name+'.wav'));
   assert.ok(native.includes('kingdom-premium/'+name+'.wav'), name);
 }
 for (const old of ['buklod_message_sent','buklod_community','buklod_error','buklod-points-claim'])
   assert.ok(!native.includes(old), 'old notification sound should not be game fallback: '+old);
 assert.match(native,/MAX_ACTIVE_FALLBACK_PLAYERS = 6/);
 assert.match(native,/playbackStatusUpdate/);
 assert.match(native,/state !== 'active'/);
 assert.match(native,/isBuklodGameSoundEnabled/);
 assert.match(native,/tryPlayRorkGameFeedback/);
 assert.match(native,/Haptics\.notificationAsync/);
});

test('verified BP, Character and Circle Rank cues use known bundled sounds', () => {
 const sounds = read('src/lib/buklodSounds.ts');
 const points = read('src/components/points/BuklodPointsRewardsScreen.tsx');
 const level = read('src/components/points/BuklodCharacterLevelRecognition.tsx');
 const rank = read('src/app/points/progression.tsx');
 const provider = read('src/components/character/BuklodCharacterEventProvider.tsx');
 for(const cue of ['bp_claimed','character_level','character_item','circle_rank']) {
   assert.ok(sounds.includes(cue),cue);
 }
 assert.ok(sounds.includes('kingdom-premium/coins.wav'));
 assert.ok(sounds.includes('kingdom-premium/collect-crystal.wav'));
 assert.ok(sounds.includes('quietHours'));
 assert.ok(sounds.includes('activeCall'));
 assert.ok(sounds.includes('Date.now() - queuedAt > 1000'));
 assert.ok(points.includes('kingdom-premium/coins.wav'));
 assert.ok(points.includes('if(soundOn)playAudio(claimSound)'));
 assert.ok(level.includes('level > previous'));
 assert.ok(level.includes("playBuklodCue('character_level')"));
 assert.ok(rank.includes('order > previous'));
 assert.ok(rank.includes("playBuklodCue('circle_rank')"));
 assert.ok(provider.includes('event.success === true'));
 assert.ok(provider.includes("playBuklodCue('character_item')"));
});
test('unlicensed Library files are not linked as app sounds', () => {
 const sounds = read('src/lib/buklodSounds.ts');
 const doc = read('docs/BUKLOD_SOUND_EFFECTS_INTEGRATION_20261116.md');
 for(const origin of ['Fall Guys','TechKeyFi','GCRadix'])assert.ok(!sounds.includes(origin));
 assert.ok(doc.includes('LICENSE_PENDING'));
});
