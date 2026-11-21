import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
const route=read('src/app/games/index.tsx');
const shell=read('src/components/BuklodNavSafeShell.tsx');
const premium=read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const original=(premium.split('const STATIONS: readonly Station[] = [')[1]||'').split('] as const;')[0];
const ids=Array.from(original.matchAll(/\{ id: '([^']+)'/g),x=>x[1]);
test('All 13 original canonical stations are restored as one-tap character-specific entrances',()=>{
 assert.equal(ids.length,13);
 assert.equal(new Set(ids).size,13);
 for(const id of ids){
   assert.ok(portal.includes("id:'"+id+"'"),'Missing original station '+id);
   assert.ok(portal.includes("'"+id+"':{"),'Missing original regional station plaque '+id);
 }
 assert.match(portal,/GENESIS_REALMS\.map\(\(realm,index\)/);
 assert.match(portal,/styles\.stationCard/);
 assert.match(portal,/router\.push\(\('\/games\/' \+ realm\.id\) as any\)/);
 assert.match(portal,/SWIPE · TAP TO PLAY/);
});
test('Existing season 2 panorama retained in original 16:9 graphics without substituting old illustrated map',()=>{
 assert.match(portal,/KINGDOM_NATURE_HIGH/);
 assert.match(portal,/KINGDOM_NATURE_COMPACT/);
 assert.match(portal,/aspectRatio:16\/9/);
 assert.match(portal,/contentFit="cover"/);
 assert.match(portal,/Tropical Valleys · Winter Peaks/);
 assert.doesNotMatch(portal,/<BuklodKingdomMapPremium|<IllustratedRealm/);
});
test('Kingdom ad appears last in scroll content and never acts as a sticky first-view overlay',()=>{
 const start=portal.indexOf('<ScrollView contentContainerStyle={styles.content}>');
 const ad=portal.indexOf('<BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" />');
 // The station rail contains its own nested horizontal ScrollView; close the OUTER page.
 const exit=portal.lastIndexOf('</ScrollView>');
 const disclaimer=portal.indexOf('Original Character Kingdom stations and routes.');
 assert.ok(start>=0&&ad>disclaimer&&ad<exit);
 assert.match(portal,/kingdomAdFooter:\{width:'100%'/);
 assert.match(route,/!genesisPreview \? <BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" \/> : null/);
 assert.match(shell,/!normalizedPath\.startsWith\('\/games'\)/);
 assert.match(portal,/Back to BUKLOD World map/);
 assert.doesNotMatch(portal,/position:'absolute'.*BuklodKingdomAdSlot/);
});
test('User-scoped local station clears never become server money or expose cross-account progress',()=>{
 assert.match(portal,/useAuth\(\)/);
 assert.match(portal,/loadBuklodKingdomPreviewProgress\(userId\)/);
 assert.match(portal,/subscribeBuklodKingdomPreviewProgress\(userId/);
 assert.match(portal,/setStationProgress\(emptyKingdomPreviewProgress\(\)\)/);
 assert.doesNotMatch(portal,/supabase\.|\.rpc\(|grant.*BP|mint.*BP|award.*BP/i);
});
test('Production remains on the original 13 station map; no production AdMob inventory removed',()=>{
 assert.match(route,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(route,/!genesisPreview \? <BuklodKingdomAdSlot/);
 assert.match(shell,/isGenesisPreviewBuild\(\)/);
 assert.match(portal,/kingdom_map_footer/);
});
