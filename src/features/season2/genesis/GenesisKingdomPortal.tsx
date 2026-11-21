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
import { GenesisSeal } from './GenesisVisuals';
import { pulseGenesisTouch } from './genesisNativeFeedback';

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
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const { musicEnabled, toggleMusic } = useRorkGameAmbience('kingdom-map');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (current) setReduceMotion(Boolean(v)); }).catch(() => undefined);
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduceMotion(Boolean(v)));
    const b = AppState.addEventListener('change', s => setForeground(s === 'active'));
    return () => { current = false; a.remove(); b.remove(); };
  }, []);
  const animate = focused && foreground && !reduceMotion;
  const natureVista = getGenesisDeviceQuality('kingdom') === 'minimal' ? KINGDOM_NATURE_COMPACT : KINGDOM_NATURE_HIGH;
  const select = (realm: Realm) => {
    if (selected.id === realm.id) return;
    setSelected(realm);
    if (animate) void pulseGenesisTouch('selection');
  };
  const frameHeight = width > 640 ? 350 : 298;
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
          if (!realm) return null;
          return <Pressable
            key={landmark.id}
            accessibilityRole="button"
            accessibilityLabel={'Explore '+landmark.label+' with '+realm.name}
            accessibilityState={{selected:isSelected}}
            onPress={() => select(realm)}
            style={({pressed}) => [
              styles.landmark, {left:landmark.left, top:landmark.top},
              isSelected && styles.landmarkActive, pressed && styles.landmarkPressed,
            ]}
          >
            <MaterialCommunityIcons name={landmark.icon as any} size={16} color={isSelected ? '#FFF5CB' : '#DCEFE8'} />
          </Pressable>;
        })}
        <View pointerEvents="none" style={styles.vistaCaption}>
          <Text style={styles.vistaEyebrow}>THE LIVING KINGDOM</Text>
          <Text numberOfLines={2} style={styles.vistaTitle}>Tropical Valleys · Winter Peaks</Text>
        </View>
      </View>
      <View style={[styles.illustration,{height:frameHeight}]}>
        {/* Individual characters retain their original local models/art. Do not load remote
            preview-host backgrounds or substitute wallpaper for animated character rigs. */}
        <LinearGradient colors={['#13322D','#102C3D','#071623']} style={StyleSheet.absoluteFill}/>
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
      </View>
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
      <Text style={styles.sectionTitle}>DISCOVER 13 CHARACTER WORLDS</Text>
      <View style={styles.realms}>
        {GENESIS_REALMS.map(r => (
          <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={'Preview '+r.name+' realm'}
            accessibilityState={{selected:r.id===selected.id}} onPress={()=>select(r)}
            style={[styles.realmButton,r.id===selected.id&&styles.realmSelected]}>
            <Text style={[styles.realmButtonName,r.id===selected.id&&styles.realmSelectedText]}>{r.name}</Text>
            <Text numberOfLines={2} style={styles.realmButtonSub}>{r.title}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.disclaimer}>Scene preview only. Gameplay, badges, points and unlocks remain governed by existing verified Character and Kingdom rules. No free rewards are granted here.</Text>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:'#030D1E'},
 content:{width:'100%',maxWidth:850,alignSelf:'center',padding:12,paddingBottom:28,gap:12},
 kingdomVista:{width:'100%',aspectRatio:16/9,borderRadius:18,overflow:'hidden',
   borderWidth:1,borderColor:'#728B83',backgroundColor:'#0B2832'},
 landmark:{position:'absolute',width:38,height:38,marginLeft:-19,marginTop:-19,
   borderRadius:19,borderWidth:1.4,borderColor:'#C5D9CA',backgroundColor:'rgba(9,33,38,.82)',
   alignItems:'center',justifyContent:'center',elevation:2},
 landmarkActive:{borderColor:'#FFE6A4',backgroundColor:'rgba(28,61,57,.96)',elevation:4},
 landmarkPressed:{opacity:.78},
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
