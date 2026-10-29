import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decideAndroidPhotoRecovery as decide } from '../src/lib/buklodAndroidPhotoRecovery.ts';

const base = {
  startedAt: 100_000,
  lastProgressAt: 0,
  decodedAt: 0,
  renderer: 'expo',
  fromDiskCache: false,
};

test('Slow but active cellular download is never restarted after eight seconds', () => {
  assert.equal(decide({ ...base, now: 108_000, lastProgressAt: 106_000 }), 'keep');
  assert.equal(decide({ ...base, now: 132_000, lastProgressAt: 125_000 }), 'keep');
  assert.equal(decide({ ...base, now: 179_000, lastProgressAt: 175_000 }), 'keep');
});

test('No-progress native image falls back once instead of spinning forever', () => {
  assert.equal(decide({ ...base, now: 117_999 }), 'keep');
  assert.equal(decide({ ...base, now: 118_000 }), 'fallback');
  assert.equal(decide({ ...base, now: 150_000, renderer: 'native' }), 'keep');
});

test('Decoded but never displayed image triggers alternate renderer only after paint stall', () => {
  assert.equal(decide({ ...base, now: 110_000, decodedAt: 105_000 }), 'keep');
  assert.equal(decide({ ...base, now: 113_000, decodedAt: 105_000 }), 'fallback');
});

test('Progress resets stall clock without restarting an incomplete image', () => {
  assert.equal(decide({ ...base, now: 140_000, lastProgressAt: 130_000 }), 'keep');
  assert.equal(decide({ ...base, now: 148_000, lastProgressAt: 130_000 }), 'fallback');
});

test('Cached native bytes are never re-fetched by the expo fallback timer', () => {
  assert.equal(decide({ ...base, now: 120_000, fromDiskCache: true }), 'keep');
});

test('Any unfinished request exits loading state at hard deadline', () => {
  assert.equal(decide({ ...base, now: 190_000 }), 'fail');
  assert.equal(decide({ ...base, now: 190_000, renderer: 'native' }), 'fail');
  assert.equal(decide({ ...base, now: 190_000, fromDiskCache: true }), 'fail');
});

const image = fs.readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
const generic = fs.readFileSync('src/components/BuklodCachedMediaImage.tsx', 'utf8');

test('Android cache-first resolves local bytes before any signed URL request', () => {
  assert.match(image, /ExpoImage\.getCachePathAsync\(cacheKey\)/);
  assert.match(image, /Promise\.race\(\[/);
  assert.match(image, /setTimeout\(\(\) => resolve\(null\), 800\)/);
  assert.match(image, /fromDiskCache: true/);
  const cacheAt = image.indexOf('ExpoImage.getCachePathAsync(cacheKey)');
  const signAt = image.indexOf('let resolved = await resolveCommunityMediaUrl(path, null)');
  assert.ok(cacheAt >= 0 && signAt > cacheAt);
  assert.match(image, /if \(cached\) \{[\s\S]*?return;[\s\S]*?if \(!active \|\| first\.url \|\| !path\) return/);
  assert.match(image, /file:\/\//);
});

test('Progress events update refs, not React state per byte', () => {
  assert.match(image, /onProgress=\{event => \{/);
  assert.match(image, /Number\(event\.loaded \?\? 0\)/);
  assert.match(image, /p\.lastProgressAt = Date\.now\(\)/);
  assert.doesNotMatch(image, /setProgress\(/);
  assert.match(image, /decision === 'fail'/);
  assert.match(image, /decision === 'fallback'/);
});

test('No regression to secure signed media, manual retry, or web', () => {
  assert.match(image, /resignCommunityMediaUrl\(path\)/);
  assert.match(image, /signRetryRef\.current >= 1/);
  assert.match(image, /cachePolicy="memory-disk"/);
  assert.match(image, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(image, /loadingOverlay|recyclingKey=/);
  assert.doesNotMatch(image, /getPublicUrl|\/object\/public\//);
  assert.match(generic, /loadingOverlay/);
});
