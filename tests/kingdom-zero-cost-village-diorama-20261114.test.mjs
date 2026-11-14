import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const game = read('src/features/games/elesur/VillageBuilderGameV1.tsx');
const native = read('src/features/games/elesur/KingdomVillageDiorama.native.tsx');
const fallback = read('src/features/games/elesur/KingdomVillageDiorama.tsx');

test('Existing village rules, score and reward path remain the only game authority', () => {
  assert.match(game, /const buildProject=useCallback\(/);
  assert.match(game, /if\(phase!=='build'\|\|builtSet\.has\(project\.key\)\) return/);
  assert.match(game, /if\(workers<project\.workerCost\|\|materials<project\.materialCost\)/);
  assert.match(game, /const nextBuilt=\[\.\.\.built,project\.key\]/);
  assert.match(game, /setBuilt\(nextBuilt\)/);
  assert.match(game, /const finalScore=Math\.round/);
  assert.match(game, /onFinish\?\.\(\{gameId:GAME_ID/);
  assert.match(game, /<KingdomVillageDiorama built=\{built\} \/>/);
});

test('Only already-built structures appear in the native and web diorama', () => {
  const keys = ['water','school','farm','clinic','road'];
  const nativeKeys = [...native.matchAll(/\{ id: '(water|school|farm|clinic|road)', x:/g)].map(m => m[1]);
  const webKeys = [...fallback.matchAll(/\{ id: '(water|school|farm|clinic|road)', x:/g)].map(m => m[1]);
  assert.deepEqual(nativeKeys, keys);
  assert.deepEqual(webKeys, keys);
  for (const id of keys) assert.match(game, new RegExp("key:'" + id + "'"));
  assert.match(native, /const builtSet = new Set\(built\)/);
  assert.match(native, /done=\{builtSet\.has\(plot\.id\)\}/);
  assert.match(native, /useSharedValue\(done \? 1 : 0\)/);
  assert.match(native, /withTiming\(done \? 1 : 0,/);
  assert.match(fallback, /constructed\.has\(plot\.id\)/);
  assert.match(fallback, /builtHere \? <G>/);
});

test('Zero asset and privacy cost: no new native dependencies or network requests', () => {
  assert.match(native, /from '@shopify\/react-native-skia'/);
  assert.match(native, /from 'react-native-reanimated'/);
  assert.match(native, /useFocusEffect/);
  assert.match(native, /AppState\.addEventListener/);
  assert.match(native, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(native, /cancelAnimation\(cycle\)/);
  assert.match(native, /pointerEvents="none"/);
  assert.match(fallback, /from 'react-native-svg'/);
  assert.doesNotMatch(native + fallback, /fetch\(|https?:\/\/|setInterval|requestAnimationFrame|supabase|AsyncStorage|\.glb|\.ogg|\.riv|awardPoints|grantShards/);
});
