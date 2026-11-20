/**
 * Exhaustive read-only reference for 1,300 named Character collectible items,
 * 469 catalog badges and 40 server-authoritative Circle Rank visual classes.
 * Dynamically enumerates canonical Character names and sources; no handmade list,
 * no re-claims, no network, no grant, no false "Owned" or unlock status.
 */
import React,{useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {useBuklodI18n} from '@/providers/BuklodI18nProvider';
import {plannedS2BadgeCriteria} from '@/lib/season2/buklodSeason2BadgeEligibilityR1';
import {
  BUKLOD_CHARACTER_WORLD_IDS,BUKLOD_CHARACTER_WORLD_SPECIAL_IDS,
  BUKLOD_CHARACTER_DISPLAY_NAME,BUKLOD_CHARACTER_STAGES,
  BUKLOD_SPECIAL_REQUIRED_CIRCLE_RANK,BUKLOD_CHARACTER_BADGES,
  BUKLOD_SERIES_BADGES,BUKLOD_COLLECTIBLE_SLOT_LABELS,
  BUKLOD_CHARACTER_WORLD_STATS,
  type BuklodCharacterWorldId,
} from '@/lib/buklodCharacterWorldCatalog';
import {getS2CollectibleGuide} from '@/lib/season2/buklodSeason2CollectibleGuideR1';
import {BUKLOD_CIRCLE_RANK_FAMILIES,BUKLOD_CIRCLE_RANK_LEVELS} from '@/lib/buklodCircleRankArt';
import {S2_KINGDOM_SHARD_REFERENCE,S2_KINGDOM_SHARD_EARNING_SOURCES} from '@/lib/season2/buklodS2KingdomShardGuideSnapshotR1';

type Tab='items'|'badges'|'ranks'|'kingdom';
type BadgeCategory='stage'|'era'|'journey'|'starter'|'series';
const C={ink:'#183D2E',green:'#176B44',muted:'#587566',line:'#D4E7D9',pale:'#F0F9F3',gold:'#8C631D'};
const guideTotal=BUKLOD_CHARACTER_WORLD_STATS.badgesTotal; // 469 catalog names, NOT owned badges
const rankTotal=BUKLOD_CIRCLE_RANK_FAMILIES.length*BUKLOD_CIRCLE_RANK_LEVELS.length;
const selectedItemTotal=BUKLOD_CHARACTER_WORLD_IDS.length*20*5;
const CATEGORIES:{id:BadgeCategory;name:string}[]=[
 {id:'stage',name:'20 Stage Mastery'},{id:'era',name:'5 Era Mastery'},
 {id:'journey',name:'4 Journey'},{id:'starter',name:'Starter Pack'},{id:'series',name:'Series / World'},
];

function Choice({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityState={{selected}}
   onPress={onPress} style={[s.choice,selected&&s.chosen]}>
  <Text style={[s.choiceText,selected&&s.chosenText]}>{label}</Text>
 </Pressable>;
}
function Line({title,detail,side}:{title:string;detail?:string;side?:string}){
 return <View style={s.entry}><View style={{flex:1,minWidth:0}}>
   <Text style={s.entryTitle}>{title}</Text>
   {detail?<Text style={s.entryDetail}>{detail}</Text>:null}
  </View>{side?<Text style={s.side}>{side}</Text>:null}</View>;
}
export default function BuklodS2AllItemsBadgesGuide(){
 const {locale}=useBuklodI18n(),en=locale==='en';
 const t=(fil:string,eng:string)=>en?eng:fil;
 const [tab,setTab]=useState<Tab>('items');
 const [charId,setCharId]=useState<BuklodCharacterWorldId>('phan');
 const [level,setLevel]=useState(1);
 const [badgeKind,setBadgeKind]=useState<BadgeCategory>('stage');
 const [rankFamily,setRankFamily]=useState(0);
 const badges=BUKLOD_CHARACTER_BADGES[charId];
 const itemGuides=useMemo(()=>
  Array.from({length:5},(_,i)=>getS2CollectibleGuide(charId,level,i+1)),
  [charId,level]);
 const namesByBadgeCategory=useMemo(()=>{
  if(badgeKind==='series')return [...BUKLOD_SERIES_BADGES];
  if(badgeKind==='stage')return [...badges.stageMastery];
  if(badgeKind==='era')return [...badges.eraMastery];
  if(badgeKind==='journey')return [...badges.journey];
  return [badges.signature,badges.characterMastery,...badges.starterPack];
 },[charId,badgeKind,badges]);
 const isSpecial=(BUKLOD_CHARACTER_WORLD_SPECIAL_IDS as readonly string[]).includes(charId);
 const requiredRank=isSpecial?BUKLOD_SPECIAL_REQUIRED_CIRCLE_RANK[
  charId as keyof typeof BUKLOD_SPECIAL_REQUIRED_CIRCLE_RANK]:null;
 return <View style={s.shell}>
  <Text style={s.kicker}>{t('LAHAT NG ITEM, BADGE, RANK AT KINGDOM','ALL ITEMS, BADGES, RANKS & KINGDOM')}</Text>
  <Text style={s.title}>{selectedItemTotal.toLocaleString()} items • {guideTotal} badges • {rankTotal} ranks</Text>
  <Text style={s.warning}>{t(
   'CATALOG / PREVIEW LANG: Walang item, badge o rank na automatikong makukuha sa pagtingin. Ang tunay na ownership ay nasa canonical server. Naka-disable pa ang Season 2 mastery grants.',
   'CATALOG / PREVIEW ONLY: Viewing does not grant an item, badge or rank. Actual ownership belongs to the canonical server. Season 2 mastery grants remain disabled.')}</Text>
  <View style={s.wrap}>
   {([['items','1,300 ITEMS'],['badges','469 BADGES'],['ranks','40 RANKS'],['kingdom','KINGDOM']] as const).map(([value,label])=>
    <Choice key={value} label={label} selected={tab===value} onPress={()=>setTab(value)}/>)}
  </View>
  {tab==='items'||tab==='badges'?<>
   <Text style={s.heading}>{t('Pumili ng Character (13)','Select Character (13)')}</Text>
   <View style={s.wrap}>{BUKLOD_CHARACTER_WORLD_IDS.map(id=>
    <Choice key={id} label={BUKLOD_CHARACTER_DISPLAY_NAME[id]} selected={charId===id}
      onPress={()=>{setCharId(id);setLevel(1)}}/>)}</View>
   {isSpecial?<Text style={s.note}>{t(
    'Special Character: kailangan munang pumasa sa aktuwal na Circle Rank gate (order '+requiredRank+') sa server. Hindi sapat ang larawan.',
    'Special Character: must meet the actual server Circle Rank gate (order '+requiredRank+'). Art does not unlock it.')}</Text>:null}
  </>:null}
  {tab==='items'?<>
   <View style={s.levelPicker}>
    <Choice label="−" selected={false} onPress={()=>setLevel(n=>Math.max(1,n-1))}/>
    <View style={{flex:1,minWidth:0}}>
     <Text style={s.heading}>{t('Level','Level')} {level}/20 — {BUKLOD_CHARACTER_STAGES[charId][level-1]}</Text>
     <Text style={s.note}>5 {t('named collectible items; lahat may sariling prerequisite','named items; each has its own prerequisite')}</Text>
    </View>
    <Choice label="+" selected={false} onPress={()=>setLevel(n=>Math.min(20,n+1))}/>
   </View>
   <View style={s.wrap}>{[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n=>
    <Choice key={n} label={String(n)} selected={level===n} onPress={()=>setLevel(n)}/>)}</View>
   {itemGuides.map((item,index)=><View style={s.itemBox} key={item.id}>
     <View style={s.between}><Text style={s.entryTitle}>{'I'+item.itemIndex+' · '+item.itemName}</Text>
      <Text style={s.preview}>{t('HINDI PA LIVE','NOT LIVE')}</Text></View>
     <Text style={s.note}>{BUKLOD_COLLECTIBLE_SLOT_LABELS[index]} · {item.rewardKind.replaceAll('_',' ')}</Text>
     <Text style={s.entryDetail}>{en?item.purpose.en:item.purpose.fil}</Text>
     <Text style={s.entryDetail}>{t('Benepisyo: ','Benefit: ')}{en?item.benefit.en:item.benefit.fil}</Text>
     <Text style={s.ruleLabel}>{t('Paano makuha','How to earn')}</Text>
     {item.steps.map(step=><Text key={step.key} style={s.step}>• {en?step.en:step.fil}</Text>)}
     <Text style={s.preview}>{t('SERVER-VERIFIED CLAIM PA LAMANG KAPAG ACTIVE','SERVER-VERIFIED CLAIM ONLY AFTER ACTIVATION')}</Text>
   </View>)}
   <Text style={s.note}>{t(
    'Kada Character ay may 20 levels × 5 exact item names. Nasa selector sa itaas ang lahat ng 1,300 item entries. Hindi nabibili gamit ang Journey Tokens ang mga earned level-gated items. Nananatili ang mga dati nang owned items.',
    'Each Character has 20 levels × 5 exact named items. All 1,300 entries are available through the selector above. Earned level-gated items cannot be bought with Journey Tokens. Legacy ownership is preserved.')}</Text>
  </>:null}
  {tab==='badges'?<>
   <Text style={s.note}>{t(
    'Ang 469 badges ay 165 core-Character badge names + 296 special-Character badge names + 8 shared series badges. Catalog titles pa lamang ito: ang claims ay kailangang may tunay na milestones at server certification.',
    'The 469 badges comprise 165 core-character titles + 296 special-character titles + 8 shared series badges. Catalog names are not proof of earned ownership; real milestones and server certification are required.')}</Text>
   <View style={s.wrap}>{CATEGORIES.map(x=><Choice key={x.id} label={x.name}
    selected={badgeKind===x.id} onPress={()=>setBadgeKind(x.id)}/>)}</View>
   <Text style={s.heading}>{badgeKind==='series'?'Across all Characters':BUKLOD_CHARACTER_DISPLAY_NAME[charId]} · {namesByBadgeCategory.length} {t('pangalan','names')}</Text>
   {namesByBadgeCategory.map((name,i)=>{
    const desc=plannedS2BadgeCriteria(badgeKind,i,en);
    return <Line key={name} title={name} detail={desc} side={t('CATALOG','CATALOG')}/>;
   })}
   <Text style={s.note}>{t(
    'Hindi kasama sa 469 ang 40 Circle Rank visual classes o 4 proposed Season 2 seasonal awards. Hiwalay silang award categories. Ang existing verified badges ay hindi mare-reset.',
    'The 40 Circle Rank classes and 4 proposed seasonal awards are separate from the 469 Character badge names. Existing legitimate badges are not reset.')}</Text>
  </>:null}
  {tab==='ranks'?<>
   <Text style={s.note}>{t(
    '8 rank families × 5 subdivisions (V, IV, III, II, I). Lifetime BP/rank authority ay nasa server; ang border artwork, 10-o’clock badge at weekly 2-o’clock class ay display lamang.',
    '8 rank families × 5 subdivisions (V, IV, III, II, I). Server authority determines lifetime BP/rank. Avatar art and weekly class are display-only.')}</Text>
   <View style={s.wrap}>{BUKLOD_CIRCLE_RANK_FAMILIES.map((name,index)=>
    <Choice key={name} label={name} selected={rankFamily===index} onPress={()=>setRankFamily(index)}/>)}</View>
   {BUKLOD_CIRCLE_RANK_LEVELS.map((subdivision,index)=>
    <Line key={subdivision} title={BUKLOD_CIRCLE_RANK_FAMILIES[rankFamily]+' '+subdivision}
      side={'#'+(rankFamily*5+index+1)} detail={t(
       'Kailangan ng canonical server-authoritative Circle Rank classification. Walang invented BP threshold mula sa artwork.',
       'Requires server-authoritative Circle Rank; do not infer BP thresholds from artwork.')}/>)}
  </>:null}
  {tab==='kingdom'?<>
   <Text style={s.heading}>{t('Kingdom Shards — hiwalay na game currency','Kingdom Shards — separate game currency')}</Text>
   <Text style={s.note}>{t(
    'Hindi BP, QMP, cash o Season 2 Journey Tokens ang Kingdom Shards. Ang balances at purchase ownership ay dapat sa verified Kingdom server, hindi sa offline cached estimate.',
    'Kingdom Shards are not BP, QMP, cash or S2 Journey Tokens. Balances and ownership require verified Kingdom server records, not a local cache estimate.')}</Text>
   <Text style={s.ruleLabel}>{t('Paano kumita ng Kingdom Shards — verified backend','How to earn Kingdom Shards — verified backend')}</Text>
   {S2_KINGDOM_SHARD_EARNING_SOURCES.map(rule=><Line key={rule.id}
    title={rule.id.replaceAll('_',' ')} side={`+${rule.shards} Shards`}
    detail={`${rule.criteria} · ${rule.limit}`}/>)}
   <Text style={s.ruleLabel}>{t('Pambiling Shards sa permanent Kingdom powers','Shard costs for permanent Kingdom practice powers')}</Text>
   {S2_KINGDOM_SHARD_REFERENCE.map(item=><Line key={item.key} title={item.name}
    side={item.price+' Shards'} detail={item.description}/>)}
   <Text style={s.ruleLabel}>{t('Iba pang Kingdom at game rewards','Other Kingdom and game rewards')}</Text>
   <Text style={s.note}>{t(
    'First verified qualifying gameplay event: configured +2 BP. Verified tournament championship: +100 BP. Ang score/stars sa iba’t ibang laro ay hindi convertible sa cash o BP nang walang server-approved milestone. Team quest at solo alternative ay Season 2 plan lamang.',
    'First verified qualifying gameplay event: configured +2 BP. Verified tournament champion: +100 BP. Individual game scores/stars never convert to cash or BP without a server-approved milestone. Team quests and solo alternatives remain Season 2 plans.')}</Text>
  </>:null}
  <Text style={s.footer}>{t(
   'Mahalaga: catalog names at illustration ay hindi entitlement. Ang active Season 1 items ay protektado. Hindi pa naka-on ang Season 2 grants.',
   'Important: catalog names and artwork are not entitlements. Season 1 items remain protected. Season 2 grants are OFF.')}</Text>
 </View>;
}
const s=StyleSheet.create({
 shell:{padding:9,gap:8,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.line,borderRadius:10},
 kicker:{fontSize:9,color:C.green,letterSpacing:.3,fontWeight:'900'},
 title:{fontSize:15,color:C.ink,fontWeight:'900'},
 warning:{fontSize:10,lineHeight:16,color:'#825A1B',backgroundColor:'#FFF5DB',padding:8,borderRadius:7},
 wrap:{flexDirection:'row',flexWrap:'wrap',gap:5},
 choice:{borderWidth:1,borderColor:C.line,borderRadius:7,paddingVertical:6,paddingHorizontal:9,backgroundColor:C.pale},
 chosen:{borderColor:C.green,backgroundColor:C.green},
 choiceText:{fontSize:10,color:C.ink,fontWeight:'700'},chosenText:{color:'#FFFFFF'},
 heading:{fontSize:11,fontWeight:'900',color:C.ink},
 note:{fontSize:10,lineHeight:16,color:C.muted},
 entry:{flexDirection:'row',gap:8,paddingVertical:8,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.line},
 entryTitle:{fontSize:11,fontWeight:'800',color:C.ink,lineHeight:16},
 entryDetail:{fontSize:10,lineHeight:15,color:C.muted,marginTop:2},
 side:{fontSize:10,fontWeight:'900',color:C.green,alignSelf:'center'},
 levelPicker:{flexDirection:'row',gap:8,alignItems:'center'},
 itemBox:{borderWidth:1,borderColor:C.line,padding:8,borderRadius:8,gap:5},
 between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:7},
 preview:{fontSize:9,color:C.gold,fontWeight:'900'},
 ruleLabel:{fontSize:10,color:C.green,fontWeight:'900'},
 step:{fontSize:10,color:C.ink,lineHeight:16},
 footer:{fontSize:9,lineHeight:14,color:C.muted,marginTop:2},
});
