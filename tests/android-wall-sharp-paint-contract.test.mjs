import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WALL_PREVIEW_LAYER_Z_INDEX, wallOriginalLayerZIndex, planWallOriginalSource, shouldKeepWallOriginalTransfer, shouldMountWallOriginalUpgrade, shouldRevealWallOriginal } from '../src/lib/communityWallPhotoDisplayGate.ts';

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

test('original draws transparently above the thumbnail to avoid occluded-display deadlock', () => {
  assert.equal(WALL_PREVIEW_LAYER_Z_INDEX, 1);
  assert.equal(wallOriginalLayerZIndex(false), 2);
  assert.equal(wallOriginalLayerZIndex(true), 2);
  assert.equal(shouldRevealWallOriginal(base), false);
  assert.equal(shouldRevealWallOriginal({ ...base, displayed:true }), true);
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx','utf8');
  assert.equal((renderer.match(/backgroundColor: 'transparent', opacity: 1, zIndex: wallOriginalLayerZIndex\(current.ready\)/g)||[]).length,2);
  assert.match(renderer, /<ExpoImage\s+pointerEvents="none"\s+key=\{'sharp-expo:/);
  assert.match(renderer, /<NativeImage\s+pointerEvents="none"\s+key=\{'sharp-native:/);
  assert.match(renderer,/usingPreview && \{ zIndex: WALL_PREVIEW_LAYER_Z_INDEX \}/);
  assert.doesNotMatch(renderer,/opacity: current.ready \? 1 : 0/);
  assert.match(renderer,/onDisplay=\{\(\) => \{/);
  assert.match(renderer,/shouldRevealWallOriginal\(\{/);
});

test('Android overlay keeps preview visible while validating Expo display and reuses original disk cache', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  assert.match(renderer, /const renderWithUpgrade = \(preview: React.ReactNode\) => \(/);
  assert.match(renderer, /shouldMountWallOriginalUpgrade\(\{/);
  assert.match(renderer, /source=\{\{ uri: current.url, cacheKey: originalCacheKey \}\}/);
  assert.match(renderer, /cachePolicy="memory-disk"/);
  assert.match(renderer, /onDisplay=\{\(\) => \{/);
  assert.match(renderer, /shouldRevealWallOriginal\(\{/);
  assert.match(renderer, /upgradeRenderer === 'expo' \? 18_000 : 90_000/);
  assert.match(renderer, /opacity: 1, zIndex: wallOriginalLayerZIndex\(current.ready\)/);
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

test('both Expo callback orders progressively reveal high quality once valid', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  // A fast onDisplay can precede onLoad. Both paths must attempt promotion.
  assert.match(renderer, /displayedOriginalRef\.current\.url === current\.url/);
  assert.match(renderer, /displayedOriginalRef\.current = \{ url: current\.url, displayed: true \}/);
  assert.match(renderer, /activeUpgradeRendererRef\.current === 'expo'/);
  assert.match(renderer, /if \(activeUpgradeRendererRef\.current !== 'native'\) return/);
});

test('Network reachability fluctuations cannot cancel an active original or base photo', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  assert.match(renderer, /const canRequestRef = useRef\(canRequest\)/);
  assert.match(renderer, /\}, \[mediaPath, retryEpoch\]\)/);
  assert.match(renderer, /\}, \[identity, cacheKey, path, usingPreview, retryEpoch\]\)/);
  assert.match(renderer, /setSource\(current => current\.identity === identity && !current\.painted && !current\.url/);
});

test('existing original bytes, fallback, and incremental sharp upgrade stay separate from media authorisation', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  assert.match(renderer, /communityWallSharpGate\.request\(\)/);
  assert.match(renderer, /<WallSharpOverlay mediaPath=\{originalPath\}/);
  assert.match(renderer, /url = await resolveCommunityMediaUrl\(mediaPath, null\)/);
  assert.match(renderer, /if \(usingPreview\) \{[\s\S]*?failed: true/);
  assert.match(renderer, /cachePolicy="memory-disk"/);
});

test('cache-first originals bypass queue and signing, online and offline', () => {
  assert.equal(planWallOriginalSource(true, true), 'cached');
  assert.equal(planWallOriginalSource(true, false), 'cached');
  assert.equal(planWallOriginalSource(false, true), 'network');
  assert.equal(planWallOriginalSource(false, false), 'defer');
});

test('failed, blank or delayed thumbnails cannot gate original painting', () => {
  assert.equal(shouldMountWallOriginalUpgrade({ originalPath: 'u/post-x.jpg', usingPreview: true }), true);
  assert.equal(shouldMountWallOriginalUpgrade({ originalPath: 'u/post-x.jpg', usingPreview: true }), true);
  assert.equal(shouldMountWallOriginalUpgrade({ originalPath: 'u/post-x.jpg', usingPreview: false }), false);
  assert.equal(shouldMountWallOriginalUpgrade({ originalPath: '', usingPreview: true }), false);
});

test('cached originals are checked before an online download slot is consumed', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  const effect = renderer.slice(renderer.indexOf('function WallSharpOverlay'), renderer.indexOf('function AndroidWallPhoto'));
  const cache = effect.indexOf('ExpoImage.getCachePathAsync(key)');
  const plan = effect.indexOf("sourcePlan === 'cached'");
  const gate = effect.indexOf('communityWallSharpGate.request()');
  const signer = effect.indexOf('resolveCommunityMediaUrl(mediaPath, null)');
  assert.ok(cache >= 0 && cache < plan && plan < gate && gate < signer);
  assert.match(effect, /if \(sourcePlan === 'cached' && cached\) \{/);
  assert.match(effect, /return;\s*\}\s*if \(sourcePlan === 'defer'\)/);
  assert.match(effect, /releaseRef\.current\?\.\(\)/);
});

test('no unconditional 30-second duplicate original request when thumbnail is slow', () => {
  const renderer = readFileSync('src/components/BuklodCachedMediaImage.android.tsx', 'utf8');
  assert.doesNotMatch(renderer, /setFailedPreviewFor\(current => current === originalPath/);
  assert.match(renderer, /if \(usingPreview\) \{[\s\S]*?failed: true/);
});
