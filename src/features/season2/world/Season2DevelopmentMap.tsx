/**
 * Season 2 development worlds: one-tap visual doors, non-authoritative design
 * previews. This UI NEVER mints BP, unlocks land, or modifies a shared scope.
 * Actual development must come from separately verified server records/RPCs.
 */
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '@/providers/AuthProvider';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import WorldConstructionDiorama from './WorldConstructionDiorama';
import Season2CommunityFacilities from './Season2CommunityFacilities';
import {newWorkshop, restoreWorkshop, buildRequirements, buildWorkshopStage, startWorkshopGather, gatherTarget, chooseWorkshopGather, customizeWorkshop, type WorkshopTrack, type WorkshopMaterial, type WorkshopStyle, type WorkshopSky, type WorkshopDecor} from './worldWorkshopEngine';
import BuklodGameBackdrop from '@/features/games/runtime/BuklodGameBackdrop';
import {getDevelopmentAsset} from './developmentAssetManifest';
const VILLAGE_ART = require('../../../../assets/season2/genesis/world/buklod-community-village-stage1.webp');
const HOME_ART = require('../../../../assets/season2/genesis/world/buklod-my-home-stage1.webp');

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type World = 'home' | 'village';
type Door = Readonly<{
  id: string; label: string; sub: string; icon: IconName; route: string;
  left: number; top: number;
}>;
const HOME_DOORS: readonly Door[] = [
  {id:'lot',label:'My Lot',sub:'Lot and land development',icon:'terrain',route:'/points/progression',left:8,top:25},
  {id:'house',label:'My House',sub:'Rooms and family home',icon:'home-variant',route:'/personal-home',left:37,top:20},
  {id:'garden',label:'Garden',sub:'Plants and household care',icon:'sprout',route:'/profile/buklod-family',left:70,top:58},
  {id:'family',label:'Family',sub:'Kasambahay and spaces',icon:'account-group',route:'/profile/buklod-family',left:70,top:15},
  {id:'profile',label:'My Identity',sub:'Profile and Circle Rank',icon:'account-circle-outline',route:'/me',left:12,top:65},
  {id:'tools',label:'Life Tools',sub:'Reminders and budget',icon:'tools',route:'/personal-home/reminders',left:40,top:68},
];
const VILLAGE_DOORS: readonly Door[] = [
  {id:'cluster',label:'My Cluster',sub:'Scope and members',icon:'home-group',route:'/clusters',left:9,top:23},
  {id:'org',label:'Organizations',sub:'Org and sub-org',icon:'office-building-outline',route:'/organizations',left:66,top:21},
  {id:'compound',label:'Compounds',sub:'Homes and shared spaces',icon:'home-city-outline',route:'/profile/buklod-family',left:40,top:17},
  {id:'growth',label:'Development',sub:'Verified growth requirements',icon:'hammer-wrench',route:'/points/progression',left:36,top:63},
  {id:'market',label:'Livelihood',sub:'Business and trading',icon:'storefront-outline',route:'/profile/buklod-market',left:68,top:65},
  {id:'bayanihan',label:'Bayanihan',sub:'Community projects',icon:'handshake-outline',route:'/bayanihan',left:9,top:65},
];
const STAGES = [
  {name:'Materials',icon:'package-variant-closed',detail:'Gather approved resources before construction'},
  {name:'Posts / Foundation',icon:'fence',detail:'Posts and foundations appear before walls'},
  {name:'Framework',icon:'hammer',detail:'A visible frame rises from the plot'},
  {name:'Structure',icon:'home-outline',detail:'Walls, roofing and basic utilities take shape'},
  {name:'Finishing',icon:'home-variant',detail:'Exterior, pathways and facilities become complete'},
] as const;
const LOOKS = [
  {id:'classic',name:'Classic stone',tint:'#D1B991',shade:'#384D50'},
  {id:'tropical',name:'Tropical timber',tint:'#D7A978',shade:'#355C42'},
  {id:'nature',name:'Nature estate',tint:'#ADD8A0',shade:'#2C6650'},
] as const;
type Look = typeof LOOKS[number]['id'];
export function clampDevelopmentLevel(value:number) {
  return Math.min(10,Math.max(1,Math.floor(Number.isFinite(value)?value:1)));
}
export function constructionStageLabel(index:number) {
  return STAGES[Math.max(0,Math.min(4,Math.floor(index)))]?.name ?? STAGES[0].name;
}

