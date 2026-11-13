import React,{useCallback,useEffect,useRef,useState} from 'react';
import {
 ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,Text,View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminGate } from '@/components/AdminGate';
import { router } from 'expo-router';
import {
 saliksikAdminList,saliksikAdminPreview,saliksikAdminPublish,
 saliksikGenerateDraft,saliksikSignedOriginalUrl,saliksikUploadOriginal,
 type SaliksikSource,
} from '@/lib/saliksikClient';

const green='#235F48';
const textError=(e:unknown)=>e instanceof Error?e.message:String(e);
export default function SaliksikLibraryScreen(){
 const [sources,setSources]=useState<SaliksikSource[]>([]);
 const [preview,setPreview]=useState<any>(null);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const loading=useRef(false);
 const active=useRef(true);
 const refresh=useCallback(async()=>{
  if(loading.current)return;
  loading.current=true;
  try{
   const result=await saliksikAdminList();
   if(active.current)setSources(result);
  }catch(e){if(active.current)setError(textError(e));}
  finally{loading.current=false;}
 },[]);
 useEffect(()=>{active.current=true;void refresh();return()=>{active.current=false;};},[refresh]);
 const process=async(id:string)=>{
  setBusy('Generating draft');
  setError('');
  try{
   for(let batch=1;batch<=4;batch++){
    setBusy('Generating investigation batch '+batch+' / 4');
    const result=await saliksikGenerateDraft(id) as any;
    if(!result?.ok)throw new Error('Generation not confirmed');
    const completed=Number(result.total_investigations??0);
    if(completed===8){setNotice('Eight investigations ready. Review sources and keys before publishing.');break;}
    if(![2,4,6].includes(completed))throw new Error('Unexpected partial generation state');
    setNotice(completed+' / 8 investigations drafted; resume if interrupted.');
   }
  }catch(e){setError(textError(e));}
  finally{setBusy('');await refresh();}
 };
 const upload=async()=>{
  if(busy)return;
  setBusy('Selecting manuscripts');setError('');setNotice('');
  try{
   const result=await DocumentPicker.getDocumentAsync({
    type:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'],
    copyToCacheDirectory:true,multiple:true,
   });
   if(result.canceled){setBusy('');return;}
   const ids:string[]=[];
   for(const asset of result.assets.slice(0,10)){
    setBusy('Uploading '+asset.name);
    const uploaded=await saliksikUploadOriginal(asset);
    if(!uploaded.duplicate)ids.push(uploaded.id);
   }
   setNotice('Private originals saved. AI drafts require verification before publication.');
   await refresh();
   setBusy('');
   // Sequential, bounded work; an interrupted upload remains safely QUEUED for retry.
   for(const id of ids) await process(id);
  }catch(e){setError(textError(e));setBusy('');await refresh();}
 };
 const showPreview=async(item:SaliksikSource)=>{
  if(!item.collection_id||busy)return;
  setBusy('Loading review');setError('');
  try{setPreview(await saliksikAdminPreview(item.collection_id));}
  catch(e){setError(textError(e));}
  finally{setBusy('');}
 };
 const publish=async()=>{
  if(!preview?.id||busy)return;
  setBusy('Publishing verified collection');setError('');
  try{
   await saliksikAdminPublish(preview.id);
   setNotice('Collection approved in database. Member visibility still requires the separate rollout gate.');
   setPreview(null);await refresh();
  }catch(e){setError(textError(e));}
  finally{setBusy('');}
 };
 const openOriginal=async(source:SaliksikSource)=>{
  if(!source.storage_path)return;
  try{
   const url=await saliksikSignedOriginalUrl(source.storage_path);
   if(!url)throw new Error('Original unavailable');
   await Linking.openURL(url);
  }catch(e){setError(textError(e));}
 };
 return <AdminGate>
  <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
   <Pressable onPress={()=>router.back()} style={styles.back}>
    <MaterialCommunityIcons name="chevron-left" color={green} size={22}/>
    <Text style={styles.backText}>Admin / Formation & Content</Text>
   </Pressable>
   <Text style={styles.kicker}>BUKLOD SALIKSIK</Text>
   <Text style={styles.title}>Knowledge Vault</Text>
   <Text style={styles.sub}>Upload private manuscripts, generate evidence-based investigation drafts, review the questions and publish when verified.</Text>
   <View style={styles.note}>
    <MaterialCommunityIcons name="shield-lock-outline" color={green} size={21}/>
    <Text style={styles.noteText}>Original files are private and not published. Automatic drafts use a configured external AI provider. Manuscripts and questions require source checking before approval.</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Upload manuscripts"
    disabled={!!busy} onPress={()=>void upload()} style={[styles.primary,!!busy&&styles.disabled]}>
    <MaterialCommunityIcons name="file-upload-outline" size={21} color="#fff"/>
    <Text style={styles.primaryText}>{busy||'UPLOAD PDF / DOCX / TXT'}</Text>
    {!!busy?<ActivityIndicator size="small" color="#fff"/>:null}
   </Pressable>
   <Text style={styles.helper}>Up to 10 files per selection • 10 MB each • Originals remain in private Supabase storage.</Text>
   {notice?<Text style={styles.success}>{notice}</Text>:null}
   {error?<Text selectable style={styles.error}>{error}</Text>:null}
   <View style={styles.sectionHead}>
    <Text style={styles.heading}>MANUSCRIPT QUEUE ({sources.length})</Text>
    <Pressable disabled={!!busy} onPress={()=>void refresh()} accessibilityRole="button"
      accessibilityLabel="Refresh manuscripts">
     <MaterialCommunityIcons name="refresh" size={22} color={green}/>
    </Pressable>
   </View>
   {sources.length===0?<Text style={styles.muted}>No uploaded manuscripts yet or database migration has not been released.</Text>:null}
   {sources.map(item=><View key={item.id} style={styles.card}>
     <View style={styles.row}>
      <MaterialCommunityIcons name="file-document-outline" size={26} color={green}/>
      <View style={{flex:1}}>
       <Text style={styles.itemTitle}>{item.title}</Text>
       <Text style={styles.small}>{item.file_name}</Text>
       <Text style={styles.small}>Status: {item.collection_status==='published'?'PUBLISHED':item.status.toUpperCase()} · {item.investigations??0} investigations</Text>
      </View>
     </View>
     {item.last_error?<Text style={styles.error}>Last attempt: {item.last_error}</Text>:null}
     <View style={styles.actions}>
      <Pressable onPress={()=>void openOriginal(item)} style={styles.action}><Text style={styles.actionText}>Original</Text></Pressable>
      {item.collection_id?<Pressable disabled={!!busy} onPress={()=>void showPreview(item)}
       style={styles.action}><Text style={styles.actionText}>Review draft</Text></Pressable>:null}
      {item.collection_status!=='published'&&(item.investigations??0)<8?<Pressable disabled={!!busy}
       onPress={()=>void process(item.id)} style={styles.action}>
       <Text style={styles.actionText}>{item.status==='draft'?'CONTINUE DRAFT':'Generate / retry'}</Text>
      </Pressable>:null}
     </View>
    </View>)}
   {preview?.id?<View style={styles.preview}>
    <View style={styles.sectionHead}>
     <Text style={styles.heading}>ADMIN REVIEW: {preview.title}</Text>
     <Pressable onPress={()=>setPreview(null)}><MaterialCommunityIcons name="close" size={22} color="#444"/></Pressable>
    </View>
    <Text style={styles.muted}>Verify each reference, answer key and manuscript excerpt against the original. This screen shows unpublished private answer keys to System Admin ONLY.</Text>
    {(preview.investigations??[]).map((investigation:any)=>(
     <View key={investigation.id} style={styles.reviewItem}>
      <Text style={styles.itemTitle}>{investigation.tier.toUpperCase()}: {investigation.title}</Text>
      <Text style={styles.body}>{investigation.lesson_text}</Text>
      <Text style={styles.small}>Source excerpt: {investigation.source_excerpt}</Text>
      {(investigation.questions??[]).map((q:any,k:number)=>(
       <View key={q.id||k} style={styles.question}>
        <Text style={styles.body}>{k+1}. {q.prompt}</Text>
        <Text style={styles.success}>Correct: {q.options?.[q.correctIndex]??'Missing'}</Text>
        <Text style={styles.small}>Competency: {q.competency} • Evidence: {q.evidence}</Text>
       </View>
      ))}
     </View>
    ))}
    {preview.status==='draft'?<Pressable disabled={!!busy} style={styles.primary} onPress={()=>Alert.alert(
      'Publish reviewed investigations?',
      'Only approve after checking the original and every source quote. Publishing does not activate the member rollout.',
      [{text:'Cancel',style:'cancel'},{text:'Publish verified',onPress:()=>void publish()}]
    )}><Text style={styles.primaryText}>APPROVE AND PUBLISH CONTENT</Text></Pressable>:null}
   </View>:null}
   <Text style={styles.footer}>Launch remains OFF by default until migration, AI validation, RC tests, and separate production approval are complete. Master +35 remains unavailable without written-answer validation.</Text>
  </ScrollView>
 </AdminGate>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#F7FAF8'},content:{padding:18,paddingBottom:80,gap:12,maxWidth:800,width:'100%',alignSelf:'center'},
 back:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start'},
 backText:{color:green,fontWeight:'700',fontSize:12},kicker:{fontSize:11,fontWeight:'900',color:green,letterSpacing:1.5},
 title:{fontSize:27,fontWeight:'900',color:'#17352A'},sub:{fontSize:14,color:'#64756E',lineHeight:20},
 note:{backgroundColor:'#E7F1EB',borderRadius:14,padding:14,flexDirection:'row',gap:8},
 noteText:{flex:1,fontSize:12,color:'#355746',lineHeight:19},
 primary:{backgroundColor:green,padding:14,borderRadius:13,flexDirection:'row',gap:10,alignItems:'center',justifyContent:'center'},
 disabled:{opacity:0.65},primaryText:{color:'#fff',fontWeight:'800',fontSize:13},
 helper:{color:'#748279',fontSize:11},success:{color:'#1B6C46',fontWeight:'700',fontSize:12,lineHeight:18},
 error:{color:'#A73535',fontSize:12,lineHeight:18},
 sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:8},
 heading:{color:'#1A4936',fontWeight:'900',fontSize:13,flex:1},
 muted:{color:'#6D8074',fontSize:12,lineHeight:18},card:{borderWidth:1,borderColor:'#DDE8E1',backgroundColor:'#fff',borderRadius:14,padding:13,gap:9},
 row:{flexDirection:'row',alignItems:'flex-start',gap:9},itemTitle:{fontSize:14,color:'#203D30',fontWeight:'800'},
 small:{fontSize:11,color:'#637569',lineHeight:17},actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
 action:{borderWidth:1,borderColor:'#C7DDD0',borderRadius:8,paddingVertical:7,paddingHorizontal:10},
 actionText:{color:green,fontSize:11,fontWeight:'700'},
 preview:{backgroundColor:'#fff',borderRadius:14,padding:13,gap:12,borderWidth:1,borderColor:'#BDD1C1'},
 reviewItem:{borderTopWidth:1,borderColor:'#E4EAE5',paddingTop:12,gap:8},
 body:{color:'#284436',fontSize:12,lineHeight:18},
 question:{padding:8,backgroundColor:'#F2F7F3',borderRadius:7,gap:4},
 footer:{color:'#76827B',fontSize:11,lineHeight:18,marginTop:8}
});
