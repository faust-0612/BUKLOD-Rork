import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  __resetCommunityVideoPosterCacheForTests,
  beginCommunityVideoPosterGeneration,
  getCommunityVideoPoster,
  publishCommunityVideoPoster,
  releaseCommunityVideoPosterGeneration,
  subscribeCommunityVideoPoster,
} from '../src/lib/communityVideoPosterCache.ts';

test('poster generation is deduplicated and can recover after failure', () => {
  __resetCommunityVideoPosterCacheForTests();
  assert.equal(beginCommunityVideoPosterGeneration('video-a'), true);
  assert.equal(beginCommunityVideoPosterGeneration('video-a'), false);
  releaseCommunityVideoPosterGeneration('video-a');
  assert.equal(beginCommunityVideoPosterGeneration('video-a'), true);
});

test('poster publication notifies only subscribers for the matching video', () => {
  __resetCommunityVideoPosterCacheForTests();
  let received: unknown = null;
  const unsubscribe = subscribeCommunityVideoPoster('video-a', poster => { received = poster; });
  publishCommunityVideoPoster('video-b', { id: 'b' });
  assert.equal(received, null);
  const poster = { id: 'a' };
  publishCommunityVideoPoster('video-a', poster);
  assert.equal(received, poster);
  assert.equal(getCommunityVideoPoster('video-a'), poster);
  unsubscribe();
});

test('poster cache is bounded and returns null for unknown media', () => {
  __resetCommunityVideoPosterCacheForTests();
  for (let i = 0; i < 30; i += 1) publishCommunityVideoPoster(`video-${i}`, { id: i });
  assert.equal(getCommunityVideoPoster('video-0'), null);
  assert.deepEqual(getCommunityVideoPoster('video-29'), { id: 29 });
  assert.equal(getCommunityVideoPoster(''), null);
});

test('CommunityVideo generates bounded posters only on native visible-player path and paints inactive previews', () => {
  const source = readFileSync('src/components/CommunityVideo.tsx', 'utf8');
  assert.match(source, /Platform\.OS !== 'web'.*beginCommunityVideoPosterGeneration/);
  assert.match(source, /generateThumbnailsAsync\(0\.1, \{ maxWidth: 720, maxHeight: 720 \}\)/);
  assert.match(source, /<ExpoImage[\s\S]*?source=\{poster\}/);
  assert.match(source, /posterScrim/);
});
