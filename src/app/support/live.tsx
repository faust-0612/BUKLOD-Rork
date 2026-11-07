import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';

const BUCKET='bsoc-support-evidence';
const ALLOWED=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']);
type Case={id:string; title:string; status:string; created_at:string};
type Message={id:string;body:string;sender_id:string;sender_kind:string;created_at:string};
type Evidence={id:string;case_id:string;message_id:string|null;object_path:string;mime_type:string;created_at:string};
const errorText=(e:unknown)=>String((e as any)?.message??e??'Network error').slice(0,250);

export default function LiveSupport(){
  const [uid,setUid]=useState<string|null>(null);
  const [cases,setCases]=useState<Case[]>([]);
  const [caseId,setCaseId]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [uploadBusy,setUploadBusy]=useState(false);
  const [category,setCategory]=useState<'bug'|'privacy'|'other'>('bug');
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [draft,setDraft]=useState('');
  const [messages,setMessages]=useState<Message[]>([]);
  const [evidence,setEvidence]=useState<(Evidence&{url?:string})[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const loadCases=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    setUid(user?.id||null);
    if(!user){setLoading(false);return;}
    const {data,error}=await supabase.from('user_feedback')
      .select('id,title,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(40);
    if(error)setError(error.message);else setCases((data||[]) as Case[]);
    setLoading(false);
  },[]);
  useEffect(()=>{void loadCases();},[loadCases]);

  const loadThread=useCallback(async()=>{
    if(!caseId)return;
    const [chat,attachments]=await Promise.all([
      supabase.from('bsoc_case_messages').select('id,body,sender_id,sender_kind,created_at')
        .eq('case_id',caseId).order('created_at',{ascending:true}).limit(150),
      supabase.from('bsoc_case_attachments').select('id,case_id,message_id,object_path,mime_type,created_at')
        .eq('case_id',caseId).order('created_at',{ascending:true}).limit(50)
    ]);
    if(chat.error) {setError(chat.error.message);return;}
    if(attachments.error){setError(attachments.error.message);return;}
    setMessages((chat.data||[]) as Message[]);
    const files=(attachments.data||[]) as Evidence[];
    const signed=await Promise.all(files.map(async file=>{
      const {data}=await supabase.storage.from(BUCKET).createSignedUrl(file.object_path,300);
      return {...file,url:data?.signedUrl};
    }));
    setEvidence(signed);
  },[caseId]);
  useEffect(()=>{
    if(!caseId)return;
    void loadThread();
    const channel=supabase.channel('bsoc-member-'+caseId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'bsoc_case_messages',filter:'case_id=eq.'+caseId},()=>{void loadThread();})
      .subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  },[caseId,loadThread]);

  const create=async()=>{
    if(busy||title.trim().length<4||description.trim().length<8)return;
    setBusy(true);setError('');
    try{
      const {data,error}=await supabase.rpc('submit_user_feedback',{
        p_category:category,p_title:title.trim().slice(0,140),
        p_message:description.trim().slice(0,8000),
        p_app_version:Constants.expoConfig?.version||'unknown',
        p_app_environment:'BUKLOD_SUPPORT',
        p_diagnostics:{platform:'app',source:'bsoc_direct_support'}
      });
      if(error)throw error;
      if(!data)throw Error('Ticket not returned');
      setTitle('');setDescription('');
      await loadCases();
      setCaseId(String(data));setNotice('Support case created. You can now chat and attach evidence.');
    }catch(e){setError(errorText(e));}finally{setBusy(false);}
  };
  const send=async()=>{
    if(!caseId||!uid||busy||!draft.trim())return;
    setBusy(true);setError('');
    try{
      const {error}=await supabase.from('bsoc_case_messages').insert({
        case_id:caseId,sender_id:uid,sender_kind:'member',
        body:draft.trim().slice(0,8000),client_nonce:crypto.randomUUID()
      });
      if(error)throw error;
      setDraft('');await loadThread();
    }catch(e){setError(errorText(e));}finally{setBusy(false);}
  };
  const upload=async()=>{
    if(!caseId||!uid||uploadBusy)return;
    setUploadBusy(true);setError('');
    try{
      const result=await DocumentPicker.getDocumentAsync({type:['image/*','video/*'],multiple:false,copyToCacheDirectory:true});
      if(result.canceled)return;
      const asset=result.assets[0];
      const mime=asset.mimeType||'application/octet-stream';
      if(!ALLOWED.has(mime))throw Error('Only JPG, PNG, WebP, MP4, QuickTime or WebM evidence is supported.');
      if(!asset.size||asset.size>262144000)throw Error('Choose an evidence file under 250 MB.');
      const evidenceId=crypto.randomUUID();
      const objectPath=caseId+'/'+uid+'/'+evidenceId;
      // Native and Web use the same private Storage policy. File bytes are bounded.
      const file=new File(asset.uri);
      const content=await file.arrayBuffer();
      const {error:storageError}=await supabase.storage.from(BUCKET)
        .upload(objectPath,content,{contentType:mime,upsert:false});
      if(storageError)throw storageError;
      const {error:rowError}=await supabase.from('bsoc_case_attachments').insert({
        id:evidenceId,case_id:caseId,uploader_id:uid,object_path:objectPath,
        byte_size:asset.size,mime_type:mime
      });
      if(rowError)throw rowError;
      setNotice('Evidence uploaded privately.');await loadThread();
    }catch(e){setError(errorText(e));}finally{setUploadBusy(false);}
  };

  if(loading)return <View style={styles.screen}><ActivityIndicator color={colors.green}/></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable>
    <Text style={styles.h1}>Live BUKLOD Support</Text>
    <Text style={styles.muted}>Private support conversation with BSOC. Never send passwords, OTPs or recovery codes here.</Text>
    {!uid?<View style={styles.card}>
      <Text style={styles.h2}>Sign in to use private live chat</Text>
      <Text style={styles.muted}>If you cannot access your account, use Forgot Password → Admin Help. It is available before login.</Text>
      <Pressable style={styles.button} onPress={()=>router.push('/(auth)/forgot-password' as any)}>
        <Text style={styles.buttonText}>Password Recovery / Admin Help</Text>
      </Pressable>
    </View>:<>
      {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {!!notice&&<Text style={styles.notice}>{notice}</Text>}
      <Text style={styles.h2}>My support cases</Text>
      <View style={styles.cases}>
      {cases.map(item=><Pressable key={item.id} onPress={()=>setCaseId(item.id)}
        style={[styles.case,caseId===item.id&&styles.active]}>
        <Text style={styles.bold}>{item.title}</Text>
        <Text style={styles.muted}>{item.status} · {item.id.slice(0,8).toUpperCase()}</Text>
      </Pressable>)}
      </View>
      {!caseId?<View style={styles.card}>
        <Text style={styles.h2}>Create a concern</Text>
        <View style={styles.cases}>
          {(['bug','privacy','other'] as const).map(c=><Pressable key={c} onPress={()=>setCategory(c)} style={[styles.case,category===c&&styles.active]}>
            <Text>{c}</Text>
          </Pressable>)}
        </View>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Short subject"/>
        <TextInput style={[styles.input,styles.area]} value={description} onChangeText={setDescription} multiline placeholder="Explain what happened"/>
        <Pressable style={styles.button} disabled={busy} onPress={()=>void create()}>
          <Text style={styles.buttonText}>{busy?'Creating…':'Create support case'}</Text>
        </Pressable>
      </View>:<>
        <Pressable style={styles.linkButton} onPress={()=>setCaseId('')}><Text style={styles.link}>+ New concern</Text></Pressable>
        <View style={styles.card}>
          <Text style={styles.h2}>Conversation</Text>
          {messages.length===0&&<Text style={styles.muted}>Your case is open. Send a message to BSOC support.</Text>}
          {messages.map(m=><View key={m.id} style={[styles.bubble,m.sender_id===uid&&styles.mine]}>
            <Text style={styles.muted}>{m.sender_kind==='agent'?'BSOC Agent':'You'} · {new Date(m.created_at).toLocaleString()}</Text>
            <Text style={styles.body}>{m.body}</Text>
          </View>)}
          {evidence.map(file=><View key={file.id} style={styles.evidence}>
            <Text style={styles.bold}>{file.mime_type.startsWith('image/')?'Photo':'Video'} evidence</Text>
            <Text style={styles.muted}>{new Date(file.created_at).toLocaleString()}</Text>
            {!!file.url&&<Pressable onPress={()=>{if(file.url)void import('expo-web-browser').then(w=>w.openBrowserAsync(file.url!));}}>
              <Text style={styles.link}>View private attachment</Text>
            </Pressable>}
          </View>)}
          <TextInput multiline style={[styles.input,styles.area]} placeholder="Message your support agent…" value={draft} onChangeText={setDraft}/>
          <Pressable disabled={busy||!draft.trim()} style={styles.button} onPress={()=>void send()}>
            <Text style={styles.buttonText}>{busy?'Sending…':'Send message'}</Text>
          </Pressable>
          <Pressable disabled={uploadBusy} style={styles.secondary} onPress={()=>void upload()}>
            <Text style={styles.link}>{uploadBusy?'Uploading evidence…':'Attach photo or video'}</Text>
          </Pressable>
          <Text style={styles.muted}>Private evidence, maximum 250 MB per file. Large recordings can consume device memory during upload.</Text>
        </View>
      </>}
    </>}
  </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.white},content:{padding:18,gap:13,paddingBottom:90},
 h1:{fontSize:24,fontWeight:'800',color:colors.text},h2:{fontSize:17,fontWeight:'800',color:colors.text},
 bold:{fontWeight:'700',color:colors.text},muted:{fontSize:12,color:'#64748b',lineHeight:18},body:{fontSize:14,color:colors.text,lineHeight:21},
 card:{padding:16,gap:12,borderWidth:1,borderColor:'#e2e8f0',borderRadius:14},
 cases:{flexDirection:'row',flexWrap:'wrap',gap:8},case:{padding:10,borderRadius:10,borderWidth:1,borderColor:'#cbd5e1',gap:3},
 active:{borderColor:colors.green,backgroundColor:'#effbf4'},
 bubble:{padding:11,gap:5,backgroundColor:'#f1f5f9',borderRadius:12},mine:{backgroundColor:'#e0f2e7'},
 input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,padding:12,color:colors.text},
 area:{minHeight:72,textAlignVertical:'top'},
 button:{padding:13,backgroundColor:colors.green,borderRadius:9,alignItems:'center'},
 buttonText:{color:colors.white,fontWeight:'800'},secondary:{alignItems:'center',padding:8},
 link:{color:colors.green,fontWeight:'700'},linkButton:{padding:8},
 evidence:{borderWidth:1,borderColor:'#e2e8f0',padding:10,borderRadius:9,gap:4},
 error:{padding:10,backgroundColor:'#fee2e2',color:'#991b1b'},notice:{padding:10,backgroundColor:'#dcfce7',color:'#166534'}
});
