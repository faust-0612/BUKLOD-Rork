
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('QMP, revenue and ads retain private data and warnings after compact styling',()=>{
 const c=source('src/components/BuklodCommunityContributionCard.tsx');
 assert.match(c,/loadMyCommunityContribution\(\)/);
 assert.match(c,/loadMyCommunityQmpHistory\(\)/);
 assert.match(c,/setData\(null\)/);
 assert.match(c,/estimated_share_minor === null/);
 assert.match(c,/ESTIMATE ONLY · NOT FINAL · NOT WITHDRAWABLE/);
 assert.match(c,/recordCommunityEconomyAnalytics\('increase_share_opened'/);
 assert.match(c,/backgroundColor:contributionTone\.surface,padding:12,gap:7/);
 const home=source('src/app/(tabs)/hub.tsx');
 assert.match(home,/<BuklodFirstViewAd\b/);
 assert.match(home,/<BuklodNativeSponsoredCard\b/);
 assert.match(home,/<BuklodScreenBottomBanner\b/);
});
