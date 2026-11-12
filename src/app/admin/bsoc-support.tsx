import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import { isBsoCaseId } from '@/lib/bsocCaseTriage';

type Case = {
  feedback_id: string; reference: string; user_name: string | null; category: string;
  title: string; message: string; status: string; app_version: string | null;
  route: string | null; platform: string | null; created_at: string;
  updated_at: string; assigned_to: string | null; resolution: string | null;
};
type Status = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'closed';
const STATUSES: Status[] = ['new','triaged','in_progress','resolved','closed'];
const friendlyError = (e: unknown) => String((e as any)?.message ?? e ?? 'Please retry.').slice(0,350);

export default function BsocSupportOperations() {
  const {case_id:requestedCaseId}=useLocalSearchParams<{case_id?:string}>();
  const lastLinkedCase=useRef<string>('');
  const {hasRole}=useAuth();
  const isSystemAdmin=hasRole('system_admin');
  const [canRead,setCanRead]=useState<boolean|null>(null);
  const [canManage,setCanManage]=useState(false);
  const [cases,setCases] = useState<Case[]>([]);
  const [status,setStatus] = useState<string>('');
  const [refreshing,setRefreshing] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [selected,setSelected] = useState<Case | null>(null);
  const [nextStatus,setNextStatus] = useState<Status>('triaged');
  const [resolution,setResolution] = useState('');
  const [reason,setReason] = useState('');
  const [preview,setPreview] = useState<any>(null);
  const [saving,setSaving] = useState(false);
  const [success,setSuccess] = useState('');
  const [unreadCount,setUnreadCount] = useState(0);
  useEffect(()=>{
    if(!canRead)return;
    let active=true;
    const reload=async()=>{
      const {count,error}=await supabase.from('notifications')
        .select('id',{count:'exact',head:true}).eq('kind','bsoc_support').is('read_at',null);
      if(active&&!error)setUnreadCount(count||0);
    };
    void reload();
    const ch=supabase.channel('bsoc-inbox-notification-count')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications'},()=>void reload())
      .subscribe();
    return ()=>{active=false;void supabase.removeChannel(ch);};
  },[canRead]);

  const load = useCallback(async () => {
    setRefreshing(true); setError('');
    try {
      const {data,error:rpcError} = await supabase.rpc('buklod_bsoc_support_queue_v1',{
        p_status: status || null, p_limit: 100, p_before: null,
      });
      if (rpcError) throw rpcError;
      setCases(Array.isArray(data) ? data : []);
    } catch (e) {setError(friendlyError(e));}
    finally {setLoading(false);setRefreshing(false);}
  },[status]);

  useEffect(()=>{
    let live=true;
    void Promise.all([
      supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.read'}),
      supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.manage'})
    ]).then(([read,manage])=>{
      if(!live)return;
      setCanRead(!read.error&&read.data===true);
      setCanManage(!manage.error&&manage.data===true);
    }).catch(()=>{if(live)setCanRead(false);});
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{if(canRead)void load();else if(canRead===false)setLoading(false);},[canRead,load]);

  useEffect(()=>{
    if(loading||!requestedCaseId||lastLinkedCase.current===requestedCaseId)return;
    lastLinkedCase.current=requestedCaseId;
    if(!isBsoCaseId(requestedCaseId)){setError('Invalid case reference.');return;}
    const match=cases.find(c=>c.feedback_id===requestedCaseId);
    if(match){selectCase(match);return;}
    if(!isSystemAdmin){
      setError('This case is outside the current queue. Historical lookup is restricted to System Admin.');
      return;
    }
    // Only the authorized System Admin can recover a historical case omitted
    // by the 100-row queue. Existing RLS and audited action RPC remain intact.
    let active=true;
    void supabase.from('user_feedback')
      .select('id,title,message,category,status,app_version,created_at,updated_at,assigned_to,resolution')
      .eq('id',requestedCaseId).maybeSingle().then(({data,error})=>{
        if(!active||lastLinkedCase.current!==requestedCaseId)return;
        if(error||!data){setError('Linked case unavailable or restricted.');return;}
        selectCase({
          feedback_id:requestedCaseId,reference:requestedCaseId.slice(0,8),
          user_name:null,category:String(data.category??'other'),
          title:String(data.title??'Support case'),message:String(data.message??''),
          status:String(data.status??'new'),
          app_version:data.app_version??null,route:null,platform:null,
          created_at:data.created_at??'',updated_at:data.updated_at??'',
          assigned_to:data.assigned_to??null,resolution:data.resolution??null,
        });
      });
    return ()=>{active=false;};
  },[cases,loading,requestedCaseId,isSystemAdmin]);

  function selectCase(item: Case) {
    setSelected(item);setNextStatus(item.status as Status);setResolution(item.resolution || '');
    setReason('');setPreview(null);setSuccess('');setError('');
  }

  async function inspect() {
    if(!selected || !canManage || saving) return;
    setSaving(true);setError('');setPreview(null);
    try {
      const {data,error:rpcError}=await supabase.rpc('buklod_bsoc_preview_support_case_action_v1',{
        p_feedback_id:selected.feedback_id,p_status:nextStatus,
        p_resolution:resolution.trim()||null,p_assigned_to:selected.assigned_to,
      });
      if(rpcError) throw rpcError;
      setPreview(data);
    } catch(e){setError(friendlyError(e));}
    finally{setSaving(false);}
  }

  async function apply() {
    if(!canManage || !selected || !preview || saving || reason.trim().length < 8) {
      setError('Enter an audit reason (at least 8 characters) before confirming.'); return;
    }
    setSaving(true);setError('');
    try {
      const {data,error:rpcError}=await supabase.rpc('buklod_bsoc_apply_support_case_action_v1',{
        p_feedback_id:selected.feedback_id,
        p_expected_updated_at:preview.expected_updated_at,
        p_status:nextStatus,p_resolution:resolution.trim()||null,
        p_assigned_to:selected.assigned_to,p_reason:reason.trim(),
      });
      if(rpcError) throw rpcError;
      setSuccess('Case updated with audit reference '+String(data?.audit_id||''));
      setSelected(null);setPreview(null);
      await load();
    } catch(e){setPreview(null);setError(friendlyError(e));}
    finally{setSaving(false);}
  }

  if(canRead===null) return <View style={styles.page}><ActivityIndicator color={colors.green}/></View>;
  if(!canRead) return <View style={styles.page}><Text style={styles.header}>BSOC support permission required</Text></View>;
  return <ScrollView style={styles.page} keyboardShouldPersistTaps="handled"
    contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load()}/>}>
    <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable>
    <Text style={styles.header}>BSOC · Support Operations</Text>
    {hasRole('system_admin')&&<Pressable style={styles.recovery} accessibilityRole="button" onPress={()=>router.push('/admin/bsoc-personnel' as any)}>
      <Text style={styles.recoveryTitle}>Authorize Personnel · Search Name & Access Code ›</Text>
      <Text style={styles.muted}>Choose a BUKLOD member, approve their limited BSOC role, and issue a single-use access code. Includes audited revocation.</Text>
    </Pressable>}
    <Text style={styles.muted}>Live case queue from BUKLOD support infrastructure. Changes require server authorization, preview, confirmation and audit.</Text>
    {hasRole('system_admin')&&<Pressable style={styles.recovery} accessibilityRole="button" onPress={()=>router.push('/admin/account-recovery' as any)}>
      <Text style={styles.recoveryTitle}>Password Reset · Admin Assistance ›</Text>
      <Text style={styles.muted}>Restricted System Admin workflow. Verify identity first; no manual password or code sharing.</Text>
    </Pressable>}
    <Pressable style={styles.recovery} accessibilityRole="button" onPress={()=>router.push('/admin/bsoc-conversations' as any)}>
      <Text style={styles.recoveryTitle}>Open Live Support Inbox ›</Text>
      <Text style={styles.muted}>Member conversations, photo and video evidence, and replies.</Text>
    </Pressable>
    <Pressable style={styles.recovery} accessibilityRole="button" onPress={()=>router.push('/admin/bsoc-notifications' as any)}>
      <Text style={styles.recoveryTitle}>Notifications ({unreadCount} unread) · Concerns & replies ›</Text>
      <Text style={styles.muted}>Alerts for every authorized BSOC support personnel, not only administrators.</Text>
    </Pressable>
    <Pressable style={styles.recovery} accessibilityRole="button" onPress={()=>router.push('/admin/bsoc-gpt-debug' as any)}>
      <Text style={styles.recoveryTitle}>GPT Debug Assistant ›</Text>
      <Text style={styles.muted}>Analyze sanitized technical descriptions. No private case details are shared automatically.</Text>
    </Pressable>
    <Text style={styles.section}>Support cases</Text>
    <Text style={styles.muted}>Latest 100 cases per filter. System Admin can open an older case through its authorized notification without bypassing audit.</Text>
    <View style={styles.filters}>
      {['',...STATUSES].map(s=><Pressable key={s||'all'} onPress={()=>{setStatus(s);setSelected(null);setPreview(null);}}
        style={[styles.chip,status===s&&styles.active]}><Text style={styles.chipText}>{s||'all'}</Text></Pressable>)}
    </View>
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>ERROR: {error}</Text>}
    {!!success&&<Text style={styles.success}>{success}</Text>}
    {loading&&<ActivityIndicator color={colors.green}/>}
    {!loading&&cases.length===0&&<Text style={styles.muted}>No cases in this queue. Pull down to refresh.</Text>}
    {cases.map(item=><Pressable key={item.feedback_id} style={[styles.case,selected?.feedback_id===item.feedback_id&&styles.selected]}
      onPress={()=>selectCase(item)} accessibilityRole="button">
      <Text style={styles.caseTitle}>{item.title} · {item.reference}</Text>
      <Text style={styles.muted}>{item.category} · {item.status} · {new Date(item.created_at).toLocaleString()}</Text>
      <Text style={styles.caseText} numberOfLines={3}>{item.message}</Text>
    </Pressable>)}
    {selected&&<View style={styles.editor}>
      <Text style={styles.section}>Case {selected.reference}</Text>
      <Text style={styles.muted}>{selected.user_name||'BUKLOD member'} · {selected.platform||'Unknown platform'} · {selected.app_version||'Version unknown'}</Text>
      <Text style={styles.caseText}>{selected.message}</Text>
      <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/admin/bsoc-conversations',params:{case_id:selected.feedback_id}} as any)}><Text style={styles.link}>Open private member conversation ›</Text></Pressable>
      {!canManage&&<Text style={styles.muted}>Read-only BSOC access. An authorized support manager must update cases.</Text>}
      <Text style={styles.muted}>Status</Text>
      <View style={styles.filters}>
        {STATUSES.map(s=><Pressable key={s} style={[styles.chip,nextStatus===s&&styles.active]}
          onPress={()=>{setNextStatus(s);setPreview(null);}}><Text style={styles.chipText}>{s}</Text></Pressable>)}
      </View>
      <Text style={styles.muted}>Resolution / response notes</Text>
      <TextInput multiline value={resolution} onChangeText={v=>{setResolution(v);setPreview(null);}} style={styles.input} placeholder="Resolution details"/>
      <Text style={styles.muted}>Required audit reason</Text>
      <TextInput value={reason} onChangeText={setReason} style={styles.input} placeholder="Why is this case status changing?"/>
      <Pressable disabled={saving||!canManage} style={[styles.button,!canManage&&{opacity:.45}]} onPress={()=>void inspect()}>
        <Text style={styles.buttonText}>{saving?'Processing…':'Preview audited change'}</Text>
      </Pressable>
      {!!preview&&<View style={styles.preview}>
        <Text style={styles.caseTitle}>Confirm change</Text>
        <Text style={styles.caseText}>From {String(preview.current?.status)} to {String(preview.proposed?.status)}. This will be recorded in the BSOC audit log.</Text>
        <Pressable disabled={saving} style={styles.button} onPress={()=>void apply()}>
          <Text style={styles.buttonText}>Confirm and apply</Text>
        </Pressable>
      </View>}
    </View>}
  </ScrollView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.white},content:{padding:18,paddingBottom:75,gap:12},
  header:{fontSize:25,fontWeight:'800',color:colors.text},section:{fontSize:18,fontWeight:'800',color:colors.text},
  muted:{color:'#64748b',fontSize:13,lineHeight:20},link:{color:colors.green,fontWeight:'700',paddingVertical:8},
  recovery:{padding:16,borderRadius:14,backgroundColor:'#e9f5ef',gap:7},recoveryTitle:{fontSize:16,fontWeight:'800',color:colors.green},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{borderWidth:1,borderColor:'#cbd5e1',paddingHorizontal:10,paddingVertical:7,borderRadius:16},
  active:{backgroundColor:'#cce9dc',borderColor:colors.green},
  chipText:{color:colors.text,fontSize:12,fontWeight:'600'},
  case:{padding:13,borderRadius:12,borderWidth:1,borderColor:'#e2e8f0',gap:5},
  selected:{borderColor:colors.green,backgroundColor:'#f0fdf4'},
  caseTitle:{fontWeight:'800',color:colors.text,fontSize:15},caseText:{color:colors.text,fontSize:13,lineHeight:20},
  editor:{gap:12,borderTopWidth:1,borderColor:'#e2e8f0',paddingTop:20},
  input:{minHeight:55,borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,padding:12,color:colors.text,textAlignVertical:'top'},
  button:{backgroundColor:colors.green,borderRadius:10,padding:13,alignItems:'center'},
  buttonText:{color:colors.white,fontWeight:'800'},
  preview:{padding:14,gap:10,backgroundColor:'#f1f5f9',borderRadius:12},
  error:{padding:12,color:'#991b1b',backgroundColor:'#fee2e2',borderRadius:10},
  success:{padding:12,color:'#166534',backgroundColor:'#dcfce7',borderRadius:10},
});
