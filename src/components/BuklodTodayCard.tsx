import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';

type Reaction='helpful'|'heart'|'relate';
type Tip={
  week_start:string;tip_index:number;category:string;title:string;
  lead:string;continuation:string;weekly_action:string;
  my_reaction:Reaction|null;my_dugtong:string|null;
  authenticated:boolean;points_enabled:boolean;
};
const REACTIONS:{id:Reaction;label:string;icon:React.ComponentProps<typeof MaterialCommunityIcons>['name']}[]=[
  {id:'helpful',label:'Helpful',icon:'lightbulb-on-outline'},
  {id:'heart',label:'Love this',icon:'heart-outline'},
  {id:'relate',label:'Relate',icon:'hand-heart-outline'},
];

/** Weekly editorial tips, one reaction and meaningful Dugtong per signed-in member.
 * Server verifies all awards; the client never manufactures or assumes points. */
export default function BuklodTodayCard({onRespond}:{onRespond?:(draft?:string)=>void}){
 const [tip,setTip]=useState<Tip|null>(null);
 const [unavailable,setUnavailable]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState('');
 const [editing,setEditing]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const load=useCallback(async(preserveDraft=false)=>{
  try{
    const {data,error:rpcError}=await (supabase as any).rpc('get_buklod_weekly_tip_v1');
    if(rpcError)throw rpcError;
    if(!data?.title||!data?.week_start)throw Error('Weekly tips unavailable');
    setTip(data as Tip);
    if(!preserveDraft){
      setDraft(typeof data.my_dugtong==='string'?data.my_dugtong:'');
      setEditing(false);
    }
    setUnavailable(false);
  }catch{setUnavailable(true);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const submit=async(reaction:Reaction|null,dugtong:string|null)=>{
  if(busy||!tip)return;
  setBusy(true);setError('');setNotice('');
  try{
    const {data,error:rpcError}=await (supabase as any).rpc('react_to_buklod_weekly_tip_v1',{
      p_reaction:reaction,p_dugtong:dugtong,
    });
    if(rpcError)throw rpcError;
    if(data?.ok!==true)throw Error('Action could not be confirmed.');
    // The server confirmed the write. Show the Dugtong immediately, including
    // when the subsequent read fails on a weak network; never optimistically award BP.
    setTip(current=>current?{
      ...current,
      my_reaction:reaction??current.my_reaction,
      my_dugtong:dugtong??current.my_dugtong,
    }:current);
    if(dugtong!==null)setEditing(false);
    const credited=Math.max(0,Math.trunc(Number(data.awarded_points)||0));
    setNotice(credited>0
      ?'+'+credited+' BP recorded. Claim your pending reward in BUKLOD Points.'
      :dugtong!==null?'Na-save ang Dugtong mo. Walang dobleng BP para sa edit.'
      :'Na-save ang reaction mo. Walang dobleng BP ngayong linggo.');
    await load(true);
  }catch(e:any){setError(String(e?.message||'Could not save your weekly interaction.'));}
  finally{setBusy(false);}
 };
 if(loading)return <View style={s.shell}><ActivityIndicator color="#17644B"/></View>;
 if(!tip)return <View style={s.shell}>
  <Text style={s.eyebrow}>BUKLOD TODAY • WEEKLY TIPS</Text>
  <Text style={s.title}>Helpful weekly tips</Text>
  <Text style={s.body}>This week's tips are unavailable. Existing Wall and Points features are unaffected.</Text>
  {unavailable&&<Pressable onPress={()=>{setLoading(true);void load();}}>
    <Text style={s.link}>Retry loading tips</Text></Pressable>}
 </View>;
 const hasSavedDugtong=!!tip.my_dugtong?.trim();
 const unchangedDugtong=hasSavedDugtong&&draft.trim()===tip.my_dugtong?.trim();
 return <View style={s.shell}>
  <View style={s.head}>
    <View style={{flex:1}}>
      <Text style={s.eyebrow}>BUKLOD TODAY • WEEKLY TIPS</Text>
      <Text style={s.sub}>{tip.category.replace(/_/g,' ')} · Week of {tip.week_start}</Text>
    </View>
    <MaterialCommunityIcons name="heart-pulse" size={23} color="#17644B"/>
  </View>
  <Text style={s.title}>{tip.title}</Text>
  <Text style={s.body}>{tip.lead}</Text>
  {open&&<View style={s.continuation}>
    <Text style={s.body}>{tip.continuation}</Text>
    <Text style={s.action}>{tip.weekly_action}</Text>
    <Text style={s.disclaimer}>General wellbeing guidance only, not a diagnosis or substitute for professional advice.</Text>
  </View>}
  <Pressable accessibilityRole="button" accessibilityState={{expanded:open}}
    onPress={()=>setOpen(v=>!v)} style={s.read}>
    <Text style={s.link}>{open?'Show less':'Continue reading'}</Text>
    <MaterialCommunityIcons name={open?'chevron-up':'chevron-down'} size={18} color="#17644B"/>
  </Pressable>
  {hasSavedDugtong&&<View style={s.savedDugtong} accessibilityLabel="Ang na-save mong personal na Dugtong">
    <View style={s.savedHead}>
      <MaterialCommunityIcons name="check-circle-outline" size={19} color="#17644B"/>
      <Text style={s.savedTitle}>Ang Dugtong mo</Text>
      <Text style={s.privateLabel}>Pribado</Text>
    </View>
    <Text style={s.savedBody}>{tip.my_dugtong}</Text>
    {!editing&&<Pressable accessibilityRole="button" onPress={()=>setEditing(true)}>
      <Text style={s.link}>I-edit ang Dugtong</Text>
    </Pressable>}
    <Text style={s.savedHint}>Naka-save sa account mo. Hindi ito awtomatikong post sa Wall.</Text>
  </View>}
  <Text style={s.section}>React to this week's tip</Text>
  <View style={s.reactions}>
    {REACTIONS.map(item=><Pressable key={item.id} accessibilityRole="button"
      accessibilityState={{selected:tip.my_reaction===item.id}}
      disabled={busy||!tip.authenticated}
      onPress={()=>void submit(item.id,null)}
      style={[s.reaction,tip.my_reaction===item.id&&s.selected]}>
      <MaterialCommunityIcons name={item.icon} size={17} color="#17644B"/>
      <Text style={s.reactionText}>{item.label}</Text>
    </Pressable>)}
  </View>
  {(!hasSavedDugtong||editing)&&<>
    <Text style={s.section}>{hasSavedDugtong?'Baguhin ang Dugtong':'Dugtong: Ano ang natutuhan mo?'}</Text>
    <TextInput value={draft} onChangeText={setDraft} multiline
      accessibilityLabel="Weekly tip Dugtong"
      placeholder="Ibahagi ang isang konkretong hakbang o insight (30 characters minimum)."
      placeholderTextColor="#87998D" maxLength={1200}
      style={s.input}/>
  </>}
  <View style={s.actions}>
    {(!hasSavedDugtong||editing)&&<Pressable
      disabled={busy||!tip.authenticated||draft.trim().length<30||unchangedDugtong}
      accessibilityRole="button" onPress={()=>void submit(null,draft.trim())}
      style={[s.primary,(busy||!tip.authenticated||draft.trim().length<30||unchangedDugtong)&&s.disabled]}>
      <Text style={s.primaryText}>{busy?'Saving…':hasSavedDugtong?'I-update ang Dugtong':'Save Dugtong'}</Text>
    </Pressable>}
    {hasSavedDugtong&&editing&&<Pressable accessibilityRole="button" disabled={busy}
      onPress={()=>{setDraft(tip.my_dugtong??'');setEditing(false);}} style={s.secondary}>
      <Text style={s.link}>Kanselahin</Text>
    </Pressable>}
    {!!onRespond&&<Pressable accessibilityRole="button"
      onPress={()=>onRespond(draft.trim()||tip.my_dugtong||tip.title+' — '+tip.lead)}
      style={s.secondary}><Text style={s.link}>Share to Wall</Text></Pressable>}
  </View>
  {!tip.authenticated&&<Text style={s.help}>Sign in to react or save your Dugtong.</Text>}
  {tip.points_enabled&&<Text style={s.help}>Verified Points: first weekly reaction +1 BP, first meaningful Dugtong +2 BP. Repeat edits do not earn again.</Text>}
  {!!notice&&<Pressable onPress={()=>router.push('/points' as any)}><Text style={s.notice}>{notice}</Text></Pressable>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 </View>;
}
const s=StyleSheet.create({
 shell:{width:'100%',backgroundColor:'#FDF8FF',borderWidth:2,borderColor:'#AD65FF',
   borderRadius:12,padding:14,gap:10,marginHorizontal:0,marginBottom:4,
   shadowColor:'#A020F0',shadowOffset:{width:0,height:0},shadowOpacity:.22,shadowRadius:10,elevation:5},
 head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:.7,color:'#17644B'},
 sub:{fontSize:11,color:'#64796A',marginTop:3,textTransform:'capitalize'},
 title:{fontSize:18,fontWeight:'900',color:'#183D2C',lineHeight:24},
 body:{color:'#45594B',fontSize:13,lineHeight:20},
 continuation:{gap:8,padding:12,backgroundColor:'#F4FAF6',borderRadius:4},
 action:{color:'#1F6C48',fontWeight:'800',fontSize:12,lineHeight:19},
 disclaimer:{color:'#6E7D73',fontSize:10,lineHeight:16},
 read:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,paddingVertical:4},
 link:{color:'#17644B',fontWeight:'800',fontSize:12},
 section:{fontSize:12,fontWeight:'900',color:'#204C34'},
 savedDugtong:{padding:12,borderWidth:1,borderColor:'#CFE1D4',
   borderRadius:6,backgroundColor:'#EFF8F1',gap:8},
 savedHead:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},
 savedTitle:{fontSize:14,fontWeight:'900',color:'#17644B',flexGrow:1},
 privateLabel:{fontSize:11,color:'#66766C',fontWeight:'700'},
 savedBody:{fontSize:14,lineHeight:21,color:'#183D2C'},
 savedHint:{fontSize:11,lineHeight:17,color:'#66766C'},
 reactions:{flexDirection:'row',flexWrap:'wrap',gap:7},
 reaction:{flexDirection:'row',alignItems:'center',gap:5,borderWidth:1,borderColor:'#CFE1D4',
   borderRadius:4,paddingVertical:8,paddingHorizontal:10},
 selected:{backgroundColor:'#E2F4E9',borderColor:'#17644B'},
 reactionText:{fontSize:11,fontWeight:'800',color:'#17644B'},
 input:{minHeight:73,borderWidth:1,borderColor:'#CFE1D4',borderRadius:4,
   textAlignVertical:'top',padding:10,fontSize:12,color:'#183D2C'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},
 primary:{paddingHorizontal:16,paddingVertical:11,borderRadius:4,backgroundColor:'#17644B'},
 primaryText:{color:'#FFFFFF',fontWeight:'900',fontSize:12},
 secondary:{padding:10},disabled:{opacity:.45},
 help:{fontSize:11,color:'#65786B',lineHeight:17},
 notice:{backgroundColor:'#E5F7E8',color:'#17644B',fontWeight:'800',padding:10,fontSize:12},
 error:{backgroundColor:'#FDE8E8',color:'#9B2226',padding:10,fontSize:12}
});
