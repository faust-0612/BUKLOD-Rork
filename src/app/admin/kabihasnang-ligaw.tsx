import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Episode = { id:string; title:string; episode_number:number; status:string; revision_notes:string|null; approved_at:string|null; release_at:string|null; has_manuscript:boolean };
type Preview = Episode & { manuscript:string|null };
type Action = 'approve'|'revise'|'schedule'|'pause'|'resume';
export default function KabihasnangLigawAdminScreen() {
 const [rows,setRows]=useState<Episode[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [notes,setNotes]=useState('');
 const [date,setDate]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [feedback,setFeedback]=useState('Loading approval queue…');
 const [filter,setFilter]=useState<'pending'|'all'>('pending');
 const refresh=useCallback(async()=>{
  setLoading(true);
  try {
   const {data,error}=await supabase.rpc('kl_admin_list_v1');
   if(error) throw error;
   if(!Array.isArray(data)) throw new Error('Invalid server response');
   setRows(data as Episode[]);
   setFeedback('Approval queue synced with server.');
  }catch(e){setFeedback('Could not load the server queue. Retry when connected. '+(e instanceof Error?e.message:''));}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const open=async(id:string)=>{
  if(busy)return;
  setSelected(id);setPreview(null);setLoading(true);setNotes('');
  try{
   const {data,error}=await supabase.rpc('kl_admin_preview_v1',{p_episode_id:id});
   if(error)throw error;
   if(!data || typeof data!=='object')throw new Error('Preview unavailable');
   setPreview(data as Preview);setFeedback('Complete manuscript loaded from server.');
  }catch(e){setFeedback('Could not load manuscript. No action taken. '+(e instanceof Error?e.message:''));}
  finally{setLoading(false);}
 };
 const perform=async(action:Action)=>{
  if(busy||loading||!preview)return;
  if(action==='revise' && notes.trim().length<5){setFeedback('Enter specific revision feedback (at least 5 characters).');return;}
  if(action==='schedule'&&!/^\d{4}-\d{2}-\d{2}$/.test(date)){setFeedback('Enter release date as YYYY-MM-DD.');return;}
  setBusy(true);setFeedback('Saving '+action+' to server…');
  try{
   const {data,error}=await supabase.rpc('kl_admin_action_v1',{p_episode_id:preview.id,p_action:action,p_notes:notes,p_manila_date:action==='schedule'?date:null});
   if(error)throw error;
   if(!(data as {ok?:boolean}|null)?.ok)throw new Error('Server did not confirm the change');
   const {data:verified,error:verifyError}=await supabase.rpc('kl_admin_preview_v1',{p_episode_id:preview.id});
   if(verifyError||!verified)throw new Error('Action committed but refresh failed. Do not tap again; reload to verify.');
   setPreview(verified as Preview);
   const {data:list,error:listError}=await supabase.rpc('kl_admin_list_v1');
   if(!listError&&Array.isArray(list))setRows(list as Episode[]);
   setFeedback(action.toUpperCase()+' saved and verified on server. Approval alone does not publish.');
  }catch(e){setFeedback('Could not confirm action: '+(e instanceof Error?e.message:'Unknown error')+'. Check status before retrying.');}
  finally{setBusy(false);}
 };
 const confirm=(action:Action)=>{
  if(!preview||busy)return;
  Alert.alert('Confirm '+action,action==='approve'?'Approve manuscript only? This does not publish.':action==='schedule'?'Schedule release at 6:00 AM Manila time?':'Apply '+action+' to '+preview.title+'?',[
   {text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>void perform(action)}
  ]);
 };
 const visible=filter==='pending'?rows.filter(x=>x.status==='draft'):rows;
 return <AdminGate><ScrollView contentContainerStyle={styles.page}>
  <Text style={styles.kicker}>BUKLOD ADMIN · STORY MANAGEMENT</Text>
  <Text style={styles.title}>Kabihasnang Ligaw</Text>
  <Text style={styles.info}>Review manuscripts, request revisions and approve. Approval does not release an episode. Scheduling is a separate action.</Text>
  <View style={styles.actions}>
   <Pressable accessibilityRole="button" onPress={()=>setFilter('pending')} style={styles.button}><Text style={styles.buttonText}>Pending ({rows.filter(x=>x.status==='draft').length})</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={()=>setFilter('all')} style={styles.button}><Text style={styles.buttonText}>All ({rows.length})</Text></Pressable>
   <Pressable accessibilityRole="button" disabled={loading||busy} onPress={()=>void refresh()} style={styles.button}><Text style={styles.buttonText}>Refresh</Text></Pressable>
  </View>
  {loading?<ActivityIndicator accessibilityLabel="Loading from server"/>:null}
  <Text accessibilityRole="alert" style={styles.info}>{feedback}</Text>
  <View style={styles.card}><Text style={styles.heading}>Approval queue</Text>
   {visible.length===0?<Text style={styles.info}>No manuscripts in this view.</Text>:visible.map(x=><Pressable key={x.id} accessibilityRole="button" onPress={()=>void open(x.id)} style={[styles.item,selected===x.id&&styles.active]}>
    <Text style={styles.heading}>{x.episode_number===0?'Panimula':'Kabanata '+x.episode_number} · {x.title}</Text>
    <Text style={styles.info}>{x.status.toUpperCase()}{x.revision_notes?' · REVISION REQUESTED':''}{x.release_at?' · Scheduled':''}</Text>
   </Pressable>)}
  </View>
  {preview?<View style={styles.card}>
   <Text style={styles.heading}>{preview.title}</Text>
   <Text style={styles.info}>Server status: {preview.status} · {preview.manuscript?.length??0} characters</Text>
   {preview.revision_notes?<Text style={styles.info}>Revision feedback: {preview.revision_notes}</Text>:null}
   <Text selectable style={styles.prose}>{preview.manuscript||'No manuscript available.'}</Text>
   <Text style={styles.heading}>Decision and feedback</Text>
   <TextInput multiline accessibilityLabel="Revision feedback" placeholder="Specific changes needed before approval" placeholderTextColor={colors.muted} value={notes} onChangeText={setNotes} style={styles.input}/>
   <TextInput accessibilityLabel="Release date Manila" placeholder="YYYY-MM-DD for 6:00 AM Manila release" placeholderTextColor={colors.muted} value={date} onChangeText={setDate} style={styles.input}/>
   <View style={styles.actions}>{(['approve','revise','schedule','pause','resume'] as Action[]).map(action=><Pressable key={action} accessibilityRole="button" disabled={busy||loading||!preview.manuscript} onPress={()=>confirm(action)} style={[styles.button,(busy||loading||!preview.manuscript)&&styles.disabled]}><Text style={styles.buttonText}>{busy?'Working…':action.toUpperCase()}</Text></Pressable>)}</View>
  </View>:null}
 </ScrollView></AdminGate>;
}
const styles=StyleSheet.create({
 page:{padding:16,paddingBottom:50,gap:12,backgroundColor:colors.background},
 kicker:{color:colors.greenDark,fontWeight:'800',fontSize:12},
 title:{color:colors.text,fontSize:24,fontWeight:'800'},
 info:{color:colors.text,fontSize:14,lineHeight:21},
 card:{backgroundColor:colors.white,borderColor:colors.line,borderWidth:1,borderRadius:14,padding:14,gap:12},
 heading:{color:colors.text,fontSize:16,fontWeight:'700'},
 item:{padding:12,borderColor:colors.line,borderWidth:1,borderRadius:10,gap:4},
 active:{borderColor:colors.green,borderWidth:2},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
 button:{backgroundColor:colors.green,paddingHorizontal:14,paddingVertical:12,borderRadius:10,minHeight:44,justifyContent:'center'},
 buttonText:{color:colors.white,fontWeight:'700',fontSize:13},
 disabled:{opacity:.45},
 prose:{color:colors.text,fontSize:16,lineHeight:26},
 input:{borderWidth:1,borderColor:colors.line,borderRadius:10,padding:12,color:colors.text,minHeight:48,textAlignVertical:'top'}
});
