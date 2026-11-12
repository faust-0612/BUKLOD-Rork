import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {colors} from '@/lib/theme';
type Case={feedback_id:string;reference:string;title:string;status:string;user_name:string|null};
type Msg={id:string;body:string;sender_kind:string;sender_id:string;created_at:string};
type FileRow={id:string;object_path:string;mime_type:string;created_at:string};
const BUCKET='bsoc-support-evidence';

export default function BsocInbox(){
 const {caseId: routeCaseId}=useLocalSearchParams<{caseId?:string}>();
 const {hasRole}=useAuth();
 const isSystemAdmin=hasRole('system_admin');
 const [caseContext,setCaseContext]=useState<{title:string;message:string;category:string;status:string}|null>(null);
 const currentCase=useRef('');
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
   if(error)setError(error.message);else setCases((data||[]) as Case[]);
 },[]);
 const loadThread=useCallback(async()=>{
   if(!caseId||!canRead)return;
   const [m,a]=await Promise.all([
     supabase.from('bsoc_case_messages').select('id,body,sender_kind,sender_id,created_at')
       .eq('case_id',caseId).order('created_at',{ascending:true}).limit(150),
     supabase.from('bsoc_case_attachments').select('id,object_path,mime_type,created_at')
       .eq('case_id',caseId).order('created_at',{ascending:true}).limit(80)
   ]);
   if(currentCase.current!==caseId)return;
   if(m.error){setError(m.error.message);return;}
   if(a.error){setError(a.error.message);return;}
   setMessages((m.data||[]) as Msg[]);
   const joined=await Promise.all(((a.data||[]) as FileRow[]).map(async file=>{
     const {data}=await supabase.storage.from(BUCKET).createSignedUrl(file.object_path,300);
     return {...file,url:data?.signedUrl||null};
   }));
   if(currentCase.current===caseId)setFiles(joined);
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
 useEffect(()=>{
   const id=typeof routeCaseId==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(routeCaseId)
     ?routeCaseId:'';
   if(id)setCaseId(id);
 },[routeCaseId]);
 useEffect(()=>{
   currentCase.current=caseId;
   setMessages([]);setFiles([]);setCaseContext(null);
   if(!canRead||!caseId||!isSystemAdmin)return;
   let active=true;
   void supabase.from('user_feedback').select('title,message,category,status')
     .eq('id',caseId).maybeSingle().then(({data,error})=>{
       if(active&&currentCase.current===caseId&&!error&&data)setCaseContext({
         title:String(data.title||'Help request'),message:String(data.message||''),
         category:String(data.category||'Support'),status:String(data.status||''),
       });
     });
   return ()=>{active=false;};
 },[canRead,caseId,isSystemAdmin]);
 useEffect(()=>{
   if(!caseId||!canRead)return;
   void loadThread();
   const channel=supabase.channel('bsoc-admin-thread-'+caseId)
     .on('postgres_changes',{event:'INSERT',schema:'public',table:'bsoc_case_messages',filter:'case_id=eq.'+caseId},()=>void loadThread())
     .subscribe();
   return ()=>{void supabase.removeChannel(channel);};
 },[caseId,canRead,loadThread]);
 const send=async()=>{
   if(!canManage||!uid||!caseId||!draft.trim()||busy)return;
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
 if(canRead===null)return <View style={styles.page}><ActivityIndicator color={colors.green}/></View>;
 if(!canRead)return <View style={styles.page}><Text style={styles.h1}>BSOC support permission required</Text></View>;
 return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ BSOC Operations</Text></Pressable>
   <Text style={styles.h1}>BSOC · Live Conversations</Text>
   <Text style={styles.muted}>Private two-way messages and photo/video evidence. Agents must not ask for passwords or reset codes.</Text>
   {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
   <Pressable onPress={()=>void loadCases()} style={styles.secondary}><Text style={styles.link}>Refresh case queue</Text></Pressable>
   <View style={styles.caseList}>
     {cases.map(c=><Pressable key={c.feedback_id} onPress={()=>{setCaseId(c.feedback_id);setError('');}} style={[styles.case,caseId===c.feedback_id&&styles.active]}>
       <Text style={styles.bold}>{c.title}</Text>
       <Text style={styles.muted}>{c.reference} · {c.status} · {c.user_name||'Member'}</Text>
     </Pressable>)}
   </View>
   {caseId&&<View style={styles.thread}>
     <Text style={styles.h2}>Case conversation · {caseId.slice(0,8).toUpperCase()}</Text>
     {caseContext&&<View style={styles.case}>
       <Text style={styles.bold}>{caseContext.title}</Text>
       <Text style={styles.muted}>{caseContext.category} · {caseContext.status}</Text>
       {!!caseContext.message&&<Text style={styles.body}>{caseContext.message}</Text>}
     </View>}
     {!messages.length&&<Text style={styles.muted}>No messages yet.</Text>}
     {messages.map(m=><View key={m.id} style={styles.bubble}>
       <Text style={styles.muted}>{m.sender_kind==='agent'?'BSOC agent':'Member'} · {new Date(m.created_at).toLocaleString()}</Text>
       <Text style={styles.body}>{m.body}</Text>
     </View>)}
     {files.map(f=><Pressable key={f.id} style={styles.case} onPress={()=>{if(f.url)void import('expo-web-browser').then(w=>w.openBrowserAsync(f.url!));}}>
       <Text style={styles.link}>{f.mime_type.startsWith('image/')?'Photo':'Video'} evidence · View private attachment</Text>
       <Text style={styles.muted}>{new Date(f.created_at).toLocaleString()}</Text>
     </Pressable>)}
     {canManage?<TextInput style={styles.input} multiline placeholder="Reply as BSOC agent…" value={draft} onChangeText={setDraft}/>:<Text style={styles.muted}>Read-only support access: replies require BSOC support.manage.</Text>}
     {canManage&&<Pressable disabled={busy||!draft.trim()} style={styles.button} onPress={()=>void send()}>
       <Text style={styles.buttonText}>{busy?'Sending…':'Send BSOC reply'}</Text>
     </Pressable>}
   </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.white},content:{padding:18,paddingBottom:90,gap:12},
 h1:{fontSize:24,fontWeight:'800',color:colors.text},h2:{fontSize:17,fontWeight:'800',color:colors.text},
 bold:{fontWeight:'700',color:colors.text},muted:{fontSize:12,color:'#64748b',lineHeight:19},
 body:{fontSize:14,color:colors.text,lineHeight:20},link:{color:colors.green,fontWeight:'700'},
 caseList:{flexDirection:'row',flexWrap:'wrap',gap:8},
 case:{padding:12,borderRadius:10,borderWidth:1,borderColor:'#cbd5e1',gap:4},
 active:{borderColor:colors.green,backgroundColor:'#effbf4'},thread:{gap:12,paddingTop:12},
 bubble:{padding:12,borderRadius:10,backgroundColor:'#f1f5f9',gap:5},
 input:{minHeight:85,borderWidth:1,borderColor:'#cbd5e1',borderRadius:9,padding:12,color:colors.text,textAlignVertical:'top'},
 button:{backgroundColor:colors.green,padding:13,borderRadius:10,alignItems:'center'},
 buttonText:{color:colors.white,fontWeight:'800'},secondary:{padding:10},
 error:{backgroundColor:'#fee2e2',padding:10,color:'#991b1b'}
});
