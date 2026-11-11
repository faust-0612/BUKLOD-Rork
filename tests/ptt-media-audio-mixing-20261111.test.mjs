import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const video = read('src/components/CommunityVideo.tsx');
const reels = read('src/app/igpat/index.tsx');
const reelsWeb = read('src/app/igpat/index.web.tsx');
const inline = read('src/components/BuklodCommunityIgpatPreview.android.tsx');
const sponsored = read('src/components/BuklodCommunitySponsoredAd.tsx');
const ptt = read('src/ptt/buklodPttCore.ts');
const runtime = read('src/ptt/buklodPttRuntime.ts');

test('video audio does not request exclusive focus during PTT receive', () => {
  assert.match(video, /instance\.audioMixingMode = 'mixWithOthers'/);
  assert.match(video, /player\.audioMixingMode = 'mixWithOthers'/);
  assert.doesNotMatch(video, /: 'doNotMix'/);
  for (const source of [reels, reelsWeb, inline, sponsored]) {
    assert.match(source, /audioMixingMode = 'mixWithOthers'/);
  }
});

test('PTT core keeps original microphone/floor behavior and does not pause media', () => {
  assert.match(ptt, /await call\.join\(\)/);
  assert.match(ptt, /await call\.microphone\.disable\(\)/);
  assert.match(runtime, /export async function pttDown/);
  assert.match(runtime, /export async function pttUp/);
  assert.doesNotMatch(runtime, /requestBuklodAudioFocus\('ptt'\)/);
});
