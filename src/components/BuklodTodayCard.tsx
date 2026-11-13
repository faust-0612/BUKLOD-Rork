import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';

type Reaction='helpful'|'heart'|'relate';
type Visibility='public'|'private';
type PublicDugtong={display_name:string;dugtong:string;created_at:string;is_mine:boolean};
type MyHistory={cycle_id:number;title:string;dugtong:string;visibility:Visibility;date:string};
type Tip={
 cycle_id:number;cycle_started_at:string;next_idle_at:string;tip_index:number;
 category:string;title:string;lead:string;continuation:string;weekly_action:string;
 my_reaction:Reaction|null;my_dugtong:string|null;my_visibility:Visibility;
 dugtongs:PublicDugtong[];dugtong_total:number;
 authenticated:boolean;points_enabled:boolean;
};
const REACTIONS:{id:Reaction;label:string;icon:React.ComponentProps<typeof MaterialCommunityIcons>['name']}[]=[
 {id:'helpful',label:'Helpful',icon:'lightbulb-on-outline'},
 {id:'heart',label:'Love this',icon:'heart-outline'},
 {id:'relate',label:'Relate',icon:'hand-heart-outline'},
];

/** Activity-driven community tips; all public Dugtong are displayed here, not sent to Wall.
 * Public is an explicit save choice; earlier private Dugtong stay private after migration.
 * BP is credited only by the server's existing once-per-Manila-week ledger keys. */
