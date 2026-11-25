import assert from 'node:assert/strict';
import { KINGDOM_REALM_PROFILES } from './kingdom-realm-visual-profiles.mjs';
export const REALM_DESIGN = Object.freeze({
 phan:['First Harvest','Stewardship','grain crates','market ledgers','delivery supplies'],
 quin:['Beyond the Horizon','Discovery','trail markers','ancient clues','expedition samples'],
 van:['Living City','Service','dispatch tokens','city signals','service parcels'],
 christian:['Covenant of Service','Leadership','council seals','wisdom markers','community supplies'],
 lhen:['Resonance of Life','Creativity','music notes','rhythm stones','instrument pieces'],
 ace:['The Guardian','Rescue','rescue beacons','safe-route markers','aid kits'],
 ellusur:['Sanctuary Builders','Restoration','repair materials','restoration plans','community tools'],
 jawo:['Into the Wild','Exploration','forest samples','trail signs','wildlife supplies'],
 mitch:['Color of Dawn','Art','pigment crystals','color patterns','art supplies'],
 niel:['Frontier of Purpose','Mission','mission flags','route clues','expedition kits'],
 angel:['Keeper of Treasures','Integrity','treasury tokens','audit seals','reserve supplies'],
 vhen:['Seeds of Promise','Cultivation','harvest baskets','crop markers','market produce'],
 trudice:['Wonder Garden','Wonder','memory blossoms','pattern stars','garden gifts'],
});
export function buildLivingKingdomCatalog(catalog){
 assert.equal(catalog.characters.length,13);
 const realms=catalog.characters.map(c=>{
  const key=c.characterId==='elesur'?'ellusur':c.characterId;
  const d=REALM_DESIGN[key],profile=KINGDOM_REALM_PROFILES[key];assert.ok(d&&profile,c.characterId);assert.equal(c.games.length,3);
  return {id:key,stationId:c.stationId,title:d[0],theme:d[1],profile,missions:c.games.map((g,i)=>({id:g.id,title:g.title,kind:['collect','sequence','delivery'][i],object:d[i+2],count:[3,3,2][i],legacyGenre:g.genre}))};
 });
 assert.equal(new Set(realms.map(x=>x.id)).size,13);
 assert.equal(new Set(realms.flatMap(x=>x.missions.map(m=>m.id))).size,39);
 return {schema:1,mode:'SESSION_LOCAL_ADVENTURE',serverSettlement:false,realms};
}
