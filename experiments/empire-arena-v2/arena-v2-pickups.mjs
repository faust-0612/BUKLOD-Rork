/**
 * BUKLOD Empire Arena match-only pickups.
 * 300 named pieces: 144 universal (12 effects x 4 motifs x 3 tiers)
 * and 156 exclusive (13 hero identities x 4 motifs x 3 tiers).
 * All item definitions are canonical; ground objects store only itemId.
 * No BP, QMP, Character Diamond or persistent inventory writes.
 */
export const PICKUP_LIMIT=24;
export const PICKUP_LIFETIME_MS=45000;
export const PICKUP_EFFECTS=Object.freeze({
 health:{base:34,duration:0,icon:'HP',color:'#7df2ab'},
 mana:{base:32,duration:0,icon:'MP',color:'#91caff'},
 shield:{base:28,duration:0,icon:'SH',color:'#b8f9f1'},
 xp:{base:38,duration:0,icon:'XP',color:'#ffe2a2'},
 wood:{base:25,duration:0,icon:'WD',color:'#abefab'},
 gold:{base:18,duration:0,icon:'AU',color:'#ffd87f'},
 stone:{base:20,duration:0,icon:'ST',color:'#c9d5ee'},
 haste:{base:.09,duration:16000,icon:'SP',color:'#9ee8ff'},
 fury:{base:.07,duration:17000,icon:'AT',color:'#ff9a8b'},
 guard:{base:.07,duration:20000,icon:'DF',color:'#d2baff'},
 regen:{base:1.4,duration:18000,icon:'RG',color:'#9cffce'},
 cooldown:{base:2200,duration:0,icon:'CD',color:'#dec9ff'}
});
const UNIVERSAL_MOTIFS=Object.freeze({
 health:['Rescue Bloom','Phoenix Vial','Sunrise Nectar','Medic Star'],
 mana:['Aether Pearl','Focus Battery','Astral Drop','Mind Lantern'],
 shield:['Guardian Shell','Crystal Buckler','Barrier Heart','Iron Halo'],
 xp:['Scholar Spark','Battle Chronicle','Experience Prism','Mentor Sigil'],
 wood:['Timber Bundle','Forest Crate','Ancient Bark','Carpenter Cache'],
 gold:['Prospector Pouch','Sun Coin','Royal Ingot','Gilded Cache'],
 stone:['Granite Chunk','Mason Chest','Bedrock Prism','Fortress Shard'],
 haste:['Wind Feather','Comet Boots','Gale Ribbon','Quickstep Stone'],
 fury:['Ember Claw','Solar Fang','War Drum','Storm Edge'],
 guard:['Sentinel Plate','Aegis Core','Bastion Crest','Ward Totem'],
 regen:['Life Seed','Verdant Dew','Healing Moss','Renewal Orb'],
 cooldown:['Clockwork Cog','Time Shard','Tempo Dial','Harmonic Spring']
});
const HERO_MOTIFS=Object.freeze({
 phan:[['Foundation Mallet','wood'],['Survey Prism','stone'],['Master Builder Core','regen'],['Forge Timing Gear','cooldown']],
 quin:[['Trailblazer Boots','haste'],['Explorer Focus Lens','mana'],['Expedition Chronometer','cooldown'],['Pathfinder Arrow','fury']],
 van:[['Carekeeper Satchel','health'],['Sanctuary Mantle','shield'],['Hope Radiance','regen'],['Concord Bell','mana']],
 christian:[['Captain Standard','guard'],['Unity Bulwark','shield'],['Command Blade','fury'],['Tactical Timepiece','cooldown']],
 lhen:[['Harmonic Lantern','mana'],['Rhythm Gear','cooldown'],['Restoration Chime','regen'],['Marching Tempo','haste']],
 ace:[['Rescue Vanguard Spear','fury'],['Knight Aid Guard','shield'],['Emergency Life Capsule','health'],['Chessguard Crest','guard']],
 ellusur:[['Shepherd Ward','guard'],['Care Lantern','health'],['Hilltop Barrier','shield'],['Protector Spring','regen']],
 jawo:[['Forest Dash Boots','haste'],['Flankblade Edge','fury'],['Swift Guitar Pick','cooldown'],['Trail Signal','mana']],
 mitch:[['Mural Stone Kit','stone'],['Craftsman Guard','guard'],['Artisan Barrier','shield'],['Workshop Metronome','cooldown']],
 niel:[['Mission Signal Clock','cooldown'],['Outreach Resonator','mana'],['Frontier Trail Boots','haste'],['Beacon Pulse','fury']],
 angel:[['Steward Gold Ledger','gold'],['Mercy Reserve','health'],['Treasury Ward','shield'],['Welfare Spring','regen']],
 vhen:[['Harvest Timber Pack','wood'],['Farmstead Mason Kit','stone'],['Blooming First Aid','health'],['Irrigation Seed','regen']],
 trudice:[['Wonder Lesson Orb','mana'],['Children Guard Bell','guard'],['Playground Dash Star','haste'],['Imagination Clock','cooldown']]
});
const RARITIES=['field','charged','radiant'];
const amountFor=(effect,tier,motif,exclusive)=>
  Number((PICKUP_EFFECTS[effect].base*(1+(tier-1)*.38+(motif%4)*.07)*(exclusive?1.09:1)).toFixed(3));
