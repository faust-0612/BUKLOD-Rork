import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Text,View} from 'react-native';
import Svg,{Circle,Path,Defs,LinearGradient,Stop} from 'react-native-svg';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {withBuklodTimeout} from '@/lib/buklodAsyncTimeout';
import {createBuklodAvatarBatchLookup} from '@/lib/buklodAvatarBatch';

// The backend returns only the protected official principal when present in the batch.
// No names, client roles, member rank or reward balances can grant this badge.
const lookup=createBuklodAvatarBatchLookup(async(_viewer,ids)=>{
 const {data,error}=await withBuklodTimeout<any>((supabase as any).rpc('get_buklod_supreme_authority_v1',{p_user_ids:ids}),5000,'Official authority');
 if(error)throw error;
 return (Array.isArray(data)?data:[]).map((r:any)=>({user_id:r.user_id,avatar_url:'supreme'}));
},{positiveTtlMs:60000,negativeTtlMs:60000});
export function SupremeAuthorityBadge({userId,compact=false,size=20,animate=false}:{userId?:string|null;compact?:boolean;size?:number;animate?:boolean}){
 const {user}=useAuth();
 const viewer=user?.id??'';
 const target=String(userId??'').trim();
 const key=viewer+':'+target;
 const [verified,setVerified]=useState('');
 const scale=useRef(new Animated.Value(1)).current;
 useEffect(()=>{let live=true;setVerified('');
 if(viewer&&target){
 const warm=lookup.peek(viewer,target);
 if(warm.value==='supreme')setVerified(key);
 void lookup.resolve(viewer,target).then(v=>{if(live)setVerified(v==='supreme'?key:'');}).catch(()=>{});
 }
 return()=>{live=false;};},[viewer,target,key]);
 const visible=!!viewer&&!!target&&verified===key;
 useEffect(()=>{if(!visible||!animate)return;let live=true;let motion:Animated.CompositeAnimation|undefined;
 const stop=()=>{motion?.stop();scale.setValue(1);};
 let changed=false;
 const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{changed=true;if(v)stop();});
 void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(!live||changed||v)return;motion=Animated.sequence([Animated.timing(scale,{toValue:1.09,duration:350,useNativeDriver:true,isInteraction:false}),Animated.timing(scale,{toValue:1,duration:450,useNativeDriver:true,isInteraction:false})]);motion.start();}).catch(()=>{});
 return()=>{live=false;sub.remove();stop();};},[visible,animate,scale]);
 if(!visible)return null;
 return <View accessible accessibilityLabel="BUKLOD Supreme — highest system authority" style={{flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start'}}>
 <Animated.View style={{transform:[{scale}]}}><Svg width={size} height={size} viewBox="0 0 100 100">
 <Defs><LinearGradient id="supremeGold" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#FFF8CE"/><Stop offset="50%" stopColor="#E5B54B"/><Stop offset="1" stopColor="#A56B16"/></LinearGradient></Defs>
 <Circle cx="50" cy="50" r="48" fill="#142C25" stroke="url(#supremeGold)" strokeWidth="4"/>
 <Path d="M50 3 L57 21 77 12 78 32 97 50 78 58 88 78 64 79 50 97 36 79 12 78 22 58 3 50 22 32 23 12 43 21Z" fill="url(#supremeGold)"/>
 <Circle cx="50" cy="50" r="30" fill="#153D2C" stroke="#FFF3B4" strokeWidth="2"/>
 <Path d="M28 37 L39 48 50 29 61 48 72 37 66 65 34 65Z M35 70 H65 V75 H35Z" fill="#FFF4C0"/>
 </Svg></Animated.View>
 {!compact&&<Text style={{fontSize:Math.max(10,Math.min(15,size*.48)),fontWeight:'900',color:'#FFF3C0',backgroundColor:'#273D2D',borderRadius:5,paddingHorizontal:5,paddingVertical:2}}>BUKLOD SUPREME</Text>}
 </View>;
}
