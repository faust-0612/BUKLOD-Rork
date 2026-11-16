import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expectedEntries,validateArtManifest} from '../scripts/validate-character-collectible-art.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const world=read('src/lib/buklodCharacterWorldCatalog.ts');
const logic=read('src/lib/buklodCharacterCollectionLogic.ts');
const hub=read('src/app/points/character-collections.tsx');
const nav=read('src/app/points/progression.tsx');
const main=read('src/lib/buklodCharacterSelectionV2.ts');
const special=read('src/components/points/BuklodSpecialCharacterSeries.tsx');
const owned=read('src/lib/buklodCharacterCollectibles.ts');

test('all 1,300 expected image slots are deterministic and unique',()=>{
 const all=expectedEntries();
 assert.equal(all.length,1300);
 assert.equal(new Set(all.map(item=>item.key)).size,1300);
 assert.equal(new Set(all.map(item=>item.path)).size,1300);
 assert.deepEqual(all[0],{key:'phan:L01:I01',path:'character-collectibles/phan/l01-i01.webp'});
});
test('manifest validation rejects missing, duplicate and tampered artwork entries',()=>{
 const base={version:1,items:expectedEntries().map(item=>({...item,
  sha256:'a'.repeat(64),width:512,height:512}))};
 assert.equal(validateArtManifest(base).total,1300);
 assert.throws(()=>validateArtManifest({...base,items:base.items.slice(1)}),/1300/);
 const duplicate=base.items.map(item=>({...item}));
 duplicate[1]={...duplicate[0]};
 assert.throws(()=>validateArtManifest({version:1,items:duplicate}),/Duplicate/);
 const badHash=base.items.map(item=>({...item}));
 badHash[100].sha256='unverified';
 assert.throws(()=>validateArtManifest({version:1,items:badHash}),/SHA-256/);
 const badPath=base.items.map(item=>({...item}));
 badPath[100].path='../unsafe.png';
 assert.throws(()=>validateArtManifest({version:1,items:badPath}),/invalid image slot/);
});
test('source-of-truth 13x20x5 and 469 badges remain unchanged',()=>{
 for(const marker of ['characters: 13','stagesPerCharacter: 20','itemsPerStage: 5','collectiblesTotal: 1300','badgesTotal: 469'])
  assert.ok(world.includes(marker),marker);
 assert.match(logic,/BUKLOD_CHARACTER_COLLECTIBLE_ITEMS/);
 assert.match(logic,/BUKLOD_CHARACTER_BADGES/);
});
test('Character saved levels and verified ownership remain separate from task badges',()=>{
 assert.match(main,/character_levels: levels/);
 assert.match(hub,/savedCharacterLevel\(selection.character_levels/);
 assert.match(logic,/item.redeemedAt/);
 assert.match(logic,/item.collectibleId/);
 assert.match(hub,/AWARD STATUS UNAVAILABLE/);
 assert.match(hub,/get_my_buklod_special_collectibles_v2/);
 assert.match(special,/get_my_buklod_special_collectibles_v2/);
 assert.match(owned,/redeem_my_buklod_character_collectible_v1/);
});
test('main Character hub is reachable without changing production Character Studio art',()=>{
 assert.match(nav,/\/points\/character-collections/);
 assert.match(hub,/getMyBuklodCharacterSelectionV2/);
 assert.match(hub,/getMyCharacterCollectibles/);
 assert.match(hub,/onAuthStateChange/);
 assert.match(hub,/detailReq.current\+\+/);
 assert.match(hub,/🔒 NEXT SPECIAL/);
});
test('Character hub is read-only, preserving BP, Shards and QMP separation',()=>{
 for(const forbidden of ['setMyBuklodCharacterActiveV2(','.insert(','.update(','grantPoints(','awardBP(','setShards('])
  assert.ok(!hub.includes(forbidden),'must not write: '+forbidden);
 assert.match(logic,/storyStageProgress/);
 assert.match(logic,/verifiedStoryKeys/);
 assert.match(logic,/describeCharacterTaskRequirement/);
});

test('Special Character story ownership is independently fetched and never inferred from badge count',()=>{
 assert.match(hub,/get_my_buklod_character_story_tasks_v1/);
 assert.match(hub,/Promise\.allSettled/);
 assert.match(hub,/!item\.owned\|\|!item\.earned_at/);
 assert.match(hub,/getMyCharacterCollectibles\(selected as typeof CORE_CHARACTER_ORDER\[number\]\)/);
 assert.match(hub,/storyItemKey\(worldId,item\.level,item\.item_index\)/);
 assert.match(hub,/storyItemTaskTarget/);
});
test('Image publication and zoom are gated; no accidental heavy asset bundle or direct storage write',()=>{
 const art=read('src/lib/buklodCharacterArt.ts');
 const zoom=read('src/components/points/BuklodCharacterCollectibleZoom.tsx');
 assert.match(art,/published-v1\.json/);
 assert.match(art,/EXPECTED_COUNT = 1300/);
 assert.match(art,/loadCharacterArtPublication/);
 assert.match(zoom,/Gesture\.Pinch/);
 assert.match(zoom,/Gesture\.Pan/);
 assert.match(zoom,/cachePolicy="memory-disk"/);
 assert.match(hub,/verifiedCharacterArtUrl/);
 assert.match(zoom,/Source resolution limits detail|original collection-sheet resolution/);
});
