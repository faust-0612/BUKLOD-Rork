import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');

test('Main Kingdom retains all canonical station coordinates and destinations', () => {
  const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  const legacy = read('src/app/games/legacy.tsx');
  const ids = [
    ['phan-enterprise-builder',110,660], ['vhen-farm-to-market',265,745],
    ['jawo-forest-trail',170,475],['trudice-playground-memory',355,375],
    ['mitch-restore-mural',505,545],['christian-civic-leadership',580,285],
    ['ace-rescue-grid',720,430],['van-living-city-dispatch',825,260],
    ['lhen-rhythm-journey',970,350],['angel-kingdom-treasury',910,620],
    ['niel-mission-trail',690,710],['elesur-village-builder',1040,710],
    ['quin-discovery-expedition',1045,135],
  ];
  const lines=map.split('\n').filter(s=>/^  \{ id: '/.test(s));
  assert.equal(lines.length,13,'Never add or delete a station');
  ids.forEach(([id,x,y])=>{
    assert.match(map,new RegExp("id: '"+id+"'[^\\n]*x: "+x+", y: "+y+""));
    assert.ok(legacy.includes("'/games/"+id+"'"), 'missing legacy game link: '+id);
  });
  assert.match(read('src/app/games/index.tsx'), /BuklodKingdomMapPremium/);
  assert.match(map, /router\.push\('\/games\/legacy'/);
});

test('modern Kingdom scalable SVG and Skia/Reanimated animations retain live accessibility guards', () => {
  const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  const fx = read('src/features/games/kingdom/BuklodKingdomLivingFX.native.tsx');
  assert.ok(map.includes('<IllustratedRealm mapWidth={mapWidth} mapHeight={mapHeight} stage={stage}'));
  assert.ok(map.includes("import BuklodKingdomLivingFX from './BuklodKingdomLivingFX'"));
  assert.ok(map.includes('<BuklodKingdomLivingFX'));
  assert.ok(map.includes('stage={stage} scale={scale} mapWidth={mapWidth} mapHeight={mapHeight}'));
  assert.ok(map.includes('selected={selectedStation} cleared={clearedFXStations} cinematic={cinematicFX}'));
  for (const label of ['EXPLORE THE KINGDOM','Open Kingdom Hall of Legacy','SUNSPIRE RUINS'])
    assert.ok(map.includes(label), label);
  assert.ok(map.includes("useRorkGameAmbience('kingdom-map')"));
  assert.ok(map.includes('onPress={toggleMusic}'));
  for (const contract of [
    'AccessibilityInfo.isReduceMotionEnabled()',
    "AppState.addEventListener('change'",
    'useFocusEffect(useCallback(',
    'withRepeat(withTiming(1,',
    'cancelAnimation(phase)',
    '<Canvas',
    'pointerEvents="none"',
  ]) assert.ok(fx.includes(contract), 'modern native FX missing '+contract);
  for (const forbidden of ['supabase','grantPoints(','awardPoints(','fetch('])
    assert.ok(!fx.includes(forbidden),'decorative FX must never access economy/network: '+forbidden);
});

test('legacy visual finishes are cosmetic and claims stay on the official account ledger', () => {
  const screen=read('src/app/games/legacy.tsx');
  const medal=read('src/features/games/kingdom/KingdomRelicEmblem.tsx');
  for(const tier of ['bronze','silver','gold','legendary']) assert.ok(medal.includes(tier));
  for(const type of ['expression','speech','profile_frame','visual_effect','title_badge']) assert.ok(medal.includes(type));
  assert.match(screen,/getMyBuklodCharacterSelectionV2/);
  assert.match(screen,/redeemMyCharacterCollectible\(core, targetLevel, index\)/);
  assert.match(screen,/await accountUnchanged\(\)/);
  assert.match(screen,/setReveal\(\{ name: collectibleNames\(core, targetLevel\)\[index-1\]/);
  assert.match(screen,/New relics and Shards are not yet spendable or claimable/);
  for(const forbidden of ['setShards','grantKingdomXp','awardBP','creditPoints']) assert.ok(!screen.includes(forbidden+'('));
});

test('active Character switch clears stale equipment and refreshes live character collection', () => {
  const screen=read('src/app/games/legacy.tsx');
  assert.match(screen, /activeIdRef\.current = next\.active_character_id/);
  assert.match(screen, /levelRef\.current = next\.character_level/);
  assert.match(screen, /getMyCharacterCollectibles\(hero as BuklodCoreCharacterId\)/);
  assert.match(screen, /accountRef\.current === uid && activeIdRef\.current === hero/);
  assert.match(screen, /activeIdRef\.current !== original\.core \|\| levelRef\.current !== original\.level/);
  assert.match(screen, /setCollection\(null\)/);
  assert.match(screen, /setReveal\(null\)/);
});
