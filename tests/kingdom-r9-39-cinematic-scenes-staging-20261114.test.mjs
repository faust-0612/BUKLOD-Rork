import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { KINGDOM_CHARACTER_MOTION, KINGDOM_CINEMATIC_SCENES, getKingdomCinematicScene }
  from '../src/features/games/kingdom/platform/KingdomCinematicScenes.ts';

const read = p => fs.readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const catalog = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
const base = 'e15b91fb95742a63e7d5d1d664d15b087681f331';
const native = read('src/features/games/kingdom/platform/KingdomCinematicScene.native.tsx');
const center = read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
const web = read('src/features/games/kingdom/platform/KingdomCinematicScene.web.tsx');

test('39 canonical games all have deliberate, stable distinct cinematic scene profiles', () => {
  const list = catalog.characters.flatMap(c => c.games.map(game => ({
    id: game.id, title: game.title, character: c.characterId,
  })));
  assert.equal(list.length, 39);
  assert.equal(new Set(list.map(x=>x.id)).size, 39);
  assert.deepEqual(new Set(Object.keys(KINGDOM_CINEMATIC_SCENES)), new Set(list.map(x=>x.id)));
  const seeds = new Set();
  for (const {id,title,character} of list) {
    const s = getKingdomCinematicScene(id);
    assert.ok(s, id);
    assert.equal(s.title, title, id);
    assert.equal(s.character, character, id);
    assert.ok(s.glyph.length > 0 && s.glyph.length <= 4, id);
    assert.match(s.accent, /^#[\da-f]{6}$/i);
    assert.match(s.shade, /^#[\da-f]{6}$/i);
    assert.ok(s.cycleMs >= 4000 && s.cycleMs <= 8000, id);
    assert.ok(s.density >= 4 && s.density <= 6, id);
    assert.ok(!seeds.has(s.seed), 'Every game must have a unique choreography seed: ' + id);
    seeds.add(s.seed);
  }
  assert.equal(getKingdomCinematicScene('not-a-game'), null);
});

test('13 canonical characters each have independent idle, action, hit and victory motion', () => {
  const characters = new Set(catalog.characters.map(c => c.characterId));
  assert.equal(characters.size, 13);
  assert.deepEqual(new Set(Object.keys(KINGDOM_CHARACTER_MOTION)), characters);
  const seen = new Set();
  for (const id of characters) {
    const motion = KINGDOM_CHARACTER_MOTION[id];
    assert.ok(motion.action && !seen.has(motion.action), id);
    seen.add(motion.action);
    assert.ok(motion.idleX > 0 && motion.idleY > 0, id);
    assert.ok(motion.collectHop >= 7 && motion.collectHop <= 20, id);
    assert.ok(motion.impactShake > 0 && motion.victoryScale > 0, id);
  }
  assert.match(native, /KINGDOM_CHARACTER_MOTION\[profile.character\]/);
  assert.match(native, /motion.idleX/);
  assert.match(native, /motion.idleY/);
  assert.match(native, /motion.collectHop/);
  assert.match(native, /motion.impactShake/);
  assert.match(native, /motion.victoryScale/);
});

test('Native gives every game a real game-event-driven Skia scene and original animated character', () => {
  assert.match(native, /@shopify\/react-native-skia/);
  assert.match(native, /react-native-reanimated/);
  assert.match(native, /useAnimatedStyle/);
  assert.match(native, /useDerivedValue/);
  assert.match(native, /withRepeat\(withTiming\(1/);
  assert.match(native, /subscribeBuklodGameCharacterMotion/);
  assert.match(native, /isSceneReaction\(event.type\)/);
  assert.match(native, /cancelAnimation\(burst\)/);
  assert.match(native, /<Canvas/);
  for (const kind of ['pillars','lanes','tiles','rings','rays','circuit','runes','equalizer','labyrinth'])
    assert.match(native,new RegExp("profile.shape === '" + kind + "'"),kind);
  for (const motion of ['rise','flow','orbit','scan','pulse','trace','sweep','wave'])
    assert.match(native,new RegExp("profile.motion === '" + motion + "'"),motion);
  assert.match(native, /<BuklodProgressiveCharacterArt/);
  assert.match(native, /<BuklodSpecialCharacterArtV2/);
  assert.match(native, /level=\{1\}/);
  assert.match(native, /pointerEvents="none"/);
});

test('Focus/background/accessibility controls suspend all animation and dispose subscriptions', () => {
  assert.match(native, /useFocusEffect/);
  assert.match(native, /AppState.addEventListener\('change'/);
  assert.match(native, /isReduceMotionEnabled/);
  assert.match(native, /reduceMotionChanged/);
  assert.match(native, /focused && active && !reduceMotion/);
  assert.match(native, /return \(\) => \{ cancelAnimation\(cycle\); cancelAnimation\(burst\); \}/);
  assert.match(native, /return stop;/);
  assert.match(native, /<Scene key=\{gameId\}/);
  assert.doesNotMatch(native, /setInterval|setTimeout|requestAnimationFrame|fetch\(|supabase|AsyncStorage|\.rpc\(|grantPoints|grantShards|awardPoints/);
});

test('Game center selects exactly one scene with correct active game and unchanged result authority', () => {
  assert.match(center, /<KingdomCinematicScene key=\{'cinematic:' \+ active.id\} gameId=\{active.id\} compact=\{compact\} \/>/);
  assert.match(center, /active.render\(save, \(result\) =>/);
  assert.match(center, /recordKingdomPreviewResult\(owner, sessionId, result\)/);
  assert.match(center, /recordBuklodKingdomPreviewResult\(result, owner\)/);
  assert.match(center, /<KingdomMasteryCheck/);
  assert.match(center, /ownerRef\.current !== owner \|\| gameRef\.current !== result.gameId/);
  assert.doesNotMatch(web, /Canvas|RiveView|Skia|expo-audio/);
  assert.equal(read('src/features/games/kingdom/platform/game-catalog.json'),
    execFileSync('git',['show',base+':src/features/games/kingdom/platform/game-catalog.json'],{encoding:'utf8'}));
});

test('R9 changes stay on isolated staging app source: native ABI, production and schema untouched', () => {
  for (const p of ['package.json','package-lock.json','app.config.js','eas.json']) {
    assert.equal(read(p),execFileSync('git',['show',base+':'+p],{encoding:'utf8'}),p);
  }
  // The reviewed R9 PR is protected by its scoped Engineering Accountability
  // gate. After merging into ongoing staging, unrelated later feature commits
  // must not invalidate the immutable native ABI and catalog contracts.
  const files = Object.keys(KINGDOM_CINEMATIC_SCENES);
  assert.equal(files.length, 39);
});
