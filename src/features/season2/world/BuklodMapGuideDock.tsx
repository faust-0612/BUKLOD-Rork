/** Large animated human guide OUTSIDE the map; activity suggestions, not duplicate main navigation. */
import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Image,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {resolveBuklodGuideDestination} from './guideDestinations';

const GUIDE_POSES = [
  require('../../../../assets/buklod-guide/wave.png'),
  require('../../../../assets/buklod-guide/celebrate.png'),
  require('../../../../assets/buklod-guide/think.png'),
] as const;
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type SuggestedAction = {label:string;icon:Icon;route:string};
const SUGGESTIONS:readonly SuggestedAction[]=[
  {label:'Gusto mong may makasama?',icon:'account-group-outline',route:'/clusters'},
  {label:'Maglaro?',icon:'gamepad-variant-outline',route:'/season2/games'},
  {label:'Matuto?',icon:'book-open-variant',route:'/season2/learnings'},
  {label:'Makipag-usap?',icon:'chat-processing-outline',route:'/buklod'},
];
const UTILITIES:readonly SuggestedAction[]=[
  {label:'Settings Engine',icon:'cog-outline',route:'/settings'},
  {label:'My BUKLOD',icon:'home-heart',route:'/season2/my-world'},
];
export default function BuklodMapGuideDock({active,artworkEmbedded=false}:{active:boolean;artworkEmbedded?:boolean}){
  const {activeScope}=useBuklodScope();
  const [minimized,setMinimized]=useState(false);
  const [askOpen,setAskOpen]=useState(false);
  const [question,setQuestion]=useState('');
  const [answer,setAnswer]=useState<{label:string;route:string}|null>(null);
  const [reducedMotion,setReducedMotion]=useState(true);
  const float=useRef(new Animated.Value(0)).current;
  const poseFade=useRef(new Animated.Value(1)).current;
  const [poseIndex,setPoseIndex]=useState(0);
  useEffect(()=>{
    let live=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReducedMotion(v);}).catch(()=>undefined);
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    float.stopAnimation();poseFade.stopAnimation();
    if(!active||reducedMotion||artworkEmbedded){float.setValue(0);poseFade.setValue(1);setPoseIndex(0);return;}
    const bob=Animated.loop(Animated.sequence([
      Animated.timing(float,{toValue:1,duration:1450,useNativeDriver:true}),
      Animated.timing(float,{toValue:0,duration:1450,useNativeDriver:true}),
    ]));
    const poses=setInterval(()=>{
      poseFade.setValue(.55);
      setPoseIndex(index=>(index+1)%GUIDE_POSES.length);
      Animated.timing(poseFade,{toValue:1,duration:260,useNativeDriver:true,isInteraction:false}).start();
    },4400);
    bob.start();
    return()=>{bob.stop();clearInterval(poses);poseFade.stopAnimation();};
  },[active,artworkEmbedded,reducedMotion,float,poseFade]);
  const find=()=>setAnswer(resolveBuklodGuideDestination(question,Boolean(activeScope?.show_faith_content)));
  const open=(route:string)=>router.push(route as any);
  const pick=(item:SuggestedAction,small=false)=><Pressable key={item.label}
    accessibilityRole="button" accessibilityLabel={'Open '+item.label}
    onPress={()=>open(item.route)}
    style={({pressed})=>[small?styles.utility:styles.prompt,pressed&&styles.pressed]}>
    <MaterialCommunityIcons name={item.icon} size={small?18:19} color="#FFE8B6"/>
    <Text style={small?styles.utilityText:styles.promptText} numberOfLines={2}
      adjustsFontSizeToFit minimumFontScale={.78}>{item.label}</Text>
  </Pressable>;
  return <View style={artworkEmbedded?styles.inlineUtilities:styles.guide} accessibilityLabel="BUKLOD Guide and feature actions outside the world map">
    {!artworkEmbedded?
    <View style={styles.top}>
      <Animated.View style={[styles.avatarWrap,{transform:[
        {translateY:float.interpolate({inputRange:[0,1],outputRange:[0,-5]})}
      ]}]}>
        <Animated.Image source={GUIDE_POSES[poseIndex]} resizeMode="cover" style={[styles.avatar,{opacity:poseFade}]}/>
      </Animated.View>
      <View style={styles.content}>
        <View style={styles.welcomeLine}>
          <View style={{flex:1,minWidth:0}}>
            <Text style={styles.greeting}>Welcome sa BUKLOD!</Text>
            <Text style={styles.sub}>Saan tayo magsisimula ngayon?</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={minimized?'Expand BUKLOD Guide':'Minimize BUKLOD Guide'}
            onPress={()=>setMinimized(v=>!v)} style={styles.collapse}>
            <MaterialCommunityIcons name={minimized?'chevron-down':'chevron-up'} size={19} color="#FFE5A9"/>
          </Pressable>
        </View>
        {!minimized?<View style={styles.prompts}>{SUGGESTIONS.map(item=>pick(item))}</View>:null}
      </View>
    </View>
    :null}
    {!minimized?<View style={styles.actions}>
      {UTILITIES.map(item=>pick(item,true))}
      <Pressable accessibilityRole="button" accessibilityLabel="Ask the BUKLOD Guide"
        accessibilityState={{expanded:askOpen}} onPress={()=>{setAskOpen(v=>!v);setAnswer(null);}}
        style={styles.utility}>
        <MaterialCommunityIcons name="help-circle-outline" color="#FFE8B6" size={18}/>
        <Text style={styles.utilityText}>Ask Guide</Text>
      </Pressable>
    </View>:null}
    {!minimized&&askOpen?<View style={styles.askRow}>
      <TextInput accessibilityLabel="Ask BUKLOD Guide about a feature"
        placeholder="Ano ang gusto mong gawin?" placeholderTextColor="#A7C6B7"
        value={question} onChangeText={v=>{setQuestion(v.slice(0,150));setAnswer(null);}}
        onSubmitEditing={find} returnKeyType="search" style={styles.input}/>
      <Pressable accessibilityRole="button" accessibilityLabel={answer?'Open '+answer.label:'Find BUKLOD feature'}
        onPress={()=>answer?open(answer.route):find()} style={styles.find}>
        <Text style={styles.findText}>{answer?'Buksan':'Hanapin'}</Text>
      </Pressable>
      {answer?<Text accessibilityLiveRegion="polite" style={styles.answer}>{answer.label}</Text>:null}
    </View>:null}
  </View>;
}
const styles=StyleSheet.create({
 inlineUtilities:{padding:4,gap:3,backgroundColor:'rgba(9,35,36,.90)',borderRadius:12},
 guide:{padding:9,gap:6,backgroundColor:'rgba(9,35,36,.96)',borderWidth:1,
   borderColor:'#B5B486',borderRadius:18},
 top:{flexDirection:'row',alignItems:'center',gap:8},
 avatarWrap:{width:127,height:138,borderRadius:20,overflow:'hidden',
   borderWidth:1,borderColor:'#F4DC9D',backgroundColor:'#E8EBD5'},
 avatar:{width:'100%',height:'100%'},
 content:{flex:1,minWidth:0,gap:6},
 welcomeLine:{minHeight:47,flexDirection:'row',alignItems:'center',gap:3},
 greeting:{fontSize:17,lineHeight:21,fontWeight:'900',color:'#FFE5A8'},
 sub:{fontSize:11,lineHeight:14,color:'#F0F5EA',fontWeight:'600',marginTop:2},
 collapse:{minWidth:30,minHeight:38,alignItems:'center',justifyContent:'center'},
 prompts:{flexDirection:'row',flexWrap:'wrap',gap:5},
 prompt:{width:'47%',flexGrow:1,minHeight:39,paddingHorizontal:5,paddingVertical:4,
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,
   borderRadius:12,borderWidth:1,borderColor:'rgba(205,226,174,.67)',
   backgroundColor:'rgba(39,91,72,.90)'},
 promptText:{flex:1,minWidth:0,fontSize:10,lineHeight:12,fontWeight:'800',color:'#FFF7E9'},
 actions:{flexDirection:'row',gap:5},
 utility:{flex:1,minWidth:0,minHeight:40,flexDirection:'row',alignItems:'center',
   justifyContent:'center',gap:3,paddingHorizontal:4,
   backgroundColor:'#183D35',borderRadius:10,borderWidth:1,borderColor:'#8B9C79'},
 utilityText:{fontSize:10,fontWeight:'800',color:'#FFE8C7',flexShrink:1},
 pressed:{opacity:.70},
 askRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
 input:{flex:1,minWidth:140,minHeight:44,paddingHorizontal:10,borderRadius:9,
   backgroundColor:'#153B33',color:'#FFFFFF',borderColor:'#6F907A',borderWidth:1},
 find:{minHeight:44,paddingHorizontal:12,justifyContent:'center',
   backgroundColor:'#3A7953',borderRadius:9},
 findText:{fontWeight:'900',color:'#FFFFFF',fontSize:12},
 answer:{width:'100%',fontSize:11,color:'#FCE4AD'},
});
