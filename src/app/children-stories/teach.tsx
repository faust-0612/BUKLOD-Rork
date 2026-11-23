import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { pickCommunityPhotos, type PickedCommunityPhoto } from '@/lib/buklodPickCommunityPhotos';
import BuklodEarnedStarsFeedback from '@/components/points/BuklodEarnedStarsFeedback';

const BUCKET='buklod-children-teaching-evidence';
function localDate(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function photoMimeType(p: PickedCommunityPhoto){
  const mime=String(p.mimeType??'').toLowerCase();
  if(['image/jpeg','image/png','image/webp'].includes(mime)) return mime;
  if(/\.png(?:$|\?)/i.test(p.uri))return 'image/png';
  if(/\.webp(?:$|\?)/i.test(p.uri))return 'image/webp';
  if(/\.jpe?g(?:$|\?)/i.test(p.uri))return 'image/jpeg';
  return null;
}
async function bytesForPhoto(p: PickedCommunityPhoto):Promise<Uint8Array>{
  if(Platform.OS==='web'&&p.webFile)return new Uint8Array(await p.webFile.arrayBuffer());
  const base64=await FileSystem.readAsStringAsync(p.uri,{encoding:FileSystem.EncodingType.Base64});
  return new Uint8Array(decode(base64));
}
export default function ChildrenTeachingSessionScreen(){
  const {storyId}=useLocalSearchParams<{storyId?:string}>();
  const {user}=useAuth();
  const id=typeof storyId==='string'?storyId:'';
  const [audienceKind,setAudienceKind]=useState<'person'|'group'>('group');
  const [audience,setAudience]=useState('');
  const [taughtOn,setTaughtOn]=useState(localDate);
  const [growth,setGrowth]=useState('');
  const [photo,setPhoto]=useState<PickedCommunityPhoto|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [earned,setEarned]=useState<{points:number;sequence:number}|null>(null);
  const [approved,setApproved]=useState(false);
  async function pickPhoto(){
    try{const p=await pickCommunityPhotos({remaining:1,maxPhotos:1});
      if(p[0]){setPhoto(p[0]);setNotice('');}
    }catch{Alert.alert('Photo','Hindi mabuksan ang photo picker. Subukan muli.');}
  }
  async function submit(){
    if(!id||!user?.id)return Alert.alert('Sign in','Active member account required.');
    if(audience.trim().length<3||growth.trim().length<20){
      return Alert.alert('Incomplete','Specify the person/group and at least 20 characters of personal growth.');
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(taughtOn)){
      return Alert.alert('Date','Use YYYY-MM-DD.');}
    if(!photo||!consent){
      return Alert.alert('Evidence','Add a photo and confirm you have permission to submit it privately.');
    }
    const mime=photoMimeType(photo);
    if(!mime)return Alert.alert('Photo','Use a JPEG, PNG, or WebP photo.');
    setBusy(true);setNotice('Uploading private evidence and verifying the report...');
    try{
      const data=await bytesForPhoto(photo);
      if(data.byteLength===0||data.byteLength>6291456)
        throw new Error('Photo must be under 6 MB.');
      const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
      const storagePath=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,12)}.${ext}`;
      const upload=await supabase.storage.from(BUCKET).upload(storagePath,data,{
        contentType:mime,upsert:false,
      });
      if(upload.error)throw upload.error;
      const {data:result,error}=await (supabase as any).rpc('submit_my_child_teaching_v4',{
        p_story_id:id,p_audience_kind:audienceKind,p_audience_description:audience.trim(),
        p_taught_on:taughtOn,p_growth_narrative:growth.trim(),
        p_photo_storage_path:storagePath,p_consent_attested:consent,
      });
      if(error)throw error;
      const points=Math.max(0,Number(result?.awarded_points)||0);
      if(points>0){
        setEarned(old=>({points,sequence:(old?.sequence??0)+1}));
        setApproved(true);
        setNotice('Teaching session auto-approved. +'+points+' BP earned, pending category claim.');
      }else{
        setNotice(String(result?.status)==='already_approved'
          ?'This teaching session is already approved. No duplicate points.'
          :'No new points: '+String(result?.status??'verification pending'));
      }
    }catch(e){
      setNotice(e instanceof Error?e.message:'Evidence upload or verification failed.');
    }finally{setBusy(false);}
  }
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <BuklodEarnedStarsFeedback award={earned}/>
    <Text style={s.title}>Children's Teaching Session</Text>
    <Text style={s.help}>+10 BP when complete and server-verified. The photo is private. Do not enter children's full names. Get permission for every person shown.</Text>
    <Text style={s.label}>Story</Text>
    <Text style={s.value}>{id||'Select a story first'}</Text>
    <Text style={s.label}>Sinong kinuwentuhan?</Text>
    <View style={s.row}>
      {(['person','group'] as const).map(v=><Pressable key={v} accessibilityRole="button"
        accessibilityState={{selected:audienceKind===v}}
        onPress={()=>setAudienceKind(v)} style={[s.choice,audienceKind===v&&s.active]}>
        <Text style={[s.choiceText,audienceKind===v&&s.activeText]}>{v==='person'?'Tao':'Grupo'}</Text>
      </Pressable>)}
    </View>
    <TextInput style={s.input} value={audience} onChangeText={setAudience}
      placeholder="Hal. kapatid, Sunday School class" maxLength={120}/>
    <Text style={s.label}>Kailan? (YYYY-MM-DD)</Text>
    <TextInput style={s.input} value={taughtOn} onChangeText={setTaughtOn}
      keyboardType="numbers-and-punctuation" maxLength={10}/>
    <Text style={s.label}>Personal na nangyaring paglago (minimum 20 characters)</Text>
    <TextInput style={[s.input,s.long]} multiline value={growth} onChangeText={setGrowth}
      placeholder="Ano ang natutuhan ninyo at anong pagbabago ang napansin?"
      maxLength={1500}/>
    <Text style={s.counter}>{growth.trim().length}/20 minimum</Text>
    <Pressable accessibilityRole="button" onPress={()=>void pickPhoto()} disabled={busy} style={s.photo}>
      <Text style={s.photoText}>{photo?'✓ Photo selected — tap to replace':'＋ Add private photo evidence'}</Text>
    </Pressable>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent}}
      onPress={()=>setConsent(v=>!v)} style={s.row}>
      <Text style={s.check}>{consent?'☑':'☐'}</Text>
      <Text style={[s.help,{flex:1}]}>I have permission to submit this photo; I will not include children's identifying details.</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy||approved||!id}
      onPress={()=>void submit()} style={[s.submit,(busy||approved||!id)&&s.disabled]}>
      {busy?<ActivityIndicator color="#FFF"/>:<Text style={s.submitText}>{approved?'APPROVED ✓':'SUBMIT FOR AUTO-APPROVAL (+10 BP)'}</Text>}
    </Pressable>
    {!!notice&&<Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
    <Pressable accessibilityRole="button" onPress={()=>router.back()} style={s.back}>
      <Text style={s.backText}>{approved?'DONE':'Back to story'}</Text>
    </Pressable>
  </ScrollView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:'#F4F8F5'},content:{padding:16,paddingBottom:46,gap:10},
  title:{fontSize:22,fontWeight:'900',color:'#194E40'},help:{fontSize:13,color:'#556C64',lineHeight:19},
  label:{fontSize:12,fontWeight:'800',color:'#31564C',marginTop:5},
  value:{fontSize:14,color:'#194E40',fontWeight:'700'},
  row:{flexDirection:'row',gap:9,alignItems:'center'},
  choice:{borderRadius:12,borderColor:'#95BDB0',borderWidth:1,paddingHorizontal:18,paddingVertical:10},
  active:{backgroundColor:'#17644B'},choiceText:{color:'#17644B',fontWeight:'700'},activeText:{color:'#FFF'},
  input:{minHeight:42,backgroundColor:'#FFF',borderColor:'#B8CFC5',borderWidth:1,borderRadius:10,padding:10,color:'#12392F'},
  long:{minHeight:94,textAlignVertical:'top'},counter:{textAlign:'right',color:'#71877F',fontSize:11},
  photo:{borderStyle:'dashed',borderWidth:1,borderColor:'#35886D',borderRadius:12,padding:15,alignItems:'center'},
  photoText:{color:'#17644B',fontSize:13,fontWeight:'800'},check:{fontSize:22,color:'#17644B'},
  submit:{backgroundColor:'#17644B',minHeight:48,borderRadius:12,alignItems:'center',justifyContent:'center',padding:10},
  disabled:{opacity:0.45},submitText:{color:'#FFF',fontWeight:'900',textAlign:'center',fontSize:13},
  notice:{fontSize:13,color:'#17644B',fontWeight:'700'},back:{alignItems:'center',padding:12},
  backText:{color:'#17644B',fontWeight:'700'}
});
