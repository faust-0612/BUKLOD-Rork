import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const gateway=read('src/app/buklod-map.tsx');
const map=read('src/features/season2/genesis/GenesisValleyMap.tsx');
const guide=read('src/features/season2/genesis/GenesisWorldGuide.tsx');
const district=read('src/features/season2/genesis/genesisMapDistricts.ts');
const meta=JSON.parse(read('src/features/season2/genesis/genesisValleyHotspots.json'));

test('One tap on any visible map hotspot opens its real governed route without Enter',()=>{
  assert.match(gateway,/onSelect=\{hotspot => \{/);
  assert.match(gateway,/router\.push\(hotspot\.route as any\)/);
  assert.match(gateway,/if \(hotspot\.faithOnly && !showFaith\) return/);
  assert.doesNotMatch(gateway,/ENTER \{/);
  assert.doesNotMatch(gateway,/selectedHotspot\?\.route \?\? district\.destination/);
  assert.match(map,/Open '\+hotspot\.label\+' in one tap/);
  assert.match(map,/!h\.faithOnly \|\| showFaith/);
  assert.equal(meta.hotspots.length,14,'Approved gold-marker count preserved');
  assert.deepEqual(meta.hotspots.find(h=>h.id==='cluster-village')&&
    [meta.hotspots.find(h=>h.id==='cluster-village').x,meta.hotspots.find(h=>h.id==='cluster-village').y],
    [0.057,0.318],'Approved artwork marker alignment unchanged');
});

test('Character Kingdom and Empire Arena have distinct door ownership and routes',()=>{
  assert.match(district,/id: 'kingdom', title: 'Character Kingdom'/);
  assert.match(district,/id: 'empire-arena', title: 'Empire Arena'/);
  assert.match(district,/id: 'empire-arena'[\s\S]*?destination: '\/games\/empire-arena'/);
  const hero=meta.hotspots.find(h=>h.id==='kingdom-arena');
  assert.equal(hero.label,'Empire Arena');
  assert.equal(hero.districtId,'empire-arena');
  assert.equal(hero.route,'/games/empire-arena');
  assert.ok(existsSync(resolve(root,'src/app/games/empire-arena.tsx')));
  assert.match(gateway,/onCharacterKingdom=\{\(\) => router\.push\('\/games'/);
});

test('Animated guide lives physically outside the map, supports reduced motion and gives real one-tap help',()=>{
  const mapClose=gateway.indexOf('        />',gateway.indexOf('<GenesisValleyMap'));
  const guideIndex=gateway.indexOf('<GenesisWorldGuide');
  assert.ok(mapClose>0&&guideIndex>mapClose,'No character animation overlay on the approved map');
  assert.ok(guideIndex<gateway.indexOf('<View style={styles.mapSelectedCaption}>'));
  assert.match(guide,/ARENA_GENERATED_ART\['sprite:phan'\]/);
  assert.match(guide,/AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(guide,/active&&!reduceMotion/);
  assert.match(guide,/accessibilityRole="button"/);
  assert.match(guide,/onCharacterKingdom/);
  assert.match(guide,/onCommunityVillage/);
  assert.match(guide,/onDirectory/);
  assert.match(gateway,/onCommunityVillage=\{\(\) => router\.push\('\/clusters'/);
  assert.doesNotMatch(guide,/supabase|service_role|mint|claimBp|awardBp|eas update/i);
});

test('No new native module or automatic guide voice is introduced; first-view ads stay protected',()=>{
  assert.match(gateway,/BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
  assert.match(gateway,/useRorkGameAmbience\('kingdom-map'/);
  assert.doesNotMatch(guide,/Speech\.speak|expo-speech|setInterval/);
  assert.match(gateway,/requiresAcceptance/);
  assert.match(gateway,/update_required/);
  assert.match(gateway,/pilot_access_required/);
  assert.match(gateway,/!isGenesisPreviewBuild\(\)/);
});
