import React, { useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import {
  loadBuklodKingdomPreviewProgress,
  subscribeBuklodKingdomPreviewProgress,
  type BuklodKingdomPreviewProgress,
} from './progress';

const WORLD_W = 1280;
const WORLD_H = 820;

type Station = {
  id: string;
  character: string;
  region: string;
  game: string;
  href: string;
  x: number;
  y: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  glow: string;
  worldChange: string;
};

const STATIONS: readonly Station[] = [
  { id:'phan-enterprise-builder', character:'Phan', region:'Farm / Enterprise', game:'Enterprise Builder', href:'/games/phan-enterprise-builder', x:120, y:585, icon:'barn', accent:'#e3c46a', glow:'#809d43', worldChange:'The farmstead grows into a working enterprise.' },
  { id:'vhen-farm-to-market', character:'Vhen', region:'Agricultural Valley', game:'Farm to Market', href:'/games/vhen-farm-to-market', x:275, y:675, icon:'sprout', accent:'#a5cf72', glow:'#648f48', worldChange:'Fields become greener and the market road activates.' },
  { id:'jawo-forest-trail', character:'Jawo', region:'Whispering Forest', game:'Forest Trail', href:'/games/jawo-forest-trail', x:170, y:315, icon:'pine-tree', accent:'#8ddcaf', glow:'#3f8c68', worldChange:'Trail lights awaken and the forest route glows.' },
  { id:'trudice-playground-memory', character:'Trudice', region:"Children's Haven", game:'Wonder Path', href:'/games/trudice-playground-memory', x:405, y:285, icon:'human-child', accent:'#f2a9d7', glow:'#9b5ab5', worldChange:'Playground stations light up one by one.' },
  { id:'mitch-restore-mural', character:'Mitch', region:'Art Village', game:'Restore the Mural', href:'/games/mitch-restore-mural', x:560, y:520, icon:'palette-outline', accent:'#efa17d', glow:'#a75868', worldChange:'The village mural returns and new colors appear.' },
  { id:'christian-civic-leadership', character:'Christian', region:'Civic Academy', game:'Leadership Council', href:'/games/christian-civic-leadership', x:665, y:235, icon:'bank-outline', accent:'#e3c978', glow:'#5c70a4', worldChange:'The council hall opens and civic lights activate.' },
  { id:'ace-rescue-grid', character:'Ace', region:'Strategy / Rescue District', game:'Rescue Grid', href:'/games/ace-rescue-grid', x:785, y:410, icon:'map-marker-path', accent:'#90d2f0', glow:'#4e7998', worldChange:'Blocked corridors clear and rescue beacons stay lit.' },
  { id:'van-living-city-dispatch', character:'Van', region:'Living City', game:'City Dispatch', href:'/games/van-living-city-dispatch', x:900, y:205, icon:'city-variant-outline', accent:'#93d4e1', glow:'#3c6982', worldChange:'The skyline activates and service routes begin moving.' },
  { id:'lhen-rhythm-journey', character:'Lhen', region:'Music City', game:'Rhythm Journey', href:'/games/lhen-rhythm-journey', x:1040, y:320, icon:'music-note', accent:'#e49bd7', glow:'#714b8a', worldChange:'Music lights pulse across the performance district.' },
  { id:'angel-kingdom-treasury', character:'Angel', region:'Treasury City', game:'Kingdom Treasury', href:'/games/angel-kingdom-treasury', x:955, y:585, icon:'treasure-chest-outline', accent:'#e8c365', glow:'#97672d', worldChange:'Treasury lanterns glow and reserve vaults open.' },
  { id:'niel-mission-trail', character:'Niel', region:'Mission Frontier', game:'Mission Trail', href:'/games/niel-mission-trail', x:680, y:690, icon:'compass-outline', accent:'#adc78a', glow:'#4f7455', worldChange:'A frontier road extends toward distant settlements.' },
  { id:'elesur-village-builder', character:'ELESUR', region:'Highland Community', game:'Village Builder', href:'/games/elesur-village-builder', x:1135, y:675, icon:'home-group', accent:'#b7d0c1', glow:'#58776f', worldChange:'New community structures rise in the highlands.' },
  { id:'quin-discovery-expedition', character:'Quin', region:'Discovery World', game:'Discovery Expedition', href:'/games/quin-discovery-expedition', x:1140, y:110, icon:'telescope', accent:'#b0bdff', glow:'#5366a1', worldChange:'Fog clears and a hidden route becomes visible.' },
] as const;

const FUTURE = [
  { x:345, y:105 },
  { x:515, y:125 },
  { x:820, y:105 },
  { x:1210, y:420 },
] as const;

const ROUTES = [
  'M 120 585 C 180 610 220 650 275 675',
  'M 120 585 C 105 450 125 365 170 315',
  'M 170 315 C 255 260 330 255 405 285',
  'M 405 285 C 470 360 520 445 560 520',
  'M 405 285 C 500 245 580 225 665 235',
  'M 665 235 C 720 290 755 345 785 410',
  'M 665 235 C 760 195 830 185 900 205',
  'M 900 205 C 960 240 1005 275 1040 320',
  'M 785 410 C 855 465 915 530 955 585',
  'M 560 520 C 610 600 645 660 680 690',
  'M 680 690 C 800 700 895 645 955 585',
  'M 955 585 C 1030 625 1090 660 1135 675',
  'M 1040 320 C 1100 245 1130 180 1140 110',
] as const;

function emptyProgress(): BuklodKingdomPreviewProgress {
  return { version: 1, stations: {} };
}

function StationNode({ station, progress }: { station: Station; progress: BuklodKingdomPreviewProgress }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const state = progress.stations[station.id];
  const cleared = (state?.clears ?? 0) > 0;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: cleared ? 1500 : 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: cleared ? 1500 : 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cleared, pulse]);

  const scale = pulse.interpolate({ inputRange:[0,1], outputRange:[1, cleared ? 1.08 : 1.035] });
  const opacity = pulse.interpolate({ inputRange:[0,1], outputRange:[0.18, cleared ? 0.52 : 0.32] });

  return (
    <View style={[styles.stationWrap, { left: station.x - 80, top: station.y - 66 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stationGlow,
          { backgroundColor: station.glow, opacity, transform:[{ scale }] },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${station.character} ${station.game}`}
        onPress={() => router.push(station.href as any)}
        style={({ pressed }) => [
          styles.stationCard,
          { borderColor: cleared ? '#f1cf70' : station.accent },
          pressed && styles.stationPressed,
        ]}
      >
        <LinearGradient
          colors={[`${station.glow}E8`, 'rgba(8,16,20,0.96)']}
          start={{x:0,y:0}}
          end={{x:1,y:1}}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.iconOrb,{borderColor:station.accent}]}> 
          <MaterialCommunityIcons name={station.icon} size={23} color="#fff" />
        </View>
        <View style={styles.stationBody}>
          <View style={styles.stationTopRow}>
            <Text style={[styles.stationCharacter,{color:station.accent}]}>{station.character}</Text>
            <MaterialCommunityIcons
              name={cleared ? 'star-circle' : 'play-circle-outline'}
              size={18}
              color={cleared ? '#f1cf70' : 'rgba(255,255,255,0.76)'}
            />
          </View>
          <Text numberOfLines={1} style={styles.stationRegion}>{station.region}</Text>
          <Text numberOfLines={1} style={styles.stationGame}>{station.game}</Text>
          <Text style={styles.stationState}>
            {cleared
              ? `CLEARED • ${state?.bestStars ?? 0}★ • ${(state?.bestScore ?? 0).toLocaleString()} BEST`
              : 'AVAILABLE • ENTER STATION'}
          </Text>
        </View>
      </Pressable>
      {cleared ? <Text style={styles.worldChange}>{station.worldChange}</Text> : null}
    </View>
  );
}

export default function BuklodKingdomMap() {
  const [progress, setProgress] = useState<BuklodKingdomPreviewProgress>(emptyProgress());

  useEffect(() => {
    let mounted = true;
    loadBuklodKingdomPreviewProgress().then((value) => {
      if (mounted) setProgress(value);
    }).catch(() => undefined);
    const unsubscribe = subscribeBuklodKingdomPreviewProgress((value) => {
      if (mounted) setProgress(value);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const clearedCount = STATIONS.filter((station) => (progress.stations[station.id]?.clears ?? 0) > 0).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.rootContent}>
      <LinearGradient colors={['#06110d','#102a22','#172a2c']} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.skyGlowA} />
      <View pointerEvents="none" style={styles.skyGlowB} />

      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons name="castle" size={18} color="#f0cf70" />
          <Text style={styles.heroBadgeText}>BUKLOD KINGDOM</Text>
        </View>
        <Text style={styles.heroTitle}>A Living World, Not a Game List</Text>
        <Text style={styles.heroCopy}>
          WORLD → REGION / BIOME → CHARACTER STATION → GAME. Clear missions to awaken stations and reveal visible changes. Future lands stay locked until later expansions.
        </Text>
        <View style={styles.heroStats}>
          <View style={styles.statPill}><Text style={styles.statValue}>{clearedCount}</Text><Text style={styles.statLabel}>CLEARED</Text></View>
          <View style={styles.statPill}><Text style={styles.statValue}>{STATIONS.length}</Text><Text style={styles.statLabel}>CURRENT STATIONS</Text></View>
          <View style={styles.statPill}><Text style={styles.statValue}>∞</Text><Text style={styles.statLabel}>FUTURE EXPANSION</Text></View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPad}>
        <View style={styles.worldFrame}>
          <LinearGradient
            colors={['#1c4735','#173540','#4c4427']}
            start={{x:0,y:0}}
            end={{x:1,y:1}}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.forestMass} />
          <View style={styles.cityMass} />
          <View style={styles.highlandMass} />
          <View style={styles.river} />
          <View style={styles.fogA} />
          <View style={styles.fogB} />

          <Svg width={WORLD_W} height={WORLD_H} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <SvgLinearGradient id="kingdomRoute" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#b5ddb7" stopOpacity="0.42" />
                <Stop offset="1" stopColor="#f0d377" stopOpacity="0.58" />
              </SvgLinearGradient>
            </Defs>
            {ROUTES.map((path,index) => (
              <Path
                key={index}
                d={path}
                fill="none"
                stroke="url(#kingdomRoute)"
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray="8 12"
              />
            ))}
          </Svg>

          {STATIONS.map((station) => (
            <StationNode key={station.id} station={station} progress={progress} />
          ))}

          {FUTURE.map((node,index) => (
            <View key={index} style={[styles.futureNode,{left:node.x-44,top:node.y-44}]}> 
              <View style={styles.futureRing}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#aeb7bd" />
                <Text style={styles.futureTitle}>???</Text>
                <Text style={styles.futureCopy}>COMING SOON</Text>
              </View>
            </View>
          ))}

          <View style={styles.citadel}>
            <View style={styles.citadelGlow} />
            <MaterialCommunityIcons name="castle" size={38} color="#f1d37b" />
            <Text style={styles.citadelTitle}>KINGDOM CITADEL</Text>
            <Text style={styles.citadelCopy}>Major hub • never the ending</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerCard}>
        <MaterialCommunityIcons name="map-marker-path" size={26} color="#efcf76" />
        <View style={{flex:1}}>
          <Text style={styles.footerTitle}>Expandable world architecture</Text>
          <Text style={styles.footerCopy}>
            Character Level 20 does not end BUKLOD Kingdom. New stations, secret routes, regions, seasonal maps, islands and later realms can extend this world without erasing existing progress.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#06110d'},
  rootContent:{minHeight:820,paddingTop:30,paddingBottom:44,overflow:'hidden'},
  skyGlowA:{position:'absolute',width:520,height:520,borderRadius:260,top:-310,right:-130,backgroundColor:'rgba(114,178,135,0.10)'},
  skyGlowB:{position:'absolute',width:420,height:420,borderRadius:210,bottom:-250,left:-130,backgroundColor:'rgba(210,167,81,0.08)'},
  hero:{width:'100%',maxWidth:1180,alignSelf:'center',paddingHorizontal:18,marginBottom:18},
  heroBadge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:11,paddingVertical:7,borderRadius:999,borderWidth:1,borderColor:'rgba(240,207,112,0.30)',backgroundColor:'rgba(240,207,112,0.08)'},
  heroBadgeText:{color:'#f0cf70',fontSize:10,fontWeight:'900',letterSpacing:1.1},
  heroTitle:{color:'#fff',fontSize:32,fontWeight:'900',marginTop:11},
  heroCopy:{color:'#bfd0c3',fontSize:13,lineHeight:20,maxWidth:900,marginTop:7},
  heroStats:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:13},
  statPill:{minWidth:105,paddingHorizontal:12,paddingVertical:8,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.10)',backgroundColor:'rgba(3,9,8,0.30)'},
  statValue:{color:'#f1d37b',fontSize:18,fontWeight:'900'},
  statLabel:{color:'#9fb3a6',fontSize:8,fontWeight:'900',letterSpacing:.7,marginTop:2},
  horizontalPad:{paddingHorizontal:12,paddingBottom:4},
  worldFrame:{width:WORLD_W,height:WORLD_H,position:'relative',overflow:'hidden',borderRadius:30,borderWidth:1,borderColor:'rgba(214,236,220,0.16)',backgroundColor:'#10241c',shadowColor:'#000',shadowOpacity:.34,shadowRadius:28,shadowOffset:{width:0,height:16},elevation:12},
  forestMass:{position:'absolute',left:-70,top:100,width:520,height:430,borderRadius:230,backgroundColor:'rgba(31,91,59,0.45)'},
  cityMass:{position:'absolute',right:115,top:95,width:430,height:360,borderRadius:170,backgroundColor:'rgba(41,83,101,0.36)'},
  highlandMass:{position:'absolute',right:-70,bottom:-70,width:470,height:350,borderRadius:210,backgroundColor:'rgba(97,112,85,0.30)'},
  river:{position:'absolute',left:420,top:355,width:610,height:78,borderRadius:45,backgroundColor:'rgba(90,157,174,0.20)',transform:[{rotate:'12deg'}]},
  fogA:{position:'absolute',left:255,top:50,width:360,height:100,borderRadius:70,backgroundColor:'rgba(220,236,228,0.035)'},
  fogB:{position:'absolute',right:10,bottom:210,width:360,height:120,borderRadius:70,backgroundColor:'rgba(220,236,228,0.035)'},
  stationWrap:{position:'absolute',width:160,alignItems:'center'},
  stationGlow:{position:'absolute',width:150,height:98,borderRadius:50,top:10},
  stationCard:{width:160,minHeight:105,borderRadius:18,borderWidth:1.5,overflow:'hidden',flexDirection:'row',padding:10,alignItems:'center',shadowColor:'#000',shadowOpacity:.24,shadowRadius:12,shadowOffset:{width:0,height:8},elevation:8},
  stationPressed:{opacity:.76,transform:[{scale:.98}]},
  iconOrb:{width:42,height:42,borderRadius:21,borderWidth:1.3,backgroundColor:'rgba(255,255,255,0.10)',alignItems:'center',justifyContent:'center'},
  stationBody:{flex:1,minWidth:0,marginLeft:8},
  stationTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},
  stationCharacter:{fontSize:11,fontWeight:'900',letterSpacing:.5},
  stationRegion:{color:'rgba(255,255,255,0.68)',fontSize:8.2,fontWeight:'700',marginTop:2},
  stationGame:{color:'#fff',fontSize:10.5,fontWeight:'900',marginTop:3},
  stationState:{color:'rgba(255,255,255,0.58)',fontSize:7,fontWeight:'900',marginTop:5,letterSpacing:.25},
  worldChange:{marginTop:5,width:158,color:'#ddeddf',fontSize:7.5,lineHeight:10,textAlign:'center',fontWeight:'700',backgroundColor:'rgba(4,10,8,0.50)',paddingHorizontal:5,paddingVertical:4,borderRadius:8},
  futureNode:{position:'absolute',width:88,height:88,alignItems:'center',justifyContent:'center'},
  futureRing:{width:88,height:88,borderRadius:44,borderWidth:1.5,borderStyle:'dashed',borderColor:'rgba(185,195,202,0.30)',backgroundColor:'rgba(48,57,62,0.34)',alignItems:'center',justifyContent:'center'},
  futureTitle:{color:'#d2d8dc',fontSize:11,fontWeight:'900',marginTop:2},
  futureCopy:{color:'#919da4',fontSize:6.7,fontWeight:'900',letterSpacing:.45,marginTop:1},
  citadel:{position:'absolute',left:560,top:370,width:170,height:118,borderRadius:25,borderWidth:1,borderColor:'rgba(241,211,123,0.40)',backgroundColor:'rgba(57,44,21,0.72)',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  citadelGlow:{position:'absolute',width:150,height:100,borderRadius:60,backgroundColor:'rgba(241,211,123,0.10)'},
  citadelTitle:{color:'#f1d37b',fontSize:10,fontWeight:'900',letterSpacing:.8,marginTop:3},
  citadelCopy:{color:'#b9ae8c',fontSize:7.5,fontWeight:'700',marginTop:2},
  footerCard:{width:'94%',maxWidth:1180,alignSelf:'center',marginTop:16,padding:14,borderRadius:18,borderWidth:1,borderColor:'rgba(239,207,118,0.20)',backgroundColor:'rgba(6,14,12,0.58)',flexDirection:'row',gap:11,alignItems:'flex-start'},
  footerTitle:{color:'#f1d37b',fontSize:12,fontWeight:'900'},
  footerCopy:{color:'#aebdb4',fontSize:10,lineHeight:15,marginTop:4},
});
