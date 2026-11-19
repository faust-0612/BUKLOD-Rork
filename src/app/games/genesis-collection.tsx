/** Season 2 Genesis: real individually cropped item sprite cells, character art and rank gallery.
 * This is an artwork preview only, never an ownership / eligibility / payout surface. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import BuklodCollectibleArt from '@/components/points/BuklodCollectibleArt';
import BuklodCircleRankBadge from '@/components/points/BuklodCircleRankBadge';
import { BUKLOD_ART_CHARACTER_IDS } from '@/lib/buklodCollectibleArtwork';
import { CORE_ATLAS_ART, CORE_ATLAS_CELL } from '@/lib/buklodKingdomCoreAtlasArt';
import { CLASS_ART } from '@/lib/buklodKingdomClassArt';
import { VISUAL_CLASSES, getVisualClassItems } from '@/lib/buklodKingdomClassCatalog';
import { KINGDOM_CORE_CLASSES, coreAtlasItem } from '@/lib/buklodKingdomCoreAtlas';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import GenesisCosmicSky from '@/features/season2/genesis/GenesisCosmicSky';
import { useGenesisMotionAllowed } from '@/features/season2/genesis/GenesisVisuals';

const COLORS = { gold:'#E9CB8F', pearl:'#FFF3DB', mint:'#B5E6D0', muted:'#C1CDD7' };
const TIERS = ['Starter','Active','Steady','Builder','Impact','Vanguard','Prime','Prime Elite'] as const;
const ROMAN = ['V','IV','III','II','I'] as const;
type Shelf = 'items'|'classics'|'characters'|'badges';
const CLASSICS = VISUAL_CLASSES.filter(c => c.status === 'art_supplied');

function CroppedItem({ classId, index, width = 132 }: { classId: string; index: number; width?: number }) {
  const sheet = CORE_ATLAS_ART[classId];
  const height = Math.round(width * CORE_ATLAS_CELL.height / CORE_ATLAS_CELL.width);
  if (!sheet || !Number.isInteger(index) || index < 0 || index > 5) return null;
  return <View accessible accessibilityRole="image" accessibilityLabel={classId+' item '+(index+1)}
    style={{ width, height, overflow:'hidden', borderRadius:9 }}>
    <Image source={sheet} resizeMode="stretch" fadeDuration={0}
      style={{ position:'absolute', width:width*3, height:height*2,
        left:-(index%3)*width, top:-Math.floor(index/3)*height }}/>
  </View>;
}

function GenesisCollectionContent() {
  const [focused,setFocused] = useState(false);
  const motionAllowed = useGenesisMotionAllowed(focused);
  const [shelf,setShelf] = useState<Shelf>('items');
  const [classicId,setClassicId] = useState('light');
  const [classicIndex,setClassicIndex] = useState(0);
  const [classId,setClassId] = useState(KINGDOM_CORE_CLASSES[0].id);
  const [selectedItem,setSelectedItem] = useState(0);
  const [character,setCharacter] = useState<(typeof BUKLOD_ART_CHARACTER_IDS)[number]>(BUKLOD_ART_CHARACTER_IDS[0]);
  const [level,setLevel] = useState(1);
  const [badgeTier,setBadgeTier] = useState<(typeof TIERS)[number]>(TIERS[0]);
  const [badgeLevel,setBadgeLevel] = useState<(typeof ROMAN)[number]>(ROMAN[0]);
  const bob = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    bob.stopAnimation(); bob.setValue(0);
    if (!motionAllowed) return;
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(bob,{toValue:1,duration:2450,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
      Animated.timing(bob,{toValue:0,duration:2450,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
    ]));
    loop.start();
    return()=>loop.stop();
  }, [motionAllowed,bob]);

  const group=KINGDOM_CORE_CLASSES.find(c=>c.id===classId) ?? KINGDOM_CORE_CLASSES[0];
  const selected=coreAtlasItem(group.id,selectedItem);
  const classicGroup=CLASSICS.find(c=>c.id===classicId)??CLASSICS[0];
  const classicItems=getVisualClassItems(classicGroup.id);
  const classicSelected=classicItems[classicIndex];
  const rankName='Circle '+badgeTier+' '+badgeLevel;
  const stageArt=shelf==='items'
    ? <CroppedItem classId={group.id} index={selectedItem} width={172}/>
    : shelf==='classics'
      ? (CLASS_ART[classicId]?.[classicIndex]
        ? <Image source={CLASS_ART[classicId][classicIndex]} resizeMode="contain" style={{width:176,height:165}}/>
        : null)
      : shelf==='characters'
        ? <BuklodCollectibleArt characterId={character} level={level} itemIndex={selectedItem+1} size={112} />
        : <BuklodCircleRankBadge rankName={rankName} size={135}/>;

  return <View style={s.root}>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.header}>
        <GenesisCosmicSky active={focused}/>
        <Pressable accessibilityRole="button" onPress={()=>router.back()} style={s.back}
          accessibilityLabel="Back to Kingdom"><MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.gold}/></Pressable>
        <View style={{flex:1}}>
          <Text style={s.eyebrow}>SEASON 2 · GENESIS</Text>
          <Text style={s.heading}>The Collection Vault</Text>
          <Text style={s.subtitle}>Individually cropped artwork. Living light. Real BUKLOD characters.</Text>
        </View>
      </View>
      <View style={s.tabs}>
        {([['items','ITEMS · 120'],['classics','CLASSICS · 42'],['characters','CHARACTERS'],['badges','BADGES']] as const).map(([key,label]) =>
          <Pressable accessibilityRole="button" accessibilityState={{selected:key===shelf}}
            key={key} onPress={()=>{setShelf(key);setSelectedItem(0);setClassicIndex(0)}} style={[s.tab,key===shelf&&s.tabSelected]}>
            <Text style={[s.tabLabel,key===shelf&&s.tabTextSelected]}>{label}</Text>
          </Pressable>)}
      </View>
      <View style={s.stage}>
        <GenesisCosmicSky active={focused}/>
        <LinearGradient colors={['rgba(0,0,0,0)','rgba(5,12,27,.22)','rgba(3,10,22,.68)']} style={StyleSheet.absoluteFill}/>
        <View pointerEvents="none" style={s.beamTop}/>
        <View pointerEvents="none" style={s.beamBottom}/>
        <Animated.View style={[s.object,{transform:[
          {translateY:bob.interpolate({inputRange:[0,1],outputRange:[3,-6]})},
          {scale:bob.interpolate({inputRange:[0,1],outputRange:[1,1.022]})},
        ]}]}>
          {stageArt}
        </Animated.View>
        <Text style={s.stageCaption}>{shelf==='items'?selected.name:shelf==='classics'?(classicSelected?.name??classicGroup.title):shelf==='characters'?
          character.toUpperCase()+' · LEVEL '+level+' · ITEM '+(selectedItem+1):rankName.toUpperCase()}</Text>
      </View>

      {shelf==='items' ? <>
        <Text style={s.section}>CHOOSE AN ITEM CLASS</Text>
        <View style={s.chips}>
          {KINGDOM_CORE_CLASSES.map(c=><Pressable key={c.id} accessibilityRole="button"
            accessibilityState={{selected:classId===c.id}} onPress={()=>{setClassId(c.id);setSelectedItem(0)}}
            style={[s.chip,classId===c.id&&s.activeChip]}>
            <Text style={[s.chipText,classId===c.id&&s.activeChipText]}>{c.displayName.replace(' Class','')}</Text>
          </Pressable>)}
        </View>
        <Text style={s.section}>SIX SEPARATE ITEMS · {group.displayName.toUpperCase()}</Text>
        <View style={s.grid}>
          {group.items.map((name,i)=><Pressable key={name} accessibilityRole="button"
            accessibilityState={{selected:selectedItem===i}} onPress={()=>setSelectedItem(i)}
            style={[s.itemCard,selectedItem===i&&s.itemActive]}>
            <CroppedItem classId={group.id} index={i} width={113}/>
            <Text numberOfLines={2} style={s.itemName}>{name}</Text>
          </Pressable>)}
        </View>
        <View style={s.info}>
          <Text style={s.infoKey}>TARGET REQUIREMENT · NOT ACTIVE</Text>
          <Text style={s.infoText}>{selected.requirement}</Text>
          <Text style={s.infoKey}>PLANNED USE</Text>
          <Text style={s.infoText}>{selected.usage}</Text>
          <Text style={s.notice}>Artwork does not confer ownership. These items are not claimable or tradeable from this gallery.</Text>
        </View>
      </> : shelf==='classics' ? <>
        <Text style={s.section}>SEVEN CLASSIC COLLECTIONS · 42 INDIVIDUAL CUTS</Text>
        <View style={s.chips}>
          {CLASSICS.map(c=><Pressable key={c.id} accessibilityRole="button"
            accessibilityState={{selected:classicId===c.id}}
            onPress={()=>{setClassicId(c.id);setClassicIndex(0)}}
            style={[s.chip,classicId===c.id&&s.activeChip]}>
            <Text style={[s.chipText,classicId===c.id&&s.activeChipText]}>{c.title.replace(' Class','')}</Text>
          </Pressable>)}
        </View>
        <View style={s.grid}>
          {classicItems.map((item,i)=><Pressable key={item.id} accessibilityRole="button"
            accessibilityState={{selected:classicIndex===i}} onPress={()=>setClassicIndex(i)}
            style={[s.itemCard,classicIndex===i&&s.itemActive]}>
            {CLASS_ART[classicId]?.[i] ? <Image source={CLASS_ART[classicId][i]} resizeMode="contain"
              style={{width:113,height:101}}/>:null}
            <Text style={s.itemName}>{item.name}</Text>
          </Pressable>)}
        </View>
        {classicSelected ? <View style={s.info}>
          <Text style={s.infoKey}>REFERENCE REQUIREMENT</Text><Text style={s.infoText}>{classicSelected.requirement}</Text>
          <Text style={s.infoKey}>PLANNED USE</Text><Text style={s.infoText}>{classicSelected.usage}</Text>
          <Text style={s.notice}>Classic art is a separated visual reference, not an earned or tradeable inventory item.</Text>
        </View> : null}
      </> : shelf==='characters' ? <>
        <Text style={s.section}>CHARACTER ART · 13 WORLDS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontal}>
          {BUKLOD_ART_CHARACTER_IDS.map(id=><Pressable key={id} accessibilityRole="button" onPress={()=>{setCharacter(id);setLevel(1);setSelectedItem(0)}}
            accessibilityState={{selected:character===id}} style={[s.heroChip,character===id&&s.activeChip]}>
            <Text style={[s.chipText,character===id&&s.activeChipText]}>{id.toUpperCase()}</Text>
          </Pressable>)}
        </ScrollView>
        <Text style={s.section}>CHOOSE ART LEVEL · 1–20</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontal}>
          {Array.from({length:20},(_,i)=>i+1).map(n=><Pressable key={n} accessibilityRole="button" onPress={()=>{setLevel(n);setSelectedItem(0)}}
            accessibilityState={{selected:level===n}} style={[s.number,level===n&&s.activeChip]}>
            <Text style={[s.chipText,level===n&&s.activeChipText]}>{n}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={s.characterGrid}>
          {Array.from({length:5},(_,i)=><Pressable key={i} accessibilityRole="button" onPress={()=>setSelectedItem(i)}
            accessibilityState={{selected:selectedItem===i}} style={[s.characterItem,selectedItem===i&&s.itemActive]}>
            <BuklodCollectibleArt characterId={character} level={level} itemIndex={i+1} size={94}/>
            <Text style={s.itemName}>ITEM {i+1}</Text>
          </Pressable>)}
        </View>
        <Text style={s.notice}>Character reference artwork is rendered near its original resolution for clarity. Unlocks, owned items and equipped gear are verified only in the official Character interface.</Text>
      </> : <>
        <Text style={s.section}>CIRCLE RANK FAMILIES · 8</Text>
        <View style={s.chips}>
          {TIERS.map(t=><Pressable key={t} accessibilityRole="button" onPress={()=>setBadgeTier(t)}
            accessibilityState={{selected:t===badgeTier}} style={[s.chip,t===badgeTier&&s.activeChip]}>
            <Text style={[s.chipText,t===badgeTier&&s.activeChipText]}>{t}</Text>
          </Pressable>)}
        </View>
        <Text style={s.section}>FIVE RANK GRADES</Text>
        <View style={s.badges}>
          {ROMAN.map(level=><Pressable key={level} accessibilityRole="button" onPress={()=>setBadgeLevel(level)}
            accessibilityState={{selected:level===badgeLevel}} style={[s.badgeItem,level===badgeLevel&&s.itemActive]}>
            <BuklodCircleRankBadge rankName={'Circle '+badgeTier+' '+level} size={56}/>
            <Text style={s.itemName}>{level}</Text>
          </Pressable>)}
        </View>
        <Text style={s.notice}>Current scalable emblem rendering is a visual reference, not proof of a newly cropped approved artwork sheet. Official rank and tier are server-owned.</Text>
      </>}
    </ScrollView>
  </View>;
}

export default function GenesisCollectionScreen() {
  if (!isGenesisPreviewBuild()) return <Redirect href="/games"/>;
  return <GenesisCollectionContent/>;
}

const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#040E1D'},
 content:{padding:12,paddingBottom:30,maxWidth:790,width:'100%',alignSelf:'center',gap:11},
 header:{flexDirection:'row',alignItems:'center',gap:10,padding:12,overflow:'hidden',
  borderRadius:15,borderWidth:1,borderColor:'#978361',minHeight:92,backgroundColor:'#0C2231'},
 back:{width:43,height:43,borderWidth:1,borderColor:COLORS.gold,borderRadius:12,alignItems:'center',justifyContent:'center',zIndex:1},
 eyebrow:{fontSize:9,letterSpacing:1.3,fontWeight:'900',color:COLORS.gold},
 heading:{fontSize:22,fontWeight:'900',color:COLORS.pearl,marginTop:3},
 subtitle:{fontSize:10,color:COLORS.muted,marginTop:3},
 tabs:{flexDirection:'row',gap:6},
 tab:{flex:1,backgroundColor:'#102A3B',borderWidth:1,borderColor:'#44647C',minHeight:42,
  borderRadius:9,alignItems:'center',justifyContent:'center',paddingHorizontal:3},
 tabSelected:{backgroundColor:'#E4C887',borderColor:'#E4C887'},
 tabLabel:{color:COLORS.pearl,fontSize:9,fontWeight:'900',textAlign:'center'},
 tabTextSelected:{color:'#102823'},
 stage:{height:259,backgroundColor:'#040F20',borderColor:'#A79572',borderWidth:1,borderRadius:18,
  overflow:'hidden',alignItems:'center',justifyContent:'center'},
 beamTop:{position:'absolute',top:8,left:14,right:14,borderTopWidth:1,borderColor:'rgba(232,214,165,.6)'},
 beamBottom:{position:'absolute',bottom:8,left:14,right:14,borderBottomWidth:1,borderColor:'rgba(232,214,165,.3)'},
 object:{alignItems:'center',justifyContent:'center',minHeight:188},
 stageCaption:{position:'absolute',bottom:16,color:COLORS.gold,fontWeight:'900',fontSize:11,letterSpacing:.9,textAlign:'center'},
 section:{fontSize:12,fontWeight:'900',letterSpacing:.7,color:COLORS.gold,marginTop:8},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
 chip:{borderWidth:1,borderColor:'#4C657A',backgroundColor:'#0E2B3B',borderRadius:9,
  padding:9,minHeight:39,minWidth:74,alignItems:'center',justifyContent:'center'},
 activeChip:{backgroundColor:'#E9D29D',borderColor:'#FFE5B6'},
 chipText:{color:'#DBE7E4',fontSize:10,fontWeight:'800',textAlign:'center'},
 activeChipText:{color:'#153127'},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between'},
 itemCard:{width:'48.5%',alignItems:'center',backgroundColor:'#0F2936',padding:7,
  borderRadius:12,borderWidth:1,borderColor:'#375A68',gap:6,minHeight:139},
 itemActive:{borderColor:COLORS.gold,backgroundColor:'#1E3840'},
 itemName:{color:COLORS.pearl,fontSize:11,fontWeight:'900',textAlign:'center',lineHeight:15},
 info:{backgroundColor:'#102838',borderRadius:13,padding:13,gap:8,borderWidth:1,borderColor:'#52656C'},
 infoKey:{color:COLORS.gold,fontSize:10,fontWeight:'900',letterSpacing:.5},
 infoText:{color:'#D9E7EA',fontSize:12,lineHeight:18},
 notice:{color:'#B4C9D2',fontSize:10,lineHeight:17,marginTop:8},
 horizontal:{gap:7,paddingVertical:4},
 heroChip:{paddingHorizontal:11,paddingVertical:10,borderRadius:9,backgroundColor:'#0D293A',borderWidth:1,borderColor:'#476A7B'},
 number:{width:36,height:36,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'#103349',borderWidth:1,borderColor:'#42647C'},
 characterGrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:5},
 characterItem:{width:'31.5%',borderWidth:1,borderColor:'#45687B',borderRadius:10,alignItems:'center',
  padding:5,backgroundColor:'#0E2938'},
 badges:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:5},
 badgeItem:{width:'19%',alignItems:'center',gap:5,backgroundColor:'#0F2938',borderWidth:1,
  borderColor:'#426477',padding:5,borderRadius:9},
});
