/**
 * Season 2 badge unlock DESIGN for 469 catalog names. Read-only criteria only:
 * NO server grant, entitlement, retroactive relock, BP/QMP/XP or money change.
 * All thresholds marked PROPOSED until owner approval, RLS and actual source
 * receipts are tested in isolated staging.
 */
export type S2BadgeGuideKind='stage'|'era'|'journey'|'starter'|'series';
export const S2_BADGE_CRITERIA_VERSION='s2-badge-candidate-r1-not-active' as const;
export const S2_BADGE_CRITERIA_STATUS='PROPOSED_OWNER_FINAL_SIGNOFF_AND_SERVER_NOT_LIVE' as const;
export const S2_BADGE_CATEGORY_COUNTS=Object.freeze({
 characterSignature:13,stage:260,era:65,characterMastery:13,
 characterJourney:52,starterPack:58,series:8,total:469,
});
const eras=[
 {name:'BEGIN',first:1,last:4},
 {name:'GROW',first:5,last:8},
 {name:'CONTRIBUTE',first:9,last:12},
 {name:'LEAD',first:13,last:16},
 {name:'LEGACY',first:17,last:20},
] as const;
export function plannedS2BadgeCriteria(kind:S2BadgeGuideKind,index:number,en:boolean):string {
 if(!Number.isInteger(index)||index<0)throw Error('Invalid badge index');
 let fil:string,english:string;
 if(kind==='stage'){
  if(index>=20)throw Error('Invalid stage');
  fil=`Level ${index+1}: dapat certified ang 5 magkakaibang item I1-I5 sa parehong Character/level at server. Hindi sapat ang image.`;
  english=`Level ${index+1}: all five I1-I5 items must be certified for the same Character/level by the server, not only shown as art.`;
 }else if(kind==='era'){
  const era=eras[index];if(!era)throw Error('Invalid era');
  fil=`Kailangan ang 4 verified Stage Mastery badges ng ${era.name} (levels ${era.first}-${era.last}) ng iisang Character.`;
  english=`Requires all four certified ${era.name} Stage Mastery badges (levels ${era.first}-${era.last}) for the same Character.`;
 }else if(kind==='journey'){
  const filList=[
   'Journey Unlocked: tunay na server-unlocked at napiling Character; hindi awtomatiko sa preview.',
   'Collection Half-Way: 50 sa 100 magkakaibang certified items ng Character; walang duplicate source.',
   'Collection Complete: 100 sa 100 magkakaibang certified items sa 20 levels ng Character.',
   'Legacy Path Cleared: Character Mastery at verified final Legacy mission o patas na solo alternative, isang beses.',
  ];
  const enList=[
   'Journey Unlocked: canonical server-unlocked and selected Character; preview selection does not count.',
   'Collection Half-Way: 50 of 100 distinct server-certified items for this Character.',
   'Collection Complete: 100 of 100 distinct certified items across 20 Character levels.',
   'Legacy Path Cleared: Character Mastery and verified final Legacy mission or fair solo alternative, once.',
  ];
  if(index>=filList.length)throw Error('Invalid journey badge');
  fil=filList[index];english=enList[index];
 }else if(kind==='starter'){
  if(index===0){fil='Signature: canonical unlocked at napiling Character; special Character rank gate ay dapat naipasa.';english='Signature: canonical unlocked and selected Character; verify special rank gate when required.';}
  else if(index===1){fil='Character Mastery: 20 certified Stage Mastery badges at lahat ng 5 Era Mastery badges para sa parehong Character.';english='Character Mastery: all 20 certified Stage Mastery and all five Era Mastery badges for the same Character.';}
  else {fil='Starter pack asset: kailangan ng tunay at one-time server-owned starter entitlement para sa napiling Character, matapos ang legal unlock/rank gate.';english='Starter pack asset: requires a real one-time server-owned starter entitlement after canonical Character unlock and applicable rank gate.';}
 }else if(kind==='series'){
  const filList=[
   'Five Core Path Series: 5/5 Core Character Mastery badges.',
   'Eight Special Path Series: 8/8 Special Character Mastery badges at bawat special rank gate.',
   'Thirteen Character World Complete: 13/13 Character Mastery badges.',
   ...eras.map(e=>`${e.name} Era Circle: 13/13 Character Era Mastery certificates para sa ${e.name} levels ${e.first}-${e.last}.`),
  ];
  const enList=[
   'Five Core Path Series: all five Core Character Mastery badges.',
   'Eight Special Path Series: all eight Special Character Mastery badges and each special rank gate.',
   'Thirteen Character World Complete: all 13 Character Mastery badges.',
   ...eras.map(e=>`${e.name} Era Circle: all 13 Character Era Mastery certificates for ${e.name} levels ${e.first}-${e.last}.`),
  ];
  if(index>=filList.length)throw Error('Invalid series badge');
  fil=filList[index];english=enList[index];
 }else throw Error('Unknown badge category');
 return (en?english:fil)+(en?' · PROPOSED, NOT LIVE':' · PANUKALA, HINDI PA LIVE');
}
