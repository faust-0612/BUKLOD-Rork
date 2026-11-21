/**
 * Season 2 development worlds: one-tap visual doors, non-authoritative design
 * previews. This UI NEVER mints BP, unlocks land, or modifies a shared scope.
 * Actual development must come from separately verified server records/RPCs.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '@/providers/AuthProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import BuklodGameBackdrop from '@/features/games/runtime/BuklodGameBackdrop';
import {getDevelopmentAsset} from './developmentAssetManifest';
import Season2CommunityFacilities from './Season2CommunityFacilities';
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
  {id:'stone',name:'Classic stone',tint:'#D1B991',shade:'#384D50'},
  {id:'timber',name:'Tropical timber',tint:'#D7A978',shade:'#355C42'},
  {id:'garden',name:'Nature estate',tint:'#ADD8A0',shade:'#2C6650'},
] as const;
type Look = typeof LOOKS[number]['id'];
export function clampDevelopmentLevel(value:number) {
  return Math.min(10,Math.max(1,Math.floor(Number.isFinite(value)?value:1)));
}
export function constructionStageLabel(index:number) {
  return STAGES[Math.max(0,Math.min(4,Math.floor(index)))]?.name ?? STAGES[0].name;
}
export default function Season2DevelopmentMap({world}:{world:World}) {
  const {width} = useWindowDimensions();
  const {profile} = useAuth();
  const [previewTrack,setPreviewTrack] = useState<'lot'|'house'|'cluster'>(world==='home'?'lot':'cluster');
  const [previewLevels,setPreviewLevels] = useState({lot:1,house:1,cluster:1});
  const [previewStages,setPreviewStages] = useState({lot:0,house:0,cluster:0});
  const level=previewLevels[previewTrack];
  const assetMeta=getDevelopmentAsset(previewTrack,level);
  const stage=previewStages[previewTrack];
  const chooseTrack=(track:'lot'|'house'|'cluster')=>setPreviewTrack(track);
  const chooseStage=(i:number)=>setPreviewStages(v=>({...v,[previewTrack]:i}));
  const adjustLevel=(delta:number)=>setPreviewLevels(v=>({...v,[previewTrack]:clampDevelopmentLevel(v[previewTrack]+delta)}));
  const [look,setLook] = useState<Look>('stone');
  const [showRequirements,setShowRequirements] = useState(false);
  const ownerId = String(profile?.id ?? 'guest');
  const storageKey = 'buklod.s2.world-look.'+ownerId+'.'+world;
  const compact = width < 600;
  const doors = world === 'home' ? HOME_DOORS : VILLAGE_DOORS;
  const choice = LOOKS.find(x=>x.id===look) ?? LOOKS[0];
  const isPreview = isGenesisPreviewBuild();

  useEffect(()=>{
    if (!isPreview || ownerId==='guest') return;
    let live=true;
    void AsyncStorage.getItem(storageKey).then(saved=>{
      if (live && LOOKS.some(v=>v.id===saved)) setLook(saved as Look);
    }).catch(()=>undefined);
    return ()=>{live=false;};
  },[storageKey,ownerId,isPreview]);
  const chooseLook = useCallback((next:Look)=>{
    setLook(next);
    if (ownerId !== 'guest') void AsyncStorage.setItem(storageKey,next).catch(()=>undefined);
  },[ownerId,storageKey]);
  const title = world==='home' ? 'MY HOME · PERSONAL WORLD' : 'COMMUNITY VILLAGE';
  const desc = world==='home'
    ? 'Lot and House grow independently. Explore your personal space and household tools.'
    : 'Communities, compounds, facilities and livelihood grow through verified contribution.';
  const trackTitle = world==='home' ? 'Lot / House development' : 'Community / Cluster development';
  const sceneHeight = Math.max(250,Math.min(360,compact ? width*0.65 : width*0.43));
  const decoration = useMemo(()=>[0,1,2,3,4,5],[]);
  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD world map"
            onPress={()=>router.replace('/buklod-map' as any)} style={styles.return}>
            <MaterialCommunityIcons name="arrow-left" size={21} color="#FFEAC3"/>
            <Text style={styles.returnText}>WORLD MAP</Text>
          </Pressable>
          <View style={{flex:1}}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{desc}</Text>
          </View>
        </View>
        <View style={[styles.scene,{height:sceneHeight}]}>
          {/* Existing V2 artwork is the graceful fallback if the new local WebP cannot decode. */}
          <BuklodGameBackdrop thumbnail gameId={world==='home'?'phan-enterprise-builder':'elesur-village-builder'} opacity={0.82}/>
          <Image source={world==='home'?HOME_ART:VILLAGE_ART} contentFit="cover" style={StyleSheet.absoluteFill} transition={0} accessibilityLabel={world==='home'?'My Home construction world':'Community Village development world'} />
          <LinearGradient colors={['rgba(5,30,28,.08)','rgba(10,25,25,.20)','rgba(9,25,32,.64)']} style={StyleSheet.absoluteFill}/>
          {decoration.map(n=>(
            <View key={n} pointerEvents="none" style={[styles.tree,{left:(n*17+6)+'%',top:(n%2===0?4:83)+'%'}]}>
              <MaterialCommunityIcons name={n%3===0?'pine-tree':'tree'} size={compact?23:32} color={n%2===0?'#C3E8BD':'#6DAD70'}/>
            </View>
          ))}
          <View pointerEvents="none" style={[styles.landPlot,{borderColor:choice.tint,backgroundColor:choice.shade+'88'}]}>
            <MaterialCommunityIcons name={STAGES[stage].icon as IconName} size={compact?24:35} color={choice.tint}/>
            <Text style={styles.landLabel}>{previewTrack.toUpperCase()} · L{level}</Text>
          </View>
          {doors.map(door=>(
            <Pressable key={door.id} accessibilityRole="button"
              accessibilityLabel={'Open '+door.label}
              accessibilityHint={'Directly opens '+door.sub}
              onPress={()=>router.push(door.route as any)}
              style={({pressed})=>[styles.door,{left:door.left+'%',top:door.top+'%',
                borderColor:choice.tint,backgroundColor:pressed?'#1C473F':'rgba(9,25,40,.88)'}]}>
              <MaterialCommunityIcons name={door.icon} size={compact?18:22} color="#FFEAC3"/>
              <Text numberOfLines={2} style={styles.doorLabel}>{door.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.mapNote}>Tap a landmark to open instantly. No second Enter button. The illustration is a design preview, not verified ownership or development status.</Text>
        <Season2CommunityFacilities world={world}/>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{trackTitle}</Text>
          <Text style={styles.muted}>Permanent Levels 1–10 → unbounded Mastery. Lot, House and Community are independent of Circle Rank. Five construction stages per level.</Text>
          <Text style={styles.assetName}>{assetMeta.assetId} · {assetMeta.title}</Text>
          {world==='home' ? <View style={styles.trackRow}>
            {(['lot','house'] as const).map(track=>(
              <Pressable key={track} accessibilityRole="button" accessibilityLabel={'Preview '+track+' independently'}
                accessibilityState={{selected:previewTrack===track}} onPress={()=>chooseTrack(track)}
                style={[styles.trackButton,previewTrack===track&&styles.activeTrack]}>
                <Text style={styles.trackText}>{track==='lot'?'MY LOT':'MY HOUSE'} · L{previewLevels[track]}</Text>
              </Pressable>
            ))}
          </View> : null}
          <View style={styles.levelRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Preview previous level"
              disabled={level===1} style={styles.stepper} onPress={()=>adjustLevel(-1)}>
              <MaterialCommunityIcons name="minus" size={20} color="#FFE9BE"/>
            </Pressable>
            <Text style={styles.levelText}>LEVEL {level} · {STAGES[stage].name.toUpperCase()}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Preview next level"
              disabled={level===10} style={styles.stepper} onPress={()=>adjustLevel(1)}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFE9BE"/>
            </Pressable>
          </View>
          <View style={styles.stages}>
            {STAGES.map((s,i)=>(
              <Pressable key={s.name} accessibilityRole="button" accessibilityLabel={'Preview '+s.name}
                accessibilityState={{selected:stage===i}} onPress={()=>chooseStage(i)}
                style={[styles.stage,stage===i&&styles.activeStage]}>
                <MaterialCommunityIcons name={s.icon as IconName} size={18} color={stage===i?'#21392F':'#F5E3BF'}/>
                <Text style={[styles.stageText,stage===i&&styles.activeStageText]}>{i+1}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>{STAGES[stage].detail}. Level and stage selectors are visual previews only.</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Structure customization</Text>
          <Text style={styles.muted}>Preview architectural materials within the single official Genesis Season 2 theme. No unlocks, purchases or shared changes occur here.</Text>
          <View style={styles.looks}>
            {LOOKS.map(item=>(
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Use '+item.name+' local preview'}
                accessibilityState={{selected:look===item.id}} onPress={()=>chooseLook(item.id)}
                style={[styles.look,look===item.id&&styles.activeLook]}>
                <View style={[styles.swatch,{backgroundColor:item.tint}]}/>
                <Text style={styles.lookText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={()=>setShowRequirements(v=>!v)}
            accessibilityState={{expanded:showRequirements}} style={styles.requirements}>
            <Text style={styles.reqText}>Development requirements & safeguards</Text>
            <MaterialCommunityIcons name={showRequirements?'chevron-up':'chevron-down'} size={20} color="#FFEAC3"/>
          </Pressable>
          {showRequirements ? (
            <Text style={styles.muted}>Verified tasks and Development XP, obtainable materials and blueprints, land/neighbor or community consent and available space checks, gradually increasing effort and construction time. No client preview may spend BP, invent items, unlock construction or alter community land. Authoritative server-side transactions and role checks must be deployed and verified separately.</Text>
          ):null}
        </View>
        <Text style={styles.footer}>Season 2 DEV experience. Existing BUKLOD family, scope, market and reward pages remain the owners of their real data.</Text>
      </ScrollView>
    </View>
  );
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#071A22'},scroll:{flex:1},
  content:{paddingHorizontal:12,paddingTop:12,paddingBottom:26,gap:10,maxWidth:920,width:'100%',alignSelf:'center'},
  header:{flexDirection:'row',alignItems:'center',gap:12},
  return:{minWidth:60,alignItems:'center',justifyContent:'center',minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#6A8A81',paddingHorizontal:8},
  returnText:{color:'#FFEAC3',fontSize:9,fontWeight:'900'},
  title:{fontWeight:'900',color:'#FFEDC6',fontSize:21},
  subtitle:{color:'#CDDDD2',fontSize:11,lineHeight:16},
  scene:{overflow:'hidden',borderRadius:20,borderWidth:2,borderColor:'#BEA36A',backgroundColor:'#254E44'},
  tree:{position:'absolute',opacity:.8},
  landPlot:{position:'absolute',alignItems:'center',justifyContent:'center',top:'43%',left:'38%',width:'24%',height:'22%',borderWidth:2,borderRadius:15},
  landLabel:{color:'#FFFFFF',fontSize:9,fontWeight:'900',textAlign:'center'},
  door:{position:'absolute',minHeight:48,minWidth:90,maxWidth:122,borderRadius:11,borderWidth:1,flexDirection:'row',alignItems:'center',gap:4,padding:6},
  doorLabel:{color:'#FFF7D6',fontSize:10,fontWeight:'900',flexShrink:1},
  mapNote:{color:'#B9D6CE',fontSize:10,lineHeight:15},
  panel:{padding:12,borderRadius:15,backgroundColor:'#152C34',borderColor:'#46645B',borderWidth:1,gap:9},
  panelTitle:{color:'#FEE5B7',fontWeight:'900',fontSize:15},
  assetName:{color:'#E9DFB8',fontSize:12,fontWeight:'800'},
  muted:{color:'#BDD0CA',fontSize:11,lineHeight:17},
  trackRow:{flexDirection:'row',gap:7},
  trackButton:{flex:1,minHeight:39,alignItems:'center',justifyContent:'center',borderRadius:9,
    backgroundColor:'#253D41',borderColor:'#50635A',borderWidth:1},
  activeTrack:{borderColor:'#E9C68F',backgroundColor:'#3D584E'},
  trackText:{color:'#FFF1D2',fontSize:11,fontWeight:'900'},
  levelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},
  stepper:{minWidth:44,minHeight:42,justifyContent:'center',alignItems:'center',backgroundColor:'#24453F',borderRadius:10},
  levelText:{color:'#FFFFFF',fontSize:12,fontWeight:'900',textAlign:'center',flex:1},
  stages:{flexDirection:'row',gap:6,justifyContent:'space-around'},
  stage:{flex:1,minHeight:43,alignItems:'center',justifyContent:'center',backgroundColor:'#263F46',borderRadius:9},
  activeStage:{backgroundColor:'#D2C294'},stageText:{color:'#FAEBC8',fontWeight:'800',fontSize:10},
  activeStageText:{color:'#22372E'},
  looks:{flexDirection:'row',flexWrap:'wrap',gap:8},
  look:{flexGrow:1,minHeight:44,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:8,
    backgroundColor:'#283F42',borderRadius:9,borderWidth:1,borderColor:'#4C6968'},
  activeLook:{borderColor:'#F3CE82',backgroundColor:'#354A44'},
  swatch:{width:19,height:19,borderRadius:5},lookText:{color:'#F8F4DF',fontWeight:'800',fontSize:11},
  requirements:{minHeight:42,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  reqText:{color:'#FFEAC3',fontSize:12,fontWeight:'900'},
  footer:{color:'#A6BCB5',fontSize:10,textAlign:'center',lineHeight:15},
});
