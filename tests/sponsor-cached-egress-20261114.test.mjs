import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sponsor=readFileSync(new URL('../src/components/BuklodCommunitySponsoredAd.tsx',import.meta.url),'utf8');

test('public sponsored video uses stable Expo native byte cache without modifying monetization',()=>{
  assert.match(sponsor,/useMemo\(\(\) => \(\{uri, useCaching: true\}\), \[uri\]\)/);
  assert.match(sponsor,/useVideoPlayer\(source, p => \{/);
  assert.match(sponsor,/p\.loop = true/);
  assert.match(sponsor,/requestBuklodAudioFocus\('sponsor-ad'\)/);
  assert.match(sponsor,/subscribeBuklodAudioFocus/);
  assert.match(sponsor,/event_type: 'impression'/);
  assert.match(sponsor,/event_type: 'click'/);
});
test('viewport measurement is prompt and still bounded while screen is focused',()=>{
  assert.match(sponsor,/const warmup=requestAnimationFrame\(check\)/);
  assert.match(sponsor,/const watch=setInterval\(check,350\)/);
  assert.match(sponsor,/cancelAnimationFrame\(warmup\); clearInterval\(watch\)/);
  assert.match(sponsor,/AppState\.currentState !== 'active'/);
  assert.match(sponsor,/measureInWindow/);
  assert.match(sponsor,/if \(!visible\) \{ try \{player\.pause\(\)/);
});
test('creative size, high-resolution framing, paid visibility and other ads are preserved',()=>{
  assert.match(sponsor,/contentFit="contain"/);
  assert.match(sponsor,/resizeMode="contain"/);
  assert.match(sponsor,/nativeControls=\{false\}/);
  assert.match(sponsor,/paidSponsorshipCanDisplay/);
  assert.match(sponsor,/ROTATE_MS = 12_000/);
  assert.doesNotMatch(sponsor,/\.from\('community-media'\)\.remove/);
});
