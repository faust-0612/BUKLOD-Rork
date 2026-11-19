/**
 * Season 2 only: instructions and reward meaning for every canonical collectible.
 *
 * The 1,300 Character artworks and all pre-Season-2 ownership remain governed
 * by existing Character V3. This describes ADDITIONAL optional Season 2 mastery
 * certification, not a retroactive lock, Character level grant or wallet credit.
 * All backend entitlements MUST be checked and written by the isolated S2 service.
 */
import {
  BUKLOD_CHARACTER_WORLD_IDS,
  BUKLOD_CHARACTER_DISPLAY_NAME,
  BUKLOD_COLLECTIBLE_REWARD_KINDS,
  buklodCollectibleName,
  buklodCharacterEraForLevel,
  type BuklodCharacterWorldId,
} from '@/lib/buklodCharacterWorldCatalog';

export const S2_COLLECTIBLE_GUIDE_RULE_VERSION = 's2-collectible-mastery-r1-preview' as const;
export const S2_COLLECTIBLE_TOTAL = 13 * 20 * 5;
export const S2_COLLECTIBLE_RELEASE = Object.freeze({
  grantsEnabled: false, /** Never derive a grant from this client flag. */
  serverVerificationRequired: true,
  existingCharacterInventoryImmutable: true,
  cashOrQmpRewards: false,
});
export type S2CollectibleSlot = 1|2|3|4|5;
export type S2GuideLanguage = 'fil'|'en';
export type S2GuideStep = Readonly<{
  key: string;
  kind: 'character'|'level'|'learning'|'community'|'foundation'|'prior_items';
  fil: string;
  en: string;
  serverEvidence: string;
  required: true;
}>;
export type S2CollectibleGuide = Readonly<{
  id:string;
  characterId:BuklodCharacterWorldId;
  characterName:string;
  level:number;
  itemIndex:S2CollectibleSlot;
  itemName:string;
  era:string;
  rewardKind:typeof BUKLOD_COLLECTIBLE_REWARD_KINDS[number];
  purpose:Readonly<{fil:string;en:string}>;
  benefit:Readonly<{fil:string;en:string}>;
  steps:readonly S2GuideStep[];
  notForSale:true;
  notFinancial:true;
  legacyItemsUnaffected:true;
}>;

const slots:Readonly<Record<S2CollectibleSlot,Readonly<{
  purpose:{fil:string;en:string};
  benefit:{fil:string;en:string};
  extra:readonly S2GuideStep[];
}>>> = {
  1: {
    purpose: {fil:'Alaala ng pinagmulan at pag-unlad ng character sa yugto.',en:'A memento of this character\'s story and current stage.'},
    benefit: {fil:'Opsyonal na collectible sa Character gallery. Hindi nagbibigay ng BP, XP, cash o stats.',en:'Optional Character gallery collectible; no BP, XP, cash, or stat increase.'},
    extra:[],
  },
  2: {
    purpose: {fil:'Patunay ng isang tunay na natapos na pagkatuto.',en:'Recognition of a verified learning achievement.'},
    benefit: {fil:'Season 2 mastery record para sa character. Hindi ito pang-cash-out.',en:'A Season 2 character mastery record, not a cash-out reward.'},
    extra:[{key:'learning',kind:'learning',fil:'Tapusin ang isang kwalipikadong reading at verification quiz. Kailangan ng natatanging server-verified learning receipt na hindi pa nagamit sa ibang item.',en:'Complete an eligible chapter and verification quiz. A distinct server-verified learning receipt must not be used for another item.',serverEvidence:'buklod_s2.source_receipt:kl_verified_chapter (unique claim)',required:true}],
  },
  3: {
    purpose: {fil:'Gantimpala sa makabuluhang ambag sa komunidad.',en:'Recognition for an authentic community contribution.'},
    benefit: {fil:'Opsyonal na mastery/display collectible. Walang points multiplier o ranking advantage.',en:'Optional mastery/display collectible without point multipliers or rank advantage.'},
    extra:[{key:'community',kind:'community',fil:'Magkaroon ng isang tunay at na-verify na original Wall post, makabuluhang reply, o Today/Dugtong. Iisang gamit lamang ang bawat receipt.',en:'Earn a verified original Wall post, meaningful reply, or Today/Dugtong receipt. Each receipt can support only one item.',serverEvidence:'buklod_s2.source_receipt:community source (unique claim)',required:true}],
  },
  4: {
    purpose: {fil:'Palatandaan ng balanse ng pagkatuto at pakikibahagi.',en:'A milestone representing learning and community contribution together.'},
    benefit: {fil:'Prestige mastery mark sa Season 2, hindi nabibili gamit ang tokens.',en:'Season 2 prestige mastery mark; cannot be purchased with tokens.'},
    extra:[{key:'foundation',kind:'foundation',fil:'Kumpletuhin ang P0 Foundation: isang verified learning at isang hiwalay na verified community contribution sa isang linggo. Kailangan ng na-claim na Foundation badge na hindi pa ginamit sa ibang item.',en:'Complete P0 Foundation: one verified learning and one separate verified community contribution in a week. An unused claimed Foundation badge is required.',serverEvidence:'buklod_s2.weekly_claim (unique use per collectible)',required:true}],
  },
  5: {
    purpose: {fil:'Panghuling pagkilala sa buong limang-item journey sa level na ito.',en:'Legacy recognition for finishing the stage collection journey.'},
    benefit: {fil:'Mastery completion/legacy display record; hindi dagdag na BP, QMP, o cash.',en:'Mastery completion/legacy display record; no BP, QMP, or cash.'},
    extra:[{key:'prior_items',kind:'prior_items',fil:'Dapat may server-certified mastery ang items 1, 2, 3, at 4 sa level na ito. Hindi sapat ang artwork o preview.',en:'All four preceding items in this level must have server-certified mastery; artwork or preview is insufficient.',serverEvidence:'buklod_s2.collectible_mastery:slots 1-4 (same character and stage)',required:true}],
  },
};

