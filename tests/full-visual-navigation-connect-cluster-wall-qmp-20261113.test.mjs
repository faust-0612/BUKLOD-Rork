import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buklodVisual as v, buklodVisualColumns as columns } from '../src/lib/buklodVisual.ts';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('touch targets and story dimensions preserve compact readable hierarchy', () => {
  assert.ok(v.size.touch >= 48);
  assert.equal(v.radius.card,18);
  assert.ok(v.size.row >= v.size.touch);
  assert.ok(v.size.storyHeight < 200 && v.size.storyHeight > 150);
  assert.ok(v.size.avatar >= 64 && v.size.avatar < 100);
  assert.ok(v.type.body >= 15 && v.type.caption >= 12);
});
test('Home layout reduces columns when Android fonts grow instead of shrinking text', () => {
  assert.equal(columns(320,1),1);
  assert.equal(columns(393,1),2);
  assert.equal(columns(393,1.5),1);
  assert.equal(columns(600,1),3);
  assert.equal(columns(600,2),1);
  for (let width=240;width<=1200;width+=10) {
    let previous=3;
    for (const scale of [1,1.2,1.5,2,3]) {
      const count=columns(width,scale);
      assert.ok(count >= 1 && count <= previous);
      if(count>1) assert.ok(count*156*scale+(count-1)*8 <= width-24);
      previous=count;
    }
  }
});
function routes(path, text=read(path)) {
  return [...text.matchAll(/router\.(?:push|replace|navigate)\(\s*['"]([^'"]+)['"]/g)].map(match=>match[1]).sort();
}
const baseline='6b0f7e3167867bb746e34da4637430f131b588bb';
test('Profile, Cluster, Drawer and Wall keep every existing explicit destination',()=>{
  for(const path of ['src/app/(tabs)/me.tsx','src/app/clusters/index.tsx','src/app/drawer/index.tsx','src/app/(tabs)/buklod.tsx','src/app/settings/index.tsx']) {
    const prior=execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'});
    const now=routes(path);
    for(const route of routes(path,prior)) {
      if(path==='src/app/(tabs)/me.tsx' && [
        '/settings','/about-buklod','/account/personal-information',
        '/account/security','/preferences/language','/settings/sounds',
        '/account/recovery-pin','/account/deactivate','/account/delete',
        '/privacy','/privacy/notice','/contact-us','/support/live','/delete-account','/notifications'
      ].includes(route)) {
        // Owner moved duplicate actions out of Profile to the existing Settings
        // and central menu; verify actual reachability rather than stale location.
        const retained=read('src/app/settings/index.tsx')+'\n'+
          read('src/components/BuklodNavigationSideMenu.tsx');
        assert.ok(retained.includes("route: '"+(route==='/delete-account'?'/account/delete':route)+"'"), 'Lost destination '+route);
        assert.match(read(path), /accessibilityLabel="Profile options"/);
        continue;
      }
      assert.ok(now.includes(route),path+' lost '+route);
    }
  }
});
test('presentation changes leave core media, permissions, PTT and release contracts byte-identical',()=>{
  const paths=['src/components/CommunityVideo.tsx','src/lib/supabase.ts','src/providers/AuthProvider.tsx',
    'src/providers/AdsProvider.tsx','src/components/BuklodCommunityCommentComposer.tsx',
    'src/components/BuklodCommunityCommentBubble.tsx','src/components/BuklodPersistentBottomNav.tsx',
    'src/components/connect/ConnectComposer.tsx','app.config.js','eas.json','package.json','package-lock.json'];
  for(const path of paths) {
    const prior=execFileSync('git',['show',baseline+':'+path]);
    assert.deepEqual(fs.readFileSync(new URL('../'+path,import.meta.url)),prior,path+' changed');
  }
});
test('all eight visual areas are wired to shared metrics without restoring retired IGPAT',()=>{
  const paths=['src/app/(tabs)/hub.tsx','src/app/(tabs)/me.tsx','src/app/clusters/index.tsx',
    'src/app/(tabs)/buklod.tsx','src/components/BuklodMaritesBoard.tsx','src/app/(tabs)/messages.tsx',
    'src/app/settings/index.tsx','src/app/drawer/index.tsx'];
  for(const path of paths) assert.match(read(path),/buklodVisual/);
  const home=read('src/app/(tabs)/hub.tsx');
  assert.doesNotMatch(home,/<BuklodHomeDestinations\s*\/>|<BuklodFeatureFinder\s*\/>/);
  assert.doesNotMatch(home,/igpat/i);
  const finder=read('src/components/BuklodFeatureFinder.tsx');
  assert.match(finder,/showSuggestions/);
  assert.match(finder,/allowFontScaling/);
});
test('Home QMP disclosure preserves the personal estimate and nonwithdrawable warning',()=>{
  const s=read('src/components/BuklodCommunityContributionCard.tsx');
  assert.match(s,/accessibilityState=\{\{ expanded: detailsOpen \}\}/);
  assert.match(s,/setDetailsOpen\(value => !value\)/);
  assert.match(s,/ESTIMATE ONLY · NOT FINAL · NOT WITHDRAWABLE/);
  assert.match(s,/setData\(null\)/);
  const estimate=s.indexOf('accessibilityLabel="View my community contributions and earnings"');
  const disclosureEnd=s.indexOf('</View>}',s.indexOf('{detailsOpen &&'));
  assert.ok(estimate>disclosureEnd,'estimate must stay visible when breakdown is collapsed');
});

test('owner Android screenshot repairs compact the layout without removing actions or ads', () => {
  const home=read('src/components/home/BuklodHomeDestinations.tsx');
  assert.match(home,/minHeight: buklodVisual.size.touch \+ 6/);
  assert.match(home,/accessibilityHint=\{item.detail\}/);
  assert.doesNotMatch(home,/minHeight: 80/);
  const header=read('src/app/(tabs)/_layout.tsx');
  assert.match(header,/showTagline = headerWidth >= 460/);
  const profile=read('src/app/(tabs)/me.tsx');
  assert.match(profile,/paddingTop: coverUrl \? 104 : 56/);
  assert.match(profile,/height: 118, overflow: 'hidden'/);
  assert.match(profile,/marginTop: -10, borderRadius: 15, backgroundColor: theme.cardSurface/);
  assert.match(profile,/index === 0 \? <BuklodFirstViewAd/);
  assert.match(profile,/<BuklodScreenBottomBanner placement="profile" variant="large"/);
  const settings=read('src/app/settings/index.tsx');
  assert.match(settings,/<StatusBar barStyle=\{darkPalette \? 'light-content' : 'dark-content'\}/);
  assert.match(settings,/paddingVertical: 5/);
});
