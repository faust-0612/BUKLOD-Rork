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

test('distant sponsored headers do not instantiate an eager MP4 player, but prewarm one viewport ahead',()=>{
 assert.match(sponsored,/preparedCampaignId, setPreparedCampaignId/);
 assert.match(sponsored,/const nearViewport=w>40&&h>40/);
 assert.match(sponsored,/y<screen\.height\*1\.5&&y\+h>-screen\.height\*0\.5/);
 assert.match(sponsored,/preparedCampaignId === campaign\.id && screenFocused/);
 assert.match(sponsored,/<View style=\{s\.media\}\/><View style=\{s\.videoBar\}\/>/);
 assert.match(sponsored,/if \(AppState\.currentState !== 'active'\) \{setVideoVisible\(false\); setPreparedCampaignId\(null\)/);
});
