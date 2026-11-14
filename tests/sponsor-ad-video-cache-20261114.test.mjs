import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sponsored=readFileSync(new URL('../src/components/BuklodCommunitySponsoredAd.tsx', import.meta.url), 'utf8');

test('sponsored ad video caches stable public MP4 bytes without altering ad delivery',()=>{
 assert.match(sponsored,/useMemo\(\(\) => \(\{uri, useCaching: true\}\), \[uri\]\)/);
 assert.match(sponsored,/useVideoPlayer\(source, p =>/);
 assert.match(sponsored,/paidSponsorshipCanDisplay/);
 assert.match(sponsored,/event_type: 'impression'/);
 assert.match(sponsored,/event_type: 'click'/);
 assert.match(sponsored,/nativeControls=\{false\}/);
});
test('sponsored ad in-view check starts next frame and preserves audio priority',()=>{
 assert.match(sponsored,/requestAnimationFrame\(check\)/);
 assert.match(sponsored,/setInterval\(check,350\)/);
 assert.match(sponsored,/cancelAnimationFrame\(warmup\)/);
 assert.match(sponsored,/requestBuklodAudioFocus\('sponsor-ad'\)/);
 assert.match(sponsored,/subscribeBuklodAudioFocus/);
 assert.match(sponsored,/contentFit="contain"/);
});