export default function Season2DevelopmentMap({world}:{world:World}) {
 const {width}=useWindowDimensions();
 const insets=useSafeAreaInsets();
 const {profile}=useAuth();
 const ownerId=String(profile?.id??'guest');
 const storageKey='buklod.s2.workshop.v1.'+ownerId+'.'+world;
 const [workshop,setWorkshop]=useState(newWorkshop);
 const [readyFor,setReadyFor]=useState('');
 const [track,setTrack]=useState<WorkshopTrack>(world==='home'?'lot':'cluster');
 const [mode,setMode]=useState<'build'|'gather'|'style'>('build');
 const [showRequirements,setShowRequirements]=useState(false);
 const [notice,setNotice]=useState('');
 const writes=useRef<Promise<unknown>>(Promise.resolve());
 const compact=width<600;
 const doors=world==='home'?HOME_DOORS:VILLAGE_DOORS;
 const progress=workshop.tracks[track];
 const quote=buildRequirements(workshop,track);
 const assetMeta=getDevelopmentAsset(track,Math.min(10,progress.level+1));
 const appearance=workshop.cosmetics[world];
 const choice=LOOKS.find(v=>v.id===appearance.style)??LOOKS[0];
 const gather=workshop.gathering;
 const nextTarget=gather?gatherTarget(gather):null;
 const sceneHeight=Math.min(445,Math.max(255,width*(compact?.77:.49)));
 const skyGradient=appearance.sky==='twilight'
  ?['rgba(10,24,52,.55)','rgba(32,46,64,.12)','rgba(8,18,30,.68)'] as const
  :appearance.sky==='dawn'
  ?['rgba(230,176,112,.22)','rgba(255,212,143,.02)','rgba(16,47,41,.47)'] as const
  :['rgba(5,30,28,.05)','rgba(10,25,25,.06)','rgba(9,25,32,.54)'] as const;

 useEffect(()=>{
  let current=true;
  setReadyFor('');
  setWorkshop(newWorkshop());
  if(ownerId==='guest')return()=>{current=false;};
  void AsyncStorage.getItem(storageKey).then(raw=>{
   if(!current)return;
   let parsed:unknown=null;
   try{parsed=raw?JSON.parse(raw):null;}catch{parsed=null;}
   setWorkshop(restoreWorkshop(parsed));
   setReadyFor(ownerId);
  }).catch(()=>{if(current){setWorkshop(newWorkshop());setReadyFor(ownerId);}});
  return()=>{current=false;};
 },[ownerId,storageKey]);
 useEffect(()=>{
  if(readyFor!==ownerId||ownerId==='guest')return;
  const serialized=JSON.stringify(workshop);
  // Serial writes prevent an older completion overtaking the latest state.
  writes.current=writes.current.catch(()=>undefined).then(()=>
   AsyncStorage.setItem(storageKey,serialized)).catch(()=>undefined);
 },[workshop,readyFor,ownerId,storageKey]);
 const chooseTrack=(next:WorkshopTrack)=>{setTrack(next);setMode('build');setNotice('');};
 const selectDoor=(id:string,route:string)=>{
  if(id==='lot')return chooseTrack('lot');
  if(id==='house')return chooseTrack('house');
  if(id==='growth')return chooseTrack('cluster');
  router.push(route as any);
 };
 const applyBuild=()=>{
  const result=buildWorkshopStage(workshop,track);
  if(!result.ok){setMode('gather');setNotice(result.reason);return;}
  setWorkshop(s=>buildWorkshopStage(s,track).state);
  setNotice('Construction stage completed in your offline workshop.');
 };
 const startGather=(material:WorkshopMaterial)=>{
  setWorkshop(s=>startWorkshopGather(s,material));
  setNotice('Hanapin ang tamang symbol nang tatlong sunod-sunod.');
 };
 const chooseTile=(n:number)=>{
  const result=chooseWorkshopGather(workshop,n);
  setWorkshop(s=>chooseWorkshopGather(s,n).state);
  setNotice(result.completed?'Resource hunt complete · local materials added.':
   result.correct?'Tama! Next marker.':'Mali ang marker — simula ulit ang combo.');
 };
 const updateLook=(edit:{style?:WorkshopStyle;sky?:WorkshopSky;decor?:WorkshopDecor})=>{
  setWorkshop(s=>customizeWorkshop(s,world,edit));
  setNotice('Appearance saved locally. Official Genesis theme stays unchanged.');
 };
 if(ownerId==='guest'||readyFor!==ownerId){
  return <View style={styles.loading}><ActivityIndicator color="#F7D89E"/><Text style={styles.muted}>Loading personal design studio…</Text></View>;
 }
 return <View style={styles.root}>
  <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
   contentContainerStyle={[styles.content,{paddingTop:Math.max(insets.top,22)+9,paddingBottom:Math.max(insets.bottom,18)+20}]}>
   <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Genesis World Map"
     onPress={()=>router.replace('/buklod-map' as any)} style={styles.return}>
     <MaterialCommunityIcons name="arrow-left" size={23} color="#FFEAC3"/>
    </Pressable>
    <View style={{flex:1,minWidth:0}}>
     <Text style={styles.kicker}>BUKLOD · GENESIS / DESIGN STUDIO</Text>
     <Text style={styles.title}>{world==='home'?'My Home · Personal World':'Community Village'}</Text>
     <Text style={styles.subtitle}>{world==='home'?
      'Buo ang iyong sariling lote at bahay. Family at daily tools ay one tap sa mapa.':
      'Planuhin ang komunidad at mga gusali. Totoong Cluster permissions ay hiwalay.'}</Text>
    </View>
   </View>
   <View style={[styles.scene,{height:sceneHeight,borderColor:choice.tint}]}>
    <BuklodGameBackdrop thumbnail gameId={world==='home'?'phan-enterprise-builder':'elesur-village-builder'} opacity={0.72}/>
    <Image source={world==='home'?HOME_ART:VILLAGE_ART} contentFit="cover"
     style={StyleSheet.absoluteFill} transition={160}
     accessibilityLabel={world==='home'?'Genesis Personal Estate artwork':'Genesis Community Village artwork'}/>
    <LinearGradient colors={skyGradient} style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none" style={styles.sceneBanner}>
     <MaterialCommunityIcons name="shield-home-outline" size={16} color="#F4DBA7"/>
     <Text style={styles.sceneBannerText}>LOCAL WORKSHOP · NOT OWNED LAND</Text>
    </View>
    <WorldConstructionDiorama track={track} progress={progress} styleId={appearance.style}/>
    <View pointerEvents="none" style={styles.plotInfo}>
     <Text style={styles.plotTitle}>{track==='cluster'?'COMMUNITY':track==='lot'?'MY LOT':'MY HOUSE'}</Text>
     <Text style={styles.plotSub}>L{progress.level} / 10 {progress.level===10?'· Mastery '+progress.mastery:'· Build '+(progress.stage+1)+'/5'}</Text>
    </View>
    {appearance.decor==='lanterns'?
      <View pointerEvents="none" style={styles.decorLeft}><MaterialCommunityIcons name="lightbulb-on" size={28} color="#FFE3A5"/></View>:
     appearance.decor==='pond'?
      <View pointerEvents="none" style={styles.decorLeft}><MaterialCommunityIcons name="waves" size={32} color="#9DDADB"/></View>:
      <View pointerEvents="none" style={styles.decorLeft}><MaterialCommunityIcons name="sprout" size={30} color="#BBF2B1"/></View>}
    {doors.map(door=><Pressable key={door.id} accessibilityRole="button"
     accessibilityLabel={(door.id==='lot'||door.id==='house'||door.id==='growth'?'Inspect ':'Open ')+door.label}
     onPress={()=>selectDoor(door.id,door.route)}
     style={({pressed})=>[styles.door,{left:(door.left+'%') as any,top:(door.top+'%') as any,
      borderColor:choice.tint,opacity:pressed ? 0.75 : 1}]}>
     <MaterialCommunityIcons name={door.icon} size={19} color="#FCE5B8"/>
     <Text style={styles.doorLabel} numberOfLines={2}>{door.label}</Text>
    </Pressable>)}
    <View pointerEvents="none" style={styles.sceneBottom}>
     <Text style={styles.sceneBottomText}>Tap any landmark · Customization and construction below</Text>
    </View>
   </View>
   <View style={styles.stockRow} accessibilityLabel="Offline-only workshop materials">
    {(['timber','stone','supplies'] as const).map((item,i)=><View key={item} style={styles.stock}>
     <MaterialCommunityIcons name={(['tree','terrain','toolbox-outline'] as const)[i]} size={18} color="#EFD6A5"/>
     <View><Text style={styles.stockValue}>{workshop.stock[item]}</Text><Text style={styles.stockName}>{item}</Text></View>
    </View>)}
   </View>
   <View style={styles.modeRow}>
    {([{id:'build',label:'Build',icon:'hammer-wrench'},{id:'gather',label:'Gather',icon:'compass-outline'},
      {id:'style',label:'Customize',icon:'palette-outline'}] as const).map(v=>
      <Pressable key={v.id} accessibilityRole="tab" accessibilityState={{selected:mode===v.id}}
       onPress={()=>{setMode(v.id);setNotice('');}} style={[styles.mode,mode===v.id&&styles.modeSelected]}>
       <MaterialCommunityIcons name={v.icon} size={17} color={mode===v.id?'#173A32':'#EDDFBA'}/>
       <Text style={[styles.modeText,mode===v.id&&styles.modeSelectedText]}>{v.label}</Text>
      </Pressable>)}
   </View>
   {mode==='build'?<View style={styles.panel}>
    <View style={styles.panelHeader}><View style={{flex:1}}>
     <Text style={styles.panelTitle}>{track==='lot'?'Personal Lot':track==='house'?'Personal House':'Community Estate'}</Text>
     <Text style={styles.muted}>{assetMeta.title} · {quote.target}</Text>
    </View><Text style={styles.progressEmblem}>{progress.level===10?'∞':'L'+progress.level}</Text></View>
    <Text style={styles.assetName}>NEXT: {quote.stageName} · stage {quote.stage}/5</Text>
    <View style={styles.stages}>
     {STAGES.map((step,i)=><View key={step.name}
      accessibilityLabel={step.name+(i<progress.stage?' complete':i===progress.stage?' current':' upcoming')}
      style={[styles.stage,i<progress.stage&&styles.stageDone,i===progress.stage&&styles.stageCurrent]}>
      <MaterialCommunityIcons name={i<progress.stage?'check':step.icon as IconName} size={18}
       color={i<=progress.stage?'#223A32':'#C7D8CD'}/>
      <Text style={[styles.stageText,i<=progress.stage&&styles.stageDark]}>{i+1}</Text>
     </View>)}
    </View>
    <View style={styles.requirementLine}>
     {(['timber','stone','supplies'] as const).map(m=><View key={m} style={styles.needBlock}>
      <Text style={styles.needLabel}>{m.toUpperCase()}</Text>
      <Text style={[styles.needValue,workshop.stock[m]<quote.need[m]&&styles.needMissing]}>
       {workshop.stock[m]}/{quote.need[m]}</Text>
     </View>)}
    </View>
    <Pressable accessibilityRole="button" style={[styles.primary,quote.available?null:styles.secondary]}
      onPress={quote.available?applyBuild:()=>{setMode('gather');setNotice('Collect local workshop materials through the resource hunt.');}}>
     <MaterialCommunityIcons name={quote.available?'hammer':'compass-outline'} size={20} color="#102E2C"/>
     <Text style={styles.primaryText}>{quote.available?'COMPLETE THIS CONSTRUCTION STAGE':'GATHER MISSING MATERIALS'}</Text>
    </Pressable>
    <Text style={styles.muted}>Every major level has five sequential stages. Level 10 unlocks endless cosmetic Mastery. Building here is local gameplay, not verified ownership or BP spending.</Text>
   </View>:null}
   {mode==='gather'?<View style={styles.panel}>
    <Text style={styles.panelTitle}>Resource Hunt</Text>
    <Text style={styles.muted}>Mini-game: choose the matching marker three times in a row. Incorrect moves restart your combo. Materials stay in this offline workshop.</Text>
    {!gather?<View style={styles.gatherChoices}>
      {([{id:'timber',label:'Find timber',icon:'tree'},{id:'stone',label:'Collect stone',icon:'terrain'},
      {id:'supplies',label:'Make tools',icon:'toolbox-outline'}] as const).map(m=>
      <Pressable key={m.id} accessibilityRole="button" style={styles.gatherCard} onPress={()=>startGather(m.id)}>
       <MaterialCommunityIcons name={m.icon} color="#E8D1A1" size={27}/>
       <Text style={styles.gatherText}>{m.label}</Text>
      </Pressable>)}
     </View>:<View style={styles.puzzle}>
      <View style={styles.puzzleTop}>
       <Text style={styles.assetName}>{gather.material.toUpperCase()} · {gather.step}/3 CORRECT</Text>
       <Text style={styles.muted}>Match the highlighted marker</Text>
      </View>
      <View style={styles.markers}>
       {[0,1,2].map(n=><Pressable key={n} accessibilityRole="button"
        accessibilityLabel={'Choose resource marker '+(n+1)}
        onPress={()=>chooseTile(n)} style={[styles.marker,n===nextTarget&&styles.markerTarget]}>
        <MaterialCommunityIcons name={n===0?'pine-tree':n===1?'pickaxe':'package-variant-closed'}
         size={32} color={n===nextTarget?'#143C31':'#F6E5C4'}/>
       </Pressable>)}
      </View>
      <Text style={styles.muted}>Find the glowing symbol. 3 correct moves = local resource bundle.</Text>
      <Pressable accessibilityRole="button" onPress={()=>setWorkshop(s=>({...s,gathering:null}))}>
       <Text style={styles.link}>Change resource</Text>
      </Pressable>
     </View>}
   </View>:null}
   {mode==='style'?<View style={styles.panel}>
    <Text style={styles.panelTitle}>Customize your world</Text>
    <Text style={styles.muted}>Architecture, lighting and scenery are saved on this device for your account. All within the official Genesis season.</Text>
    <Text style={styles.groupTitle}>ARCHITECTURE</Text>
    <View style={styles.looks}>{LOOKS.map(item=><Pressable key={item.id} accessibilityRole="button"
     accessibilityState={{selected:appearance.style===item.id}}
     accessibilityLabel={'Choose '+item.name} onPress={()=>updateLook({style:item.id})}
     style={[styles.look,appearance.style===item.id&&styles.activeLook]}>
     <View style={[styles.swatch,{backgroundColor:item.tint}]}/>
     <Text style={styles.lookText}>{item.name}</Text>
    </Pressable>)}</View>
    <Text style={styles.groupTitle}>DAYLIGHT</Text>
    <View style={styles.looks}>{([{id:'dawn',name:'Golden dawn',icon:'weather-sunset-up'},
     {id:'day',name:'Sunny day',icon:'weather-sunny'},{id:'twilight',name:'Twilight',icon:'weather-night'}] as const).map(s=>
     <Pressable key={s.id} accessibilityRole="button" accessibilityState={{selected:appearance.sky===s.id}}
      onPress={()=>updateLook({sky:s.id})} style={[styles.look,appearance.sky===s.id&&styles.activeLook]}>
      <MaterialCommunityIcons name={s.icon} size={18} color="#F3D9A6"/><Text style={styles.lookText}>{s.name}</Text>
     </Pressable>)}</View>
    <Text style={styles.groupTitle}>LANDSCAPE DETAILS</Text>
    <View style={styles.looks}>{([{id:'garden',name:'Garden',icon:'sprout'},
      {id:'lanterns',name:'Lanterns',icon:'lightbulb-on-outline'},{id:'pond',name:'Pond',icon:'waves'}] as const).map(s=>
     <Pressable key={s.id} accessibilityRole="button" accessibilityState={{selected:appearance.decor===s.id}}
      onPress={()=>updateLook({decor:s.id})} style={[styles.look,appearance.decor===s.id&&styles.activeLook]}>
      <MaterialCommunityIcons name={s.icon} size={18} color="#F3D9A6"/><Text style={styles.lookText}>{s.name}</Text>
     </Pressable>)}</View>
   </View>:null}
   {!!notice?<Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>:null}
   <Pressable accessibilityRole="button" accessibilityState={{expanded:showRequirements}}
    style={styles.requirements} onPress={()=>setShowRequirements(v=>!v)}>
    <Text style={styles.reqText}>Real assets, property & reward safeguards</Text>
    <MaterialCommunityIcons name={showRequirements?'chevron-up':'chevron-down'} color="#F4DCAD" size={20}/>
   </Pressable>
   {showRequirements?<Text style={styles.muted}>The live BUKLOD BP, QMP, character items, household permissions, title rights and Cluster approvals are separate. Actual world construction needs authenticated ownership, material inventory receipts, idempotent stage settlement, role and RLS checks and artwork approval. This workshop never unlocks them.</Text>:null}
   <Season2CommunityFacilities world={world}/>
   <Text style={styles.footer}>PREVIEW PLAYGROUND · Local saves only. The real Bahay, Garden, Market and Cluster features open directly from landmarks; no shared data is changed.</Text>
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#071C23'},
 scroll:{flex:1},
 loading:{flex:1,justifyContent:'center',alignItems:'center',gap:12,backgroundColor:'#071C23'},
 content:{paddingHorizontal:12,maxWidth:880,width:'100%',alignSelf:'center',gap:10},
 header:{flexDirection:'row',gap:10,alignItems:'center',paddingHorizontal:2,marginBottom:2},
 return:{width:44,height:46,alignItems:'center',justifyContent:'center',borderRadius:13,
  borderWidth:1,borderColor:'#738F88',backgroundColor:'#193C3A'},
 kicker:{color:'#B4DAC8',fontWeight:'900',fontSize:9,letterSpacing:1.2},
 title:{color:'#FFF0CE',fontSize:19,fontWeight:'900',lineHeight:24},
 subtitle:{color:'#C7D9D3',fontSize:11,lineHeight:15,marginTop:2},
 scene:{width:'100%',borderRadius:22,overflow:'hidden',borderWidth:1.5,
  backgroundColor:'#254D42',elevation:2},
 sceneBanner:{position:'absolute',left:8,top:8,backgroundColor:'rgba(5,28,31,.76)',
  borderRadius:10,paddingHorizontal:8,paddingVertical:6,flexDirection:'row',gap:5,alignItems:'center'},
 sceneBannerText:{color:'#FFEBBF',fontWeight:'800',fontSize:8,letterSpacing:.4},
 plotInfo:{position:'absolute',left:'34%',top:'67%',width:'36%',alignItems:'center',
  paddingVertical:4,borderRadius:9,backgroundColor:'rgba(5,24,25,.72)',
  borderWidth:1,borderColor:'rgba(234,206,155,.6)'},
 plotTitle:{color:'#FBEBC8',fontWeight:'900',fontSize:11},
 plotSub:{color:'#E4EAC9',fontWeight:'800',fontSize:9},
 decorLeft:{position:'absolute',left:'23%',bottom:'20%'},
 door:{position:'absolute',width:'27%',maxWidth:120,minHeight:43,borderRadius:10,
  borderWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,
  paddingHorizontal:5,paddingVertical:4,backgroundColor:'rgba(5,30,37,.76)'},
 doorLabel:{color:'#FFF0CF',fontWeight:'800',fontSize:10,flexShrink:1},
 sceneBottom:{position:'absolute',bottom:6,left:7,right:7,alignItems:'center'},
 sceneBottomText:{color:'#FFF0C9',fontSize:9,backgroundColor:'rgba(7,26,27,.7)',
  paddingHorizontal:9,paddingVertical:4,borderRadius:9,fontWeight:'700'},
 stockRow:{flexDirection:'row',gap:7},
 stock:{flex:1,minHeight:53,flexDirection:'row',alignItems:'center',justifyContent:'center',
  gap:9,backgroundColor:'#18373A',borderWidth:1,borderColor:'#557B72',borderRadius:13},
 stockValue:{color:'#FFF2D3',fontWeight:'900',fontSize:15},
 stockName:{color:'#B7CFC4',fontSize:10,textTransform:'capitalize'},
 modeRow:{flexDirection:'row',backgroundColor:'#19363D',borderRadius:12,padding:4,gap:5},
 mode:{flex:1,minHeight:44,flexDirection:'row',gap:7,justifyContent:'center',alignItems:'center',borderRadius:9},
 modeSelected:{backgroundColor:'#D6C496'},
 modeText:{color:'#F4E4BF',fontWeight:'900',fontSize:11},
 modeSelectedText:{color:'#173A32'},
 panel:{borderRadius:16,borderWidth:1,borderColor:'#587770',backgroundColor:'#122E33',
  padding:12,gap:10},
 panelHeader:{flexDirection:'row',alignItems:'center',gap:10},
 panelTitle:{color:'#F7DCAD',fontSize:17,fontWeight:'900'},
 progressEmblem:{fontWeight:'900',fontSize:21,color:'#F7DCAD'},
 assetName:{color:'#E8D1A3',fontWeight:'900',fontSize:12},
 muted:{color:'#BFD5CF',fontSize:11,lineHeight:16},
 stages:{flexDirection:'row',gap:6},
 stage:{flex:1,minHeight:48,borderRadius:10,alignItems:'center',justifyContent:'center',
  backgroundColor:'#28434B',gap:2},
 stageCurrent:{backgroundColor:'#DAC79A',borderWidth:1,borderColor:'#FFE3AD'},
 stageDone:{backgroundColor:'#98C9AF'},
 stageText:{color:'#D4E4D9',fontSize:10,fontWeight:'900'},
 stageDark:{color:'#223A32'},
 requirementLine:{flexDirection:'row',gap:6},
 needBlock:{flex:1,borderRadius:11,backgroundColor:'#1E4442',padding:8,alignItems:'center'},
 needLabel:{fontSize:9,color:'#AECBC1',fontWeight:'800'},
 needValue:{fontSize:13,color:'#C8EEC6',fontWeight:'900'},
 needMissing:{color:'#FFD0AD'},
 primary:{backgroundColor:'#E5CF9B',borderRadius:11,minHeight:48,flexDirection:'row',
  justifyContent:'center',alignItems:'center',gap:9,paddingHorizontal:10},
 secondary:{backgroundColor:'#B5CBAA'},
 primaryText:{fontWeight:'900',color:'#102E2C',fontSize:12,flexShrink:1,textAlign:'center'},
 gatherChoices:{flexDirection:'row',gap:7},
 gatherCard:{flex:1,minHeight:82,alignItems:'center',justifyContent:'center',gap:5,
  backgroundColor:'#274A49',borderRadius:12,borderWidth:1,borderColor:'#6C9680'},
 gatherText:{color:'#FCEDD1',fontSize:10,fontWeight:'800',textAlign:'center'},
 puzzle:{gap:12,paddingTop:4},
 puzzleTop:{alignItems:'center',gap:3},
 markers:{flexDirection:'row',gap:10},
 marker:{flex:1,minHeight:84,alignItems:'center',justifyContent:'center',borderRadius:14,
  backgroundColor:'#34534D',borderWidth:1,borderColor:'#688579'},
 markerTarget:{backgroundColor:'#E8D49E',borderColor:'#FFF1C4',borderWidth:3},
 link:{color:'#EDD6A4',fontWeight:'800',textAlign:'center',padding:8},
 groupTitle:{color:'#E2D4B6',fontWeight:'900',fontSize:10,marginTop:2,letterSpacing:1},
 looks:{flexDirection:'row',gap:7,flexWrap:'wrap'},
 look:{flexGrow:1,minHeight:44,borderRadius:10,paddingHorizontal:8,
  flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,
  borderColor:'#4A6F6D',backgroundColor:'#294444'},
 activeLook:{borderColor:'#FCE0A4',backgroundColor:'#416057'},
 swatch:{height:19,width:19,borderRadius:6},
 lookText:{color:'#FFF2D5',fontWeight:'800',fontSize:11},
 notice:{color:'#D6EAC6',fontWeight:'800',fontSize:11,textAlign:'center',paddingVertical:4},
 requirements:{minHeight:45,flexDirection:'row',justifyContent:'space-between',
  alignItems:'center',paddingHorizontal:10,borderRadius:10,
  backgroundColor:'#1C3C3C'},
 reqText:{color:'#F5E2B4',fontSize:12,fontWeight:'900',flex:1},
 footer:{color:'#AFC9BE',textAlign:'center',fontSize:10,lineHeight:15,marginBottom:14},
});
