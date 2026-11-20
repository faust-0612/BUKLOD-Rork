import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo, Animated, AppState, Easing, ImageBackground,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {router, useFocusEffect} from 'expo-router';
import {useAudioPlayer} from 'expo-audio';
import Svg, {Circle, Defs, Ellipse, Path, RadialGradient, Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BuklodFirstViewAd from '@/components/BuklodFirstViewAd';
import BuklodNativeSponsoredCard from '@/components/BuklodNativeSponsoredCard';
import BuklodScreenBottomBanner from '@/components/BuklodScreenBottomBanner';
import BuklodCommunitySponsoredAd from '@/components/BuklodCommunitySponsoredAd';
import {BuklodSystemAnnouncementBoard} from '@/components/BuklodSystemAnnouncementBoard';
import {GENESIS_GALAXY_IMAGES} from '@/features/season2/genesis/genesisGalleryAssets';
import {GENESIS_IDENTITY} from '@/features/season2/genesis/genesisContract';
import {requestBuklodAudioFocus, subscribeBuklodAudioFocus} from '@/lib/buklodAudioFocus';
import {
  WORLD_COMPLETE_DESTINATION_DIRECTORY, worldDestinationById,
  type WorldDestination,
} from '@/features/world/worldCatalog';

/**
 * Season 2 entry only, gated at /(tabs)/hub.
 * Galaxy art is the existing authorized BUKLOD source-controlled fallback.
 * The owner's richer valley image is provided in the V2 asset handoff and
 * MUST be integrated as an approved source-controlled native image before RC.
 * World preview items never claim a persisted property or a working BP checkout.
 */
const LANDMARKS = [
  {id:'cluster',x:7,y:12,name:'Community Village'},
  {id:'wall',x:39,y:12,name:'Public Square'},
  {id:'connect',x:71,y:12,name:'Connect Harbor'},
  {id:'faith',x:7,y:35,name:'Faith Gardens'},
  {id:'learning',x:39,y:35,name:'Learning Hall'},
  {id:'kingdom',x:71,y:35,name:'Kingdom Arena'},
  {id:'myworld',x:7,y:58,name:'Personal Estate'},
  {id:'market',x:39,y:58,name:'Market Street'},
  {id:'government',x:71,y:58,name:'Government Hall'},
  {id:'health',x:7,y:81,name:'Health Center'},
  {id:'family',x:39,y:81,name:'Family Home'},
  {id:'profile',x:71,y:81,name:'My BUKLOD'},
] as const;
type MapIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const asIcon=(value:string)=>value as MapIcon;
const AUDIO_OWNER='genesis-world-map';

function WorldMusic({enabled,focused,foreground}:{
  enabled:boolean;focused:boolean;foreground:boolean;
}) {
  const player=useAudioPlayer(require('../../../assets/sounds/kingdom-premium/kingdom-village.ogg'));
  const [suspended,setSuspended]=useState(false);
  useEffect(()=>subscribeBuklodAudioFocus(owner=>{
    if(owner!==AUDIO_OWNER){
      player.pause();
      setSuspended(true);
    }
  }),[player]);
  useEffect(()=>{
    // Local and user-initiated only; never play over a call/video/other media.
    if(!enabled||!focused||!foreground||suspended){
      player.pause();
      return;
    }
    requestBuklodAudioFocus(AUDIO_OWNER);
    player.loop=true;
    player.volume=0.28;
    player.play();
    return ()=>player.pause();
  },[enabled,focused,foreground,suspended,player]);
  useEffect(()=>{if(!enabled)setSuspended(false);},[enabled]);
  return null;
}

function WorldCanvas({active,onOpen,onPreview}:{
  active:boolean;
  onOpen:(entry:WorldDestination)=>void;
  onPreview:(entry:WorldDestination)=>void;
}) {
  const {width}=useWindowDimensions();
  const compact=width<350;
  const drift=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    drift.stopAnimation();
    if(!active){drift.setValue(0);return;}
    const cycle=Animated.loop(Animated.sequence([
      Animated.timing(drift,{toValue:1,duration:7200,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(drift,{toValue:0,duration:7200,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ]));
    cycle.start();
    return ()=>cycle.stop();
  },[active,drift]);

  return <View style={styles.mapFrame} accessibilityLabel="BUKLOD Genesis World interactive district map">
    <ImageBackground source={GENESIS_GALAXY_IMAGES.creation} resizeMode="cover"
      style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['rgba(6,11,28,0.42)','rgba(9,21,48,0.08)','rgba(5,11,29,0.68)']}
        style={StyleSheet.absoluteFill}/>
    </ImageBackground>
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 360 510"
      preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="bloom"><Stop offset="0" stopColor="#E4FFFF" stopOpacity="0.32"/>
          <Stop offset="1" stopColor="#4B7EA7" stopOpacity="0"/></RadialGradient>
      </Defs>
      <Ellipse cx="190" cy="245" rx="180" ry="238" fill="url(#bloom)"/>
      <Path d="M56 82 Q210 75 305 83 Q330 183 195 205 Q44 238 61 316 Q80 407 318 438"
        fill="none" stroke="#B2DFFF" strokeWidth="18" strokeOpacity="0.07"/>
      <Path d="M56 82 Q210 75 305 83 Q330 183 195 205 Q44 238 61 316 Q80 407 318 438"
        fill="none" stroke="#F0D7AE" strokeWidth="1.6" strokeDasharray="5,9" strokeOpacity="0.8"/>
      <Ellipse cx="187" cy="251" rx="166" ry="113" fill="none" stroke="#A9E5E7"
        strokeOpacity="0.24" strokeWidth="1.2" transform="rotate(-24 187 251)"/>
      <Ellipse cx="183" cy="247" rx="111" ry="192" fill="none" stroke="#F9D3A5"
        strokeOpacity="0.12" strokeWidth="1.2" transform="rotate(18 183 247)"/>
      {[{x:35,y:75},{x:180,y:180},{x:306,y:80},{x:210,y:310},{x:80,y:395},{x:310,y:435}].map((p,i)=>
        <Circle key={i} cx={p.x} cy={p.y} r={i%2?3:1.8} fill="#FFF2CA" opacity=".86"/>)}
    </Svg>
    <Animated.View pointerEvents="none" style={[styles.motionOrb,{
      opacity:drift.interpolate({inputRange:[0,1],outputRange:[0.17,0.34]}),
      transform:[{translateY:drift.interpolate({inputRange:[0,1],outputRange:[-14,13]})}],
    }]}/>
    <View style={styles.mapHeading} pointerEvents="none">
      <Text style={styles.mapTitle}>THE LIVING WORLD</Text>
      <Text style={styles.mapSub}>Choose a place to explore</Text>
    </View>
    {LANDMARKS.map(spot=>{
      const dest=worldDestinationById(spot.id);
      if(!dest)return null;
      return <Pressable key={spot.id} accessibilityRole="button"
        accessibilityLabel={spot.name+(dest.state==='preview'?', coming soon':'')}
        accessibilityHint={dest.state==='preview'?'See the planned experience':'Open the existing BUKLOD service'}
        onPress={()=>dest.state==='preview'?onPreview(dest):onOpen(dest)}
        style={({pressed})=>[styles.landmark,{
          left:(spot.x+'%') as any,top:(spot.y+'%') as any,
          width:compact?82:94,opacity:pressed?0.73:1,
          borderColor:dest.state==='preview'?'rgba(239,205,145,0.77)':'rgba(195,231,240,0.73)',
          backgroundColor:pressed?'rgba(51,88,115,0.98)':'rgba(7,21,42,0.89)',
        }]}>
        <MaterialCommunityIcons name={asIcon(dest.icon)} size={compact?20:23} color="#F5DFAF"/>
        <Text style={styles.landmarkText} numberOfLines={2}>{spot.name}</Text>
        {dest.state==='preview'?<Text style={styles.previewWord}>Preview</Text>:null}
      </Pressable>;
    })}
    <View style={styles.mapBottom} pointerEvents="none">
      <MaterialCommunityIcons name="compass-rose" color="#F7E1A9" size={18}/>
      <Text style={styles.mapBottomText}>One world · One community · Every path connected</Text>
    </View>
  </View>;
}

export default function BuklodGenesisWorldHome(){
  const [focused,setFocused]=useState(false);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const [reducedMotion,setReducedMotion]=useState(false);
  const [musicEnabled,setMusicEnabled]=useState(false);
  const [showDirectory,setShowDirectory]=useState(false);
  const [search,setSearch]=useState('');
  const [preview,setPreview]=useState<WorldDestination|null>(null);
  const insets=useSafeAreaInsets();

  useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
  useEffect(()=>{
    const sub=AppState.addEventListener('change',s=>setForeground(s==='active'));
    let current=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(current)setReducedMotion(v);}).catch(()=>{});
    const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducedMotion);
    return ()=>{current=false;sub.remove();motion.remove();};
  },[]);

  const directory=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase();
    return WORLD_COMPLETE_DESTINATION_DIRECTORY.filter(d=>
      !q||[d.label,d.description,d.district].some(v=>v.toLocaleLowerCase().includes(q))
    );
  },[search]);

  const open=useCallback((item:WorldDestination)=>{
    if(item.state!=='available'||!item.route){
      setPreview(item);return;
    }
    setPreview(null);
    router.push(item.route as any);
  },[]);
  const active=focused&&foreground&&!reducedMotion;
  return <View style={styles.page}>
    <WorldMusic enabled={musicEnabled} focused={focused} foreground={foreground}/>
    <ScrollView style={styles.scroll} contentContainerStyle={[
      styles.scrollContent,{paddingTop:Math.max(insets.top,10)+6,paddingBottom:Math.max(insets.bottom,12)+24}
    ]} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <View style={{flex:1,minWidth:0}}>
          <Text style={styles.kicker}>BUKLOD · SEASON TWO</Text>
          <Text style={styles.title}>{GENESIS_IDENTITY.title}</Text>
          <Text style={styles.caption}>A welcoming world to connect, contribute and grow.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={musicEnabled?'Mute World soundtrack':'Play World soundtrack'}
          accessibilityState={{checked:musicEnabled}}
          onPress={()=>setMusicEnabled(v=>!v)} style={styles.musicButton}>
          <MaterialCommunityIcons name={musicEnabled?'music-note':'music-note-off'} color="#F3D399" size={24}/>
          <Text style={styles.musicText}>{musicEnabled?'Music on':'Music off'}</Text>
        </Pressable>
      </View>
      <BuklodFirstViewAd placement="home" placementId="new_home_first_view"/>
      <WorldCanvas active={active} onOpen={open} onPreview={setPreview}/>
      <BuklodSystemAnnouncementBoard slot="public_home"/>
      <View style={styles.findRow}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded:showDirectory}}
          accessibilityLabel="Explore all BUKLOD World locations"
          onPress={()=>setShowDirectory(v=>!v)} style={styles.directoryToggle}>
          <MaterialCommunityIcons name="map-search" size={21} color="#F4DFAE"/>
          <Text style={styles.directoryText}>{showDirectory?'Close World directory':'Search all places and features'}</Text>
          <MaterialCommunityIcons name={showDirectory?'chevron-up':'chevron-down'} size={22} color="#F4DFAE"/>
        </Pressable>
      </View>
      {preview?<View style={styles.previewPanel} accessibilityLiveRegion="polite">
        <Text style={styles.previewTitle}>{preview.label} · Planned feature</Text>
        <Text style={styles.previewDescription}>{preview.description} No wallet, land ownership or purchases are active in this preview.</Text>
        <Pressable accessibilityRole="button" onPress={()=>setPreview(null)}
          accessibilityLabel="Close feature preview">
          <Text style={styles.previewClose}>Close preview</Text>
        </Pressable>
      </View>:null}
      {showDirectory?<View style={styles.directoryPanel}>
        <TextInput accessibilityLabel="Search BUKLOD World"
          value={search} onChangeText={setSearch} placeholder="Search places and features"
          placeholderTextColor="#A6B5C7" style={styles.searchInput} returnKeyType="search"/>
        {directory.map(item=><Pressable key={item.id} accessibilityRole="button"
          onPress={()=>open(item)}
          accessibilityLabel={item.label+(item.state==='preview'?', planned':'')}
          style={styles.directoryLine}>
          <MaterialCommunityIcons name={asIcon(item.icon)} size={21} color="#F4DFAE"/>
          <View style={{flex:1,minWidth:0}}>
            <Text style={styles.directoryLineTitle}>{item.label}</Text>
            <Text numberOfLines={2} style={styles.directoryLineDescription}>{item.description}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" color="#B8D5E6" size={21}/>
        </Pressable>)}
        {!directory.length?<Text style={styles.directoryLineDescription}>No matching destination.</Text>:null}
      </View>:null}
      <BuklodCommunitySponsoredAd audience="public" placement="home"/>
      <BuklodNativeSponsoredCard surface="home" slotId="hub_mid_native"/>
      <BuklodScreenBottomBanner placement="home" variant="large"/>
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#050A19'},
  scroll:{flex:1},
  scrollContent:{paddingHorizontal:8,gap:9},
  intro:{paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:10,minHeight:76},
  kicker:{color:'#F2D6A6',fontSize:10,fontWeight:'900',letterSpacing:2},
  title:{color:'#F9F6ED',fontSize:22,fontWeight:'900',lineHeight:27},
  caption:{color:'#C0D4E5',fontSize:11,marginTop:3},
  musicButton:{width:78,minHeight:58,alignItems:'center',justifyContent:'center',
    backgroundColor:'rgba(15,31,57,0.96)',borderWidth:1,borderColor:'rgba(243,211,153,0.35)',
    borderRadius:14,gap:3},
  musicText:{color:'#F0E8D8',fontSize:10,fontWeight:'700'},
  mapFrame:{height:510,overflow:'hidden',borderRadius:17,borderWidth:1,
    borderColor:'rgba(242,218,164,0.56)',backgroundColor:'#0A1730',elevation:3},
  motionOrb:{position:'absolute',left:'22%',top:'30%',width:250,height:250,
    borderRadius:125,backgroundColor:'#72B7DE'},
  mapHeading:{position:'absolute',left:14,top:10},
  mapTitle:{color:'#FFF3D9',fontWeight:'900',fontSize:12,letterSpacing:1.8},
  mapSub:{color:'#D2E6F3',fontSize:10,marginTop:2},
  landmark:{position:'absolute',minHeight:62,alignItems:'center',justifyContent:'center',
    borderWidth:1,borderRadius:12,paddingHorizontal:3,paddingVertical:5,
    shadowColor:'#000000',shadowOpacity:0.38,shadowRadius:5,elevation:4},
  landmarkText:{fontSize:10,color:'#F7F8FC',fontWeight:'800',textAlign:'center',marginTop:2},
  previewWord:{fontSize:8,color:'#F2C882'},
  mapBottom:{position:'absolute',bottom:8,alignSelf:'center',flexDirection:'row',alignItems:'center',
    gap:6,backgroundColor:'rgba(6,15,31,0.88)',paddingHorizontal:9,paddingVertical:5,borderRadius:13},
  mapBottomText:{fontSize:9,color:'#E6F0FA',fontWeight:'600'},
  findRow:{marginHorizontal:4},
  directoryToggle:{minHeight:50,borderRadius:12,borderWidth:1,borderColor:'rgba(240,214,165,0.4)',
    backgroundColor:'rgba(15,34,62,0.97)',flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12},
  directoryText:{flex:1,color:'#E7F2FF',fontSize:13,fontWeight:'800'},
  directoryPanel:{padding:10,backgroundColor:'#0C1930',borderRadius:14,gap:4},
  searchInput:{minHeight:44,color:'#FFFFFF',backgroundColor:'#182843',borderRadius:9,
    paddingHorizontal:12,fontSize:14,marginBottom:6},
  directoryLine:{paddingVertical:9,flexDirection:'row',alignItems:'center',gap:11,
    borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#39516E',minHeight:53},
  directoryLineTitle:{color:'#F7F7FB',fontWeight:'800',fontSize:13},
  directoryLineDescription:{color:'#C3D3E3',fontSize:11,marginTop:2},
  previewPanel:{borderRadius:13,padding:13,gap:7,backgroundColor:'#1E2B43',
    borderColor:'#E1C48E',borderWidth:1},
  previewTitle:{color:'#FFF1D0',fontWeight:'900',fontSize:14},
  previewDescription:{color:'#E4E7EF',fontSize:12},
  previewClose:{color:'#F3D399',fontSize:13,fontWeight:'900',paddingVertical:7},
});