/** Season 2 non-production Kingdom entry: illustrated character portals, not the legacy cartoon map.
 * Route IDs and earned reward logic stay owned by the existing Kingdom backend. */
import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { getGenesisDeviceQuality } from './genesisDeviceQuality';
import { getBuklodSpecialLevelAsset, type BuklodSpecialCharacterId } from '@/lib/buklodSpecialCharacterAssets';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import type { ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';
import GenesisCosmicSky, { GenesisOrbitHalo } from './GenesisCosmicSky';
import GenesisRiveCharacter from './GenesisRiveCharacter';
import { useRorkGameAmbience } from '@/features/games/runtime/rorkAudio';
import { useAuth } from '@/providers/AuthProvider';
import BuklodKingdomAdSlot from '@/components/BuklodKingdomAdSlot';
import { emptyKingdomPreviewProgress, loadBuklodKingdomPreviewProgress, subscribeBuklodKingdomPreviewProgress, type BuklodKingdomPreviewProgress } from '@/features/games/kingdom/progress';
import { GenesisSeal } from './GenesisVisuals';
import { pulseGenesisTouch } from './genesisNativeFeedback';
import GenesisKingdomStationScene from './GenesisKingdomStationScene';
import GenesisKingdomLoreMaps,{type KingdomMapKind} from './GenesisKingdomLoreMaps';
import {getMyBuklodCharacterSelectionV2} from '@/lib/buklodCharacterSelectionV2';

export const GENESIS_REALMS = [
  { id:'phan-enterprise-builder', name:'Phan', title:'The First Harvest', caption:'Build a beginning that can sustain others', character:'phan' },
  { id:'quin-discovery-expedition', name:'Quin', title:'Beyond the Horizon', caption:'Explore creation and discover new paths', character:'quin' },
  { id:'van-living-city-dispatch', name:'Van', title:'The Living City', caption:'Bring life and order to a growing world', character:'van' },
  { id:'christian-civic-leadership', name:'Christian', title:'Covenant of Service', caption:'Lead through trust and responsibility', character:'christian' },
  { id:'lhen-rhythm-journey', name:'Lhen', title:'Resonance of Life', caption:'Find rhythm in every shared journey', character:'lhen' },
  { id:'ace-rescue-grid', name:'Ace', title:'The Guardian', caption:'Protect those facing the unknown', character:'ace' },
  { id:'elesur-village-builder', name:'ELESUR', title:'Sanctuary Builders', caption:'Raise a home where hope can grow', character:'ellusur' },
  { id:'jawo-forest-trail', name:'Jawo', title:'Into the Wild', caption:'Follow the light through hidden places', character:'jawo' },
  { id:'mitch-restore-mural', name:'Mitch', title:'The Color of Dawn', caption:'Restore the beauty of a living world', character:'mitch' },
  { id:'niel-mission-trail', name:'Niel', title:'Frontier of Purpose', caption:'Make a way for the next generation', character:'niel' },
  { id:'angel-kingdom-treasury', name:'Angel', title:'Keeper of Treasures', caption:'Steward the resources of tomorrow', character:'angel' },
  { id:'vhen-farm-to-market', name:'Vhen', title:'Seeds of Promise', caption:'Care for what the earth will yield', character:'vhen' },
  { id:'trudice-playground-memory', name:'Trudice', title:'The Wonder Garden', caption:'Protect the joy of new beginnings', character:'trudice' },
] as const;
type Realm = (typeof GENESIS_REALMS)[number];
type StationIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Exact canonical 13 original Kingdom game IDs/routes, expressed as visual station plaques.
 * No alternate levels, unlocks or reward ledgers are introduced. */
const STATION_DETAILS: Record<Realm['id'], { region:string;game:string;icon:StationIcon;accent:string }> = {
 'phan-enterprise-builder':{region:'Farm / Enterprise',game:'Enterprise Builder',icon:'barn',accent:'#E5BA67'},
 'quin-discovery-expedition':{region:'Discovery World',game:'Discovery Expedition',icon:'telescope',accent:'#9BC0E8'},
 'van-living-city-dispatch':{region:'Living City',game:'City Dispatch',icon:'city-variant-outline',accent:'#9CD6D4'},
 'christian-civic-leadership':{region:'Civic Academy',game:'Leadership Council',icon:'bank-outline',accent:'#D7C8AA'},
 'lhen-rhythm-journey':{region:'Music City',game:'Rhythm Journey',icon:'music-note',accent:'#D8B3E1'},
 'ace-rescue-grid':{region:'Strategy / Rescue',game:'Rescue Grid',icon:'map-marker-path',accent:'#ADDAE7'},
 'elesur-village-builder':{region:'Highland Community',game:'Village Builder',icon:'home-group',accent:'#B8D6BC'},
 'jawo-forest-trail':{region:'Explorer Forest',game:'Forest Trail',icon:'pine-tree',accent:'#A3D5A8'},
 'mitch-restore-mural':{region:'Art Village',game:'Restore the Mural',icon:'palette-outline',accent:'#E8B29E'},
 'niel-mission-trail':{region:'Mission Frontier',game:'Mission Trail',icon:'compass-outline',accent:'#CADCB2'},
 'angel-kingdom-treasury':{region:'Treasury City',game:'Kingdom Treasury',icon:'treasure-chest-outline',accent:'#F7D294'},
 'vhen-farm-to-market':{region:'Agricultural Valley',game:'Farm to Market',icon:'sprout',accent:'#D0E3A5'},
 'trudice-playground-memory':{region:"Children's Haven",game:'Wonder Path',icon:'human-child',accent:'#E1C0DF'},
};
const CORE: readonly string[] = ['phan','quin','van','christian','lhen'];
const KINGDOM_NATURE_HIGH = require('../../../../assets/season2/genesis/kingdom/kingdom-nature-panorama.webp');
const KINGDOM_NATURE_COMPACT = require('../../../../assets/season2/genesis/kingdom/kingdom-nature-panorama-compact.webp');
/** Position normalized to the original 16:9 art, not device pixels. Region taps
 * change only the selected canonical Character realm, never inventory or BP. */
export const KINGDOM_NATURE_LANDMARKS = [
  { id:'forest', label:'Living Forest', character:'jawo', left:'15%', top:'51%', icon:'pine-tree' },
  { id:'citadel', label:'Kingdom Citadel', character:'christian', left:'49%', top:'31%', icon:'castle' },
  { id:'alpine', label:'Winter Highlands', character:'quin', left:'79%', top:'17%', icon:'terrain' },
  { id:'river', label:'River Valley', character:'vhen', left:'47%', top:'75%', icon:'waves' },
  { id:'coast', label:'Coastal District', character:'phan', left:'87%', top:'63%', icon:'sail-boat' },
] as const;

function RealmCharacter({ character }: { character: Realm['character'] }) {
  return CORE.includes(character)
    ? <BuklodProgressiveCharacterArt characterId={character as ProgressiveCharacterId} level={1} height={214} viewportWidth={160}/>
    : <Image source={getBuklodSpecialLevelAsset(character as BuklodSpecialCharacterId, 1)}
      resizeMode="contain" fadeDuration={0} style={{ width: 172, height: 213 }}/>;
}

export default function GenesisKingdomPortal() {
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<Realm>(GENESIS_REALMS[0]);
  const [mapMode,setMapMode]=useState<KingdomMapKind>('core');
  const [visibleSpecialIds,setVisibleSpecialIds]=useState<readonly string[]>([]);
  const [verifiedSpecialOwner,setVerifiedSpecialOwner]=useState<string|null>(null);
  const [specialLoading,setSpecialLoading]=useState(false);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  // This MUST follow userId initialization. Access before declaration throws
  // on first render and blanks the entire Kingdom screen on Android.
  const allowedSpecialIds=verifiedSpecialOwner===userId?visibleSpecialIds:[];
  const [stationProgress, setStationProgress] = useState<BuklodKingdomPreviewProgress>(emptyKingdomPreviewProgress());
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const { musicEnabled, toggleMusic } = useRorkGameAmbience('kingdom-map');
  // Account switches must not reuse unlocked Special identities from another user.
  useEffect(()=>{setSelected(GENESIS_REALMS[0]);setMapMode('core');setVisibleSpecialIds([]);setVerifiedSpecialOwner(null);},[userId]);
  useEffect(()=>{
    if(mapMode!=='special'||!focused||!userId)return;
    let live=true;
    setSpecialLoading(true);
    void getMyBuklodCharacterSelectionV2(userId).then(state=>{
      if(live){setVisibleSpecialIds(state.visible_special_character_ids);setVerifiedSpecialOwner(userId);}
    }).catch(()=>{
      if(live){setVisibleSpecialIds([]);setVerifiedSpecialOwner(null);}
    }).finally(()=>{if(live)setSpecialLoading(false);});
    return()=>{live=false;};
  },[mapMode,focused,userId]);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (current) setReduceMotion(Boolean(v)); }).catch(() => undefined);
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduceMotion(Boolean(v)));
    const b = AppState.addEventListener('change', s => setForeground(s === 'active'));
    return () => { current = false; a.remove(); b.remove(); };
  }, []);
  // Account-scoped, local, READ-ONLY station badges. Never copy another account's
  // clears, grant points, or delay game navigation behind local-storage I/O.
  useEffect(() => {
    let live = true;
    setStationProgress(emptyKingdomPreviewProgress());
    void loadBuklodKingdomPreviewProgress(userId).then(value => {
      if (live) setStationProgress(value);
    }).catch(() => undefined);
    const unsubscribe = subscribeBuklodKingdomPreviewProgress(userId, value => {
      if (live) setStationProgress(value);
    });
    return () => { live = false; unsubscribe(); };
  }, [userId]);
  const animate = focused && foreground && !reduceMotion;
  const natureVista = getGenesisDeviceQuality('kingdom') === 'minimal' ? KINGDOM_NATURE_COMPACT : KINGDOM_NATURE_HIGH;
  const select = (realm: Realm) => {
    if (selected.id === realm.id) return;
    setSelected(realm);
    if (animate) void pulseGenesisTouch('selection');
  };
  const enterStation = (realm: Realm) => {
    setSelected(realm);
    if (animate) void pulseGenesisTouch('selection');
    router.push(('/games/' + realm.id) as any);
  };
  const switchMap=(next:KingdomMapKind)=>{
    setMapMode(next);
    if(next==='core')setSelected(GENESIS_REALMS[0]);
    else {
      const first=GENESIS_REALMS.find(r=>!CORE.includes(r.character)&&allowedSpecialIds.includes(r.character));
      if(first)setSelected(first);
    }
  };
  const activeSelected=mapMode==='core'?CORE.includes(selected.character):
    !CORE.includes(selected.character)&&allowedSpecialIds.includes(selected.character);
  const frameHeight = width > 640 ? 260 : 235;
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <GenesisCosmicSky active={animate}/>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>BUKLOD · SEASON 2 · GENESIS</Text>
          <Text style={styles.headerTitle}>Let there be light.</Text>
          <Text style={styles.headerSubtitle}>A living universe begins with purpose. Enter the world through its characters.</Text>
        </View>
        <GenesisSeal active={animate} size={70}/>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD Home"
        onPress={()=>router.replace('/(tabs)/hub')} style={styles.worldBack}>
        <MaterialCommunityIcons name="arrow-left" size={18} color="#EFD7A0"/>
        <Text style={styles.worldBackText}>BUKLOD Home</Text>
      </Pressable>
      <GenesisKingdomLoreMaps mode={mapMode} realms={GENESIS_REALMS}
        unlockedSpecialIds={allowedSpecialIds} loadingSpecial={specialLoading}
        stationClears={Object.fromEntries(Object.entries(stationProgress.stations).map(([k,v])=>[k,v.clears??0]))}
        onSelect={realm=>enterStation(realm as Realm)} onSwitch={switchMap}/>
      {/* Fixed local BUKLOD-owned art: mature, nature-first, tropical/coastal and alpine/winter.
          Preserve full 16:9 panorama on narrow Android displays; no server egress or blank art. */}
      <View style={styles.kingdomVista} accessibilityLabel="Majestic Kingdom overlooking tropical valleys, rivers, waterfalls, ocean and winter mountains">
        <ExpoImage source={natureVista} contentFit="cover" cachePolicy="memory-disk"
          transition={reduceMotion ? 0 : 140} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent','rgba(3,15,26,.02)','rgba(3,16,29,.85)']}
          locations={[0,.55,1]} style={StyleSheet.absoluteFill} />
        {KINGDOM_NATURE_LANDMARKS.map(landmark => {
          const isSelected = selected.character === landmark.character;
          const realm = GENESIS_REALMS.find(entry => entry.character === landmark.character);
          if (!realm || mapMode==='special' || !CORE.includes(realm.character)) return null;
          return <Pressable
            key={landmark.id}
            accessibilityRole="button"
            accessibilityLabel={'Explore '+landmark.label+' with '+realm.name}
            accessibilityState={{selected:isSelected}}
            onPress={() => enterStation(realm)}
            style={({pressed}) => [
              styles.landmark, {left:landmark.left, top:landmark.top},
              isSelected && styles.landmarkActive, pressed && styles.landmarkPressed,
            ]}
          >
            <MaterialCommunityIcons name={landmark.icon as any} size={16} color={isSelected ? '#FFF5CB' : '#DCEFE8'} />
            <Text numberOfLines={1} style={styles.landmarkName}>{realm.name}</Text>
          </Pressable>;
        })}
        <View pointerEvents="none" style={styles.vistaCaption}>
          <Text style={styles.vistaEyebrow}>THE LIVING KINGDOM</Text>
          <Text numberOfLines={2} style={styles.vistaTitle}>Tropical Valleys · Winter Peaks</Text>
        </View>
      </View>

      {/* Owner-approved scenic panorama remains intact. Reintroduce the original
          13 character-specific Kingdom stations directly beneath it, with a
          continuous station trail and true one-tap original game routes. */}
      <View style={styles.stationSection}>
        <View style={styles.stationHeading}>
          <Text style={styles.stationHeadingText}>13 CHARACTER STATIONS</Text>
          <Text style={styles.stationSwipeHint}>SWIPE · TAP TO PLAY</Text>
        </View>
        <ScrollView horizontal nestedScrollEnabled bounces={false}
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="All 13 original Kingdom character stations"
          contentContainerStyle={styles.stationTrail}>
          {GENESIS_REALMS.map((realm,index) => {
            if((mapMode==='core')!==CORE.includes(realm.character))return null;
            if(mapMode==='special'&&!allowedSpecialIds.includes(realm.character))return null;
            const details = STATION_DETAILS[realm.id];
            const stationClears = stationProgress.stations[realm.id]?.clears ?? 0;
            return <Pressable key={realm.id} accessibilityRole="button"
              accessibilityLabel={'Station '+(index+1)+': '+realm.name+', '+details.game+'. Tap to play.'}
              onPress={() => enterStation(realm)}
              onLongPress={() => select(realm)}
              style={({pressed})=>[
                styles.stationCard,
                {borderColor: details.accent},
                realm.id === selected.id && styles.stationCardSelected,
                pressed && styles.stationCardPressed,
              ]}>
              <View style={styles.stationCardTop}>
                <View style={[styles.stationIcon,{borderColor:details.accent}]}>
                  <MaterialCommunityIcons name={details.icon} color={details.accent} size={24}/>
                </View>
                <Text style={styles.stationIndex}>STATION {String(index+1).padStart(2,'0')}</Text>
                {stationClears > 0 ? <MaterialCommunityIcons name="check-decagram" color="#BCE6B0" size={17} /> : null}
              </View>
              <View pointerEvents="none" style={styles.stationScene}>
                <GenesisKingdomStationScene id={realm.id}/>
              </View>
              <Text numberOfLines={1} style={styles.stationCharacter}>{realm.name}</Text>
              <Text numberOfLines={1} style={styles.stationRegion}>{details.region}</Text>
              <Text numberOfLines={2} style={styles.stationGame}>{details.game}</Text>
              <View style={styles.stationBottom}>
                <Text style={styles.stationStatus}>{stationClears > 0 ? 'LOCAL CLEARS '+stationClears : 'READY TO PLAY'}</Text>
                <MaterialCommunityIcons name="arrow-right-circle" size={21} color={details.accent}/>
              </View>
            </Pressable>;
          })}
        </ScrollView>
      </View>
      {activeSelected?<View style={[styles.illustration,{height:frameHeight}]}>
        {/* Individual characters retain their original local models/art. Do not load remote
            preview-host backgrounds or substitute wallpaper for animated character rigs. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GenesisKingdomStationScene id={selected.id} mode="hero"/>
        </View>
        <LinearGradient colors={['rgba(2,10,20,.20)','rgba(4,15,28,.16)','rgba(1,8,17,.88)']} style={StyleSheet.absoluteFill}/>
        <GenesisCosmicSky active={animate} transparent/>
        <GenesisOrbitHalo active={animate} size={Math.min(300, width * 0.72)} />
        <View pointerEvents="none" style={styles.heroArt}>
          <GenesisRiveCharacter active={animate} width={188} height={214}
            fallback={<RealmCharacter character={selected.character}/>} />
        </View>
        <View style={styles.heroCopy} pointerEvents="none">
          <Text style={styles.realmName}>{selected.name.toUpperCase()} · CREATION REALM</Text>
          <Text style={styles.realmTitle}>{selected.title}</Text>
          <Text style={styles.realmCaption}>{selected.caption}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={'Enter '+selected.title}
          style={styles.enter} onPress={()=>{ void pulseGenesisTouch('selection'); router.push(('/games/'+selected.id) as any); }}>
          <Text style={styles.enterLabel}>ENTER REALM</Text>
          <MaterialCommunityIcons name="arrow-right" color="#10291E" size={18}/>
        </Pressable>
      </View>:null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="switch" accessibilityLabel="Genesis cinematic ambience"
          accessibilityState={{checked:musicEnabled}} onPress={toggleMusic}
          style={[styles.action,styles.soundAction]}>
          <MaterialCommunityIcons name={musicEnabled ? 'volume-high' : 'volume-off'} size={22} color="#F8DBA1"/>
          <View style={{flex:1}}>
            <Text style={styles.actionTitle}>Cinematic soundscape · {musicEnabled ? 'On' : 'Off'}</Text>
            <Text style={styles.actionSub}>Opt-in local music · pauses outside Kingdom</Text>
          </View>
          <MaterialCommunityIcons name={musicEnabled ? 'toggle-switch' : 'toggle-switch-off'} color="#F5DBAD" size={28}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/games/genesis-collection' as any)} style={styles.action}>
          <MaterialCommunityIcons name="diamond-stone" size={22} color="#FFE3A3"/>
          <View style={{flex:1}}>
            <Text style={styles.actionTitle}>The Collection Vault</Text>
            <Text style={styles.actionSub}>120 original items · character relics · rank insignia</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" color="#FFE3A3" size={24}/>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/games/legacy' as any)} style={[styles.action,{borderColor:'#496B76'}]}>
          <MaterialCommunityIcons name="shield-star-outline" size={22} color="#B5E4CE"/>
          <View style={{flex:1}}>
            <Text style={styles.actionTitle}>My Verified Progress</Text>
            <Text style={styles.actionSub}>Official characters, badges and earned rewards</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" color="#B5E4CE" size={24}/>
        </Pressable>
      </View>
      <Text style={styles.disclaimer}>Original Character Kingdom stations and routes. Local clears are only game progress; Character levels, badges, points and unlocks remain governed by existing verified server rules. No free rewards are granted here.</Text>
      {/* Normal document flow: ad is LAST and can only be reached by scrolling.
          No fixed/sticky Kingdom ad can cover characters, map controls or stations. */}
      <View style={styles.kingdomAdFooter} accessibilityLabel="Kingdom sponsored footer after all gameplay entrances">
        <BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner" />
      </View>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:'#030D1E'},
 content:{width:'100%',maxWidth:850,alignSelf:'center',padding:12,paddingBottom:28,gap:12},
 kingdomVista:{width:'100%',aspectRatio:16/9,borderRadius:18,overflow:'hidden',
   borderWidth:1,borderColor:'#728B83',backgroundColor:'#0B2832'},
 landmark:{position:'absolute',width:44,height:44,marginLeft:-22,marginTop:-22,
   borderRadius:19,borderWidth:1.4,borderColor:'#C5D9CA',backgroundColor:'rgba(9,33,38,.82)',
   alignItems:'center',justifyContent:'center',elevation:2},
 landmarkActive:{borderColor:'#FFE6A4',backgroundColor:'rgba(28,61,57,.96)',elevation:4},
 landmarkPressed:{opacity:.78},
 landmarkName:{position:'absolute',top:38,left:-25,width:94,textAlign:'center',fontSize:10,
   fontWeight:'900',color:'#FFF2CB',textShadowColor:'rgba(0,0,0,.9)',textShadowRadius:4},
 worldBack:{minHeight:44,flexDirection:'row',alignItems:'center',gap:6,
   alignSelf:'flex-start',paddingHorizontal:10,borderRadius:12,borderWidth:1,
   borderColor:'#778E79',backgroundColor:'#102E34'},
 worldBackText:{fontSize:12,fontWeight:'900',color:'#F1DEB5'},
 stationSection:{gap:7},
 stationHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:3},
 stationHeadingText:{fontSize:12,letterSpacing:.6,fontWeight:'900',color:'#FFE4AB'},
 stationSwipeHint:{fontSize:9,fontWeight:'800',color:'#B8D9C9'},
 stationTrail:{alignItems:'stretch',gap:9,paddingVertical:3,paddingHorizontal:3,paddingRight:15},
 stationCard:{width:182,minHeight:218,padding:8,borderWidth:1.3,borderRadius:15,
   backgroundColor:'#102E33',justifyContent:'space-between',elevation:2},
 stationCardSelected:{backgroundColor:'#193C3C'},
 stationCardPressed:{opacity:.72},
 stationCardTop:{flexDirection:'row',alignItems:'center',gap:4},
 stationScene:{height:91,width:'100%',borderRadius:10,overflow:'hidden',
   borderWidth:1,borderColor:'rgba(227,219,175,.38)',backgroundColor:'#153B3D'},
 stationIcon:{width:41,height:41,borderRadius:21,borderWidth:1.2,alignItems:'center',
   justifyContent:'center',backgroundColor:'#193E39'},
 stationIndex:{flex:1,fontSize:9,fontWeight:'900',color:'#E4D9B1'},
 stationCharacter:{fontSize:18,fontWeight:'900',color:'#FFF0C6'},
 stationRegion:{fontSize:10,color:'#C6DDCA'},
 stationGame:{fontSize:11,lineHeight:15,color:'#FFFFFF',fontWeight:'800',minHeight:30},
 stationBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 stationStatus:{color:'#A9D9B3',fontSize:9,fontWeight:'900'},
 kingdomAdFooter:{width:'100%',marginTop:6,alignSelf:'stretch'},
 vistaCaption:{position:'absolute',left:12,right:10,bottom:10},
 vistaEyebrow:{color:'#C8E8D7',fontSize:9,fontWeight:'900',letterSpacing:1.2},
 vistaTitle:{color:'#FFF7DE',fontSize:15,lineHeight:19,fontWeight:'900',marginTop:2},
 header:{borderRadius:18,minHeight:110,overflow:'hidden',flexDirection:'row',alignItems:'center',paddingHorizontal:17,
  borderWidth:1,borderColor:'#7D947C'},
 headerText:{flex:1,zIndex:2,paddingVertical:15},
 kicker:{color:'#FFE5AA',fontSize:9,fontWeight:'900',letterSpacing:1.5},
 headerTitle:{color:'#FFF7E4',fontSize:24,fontWeight:'900',marginTop:5},
 headerSubtitle:{color:'#D4E8E5',fontSize:11,lineHeight:17,marginTop:5,marginRight:7},
 illustration:{borderRadius:22,overflow:'hidden',backgroundColor:'#061328',borderWidth:1,borderColor:'#AD9062'},
 heroArt:{position:'absolute',top:6,right:'2%',bottom:39,width:'47%',alignItems:'center',justifyContent:'center'},
 heroCopy:{position:'absolute',left:17,bottom:26,right:'42%',zIndex:2},
 realmName:{fontSize:9,fontWeight:'900',color:'#D8E8B9',letterSpacing:1.1},
 realmTitle:{color:'#FFEFBE',fontWeight:'900',fontSize:23,lineHeight:26,marginTop:5},
 realmCaption:{color:'#E5EAF0',fontSize:11,lineHeight:17,marginTop:5},
 enter:{position:'absolute',right:12,bottom:13,backgroundColor:'#E7C987',paddingHorizontal:12,paddingVertical:11,
  borderRadius:11,minHeight:44,flexDirection:'row',alignItems:'center',gap:5,zIndex:3},
 enterLabel:{color:'#10291E',fontSize:10,fontWeight:'900',letterSpacing:.5},
 actions:{gap:8},
 soundAction:{minHeight:56,borderColor:'#577A92',backgroundColor:'#102038'},
 action:{backgroundColor:'#0E2637',borderRadius:13,borderWidth:1,borderColor:'#C2A775',
  padding:12,flexDirection:'row',alignItems:'center',gap:10,minHeight:70},
 actionTitle:{color:'#F9F1E1',fontWeight:'900',fontSize:14},
 actionSub:{color:'#C5D6D4',fontSize:10,lineHeight:15,marginTop:3},
 sectionTitle:{color:'#EED9A4',fontSize:12,fontWeight:'900',letterSpacing:1.1,marginTop:8},
 realms:{flexDirection:'row',flexWrap:'wrap',gap:8},
 realmButton:{width:'48.5%',minHeight:67,borderWidth:1,borderColor:'#3D6774',borderRadius:12,
  backgroundColor:'#0D2639',padding:10,justifyContent:'center'},
 realmSelected:{borderColor:'#E7C987',backgroundColor:'#1A3B42'},
 realmButtonName:{color:'#D0E1E1',fontSize:14,fontWeight:'900'},
 realmSelectedText:{color:'#FFE6A3'},
 realmButtonSub:{color:'#ADC3CD',fontSize:10,marginTop:4},
 disclaimer:{fontSize:10,lineHeight:17,color:'#ACC3BF',paddingVertical:8},
});
