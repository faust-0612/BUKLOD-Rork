import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Alert,FlatList,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {router,useLocalSearchParams} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {colors} from '@/lib/theme';

const BUCKET='bsoc-support-evidence';
const ALLOWED=new Set(['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']);
type Case={id:string; title:string; status:string; resolution:string|null; created_at:string};
type Message={id:string;body:string;sender_id:string;sender_kind:string;created_at:string};
type Evidence={id:string;case_id:string;message_id:string|null;object_path:string;mime_type:string;created_at:string};
const errorText=(e:unknown)=>String((e as any)?.message??e??'Network error').slice(0,250);

export default function LiveSupport(){
  const [uid,setUid]=useState<string|null>(null);
  const [cases,setCases]=useState<Case[]>([]);
  const params=useLocalSearchParams<{case_id?:string;caseId?:string}>();
  const requestedCaseId=typeof params.case_id==='string'?params.case_id:typeof params.caseId==='string'?params.caseId:null;
  const [caseId,setCaseId]=useState('');
  const [creatingNew,setCreatingNew]=useState(false);
  const [showAllCases,setShowAllCases]=useState(false);
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
  const requestSequence=useRef(0);
  const handledDeepLink=useRef<string|null>(null);

  const loadCases=useCallback(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    setUid(user?.id||null);
    if(!user){setLoading(false);return;}
    const {data,error}=await supabase.from('user_feedback')
      .select('id,title,status,resolution,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(80);
    if(error)setError(error.message);
    else{
      const rows=(data||[]) as Case[];
      setCases(rows);
      if(requestedCaseId&&!rows.some(x=>x.id===requestedCaseId))
        setError('The requested support case is not available for this account.');
      setCaseId(current=>{
        if(creatingNew)return '';
        if(requestedCaseId&&handledDeepLink.current!==requestedCaseId&&rows.some(x=>x.id===requestedCaseId)){
          handledDeepLink.current=requestedCaseId;
          return requestedCaseId;
        }
        if(current&&rows.some(x=>x.id===current))return current;
        return rows.find(x=>!['closed','resolved'].includes(x.status))?.id??
          rows.find(x=>x.status!=='closed')?.id??rows[0]?.id??'';
      });
    }
    setLoading(false);
  },[requestedCaseId,creatingNew]);
  useEffect(()=>{void loadCases();},[loadCases]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(AppState.currentState==='active')void loadCases();},25000);
    return ()=>clearInterval(timer);
  },[loadCases]);

  const loadThread=useCallback(async()=>{
    if(!caseId)return;
    const sequence=++requestSequence.current;
    const [chat,attachments]=await Promise.all([
      supabase.from('bsoc_case_messages').select('id,body,sender_id,sender_kind,created_at')
        .eq('case_id',caseId).order('created_at',{ascending:false}).limit(150),
      supabase.from('bsoc_case_attachments').select('id,case_id,message_id,object_path,mime_type,created_at')
        .eq('case_id',caseId).order('created_at',{ascending:false}).limit(50)
    ]);
    if(sequence!==requestSequence.current)return;
    if(chat.error) {setError(chat.error.message);return;}
    if(attachments.error){setError(attachments.error.message);return;}
    setMessages(((chat.data||[]) as Message[]).slice().reverse());
    const files=((attachments.data||[]) as Evidence[]).slice().reverse();
    const signed=await Promise.all(files.map(async file=>{
      const {data}=await supabase.storage.from(BUCKET).createSignedUrl(file.object_path,300);
      return {...file,url:data?.signedUrl};
    }));
    if(sequence!==requestSequence.current)return;
    setEvidence(signed);
  },[caseId]);
  useEffect(()=>{
    if(!caseId)return;
    void loadThread();
    const channel=supabase.channel('bsoc-member-'+caseId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'bsoc_case_messages',filter:'case_id=eq.'+caseId},()=>{void loadThread();})
      .subscribe();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void loadThread();},15000);
    return ()=>{requestSequence.current+=1;clearInterval(timer);void supabase.removeChannel(channel);};
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
      setCreatingNew(false);
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
        body:draft.trim().slice(0,8000),client_nonce:Crypto.randomUUID()
      });
      if(error)throw error;
      setDraft('');await loadThread();
    }catch(e){setError(errorText(e));}finally{setBusy(false);}
  };
  const reopen=async()=>{
    if(!caseId||!uid||busy||draft.trim().length<10)return;
    setBusy(true);setError('');setNotice('');
    try{
      const {error}=await supabase.rpc('buklod_bsoc_member_reopen_case_v1',{
        p_case_id:caseId,p_message:draft.trim().slice(0,8000),
        p_client_nonce:Crypto.randomUUID()
      });
      if(error)throw error;
      setDraft('');
      setNotice('Your original conversation was reopened. BSOC has been notified.');
      await Promise.all([loadCases(),loadThread()]);
    }catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  };
  const upload=async(kind:'photo'|'video')=>{
    if(!uid||uploadBusy||busy||Boolean(caseId&&cases.find(c=>c.id===caseId)?.status==='closed'))return;
    setUploadBusy(true);setError('');setNotice('');
    try{
      const type=kind==='photo'?['image/jpeg','image/png','image/webp']:
        ['video/mp4','video/quicktime','video/webm'];
      const result=await DocumentPicker.getDocumentAsync({
        type,multiple:false,copyToCacheDirectory:true,
      });
      if(result.canceled)return;
      const asset=result.assets[0];
      const mime=asset.mimeType||'application/octet-stream';
      if(!ALLOWED.has(mime))throw Error('Only JPG, PNG, WebP, MP4, QuickTime or WebM evidence is supported.');
      if(!asset.size||asset.size>262144000)throw Error('Choose an evidence file under 250 MB.');
      let targetCaseId=caseId;
      if(!targetCaseId){
        // One tap from the prominent attachment bar can open a private support
        // case. Its true ID is used for both Storage and attachment RLS.
        const {data,error:createError}=await supabase.rpc('submit_user_feedback',{
          p_category:category,
          p_title:(title.trim().length>=4?title.trim():kind==='photo'?'Photo evidence request':'Video evidence request').slice(0,140),
          p_message:(description.trim().length>=8?description.trim():
            'Visual evidence submitted for BUKLOD support. Please request any missing details.').slice(0,8000),
          p_app_version:Constants.expoConfig?.version||'unknown',
          p_app_environment:'BUKLOD_SUPPORT',
          p_diagnostics:{platform:'app',source:'bsoc_visual_support'}
        });
        if(createError)throw createError;
        if(!data)throw Error('Could not create support case for attachment.');
        targetCaseId=String(data);
        setCaseId(targetCaseId);
        setCreatingNew(false);
        setTitle('');setDescription('');
        await loadCases();
      }
      const evidenceId=Crypto.randomUUID();
      const objectPath=targetCaseId+'/'+uid+'/'+evidenceId;
      // Native and Web use the same private Storage policy. File bytes are bounded.
      const content=Platform.OS==='web' && asset.file
        ? await asset.file.arrayBuffer()
        : await new File(asset.uri).arrayBuffer();
      const {error:storageError}=await supabase.storage.from(BUCKET)
        .upload(objectPath,content,{contentType:mime,upsert:false});
      if(storageError)throw storageError;
      const {error:rowError}=await supabase.from('bsoc_case_attachments').insert({
        id:evidenceId,case_id:targetCaseId,uploader_id:uid,object_path:objectPath,
        byte_size:asset.size,mime_type:mime
      });
      if(rowError){
        // Avoid leaving an orphaned private attachment when metadata fails.
        await supabase.storage.from(BUCKET).remove([objectPath]).catch(()=>undefined);
        throw rowError;
      }
      setNotice(kind==='photo'?'Photo attached to your private case.':'Video attached to your private case.');
      if(targetCaseId===caseId)await loadThread();
    }catch(e){setError(errorText(e));}finally{setUploadBusy(false);}
  };

  if(loading)return <View style={styles.screen}><ActivityIndicator color={colors.green}/></View>;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={()=>router.back()}><Text style={styles.link}>‹ Back</Text></Pressable>
    <Text style={styles.h1}>Live BUKLOD Support</Text>
    <Text style={styles.muted}>Private support conversation with BSOC. Never send passwords, OTPs or recovery codes here.</Text>
    {uid&&<View style={styles.uploadHero}>
      <Text style={styles.h2}>Send a photo or video to BSOC</Text>
      <Text style={styles.muted}>Tap either button first. BUKLOD will attach your file to the current case, or create a private case automatically.</Text>
      <View style={styles.uploadActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Upload support photo"
          disabled={busy||uploadBusy||cases.find(c=>c.id===caseId)?.status==='closed'}
          style={styles.uploadButton} onPress={()=>void upload('photo')}>
          <Text style={styles.buttonText}>{uploadBusy?'Uploading…':'📷 Upload photo'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Upload support video"
          disabled={busy||uploadBusy||cases.find(c=>c.id===caseId)?.status==='closed'}
          style={styles.uploadButton} onPress={()=>void upload('video')}>
          <Text style={styles.buttonText}>{uploadBusy?'Uploading…':'🎬 Upload video'}</Text>
        </Pressable>
      </View>
    </View>}
    <View style={{backgroundColor:'#e8f7ef',borderRadius:12,padding:14,gap:6}}>
      <Text style={{fontSize:16,fontWeight:'800',color:colors.green}}>Paano mag-report ng problema</Text>
      <Text style={styles.body}>1. Sabihin kung ano ang hindi gumagana, saang screen ito nangyari, at ano ang inaasahan mong mangyari.</Text>
      <Text style={styles.body}>2. Magpadala ng screenshot o larawan ng error. Kung galaw, video playback, o upload ang issue, mas makakatulong ang maikling screen recording.</Text>
      <Text style={styles.body}>3. Takpan ang private details at huwag magpadala ng password, OTP, o recovery code. Optional ang evidence kung sapat na ang description.</Text>
      <Text style={styles.muted}>Pagkatapos gumawa ng ticket, gamitin ang Attach photo or video sa loob ng conversation.</Text>
    </View>
    {!uid?<View style={styles.card}>
      <Text style={styles.h2}>Cannot log in? Get support before login</Text>
      <Text style={styles.muted}>You can submit a concern even without signing in. Private two-way chat and evidence uploads require a signed-in account; never share credentials.</Text>
      {!!error&&<Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={()=>router.push('/(auth)/forgot-password' as any)}>
        <Text style={styles.buttonText}>Password Recovery / Admin Help</Text>
      </Pressable>
      <Text style={styles.h2}>Other account problem</Text>
      <Text style={styles.muted}>For sign-in problems, use secure password recovery and existing System Admin assistance. Private two-way chat and media evidence require a signed-in BUKLOD account.</Text>
      <Pressable style={styles.secondary} onPress={()=>router.push('/(auth)/login' as any)}>
        <Text style={styles.link}>Sign in to create a support conversation</Text>
      </Pressable>
    </View>:<>
      {!!error&&<Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {!!notice&&<Text style={styles.notice}>{notice}</Text>}

      <View style={styles.caseChooser}>
        <View style={styles.caseHead}>
          <Text style={styles.h2}>Your support conversations</Text>
          <Pressable style={styles.secondary} accessibilityRole="button"
            onPress={()=>{setCreatingNew(true);setCaseId('');setNotice('');}}>
            <Text style={styles.link}>+ New concern</Text>
          </Pressable>
        </View>
        {cases.length===0?<Text style={styles.muted}>No support conversation yet. Create one below.</Text>:null}
        {(showAllCases?cases:cases.slice(0,3)).map(item=><Pressable key={item.id} accessibilityRole="button"
          style={[styles.case,styles.caseChoice,caseId===item.id&&styles.active]}
          onPress={()=>{setCreatingNew(false);setCaseId(item.id);setNotice('');setError('');}}>
          <Text style={styles.bold} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.muted}>{item.status.toUpperCase()} · {item.id.slice(0,8).toUpperCase()}</Text>
        </Pressable>)}
        {cases.length>3?<Pressable style={styles.secondary} accessibilityRole="button" onPress={()=>setShowAllCases(x=>!x)}>
          <Text style={styles.link}>{showAllCases?'SHOW FEWER':'VIEW ALL '+cases.length+' CASES'}</Text>
        </Pressable>:null}
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
        <View style={styles.card}>
          <Text style={styles.h2}>Chat with BSOC · {caseId.slice(0,8).toUpperCase()}</Text>
          <Text style={styles.muted}>This is the same private thread used by BSOC personnel. Replies appear here automatically while online.</Text>
          {cases.find(c=>c.id===caseId)?.status==='resolved'?<>
            <Text style={styles.notice}>BSOC marked this case resolved. If it is still happening, describe what persists, then choose REOPEN SAME CASE below.</Text>
            {!!cases.find(c=>c.id===caseId)?.resolution&&<Text style={styles.muted} numberOfLines={4}>Recorded resolution: {cases.find(c=>c.id===caseId)?.resolution}</Text>}
          </>:null}
          {cases.find(c=>c.id===caseId)?.status==='closed'?<Text style={styles.notice}>This support case is closed and remains available as history. Create a new concern for unrelated issues.</Text>:null}
          <TextInput multiline style={[styles.input,styles.area]} placeholder="Message your support agent…" value={draft} onChangeText={setDraft}/>
          <Pressable disabled={busy||!draft.trim()||cases.find(c=>c.id===caseId)?.status==='closed'} style={styles.button} onPress={()=>void send()}>
            <Text style={styles.buttonText}>{busy?'Sending…':'Send message'}</Text>
          </Pressable>
          {cases.find(c=>c.id===caseId)?.status==='resolved'?<Pressable
            disabled={busy||draft.trim().length<10} accessibilityRole="button" style={styles.reopen}
            onPress={()=>void reopen()}>
            <Text style={styles.link}>ISSUE PERSISTS? REOPEN SAME CASE</Text>
          </Pressable>:null}
          <View style={styles.uploadActions}>
            <Pressable disabled={uploadBusy} style={styles.secondary} onPress={()=>void upload('photo')}>
              <Text style={styles.link}>Attach photo</Text>
            </Pressable>
            <Pressable disabled={uploadBusy} style={styles.secondary} onPress={()=>void upload('video')}>
              <Text style={styles.link}>Attach video</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>Tip: screenshot ng error message ang pinakamainam para sa visual bug; maikling video para sa playback, scrolling o navigation bugs. Huwag isama ang mga password, OTP, personal messages o financial details.</Text>
          <Text style={styles.muted}>Private evidence, maximum 250 MB per file. Large recordings can consume device memory during upload.</Text>
          <Text style={styles.h2}>Conversation & evidence log</Text>
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


        </View>
      </>}
    </>}
  </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:colors.white},content:{padding:13,gap:10,paddingBottom:90},
 caseChooser:{padding:12,borderRadius:12,borderWidth:1,borderColor:'#CBD5E1',gap:7,backgroundColor:'#F8FAFC'},
 caseHead:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
 caseChoice:{minHeight:51},
 reopen:{padding:13,borderWidth:1,borderColor:colors.green,borderRadius:9,alignItems:'center',backgroundColor:'#F2FAF6'},
 uploadHero:{backgroundColor:'#E8F7EF',borderRadius:14,padding:15,gap:9},
 uploadActions:{flexDirection:'row',flexWrap:'wrap',gap:9},
 uploadButton:{flex:1,minWidth:130,padding:13,borderRadius:10,backgroundColor:colors.green,alignItems:'center'},
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
