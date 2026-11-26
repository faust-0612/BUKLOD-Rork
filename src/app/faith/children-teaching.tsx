import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {decode} from 'base64-arraybuffer';
import {useAuth} from '@/providers/AuthProvider';
import {useNetwork} from '@/providers/NetworkProvider';
import {supabase} from '@/lib/supabase';
import {todayInManila} from '@/lib/buklodScopeFaithPeriodReport';
import {fetchChildrenStoryLibrary} from '@/features/childrenStories/service';
import {localize,type ChildrenStory} from '@/features/childrenStories/catalog';
const enabled=process.env.EXPO_PUBLIC_CHILDREN_TEACHING_ENABLED==='true';
const bucket='buklod-children-teaching-evidence';
const audiences=[['family','Family group'],['sunday_school','Sunday School'],['community_group','Community group']] as const;
export default function ChildrenTeachingScreen(){
 const {user}=useAuth();const params=useLocalSearchParams<{scopeId:string}>();
 const scopeId=typeof params.scopeId==='string'?params.scopeId:'';
 return <AdultTeachingForm key={(user?.id??'signed-out')+':'+scopeId} userId={user?.id??''} scopeId={scopeId}/>;
}
function AdultTeachingForm({userId,scopeId}:{userId:string;scopeId:string}){
 const {online}=useNetwork();const [allowed,setAllowed]=useState(false);
 const [stories,setStories]=useState<ChildrenStory[]>([]);const [storyId,setStoryId]=useState('');
 const [search,setSearch]=useState('');const [date,setDate]=useState(todayInManila);
 const [audience,setAudience]=useState('');const [count,setCount]=useState('');const [reflection,setReflection]=useState('');
 const [consent,setConsent]=useState(false);const [photo,setPhoto]=useState<ImagePicker.ImagePickerAsset|null>(null);
 const [busy,setBusy]=useState(false);const [receipt,setReceipt]=useState('');const [notice,setNotice]=useState('');
 const request=useRef<string|null>(null);const [locked,setLocked]=useState(false);const inflight=useRef(false);
 useEffect(()=>{let alive=true;setAllowed(false);if(!enabled||!online||!userId||!scopeId)return;
 void (async()=>{try{const {data,error}=await (supabase as any).rpc('buklod_children_teaching_enabled_v1',{p_scope_id:scopeId});
 if(!alive)return;if(error||data!==true){setNotice('Teaching reports are not enabled for this workspace.');return;}
 setAllowed(true);const library=await fetchChildrenStoryLibrary(userId);if(alive)setStories(library);
 }catch{if(alive)setNotice('Could not check teaching availability. Reopen when online.');}})();return()=>{alive=false;};},[userId,scopeId,online]);
 async function choose(){
 if(!allowed||locked||inflight.current)return;
 const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
 if(!permission.granted){setNotice('Photo permission is required.');return;}
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:1,allowsEditing:false,exif:false});
 if(!result.canceled)setPhoto(result.assets[0]);
 }
 const valid=Boolean(photo&&consent&&storyId&&audience&&/^[0-9]{1,3}$/.test(count)&&Number(count)>=1&&Number(count)<=100&&reflection.trim().length>=20&&reflection.trim().length<=1000&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date));
 async function submit(){
 if(inflight.current||!allowed||!online||!photo||!valid)return;
 inflight.current=true;setBusy(true);setNotice('');setLocked(true);
 const id=request.current??Crypto.randomUUID();request.current=id;
 const args={p_expected_user:userId,p_scope_id:scopeId,p_request_id:id,p_story_id:storyId,p_session_date:date,p_audience:audience,p_participant_count:Number(count),p_reflection:reflection,p_consent:consent};
 try{
 const session=await supabase.auth.getSession();if(session.data.session?.user.id!==userId)throw new Error('Account changed. Reopen the form.');
 const manipulation=ImageManipulator.ImageManipulator.manipulate(photo.uri);manipulation.resize({width:Math.min(960,photo.width||960)});
 const rendered=await manipulation.renderAsync();const image=await rendered.saveAsync({format:ImageManipulator.SaveFormat.JPEG,compress:.65,base64:true});
 if(!image.base64)throw new Error('Photo preparation failed.');
 const bytes=decode(image.base64);if(bytes.byteLength>2097152)throw new Error('Photo exceeds 2 MB.');
 const path=userId+'/'+scopeId+'/'+id+'.jpg';
 const upload=await supabase.storage.from(bucket).upload(path,bytes,{contentType:'image/jpeg',upsert:false});
 const {data,error}=await (supabase as any).rpc('submit_my_children_teaching_v1',args);
 if(error||data?.recorded!==true)throw new Error(error?.message||upload.error?.message||'Report not confirmed');
 setReceipt(data.points>0?(data.claim_state==='pending'?'Report recorded · +10 BP ready to claim':'Report already recorded · reward status '+String(data.claim_state)):'Report recorded · no BP issued');
 setReflection('');setPhoto(null);setNotice('');
 }catch(e:any){setNotice(String(e?.message??'Unable to confirm report')+' — retry this same report, or close to correct details.');}
 finally{inflight.current=false;setBusy(false);}
 }
 if(!enabled||!userId)return <View style={s.body}><Text style={s.text}>Teaching reporting unavailable.</Text><Pressable onPress={()=>router.back()}><Text style={s.link}>Back</Text></Pressable></View>;
 const selected=stories.find(x=>x.id===storyId);
 const filtered=stories.filter(x=>localize(x.title,'tl').toLowerCase().includes(search.toLowerCase())&&x.id!==storyId);
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
 <Pressable onPress={()=>router.back()}><Text style={s.link}>← Back</Text></Pressable><Text style={s.title}>Children Teaching Session</Text>
 <Text style={s.text}>For adult teachers only. Use a photo of teaching materials, not children's faces, names or records. Obtain permission before uploading. Automatic checks confirm completeness, not the truth of the event.</Text>
 {!!notice&&<Text accessibilityRole="alert" style={s.notice}>{notice}</Text>}
 {!!receipt?<Text style={s.success}>{receipt}</Text>:allowed&&<>
 <Text style={s.text}>Select a story{selected?' · '+localize(selected.title,'tl'):''}</Text><TextInput editable={!locked} style={s.input} placeholder="Search stories" value={search} onChangeText={setSearch}/>
 {filtered.slice(0,20).map(x=><Pressable disabled={locked} key={x.id} onPress={()=>setStoryId(x.id)} style={s.choice}><Text style={s.text}>{localize(x.title,'tl')}</Text></Pressable>)}
 <Text style={s.text}>Session date (Manila, YYYY-MM-DD)</Text><TextInput editable={!locked} style={s.input} value={date} onChangeText={setDate}/>
 <Text style={s.text}>Who was taught? No names.</Text>{audiences.map(([key,label])=><Pressable disabled={locked} key={key} onPress={()=>setAudience(key)} style={[s.choice,audience===key&&s.selected]}><Text style={s.text}>{label}</Text></Pressable>)}
 <TextInput editable={!locked} style={s.input} keyboardType="number-pad" placeholder="Participants (1–100)" value={count} onChangeText={setCount}/>
 <TextInput editable={!locked} style={[s.input,{minHeight:88}]} multiline maxLength={1000} placeholder="Reflection (20+ characters; no personal identifiers)" value={reflection} onChangeText={setReflection}/>
 <Pressable disabled={locked||busy} onPress={()=>void choose().catch(()=>setNotice('Unable to select photo.'))} style={s.choice}><Text style={s.text}>{photo?'Photo selected':'Choose private materials photo'}</Text></Pressable>
 <Pressable disabled={locked} accessibilityRole="checkbox" accessibilityState={{checked:consent}} onPress={()=>setConsent(v=>!v)} style={s.choice}><Text style={s.text}>{consent?'☑':'☐'} I am an adult teacher, have permission, and confirm the photo contains no identifying details of children.</Text></Pressable>
 <Pressable disabled={busy||!online||!valid} onPress={()=>void submit()} style={s.button}><Text style={s.buttonText}>{busy?'Checking private evidence…':locked?'Retry same report':'Submit teaching report'}</Text></Pressable>
 </>}
 </ScrollView>;
}
const s=StyleSheet.create({body:{padding:16,gap:10,backgroundColor:'#F4F8F5',flexGrow:1},title:{fontSize:23,fontWeight:'900',color:'#194C46'},text:{fontSize:15,color:'#23453E'},link:{color:'#19734D',fontWeight:'800'},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#BCCFC5',borderRadius:10,padding:11,color:'#233F39'},choice:{padding:10,backgroundColor:'#FFF',borderWidth:1,borderColor:'#C7DED1',borderRadius:10},selected:{borderColor:'#1B805A',backgroundColor:'#E0F3E7'},button:{backgroundColor:'#19734D',padding:14,borderRadius:12},buttonText:{color:'#FFF',fontWeight:'800',textAlign:'center'},notice:{color:'#944323'},success:{color:'#17673E',fontSize:18,fontWeight:'800'}});
