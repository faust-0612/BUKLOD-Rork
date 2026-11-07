import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path,'utf8');
const banner = read('src/components/BuklodAdMobBanner.tsx');
const companion = read('src/components/BuklodVideoCompanionAd.tsx');
const video = read('src/components/CommunityVideo.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const ads = read('src/lib/buklodAdUnits.ts');
const viewport = read('src/lib/buklodAdViewport.ts');

test('Unfilled video companion ad collapses while preserving an eligible viewport probe',()=>{
  assert.match(banner, /compactVideoCompanion = placement === 'video_companion' && compact/);
  assert.match(banner, /videoCompanionPending:\s*\{\s*minHeight: 8/);
  assert.match(banner, /compactVideoCompanion && !loaded && styles\.videoCompanionPendingShell/);
  assert.match(banner, /compactVideoCompanion && !loaded\s*\? \{ minHeight: 8 \}/);
  assert.match(viewport, /height >= 8/);
  assert.match(banner, /onAdLoaded=\{\(\) => \{/);
  assert.match(banner, /setLoaded\(true\)/);
  assert.match(banner, /onAdImpression/);
  assert.match(companion, /placement="video_companion"/);
  assert.match(companion, /requireViewport/);
  assert.match(ads, /'video_companion'/);
  assert.match(wall, /<BuklodVideoCompanionAd/);
});

test('Video retains contain default and sound, optional Fill cropping never recreates the player',()=>{
  assert.match(video, /const \[fillFrame, setFillFrame\] = useState\(false\)/);
  assert.match(video, /contentFit=\{fullscreen \|\| \(preserveAspectRatio && !fillFrame\) \? 'contain' : 'cover'\}/);
  assert.match(video, /accessibilityLabel=\{fillFrame \? 'Fit full video inside frame' : 'Fill video frame, cropping edges'\}/);
  assert.match(video, /onPress=\{\(\) => setFillFrame\(current => !current\)\}/);
  assert.match(video, /useVideoPlayer\(/);
  assert.match(video, /enableCommunityVideoSound/);
  assert.match(wall, /visibleVideoPostId===postId/);
  assert.match(wall, /refreshWallVideoUrl/);
});

test('Production placement remains monetized, with no fake creative or no-fill request storm',()=>{
  assert.match(banner, /getBuklodBannerUnitId\(placement\)/);
  assert.match(banner, /reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
  assert.match(banner, /if \(noFill && adNetworkAvailable\)/);
  assert.match(banner, /setFailed\(true\)/);
  assert.match(banner, /showLabel \? \(/);
  assert.doesNotMatch(companion, /getPublicUrl/);
});
