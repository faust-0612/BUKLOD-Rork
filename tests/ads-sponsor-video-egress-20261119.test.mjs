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
