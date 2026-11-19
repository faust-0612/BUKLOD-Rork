
import React, {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,Pressable,StyleSheet,Text,View} from 'react-native';
import Svg,{Defs,RadialGradient,LinearGradient as SvgLinearGradient,Stop,Circle,Ellipse,Rect,Path,G} from 'react-native-svg';
import {LinearGradient} from 'expo-linear-gradient';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {GENESIS_IDENTITY,GENESIS_MOTION_MS,GENESIS_PALETTE,resolveGenesisMotion,type GenesisQuality,type GenesisSurface} from './genesisContract';
import {getGenesisDeviceQuality} from './genesisDeviceQuality';

export function useGenesisMotionAllowed(active:boolean,quality:GenesisQuality='balanced',surface:GenesisSurface='home') {
  const [reduced,setReduced]=useState(false);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{
    let mounted=true;
    AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(mounted)setReduced(v);}).catch(()=>{});
    const a=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>setReduced(Boolean(v)));
    const b=AppState.addEventListener('change',v=>setForeground(v==='active'));
    return()=>{mounted=false;a.remove();b.remove();};
  },[]);
  return resolveGenesisMotion({surface,quality,focused:active,appActive:foreground,reducedMotion:reduced}).ambient;
}

/** Original infinitely scalable Creation scene: distant galaxies, planets, nebulae and a radiant source. */
function CreationSpaceScene(){
  const stars=[
    [13,19],[40,60],[82,18],[115,83],[146,30],[196,20],[240,47],[290,15],
    [338,41],[367,105],[360,171],[295,195],[248,177],[187,201],[131,171],
    [49,187],[21,131],[372,23],[75,135],[324,84],
  ];
  return <Svg width="100%" height="100%" viewBox="0 0 390 230" preserveAspectRatio="xMidYMid slice">
    <Defs>
      <RadialGradient id="nebula" cx="58%" cy="42%" rx="73%" ry="79%">
        <Stop offset="0" stopColor="#777DB6" stopOpacity=".6"/>
        <Stop offset=".37" stopColor="#384A92" stopOpacity=".31"/>
        <Stop offset="1" stopColor="#09102A" stopOpacity="0"/>
      </RadialGradient>
      <RadialGradient id="firstLight" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1"/>
        <Stop offset=".12" stopColor="#FFF2C8" stopOpacity=".94"/>
        <Stop offset=".34" stopColor="#F5CC95" stopOpacity=".42"/>
        <Stop offset="1" stopColor="#E8B5AA" stopOpacity="0"/>
      </RadialGradient>
      <RadialGradient id="blueWorld" cx="27%" cy="22%" rx="81%" ry="91%">
        <Stop offset="0" stopColor="#B4E9EB"/>
        <Stop offset=".31" stopColor="#4A8FBC"/>
        <Stop offset=".68" stopColor="#284F8B"/>
        <Stop offset="1" stopColor="#0A1531"/>
      </RadialGradient>
      <RadialGradient id="goldWorld" cx="32%" cy="20%" rx="81%" ry="82%">
        <Stop offset="0" stopColor="#FFF0BF"/>
        <Stop offset=".6" stopColor="#C09B92"/>
        <Stop offset="1" stopColor="#4C426B"/>
      </RadialGradient>
      <SvgLinearGradient id="orbit" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E4F2FF" stopOpacity="0"/>
        <Stop offset=".44" stopColor="#BBDCF9" stopOpacity=".58"/>
        <Stop offset=".78" stopColor="#FFE3B4" stopOpacity=".4"/>
        <Stop offset="1" stopColor="#CDE6FA" stopOpacity="0"/>
      </SvgLinearGradient>
    </Defs>
    <Rect width="390" height="230" fill="#070D22"/>
    <Ellipse cx="210" cy="113" rx="228" ry="126" fill="url(#nebula)"/>
    <Path d="M-15 162 Q92 10 177 83 T415 39" stroke="#9A75BC" strokeOpacity=".16" strokeWidth="27" fill="none"/>
    <Ellipse cx="234" cy="110" rx="171" ry="44" transform="rotate(-23 234 110)"
      stroke="url(#orbit)" strokeWidth="1.3" fill="none"/>
    <Ellipse cx="243" cy="111" rx="116" ry="28" transform="rotate(30 243 111)"
      stroke="#C8D9F3" strokeOpacity=".26" strokeWidth=".8" fill="none"/>
    <Circle cx="312" cy="137" r="45" fill="url(#blueWorld)"/>
    <Path d="M271 119 Q293 126 312 111 T352 108" stroke="#DAF3F9" strokeWidth="3.7" strokeOpacity=".25" fill="none"/>
    <Path d="M269 152 Q298 136 320 147 T350 156" stroke="#A8DCEF" strokeWidth="3" strokeOpacity=".19" fill="none"/>
    <Circle cx="151" cy="52" r="20" fill="url(#goldWorld)"/>
    <Ellipse cx="151" cy="52" rx="30" ry="6" transform="rotate(-23 151 52)"
      stroke="#F9D7AE" strokeWidth="1.3" fill="none" opacity=".78"/>
    <Circle cx="218" cy="95" r="83" fill="url(#firstLight)"/>
    <Path d="M218 0 V192 M117 95 H309 M157 34 L279 156 M157 156 L279 34"
      stroke="#FFF5D3" strokeOpacity=".25" strokeWidth=".9"/>
    <Circle cx="218" cy="95" r="4.8" fill="#FFFFFF"/>
    {stars.map(([x,y],i)=><G key={i}>
      <Path d={'M'+(x-3)+' '+y+' H'+(x+3)+' M'+x+' '+(y-3)+' V'+(y+3)}
        stroke="#D8EEFF" strokeWidth=".5" strokeOpacity=".48"/>
      <Circle cx={x} cy={y} r={i%3===0?1.1:.6} fill="#E9F3FF"/>
    </G>)}
  </Svg>;
}
function Streak({phase,x,y,rotation}:{phase:Animated.Value;x:string;y:string;rotation:string}) {
  return <Animated.View pointerEvents="none" style={{
    position:'absolute',left:x as any,top:y as any,width:46,height:13,
    opacity:phase.interpolate({inputRange:[0,.2,.64,1],outputRange:[.1,.9,.65,.1]}),
    transform:[
      {translateY:phase.interpolate({inputRange:[0,1],outputRange:[18,-42]})},
      {translateX:phase.interpolate({inputRange:[0,1],outputRange:[-14,30]})},
      {rotate:rotation},
    ],
  }}>
    <Svg viewBox="0 0 46 13" width="46" height="13"><Defs>
      <SvgLinearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#A7E4FA" stopOpacity="0"/>
        <Stop offset=".7" stopColor="#B5DFFF" stopOpacity=".68"/>
        <Stop offset=".94" stopColor="#FFF7D6" stopOpacity="1"/>
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0"/>
      </SvgLinearGradient></Defs>
      <Path d="M0 6 L36 3 L46 6 L36 10 Z" fill="url(#trail)"/>
      <Path d="M9 6 L43 6" stroke="#FFF5CD" strokeWidth=".7"/>
    </Svg>
  </Animated.View>;
}
export function GenesisAtmosphere({active,quality,surface='home'}:{
  active:boolean;quality?:GenesisQuality;surface?:GenesisSurface;
}) {
  const effectiveQuality = quality ?? getGenesisDeviceQuality(surface);
  const run=useGenesisMotionAllowed(active,effectiveQuality,surface);
  const phase=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(!run){phase.stopAnimation();phase.setValue(0);return;}
    const loop=Animated.loop(Animated.timing(phase,{
      toValue:1,duration:GENESIS_MOTION_MS.atmosphericDrift,
      easing:Easing.inOut(Easing.sin),useNativeDriver:true,
    }));
    loop.start();return()=>{loop.stop();phase.setValue(0);};
  },[phase,run]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <CreationSpaceScene/>
    {run ? <>
      <Streak phase={phase} x="15%" y="28%" rotation="-17deg"/>
      <Streak phase={phase} x="60%" y="69%" rotation="24deg"/>
      <Streak phase={phase} x="86%" y="20%" rotation="-38deg"/>
      {effectiveQuality==='full'? <><Streak phase={phase} x="35%" y="48%" rotation="11deg"/>
        <Streak phase={phase} x="77%" y="51%" rotation="-13deg"/></> : null}
    </> : null}
  </View>;
}
/** Bounded cosmic scene behind home content. Never intercepts taps or ad impressions. */
export function GenesisCosmosBackground({active}:{active:boolean}) {
  return <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,height:510}}>
    <GenesisAtmosphere active={active}/>
    <LinearGradient colors={['rgba(5,10,25,0)','rgba(5,10,25,.5)','#050A19']}
      style={StyleSheet.absoluteFill}/>
  </View>;
}
export function GenesisSeal({size=74,active=false}:{size?:number;active?:boolean}) {
  const run=useGenesisMotionAllowed(active,getGenesisDeviceQuality('reward'),'reward');
  const glow=useRef(new Animated.Value(.4)).current;
  useEffect(()=>{
    if(!run){glow.stopAnimation();glow.setValue(.4);return;}
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:.83,duration:1700,useNativeDriver:true}),
      Animated.timing(glow,{toValue:.4,duration:1700,useNativeDriver:true}),
    ]));animation.start();return()=>animation.stop();
  },[run,glow]);
  return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
    <Animated.View pointerEvents="none" style={{position:'absolute',width:size*.65,height:size*.65,
      borderRadius:size,backgroundColor:'#F2DBA6',opacity:glow}}/>
    <Svg viewBox="0 0 120 120" width={size} height={size}>
      <Circle cx="60" cy="60" r="53" stroke="#F0D29C" strokeWidth="1.5"
        strokeDasharray="22 4 2 3" fill="none"/>
      <Ellipse cx="60" cy="60" rx="52" ry="17" transform="rotate(-29 60 60)"
        stroke="#C5E6F8" strokeWidth="1.5" fill="none"/>
      <Ellipse cx="60" cy="60" rx="50" ry="15" transform="rotate(38 60 60)"
        stroke="#F5D39C" strokeWidth=".9" fill="none"/>
      <Circle cx="60" cy="60" r="34" stroke="#D1BEA1" strokeWidth=".7" fill="none"/>
      <Path d="M60 9 V111 M9 60 H111 M25 25 L95 95 M25 95 L95 25"
        stroke="#FFF2CA" strokeWidth="1" strokeOpacity=".7"/>
      <Circle cx="60" cy="60" r="8" fill="#FFF8E6"/><Circle cx="60" cy="60" r="3.6" fill="#FFFFFF"/>
      <Circle cx="16" cy="38" r="2.2" fill="#F2E4BC"/><Circle cx="100" cy="79" r="2.1" fill="#A8DEFA"/>
    </Svg>
  </View>;
}
export function GenesisLivingButton({label,onPress}:{label:string;onPress:()=>void}) {
  const scale=useRef(new Animated.Value(1)).current;
  const bounce=(v:number)=>Animated.spring(scale,{toValue:v,useNativeDriver:true,
    friction:9,tension:140}).start();
  return <Animated.View style={{alignSelf:'flex-start',transform:[{scale}]}}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      onPressIn={()=>bounce(.95)} onPressOut={()=>bounce(1)} style={styles.button}>
      <MaterialCommunityIcons name="creation" size={15} color="#0D1930"/>
      <Text style={styles.buttonText}>{label}</Text>
      <MaterialCommunityIcons name="arrow-right" size={15} color="#0D1930"/>
    </Pressable>
  </Animated.View>;
}
export function GenesisHomeHero({active=true,quality,onExplore}:{
  active?:boolean;quality?:GenesisQuality;onExplore?:()=>void;
}) {
  return <LinearGradient colors={['#060D24','#142044','#242449']} style={styles.hero}
    start={{x:0,y:0}} end={{x:1,y:1}}>
    <GenesisAtmosphere active={active} quality={quality}/>
    <View style={styles.copy}>
      <Text style={styles.kicker}>BUKLOD · SEASON 2 · CREATION</Text>
      <Text style={styles.title}>{GENESIS_IDENTITY.title}</Text>
      <Text style={styles.verse}>“Let there be light.” · Genesis 1:3</Text>
      <Text style={styles.sub}>{GENESIS_IDENTITY.subtitle}</Text>
      {onExplore ? <View style={{marginTop:12}}>
        <GenesisLivingButton label="Explore the Kingdom" onPress={onExplore}/>
      </View>:null}
    </View>
    <View style={{width:64,zIndex:1}}><GenesisSeal size={64} active={active}/></View>
  </LinearGradient>;
}
const styles=StyleSheet.create({
  hero:{minHeight:170,overflow:'hidden',borderRadius:18,paddingHorizontal:13,paddingVertical:14,
    flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#59699F'},
  copy:{flex:1,minWidth:0,zIndex:1},
  kicker:{color:'#F5D39C',fontSize:9,fontWeight:'900',letterSpacing:1.3},
  title:{fontSize:19,lineHeight:24,marginTop:7,fontWeight:'900',color:'#F8FAFF'},
  verse:{marginTop:6,color:'#FFE5B9',fontSize:12,fontWeight:'800'},
  sub:{marginTop:4,color:'#D9E5FD',fontSize:11,lineHeight:15},
  button:{minHeight:40,flexDirection:'row',alignItems:'center',gap:7,
    paddingHorizontal:12,borderRadius:11,backgroundColor:'#F1D4A0',borderWidth:1,borderColor:'#FFF0CA'},
  buttonText:{fontSize:11,fontWeight:'900',color:'#0D1930'},
});
