import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sponsor=readFileSync('src/components/BuklodCommunitySponsoredAd.tsx','utf8');
const paid=readFileSync('src/lib/advertise/paidSponsorshipDelivery.ts','utf8');

test('paid ads still require approval, paid status, geographic eligibility and a visible impression',()=>{
  assert.match(sponsor,/paidSponsorshipCanDisplay\(/);
  assert.match(sponsor,/.eq\('status', 'approved'\)/);
  assert.match(sponsor,/.in\('payment_status', \['paid', 'waived'\]\)/);
  assert.match(sponsor,/event_type: 'impression'/);
  assert.match(sponsor,/measureInWindow/);
  assert.match(sponsor,/event_type: 'click'/);
  assert.match(paid,/campaign.status !== 'approved'/);
});

test('new video delivery preserves existing ads first-view preload and cache protections',()=>{
  assert.match(sponsor,/useVideoPlayer\(source,/);
  assert.match(sponsor,/useCaching: true/);
  assert.match(sponsor,/videoNear \|\| retainedVideoCampaignId === campaign.id/);
  assert.match(sponsor,/visible=\{screenFocused&&videoVisible&&!scrollPaused\}/);
  assert.match(sponsor,/setInterval\(check, SPONSORED_VIDEO_CHECK_MS\)/);
  assert.match(sponsor,/requestBuklodAudioFocus\('sponsor-ad'\)/);
  assert.doesNotMatch(sponsor,/setTimeout\(check,350\)|setInterval\(check,900\)/);
});

test('trusted compact-file publishing cannot mutate original campaign or silently run on the client',()=>{
  const publish=readFileSync('scripts/publish-buklod-sponsored-renditions.mjs','utf8');
  assert.match(publish,/if\(!apply\)/);
  assert.match(publish,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(publish,/url!==PROJECT_URL/);
  assert.match(publish,/originalPreserved:true/);
  assert.match(publish,/\.eq\('video_url',c\.video_url\)/);
  assert.match(publish,/cacheControl:'31536000',upsert:false/);
  assert.match(publish,/method:'HEAD'/);
  assert.doesNotMatch(publish,/EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(publish,/\.remove\(|\.delete\(/);
});
