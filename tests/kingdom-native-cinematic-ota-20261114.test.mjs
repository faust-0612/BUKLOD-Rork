import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const native = read('src/features/games/kingdom/BuklodKingdomLivingFX.native.tsx');
const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const stage = read('src/features/games/runtime/BuklodGameStage.native.tsx');
const fallback = read('src/features/games/kingdom/BuklodKingdomLivingFX.web.tsx');
const BASE = 'c6804e5b6b72e6bb7658f5b13e32dd8a5d1de9fd';

test('Native dependency and runtime ABI remain byte-identical to signed staging APK source', () => {
  for (const p of ['package.json','app.config.js','eas.json','package-lock.json']) {
    assert.equal(read(p), execFileSync('git', ['show', BASE+':'+p], { encoding:'utf8' }), p);
  }
  const deps=JSON.parse(read('package.json')).dependencies;
  assert.equal(deps['@shopify/react-native-skia'],'2.6.2');
  assert.equal(deps['react-native-reanimated'],'4.5.1');
  assert.ok(deps['@rive-app/react-native']);
});

test('Kingdom keeps all 13 stations, touch routes and original progress authority', () => {
  const original = execFileSync('git', ['show', BASE+':src/features/games/kingdom/BuklodKingdomMapPremium.tsx'], {encoding:'utf8'});
  const block = source => source.slice(source.indexOf('const STATIONS:'),source.indexOf('const JOURNEY_PATH'));
  assert.equal(block(map), block(original));
  assert.match(map, /loadBuklodKingdomPreviewProgress\(userId\)/);
  assert.match(map, /onPress=\{\(\) => onEnter\(station\)\}/);
  assert.match(map, /router\.push\(station\.href as any\)/);
  assert.match(map, /<BuklodKingdomLivingFX/);
  assert.match(map, /cinematic=\{cinematicFX\}/);
  assert.match(map, /accessibilityLabel=\{cinematicFX \?/);
  assert.doesNotMatch(map, /supabase\.rpc|awardPoints|grantShards/);
});

test('Native Skia/Reanimated FX stops offscreen and honors reduced motion', () => {
  assert.match(native, /from '@shopify\/react-native-skia'/);
  assert.match(native, /from 'react-native-reanimated'/);
  assert.match(native, /useDerivedValue/);
  assert.match(native, /withRepeat\(withTiming\(/);
  assert.match(native, /useFocusEffect/);
  assert.match(native, /AppState\.addEventListener/);
  assert.match(native, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(native, /cancelAnimation\(phase\)/);
  assert.match(native, /pointerEvents="none"/);
  assert.match(native, /cleared\.map/);
  assert.match(native, /<BlurMask/);
  assert.doesNotMatch(native, /setInterval|requestAnimationFrame|supabase|AsyncStorage|fetch\(/);
  assert.match(fallback, /BuklodKingdomAtmosphere/);
});

test('All native game stages use Reanimated/Skia while preserving gameplay, Rive host and language', () => {
  assert.match(stage, /Canvas/);
  assert.match(stage, /useDerivedValue/);
  assert.match(stage, /withRepeat/);
  assert.match(stage, /cancelAnimation/);
  assert.match(stage, /recordBuklodKingdomPreviewResult\(result, userId\)/);
  assert.match(stage, /<BuklodGameCharacterCompanion/);
  assert.match(stage, /<BuklodGameLanguageControl/);
  assert.match(read('src/components/points/BuklodRiveCharacterRuntime.tsx'), /RiveView/);
  assert.doesNotMatch(stage, /grant|award|givePoints|unlockEverything/);
});

test('Kingdom release contract tracks the owner-approved Home Hub door, not removed Profile duplication', () => {
  const check=read('scripts/game-kingdom-release-contract.mjs');
  assert.match(check, /src\/components\/home\/BuklodKingdomHubCard\.tsx/);
  assert.match(check, /src\/app\/\(tabs\)\/hub\.tsx/);
  assert.doesNotMatch(check, /requireTokens\('src\/components\/BuklodFoundationWorkspaceNav\.tsx'/);
  assert.match(read('src/app/(tabs)/hub.tsx'), /<BuklodKingdomHubCard \/>/);
});
