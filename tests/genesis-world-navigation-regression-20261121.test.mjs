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
test('World replaces cluttered Home only under Genesis preview, preserving original tabs and AdMob',()=>{
  const home=src('src/app/(tabs)/hub.tsx');
  assert.match(home,/if \(genesisPreview\) \{/);
  assert.match(home,/<Redirect href="\/buklod-map" \/>/);
  assert.doesNotMatch(home,/<GenesisWorld \/>/);
  assert.match(home,/BuklodFirstViewAd/);
  assert.match(home,/BuklodNativeSponsoredCard/);
  const layout=src('src/app/(tabs)/_layout.tsx');
  assert.match(layout,/!isGenesisPreviewBuild\(\) \? <SwipeDashboardHeader/);
  assert.match(layout,/BuklodDashboardAdWarmup/);
});
test('no legacy persistent navigation bar in Genesis and a compact return map action persists',()=>{
  const shell=src('src/components/BuklodNavSafeShell.tsx');
  assert.match(shell,/const genesisWorld = isGenesisPreviewBuild\(\)/);
  assert.match(shell,/!genesisWorld && !immersiveIgpat && !immersiveConversation/);
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

test('Genesis Home redirects to the single approved Valley and retains first-view ad before map',()=>{
  const home=src('src/app/(tabs)/hub.tsx');
  const map=src('src/app/buklod-map.tsx');
  assert.match(home,/<Redirect href="\/buklod-map" \/>/);
  const firstAd=map.indexOf('<BuklodFirstViewAd placement="home"');
  const valley=map.indexOf('<GenesisApprovedEntryMap');
  const guide=map.indexOf('<GenesisWorldGuide');
  assert.ok(firstAd>=0&&valley>firstAd&&guide>valley);
  assert.match(map,/if \(!isGenesisPreviewBuild\(\)\)/);
});
