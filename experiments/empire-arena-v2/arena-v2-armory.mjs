/** Match-only item adaptations of ACTUAL BUKLOD Character collectible names.
 * Source of record: src/lib/buklodCharacterWorldCatalog.ts (L01,L03,L07,L10,L20 / I03).
 * No item here is a permanent inventory mint. Every loadout/drop is bound to hero ID.
 * These are skill-bearing relics occupying tactical gear slots, not assertions that
 * a pictured clipboard is physically a suit of armor or pair of boots.
 */
export const EQUIPMENT_SLOTS=Object.freeze(['weapon','shield','armor','boots','jewel']);
const ITEMS=Object.freeze({
 phan:['Hand-Forged Farm Hoe','Student Study Lamp','Intern Badge Scanner','Team Lead Whiteboard Marker Set','CEO Boardroom Gavel'],
 quin:['First Camera Toy Viewfinder','Student Compact Camera','Explorer Hiking Compass','Travel Planner Route Stylus','Tourism Empire Command Desk'],
 van:['Joy Tambourine','Student Pocket Bible','Church Worker Service Clipboard','Ministry Worker Counseling Pen Set','Global Mission Command Briefcase'],
 christian:['Student Debate Timer','Youth Leader Facilitation Cards','Intern Document Scanner','Team Leader Radio Set','Popular Politician Legacy Podium Seal'],
 lhen:['Fuel Pump Key Ring','Cashier Receipt Printer Roll Set','Church Youth Activity Bag','College Study Lamp','Global Educator Command Desk Seal'],
 ace:['Pocket First-Aid Pouch','Travel Chess Clock','Chess Competitor Magnetic Board','Junior Nurse BP Cuff','Legacy Care Champion Desk Seal'],
 ellusur:['Little Learner Colored Pencil Set','Student Helper Eraser Set','Farm Helper Hand Hoe','Teacher-in-Service Lesson Pointer','Legacy Shepherd Crook Staff'],
 jawo:['First Practice Guitar Pick','Student Musician Tuner','Guitar Learner Practice Amp Cable','Music Team Member In-Ear Pack','Purposeful Leader Command Briefcase'],
 mitch:['Little Dreamer Watercolor Set','Art Helper Brush Roll','Creative Mentor Critique Pointer','Tribal Educator Bead Loom','Legacy Art Mentor Master Brush Chest Tools'],
 niel:['Young Singer Karaoke Mic','Youth Helper Activity Bag','Student Mentor Facilitation Cards','Youth Pastor Visit Care Bag','Legacy Disciple-Maker Desk Seal'],
 angel:['Little Helper Coin Counter','Student Organizer Color Tabs','Budget Assistant USB Ledger Drive','Finance Coordinator Tablet','Legacy Steward Desk Seal'],
 vhen:['Seed Kit Hand Trowel','Student Worker Tool Belt','Community Helper Clipboard','Harvest Organizer Crate Dolly','Legacy Builder Command Desk Seal'],
 trudice:['Classroom Craft Kit','Sunday School Helper Activity Bag','Student Mentor Facilitation Cards','Classroom Teacher Lesson Tablet','Legacy Teacher Desk Seal']
});
const ITEM_LEVELS=[1,3,7,10,20];
const SLOT_BASE=Object.freeze({
 weapon:{attack:5},shield:{shieldMax:18,block:.035},armor:{hp:20,mitigation:.035},boots:{speed:.07},jewel:{mana:24,regen:.7,cooldown:.04}
});
const SIGNATURE=Object.freeze({
 phan:{resourceBonus:.025,repairBonus:.08},quin:{scoutRadius:1.2,dashBonus:.07},van:{healBonus:.09,allyShield:.04},
 christian:{defenseAura:.045,armyCommand:.08},lhen:{productionTempo:.07,rally:.045},ace:{accuracy:.07,execute:.035},
 ellusur:{shieldBonus:.09,control:.04},jawo:{dashBonus:.08,flank:.055},mitch:{buildTempo:.08,trapBonus:.07},
 niel:{disruptDuration:.07,signalRadius:.07},angel:{resourcePreserve:.045,healBonus:.045},
 vhen:{miningBonus:.045,sustain:.06},trudice:{decoyDuration:.09,control:.045}
});
export function itemDefinition(hero,slot,tier=1){
 const names=ITEMS[hero],i=EQUIPMENT_SLOTS.indexOf(slot);
 if(!names||i<0||!Number.isInteger(tier)||tier<1||tier>4)throw Error('Invalid exclusive Arena relic');
 const lv=ITEM_LEVELS[i],key=`${hero}:L${String(lv).padStart(2,'0')}:I03`;
 const statScale=1+(tier-1)*.24;
 const stats=Object.fromEntries(Object.entries(SLOT_BASE[slot]).map(([k,v])=>[k,Number((v*statScale).toFixed(4))]));
 // The original BUKLOD collectible remains identified by its canonical key/name.
 return Object.freeze({id:`${hero}-${slot}-t${tier}`,hero,slot,tier,sourceKey:key,sourceLevel:lv,
   name:names[i],label:`${names[i]} · T${tier}`,effect:`${slot.toUpperCase()} tactical relic`,stats,
   specialty:SIGNATURE[hero],temporary:true,transferable:false});
}
export function catalogueFor(hero){if(!ITEMS[hero])throw Error('Unknown BUKLOD hero');return EQUIPMENT_SLOTS.map(slot=>itemDefinition(hero,slot,1))}
export function resolveGear(hero,equipped={}){
 if(!ITEMS[hero])throw Error('Unknown hero');
 const out={attack:0,shieldMax:0,block:0,hp:0,mitigation:0,speed:0,mana:0,regen:0,cooldown:0,specialty:SIGNATURE[hero]};
 for(const slot of EQUIPMENT_SLOTS){const entry=equipped[slot];if(!entry)continue;
  // Rebuild from immutable definition: never trust a client-provided stats object.
  if(entry.hero!==hero||entry.slot!==slot)continue;
  const verified=itemDefinition(hero,slot,entry.tier);if(verified.id!==entry.id)continue;
  for(const [k,v]of Object.entries(verified.stats))out[k]+=v;
 }
 return out;
}
export function isExclusiveItem(hero,item){return Boolean(item&&ITEMS[hero]&&item.hero===hero&&EQUIPMENT_SLOTS.includes(item.slot)&&
  Number.isInteger(item.tier)&&item.tier>=1&&item.tier<=4&&itemDefinition(hero,item.slot,item.tier).id===item.id)};
