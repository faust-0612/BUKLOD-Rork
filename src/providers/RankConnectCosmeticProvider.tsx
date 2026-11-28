import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAuth} from '@/providers/AuthProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {supabase} from '@/lib/supabase';
import {withBuklodTimeout} from '@/lib/buklodAsyncTimeout';

const ACCENTS=[
 {id:'emerald',label:'Emerald',order:7,color:'#319B76'},
 {id:'amethyst',label:'Amethyst',order:12,color:'#9D85DD'},
 {id:'bronze',label:'Golden Bronze',order:17,color:'#CF9D56'},
 {id:'aurora',label:'Aurora',order:22,color:'#37BEC4'},
 {id:'ember',label:'Ember',order:27,color:'#F28A72'},
 {id:'nebula',label:'Royal Nebula',order:32,color:'#809BFA'},
 {id:'divine',label:'Divine Light',order:37,color:'#E2C979'},
] as const;
type Accent=typeof ACCENTS[number];
type State={owner:string;order:number;selected:string;official?:boolean};
type Context={enabled:boolean;official?:boolean;order:number;accent:Accent|null;choose:(id:string)=>void};
const DEFAULT:Context={enabled:false,order:0,accent:null,choose:()=>{}};
const RankConnectContext=createContext<Context>(DEFAULT);
export function useRankConnectCosmetic(){return useContext(RankConnectContext);}
export function RankConnectCosmeticProvider({children}:{children:React.ReactNode}){
 const {user,hasRole}=useAuth();const {config}=useRuntimeConfig();
 const owner=user?.id??'';const candidate=hasRole('system_admin');const enabled=!!owner&&config?.features?.rank_connect_cosmetics===true;
 const [state,setState]=useState<State>({owner:'',order:0,selected:''});
 useEffect(()=>{
  if(!enabled)return;
  let live=true;
  void(async()=>{try{
    const [rank,selected]=await Promise.all([
      withBuklodTimeout<any>(candidate?(supabase as any).rpc('get_buklod_official_identity_v1',{p_user_id:owner}):supabase.rpc('get_my_buklod_rank_progress'),5000,'rank cosmetic'),
      AsyncStorage.getItem('buklod:connect:rank-accent:v1:'+owner)
    ]);
    if(!live||rank.error)return;
    if(candidate){if(rank.data===true)setState({owner,order:0,official:true,selected:selected??''});return;}
    const order=Number(Array.isArray(rank.data)?rank.data[0]?.rank_order:0);
    if(Number.isInteger(order)&&order>=1&&order<=40)setState({owner,order,selected:selected??''});
  }catch{/* Keep default theme if rank cannot be verified. */}})();
  return()=>{live=false;};
 },[enabled,owner,candidate]);
 const value=useMemo<Context>(()=>{
  if(!enabled||state.owner!==owner||Boolean(state.official)!==candidate)return DEFAULT;
  const accent=ACCENTS.find(a=>a.id===state.selected&&(state.official||a.order<=state.order))??null;
  return {enabled:true,official:state.official,order:state.order,accent,choose(id){
   if(id&&!ACCENTS.some(a=>a.id===id&&(state.official||a.order<=state.order)))return;
   setState(prev=>prev.owner===owner?{...prev,selected:id}:prev);
   void AsyncStorage.setItem('buklod:connect:rank-accent:v1:'+owner,id).catch(()=>{});
  }};
 },[enabled,owner,state,candidate]);
 return <RankConnectContext.Provider value={value}>{children}</RankConnectContext.Provider>;
}
export function RankConnectCosmeticButton(){
 const {enabled,official,order,accent,choose}=useRankConnectCosmetic();const [open,setOpen]=useState(false);
 if(!enabled)return null;
 return <><Pressable accessibilityRole="button" accessibilityLabel="Rank message accents" onPress={()=>setOpen(true)} style={{padding:8}}><Text style={{color:'#319B76',fontSize:19}}>✧</Text></Pressable>
 <Modal visible={open} transparent animationType="none" onRequestClose={()=>setOpen(false)}>
 <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:20}}>
 <View style={{backgroundColor:'#FFF',borderRadius:18,padding:16,maxHeight:'80%'}}>
 <Text style={{fontSize:18,fontWeight:'800',color:'#15382D'}}>Rank message accents</Text>
 <Text style={{color:'#43564C',marginVertical:8}}>Personal outgoing text accents on this device only. Chat theme and message delivery stay unchanged.</Text>
 <ScrollView>
 <Pressable onPress={()=>choose('')} style={{paddingVertical:12}}><Text style={{color:'#15382D'}}>{!accent?'✓ ':''}Default</Text></Pressable>
 {ACCENTS.map(a=><Pressable key={a.id} disabled={!official&&order<a.order} accessibilityState={{disabled:!official&&order<a.order,selected:accent?.id===a.id}} onPress={()=>choose(a.id)} style={{padding:12,borderLeftWidth:3,borderColor:a.color,opacity:!official&&order<a.order?0.5:1}}>
 <Text style={{color:'#15382D'}}>{accent?.id===a.id?'✓ ':''}{a.label}{!official&&order<a.order?' · unlock at rank '+a.order:''}</Text></Pressable>)}
 </ScrollView><Pressable onPress={()=>setOpen(false)} style={{padding:12}}><Text style={{color:'#075B30',fontWeight:'800'}}>Done</Text></Pressable>
 </View></View></Modal></>;
}
