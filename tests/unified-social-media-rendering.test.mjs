import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Android photo callbacks reject stale recycled-cell URL and renderer completions', () => {
  const source = read('src/components/BuklodCachedMediaImage.android.tsx');
  assert.match(source, /activeImageRef = useRef\(\{ identity, url: actual\.url, renderer: actual\.renderer \}\)/);
  assert.match(source, /activeImage\.identity !== identity \|\| activeImage\.url !== actual\.url \|\| activeImage\.renderer !== 'native'/);
  assert.match(source, /activeImage\.identity !== identity \|\| activeImage\.url !== actual\.url \|\| activeImage\.renderer !== 'expo'/);
  assert.match(source, /onDisplay=\{\(\) => \{\s*const activeImage = activeImageRef\.current;/);
});

test('Marites photo collage uses the same cache-aware renderer as Community Wall', () => {
  const collage = read('src/components/BuklodMaritesPhotoCollage.tsx');
  assert.match(collage, /import \{ BuklodCachedMediaImage \} from '@\/components\/BuklodCachedMediaImage'/);
  assert.equal((collage.match(/<BuklodCachedMediaImage/g) || []).length, 2);
  assert.doesNotMatch(collage, /from 'expo-image'/);
});

test('active Community video preserves cached first-frame poster until playback begins', () => {
  const source = read('src/components/CommunityVideo.tsx');
  assert.match(source, /posterSource=\{poster\}/);
  assert.match(source, /posterSource\?: any/);
  assert.match(source, /\(posterSource \|\| posterUri\) && !hasStartedPlayback/);
  assert.match(source, /source=\{posterSource \|\| \{ uri: posterUri! \}\}/);
});

test('secure media signing, bounded video cache and recovery remain intact', () => {
  const media = read('src/lib/buklodMediaUrl.ts');
  const video = read('src/lib/communityVideoPlayback.ts');
  assert.match(media, /resolveCommunityMediaUrl/);
  assert.match(media, /resignCommunityMediaUrl/);
  assert.match(video, /COMMUNITY_VIDEO_CACHE_BUDGET_BYTES = 256 \* 1024 \* 1024/);
  assert.match(video, /decideCommunityVideoErrorRecovery/);
});


test('Marites video cards and fullscreen viewer use the shared Wall video engine with sound controls', () => {
  const marites = read('src/components/BuklodMaritesBoard.tsx');
  assert.match(marites, /import \{ CommunityVideo, enableCommunityVideoSound \} from '@\/components\/CommunityVideo'/);
  assert.match(marites, /<CommunityVideo[\s\S]*?active=\{active\}[\s\S]*?autoPlay=\{autoPlay\}[\s\S]*?preserveAspectRatio[\s\S]*?onRequestPlay=\{enableCommunityVideoSound\}/);
  assert.match(marites, /autoPlayVideo \? <MaritesQuickVideo uri=\{story\.video_uri!\} autoPlay \/>/);
  assert.doesNotMatch(marites, /autoPlay muted/);
  assert.match(marites, /if \(viewStory\.video_uri\) return <MaritesQuickVideo uri=\{viewStory\.video_uri\} fullscreen \/>/);
});
