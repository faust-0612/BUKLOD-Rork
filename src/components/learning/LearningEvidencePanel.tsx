import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,Text,TextInput,View} from 'react-native';
import {learningEvidencePilot,readEvidenceDraft,saveEvidenceDraft,submitEvidenceDraft,type EvidenceDraft,type EvidenceModule} from '@/lib/learningEvidenceDraft';

export function LearningEvidencePanel({account,module,subject,online,revision=0}:{
 account:string;module:EvidenceModule;subject:string;online:boolean;revision?:number;
}){
 const [draft,setDraft]=useState<EvidenceDraft|null>(null);
 const [reflection,setReflection]=useState('');
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [notice,setNotice]=useState('');
 const scope=useRef(0);
 const action=useRef(false);
 useEffect(()=>{
  const n=++scope.current;setDraft(null);setReflection('');setLoaded(false);setBusy(false);setNotice('');action.current=false;
  if(!learningEvidencePilot||!account)return;
  void readEvidenceDraft(account,module,subject).then(v=>{
   if(scope.current!==n)return;
   setDraft(v);if(v?.payload.module==='bible_reading')setReflection(v.payload.reflection);setLoaded(true);
  }).catch(()=>{if(scope.current===n)setNotice('Hindi mabasa ang saved assessment. Huwag burahin ang iyong draft.');});
  return ()=>{scope.current++;};
 },[account,module,subject,revision]);
 async function submit(){
  if(action.current||!loaded)return;action.current=true;const n=scope.current;setBusy(true);setNotice('');
  try{
   let current=draft;
   if(module==='bible_reading'){
    if(reflection.trim().length<20){setNotice('Isulat ang natutuhan at isang application (20 characters minimum).');return;}
    current=await saveEvidenceDraft(account,{module,subject_id:subject,reflection:reflection.trim()});
   }
   if(!current)return;
   if(online&&!current.result)current=await submitEvidenceDraft(account,module,subject);
   if(scope.current===n){setDraft(current);if(!current.result)setNotice(online?'Saved · checking unavailable or pending. Retry after a minute.':'Saved offline · sync when online.');}
  }catch{if(scope.current===n)setNotice('Hindi nakumpirma ang assessment. Subukang muli; walang points na na-award.');}
  finally{if(scope.current===n){action.current=false;setBusy(false);}}
 }
 if(!learningEvidencePilot||!account||(!loaded&&!notice))return null;
 if(module==='children_story'&&!draft&&!notice)return null;
 const result=draft?.result;
 const unchanged=module!=='bible_reading'||(draft?.payload.module==='bible_reading'&&draft.payload.reflection===reflection.trim());
 return <View style={{padding:12,borderWidth:1,borderColor:'#9ABDAE',borderRadius:12,marginVertical:8,backgroundColor:'#F3FBF6',gap:8}}>
  <Text style={{color:'#184A39',fontWeight:'800'}}>{module==='children_story'?'Story check · server verification':'Bible Reading · personal reflection'}</Text>
  {module==='bible_reading'&&<><Text style={{color:'#275D45'}}>Ano ang natutuhan mo sa kabanata at paano mo ito maisasabuhay?</Text><TextInput multiline maxLength={1600} editable={!busy&&loaded} value={reflection} onChangeText={setReflection} placeholder="Isulat ang iyong reflection..." placeholderTextColor="#657A70" style={{color:'#184A39',borderWidth:1,borderColor:'#B8CCC0',borderRadius:8,padding:8,minHeight:85,textAlignVertical:'top'}}/></>}
  {result&&unchanged?<><Text style={{color:'#184A39'}}>{result.status==='verified'?'Server-verified story check':result.status==='shadow_candidate'?'Assessment candidate · not yet official':result.status==='shadow_rework'?'Suggested revision · not a final grade':'Review your answers and try again'}</Text>{result.items.filter(i=>i.feedback).map(i=><Text key={i.id} style={{color:'#275D45'}}>{i.id}: {i.feedback}</Text>)}</>:null}
  {!!notice&&<Text accessibilityRole="alert" style={{color:'#275D45'}}>{notice}</Text>}
  {(!result||!unchanged)&&<Pressable disabled={busy||!loaded} accessibilityRole="button" onPress={()=>void submit()} style={{backgroundColor:'#246C50',borderRadius:8,padding:10,opacity:busy?.6:1}}>{busy?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff',fontWeight:'700'}}>{online?'Save and check':'Save offline'}</Text>}</Pressable>}
  <Text style={{color:'#466B5B',fontSize:12}}>Assessment pilot · no additional BP or UC awarded.</Text>
 </View>;
}
