import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('preview-only auth entry selects World, regular production entry stays the Public Wall',()=>{
  const boot=src('src/app/index.tsx');
  assert.match(boot,/href=\{isGenesisPreviewBuild\(\) \? '\/buklod-map' : '\/\(tabs\)\/buklod'\}/);
  assert.match(boot,/requiresAcceptance/);
  assert.match(boot,/selectScope/);
  assert.match(boot,/bootReady/);
});
test('Genesis starts at approved map but Home stays independently reachable',()=>{
 const home=src('src/app/(tabs)/hub.tsx');
 const entry=src('src/app/buklod-map.tsx');
 assert.doesNotMatch(home,/<Redirect href="\/buklod-map" \/>/);
 assert.match(entry,/<BuklodMapHeader \/>/);
 assert.match(entry,/<GenesisApprovedEntryMap/);
 assert.match(src('src/features/season2/world/BuklodMapGuideDock.tsx'),/label:'Maglaro\?',icon:'gamepad-variant-outline',route:'\/season2\/games'/);
 assert.match(home,/BuklodFirstViewAd/);
 assert.match(home,/BuklodNativeSponsoredCard/);
 const layout=src('src/app/(tabs)/_layout.tsx');
 assert.match(layout,/!isGenesisPreviewBuild\(\) \? <SwipeDashboardHeader/);
 assert.match(layout,/BuklodDashboardAdWarmup/);
});
test('the same persistent bottom navigation is kept in Genesis; map return is still reachable',()=>{
  const shell=src('src/components/BuklodNavSafeShell.tsx');
  assert.match(shell,/const genesisWorld = isGenesisPreviewBuild\(\)/);
  assert.match(shell,/!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0/);
  assert.match(shell,/worldReturnEligible/);
  assert.match(shell,/router\.replace\('\/buklod-map'/);
  assert.match(shell,/keyboardVisible/);
});
test('map-first future assets cannot falsely advertise active purchases or user rewards',()=>{
  const map=src('src/components/world/BuklodGenesisWorldHome.tsx');
  const registry=src('src/features/world/worldCatalog.ts');
  assert.match(map,/WORLD_COMPLETE_DESTINATION_DIRECTORY/);
  assert.match(registry,/state: 'available' \| 'preview'/);
  assert.match(map,/No wallet, land ownership or purchases are active in this preview/);
  assert.doesNotMatch(map,/(?:supabase\.rpc|\.from\(['"]buklod_points|claimBp|awardBp|purchaseBp)/i);
  for(const area of ['cluster','wall','connect','faith','learning','kingdom','myworld','market','government','health','family','profile'])
    assert.ok(map.includes("id:'"+area+"'"),area);
});
test('existing source-owned audio and sponsors stay permissioned and mounted without new native SDKs',()=>{
  const map=src('src/components/world/BuklodGenesisWorldHome.tsx');
  assert.match(map,/kingdom-village\.ogg/);
  assert.match(map,/subscribeBuklodAudioFocus/);
  assert.match(map,/musicEnabled/);
  assert.match(map,/player\.pause\(\)/);
  assert.match(map,/AppState\.addEventListener/);
  assert.match(map,/AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(map,/BuklodFirstViewAd/);
  assert.match(map,/BuklodCommunitySponsoredAd/);
  assert.match(map,/BuklodNativeSponsoredCard/);
  assert.match(map,/BuklodScreenBottomBanner/);
});

test('Approved World Map removes entry ad only; guide and Home monetization remain',()=>{
 const home=src('src/app/(tabs)/hub.tsx'),map=src('src/app/buklod-map.tsx');
 const portrait=map.slice(map.indexOf('portraitFirstView'));
 assert.match(home,/BuklodFirstViewAd placement="home"/);
 assert.doesNotMatch(home,/<Redirect href="\/buklod-map"/);
 assert.doesNotMatch(map,/BuklodFirstViewAd|toggleMusic|Music on/);
 assert.ok(portrait.lastIndexOf('{mapNode}')>=0 &&
  portrait.lastIndexOf('{mapNode}')<portrait.lastIndexOf('<BuklodMapGuideDock'));
 assert.match(map,/useRorkGameAmbience\('kingdom-map',\{autoStart:canPlayMusic\}\)/);
 assert.match(map,/if \(!isGenesisPreviewBuild\(\)\)/);
});
