import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Executive Home retains data, native ads and original support/map/Kingdom doors', () => {
 const home=read('src/app/(tabs)/hub.tsx');
 assert.match(home, /<BuklodExecutiveQuickAccess\s*\/>/);
 for(const preserved of ['BuklodSystemAnnouncementBoard','BuklodCommunityContributionCard','BuklodFirstViewAd','BuklodNativeSponsoredCard','BuklodScreenBottomBanner','<DrawerCard','<PttCard','<Map','<Help']) {
   assert.ok(home.includes(preserved), 'Lost Home operation '+preserved);
 }
 assert.match(home, /paddingHorizontal: buklodVisual\.space\.screen/);
 assert.match(home, /paddingBottom: 16, gap: 9/);
});
test('Quick access keeps five compact non-tab routes without duplicating Health Center', () => {
  const quick=read('src/components/home/BuklodExecutiveQuickAccess.tsx');
  for(const route of ['/bible','/kabihasnang-ligaw','/faith/bible-quiz','/faith/hymns','/feature-search']) assert.ok(quick.includes("route:'"+route+"'"),route);
  for(const duplicated of [ "route:'/hub'", "route:'/clusters'", "route:'/buklod'", "route:'/messages'", "route:'/me'", "route:'/profile/buklod-health'" ]) assert.ok(!quick.includes(duplicated), duplicated);
  assert.match(quick,/minHeight: 64/);
  assert.match(quick,/fontScale >= 1\.4/);
  assert.match(quick,/router\.push\(item\.route/);
});
test('Cluster maintains authenticated scoped actions and compact accessible rows', () => {
 const src=read('src/app/clusters/index.tsx');
 for(const preserved of ['getMyClusters','discoverClusters','joinCluster','respondClusterInvite','clusterScopeManageRoute','enterScopedWorkspace','refreshControl','membership_status','showAllMyClusters','My Clusters']) assert.ok(src.includes(preserved),'Missing '+preserved);
 assert.match(src, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\}/);
 assert.match(src, /minHeight: 44/);
 assert.match(src, /backgroundColor: theme\.cardSurface/);
 assert.match(src, /paddingHorizontal: buklodVisual\.space\.screen/);
 assert.match(src, /disabled=\{!canOpen\}/);
});
test('Kingdom remains a compact original /games navigation card', () => {
 const src=read('src/components/home/BuklodKingdomHubCard.tsx');
 assert.match(src, /router\.push\('\/games'/);
 assert.match(src, /13 CHARACTER CENTERS/);
 assert.match(src, /background: \{ minHeight: 162/);
 assert.match(src, /minHeight: 48/);
});
