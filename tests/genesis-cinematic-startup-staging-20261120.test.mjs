import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
test('Genesis cinematic intro is Android staging-only and never silently active in production', () => {
  const guard = read('src/lib/buklodGenesisStartupPolicy.ts');
  const intro = read('src/components/BuklodMainBrandIntro.tsx');
  assert.match(guard, /Platform\.OS === 'android'/);
  assert.match(guard, /target === 'main'/);
  assert.match(guard, /env === 'staging'/);
  assert.doesNotMatch(guard, /env === 'production'/);
  assert.match(intro, /const genesisPreview = isBuklodGenesisStartupPreview\(\)/);
  assert.match(intro, /BuklodGenesisStartupScene active=/);
  assert.match(intro, /genesisPreview \? styles\.genesisOverlay : null/);
  assert.match(intro, /markScale/);
  assert.match(intro, /genesisPreview && !splashGone/);
});
test('Startup sound is offline, optional, honors app sound policy and cannot delay app', () => {
  const scene = read('src/components/BuklodGenesisStartupScene.tsx');
  const sound = 'assets/sounds/buklod-genesis-opening-20261120.wav';
  assert.ok(existsSync(sound));
  const wav = readFileSync(sound);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.ok(wav.byteLength < 160_000, 'keep bundled startup cue lightweight');
  assert.match(scene, /getBuklodSoundSettings\(\)/);
  assert.match(scene, /isBuklodGameSoundEnabled\(\)/);
  assert.match(scene, /AppState\.currentState === 'active'/);
  assert.match(scene, /player\?\.release\(\)/);
  assert.doesNotMatch(scene, /fetch\(|https:\/\/|supabase/);
});
test('Original canonical B mark stays intact; scene only supplies effects', () => {
  const intro = read('src/components/BuklodMainBrandIntro.tsx');
  const mark = read('src/components/BuklodCenteredBrandMark.tsx');
  assert.match(intro, /<BuklodCenteredBrandMark/);
  assert.match(mark, /buklod-main-canonical\.png/);
  const scene = read('src/components/BuklodGenesisStartupScene.tsx');
  assert.match(scene, /isReduceMotionEnabled/);
  assert.match(scene, /if \(!active\) return/);
  assert.doesNotMatch(scene, /Easing\.sine/);
});
