import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectSponsoredVideoSource, SPONSORED_VIDEO_SCROLLBACK_WARM_MS } from '../src/lib/advertise/sponsoredVideoDelivery.ts';
import { evaluateCachedEgressQuota, QUOTA_ALERT_THRESHOLDS } from '../scripts/buklod-cached-egress-thresholds.mjs';

const read = path => readFileSync(path, 'utf8');
const source = {
  video_url: 'https://assets.example.test/original.mp4',
  video_url_mobile: 'https://assets.example.test/mobile.mp4',
  video_url_low: 'https://assets.example.test/low.mp4',
};

test('optional renditions adapt by measured network while original remains a reliable fallback', () => {
  assert.equal(selectSponsoredVideoSource(source,'normal'),source.video_url_mobile);
  assert.equal(selectSponsoredVideoSource(source,'degraded'),source.video_url_low);
  assert.equal(selectSponsoredVideoSource(source,'offline'),source.video_url_low);
  assert.equal(selectSponsoredVideoSource({video_url:source.video_url},'normal'),source.video_url);
  assert.equal(selectSponsoredVideoSource({video_url:source.video_url},'degraded'),source.video_url);
  assert.equal(selectSponsoredVideoSource({...source,video_url_low:'http://not-secure.example/a.mp4'},'degraded'),source.video_url_mobile);
  assert.equal(selectSponsoredVideoSource({video_url:null},'normal'),null);
});

test('visible autoplay and existing 120ms fast-start prewarm are preserved', () => {
  const sponsor=read('src/components/BuklodCommunitySponsoredAd.tsx');
  const viewport=read('src/lib/advertise/sponsoredVideoViewport.ts');
  assert.match(sponsor,/useVideoPlayer\(source,/);
  assert.match(sponsor,/useCaching: true/);
  assert.match(sponsor,/videoNear \|\| retainedVideoCampaignId === campaign.id/);
  assert.match(sponsor,/visible=\{screenFocused&&videoVisible&&!scrollPaused\}/);
  assert.match(sponsor,/videoNear && screenFocused/); // old check is preserved in geometry effect or comment
  assert.match(sponsor,/setInterval\(check, SPONSORED_VIDEO_CHECK_MS\)/);
  assert.match(viewport,/SPONSORED_VIDEO_CHECK_MS = 120/);
  assert.match(sponsor,/player\.pause\(\)/);
  assert.match(sponsor,/screenFocused && \(videoNear \|\| retainedVideoCampaignId === campaign.id\)/);
  assert.ok(SPONSORED_VIDEO_SCROLLBACK_WARM_MS <= 1500);
  assert.match(sponsor,/clearTimeout\(timer\)/);
  assert.match(sponsor,/paidSponsorshipCanDisplay/);
  assert.doesNotMatch(sponsor,/autoPlay=\{false\}|setTimeout\(check,350\)/);
});

test('media selection stays stable during playback and db migration is purely additive', () => {
  const sponsor=read('src/components/BuklodCommunitySponsoredAd.tsx');
  const migration=read('supabase/migrations/20261119152000_paid_sponsor_ad_optional_mobile_renditions_r1.sql');
  const media=read('src/lib/advertise/paidSponsorshipDelivery.ts');
  assert.match(sponsor,/selectSponsoredVideoSource\(campaign, classifyNetworkQuality\(\)\)/);
  assert.match(sponsor,/campaign\?\.video_url_mobile, campaign\?\.video_url_low/);
  assert.match(media,/video_url_mobile\?: string \| null/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS video_url_mobile text/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS video_url_low text/);
  assert.doesNotMatch(migration,/DROP |UPDATE |DELETE |GRANT |ALTER POLICY/);
});

test('offline faststart compression keeps originals and never uploads or transcodes in playback', () => {
  const script=read('scripts/optimize-buklod-sponsored-video.mjs');
  assert.match(script,/'-movflags', '\+faststart'/);
  assert.match(script,/libx264/);
  assert.match(script,/video_url_mobile/);
  assert.match(script,/video_url_low/);
  assert.match(script,/No|no-paid-API/);
  assert.doesNotMatch(script,/deleteObject|updateCampaign|fetch\(/);
  assert.doesNotMatch(read('src/components/BuklodCommunitySponsoredAd.tsx'),/ffmpeg|compress:/);
});

test('50/70/85/95 thresholds do not misreport estimated logs as real billing', () => {
  assert.deepEqual(QUOTA_ALERT_THRESHOLDS,[50,70,85,95]);
  const base={source:'SUPABASE_ORGANIZATION_USAGE',cycleStart:'2026-12-02',quotaGb:250};
  assert.equal(evaluateCachedEgressQuota({...base,usedGb:125}, {...base,usedGb:100}).crossed.join(), '50');
  assert.deepEqual(evaluateCachedEgressQuota({...base,usedGb:175}, {...base,usedGb:125}).crossed,[70]);
  assert.deepEqual(evaluateCachedEgressQuota({...base,usedGb:212.5}, {...base,usedGb:175}).crossed,[85]);
  assert.deepEqual(evaluateCachedEgressQuota({...base,usedGb:237.5}, {...base,usedGb:212.5}).crossed,[95]);
  assert.deepEqual(evaluateCachedEgressQuota({...base,usedGb:237.5}, {...base,usedGb:237.5}).crossed,[]);
  assert.equal(evaluateCachedEgressQuota({ ...base, source:'EDGE_LOG_ESTIMATE',usedGb:248 }).status,'UNVERIFIED');
  assert.equal(evaluateCachedEgressQuota(null).status,'UNVERIFIED');
  assert.deepEqual(evaluateCachedEgressQuota({...base,usedGb:75,cycleStart:'2027-01-02'}, {...base,usedGb:240}).crossed,[]);
});
