import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('canonical Home has no duplicate house, Health or Kingdom cards on either layout',()=>{
  const home=read('src/app/(tabs)/hub.tsx');
  const utilities=read('src/components/home/BuklodHomeUtilityCards.tsx');
  const quick=read('src/components/home/BuklodExecutiveQuickAccess.tsx');
  for(const obsolete of ['BuklodKingdomHubCard','/personal-home','/profile/buklod-health']) {
    assert.ok(!home.includes(obsolete) && !utilities.includes(obsolete) && !quick.includes(obsolete), 'Duplicated Home entry: '+obsolete);
  }
  assert.equal(home.split('<BuklodHomeUtilityCards />').length-1,2);
  for(const mustRemain of ['<Today />','<BuklodFirstViewAd','<BuklodNativeSponsoredCard','<BuklodScreenBottomBanner','<Map />','<Help />','<PttCard />','<Contribution />']) {
    assert.ok(home.includes(mustRemain), 'Missing dashboard service: '+mustRemain);
  }
  assert.ok(utilities.includes("router.push('/children-stories'"));
});

test('Family personal Home is public but Family workspace remains role protected',()=>{
  const family=read('src/app/profile/buklod-family.tsx');
  const workspace=read('src/app/profile/buklod-family-workspace.tsx');
  const routeGuard=read('src/components/BuklodFocusAppRouteGuard.tsx');
  const catalog=read('src/lib/buklodFoundation.ts');
  assert.ok(family.includes("router.push('/personal-home'"));
  assert.ok(family.includes("router.push('/profile/buklod-family-workspace'"));
  assert.ok(workspace.includes('BuklodFoundationPortalShell'));
  assert.ok(routeGuard.includes("pathname === '/profile/buklod-family'"));
  assert.ok(catalog.includes("path === '/profile/buklod-family-workspace'"));
});

test('patient Health Center remains accessible in Health without exposing tokens',()=>{
  const health=read('src/app/profile/buklod-health.tsx');
  const menu=read('src/components/BuklodFoundationWorkspaceNav.tsx');
  const launcher=read('src/lib/buklodHealthCenterLauncher.ts');
  assert.ok(health.includes('Online Consultation') && health.includes('Full Health Center'));
  assert.ok(menu.includes("app === 'health'") && menu.includes('Consultation · Health Center'));
  assert.ok(!launcher.includes('access_token') && !launcher.includes('refresh_token'));
});

test('BUKLOD Today is compact but preserves server-side reactions, privacy and Dugtong history',()=>{
  const tip=read('src/components/BuklodTodayCard.tsx');
  for(const key of ['get_buklod_today_tip_v2','react_to_buklod_today_tip_v2','set_buklod_today_dugtong_visibility_v2',
    'get_my_buklod_today_dugtong_history_v2','list_buklod_today_dugtongs_v2',
    'Magbahagi ng Dugtong','showComposer','p_cycle_id:tip.cycle_id','unchangedDugtong',
    'if(data?.ok!==true)throw','fontSize:23','fontSize:16','minHeight:44']) {
    assert.ok(tip.includes(key), 'Missing Today contract: '+key);
  }
  assert.ok(!tip.includes('BUKLOD TODAY • COMMUNITY TIPS'));
  assert.ok(!tip.includes("borderColor:'#AD65FF'"));
  assert.ok(!tip.includes('Share to Wall'));
});
