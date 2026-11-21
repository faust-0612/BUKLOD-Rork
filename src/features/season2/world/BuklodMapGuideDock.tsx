/**
 * Guide lives OUTSIDE the approved landscape asset, not inside image coordinates.
 * Only visible on Genesis staging. Suggestions link to existing authorized routes.
 * No invented AI network service or voice playback; respects reduced-motion.
 */
import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import {DEFAULT_CHARACTER} from '@/lib/buklodCharacter';

export default function BuklodMapGuideDock({active}:{active:boolean}) {
  const insets=useSafeAreaInsets();
  const [minimized,setMinimized]=useState(false);
  const [details,setDetails]=useState(false);
  const [reducedMotion,setReducedMotion]=useState(true);
  const wave=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    let live=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live)setReducedMotion(value);}).catch(()=>undefined);
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    wave.stopAnimation();wave.setValue(0);
    if(!active||reducedMotion)return;
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(wave,{toValue:1,duration:1000,useNativeDriver:true}),
      Animated.timing(wave,{toValue:0,duration:1100,useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>{loop.stop();wave.stopAnimation();};
  },[active,reducedMotion,wave]);
  const lift=wave.interpolate({inputRange:[0,1],outputRange:[0,-4]});
  const suggestions=[
    {label:'My Home',route:'/season2/my-world',icon:'home-heart-outline' as const},
    {label:'Community Village',route:'/season2/community-village',icon:'home-group' as const},
    {label:"What's new",route:'/notifications',icon:'bell-outline' as const},
  ];
  return (
    <View accessibilityLabel="BUKLOD animated guide, outside the world map"
      style={[styles.dock,{paddingBottom:Math.max(4,insets.bottom)}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={minimized?'Expand BUKLOD guide':'Minimize BUKLOD guide'}
        onPress={()=>setMinimized(v=>!v)} style={styles.faceButton}>
        <Animated.View style={{transform:[{translateY:lift}]}}>
          {minimized ? <MaterialCommunityIcons name="account-star" size={30} color="#EFDCA5"/> : (
            <View style={styles.portrait}>
              <BuklodActiveCharacterArt fallbackCharacter={DEFAULT_CHARACTER} height={62} viewportWidth={52} showEffects={false}/>
              <MaterialCommunityIcons name="hand-wave-outline" size={16} color="#FFF2C9" style={styles.waveIcon}/>
            </View>
          )}
        </Animated.View>
      </Pressable>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Hear guide recommendations in text"
          onPress={()=>{setMinimized(false);setDetails(v=>!v);}}>
          <Text style={styles.greeting}>{minimized?'BUKLOD Guide · tap to open':'Kumusta! Ako ang BUKLOD Guide.'}</Text>
          {!minimized ? <Text style={styles.hint} numberOfLines={2}>{details
            ? 'Pumili ng pinto sa mapa. Ang My Home ay para sa iyong sariling Lot at House; ang Village ay para sa Cluster at community.'
            : 'Handa akong tumulong. Saan mo gustong pumunta?'}</Text> : null}
        </Pressable>
        {!minimized ? <View style={styles.chips}>
          {suggestions.map(s=>(
            <Pressable key={s.route} accessibilityRole="button" accessibilityLabel={'Guide: '+s.label}
              onPress={()=>router.push(s.route as any)} style={styles.chip}>
              <MaterialCommunityIcons name={s.icon} size={15} color="#FFE8AC"/>
              <Text style={styles.chipText}>{s.label}</Text>
            </Pressable>
          ))}
        </View> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={minimized?'Expand guide':'Collapse guide'}
        onPress={()=>setMinimized(v=>!v)} style={styles.collapse}>
        <MaterialCommunityIcons name={minimized?'chevron-up':'chevron-down'} size={22} color="#FFE9B6"/>
      </Pressable>
    </View>
  );
}
const styles=StyleSheet.create({
  dock:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,
    paddingTop:6,backgroundColor:'#102C2B',borderTopWidth:1,borderTopColor:'#BDA66F'},
  faceButton:{width:56,minHeight:52,justifyContent:'center',alignItems:'center'},
  portrait:{width:53,height:62,overflow:'hidden',justifyContent:'flex-end'},
  waveIcon:{position:'absolute',right:0,top:3},
  content:{flex:1,minWidth:0,gap:5},
  greeting:{color:'#FFE3A5',fontSize:12,fontWeight:'900'},
  hint:{color:'#E6F2E5',fontSize:10,lineHeight:13},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:5},
  chip:{flexDirection:'row',alignItems:'center',minHeight:28,paddingHorizontal:7,
    borderRadius:11,backgroundColor:'#275046',borderWidth:1,borderColor:'#62806C',gap:3},
  chipText:{color:'#FFF2DA',fontWeight:'800',fontSize:9},
  collapse:{minWidth:30,minHeight:48,justifyContent:'center',alignItems:'center'},
});