function validLevel(level:number):number{
  if(!Number.isInteger(level)||level<1||level>20) throw Error('Character stage must be 1–20');
  return level;
}
function validSlot(index:number):S2CollectibleSlot{
  if(!Number.isInteger(index)||index<1||index>5) throw Error('Item slot must be 1–5');
  return index as S2CollectibleSlot;
}
export function s2CollectibleId(characterId:BuklodCharacterWorldId,level:number,index:number):string{
  if(!(BUKLOD_CHARACTER_WORLD_IDS as readonly string[]).includes(characterId)) throw Error('Unknown character');
  return `s2:${characterId}:l${validLevel(level)}:i${validSlot(index)}`;
}
export function getS2CollectibleGuide(characterId:BuklodCharacterWorldId,level:number,index:number):S2CollectibleGuide {
  const id=s2CollectibleId(characterId,level,index),slot=validSlot(index),entry=slots[slot];
  const name=BUKLOD_CHARACTER_DISPLAY_NAME[characterId];
  const steps:S2GuideStep[]=[
    {key:'character',kind:'character',fil:`I-activate si ${name} bilang kasalukuyang Character para sa mga bagong claim.`,en:`Select ${name} as your active Character for new claims.`,serverEvidence:'private.buklod_character_selection_v2:active_character_id',required:true},
    {key:'level',kind:'level',fil:`Abutin ang ${name} Level ${level}. Ang XP ay sariling progress ng bawat character.`,en:`Reach ${name} Level ${level}. Character XP is separate for every character.`,serverEvidence:'private.buklod_character_progress_v3 + canonical active-point window',required:true},
    ...entry.extra,
  ];
  return Object.freeze({
    id,characterId,characterName:name,level:validLevel(level),itemIndex:slot,
    itemName:buklodCollectibleName(characterId,level,slot),
    era:buklodCharacterEraForLevel(level).label,
    rewardKind:BUKLOD_COLLECTIBLE_REWARD_KINDS[slot-1],
    purpose:entry.purpose,benefit:entry.benefit,
    steps:Object.freeze(steps),
    notForSale:true,notFinancial:true,legacyItemsUnaffected:true,
  });
}
export function allS2CollectibleGuides():S2CollectibleGuide[]{
  return BUKLOD_CHARACTER_WORLD_IDS.flatMap(characterId=>
    Array.from({length:20},(_,i)=>i+1).flatMap(level=>
      Array.from({length:5},(_,i)=>getS2CollectibleGuide(characterId,level,i+1))));
}

export type S2MasteryStatus='PREVIEW_ONLY'|'LOCKED'|'PENDING_VERIFICATION'|'CLAIMABLE'|'CERTIFIED';
export type S2MasterySnapshot=Readonly<{
  /* Read ONLY from a signed-in server adapter; never submit as award evidence. */
  serverAuthority:'buklod_s2';
  userId:string;
  ruleVersion:string;
  active:boolean;
  status:S2MasteryStatus;
  completedSteps:readonly string[];
}>;
export function presentationS2MasteryStatus(
  guide:S2CollectibleGuide,accountId:string|null|undefined,snapshot:S2MasterySnapshot|null,
):Readonly<{status:S2MasteryStatus;completedSteps:readonly string[];missingSteps:readonly S2GuideStep[]}>{
  const known=new Set(guide.steps.map(x=>x.key));
  const credible=Boolean(accountId&&snapshot&&snapshot.serverAuthority==='buklod_s2'
    &&snapshot.userId===accountId&&snapshot.ruleVersion===S2_COLLECTIBLE_GUIDE_RULE_VERSION
    &&snapshot.active);
  if(!credible) return {status:'PREVIEW_ONLY',completedSteps:[],missingSteps:guide.steps};
  const completedSteps=(snapshot!.completedSteps||[]).filter(x=>known.has(x));
  return {status:snapshot!.status,completedSteps,missingSteps:guide.steps.filter(x=>!completedSteps.includes(x.key))};
}