export default function BuklodTodayCard(){
 const [tip,setTip]=useState<Tip|null>(null);
 const [unavailable,setUnavailable]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState('');
 const [visibility,setVisibility]=useState<Visibility>('public');
 const [editing,setEditing]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [showHistory,setShowHistory]=useState(false);
 const [history,setHistory]=useState<MyHistory[]>([]);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [feedRows,setFeedRows]=useState<PublicDugtong[]>([]);
 const [feedLoading,setFeedLoading]=useState(false);
 const [feedHasMore,setFeedHasMore]=useState(false);
 const cycleRef=useRef<number|null>(null);
 const load=useCallback(async(preserveDraft=false)=>{
  try{
   const {data,error:rpcError}=await (supabase as any).rpc('get_buklod_today_tip_v2');
   if(rpcError)throw rpcError;
   if(!data?.title||!Number.isFinite(Number(data.cycle_id)))throw Error('BUKLOD Today unavailable');
   const parsed=data as Tip;
   const nextCycle=Number(parsed.cycle_id);
   const changed=cycleRef.current!==nextCycle;
   cycleRef.current=nextCycle;
   setTip(parsed);
   const initialFeed=Array.isArray(parsed.dugtongs)?parsed.dugtongs:[];
   setFeedRows(initialFeed);
   setFeedHasMore(Number(parsed.dugtong_total)>initialFeed.length);
   if(!preserveDraft||changed){
    setDraft(typeof parsed.my_dugtong==='string'?parsed.my_dugtong:'');
    setVisibility(parsed.my_visibility==='private'?'private':'public');
    setEditing(false);
   }
   setUnavailable(false);
  }catch{setUnavailable(true);}
  finally{setLoading(false);}
 },[]);
 const loadHistory=useCallback(async()=>{
  setHistoryLoading(true);
  try{
   const {data,error:rpcError}=await (supabase as any).rpc('get_my_buklod_today_dugtong_history_v2');
   if(rpcError)throw rpcError;
   setHistory(Array.isArray(data)?data:[]);
  }catch{setError('Hindi ma-load ang mga dating Dugtong. Subukan muli.');}
  finally{setHistoryLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const sub=AppState.addEventListener('change',state=>{
   if(state==='active')void load(true);
  });
  return()=>sub.remove();
 },[load]);
 const submit=async(reaction:Reaction|null,dugtong:string|null)=>{
  if(busy||!tip)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:rpcError}=await (supabase as any).rpc('react_to_buklod_today_tip_v2',{
    p_cycle_id:tip.cycle_id,p_reaction:reaction,p_dugtong:dugtong,
    p_visibility:dugtong!==null?visibility:null,
   });
   if(rpcError)throw rpcError;
   if(data?.ok!==true)throw Error('Action could not be confirmed.');
   // Confirm server write before presenting success; offline retries remain safe.
   setTip(current=>current&&current.cycle_id===tip.cycle_id?{
    ...current,my_reaction:reaction??current.my_reaction,
    my_dugtong:dugtong??current.my_dugtong,
    my_visibility:dugtong!==null?visibility:current.my_visibility,
   }:current);
   if(dugtong!==null)setEditing(false);
   const credited=Math.max(0,Math.trunc(Number(data.awarded_points)||0));
   setNotice(credited>0
    ?'+'+credited+' BP recorded. Claim your pending reward in BUKLOD Points.'
    :dugtong!==null?'Na-save ang Dugtong. Walang dobleng BP sa edit.'
    :'Na-save ang reaction. Walang dobleng BP ngayong linggo.');
   await load(true);
   if(showHistory)void loadHistory();
  }catch(e:any){
   setError(String(e?.message||'Could not save your response.'));
   void load(true); // Resolve stale cycle after 72h rotation instead of posting on a new tip.
  }finally{setBusy(false);}
 };
 const loadMore=async()=>{
  if(feedLoading||!tip)return;
  setFeedLoading(true);setError('');
  try{
   const cycleId=tip.cycle_id;
   const {data,error:rpcError}=await (supabase as any).rpc('list_buklod_today_dugtongs_v2',{
    p_cycle_id:cycleId,p_offset:feedRows.length,p_limit:30,
   });
   if(rpcError)throw rpcError;
   const next:PublicDugtong[]=Array.isArray(data)?data:[];
   if(cycleRef.current===cycleId){
    setFeedRows(previous=>previous.concat(next));
    setFeedHasMore(next.length===30 && feedRows.length+next.length<tip.dugtong_total);
   }
  }catch(e:any){setError(String(e?.message||'Hindi ma-load ang iba pang Dugtong.'));}
  finally{setFeedLoading(false);}
 };
 const changePrivacy=async(cycleId:number,value:Visibility)=>{
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error:rpcError}=await (supabase as any).rpc('set_buklod_today_dugtong_visibility_v2',{
    p_cycle_id:cycleId,p_visibility:value,
   });
   if(rpcError)throw rpcError;
   if(data!==true)throw Error('Dugtong not found.');
   if(tip?.cycle_id===cycleId){
    setVisibility(value);
    setTip(current=>current&&current.cycle_id===cycleId?{...current,my_visibility:value}:current);
    await load(true);
   }
   setHistory(rows=>rows.map(r=>r.cycle_id===cycleId?{...r,visibility:value}:r));
   setNotice(value==='private'?'Ikaw lang ang makakakita ng Dugtong na ito.':'Public na ang Dugtong at makikita ito ng lahat.');
  }catch(e:any){setError(String(e?.message||'Could not change privacy.'));}
  finally{setBusy(false);}
 };
 if(loading)return <View style={s.shell}><ActivityIndicator color="#17644B"/></View>;
 if(!tip)return <View style={s.shell}>
  <Text style={s.eyebrow}>BUKLOD TODAY • COMMUNITY TIPS</Text>
  <Text style={s.title}>Helpful tips</Text>
  <Text style={s.body}>Hindi available ang tips ngayon. Hindi apektado ang Wall at Points.</Text>
  {unavailable&&<Pressable onPress={()=>{setLoading(true);void load();}}>
   <Text style={s.link}>Retry loading tips</Text></Pressable>}
 </View>;
 const hasSavedDugtong=!!tip.my_dugtong?.trim();
 const unchangedDugtong=hasSavedDugtong&&draft.trim()===tip.my_dugtong?.trim()&&visibility===tip.my_visibility;
 const feed=feedRows;
 return <View style={s.shell}>
  <View style={s.head}>
   <View style={{flex:1}}>
    <Text style={s.eyebrow}>BUKLOD TODAY • COMMUNITY TIPS</Text>
    <Text style={s.sub}>{tip.category.replace(/_/g,' ')}</Text>
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
  {hasSavedDugtong&&<View style={s.savedDugtong} accessibilityLabel="Ang iyong na-save na Dugtong">
   <View style={s.savedHead}>
    <MaterialCommunityIcons name="check-circle-outline" size={19} color="#17644B"/>
    <Text style={s.savedTitle}>Ang Dugtong mo</Text>
    <MaterialCommunityIcons name={tip.my_visibility==='public'?'earth':'lock-outline'} size={15} color="#17644B"/>
    <Text style={s.privateLabel}>{tip.my_visibility==='public'?'Public':'Private'}</Text>
   </View>
   <Text style={s.savedBody}>{tip.my_dugtong}</Text>
   <View style={s.privacyRow}>
    {(['public','private'] as Visibility[]).map(value=><Pressable key={value}
     accessibilityRole="button" accessibilityState={{selected:tip.my_visibility===value}}
     disabled={busy} onPress={()=>void changePrivacy(tip.cycle_id,value)}
     style={[s.privacyChip,tip.my_visibility===value&&s.selected]}>
     <MaterialCommunityIcons name={value==='public'?'earth':'lock-outline'} size={15} color="#17644B"/>
     <Text style={s.privacyText}>{value==='public'?'Public':'Private'}</Text>
    </Pressable>)}
    {!editing&&<Pressable accessibilityRole="button" onPress={()=>{setDraft(tip.my_dugtong??'');setEditing(true);}}>
     <Text style={s.link}>I-edit</Text>
    </Pressable>}
   </View>
  </View>}
  <Text style={s.section}>React to this tip</Text>
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
   <TextInput value={draft} onChangeText={setDraft} multiline accessibilityLabel="BUKLOD Today Dugtong"
    placeholder="Ibahagi ang isang konkretong hakbang o insight (30 characters minimum)."
    placeholderTextColor="#87998D" maxLength={1200} style={s.input}/>
   <Text style={s.privacyTitle}>Sino ang makakakita?</Text>
   <View style={s.privacyRow}>
    {(['public','private'] as Visibility[]).map(value=><Pressable key={value}
     accessibilityRole="button" accessibilityState={{selected:visibility===value}}
     onPress={()=>setVisibility(value)} style={[s.privacyChip,visibility===value&&s.selected]}>
     <MaterialCommunityIcons name={value==='public'?'earth':'lock-outline'} size={15} color="#17644B"/>
     <Text style={s.privacyText}>{value==='public'?'Public · lahat':'Private · ikaw lang'}</Text>
    </Pressable>)}
   </View>
   <Text style={s.help}>Public ang default: makikita ang Dugtong at pangalan mo dito sa Buklod Today, hindi sa Wall.</Text>
   <View style={s.actions}>
    <Pressable disabled={busy||!tip.authenticated||draft.trim().length<30||unchangedDugtong}
     accessibilityRole="button" onPress={()=>void submit(null,draft.trim())}
     style={[s.primary,(busy||!tip.authenticated||draft.trim().length<30||unchangedDugtong)&&s.disabled]}>
     <Text style={s.primaryText}>{busy?'Saving…':hasSavedDugtong?'I-update ang Dugtong':'Save Dugtong'}</Text>
    </Pressable>
    {hasSavedDugtong&&editing&&<Pressable accessibilityRole="button" disabled={busy}
     onPress={()=>{setDraft(tip.my_dugtong??'');setVisibility(tip.my_visibility);setEditing(false);}} style={s.secondary}>
     <Text style={s.link}>Kanselahin</Text>
    </Pressable>}
   </View>
  </>}
  <View style={s.communityHead}>
   <Text style={s.section}>Mga Dugtong ng Komunidad ({tip.dugtong_total||0})</Text>
   <MaterialCommunityIcons name="account-group-outline" size={18} color="#17644B"/>
  </View>
  {feed.length?feed.map((item,index)=><View key={String(item.created_at)+index} style={s.communityEntry}>
   <Text style={s.communityAuthor}>{item.is_mine?'Ikaw':item.display_name||'BUKLOD member'}</Text>
   <Text style={s.communityBody}>{item.dugtong}</Text>
  </View>):<Text style={s.help}>Wala pang public Dugtong. Mauna kang magbahagi!</Text>}
  {feedHasMore&&<Pressable accessibilityRole="button" disabled={feedLoading}
   onPress={()=>void loadMore()} style={s.read}>
   <Text style={s.link}>{feedLoading?'Loading…':'Tingnan pa ang mga Dugtong'}</Text>
   <MaterialCommunityIcons name="chevron-down" size={18} color="#17644B"/>
  </Pressable>}
  {tip.authenticated&&<Pressable onPress={()=>{setShowHistory(v=>!v);if(!showHistory)void loadHistory();}}
   accessibilityRole="button" accessibilityState={{expanded:showHistory}} style={s.read}>
   <Text style={s.link}>{showHistory?'Itago':'Pamamahala'} ng mga dating Dugtong</Text>
   <MaterialCommunityIcons name={showHistory?'chevron-up':'chevron-down'} size={18} color="#17644B"/>
  </Pressable>}
  {showHistory&&<View style={s.history}>
   {historyLoading?<ActivityIndicator color="#17644B"/>:history.length?
    history.filter(row=>row.cycle_id!==tip.cycle_id).map(row=><View key={row.cycle_id} style={s.historyEntry}>
     <Text style={s.communityAuthor}>{row.title}</Text>
     <Text style={s.communityBody}>{row.dugtong}</Text>
     <View style={s.privacyRow}>
      {(['public','private'] as Visibility[]).map(value=><Pressable key={value}
       accessibilityRole="button" disabled={busy} accessibilityState={{selected:row.visibility===value}}
       onPress={()=>void changePrivacy(row.cycle_id,value)}
       style={[s.privacyChip,row.visibility===value&&s.selected]}>
       <Text style={s.privacyText}>{value==='public'?'Public':'Private'}</Text>
      </Pressable>)}
     </View>
    </View>):<Text style={s.help}>Wala pang dating Dugtong.</Text>}
  </View>}
  {!tip.authenticated&&<Text style={s.help}>Sign in to react or save your Dugtong.</Text>}
  {tip.points_enabled&&<Text style={s.help}>Verified Points: unang reaction +1 BP at unang makabuluhang Dugtong +2 BP bawat linggo. Walang dagdag sa repeat edits.</Text>}
  {!!notice&&<Pressable onPress={()=>router.push('/points' as any)}><Text style={s.notice}>{notice}</Text></Pressable>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {unavailable&&<Pressable accessibilityRole="button" onPress={()=>void load(true)}>
   <Text style={s.link}>Hindi na-refresh ang tip. I-retry</Text></Pressable>}
 </View>;
}
const s=StyleSheet.create({
 shell:{width:'100%',backgroundColor:'#FDF8FF',borderWidth:2,borderColor:'#AD65FF',
  borderRadius:12,padding:14,gap:10,marginHorizontal:0,marginBottom:4,
  shadowColor:'#A020F0',shadowOffset:{width:0,height:0},shadowOpacity:.22,shadowRadius:10,elevation:5},
 head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 eyebrow:{fontSize:12,fontWeight:'900',letterSpacing:.7,color:'#17644B'},
 sub:{fontSize:11,color:'#64796A',marginTop:3},
 title:{fontSize:18,fontWeight:'900',color:'#183D2C',lineHeight:24},
 body:{color:'#45594B',fontSize:13,lineHeight:20},
 continuation:{gap:8,padding:12,backgroundColor:'#F4FAF6',borderRadius:4},
 action:{color:'#1F6C48',fontWeight:'800',fontSize:12,lineHeight:19},
 disclaimer:{color:'#6E7D73',fontSize:10,lineHeight:16},
 read:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,paddingVertical:4},
 link:{color:'#17644B',fontWeight:'800',fontSize:12},
 section:{fontSize:12,fontWeight:'900',color:'#204C34'},
 savedDugtong:{padding:12,borderWidth:1,borderColor:'#CFE1D4',borderRadius:6,backgroundColor:'#EFF8F1',gap:8},
 savedHead:{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'},
 savedTitle:{fontSize:14,fontWeight:'900',color:'#17644B',flexGrow:1},
 privateLabel:{fontSize:11,color:'#66766C',fontWeight:'700'},
 savedBody:{fontSize:14,lineHeight:21,color:'#183D2C'},
 privacyRow:{flexDirection:'row',flexWrap:'wrap',gap:6,alignItems:'center'},
 privacyTitle:{fontSize:12,fontWeight:'800',color:'#204C34'},
 privacyChip:{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:'#CFE1D4',
  borderRadius:5,paddingHorizontal:10,paddingVertical:8},
 privacyText:{fontSize:11,fontWeight:'700',color:'#17644B'},
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
 communityHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:3},
 communityEntry:{borderTopWidth:1,borderTopColor:'#E0E7E1',paddingTop:9,gap:4},
 communityAuthor:{fontSize:12,fontWeight:'900',color:'#17644B'},
 communityBody:{fontSize:13,lineHeight:19,color:'#344A3A'},
 history:{padding:8,borderWidth:1,borderColor:'#E0E7E1',borderRadius:6,gap:10},
 historyEntry:{borderBottomWidth:1,borderBottomColor:'#E0E7E1',paddingBottom:9,gap:5},
 help:{fontSize:11,color:'#65786B',lineHeight:17},
 notice:{backgroundColor:'#E5F7E8',color:'#17644B',fontWeight:'800',padding:10,fontSize:12},
 error:{backgroundColor:'#FDE8E8',color:'#9B2226',padding:10,fontSize:12},
});
