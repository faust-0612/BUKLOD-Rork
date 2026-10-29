import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allowBackgroundCommunityPhotoPrefetch as allow } from '../src/lib/communityMediaPrefetchPolicy.ts';

test('Android visible media always wins over speculative media prefetch', () => {
  for (const quality of ['normal','degraded','offline']) {
    assert.equal(allow('android', quality), false);
  }
});

test('Existing website/iOS prefetch remains available when online', () => {
  assert.equal(allow('web','normal'), true);
  assert.equal(allow('ios','normal'), true);
  assert.equal(allow('web','degraded'), true);
  assert.equal(allow('ios','offline'), false);
});

test('Wall does not sign a burst of background Android photo URLs', () => {
  const wall = fs.readFileSync('src/app/(tabs)/buklod.tsx','utf8');
  const start = wall.indexOf('if (allowBackgroundCommunityPhotoPrefetch(Platform.OS, classifyNetworkQuality())) {');
  const sign = wall.indexOf('firstVisibleMedia.map(', start);
  const prefetch = wall.indexOf('prefetchCommunityMedia(urls)', sign);
  const after = wall.indexOf('// COMMUNITY_AUTHOR_CIRCLE_RANK', prefetch);
  assert.ok(start >= 0 && sign > start && prefetch > sign && after > prefetch);
  assert.ok(wall.slice(prefetch, after).includes('      .catch(()=>undefined);\n    }'));
});

test('Image access and old media remain identical', () => {
  const native = fs.readFileSync('src/components/BuklodCachedMediaImage.android.tsx','utf8');
  const signer = fs.readFileSync('src/lib/buklodMediaUrl.ts','utf8');
  assert.match(native, /cachePolicy="memory-disk"/);
  assert.match(native, /decideAndroidPhotoRecovery/);
  assert.match(signer, /createSignedUrl\(path, 3600\)/);
});
