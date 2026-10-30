import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldKeepWallOriginalTransfer, shouldRevealWallOriginal } from '../src/lib/communityWallPhotoDisplayGate.ts';

const base = {
  expectedUrl: 'https://signed.example/original?token=2',
  decodedUrl: 'https://signed.example/original?token=2',
  width: 2048,
  height: 1536,
  activeRenderer: 'expo',
  renderedBy: 'expo',
  displayed: false,
};

test('original EXPO load without actual display never obscures the visible preview', () => {
  assert.equal(shouldRevealWallOriginal(base), false);
  assert.equal(shouldRevealWallOriginal({ ...base, displayed: true }), true);
  assert.equal(shouldRevealWallOriginal({ ...base, displayed: true, width: 0 }), false);
  assert.equal(shouldRevealWallOriginal({ ...base, displayed: true, height: Number.NaN }), false);
});

test('expired URL, stale renderer and mismatched signed URL never promote stale pixels', () => {
  assert.equal(shouldRevealWallOriginal({ ...base, displayed: true, decodedUrl: 'https://signed.example/original?token=1' }), false);
  assert.equal(shouldRevealWallOriginal({ ...base, displayed: true, activeRenderer: 'native' }), false);
  assert.equal(shouldRevealWallOriginal({ ...base, displayed: true, expectedUrl: '' }), false);
});

test('native fallback requires valid original dimensions, not a network start', () => {
  const native = { ...base, activeRenderer: 'native', renderedBy: 'native', displayed: false };
  assert.equal(shouldRevealWallOriginal(native), true);
  assert.equal(shouldRevealWallOriginal({ ...native, height: 0 }), false);
});

test('Android overlay keeps preview visible while validating Expo display and reuses original disk cache', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  assert.match(renderer, /const renderWithUpgrade = \(preview: React.ReactNode\) => usingPreview \? \(/);
  assert.match(renderer, /actual\.painted \? <WallSharpOverlay/);
  assert.match(renderer, /source=\{\{ uri: current.url, cacheKey: originalCacheKey \}\}/);
  assert.match(renderer, /cachePolicy="memory-disk"/);
  assert.match(renderer, /onDisplay=\{\(\) => \{/);
  assert.match(renderer, /shouldRevealWallOriginal\(\{/);
  assert.match(renderer, /upgradeRenderer === 'expo' \? 18_000 : 90_000/);
  assert.match(renderer, /opacity: current.ready \? 1 : 0/);
  assert.doesNotMatch(renderer, /getPublicUrl|\/object\/public\//);
});

test('sharp original streaming remains alive beyond hard deadlines when bytes continue', () => {
  const sample = {
    expectedUrl: base.expectedUrl,
    progressUrl: base.expectedUrl,
    lastProgressAt: 225_000,
    now: 235_000,
    stallMs: 18_000,
  };
  assert.equal(shouldKeepWallOriginalTransfer(sample), true);
  assert.equal(shouldKeepWallOriginalTransfer({ ...sample, now: 244_000 }), false);
  assert.equal(shouldKeepWallOriginalTransfer({ ...sample, progressUrl: 'old-url' }), false);
  assert.equal(shouldKeepWallOriginalTransfer({ ...sample, lastProgressAt: 0 }), false);
  assert.equal(shouldKeepWallOriginalTransfer({ ...sample, now: 600_000, lastProgressAt: 590_000 }), true);
});
