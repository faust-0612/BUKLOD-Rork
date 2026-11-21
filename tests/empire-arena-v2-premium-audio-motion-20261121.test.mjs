import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arenaAudioCueForEvent, drainArenaAudioEvents, ARENA_MUSIC_ID } from '../src/features/games/empire/arenaPracticeAudio.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const route = readFileSync(resolve(ROOT, 'src/app/games/empire-arena.tsx'), 'utf8');
const audioAssets = readFileSync(resolve(ROOT, 'src/features/games/runtime/kingdomPremiumAudioAssets.ts'), 'utf8');
const animated = readFileSync(resolve(ROOT, 'src/features/games/empire/ArenaAnimatedActor.tsx'), 'utf8');

test('All three Arena maps use the existing local royalty-free Kingdom audio baseline', () => {
  assert.deepEqual(Object.keys(ARENA_MUSIC_ID).sort(),
    ['aurora_foundry','genesis_rift','verdant_fracture'].sort());
  for (const name of ['kingdom-theme.ogg','kingdom-village.ogg','kingdom-great-hall.ogg',
    'enter.wav','unlock.wav','victory.wav','failure.wav','collect-crystal.wav','impact-wood.wav']) {
    assert.ok(existsSync(resolve(ROOT,'assets/sounds/kingdom-premium',name)), 'Missing packaged audio '+name);
    assert.ok(audioAssets.includes(name), 'Missing registered audio '+name);
  }
  assert.ok(route.includes('toggleMusic'));
  assert.ok(route.includes('setSfxEnabled'));
  assert.ok(route.includes('playRorkSignatureSfx'));
  assert.ok(route.includes('drainArenaAudioEvents'));
});

test('Arena battle event cues are meaningful, bounded, and never replay a past event', () => {
  assert.equal(arenaAudioCueForEvent({type:'skill',actor:'A0'}), 'unlock');
  assert.equal(arenaAudioCueForEvent({type:'dash',actor:'A0'}), 'move');
  assert.equal(arenaAudioCueForEvent({type:'skill',actor:'B0'}), null);
  assert.equal(arenaAudioCueForEvent({type:'level_up',actor:'A0'}), 'unlock');
  assert.equal(arenaAudioCueForEvent({type:'equipment_drop',actor:'A0'}), 'collect');
  assert.equal(arenaAudioCueForEvent({type:'result',winner:'A'}), 'success');
  assert.equal(arenaAudioCueForEvent({type:'result',winner:'B'}), 'failure');
  assert.equal(arenaAudioCueForEvent({type:'result',winner:null}), 'failure');
  const events = [
    {seq:1,type:'skill',actor:'A0'},
    {seq:2,type:'skill',actor:'B0'},
    {seq:3,type:'level_up',actor:'A0'},
    {seq:4,type:'seal_breached',team:'B'},
    {seq:5,type:'result',winner:'A'},
  ];
  const first = drainArenaAudioEvents(events, 0, 5);
  assert.deepEqual(first.cues, ['unlock','impact','success']);
  assert.equal(first.lastSeq, 5);
  assert.deepEqual(drainArenaAudioEvents(events,first.lastSeq,5).cues,[]);
});

test('13 heroes get source-owned animated presentation; sprite image takes precedence when added', () => {
  assert.match(route,/ARENA_HERO_ART\[p.hero as BuklodCharacterId\]/);
  assert.match(route,/ARENA_GENERATED_ART\['sprite:' \+ p.hero\]/);
  assert.match(route,/<ArenaAnimatedActor/);
  assert.match(animated,/useSharedValue\(/);
  assert.match(animated,/withRepeat\(/);
  assert.match(animated,/cancelAnimation\(/);
  assert.match(animated,/source=\{image\}/);
  assert.doesNotMatch(route,/supabase\.|\.rpc\(|awardBp|awardDiamond|settleWorldTrade/);
});

test('Ranked 5Hz snapshots interpolate on the UI thread without moving server combat authority', () => {
  assert.match(animated,/const screenX = useSharedValue\(x - size \/ 2\)/);
  assert.match(animated,/const screenY = useSharedValue\(y - size \* 0\.77\)/);
  assert.match(animated,/jump > Math\.max\(110, size \* 1\.6\)/);
  assert.match(animated,/screenX\.value = withTiming\(nextX, transition\)/);
  assert.match(animated,/screenY\.value = withTiming\(nextY, transition\)/);
  assert.match(animated,/cancelAnimation\(screenX\)/);
  assert.match(animated,/duration: 155/);
  assert.doesNotMatch(animated,/supabase|\.rpc\(|diamond|awardBp|fetch\(/i);
});

test('Arena audio remains on existing focus-scoped sound provider, never preview-host streaming',()=>{
  const provider = readFileSync(resolve(ROOT,'src/features/games/runtime/rorkAudio.ts'),'utf8');
  assert.match(provider,/REMOTE_RORK_AUDIO_ENABLED = false/);
  assert.match(provider,/useFocusEffect/);
  assert.match(provider,/getPremiumKingdomMusic/);
  assert.match(provider,/getPremiumKingdomSfx/);
  assert.ok(!route.includes('kp3ge50a5t6chyb7gv3jn-web.rork.live'));
});
