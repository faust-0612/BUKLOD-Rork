/**
 * Season 2 development worlds: one-tap visual doors, non-authoritative design
 * previews. This UI NEVER mints BP, unlocks land, or modifies a shared scope.
 * Actual development must come from separately verified server records/RPCs.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated,PanResponder,Platform,Pressable,ScrollView,StatusBar,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {openBundledBuklodWorld,type BuklodGodotWorld} from '../../../../modules/buklod-genesis-godot';
import BuklodGameBackdrop from '@/features/games/runtime/BuklodGameBackdrop';
import {getDevelopmentAsset,getDevelopmentStageAsset} from './developmentAssetManifest';
import Season2CommunityFacilities from './Season2CommunityFacilities';
import DevelopmentStructurePreview from './DevelopmentStructurePreview';
import EstateConstructionConsole from './EstateConstructionConsole';
import EstateMomentFX from './EstateMomentFX';
import EstateCosmeticTile from './EstateCosmeticTile';
import EstateGenesisAtmosphere from './EstateGenesisAtmosphere';
import {useEstateFeedback,type EstateMoment} from './estateFeedback';
import {type EstateCosmetics,type EstateSnapshot} from './estateProgressClient';
import {constructionPlan, nextMilestone, safeCosmetics, safeMastery} from './constructionPlan.mjs';
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
  {id:'slate',name:'Coastal slate',tint:'#9BB8C9',shade:'#344E63'},
  {id:'clay',name:'Heritage clay',tint:'#D5A17A',shade:'#795545'},
  {id:'light',name:'Starlight',tint:'#E5DFD0',shade:'#5C658E'},
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
  const insets=useSafeAreaInsets();
  const topSafeArea=Math.max(insets.top,Platform.OS==='android'?(StatusBar.currentHeight??0):0);
  const {profile} = useAuth();
  const {activeScope,scopes} = useBuklodScope();
  // Community previews belong to one verified member scope, not to the global Wall.
  const communityScopes=scopes.filter(s=>s.scope_type==='CLUSTER'||s.scope_type==='ORGANIZATION');
  const [selectedCommunityScopeId,setSelectedCommunityScopeId]=useState('');
  const chosenScope=world==='village'
    ? communityScopes.find(s=>s.scope_id===selectedCommunityScopeId)
      ?? communityScopes.find(s=>s.scope_id===activeScope?.scope_id)
      ?? communityScopes[0] ?? null
    : null;
  const canCustomizePreview=world==='home'||Boolean(chosenScope?.is_admin);
  const [previewTrack,setPreviewTrack] = useState<'lot'|'house'|'cluster'>(world==='home'?'lot':'cluster');
  const [previewLevels,setPreviewLevels] = useState({lot:1,house:1,cluster:1});
  const [previewStages,setPreviewStages] = useState({lot:0,house:0,cluster:0});
  const [previewMastery,setPreviewMastery]=useState({lot:0,house:0,cluster:0});
  const estateFeedback=useEstateFeedback();
  const [estateMoment,setEstateMoment]=useState<EstateMoment|null>(null);
  const [estateMomentSequence,setEstateMomentSequence]=useState(0);
  const handleEstateMoment=(cue:EstateMoment)=>{
    estateFeedback.emit(cue);
    if(['apply','claim','build_start','build_complete','contribute','buy_success','buy_failure','unlock','error'].includes(cue)){
      setEstateMoment(cue);setEstateMomentSequence(n=>n+1);
    }
  };
  const [studioTab,setStudioTab]=useState<'structure'|'grounds'|'lighting'>(world==='home'?'grounds':'structure');
  const [liveView,setLiveView]=useState(true);
  const [earnedByProperty,setEarnedByProperty]=useState<Record<string,EstateSnapshot>>({});
  const personId=String(profile?.id??'');
  const estateIdentity=world==='home'
    ?(personId?{kind:'USER' as const,ownerId:personId,track:previewTrack}:null)
    :(chosenScope?.scope_id?{kind:'SCOPE' as const,ownerId:chosenScope.scope_id,track:'cluster' as const}:null);
  const earnedKey=estateIdentity?estateIdentity.kind+':'+estateIdentity.ownerId+':'+estateIdentity.track:'';
  const verified=earnedByProperty[earnedKey]??null;
  const level=liveView&&verified?verified.level:previewLevels[previewTrack];
  const stage=liveView&&verified?verified.stage:previewStages[previewTrack];
  const mastery=liveView&&verified?verified.mastery:previewMastery[previewTrack];
  const assetMeta=getDevelopmentAsset(previewTrack,level);
  const stageAsset=getDevelopmentStageAsset(previewTrack,level,stage);
  const chooseTrack=(track:'lot'|'house'|'cluster')=>{estateFeedback.emit('preview');setPreviewTrack(track);setLiveView(true);setStudioTab(track==='lot'?'grounds':'structure');};
  const enterBlueprint=()=>{
    if(liveView&&verified){
      setPreviewLevels(v=>({...v,[previewTrack]:verified.level}));
      setPreviewStages(v=>({...v,[previewTrack]:verified.stage}));
      setPreviewMastery(v=>({...v,[previewTrack]:verified.mastery}));
    }
    setLiveView(false);
  };
  const chooseStage=(i:number)=>{estateFeedback.emit('preview');if(liveView&&verified){
    setPreviewLevels(v=>({...v,[previewTrack]:verified.level}));
    setPreviewMastery(v=>({...v,[previewTrack]:verified.mastery}));
  }setPreviewStages(v=>({...v,[previewTrack]:i}));setLiveView(false);};
  const adjustLevel=(delta:number)=>{estateFeedback.emit('preview');setPreviewLevels(v=>({...v,[previewTrack]:clampDevelopmentLevel(level+delta)}));setLiveView(false);};
  const adjustMastery=(delta:number)=>{estateFeedback.emit('preview');if(liveView&&verified){setPreviewLevels(v=>({...v,[previewTrack]:verified.level}));setPreviewStages(v=>({...v,[previewTrack]:verified.stage}));}
    setPreviewMastery(v=>({...v,[previewTrack]:safeMastery(Math.min(Number.MAX_SAFE_INTEGER,mastery+delta))}));setLiveView(false);};
  const [look,setLook] = useState<Look>('stone');
  const [roof,setRoof]=useState<'gable'|'hip'|'terrace'>('gable');
  const [ground,setGround]=useState<'grass'|'flower'|'stone'>('grass');
  const [fence,setFence]=useState<EstateCosmetics['fence']>('wood');
  const [windows,setWindows]=useState<EstateCosmetics['windows']>('classic');
  const [lights,setLights]=useState<EstateCosmetics['lights']>('warm');
  const [doorStyle,setDoorStyle]=useState<EstateCosmetics['door']>('wood');
  const [pathStyle,setPathStyle]=useState<EstateCosmetics['path']>('gravel');
  const [yardStyle,setYardStyle]=useState<EstateCosmetics['yard']>('bench');
  const scrollRef=useRef<ScrollView|null>(null);
  const studioPosition=useRef(0),buildPosition=useRef(0);
  const design:EstateCosmetics={finish:look,roof,ground,fence,windows,lights,door:doorStyle,path:pathStyle,yard:yardStyle};
  // The VERIFIED map always paints server-saved cosmetics, never an unsaved draft.
  const visualDesign:EstateCosmetics=liveView&&verified?verified.cosmetics:design;
  const [zoom,setZoom]=useState(1);
  const [cosmeticLoadedKey,setCosmeticLoadedKey]=useState('');
  const [showRequirements,setShowRequirements] = useState(false);
  const ownerId = String(profile?.id ?? 'guest');
  const storageKey = 'buklod.s2.world-look.'+ownerId+'.'+world+'.'+(world==='home'?previewTrack:chosenScope?.scope_id??'unassigned');
  const previousCosmeticKey='buklod.s2.world-look.'+ownerId+'.'+world+'.'+(world==='home'?'personal':chosenScope?.scope_id??'unassigned')+'.cosmetics.v2';
  const cosmeticKey=storageKey+'.cosmetics.v2';
  const compact = width < 600;
  const doors = world === 'home' ? HOME_DOORS : VILLAGE_DOORS;
  const choice = LOOKS.find(x=>x.id===visualDesign.finish) ?? LOOKS[0];
  const isPreview = isGenesisPreviewBuild();
  const requirements=constructionPlan(previewTrack,level,stage,mastery);
  const next=nextMilestone(level,stage,mastery);
  const applyEarned=(snapshot:EstateSnapshot)=>{
    const key=snapshot.owner_kind+':'+snapshot.owner_id+':'+snapshot.track;
    setEarnedByProperty(current=>({...current,[key]:snapshot}));
    if(liveView&&key===earnedKey){
      setLook(snapshot.cosmetics.finish);setRoof(snapshot.cosmetics.roof);
      setGround(snapshot.cosmetics.ground);setFence(snapshot.cosmetics.fence);
      setWindows(snapshot.cosmetics.windows);setLights(snapshot.cosmetics.lights);
      setDoorStyle(snapshot.cosmetics.door);setPathStyle(snapshot.cosmetics.path);setYardStyle(snapshot.cosmetics.yard);
    }
  };
  const applySavedDesign=(saved:EstateCosmetics)=>{
    setLook(saved.finish);setRoof(saved.roof);setGround(saved.ground);
    setFence(saved.fence);setWindows(saved.windows);setLights(saved.lights);
    setDoorStyle(saved.door);setPathStyle(saved.path);setYardStyle(saved.yard);
    setLiveView(true);
  };

  useEffect(()=>{
    // A person's draft cannot cross account or verified scope boundaries.
    let live=true;
    setCosmeticLoadedKey('');
    setLook('stone');setRoof('gable');setGround('grass');setFence('wood');setWindows('classic');setLights('warm');setDoorStyle('wood');setPathStyle('gravel');setYardStyle('bench');
    if(!isPreview||ownerId==='guest'||!canCustomizePreview)return()=>{live=false;};
    void Promise.all([AsyncStorage.getItem(cosmeticKey),AsyncStorage.getItem(storageKey),AsyncStorage.getItem(previousCosmeticKey)]).then(([saved,legacy,previous])=>{
      if(!live)return;
      let v:unknown=null;
      try{v=saved?JSON.parse(saved):previous?JSON.parse(previous):{finish:legacy};}catch{v={finish:legacy};}
      const c=safeCosmetics(v);
      setLook(c.finish as Look);
      setRoof(c.roof as 'gable'|'hip'|'terrace');
      setGround(c.ground as 'grass'|'flower'|'stone');
      setFence((['wood','iron','hedge'].includes(c.fence)?c.fence:'wood') as EstateCosmetics['fence']);
      setWindows((['classic','panorama','arched'].includes(c.windows)?c.windows:'classic') as EstateCosmetics['windows']);
      setLights(c.lights as EstateCosmetics['lights']);
      setDoorStyle(c.door as EstateCosmetics['door']);setPathStyle(c.path as EstateCosmetics['path']);setYardStyle(c.yard as EstateCosmetics['yard']);
    }).catch(()=>undefined).finally(()=>{if(live)setCosmeticLoadedKey(storageKey);});
    return()=>{live=false;};
  },[cosmeticKey,storageKey,previousCosmeticKey,ownerId,isPreview,canCustomizePreview]);
  useEffect(()=>{
    if(cosmeticLoadedKey!==storageKey||ownerId==='guest'||!canCustomizePreview||!isPreview)return;
    void AsyncStorage.setItem(cosmeticKey,JSON.stringify(design)).catch(()=>undefined);
  },[cosmeticLoadedKey,storageKey,cosmeticKey,look,roof,ground,fence,windows,lights,doorStyle,pathStyle,yardStyle,canCustomizePreview,ownerId,isPreview]);
  const previewCustomize=(partial:Partial<EstateCosmetics>)=>{
    if(!canCustomizePreview)return;
    estateFeedback.emit('customize');
    const next={...(liveView&&verified?verified.cosmetics:design),...partial};
    setLook(next.finish);setRoof(next.roof);setGround(next.ground);
    setFence(next.fence);setWindows(next.windows);setLights(next.lights);
    setDoorStyle(next.door);setPathStyle(next.path);setYardStyle(next.yard);
    enterBlueprint();
  };
  const chooseLook = useCallback((next:Look)=>{
    if(!canCustomizePreview)return;
    previewCustomize({finish:next});
  },[canCustomizePreview,previewCustomize]);
  const title = world==='home' ? 'MY HOME · PERSONAL WORLD' : 'MY COMMUNITY · '+(chosenScope?.name??'Choose a Cluster or Organization');
  const desc = world==='home'
    ? 'Lot and House grow independently. Explore your personal space and household tools.'
    : 'Virtual cluster/organization development preview, separate from the Public Community Wall. Shared construction remains server-authorized.';
  const trackTitle = world==='home' ? 'Lot / House development' : 'Community / Cluster development';
  const sceneHeight = Math.max(310,Math.min(500,compact ? width*0.92 : width*0.50));
  const pan=useRef(new Animated.ValueXY()).current;
  const panBase=useRef({x:0,y:0});
  useEffect(()=>{
    // Clamp panning whenever dimensions or zoom change; reset at 100%.
    const maxX=Math.max(0,width*(zoom-1)/2);
    const maxY=Math.max(0,sceneHeight*(zoom-1)/2);
    const x=Math.max(-maxX,Math.min(maxX,panBase.current.x));
    const y=Math.max(-maxY,Math.min(maxY,panBase.current.y));
    panBase.current={x,y};
    pan.setValue({x,y});
  },[zoom,width,sceneHeight,pan]);
  const mapPanResponder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>false,
    onMoveShouldSetPanResponder:(_,g)=>zoom>1&&(Math.abs(g.dx)>8||Math.abs(g.dy)>8),
    onPanResponderGrant:()=>{
      pan.setOffset(panBase.current);
      pan.setValue({x:0,y:0});
    },
    onPanResponderMove:(_,g)=>pan.setValue({x:g.dx,y:g.dy}),
    onPanResponderRelease:(_,g)=>{
      const maxX=Math.max(0,width*(zoom-1)/2);
      const maxY=Math.max(0,sceneHeight*(zoom-1)/2);
      const x=Math.max(-maxX,Math.min(maxX,panBase.current.x+g.dx));
      const y=Math.max(-maxY,Math.min(maxY,panBase.current.y+g.dy));
      pan.flattenOffset();panBase.current={x,y};pan.setValue({x,y});
    },
    onPanResponderTerminate:()=>{pan.flattenOffset();pan.setValue(panBase.current);},
  }),[zoom,width,sceneHeight,pan]);
  const decoration = useMemo(()=>[0,1,2,3,4,5],[]);
  const nativeWorldPreview = Platform.OS==='android' &&
    process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW==='true' &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS==='true';
  const [nativeWorldOpening,setNativeWorldOpening]=useState(false);
  const [nativeWorldError,setNativeWorldError]=useState('');
  const openNativeWorld = async (target:BuklodGodotWorld)=>{
    if (!nativeWorldPreview || nativeWorldOpening) return;
    setNativeWorldOpening(true);setNativeWorldError('');
    try {
      if (!(await openBundledBuklodWorld(target))) {
        setNativeWorldError('Native world unavailable; original BUKLOD world remains usable.');
      }
    } catch {
      setNativeWorldError('Unable to enter native world. Original BUKLOD world remains usable.');
    } finally {setNativeWorldOpening(false);}
  };
  return (
    <View style={styles.root}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={[styles.content,{paddingTop:Math.max(12,topSafeArea+8),paddingBottom:Math.max(30,insets.bottom+28)}]} showsVerticalScrollIndicator={false}>
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
        {nativeWorldPreview?<View style={{flexDirection:'row',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <Pressable accessibilityRole="button" accessibilityLabel={'Explore Godot '+(world==='home'?'House':'Community')+' preview'} disabled={nativeWorldOpening}
            onPress={()=>void openNativeWorld(world==='home'?'house':'community')}
            style={{borderRadius:12,borderWidth:1,borderColor:'#8CE0BC',paddingHorizontal:14,paddingVertical:9,backgroundColor:'#173D37'}}>
            <Text style={{color:'#F1FFEB',fontWeight:'800'}}>GODOT {world==='home'?'HOUSE':'COMMUNITY'} PREVIEW</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Explore Godot Kingdom preview" disabled={nativeWorldOpening}
            onPress={()=>void openNativeWorld('kingdom')}
            style={{borderRadius:12,borderWidth:1,borderColor:'#8CE0BC',paddingHorizontal:14,paddingVertical:9,backgroundColor:'#173D37'}}>
            <Text style={{color:'#F1FFEB',fontWeight:'800'}}>GODOT KINGDOM PREVIEW</Text>
          </Pressable>
          {nativeWorldError?<Text style={{color:'#FFE9BB'}}>{nativeWorldError}</Text>:null}
        </View>:null}
        {world==='village'?<View style={styles.scopePanel}>
          <Text style={styles.panelTitle}>My Community · Verified scope</Text>
          {!communityScopes.length?<Pressable accessibilityRole="button" accessibilityLabel="Discover Clusters"
            onPress={()=>router.push('/clusters' as any)} style={styles.scopeChoice}>
            <Text style={styles.scopeChoiceText}>Sumali muna sa Cluster o Organization →</Text>
          </Pressable>:<View style={styles.scopeRow}>
            {communityScopes.map(scope=><Pressable key={scope.scope_id} accessibilityRole="button"
              accessibilityLabel={'Preview '+scope.name+' community land'}
              accessibilityState={{selected:chosenScope?.scope_id===scope.scope_id}}
              onPress={()=>setSelectedCommunityScopeId(scope.scope_id)}
              style={[styles.scopeChoice,chosenScope?.scope_id===scope.scope_id&&styles.selectedScope]}>
              <Text style={styles.scopeChoiceText} numberOfLines={2}>{scope.name}</Text>
            </Pressable>)}
          </View>}
          <Text style={styles.muted}>{canCustomizePreview?'Local visual preview for this scope only; no server or shared land is changed.':'Only a verified Cluster/Organization admin may save this local design preview. Actual community land remains read-only until server verification.'}</Text>
        </View>:null}
        <View style={[styles.scene,{height:sceneHeight}]}>
          <Animated.View {...mapPanResponder.panHandlers} style={[StyleSheet.absoluteFill,{transform:[...pan.getTranslateTransform(),{scale:zoom}]}]}>
          {/* Existing V2 artwork is the graceful fallback if the new local WebP cannot decode. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <BuklodGameBackdrop thumbnail gameId={world==='home'?'phan-enterprise-builder':'elesur-village-builder'} opacity={0.82}/>
            <Image source={world==='home'?HOME_ART:VILLAGE_ART} contentFit="cover" style={StyleSheet.absoluteFill} transition={0} accessibilityLabel={world==='home'?'My Home construction world':'Community Village development world'} />
            <LinearGradient colors={['rgba(5,30,28,.03)','rgba(10,25,25,.07)','rgba(9,25,32,.56)']} style={StyleSheet.absoluteFill}/>
            <EstateGenesisAtmosphere world={world} level={level} building={Boolean(verified?.pending_key)}/>
          </View>
          <View pointerEvents="none" style={styles.previewStructure}>
            <DevelopmentStructurePreview track={previewTrack} level={level} stage={stage} mastery={level===10?mastery:0} earnedProgress={liveView&&!!verified}
               finish={visualDesign.finish} roof={visualDesign.roof} ground={visualDesign.ground}
               fence={visualDesign.fence} windows={visualDesign.windows} lights={visualDesign.lights}
               door={visualDesign.door} path={visualDesign.path} yard={visualDesign.yard}/>
          </View>
          {decoration.map(n=>(
            <View key={n} pointerEvents="none" style={[styles.tree,{left:`${n*17+6}%` as `${number}%`,top:`${n%2===0?4:83}%` as `${number}%`}]}>
              <MaterialCommunityIcons name={n%3===0?'pine-tree':'tree'} size={compact?23:32} color={n%2===0?'#C3E8BD':'#6DAD70'}/>
            </View>
          ))}

          {doors.map(door=>(
            <Pressable key={door.id} accessibilityRole="button"
              accessibilityLabel={'Open '+door.label}
              accessibilityHint={'Directly opens '+door.sub}
              onPress={()=>{handleEstateMoment(door.id==='market'?'buy_open':'navigation');router.push(door.route as any);}}
              style={({pressed})=>[styles.door,{left:`${door.left}%` as `${number}%`,top:`${door.top}%` as `${number}%`,
                borderColor:choice.tint,backgroundColor:pressed?'#1C473F':'rgba(9,25,40,.88)'}]}>
              <MaterialCommunityIcons name={door.icon} size={compact?18:22} color="#FFEAC3"/>
              <Text numberOfLines={2} style={styles.doorLabel}>{door.label}</Text>
            </Pressable>
          ))}
          </Animated.View>
          <EstateMomentFX event={estateMoment} sequence={estateMomentSequence} cosmetics={visualDesign}/>
          <View style={styles.mapBadge} pointerEvents="none">
            <MaterialCommunityIcons name="hammer-wrench" size={14} color="#FFE6B0"/>
            <Text style={styles.mapBadgeText}>{liveView&&verified?'VERIFIED':'BLUEPRINT'} · {previewTrack.toUpperCase()} L{level}{level===10&&mastery>0?' · M'+mastery:''}</Text>
          </View>
          <View style={styles.zoomBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom out of world" disabled={zoom<=1} onPress={()=>{estateFeedback.emit('navigation');setZoom(v=>Math.max(1,Math.round((v-.15)*100)/100));}} style={styles.zoomButton}><MaterialCommunityIcons name="minus" size={20} color="#FFEBC5"/></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Reset world zoom" onPress={()=>{estateFeedback.emit('navigation');setZoom(1);panBase.current={x:0,y:0};pan.setValue({x:0,y:0});}} style={styles.zoomButton}><Text style={styles.zoomText}>{Math.round(zoom*100)}%</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom in on world" disabled={zoom>=1.6} onPress={()=>{estateFeedback.emit('navigation');setZoom(v=>Math.min(1.6,Math.round((v+.15)*100)/100));}} style={styles.zoomButton}><MaterialCommunityIcons name="plus" size={20} color="#FFEBC5"/></Pressable>
          </View>
        </View>
        <View style={styles.quickActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Jump to property customization studio"
            onPress={()=>{estateFeedback.emit('navigation');enterBlueprint();scrollRef.current?.scrollTo({y:studioPosition.current,animated:true});}} style={styles.quickAction}>
            <MaterialCommunityIcons name="palette-outline" size={18} color="#FFEBBC"/><Text style={styles.quickActionText}>CUSTOMIZE</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Jump to verified construction and materials"
            onPress={()=>{estateFeedback.emit('navigation');scrollRef.current?.scrollTo({y:buildPosition.current,animated:true});}} style={styles.quickAction}>
            <MaterialCommunityIcons name="hammer-wrench" size={18} color="#FFEBBC"/><Text style={styles.quickActionText}>BUILD / MATERIALS</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={estateFeedback.voiceEnabled?'Disable estate voice guide':'Enable estate voice guide'}
            accessibilityState={{checked:estateFeedback.voiceEnabled}} onPress={estateFeedback.toggleVoice} style={styles.quickAction}>
            <MaterialCommunityIcons name={estateFeedback.voiceEnabled?'volume-high':'volume-off'} size={18} color="#FFEBBC"/>
            <Text style={styles.quickActionText}>{estateFeedback.voiceEnabled?'VOICE ON':'VOICE OFF'}</Text>
          </Pressable>
        </View>
        {estateFeedback.voiceEnabled&&!estateFeedback.voiceAvailable?
          <Text style={styles.mapNote}>English voice fallback active. Install a Filipino system TTS voice for Filipino narration.</Text>:null}
        <Text style={styles.mapNote}>One-tap landmarks open existing household and community features. Construction comes from verified server progress. BLUEPRINT stages are optional visual samples.</Text>
        <Season2CommunityFacilities world={world}/>
        <View style={styles.panel}>
          <View style={styles.levelRow}>
            <Text style={[styles.panelTitle,{flex:1}]}>{trackTitle}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="View my verified constructed estate"
              onPress={()=>{estateFeedback.emit('preview');setLiveView(true);}} disabled={!verified}
              style={[styles.previewToggle,liveView&&verified&&styles.previewToggleActive]}>
              <Text style={styles.previewToggleText}>VERIFIED</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Explore future blueprint designs"
              onPress={()=>{estateFeedback.emit('preview');enterBlueprint();}} style={[styles.previewToggle,!liveView&&styles.previewToggleActive]}>
              <Text style={styles.previewToggleText}>BLUEPRINT</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>Permanent Levels 1–10 → unbounded Mastery. Lot, House and Community are independent of Circle Rank. Five construction stages per level.</Text>
          <View style={styles.assetLine}><MaterialCommunityIcons name="layers-triple-outline" size={18} color="#FFE7AD"/><Text style={styles.assetName}>{assetMeta.assetId} · {assetMeta.title} · {stageAsset.stageAssetId.split('_').pop()}</Text><Text style={styles.previewPill}>{liveView&&verified?'EARNED':'PREVIEW'}</Text></View>
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
          <Text style={styles.muted}>{STAGES[stage].detail}. The scene reflects the selected stage. To view earned construction select VERIFIED; previews never unlock upgrades.</Text>
          {level===10&&stage===4?<View style={styles.levelRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Preview previous Mastery" disabled={mastery<=0} onPress={()=>adjustMastery(-1)} style={styles.stepper}><MaterialCommunityIcons name="minus" size={18} color="#FFE9BE"/></Pressable>
            <Text style={styles.levelText}>ESTATE MASTERY · {mastery.toLocaleString()}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Preview next Mastery" disabled={mastery>=Number.MAX_SAFE_INTEGER} onPress={()=>adjustMastery(1)} style={styles.stepper}><MaterialCommunityIcons name="plus" size={18} color="#FFE9BE"/></Pressable>
          </View>:null}
          <View style={styles.requirementMetrics}>
            <View style={styles.metric}><MaterialCommunityIcons name="hammer-screwdriver" size={19} color="#D6E8BA"/><Text style={styles.metricAmount}>{requirements.estimatedDevelopmentXp} XP</Text><Text style={styles.metricLabel}>planning effort</Text></View>
            <View style={styles.metric}><MaterialCommunityIcons name="tree-outline" size={19} color="#D6E8BA"/><Text style={styles.metricAmount}>{requirements.estimatedTimber} timber</Text><Text style={styles.metricLabel}>estimated</Text></View>
            <View style={styles.metric}><MaterialCommunityIcons name="clock-outline" size={19} color="#D6E8BA"/><Text style={styles.metricAmount}>{requirements.estimatedBuildMinutes} min</Text><Text style={styles.metricLabel}>build estimate</Text></View>
          </View>
          <Text style={styles.nextHint}>Next design milestone: {next.mastery>0?'Mastery '+next.mastery:'Level '+next.level+' · '+STAGES[next.stage].name}. Use the verified construction console above for real materials and transactions; this planning estimate is non-authoritative.</Text>
        </View>
        <View style={styles.panel} onLayout={event=>{studioPosition.current=event.nativeEvent.layout.y;}}>
          <Text style={styles.panelTitle}>Design studio · Your blueprint</Text>
          <Text style={styles.muted}>Choose only the parts that apply to this property. The Genesis landscape remains official; changes render immediately in this showroom, and SAVE DESIGN TO SERVER applies them to the verified estate.</Text>
          <View style={styles.showroom}>
            <Text style={styles.showroomTitle}>LIVE DESIGN SHOWROOM · LEVEL 8 SAMPLE</Text>
            <View style={styles.showroomArt}>
              <DevelopmentStructurePreview track={previewTrack} level={8} stage={4} mastery={0}
                finish={design.finish} roof={design.roof} ground={design.ground}
                fence={design.fence} windows={design.windows} lights={design.lights}
                door={design.door} path={design.path} yard={design.yard}/>
            </View>
            <Text style={styles.showroomNote}>Visual sample only. Your real development level is not changed.</Text>
          </View>
          <View style={styles.studioTabs}>
            {([{id:'structure',label:'STRUCTURE'},{id:'grounds',label:'LAND & YARD'},{id:'lighting',label:'LIGHTS'}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:studioTab===item.id,disabled:previewTrack==='lot'&&item.id==='structure'}}
                accessibilityHint={previewTrack==='lot'&&item.id==='structure'?'Roof, windows and doors apply to buildings. Switch to My House to customize them.':'Select design category'}
                disabled={previewTrack==='lot'&&item.id==='structure'} onPress={()=>{estateFeedback.emit('preview');setStudioTab(item.id);}}
                style={[styles.studioTab,studioTab===item.id&&styles.studioTabActive]}>
                <Text style={styles.studioTabText}>{item.label}</Text>
              </Pressable>)}
          </View>
          {studioTab==='structure'?<>
          <Text style={styles.optionTitle}>EXTERIOR FINISH</Text>
          <View style={styles.looks}>
            {LOOKS.map(item=>(
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Use '+item.name+' local preview'}
                accessibilityState={{selected:look===item.id}} disabled={!canCustomizePreview} onPress={()=>chooseLook(item.id)}
                style={[styles.look,look===item.id&&styles.activeLook]}>
                <EstateCosmeticTile family="finish" choice={item.id} size={40}/>
                <Text style={styles.lookText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.optionTitle}>ROOF SHAPE</Text>
          <View style={styles.optionRow}>
            {([{id:'gable',label:'Gable',icon:'home-roof'},{id:'hip',label:'Hip roof',icon:'home-outline'},{id:'terrace',label:'Flat deck',icon:'view-dashboard-outline'}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Preview '+item.label+' roof'} accessibilityState={{selected:roof===item.id}} disabled={!canCustomizePreview} onPress={()=>previewCustomize({roof:item.id})} style={[styles.option,roof===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="roof" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          <Text style={styles.optionTitle}>WINDOWS & GLAZING</Text>
          <View style={styles.optionRow}>
            {([{id:'classic',label:'Classic',icon:'window-closed-variant'},{id:'panorama',label:'Panorama',icon:'window-maximize'},{id:'arched',label:'Heritage arch',icon:'arch'}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Use '+item.label} accessibilityState={{selected:windows===item.id}} disabled={!canCustomizePreview} onPress={()=>previewCustomize({windows:item.id})} style={[styles.option,windows===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="windows" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          <Text style={styles.optionTitle}>ENTRY DOOR</Text>
          <View style={styles.optionRow}>
            {([{"id":"wood","label":"Timber","icon":"door-closed"},{"id":"glass","label":"Glass","icon":"door-sliding"},{"id":"arched","label":"Arch","icon":"arch"}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Preview '+item.label}
                accessibilityState={{selected:doorStyle===item.id}} disabled={!canCustomizePreview}
                onPress={()=>previewCustomize({door:item.id})}
                style={[styles.option,doorStyle===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="door" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          </>:null}
          {studioTab==='grounds'?<>
          <Text style={styles.optionTitle}>LANDSCAPING</Text>
          <View style={styles.optionRow}>
            {([{id:'grass',label:'Green lot',icon:'grass'},{id:'flower',label:'Flower garden',icon:'flower'},{id:'stone',label:'Stone paths',icon:'road-variant'}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Preview '+item.label} accessibilityState={{selected:ground===item.id}} disabled={!canCustomizePreview} onPress={()=>previewCustomize({ground:item.id})} style={[styles.option,ground===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="ground" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          <Text style={styles.optionTitle}>FENCE & PERIMETER</Text>
          <View style={styles.optionRow}>
            {([{id:'wood',label:'Wood fence',icon:'fence'},{id:'iron',label:'Iron railing',icon:'gate'},{id:'hedge',label:'Green hedge',icon:'tree-outline'}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Use '+item.label} accessibilityState={{selected:fence===item.id}} disabled={!canCustomizePreview} onPress={()=>previewCustomize({fence:item.id})} style={[styles.option,fence===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="fence" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          <Text style={styles.optionTitle}>PATH & PAVING</Text>
          <View style={styles.optionRow}>
            {([{"id":"gravel","label":"Gravel","icon":"terrain"},{"id":"pavers","label":"Pavers","icon":"checkerboard"},{"id":"brick","label":"Brick","icon":"wall"}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Preview '+item.label}
                accessibilityState={{selected:pathStyle===item.id}} disabled={!canCustomizePreview}
                onPress={()=>previewCustomize({path:item.id})}
                style={[styles.option,pathStyle===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="path" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          <Text style={styles.optionTitle}>YARD FEATURE</Text>
          <View style={styles.optionRow}>
            {([{"id":"bench","label":"Bench","icon":"seat"},{"id":"pond","label":"Water pond","icon":"waves"},{"id":"pergola","label":"Pergola","icon":"home-roof"}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Preview '+item.label}
                accessibilityState={{selected:yardStyle===item.id}} disabled={!canCustomizePreview}
                onPress={()=>previewCustomize({yard:item.id})}
                style={[styles.option,yardStyle===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="yard" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          </>:null}
          {studioTab==='lighting'?<>
          <Text style={styles.optionTitle}>ESTATE LIGHTING</Text>
          <View style={styles.optionRow}>
            {([{id:'warm',label:'Warm lamps',icon:'lightbulb-outline'},{id:'starlight',label:'Starlight',icon:'star-four-points'},{id:'garden',label:'Garden lights',icon:'outdoor-lamp'}] as const).map(item=>
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Use '+item.label} accessibilityState={{selected:lights===item.id}} disabled={!canCustomizePreview} onPress={()=>previewCustomize({lights:item.id})} style={[styles.option,lights===item.id&&styles.activeOption]}>
                <EstateCosmeticTile family="lights" choice={item.id}/><Text style={styles.optionText}>{item.label}</Text>
              </Pressable>)}
          </View>
          </>:null}
          <Text style={styles.nextHint}>{canCustomizePreview?'Customize the blueprint, then use SAVE DESIGN TO SERVER in the verified construction panel. Drafts on this device never grant ownership or level upgrades.':'Only authorized scope administrators may save shared designs. Members may preview safely.'}</Text>
          <Pressable accessibilityRole="button" onPress={()=>setShowRequirements(v=>!v)}
            accessibilityState={{expanded:showRequirements}} style={styles.requirements}>
            <Text style={styles.reqText}>Development requirements & safeguards</Text>
            <MaterialCommunityIcons name={showRequirements?'chevron-up':'chevron-down'} size={20} color="#FFEAC3"/>
          </Pressable>
          {showRequirements ? (
            <Text style={styles.muted}>Verified tasks and Development XP, obtainable materials and blueprints, land/neighbor or community consent and available space checks, gradually increasing effort and construction time. No client preview may spend BP, invent items, unlock construction or alter community land. Authoritative server-side transactions and role checks must be deployed and verified separately.</Text>
          ):null}
        </View>
        <View onLayout={event=>{buildPosition.current=event.nativeEvent.layout.y;}}>
          <EstateConstructionConsole key={earnedKey||'no-estate'} identity={estateIdentity} userId={personId} design={design}
            onVerified={applyEarned} onApplyDesign={applySavedDesign} onMoment={handleEstateMoment}/>
        </View>
        <Text style={styles.footer}>Season 2 DEV experience. Existing BUKLOD family, scope, market and reward pages remain the owners of their real data.</Text>
      </ScrollView>
    </View>
  );
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#071A22'},scroll:{flex:1},
  content:{paddingHorizontal:12,paddingTop:12,paddingBottom:30,gap:10,maxWidth:920,width:'100%',alignSelf:'center'},
  scopePanel:{padding:12,borderRadius:14,backgroundColor:'#153B3B',borderColor:'#799B7D',borderWidth:1,gap:9},
  scopeRow:{flexDirection:'row',flexWrap:'wrap',gap:7},
  scopeChoice:{minHeight:44,justifyContent:'center',paddingHorizontal:10,borderRadius:10,
    backgroundColor:'#264940',borderWidth:1,borderColor:'#577C65'},
  selectedScope:{borderColor:'#FFE5AE',backgroundColor:'#3B6551'},
  scopeChoiceText:{color:'#FFEAC3',fontWeight:'800',fontSize:12},
  header:{flexDirection:'row',alignItems:'center',gap:12},
  return:{minWidth:60,alignItems:'center',justifyContent:'center',minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#6A8A81',paddingHorizontal:8},
  returnText:{color:'#FFEAC3',fontSize:9,fontWeight:'900'},
  title:{fontWeight:'900',color:'#FFEDC6',fontSize:21,flexShrink:1},
  subtitle:{color:'#CDDDD2',fontSize:11,lineHeight:16},
  scene:{overflow:'hidden',borderRadius:20,borderWidth:2,borderColor:'#BEA36A',backgroundColor:'#254E44'},
  previewStructure:{position:'absolute',left:'23%',top:'31%',width:'54%',height:'54%'},
  mapBadge:{position:'absolute',top:11,left:10,right:110,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(9,30,32,.85)',borderWidth:1,borderColor:'#A7B08F',borderRadius:14,paddingHorizontal:9,paddingVertical:6},
  mapBadgeText:{color:'#FDEBC4',fontWeight:'800',fontSize:9,flexShrink:1},
  quickActions:{flexDirection:'row',gap:7},
  quickAction:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',minHeight:43,borderRadius:10,
    backgroundColor:'#284C42',borderWidth:1,borderColor:'#86A58D'},
  quickActionText:{color:'#FBE9BD',fontSize:11,fontWeight:'900'},
  showroom:{gap:5,padding:7,backgroundColor:'#143D37',borderColor:'#A4A981',borderWidth:1,borderRadius:12},
  showroomArt:{height:170,backgroundColor:'#305A49',borderRadius:10,overflow:'hidden'},
  showroomTitle:{color:'#FFEAC0',fontSize:11,fontWeight:'900'},
  showroomNote:{color:'#D4E9D5',fontSize:10},
  studioTabs:{flexDirection:'row',gap:5},
  studioTab:{flex:1,minHeight:38,justifyContent:'center',alignItems:'center',paddingHorizontal:2,borderRadius:10,backgroundColor:'#2A4444'},
  studioTabActive:{backgroundColor:'#416D56',borderWidth:1,borderColor:'#EECF96'},
  studioTabText:{color:'#FFF3D0',fontWeight:'900',fontSize:10},
  zoomBar:{position:'absolute',top:9,right:9,flexDirection:'row',gap:3,backgroundColor:'rgba(8,29,34,.89)',padding:3,borderRadius:15,borderWidth:1,borderColor:'#B8A57B'},
  previewToggle:{minHeight:34,justifyContent:'center',paddingHorizontal:7,borderRadius:8,backgroundColor:'#2B4A47'},
  previewToggleActive:{backgroundColor:'#5B7358',borderWidth:1,borderColor:'#F0DBAB'},
  previewToggleText:{color:'#FFF0CC',fontSize:9,fontWeight:'900'},
  zoomButton:{minWidth:32,minHeight:34,alignItems:'center',justifyContent:'center',borderRadius:9},
  zoomText:{fontSize:10,color:'#FFE7AC',fontWeight:'900'},
  tree:{position:'absolute',opacity:.8},
  landPlot:{position:'absolute',alignItems:'center',justifyContent:'center',top:'43%',left:'38%',width:'24%',height:'22%',borderWidth:2,borderRadius:15},
  landLabel:{color:'#FFFFFF',fontSize:9,fontWeight:'900',textAlign:'center'},
  door:{position:'absolute',minHeight:44,minWidth:72,maxWidth:110,borderRadius:13,borderWidth:1,flexDirection:'row',alignItems:'center',gap:4,padding:5,shadowColor:'#E8CC8F',shadowOpacity:.25,shadowRadius:6,elevation:3},
  doorLabel:{color:'#FFF7D6',fontSize:10,fontWeight:'900',flexShrink:1},
  assetLine:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},
  previewPill:{fontSize:9,fontWeight:'900',backgroundColor:'#31564A',color:'#DFF4C4',borderRadius:8,overflow:'hidden',paddingHorizontal:7,paddingVertical:3},
  requirementMetrics:{flexDirection:'row',gap:6},
  metric:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',borderRadius:10,paddingVertical:9,gap:3,backgroundColor:'#244348'},
  metricAmount:{color:'#FCEBC4',fontSize:11,fontWeight:'900'},
  metricLabel:{color:'#C4DBD1',fontSize:9},
  nextHint:{fontSize:10,lineHeight:16,color:'#A9D2C4'},
  optionTitle:{color:'#E9D7AC',fontSize:10,fontWeight:'900',marginTop:2},
  optionRow:{flexDirection:'row',gap:6},
  option:{flex:1,minHeight:67,alignItems:'center',justifyContent:'center',gap:3,backgroundColor:'#273F41',borderRadius:10,borderColor:'#5A7471',borderWidth:1},
  activeOption:{borderColor:'#F7CE85',backgroundColor:'#456054'},
  optionText:{fontSize:9,fontWeight:'800',color:'#FCF0D5'},
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
