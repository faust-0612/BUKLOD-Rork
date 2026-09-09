import React, { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import {
  loadBuklodKingdomPreviewProgress,
  subscribeBuklodKingdomPreviewProgress,
  type BuklodKingdomPreviewProgress,
} from './progress';

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
  change: string;
};

const WORLD_W = 1260;
const WORLD_H = 820;

const STATIONS: readonly Station[] = [
  { id:'phan-enterprise-builder', character:'Phan', region:'Farm / Enterprise', game:'Enterprise Builder', href:'/games/phan-enterprise-builder', x:115, y:580, icon:'barn', accent:'#d9b85d', glow:'#8da944', change:'The farmstead grows into a working enterprise.' },
  { id:'vhen-farm-to-market', character:'Vhen', region:'Agricultural Valley', game:'Farm to Market', href:'/games/vhen-farm-to-market', x:260, y:650, icon:'sprout', accent:'#9bc76b', glow:'#6d9848', change:'Fields become greener and the market road activates.' },
  { id:'jawo-forest-trail', character:'Jawo', region:'Whispering Forest', game:'Forest Trail', href:'/games/jawo-forest-trail', x:165, y:310, icon:'pine-tree', accent:'#88d7a3', glow:'#4a946e', change:'Trail lights awaken and the forest path glows.' },
  { id:'trudice-playground-memory', character:'Trudice', region:"Children's Haven", game:'Wonder Path', href:'/games/trudice-playground-memory', x:405, y:285, icon:'slide', accent:'#ef9dd1', glow:'#a75fbd', change:'Playground stations light up one by one.' },
  { id:'mitch-restore-mural', character:'Mitch', region:'Art Village', game:'Restore the Mural', href:'/games/mitch-restore-mural', x:560, y:510, icon:'palette-outline', accent:'#e69a79', glow:'#a85c69', change:'The village mural returns and new colors appear.' },
  { id:'christian-civic-leadership', character:'Christian', region:'Civic Academy', game:'Leadership Council', href:'/games/christian-civic-leadership', x:655, y:235, icon:'bank-outline', accent:'#d8c071', glow:'#6777ad', change:'The council hall opens and civic lights activate.' },
  { id:'ace-rescue-grid', character:'Ace', region:'Strategy District', game:'Rescue Grid', href:'/games/ace-rescue-grid', x:770, y:400, icon:'map-marker-path', accent:'#83c9ec', glow:'#537c9f', change:'Blocked corridors clear and rescue beacons stay lit.' },
  { id:'van-living-city-dispatch', character:'Van', region:'Living City', game:'City Dispatch', href:'/games/van-living-city-dispatch', x:885, y:205, icon:'city-variant-outline', accent:'#8fd0de', glow:'#426d89', change:'The district skyline activates and service routes move.' },
  { id:'lhen-rhythm-journey', character:'Lhen', region:'Music City', game:'Rhythm Journey', href:'/games/lhen-rhythm-journey', x:1020, y:315, icon:'music-circle-outline', accent:'#dd91d2', glow:'#775092', change:'Music lights pulse across the performance district.' },
  { id:'angel-kingdom-treasury', character:'Angel', region:'Treasury City', game:'Kingdom Treasury', href:'/games/angel-kingdom-treasury', x:930, y:575, icon:'treasure-chest-outline', accent:'#e5c061', glow:'#a16f32', change:'Treasury lanterns glow and reserve vaults open.' },
  { id:'niel-mission-trail', character:'Niel', region:'Mission Frontier', game:'Mission Trail', href:'/games/niel-mission-trail', x:675, y:675, icon:'compass-outline', accent:'#a5be81', glow:'#55785b', change:'A frontier path extends toward distant settlements.' },
  { id:'elesur-village-builder', character:'ELESUR', region:'Highland Community', game:'Village Builder', href:'/games/elesur-village-builder', x:1110, y:650, icon:'home-group', accent:'#afc9ba', glow:'#607e77', change:'New community structures rise in the highlands.' },
  { id:'quin-discovery-expedition', character:'Quin', region:'Discovery World', game:'Discovery Expedition', href:'/games/quin-discovery-expedition', x:1115, y:105, icon:'telescope', accent:'#a7b5ff', glow:'#596ca8', change:'Fog clears and a hidden route becomes visible.' },
] as const;