export function dropTier({matchLevel=1,quality=0,phase='expansion',behind=false}={}){
 const score=Math.min(1,Math.max(0,quality)) + (behind?.11:0);
 if(phase==='hunt'&&matchLevel>=12&&score>.72)return 4;
 if(matchLevel>=9&&score>.61)return 3;
 if(matchLevel>=5&&score>.34)return 2;
 return 1;
}
/** Canonical milestone objects adapted as consumable field relics; no new name assets. */
const CONSUMABLE_NAMES=Object.freeze({
 phan:['First Harvest Rice Basket','Passing Grade Certificate Frame'],
 quin:['First Village Fair Ribbon','Student Field Trip Pass'],
 van:['First Joy Service Ribbon','Student Chapel Award'],
 christian:['Student Honor Roll Frame','Youth Leader Camp Leadership Medal'],
 lhen:['First Perfect Shift Star','Cashier Accuracy Award'],
 ace:['School Helper Armband','Chess Beginner First Win Ribbon'],
 ellusur:['Little Learner First Verse Seal','Student Helper Appreciation Star'],
 jawo:['Seedling Starter Kit','Student Musician Recital Ribbon'],
 mitch:['Little Dreamer First Drawing Frame','Art Helper Appreciation Star'],
 niel:['Young Singer First Solo Frame','Youth Helper Appreciation Medal'],
 angel:['Little Helper First Errand Star','Student Organizer Class Award'],
 vhen:['Harvest Basket First Yield','Student Worker Perfect Shift Star'],
 trudice:['Children Helper Ribbon','Sunday School Helper Appreciation Star']
});
export const CONSUMABLE_TYPES=Object.freeze(['health','mana']);
export function consumableDefinition(hero,type,tier=1){const names=CONSUMABLE_NAMES[hero],idx=CONSUMABLE_TYPES.indexOf(type);
 if(!names||idx<0||!Number.isInteger(tier)||tier<1||tier>4)throw Error('Invalid BUKLOD field consumable');
 const level=idx===0?1:3;
 return Object.freeze({id:`${hero}-consumable-${type}-t${tier}`,hero,kind:'consumable',type,tier,
  name:names[idx],sourceKey:`${hero}:L${String(level).padStart(2,'0')}:I04`,sourceLevel:level,
  amount:(type==='health'?36:39)+12*(tier-1),temporary:true,transferable:false});
}