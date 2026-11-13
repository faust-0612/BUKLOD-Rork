import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=read('src/app/(tabs)/hub.tsx');
const bottom=read('src/components/BuklodPersistentBottomNav.tsx');
const side=read('src/components/BuklodNavigationSideMenu.tsx');
test('five global tabs remain the sole persistent navigation owner', () => {
  for (const [name,route] of [['Home','/hub'],['Cluster','/clusters'],['Wall','/buklod'],['Connect','/messages'],['Profile','/me']]) {
    assert.ok(bottom.includes("label: '"+name+"'"),name);
    assert.ok(bottom.includes("route: '"+route+"'"),route);
  }
  assert.ok(side.includes('onRequestClose={onClose}'));
});
test('default Home cannot reintroduce duplicate bottom-navigation cards', () => {
  for (const forbidden of ['BuklodHomeDestinations','EVERYDAY ESSENTIALS','Return to Community Wall','accessibilityLabel="Open the Community Wall"', "label: 'Join Cluster'","label: 'Connect'"]) {
    assert.ok(!home.includes(forbidden),'Duplicate navigation returned: '+forbidden);
  }
});
test('distinct Home content, monetization placements and tools remain accessible',()=>{
  for (const required of ['<BuklodFeatureFinder','<Contribution','<Today','<BuklodHomeUtilityCards','<BuklodFirstViewAd','<BuklodNativeSponsoredCard','<BuklodKingdomHubCard','<DrawerCard','<PttCard','<Map','<Help']) {
    assert.ok(home.includes(required),'Unique Home content lost: '+required);
  }
  for (const item of ["label: 'Create Post'","label: 'Contribute'","label: 'Daily Reading'"])assert.ok(home.includes(item),item);
});
test('retired IGPAT remains absent from Home and canonical Wall stays reachable',()=>{
  assert.ok(!home.includes("router.push('/igpat')"));
  assert.ok(bottom.includes("route: '/buklod'"));
  assert.ok(side.includes("route: '/buklod'"));
});