const catalogue=[];
for(const [effect,names] of Object.entries(UNIVERSAL_MOTIFS)){
  for(let i=0;i<4;i++)for(let tier=1;tier<=3;tier++){
    const rule=PICKUP_EFFECTS[effect];
    catalogue.push(Object.freeze({
      id:'u-'+effect+'-'+(i+1)+'-t'+tier,
      name:RARITIES[tier-1][0].toUpperCase()+RARITIES[tier-1].slice(1)+' '+names[i],
      effect,category:'universal',hero:null,tier,rarity:RARITIES[tier-1],
      minMatchLevel:[1,4,9][tier-1],value:amountFor(effect,tier,i,false),
      durationMs:Math.round(rule.duration*(1+(tier-1)*.18)),icon:rule.icon,color:rule.color,
      purpose:effect,temporary:true,transferable:false
    }));
  }
}
for(const [hero,motifs] of Object.entries(HERO_MOTIFS)){
  for(let i=0;i<4;i++)for(let tier=1;tier<=3;tier++){
    const [name,effect]=motifs[i],rule=PICKUP_EFFECTS[effect];
    catalogue.push(Object.freeze({
      id:'h-'+hero+'-'+(i+1)+'-t'+tier,
      name:RARITIES[tier-1][0].toUpperCase()+RARITIES[tier-1].slice(1)+' '+name,
      effect,category:'exclusive',hero,tier,rarity:RARITIES[tier-1],
      minMatchLevel:[1,4,9][tier-1],value:amountFor(effect,tier,i,true),
      durationMs:Math.round(rule.duration*(1+(tier-1)*.18)),icon:rule.icon,color:rule.color,
      purpose:hero+'_'+effect,temporary:true,transferable:false
    }));
  }
}
export const ARENA_PICKUP_CATALOG=Object.freeze(catalogue);
export const ARENA_PICKUP_BY_ID=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(catalogue.map(x=>[x.id,x]))));
const byTier=Object.freeze([1,2,3].map(tier=>Object.freeze({
 universal:Object.freeze(catalogue.filter(x=>x.category==='universal'&&x.tier===tier)),
 exclusive:Object.freeze(Object.fromEntries(Object.keys(HERO_MOTIFS).map(hero=>[
  hero,Object.freeze(catalogue.filter(x=>x.hero===hero&&x.tier===tier))
 ])))
})));
const bounded=(v,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):min;
export function arenaPickupEligible(player,drop){
 if(!player||!drop||drop.kind!=='field_pickup')return false;
 const item=ARENA_PICKUP_BY_ID[drop.itemId];
 return Boolean(item&&(!item.hero||item.hero===player.hero)&&
  (!drop.ownerHero||drop.ownerHero===player.hero));
}
/** Match-seeded draw. No Date.now, Math.random, unbounded retries or remote entitlement. */
export function rollArenaPickupDefinition({hero,matchLevel=1,source='hero',random}={}){
 if(typeof random!=='function')throw Error('seeded_random_required');
 const level=bounded(Math.floor(matchLevel),1,15);
 const maxTier=level>=9?3:level>=4?2:1;
 const r=bounded(random(),0,.999999);
 const bossBonus=source==='boss'?.09:0;
 const tier=maxTier===3&&r<.15+bossBonus?3:
  maxTier>=2&&r<.47+bossBonus?2:1;
 const exclusive=Boolean(HERO_MOTIFS[hero])&&bounded(random(),0,1)<.44;
 const candidates=exclusive?byTier[tier-1].exclusive[hero]:byTier[tier-1].universal;
 return candidates[Math.floor(bounded(random(),0,.999999)*candidates.length)];
}
/** Applies one drop to a live match player. A failed/ineffective claim does not consume it. */
export function applyArenaPickupEffect(match,player,definition,{awardXp,shieldCap}={}){
 if(!match||match.status!=='active'||!player?.alive||!definition||
   ARENA_PICKUP_BY_ID[definition.id]!==definition||
   definition.hero&&definition.hero!==player.hero)return null;
 const eff=definition.effect,now=match.elapsed,value=definition.value;
 const receipt={effect:eff,amount:0,durationMs:definition.durationMs};
 const add=(current,cap)=>Math.max(0,Math.min(value,cap-current));
 if(eff==='health'){
   receipt.amount=add(player.hp,player.maxHp);
   if(receipt.amount<=0)return null;player.hp+=receipt.amount;
 }else if(eff==='mana'){
   receipt.amount=add(player.mana,player.maxMana);
   if(receipt.amount<=0)return null;player.mana+=receipt.amount;
 }else if(eff==='shield'){
   const cap=typeof shieldCap==='function'?shieldCap(player):105;
   receipt.amount=add(player.shield||0,cap);
   if(receipt.amount<=0)return null;player.shield=(player.shield||0)+receipt.amount;
 }else if(eff==='xp'){
   if(player.matchLevel>=15||typeof awardXp!=='function')return null;
   awardXp(match,player,Math.round(value),'arena_pickup');receipt.amount=Math.round(value);
 }else if(eff==='wood'||eff==='gold'||eff==='stone'){
   const team=match.teams?.[player.team];
   if(!team||!team.resources)return null;
   const current=team.resources[eff]||0;
   receipt.amount=Math.max(0,Math.min(Math.round(value),10000-current));
   if(receipt.amount<=0)return null;team.resources[eff]=current+receipt.amount;
 }else if(eff==='cooldown'){
   if(!player.cooldowns)return null;
   for(const slot of ['primary','secondary','ultimate']){
     const last=player.cooldowns[slot];
     if(Number.isFinite(last)&&last> -1e7&&now-last<90000){
       player.cooldowns[slot]-=Math.round(value);receipt.amount+=Math.round(value);
     }
   }
   if(receipt.amount<=0)return null;
 }else if(['haste','fury','guard','regen'].includes(eff)){
   player.effects ||= {};
   const key='field'+eff[0].toUpperCase()+eff.slice(1);
   const active=player.effects[key]||0;
   // Bounded extension: many pickups cannot create a permanent stacking buff.
   player.effects[key]=Math.min(now+60000,Math.max(now,active)+definition.durationMs);
   const strengthKey=key+'Strength';
   player.effects[strengthKey]=Math.max(player.effects[strengthKey]||0,value);
   receipt.amount=value;
 }else return null;
 return receipt;
}
