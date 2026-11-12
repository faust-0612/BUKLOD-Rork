import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {colors} from '@/lib/theme';
import {bsoCaseIntervention,bsoReplyDraft,isBsoCaseId,triageBsoCase} from '@/lib/bsocCaseTriage';
import {isValidBdocCaseId} from '@/lib/buklodAdminPriorityPolicy';
type Case={feedback_id:string;reference:string;title:string;status:string;user_name:string|null;category?:string|null;message?:string|null;route?:string|null;platform?:string|null;app_version?:string|null;created_at?:string|null;updated_at?:string|null;resolution?:string|null};
type Msg={id:string;body:string;sender_kind:string;sender_id:string;created_at:string};
type FileRow={id:string;object_path:string;mime_type:string;created_at:string};
const BUCKET='bsoc-support-evidence';

export default function BsocInbox(){
 const {caseId:routeCaseId,case_id:legacyCaseId}=useLocalSearchParams<{caseId?:string;case_id?:string}>();
 const requestedCaseId=isValidBdocCaseId(routeCaseId)?routeCaseId:legacyCaseId;
 const {hasRole,user}=useAuth();
 const isSystemAdmin=hasRole('system_admin');
 const currentCase=useRef('');
 const requestSequence=useRef(0);
 const lastLinkedCase=useRef<string>('');
 const [queueLoaded,setQueueLoaded]=useState(false);
 const [linkedCase,setLinkedCase]=useState<Case|null>(null);
 const [canRead,setCanRead]=useState<boolean|null>(null);
 const [canManage,setCanManage]=useState(false);
 const [cases,setCases]=useState<Case[]>([]);
 const [caseId,setCaseId]=useState('');
 const [messages,setMessages]=useState<Msg[]>([]);
 const [files,setFiles]=useState<(FileRow&{url:string|null})[]>([]);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [uid,setUid]=useState<string|null>(null);
 const loadCases=useCallback(async()=>{
   const {data,error}=await supabase.rpc('buklod_bsoc_support_queue_v1',{p_status:null,p_limit:100,p_before:null});
   if(error)setError(error.message);else {setCases((data||[]) as Case[]);setError('');}
   setQueueLoaded(true);
 },[]);
 const loadThread=useCallback(async()=>{
   if(!caseId||!canRead)return;
   const sequence=++requestSequence.current;
   const [m,a]=await Promise.all([
     supabase.from('bsoc_case_messages').select('id,body,sender_kind,sender_id,created_at')
       .eq('case_id',caseId).order('created_at',{ascending:true}).limit(150),
     supabase.from('bsoc_case_attachments').select('id,object_path,mime_type,created_at')
       .eq('case_id',caseId).order('created_at',{ascending:true}).limit(80)
   ]);
   if(sequence!==requestSequence.current||currentCase.current!==caseId)return;
   if(m.error){setError(m.error.message);return;}
   if(a.error){setError(a.error.message);return;}
   setMessages((m.data||[]) as Msg[]);
   const joined=await Promise.all(((a.data||[]) as FileRow[]).map(async file=>{
     const {data}=await supabase.storage.from(BUCKET).createSignedUrl(file.object_path,300);
     return {...file,url:data?.signedUrl||null};
   }));
   if(sequence===requestSequence.current&&currentCase.current===caseId)setFiles(joined);
 },[caseId,canRead]);
 useEffect(()=>{
   let alive=true;
   void Promise.all([
     supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.read'}),
     supabase.rpc('buklod_bsoc_can',{p_permission_key:'bsoc.support.manage'}),
     supabase.auth.getUser(),
   ]).then(([read,manage,auth])=>{
     if(!alive)return;
     setCanRead(!read.error&&read.data===true);
     setCanManage(!manage.error&&manage.data===true);
     setUid(auth.data.user?.id||null);
   }).catch(()=>{if(alive)setCanRead(false);});
   return ()=>{alive=false;};
 },[]);
 useEffect(()=>{if(canRead)void loadCases();},[canRead,loadCases]);
 const openCase=useCallback((id:string)=>{
   requestSequence.current+=1;
   currentCase.current=id;
   setLinkedCase(null);
   setMessages([]);setFiles([]);setDraft('');setError('');setCaseId(id);
 },[]);
 // Strictly Admin-only direct lookup supports older priority cases not present
 // in the bounded 100-row support queue, without weakening message RLS.
 useEffect(()=>{
   if(!canRead||!queueLoaded||!requestedCaseId||lastLinkedCase.current===requestedCaseId)return;
   lastLinkedCase.current=requestedCaseId;
   if(!isBsoCaseId(requestedCaseId)||!isValidBdocCaseId(routeCaseId??requestedCaseId)){
     setError('Invalid case reference.');return;
   }
   if(cases.some(c=>c.feedback_id===requestedCaseId)){openCase(requestedCaseId);return;}
   if(!isSystemAdmin){
     setError('This case is outside the current support queue or access is restricted.');
     return;
   }
   let active=true;
   void supabase.from('user_feedback').select('title,message,category,status')
     .eq('id',requestedCaseId).maybeSingle().then(({data,error})=>{
       if(!active||lastLinkedCase.current!==requestedCaseId)return;
       if(error||!data){setError('Case unavailable or access restricted.');return;}
       openCase(requestedCaseId);
       setLinkedCase({
         feedback_id:requestedCaseId,reference:'',title:String(data.title||'Support request'),
         message:String(data.message||''),category:String(data.category||'Support'),
         status:String(data.status||'unknown'),user_name:null,
       });
     });
   return ()=>{active=false;};
 },[canRead,cases,openCase,queueLoaded,requestedCaseId,isSystemAdmin,routeCaseId]);
 const previousUserRef=useRef(user?.id);
 useEffect(()=>{
   // Do not clear initial deep link on first mount; only clear on a real
   // account transition so private case content never survives switching.
   if(previousUserRef.current===user?.id)return;
   previousUserRef.current=user?.id;
   requestSequence.current+=1;
   currentCase.current='';
   lastLinkedCase.current='';
   setLinkedCase(null);setCaseId('');setMessages([]);setFiles([]);
 },[user?.id]);
 useEffect(()=>{
   if(!caseId)return;
   void loadThread();
   const channel=supabase.channel('bsoc-admin-thread-'+caseId)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'bsoc_case_messages',filter:'case_id=eq.'+caseId},()=>void loadThread())
     .subscribe();
   return ()=>{void supabase.removeChannel(channel);};
 },[caseId,loadThread]);
 const send=async()=>{
   if(!canManage||!uid||!caseId||!draft.trim()||busy||((cases.find(c=>c.feedback_id===caseId)?.status??linkedCase?.status)==='closed'))return;
   setBusy(true);setError('');
   try{
     const {error:e}=await supabase.from('bsoc_case_messages').insert({
       case_id:caseId,sender_id:uid,sender_kind:'agent',body:draft.trim().slice(0,8000),
       client_nonce:Crypto.randomUUID()
     });
     if(e)throw e;
     setDraft('');await loadThread();
   }catch(e:any){setError(e?.message||'Could not send message');}
   finally{setBusy(false);}
 };
 const selected=cases.find(c=>c.feedback_id===caseId)??(linkedCase?.feedback_id===caseId?linkedCase:null);
 const triage=selected?triageBsoCase(selected):null;
 const intervention=selected?bsoCaseIntervention(selected):null;
 if(canRead===null)return <View style={styles.page}><ActivityIndicator color={colors.green}/></View>;
 if(!canRead)return <View style={styles.page}><Text style={styles.h1}>BSOC support permission required</Text></View>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BSOC Operations</Text></Pressable>
   <Text style={styles.h1}>BSOC · Live Conversations</Text>
   <Text style={styles.muted}>Private two-way messages and photo/video evidence. Agents must not ask for passwords or reset codes.</Text>
   {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
   <Pressable onPress={()=>void loadCases()} style={styles.secondary}><Text style={styles.link}>Refresh case queue</Text></Pressable>
   {!selected&&<Text style={styles.muted}>Tap a case to view its original concern, preliminary technical assessment and reply controls.</Text>}
   {selected&&triage&&<View style={styles.thread}>
     <Text style={styles.h2}>Selected case · {selected.reference}</Text>
     <Text style={styles.bold}>{selected.title}</Text>
     <Text style={styles.muted}>{selected.status} · {selected.user_name||'Member'} · {selected.category||'Category unknown'}</Text>
     <View style={styles.origin}>
       <Text style={styles.h2}>Original report & origin</Text>
       <Text style={styles.body}>{selected.message||'No original description was returned. Review the support record before diagnosing.'}</Text>
       <Text style={styles.muted}>Route: {selected.route||'Not captured'} · Platform: {selected.platform||'Unknown'} · App: {selected.app_version||'Unknown'}</Text>
       <Text style={styles.muted}>Reported: {selected.created_at?new Date(selected.created_at).toLocaleString():'Unknown'} · Last change: {selected.updated_at?new Date(selected.updated_at).toLocaleString():'Unknown'}</Text>
       {!!selected.resolution&&<Text style={styles.body}>Recorded resolution notes: {selected.resolution}</Text>}
     </View>
     <View style={styles.origin}>
       <Text style={styles.h2}>Preliminary technical triage · NOT verified</Text>
       <Text style={styles.bold}>Signal: {triage.signal}</Text>
       <Text style={styles.body}>Possible area: {triage.suspectedArea}</Text>
       <Text style={styles.body}>Check: {triage.investigation}</Text>
       <Text style={styles.body}>BSOC may do: {triage.bsocAction}</Text>
       <Text style={styles.body}>User may do: {triage.userAction}</Text>
       <Text style={styles.muted}>App-wide/backend incidents require cross-user metrics and server evidence. An OTA is resolved only after exact version/runtime and observed recovery are confirmed.</Text>
       <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/admin/bsoc-support',params:{case_id:selected.feedback_id}} as any)}>
         <Text style={styles.link}>Update status / assignment / audited resolution ›</Text>
       </Pressable>
     </View>
     {intervention&&<View style={styles.origin}>
       <Text style={styles.h2}>Immediate intervention · {intervention.urgency==='priority'?'Priority investigation':'Case triage'}</Text>
       <Text style={styles.bold}>Responsible: {intervention.owner}</Text>
       <Text style={styles.body}>Check now: {intervention.firstCheck}</Text>
       <Text style={styles.body}>Close only when: {intervention.closureGate}</Text>
       <Pressable accessibilityRole="button" disabled={!canManage} style={styles.template} onPress={()=>setDraft(intervention.memberDraft)}>
         <Text style={styles.link}>Prepare case-specific safe reply ›</Text>
       </Pressable>
       <Text style={styles.muted}>Draft only. The member is contacted only after Send; a suggestion never verifies a fix.</Text>
     </View>}
     <Text style={styles.h2}>Reply privately to this member</Text>
     <Text style={styles.muted}>Choose a draft or write your own. Only Send delivers it; the existing backend notification informs this member of a new agent reply.</Text>
     <View style={styles.templates}>
       {([['acknowledge','Investigating'],['request_details','Ask details'],['client_retry','Safe retry'],['ota_check','OTA verification']] as const).map(([intent,label])=><Pressable key={intent} disabled={!canManage} style={styles.template} onPress={()=>setDraft(bsoReplyDraft(intent))}>
         <Text style={styles.link}>{label}</Text>
       </Pressable>)}
     </View>
     <Text style={styles.h2}>Case conversation</Text>
     {!messages.length&&<Text style={styles.muted}>No messages yet.</Text>}
     {messages.map(m=><View key={m.id} style={styles.bubble}>
       <Text style={styles.muted}>{m.sender_kind==='agent'?'BSOC agent':'Member'} · {new Date(m.created_at).toLocaleString()}</Text>
       <Text style={styles.body}>{m.body}</Text>
     </View>)}
     {files.map(f=><Pressable key={f.id} style={styles.case} onPress={()=>{if(f.url)void import('expo-web-browser').then(w=>w.openBrowserAsync(f.url!));}}>
       <Text style={styles.link}>{f.mime_type.startsWith('image/')?'Photo':'Video'} evidence · View private attachment</Text>
       <Text style={styles.muted}>{new Date(f.created_at).toLocaleString()}</Text>
     </Pressable>)}
     {canManage&&selected.status==='closed'&&<Text style={styles.error}>Closed case. Reopen through audited Support Operations before replying so the member can respond.</Text>}
     {canManage?<TextInput style={styles.input} multiline placeholder="Reply as BSOC agent…" value={draft} onChangeText={setDraft}/>:<Text style={styles.muted}>Read-only support access: replies require BSOC support.manage.</Text>}
     {canManage&&<Pressable disabled={busy||!draft.trim()||selected.status==='closed'} style={[styles.button,(busy||!draft.trim()||selected.status==='closed')&&{opacity:.5}]} onPress={()=>void send()}>
       <Text style={styles.buttonText}>{busy?'Sending…':'Send BSOC reply'}</Text>
     </Pressable>}
   </View>}
   <Text style={styles.h2}>Support queue ({cases.length} loaded)</Text>
   <View style={styles.caseList}>
     {cases.map(c=><Pressable key={c.feedback_id} accessibilityRole="button" onPress={()=>openCase(c.feedback_id)} style={[styles.case,caseId===c.feedback_id&&styles.active]}>
       <Text style={styles.bold}>{c.title}</Text>
       <Text style={styles.muted}>{c.reference} · {c.status} · {c.user_name||'Member'}</Text>
     </Pressable>)}
   </View>
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.white},content:{padding:18,paddingBottom:90,gap:12},
 h1:{fontSize:24,fontWeight:'800',color:colors.text},h2:{fontSize:17,fontWeight:'800',color:colors.text},
 bold:{fontWeight:'700',color:colors.text},muted:{fontSize:12,color:'#64748b',lineHeight:19},
 body:{fontSize:14,color:colors.text,lineHeight:20},link:{color:colors.green,fontWeight:'700'},
 caseList:{gap:8},templates:{flexDirection:'row',flexWrap:'wrap',gap:8},template:{borderWidth:1,borderColor:'#b8d7c6',borderRadius:9,padding:9},origin:{padding:13,borderRadius:10,backgroundColor:'#f1f5f9',gap:8},
 case:{padding:12,borderRadius:10,borderWidth:1,borderColor:'#cbd5e1',gap:4},
 active:{borderColor:colors.green,backgroundColor:'#effbf4'},thread:{gap:12,paddingTop:12},
 bubble:{padding:12,borderRadius:10,backgroundColor:'#f1f5f9',gap:5},
 input:{minHeight:85,borderWidth:1,borderColor:'#cbd5e1',borderRadius:9,padding:12,color:colors.text,textAlignVertical:'top'},
 button:{backgroundColor:colors.green,padding:13,borderRadius:10,alignItems:'center'},
 buttonText:{color:colors.white,fontWeight:'800'},secondary:{padding:10},
 error:{backgroundColor:'#fee2e2',padding:10,color:'#991b1b'}
});
