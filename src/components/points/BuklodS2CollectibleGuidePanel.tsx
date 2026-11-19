/**
 * Season 2 collectible instruction panel.
 * This UI is READ-ONLY until a real isolated S2 backend certifies evidence.
 * Never mutate / display owned state based on local tasks, level or artwork.
 */
import React,{useMemo,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {useBuklodI18n} from '@/providers/BuklodI18nProvider';
import {
  BUKLOD_CHARACTER_WORLD_IDS,
  BUKLOD_CHARACTER_DISPLAY_NAME,
  type BuklodCharacterWorldId,
} from '@/lib/buklodCharacterWorldCatalog';
import {
  getS2CollectibleGuide,
  presentationS2MasteryStatus,
  type S2MasterySnapshot,
} from '@/lib/season2/buklodSeason2CollectibleGuideR1';

type Props={
  characterId?:BuklodCharacterWorldId;
  level?:number;
  itemIndex?:number;
  accountId?:string|null;
  serverSnapshot?:S2MasterySnapshot|null;
};
const C={background:'#162033',surface:'#101827',border:'#405066',gold:'#E8C56B',white:'#F8F3E5',secondary:'#C0CBDB',muted:'#93A5B8'};
export default function BuklodS2CollectibleGuidePanel({
  characterId,level,itemIndex,accountId,serverSnapshot=null,
}:Props) {
  const {locale}=useBuklodI18n();
  const isEnglish=locale==='en';
  const [draftCharacter,setDraftCharacter]=useState<BuklodCharacterWorldId>('phan');
  const [draftLevel,setDraftLevel]=useState(1);
  const [draftSlot,setDraftSlot]=useState(1);
  const fixed=Boolean(characterId);
  const chosen=characterId??draftCharacter;
  const stage=level??draftLevel;
  const slot=itemIndex??draftSlot;
  const guide=useMemo(()=>getS2CollectibleGuide(chosen,stage,slot),[chosen,stage,slot]);
  const progress=presentationS2MasteryStatus(guide,accountId,serverSnapshot);
  const translated=(x:{fil:string;en:string})=>isEnglish?x.en:x.fil;
  return <View style={s.panel}>
    <Text style={s.eyebrow}>{isEnglish?'SEASON 2 · ITEM GUIDE':'SEASON 2 · GABAY SA ITEMS'}</Text>
    <Text style={s.heading}>{guide.itemName}</Text>
    <Text style={s.meta}>{guide.characterName} · Level {guide.level} · {guide.era} · {guide.itemIndex}/5</Text>
    {!fixed?<View style={s.browser}>
      <Text style={s.smallTitle}>{isEnglish?'CHOOSE CHARACTER':'PUMILI NG CHARACTER'}</Text>
      <View style={s.chips}>{BUKLOD_CHARACTER_WORLD_IDS.map(id=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:id===chosen}} onPress={()=>setDraftCharacter(id)} style={[s.chip,id===chosen&&s.chipOn]}><Text style={[s.chipText,id===chosen&&s.chipTextOn]}>{BUKLOD_CHARACTER_DISPLAY_NAME[id]}</Text></Pressable>)}</View>
      <Text style={s.smallTitle}>{isEnglish?'STAGE':'LEVEL'}</Text>
      <View style={s.chips}>{Array.from({length:20},(_,i)=>i+1).map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={'Level '+n} accessibilityState={{selected:n===stage}} onPress={()=>setDraftLevel(n)} style={[s.levelChip,n===stage&&s.chipOn]}><Text style={[s.chipText,n===stage&&s.chipTextOn]}>{n}</Text></Pressable>)}</View>
      <Text style={s.smallTitle}>{isEnglish?'ITEM':'ITEM'}</Text>
      <View style={s.chips}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={'Item '+n} accessibilityState={{selected:n===slot}} onPress={()=>setDraftSlot(n)} style={[s.levelChip,n===slot&&s.chipOn]}><Text style={[s.chipText,n===slot&&s.chipTextOn]}>{n}</Text></Pressable>)}</View>
    </View>:null}
    <View style={s.tag}><Text style={s.tagText}>{progress.status==='PREVIEW_ONLY'?(isEnglish?'PREVIEW · SERVER CLAIMS DISABLED':'PREVIEW · HINDI PA ACTIVE ANG CLAIM'):progress.status.replaceAll('_',' ')}</Text></View>
    <Text style={s.section}>{isEnglish?'Why earn this?':'Bakit ito mahalaga?'}</Text>
    <Text style={s.body}>{translated(guide.purpose)}</Text>
    <Text style={s.section}>{isEnglish?'What will it do?':'Ano ang pakinabang?'}</Text>
    <Text style={s.body}>{translated(guide.benefit)}</Text>
    <Text style={s.section}>{isEnglish?'How to qualify':'Mga requirement at prerequisite'}</Text>
    {guide.steps.map((step,i)=>{
      const complete=progress.completedSteps.includes(step.key);
      return <View key={step.key} style={s.step}>
        <Text style={s.stepNum}>{complete?'✓':String(i+1)}</Text>
        <View style={s.stepBody}>
          <Text style={s.stepTitle}>{translated(step)}</Text>
          <Text style={s.stepSub}>{isEnglish?'Server verification required':'Dapat kumpirmado ng server'} · {complete?'Verified':progress.status==='PREVIEW_ONLY'?'Preview':'Pending'}</Text>
        </View>
      </View>;
    })}
    <Text style={s.important}>{isEnglish
      ?'Existing owned Character items remain owned. These are additional optional Season 2 mastery conditions, not retroactive locks. No tokens can purchase earned collectibles; BP, QMP, cash and Circle Rank are unaffected.'
      :'Nananatiling sa iyo ang dating owned Character items. Dagdag na opsyonal na Season 2 mastery ito, hindi pagbawi ng naunang rewards. Hindi nabibili ng tokens ang earned collectibles; walang pagbabago sa BP, QMP, cash at Circle Rank.'}</Text>
    <Text style={s.note}>{isEnglish
      ?'To start later: use this character, finish the exact qualified activities, await server verification, then claim when the official Season 2 backend is enabled. Preview does not grant anything.'
      :'Kapag opisyal nang active: gamitin ang character, tapusin ang mga kwalipikadong gawain, hintayin ang server verification, at i-claim kapag pinayagan na. Walang grants ang preview.'}</Text>
  </View>;
}
const s=StyleSheet.create({
  panel:{marginHorizontal:14,marginVertical:10,padding:13,borderWidth:1,borderColor:C.border,borderRadius:16,backgroundColor:C.background,gap:5},
  eyebrow:{fontSize:11,fontWeight:'900',color:C.gold,letterSpacing:.5},
  heading:{fontSize:15,fontWeight:'900',color:C.white},
  meta:{fontSize:11,color:C.secondary,lineHeight:16},
  browser:{gap:7,marginVertical:8},
  smallTitle:{color:C.gold,fontWeight:'800',fontSize:11,marginTop:5},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{borderRadius:9,borderWidth:1,borderColor:C.border,paddingHorizontal:9,paddingVertical:7,backgroundColor:C.surface},
  chipOn:{borderColor:C.gold,backgroundColor:'#3B301B'},
  chipText:{color:C.secondary,fontSize:10,fontWeight:'700'},
  chipTextOn:{color:C.white},
  levelChip:{minWidth:38,paddingVertical:8,alignItems:'center',borderRadius:9,borderWidth:1,borderColor:C.border,backgroundColor:C.surface},
  tag:{alignSelf:'flex-start',paddingHorizontal:8,paddingVertical:5,marginVertical:7,borderColor:C.gold,borderWidth:1,borderRadius:8},
  tagText:{color:C.gold,fontSize:10,fontWeight:'900'},
  section:{color:C.white,fontWeight:'900',fontSize:12,marginTop:8},
  body:{color:C.secondary,fontSize:12,lineHeight:18},
  step:{flexDirection:'row',gap:9,marginTop:9},
  stepNum:{width:23,height:23,textAlign:'center',textAlignVertical:'center',overflow:'hidden',borderRadius:12,borderWidth:1,borderColor:C.gold,color:C.gold,fontSize:11,fontWeight:'900'},
  stepBody:{flex:1},
  stepTitle:{color:C.white,fontSize:11,lineHeight:16},
  stepSub:{color:C.muted,fontSize:10,marginTop:3},
  important:{color:C.gold,fontSize:11,lineHeight:17,marginTop:13},
  note:{color:C.muted,fontSize:10,lineHeight:15,marginTop:6},
});