const FUTURE = [
  { x:350, y:100 },
  { x:505, y:125 },
  { x:820, y:105 },
  { x:1180, y:410 },
];

const ROUTE_PATHS = [
  'M 115 580 C 180 600 210 640 260 650',
  'M 115 580 C 100 455 120 370 165 310',
  'M 165 310 C 255 250 330 250 405 285',
  'M 405 285 C 470 360 515 430 560 510',
  'M 405 285 C 505 245 575 225 655 235',
  'M 655 235 C 710 285 750 335 770 400',
  'M 655 235 C 755 195 820 185 885 205',
  'M 885 205 C 940 235 985 270 1020 315',
  'M 770 400 C 845 455 900 515 930 575',
  'M 560 510 C 610 590 645 640 675 675',
  'M 675 675 C 790 690 875 640 930 575',
  'M 930 575 C 1000 620 1055 650 1110 650',
  'M 1020 315 C 1080 250 1110 190 1115 105',
];

function EmptyProgress(): BuklodKingdomPreviewProgress {
  return { version: 1, stations: {} };
}

export default function BuklodKingdomMap() {
  const { width } = useWindowDimensions();
  const [progress, setProgress] = useState<BuklodKingdomPreviewProgress>(EmptyProgress());

  useEffect(() => {
    let mounted = true;
    loadBuklodKingdomPreviewProgress().then((value) => {
      if (mounted) setProgress(value);
    }).catch(() => undefined);
    const unsubscribe = subscribeBuklodKingdomPreviewProgress((value) => {
      if (mounted) setProgress(value);
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const scale = useMemo(() => Math.max(0.78, Math.min(1, (width - 24) / WORLD_W)), [width]);
  const worldWidth = Math.round(WORLD_W * scale);
  const worldHeight = Math.round(WORLD_H * scale);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#07120e', '#102b23', '#173b2d', '#151f26']}
        start={{ x:0.08, y:0.08 }}
        end={{ x:0.92, y:0.94 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.skyGlowA} />
      <View pointerEvents="none" style={styles.skyGlowB} />

      <View style={styles.hero}>
        <View style={styles.heroBadge}><MaterialCommunityIcons name="crown-outline" size={18} color="#f0cf70" /><Text style={styles.heroBadgeText}>BUKLOD KINGDOM</Text></View>
        <Text style={styles.heroTitle}>Your World Keeps Growing</Text>
        <Text style={styles.heroCopy}>WORLD → REGION / BIOME → CHARACTER STATION → GAME. Current stations are playable; future lands remain locked until a later expansion.</Text>
        <View style={styles.legendRow}>
          <View style={styles.legend}><View style={[styles.legendDot,{backgroundColor:'#8ed3a9'}]} /><Text style={styles.legendText}>AVAILABLE</Text></View>
          <View style={styles.legend}><View style={[styles.legendDot,{backgroundColor:'#f0cf70'}]} /><Text style={styles.legendText}>CLEARED</Text></View>
          <View style={styles.legend}><View style={[styles.legendDot,{backgroundColor:'#6e7780'}]} /><Text style={styles.legendText}>FUTURE LOCKED</Text></View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <View style={[styles.worldFrame, { width: worldWidth, height: worldHeight }]}> 
          <View style={[styles.worldCanvas, { width: WORLD_W, height: WORLD_H, transform:[{ scale }], transformOrigin:'top left' as any }]}> 
            <LinearGradient
              colors={['rgba(46,105,74,0.72)','rgba(22,48,56,0.72)','rgba(67,61,37,0.68)']}
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
                <SvgLinearGradient id="route" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#b6d8b6" stopOpacity="0.34" />
                  <Stop offset="1" stopColor="#eed27a" stopOpacity="0.52" />
                </SvgLinearGradient>
              </Defs>
              {ROUTE_PATHS.map((d, index) => <Path key={index} d={d} fill="none" stroke="url(#route)" strokeWidth={8} strokeLinecap="round" strokeDasharray="8 12" />)}
              {FUTURE.map((node,index) => <Circle key={`future-ring-${index}`} cx={node.x} cy={node.y} r={42} fill="rgba(89,99,108,0.10)" stroke="rgba(180,190,200,0.18)" strokeWidth={2} strokeDasharray="6 7" />)}
            </Svg>

            {STATIONS.map((station) => {
              const state = progress.stations[station.id];
              const cleared = (state?.clears ?? 0) > 0;
              return (
                <Link key={station.id} href={station.href as any} asChild>
                  <View style={[styles.stationWrap,{left:station.x-78,top:station.y-62}]}> 
                    <View style={[styles.stationGlow,{backgroundColor:station.glow,opacity:cleared?0.5:0.24}]} />
                    <View style={[styles.stationCard,{borderColor:cleared?'#f0cf70':station.accent}]}> 
                      <View style={[styles.iconOrb,{backgroundColor:station.glow,borderColor:station.accent}]}>
                        <MaterialCommunityIcons name={station.icon} size={24} color="#fff" />
                      </View>
                      <View style={styles.stationBody}>
                        <View style={styles.stationTopRow}>
                          <Text style={[styles.stationCharacter,{color:station.accent}]}>{station.character}</Text>
                          <MaterialCommunityIcons name={cleared?'star-circle':'play-circle-outline'} size={17} color={cleared?'#f0cf70':'rgba(255,255,255,0.66)'} />
                        </View>
                        <Text numberOfLines={1} style={styles.stationRegion}>{station.region}</Text>
                        <Text numberOfLines={1} style={styles.stationGame}>{station.game}</Text>
                        <Text style={styles.stationState}>{cleared?`CLEARED • ${state?.bestStars ?? 0}★ • BEST ${(state?.bestScore ?? 0).toLocaleString()}`:'AVAILABLE • ENTER STATION'}</Text>
                      </View>
                    </View>
                    {cleared ? <Text style={styles.worldChange}>{station.change}</Text> : null}
                  </View>
                </Link>
              );
            })}

            {FUTURE.map((node,index) => (
              <View key={`future-${index}`} style={[styles.futureNode,{left:node.x-42,top:node.y-42}]}> 
                <MaterialCommunityIcons name="lock-outline" size={22} color="#a6afb5" />
                <Text style={styles.futureTitle}>???</Text>
                <Text style={styles.futureCopy}>COMING SOON</Text>
              </View>
            ))}

            <View style={styles.citadel}>
              <MaterialCommunityIcons name="castle" size={34} color="#f2d27a" />
              <Text style={styles.citadelTitle}>KINGDOM CITADEL</Text>
              <Text style={styles.citadelCopy}>Hub • not the ending</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerCard}>
        <MaterialCommunityIcons name="map-marker-path" size={24} color="#efcf76" />
        <View style={{flex:1}}>
          <Text style={styles.footerTitle}>Expandable by design</Text>
          <Text style={styles.footerCopy}>Level 20 never ends the world. New regions, stations, secret routes, seasonal maps and later realms can extend this same map without erasing player progress.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,minHeight:760,backgroundColor:'#07120e',paddingTop:34,paddingBottom:38,overflow:'hidden'},
  skyGlowA:{position:'absolute',width:520,height:520,borderRadius:260,top:-310,right:-130,backgroundColor:'rgba(114,178,135,0.10)'},
  skyGlowB:{position:'absolute',width:420,height:420,borderRadius:210,bottom:-250,left:-130,backgroundColor:'rgba(210,167,81,0.08)'},
  hero:{width:'100%',maxWidth:1180,alignSelf:'center',paddingHorizontal:18,marginBottom:18},
  heroBadge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:10,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:'rgba(240,207,112,0.28)',backgroundColor:'rgba(240,207,112,0.08)'},
  heroBadgeText:{color:'#f0cf70',fontSize:10,fontWeight:'900',letterSpacing:1.1},heroTitle:{color:'#fff',fontSize:34,fontWeight:'900',marginTop:11},heroCopy:{color:'#bfd0c3',fontSize:14,lineHeight:21,maxWidth:880,marginTop:7},
  legendRow:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:12},legend:{flexDirection:'row',alignItems:'center',gap:6},legendDot:{width:8,height:8,borderRadius:4},legendText:{color:'#9fb2a6',fontSize:9,fontWeight:'900',letterSpacing:.8},
  scrollPad:{paddingHorizontal:12,paddingBottom:4},worldFrame:{overflow:'hidden',borderRadius:28,borderWidth:1,borderColor:'rgba(214,236,220,0.14)',backgroundColor:'#10241c',shadowColor:'#000',shadowOpacity:.3,shadowRadius:24,shadowOffset:{width:0,height:14}},worldCanvas:{position:'relative',overflow:'hidden'},
  forestMass:{position:'absolute',left:-100,top:110,width:520,height:620,borderRadius:260,backgroundColor:'rgba(24,92,58,0.32)',transform:[{rotate:'-9deg'}]},cityMass:{position:'absolute',right:100,top:80,width:450,height:510,borderRadius:90,backgroundColor:'rgba(35,77,98,0.26)',transform:[{rotate:'7deg'}]},highlandMass:{position:'absolute',right:-90,bottom:-120,width:540,height:390,borderRadius:210,backgroundColor:'rgba(116,105,68,0.22)'},river:{position:'absolute',left:510,top:-100,width:92,height:1060,borderRadius:46,backgroundColor:'rgba(94,159,178,0.15)',transform:[{rotate:'17deg'}]},fogA:{position:'absolute',left:925,top:-70,width:430,height:250,borderRadius:180,backgroundColor:'rgba(211,219,233,0.08)'},fogB:{position:'absolute',left:260,top:-80,width:350,height:230,borderRadius:170,backgroundColor:'rgba(211,219,233,0.06)'},
  stationWrap:{position:'absolute',width:156,alignItems:'center'},stationGlow:{position:'absolute',width:132,height:92,borderRadius:52,top:8},stationCard:{width:156,minHeight:118,borderRadius:18,borderWidth:1.5,padding:9,backgroundColor:'rgba(8,17,18,0.88)',flexDirection:'row',gap:8,shadowColor:'#000',shadowOpacity:.24,shadowRadius:12,shadowOffset:{width:0,height:7}},iconOrb:{width:42,height:42,borderRadius:21,borderWidth:1.5,alignItems:'center',justifyContent:'center'},stationBody:{flex:1,minWidth:0},stationTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},stationCharacter:{fontSize:11,fontWeight:'900',letterSpacing:.5},stationRegion:{marginTop:3,color:'#c8d7cd',fontSize:8.5,fontWeight:'800'},stationGame:{marginTop:6,color:'#fff',fontSize:10.5,fontWeight:'900'},stationState:{marginTop:6,color:'#aabbb0',fontSize:7.5,lineHeight:10,fontWeight:'900'},worldChange:{marginTop:5,width:148,textAlign:'center',color:'#e5d59d',fontSize:7.5,lineHeight:10,fontWeight:'700'},
  futureNode:{position:'absolute',width:84,height:84,borderRadius:42,borderWidth:1,borderColor:'rgba(177,188,196,0.24)',backgroundColor:'rgba(45,52,58,0.58)',alignItems:'center',justifyContent:'center'},futureTitle:{color:'#b2bcc1',fontSize:11,fontWeight:'900',marginTop:2},futureCopy:{color:'#7f8b91',fontSize:6.5,fontWeight:'900',letterSpacing:.6},
  citadel:{position:'absolute',left:555,top:335,width:150,minHeight:92,borderRadius:22,borderWidth:1.5,borderColor:'rgba(238,204,107,0.42)',backgroundColor:'rgba(46,37,20,0.88)',alignItems:'center',justifyContent:'center',padding:10},citadelTitle:{color:'#f2d27a',fontSize:9.5,fontWeight:'900',letterSpacing:.8,marginTop:3},citadelCopy:{color:'#baa96f',fontSize:7.5,fontWeight:'700',marginTop:2},
  footerCard:{width:'100%',maxWidth:1180,alignSelf:'center',marginTop:18,marginHorizontal:18,flexDirection:'row',alignItems:'flex-start',gap:12,padding:16,borderRadius:18,borderWidth:1,borderColor:'rgba(239,207,118,0.18)',backgroundColor:'rgba(17,30,26,0.82)'},footerTitle:{color:'#fff',fontSize:14,fontWeight:'900'},footerCopy:{color:'#aebfb3',fontSize:11,lineHeight:17,marginTop:3}
});
