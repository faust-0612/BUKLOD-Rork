import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const map=read('src/features/season2/genesis/GenesisKingdomLoreMaps.tsx');
const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
const motifs=read('src/features/season2/genesis/klKingdomVisualMotifs.ts');
test('Owner separate original five and eight character maps, no duplicate public tab shortcuts',()=>{
 const core=(map.split('export const CORE_KINGDOM_IDS=[')[1]||'').split('] as const;')[0];
 const special=(map.split('export const SPECIAL_KINGDOM_IDS=[')[1]||'').split('] as const;')[0];
 const ids=t=>[...t.matchAll(/'([a-z][a-z0-9-]+)'/g)].map(x=>x[1]);
 assert.equal(ids(core).length,5);
 assert.equal(ids(special).length,8);
 assert.equal(new Set([...ids(core),...ids(special)]).size,13);
 assert.match(map,/MAIN · 5/);assert.match(map,/SPECIAL · 8/);
 assert.match(portal,/<GenesisKingdomLoreMaps mode=\{mapMode\}/);
});
test('Visuals derive from approved KL dictionary motifs, independently per station',()=>{
 assert.match(map,/GenesisKingdomStationScene id=\{realm.id\}/);
 assert.match(map,/KL_KINGDOM_VISUAL_MOTIFS\[realm.id\]/);
 assert.match(motifs,/dictionaryTerm:'Lunawen'/);
 assert.match(motifs,/dictionaryTerm:'Dumalir'/);
 assert.match(motifs,/dictionaryTerm:'Ulnarik'/);
 assert.match(portal,/KINGDOM_NATURE_HIGH/);
});
test('Locked Special identities, names, faces, captions and routes never render before server unlock',()=>{
 assert.match(map,/mode==='core'\?CORE.has\(id\):SPECIAL.has\(id\)&&unlocked.includes\(character\)/);
 assert.match(map,/visible\?<GenesisKingdomStationScene/);
 assert.match(map,/visible\?realm.name:'Hindi pa nabubuksan'/);
 assert.match(map,/accessibilityLabel=\{visible\?'Enter '\+realm.name/);
 assert.match(map,/disabled=\{!visible\}/);
 assert.match(portal,/getMyBuklodCharacterSelectionV2\(userId\)/);
 assert.match(portal,/state.visible_special_character_ids/);
 assert.match(portal,/setVisibleSpecialIds\(\[\]\)/);
 assert.match(portal,/verifiedSpecialOwner===userId\?visibleSpecialIds:\[\]/);
 assert.match(portal,/setVerifiedSpecialOwner\(null\)/);
 assert.match(portal,/mapMode==='special'&&!visibleSpecialIds.includes\(realm.character\)/);
});
test('No new progression authority or ad overlay, canonical 13 game routes and footer remain',()=>{
 assert.match(portal,/router.push\(\('\/games\/' \+ realm.id\) as any\)/);
 assert.match(portal,/BuklodKingdomAdSlot placementId="kingdom_map_footer"/);
 assert.ok(portal.lastIndexOf('kingdomAdFooter}')>portal.indexOf('GenesisKingdomLoreMaps'));
 assert.doesNotMatch(map,/supabase\.|grantBp|awardBp|setMyBuklodCharacterActive/);
 assert.match(portal,/GenesisRiveCharacter active=\{animate\}/);
});
