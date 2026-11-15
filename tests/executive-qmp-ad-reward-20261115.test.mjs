import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Community QMP and revenue remain private, real, unchanged values', () => {
 const src=read('src/components/BuklodCommunityContributionCard.tsx');
 for(const field of ['loadMyCommunityContribution','loadMyCommunityQmpHistory','data.this_month_qmp','data.meaningful_replies','data.qualified_posts + data.qualified_videos','data.estimated_share_minor','formatMinorPhp','community-contribution']) assert.ok(src.includes(field),field);
 assert.match(src,/Estimate only · Not final · Not withdrawable/);
 assert.match(src,/detailsOpen \? <View/);
 assert.match(src,/recordCommunityEconomyAnalytics\('increase_share_opened'/);
});
test('Rewarded ad remains optional, only earned grants a real pass', () => {
 const src=read('src/components/BuklodAdLightRewardCard.android.tsx');
 for(const keep of ['showBuklodRewardedAd','warmBuklodRewardedAd','activateBuklodAdLightPass','getBuklodAdLightPassStatus','if (!result.earned)','status.active','Wall/native ads remain unchanged']) assert.ok(src.includes(keep),keep);
 assert.match(src,/color: theme.onAccent/);
 assert.ok(!src.includes('IGPAT'),'Retired IGPAT must not appear in rewarded ad copy');
});
test('Profile keeps own posts and actual rank separate from earnings and ad slots', () => {
 const src=read('src/app/(tabs)/me.tsx');
 for(const keep of ['BuklodProfilePostCards','BuklodProfileTopTenRankings','profile_mid_native','MY OVERALL & MONTHLY RANK','rankPositions?.overall','rankPositions?.monthly','BuklodScreenBottomBanner']) assert.ok(src.includes(keep),keep);
 assert.ok(src.indexOf('<BuklodProfilePostCards') < src.indexOf('<BuklodProfileTopTenRankings'),'Owner posts need to precede ranked list');
});
