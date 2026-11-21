import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const gateway=read('src/app/buklod-map.tsx');
const map=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
const guide=read('src/features/season2/genesis/GenesisWorldGuide.tsx');
const district=read('src/features/season2/genesis/genesisMapDistricts.ts');
const meta=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
const manifest=JSON.parse(read('assets/season2/genesis/world/approved-entry-map-manifest.json'));

test('The actual owner-approved landscape Entry Map image bytes are SHA-verified and bundled',()=>{
  const path=resolve(root,manifest.assetPath);
  assert.ok(existsSync(path));
  const binary=readFileSync(path);
  assert.equal(binary.length,473226);
  assert.equal(manifest.width,1672);
  assert.equal(manifest.height,941);
  assert.equal(createHash('sha256').update(binary).digest('hex'),'a343c70d1c71e849b536570bd92ede7134667d40347f6465003d41710e818b02');
  assert.match(map,/buklod-approved-entry-map-1672x941\.webp/);
});

test('Approved landscape has twelve real one-tap landmarks and separate Arena / Kingdom',()=>{
  assert.equal(meta.hotspots.length,12);
  assert.equal(new Set(meta.hotspots.map(h=>h.id)).size,12);
  const kingdom=meta.hotspots.find(h=>h.id==='character-kingdom');
  const arena=meta.hotspots.find(h=>h.id==='empire-arena');
  const village=meta.hotspots.find(h=>h.id==='community-village');
  assert.equal(kingdom.route,'/games');
  assert.equal(arena.route,'/games/empire-arena');
  assert.equal(village.route,'/clusters');
  assert.match(district,/id: 'kingdom', title: 'Character Kingdom'/);
  assert.match(district,/id: 'empire-arena', title: 'Empire Arena'/);
  for(const h of meta.hotspots){
    assert.ok(h.x>0&&h.x<1&&h.y>0&&h.y<1,h.id);
    assert.ok(district.includes("id: '"+h.districtId+"'"),h.districtId);
    assert.ok(h.route.startsWith('/'),h.route);
  }
});

test('One tap on approved sign opens guarded original route, including faith off alternative',()=>{
  assert.match(gateway,/<GenesisApprovedEntryMap/);
  assert.match(gateway,/onOpen=\{\(door,route\) => \{/);
  assert.match(gateway,/router\.push\(route as any\)/);
  assert.match(map,/onPress=\{\(\)=>onOpen\(door,door\.faithOnly&&!showFaith/);
  assert.doesNotMatch(gateway,/ENTER \{/);
  assert.match(map,/door\.fallbackRoute\|\|'\/learn'/);
  assert.match(gateway,/requiresAcceptance/);
  assert.match(gateway,/update_required/);
  assert.match(gateway,/pilot_access_required/);
  assert.match(gateway,/!isGenesisPreviewBuild\(\)/);
});

test('The moving Phan character guide is located OUTSIDE the approved map',()=>{
  const mapClose=gateway.indexOf('        />',gateway.indexOf('<GenesisApprovedEntryMap'));
  const guideIndex=gateway.indexOf('<GenesisWorldGuide');
  assert.ok(mapClose>0&&guideIndex>mapClose);
  assert.match(guide,/ARENA_GENERATED_ART\['sprite:phan'\]/);
  assert.match(guide,/AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(guide,/active&&!reduceMotion/);
  assert.match(guide,/onCharacterKingdom/);
  assert.match(guide,/onCommunityVillage/);
  assert.match(gateway,/onCharacterKingdom=\{\(\) => router\.push\('\/games'/);
  assert.doesNotMatch(guide,/supabase|service_role|mint|claimBp|awardBp|setInterval/i);
});

test('Built-in illustrated menu, profile, notifications and search icons have REAL tap routes',()=>{
  assert.match(gateway,/onMenu=\{/);
  assert.match(gateway,/onProfile=\{/);
  assert.match(gateway,/onNotifications=\{/);
  assert.match(gateway,/onSearch=\{/);
  for(const label of ['Open BUKLOD destinations menu','Open my BUKLOD profile','Open notifications','Search BUKLOD'])assert.ok(map.includes(label));
  assert.match(gateway,/onSearch=\{\(\) => router\.push\('\/feature-search'/);
  assert.match(gateway,/onNotifications=\{\(\) => router\.push\('\/notifications'/);
});

test('Genesis Home shows SAME approved image, not second schematic; first-view ad protected',()=>{
  const hub=read('src/app/(tabs)/hub.tsx');
  assert.match(hub,/<Redirect href="\/buklod-map" \/>/);
  assert.doesNotMatch(hub,/<GenesisWorld \/>/);
  assert.match(gateway,/BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
  assert.match(gateway,/useRorkGameAmbience\('kingdom-map'/);
  assert.doesNotMatch(guide,/Speech\.speak|expo-speech/);
});
