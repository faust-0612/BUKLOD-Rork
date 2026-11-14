import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const baseline = '43d5f24a829028a928b5f131b6fa82499e47cd61';
const fx = read('src/features/games/runtime/BuklodGameplayReactionFX.native.tsx');
const stage = read('src/features/games/runtime/BuklodGameStage.native.tsx');
const ambient = read('src/features/games/runtime/BuklodGameVisualFX.tsx');
const jawo = read('src/features/games/jawo/ForestTrailGameV2.tsx');
const trudice = read('src/features/games/trudice/PlaygroundPathGameV2.tsx');

test('Staging gameplay keeps the exact signed native ABI: no APK or production build', () => {
  for (const path of ['app.config.js', 'eas.json', 'package.json', 'package-lock.json']) {
    assert.equal(read(path), execFileSync('git', ['show', baseline + ':' + path], { encoding: 'utf8' }), path);
  }
  const deps = JSON.parse(read('package.json')).dependencies;
  assert.equal(deps['@shopify/react-native-skia'], '2.6.2');
  assert.equal(deps['react-native-reanimated'], '4.5.1');
  assert.ok(deps['@rive-app/react-native']);
});

test('Every Android game stage draws one non-interactive GPU response to accepted gameplay feedback', () => {
  assert.match(stage, /BuklodGameplayReactionFX from '\.\/BuklodGameplayReactionFX\.native'/);
  assert.match(stage, /<BuklodGameplayReactionFX enabled=\{screenFocused && appActive && !reducedMotion\}/);
  assert.match(stage, /<BuklodGameVisualFX biome=\{biome\} enabled=\{screenFocused && appActive && !reducedMotion\}/);
  assert.match(ambient, /enabled = true/);
  assert.match(ambient, /if \(!enabled\) \{/);
  assert.match(ambient, /drift\.stopAnimation\(\)/);
  assert.match(ambient, /pulse\.stopAnimation\(\)/);
  assert.match(fx, /subscribeBuklodGameCharacterMotion/);
  assert.match(fx, /event\.type/);
  assert.match(fx, /useSharedValue\(1\)/);
  assert.match(fx, /cancelAnimation\(progress\)/);
  assert.match(fx, /withTiming\(1,/);
  assert.match(fx, /Easing\.out\(Easing\.cubic\)/);
  assert.match(fx, /const BURST_PARTICLES = 12/);
  assert.match(fx, /<Canvas/);
  assert.match(fx, /pointerEvents="none"/);
  assert.match(fx, /importantForAccessibility="no-hide-descendants"/);
  assert.match(fx, /if \(!enabled \|\| !reaction\) return null/);
  for (const event of ['move', 'collect', 'impact', 'success', 'failure', 'unlock']) {
    assert.match(fx, new RegExp('\\b' + event + ':'));
  }
  assert.doesNotMatch(fx, /setInterval|setTimeout|requestAnimationFrame|fetch\(|supabase|AsyncStorage|grantPoints|awardPoints|grantShards/);
});

test('Jawo premium animation is driven by the real deterministic collision and lane result', () => {
  assert.match(jawo, /nextLane === laneRef\.current/);
  assert.match(jawo, /const direction = nextLane - laneRef\.current/);
  assert.match(jawo, /const next = advanceTrail\(/);
  assert.match(jawo, /next\.outcome === 'impact' \? 9 : next\.outcome === 'light' \? -17 : -6/);
  assert.match(jawo, /translateY: playerHop/);
  assert.match(jawo, /rotate: playerAngle/);
  assert.match(jawo, /playerHop\.stopAnimation\(\)/);
  assert.match(jawo, /clearTimeout\(timer\)/);
  assert.match(jawo, /encounterCallbackRef\.current\(\)/);
  assert.match(jawo, /recordBuklodKingdomPreviewResult|onFinish\?\.\(result\)/);
  assert.equal(read('src/features/games/jawo/forestTrailEngine.ts'),
    execFileSync('git', ['show', baseline + ':src/features/games/jawo/forestTrailEngine.ts'], { encoding: 'utf8' }));
});

test('Trudice visible restoration only follows a correct puzzle step and retains safe retry logic', () => {
  assert.match(trudice, /const result = checkWonderStep\(challenge, inputIndex, station\)/);
  assert.match(trudice, /if \(result === 'wrong'\) \{\s*setBurstStation\(null\)/);
  assert.match(trudice, /setBurstStation\(station\)/);
  assert.match(trudice, /restoreBurst\.stopAnimation\(\)/);
  assert.match(trudice, /toValue: 1, duration: 580/);
  assert.match(trudice, /pointerEvents="none" style=\{\[/);
  assert.match(trudice, /phaseRef\.current !== 'input' \|\| lockedRef\.current/);
  assert.match(trudice, /Original station preview rewards only/);
  assert.equal(read('src/features/games/trudice/wonderPathRules.ts'),
    execFileSync('git', ['show', baseline + ':src/features/games/trudice/wonderPathRules.ts'], { encoding: 'utf8' }));
});

test('All 13 Kingdom station route contracts and real BP/Shard security boundaries survive', () => {
  const registry = read('src/features/games/registry.ts');
  const keys = [...registry.matchAll(/^  '([a-z]+-[a-z-]+)': \{/gm)];
  assert.equal(keys.length, 13, 'Canonical station count');
  assert.match(stage, /recordBuklodKingdomPreviewResult\(result, userId\)/);
  assert.match(stage, /<BuklodGameCharacterCompanion/);
  assert.match(stage, /<BuklodGameLanguageControl/);
  assert.doesNotMatch(fx + jawo + trudice, /supabase\.rpc|grantShards|grantPoints|awardPoints|purchaseShard|setItem\(/);
  // CI checks a synthetic PR merge commit; compare against its actual moving
  // target branch, not the initial R7 snapshot that predates unrelated fixes.
  const baseForDiff = process.env.BUKLOD_BASE_REF
    ? 'origin/' + process.env.BUKLOD_BASE_REF.replace(/^origin\//, '')
    : baseline;
  const changed = execFileSync('git', ['diff', '--name-only', baseForDiff, 'HEAD'], { encoding:'utf8' }).trim().split('\n').filter(Boolean);
  const authorized = new Set([
    'src/features/games/runtime/BuklodGameplayReactionFX.native.tsx',
    'src/features/games/runtime/BuklodGameStage.native.tsx',
    'src/features/games/runtime/BuklodGameVisualFX.tsx',
    'src/features/games/jawo/ForestTrailGameV2.tsx',
    'src/features/games/trudice/PlaygroundPathGameV2.tsx',
    'tests/kingdom-premium-gameplay-staging-20261114.test.mjs',
    '.buklod/scopes/kingdom-premium-gameplay-staging-20261114.json',
  ]);
  for (const path of changed) assert.ok(authorized.has(path), 'Unapproved change: ' + path);
});
