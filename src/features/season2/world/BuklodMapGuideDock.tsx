/** Off-image Genesis entry guide: active character, meaningful shortcuts and offline help. */
import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import {DEFAULT_CHARACTER} from '@/lib/buklodCharacter';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {resolveBuklodGuideDestination} from './guideDestinations';
type Door={label:string;route:string;icon:React.ComponentProps<typeof MaterialCommunityIcons>['name']};
export const BUKLOD_ENTRY_DOORS:readonly Door[]=[
 {label:'Home',route:'/hub',icon:'home-outline'},
 {label:'Community',route:'/buklod',icon:'earth'},
 {label:'Connect',route:'/messages',icon:'message-text-outline'},
 {label:'Profile',route:'/me',icon:'account-circle-outline'},
 {label:'Cluster',route:'/clusters',icon:'account-group-outline'},
] as const;
const SUGGESTIONS:readonly Door[]=[
 {label:'Gusto mong may makasama?',route:'/clusters',icon:'account-group-outline'},
 {label:'Maglaro?',route:'/games',icon:'gamepad-variant-outline'},
 {label:'Matuto?',route:'/learn',icon:'book-open-variant'},
 {label:'Makipag-usap?',route:'/buklod',icon:'message-text-outline'},
] as const;
const UTILITIES:readonly Door[]=[
 {label:'Settings Engine',route:'/settings',icon:'cog-outline'},
 {label:'My BUKLOD',route:'/season2/my-world',icon:'home-heart'},
] as const;
export default function BuklodMapGuideDock({active}:{active:boolean}){
 const {activeScope}=useBuklodScope();
 const [minimized,setMinimized]=useState(false);
 const [askOpen,setAskOpen]=useState(false);
 const [question,setQuestion]=useState('');
 const [answer,setAnswer]=useState<{label:string;route:string}|null>(null);
 const [reducedMotion,setReducedMotion]=useState(true);
 const wave=useRef(new Animated.Value(0)).current;
 useEffect(()=>{let live=true;void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReducedMotion(v);}).catch(()=>undefined);return()=>{live=false;};},[]);
 useEffect(()=>{
  wave.stopAnimation();wave.setValue(0);
  if(!active||reducedMotion)return;
  const loop=Animated.loop(Animated.sequence([
   Animated.timing(wave,{toValue:1,duration:1100,useNativeDriver:true}),
   Animated.timing(wave,{toValue:0,duration:1100,useNativeDriver:true}),
  ]));loop.start();return()=>{loop.stop();wave.stopAnimation();};
 },[active,reducedMotion,wave]);
 const lift=wave.interpolate({inputRange:[0,1],outputRange:[0,-4]});
 const turn=wave.interpolate({inputRange:[0,1],outputRange:['-9deg','16deg']});
 const find=()=>setAnswer(resolveBuklodGuideDestination(question,Boolean(activeScope?.show_faith_content)));
 const open=(route:string)=>router.push(route as any);
 const door=(item:Door,utility=false)=>(
  <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={'Open '+item.label}
   onPress={()=>open(item.route)} style={({pressed})=>[utility?styles.utility:styles.door,pressed&&styles.pressed]}>
   <MaterialCommunityIcons name={item.icon} size={18} color={utility?'#FFE4AC':'#E2F9DA'}/>
   <Text style={utility?styles.utilityText:styles.doorText} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
  </Pressable>
 );
 return <View accessibilityLabel="BUKLOD character guide outside the World Map" style={styles.guide}>
  <View style={styles.row}>
   <Animated.View style={[styles.portrait,{transform:[{translateY:lift}]}]}>
    <MaterialCommunityIcons name="account-circle-outline" size={92} color="#82BC9A" style={styles.fallback}/>
    <BuklodActiveCharacterArt fallbackCharacter={DEFAULT_CHARACTER} height={126} viewportWidth={108} showEffects={false}/>
    <Animated.View pointerEvents="none" style={[styles.wave,{transform:[{rotate:turn}]}]}>
      <MaterialCommunityIcons name="hand-wave-outline" color="#FFF2C9" size={25}/>
    </Animated.View>
   </Animated.View>
   <View style={styles.greetingBlock}>
    <Text style={styles.greeting}>Hello! Ano ang gagawin natin sa BUKLOD?</Text>
    <Text style={styles.hint}>Ako ang BUKLOD Guide. Pumili ng pupuntahan o magtanong.</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={minimized?'Expand BUKLOD Guide':'Minimize BUKLOD Guide'}
    onPress={()=>setMinimized(v=>!v)} style={styles.collapse}>
    <MaterialCommunityIcons name={minimized?'chevron-down':'chevron-up'} size={22} color="#FFE9B6"/>
   </Pressable>
  </View>
  {!minimized?<React.Fragment>
   <View accessibilityLabel="BUKLOD activity suggestions" style={styles.doors}>
    {SUGGESTIONS.map(d=>door(d))}
   </View>
   <View style={styles.utilities}>
    {UTILITIES.map(d=>door(d,true))}
    <Pressable accessibilityRole="button" accessibilityLabel="Ask BUKLOD Guide"
     accessibilityState={{expanded:askOpen}} onPress={()=>{setAskOpen(v=>!v);setAnswer(null);}}
     style={({pressed})=>[styles.utility,pressed&&styles.pressed]}>
     <MaterialCommunityIcons name="help-circle-outline" size={18} color="#FFE4AC"/>
     <Text style={styles.utilityText}>Ask</Text>
    </Pressable>
   </View>
   {askOpen?<View style={styles.askRow}>
    <TextInput accessibilityLabel="Ask BUKLOD Guide about features" placeholder="Ano ang kailangan mo?"
      placeholderTextColor="#B6CAC3" value={question}
      onChangeText={v=>{setQuestion(v.slice(0,150));setAnswer(null);}}
      onSubmitEditing={find} returnKeyType="search" style={styles.input}/>
    <Pressable accessibilityRole="button" accessibilityLabel={answer?'Open '+answer.label:'Find guide destination'}
      onPress={()=>answer?open(answer.route):find()} style={styles.find}>
      <Text style={styles.findText}>{answer?'Open '+answer.label:'Find'}</Text>
    </Pressable>
   </View>:null}
  </React.Fragment>:null}
 </View>;
}
const styles=StyleSheet.create({
 guide:{width:'100%',padding:9,gap:7,backgroundColor:'rgba(10,43,36,.97)',borderRadius:16,borderWidth:1,borderColor:'#8CA77A'},
 row:{flexDirection:'row',alignItems:'center',gap:7},
 portrait:{width:110,height:130,justifyContent:'flex-end',overflow:'hidden'},
 fallback:{position:'absolute',left:3,top:5},wave:{position:'absolute',right:0,top:1},
 greetingBlock:{flex:1,minWidth:0,gap:3},
 greeting:{fontSize:16,lineHeight:21,fontWeight:'900',color:'#FFE6AD'},
 hint:{fontSize:10,lineHeight:14,color:'#E0EEE6'},
 collapse:{minWidth:38,minHeight:44,alignItems:'center',justifyContent:'center'},
 doors:{flexDirection:'row',flexWrap:'wrap',gap:6},
 door:{width:'30%',flexGrow:1,minHeight:44,paddingHorizontal:5,flexDirection:'row',
  alignItems:'center',justifyContent:'center',gap:4,backgroundColor:'#245344',borderRadius:10,borderWidth:1,borderColor:'#689478'},
 doorText:{fontSize:11,fontWeight:'900',color:'#FFFFFF'},
 utilities:{flexDirection:'row',flexWrap:'wrap',gap:6},
 utility:{flexGrow:1,minHeight:44,paddingHorizontal:7,flexDirection:'row',alignItems:'center',justifyContent:'center',
  gap:4,backgroundColor:'#2B403A',borderRadius:10,borderWidth:1,borderColor:'#978765'},
 utilityText:{fontSize:10,fontWeight:'900',color:'#FFE8C7'},pressed:{opacity:0.72},
 askRow:{flexDirection:'row',alignItems:'center',gap:6},
 input:{flex:1,minWidth:70,minHeight:44,backgroundColor:'#183B35',borderWidth:1,borderColor:'#72927A',
  borderRadius:10,color:'#FFFFFF',fontSize:12,paddingHorizontal:10},
 find:{minHeight:44,paddingHorizontal:11,justifyContent:'center',alignItems:'center',backgroundColor:'#3C7055',borderRadius:10},
 findText:{fontSize:11,fontWeight:'900',color:'#FFF0CF'},
});
