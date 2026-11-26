import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {
 saliksikRequestResearch,saliksikMyResearch,saliksikAutoAdvance,
 type SaliksikAutoResearchReceipt,type SaliksikResearchMethod,
} from '@/lib/saliksikClient';

const green='#19593C';
const methods:{id:SaliksikResearchMethod;title:string}[]=[
 {id:'exegetical',title:'Exegetical'},{id:'biblical_theology',title:'Biblical Theology'},
 {id:'systematic',title:'Systematic'},{id:'historical',title:'Historical'},
 {id:'comparative',title:'Comparative'},{id:'practical',title:'Practical'},
 {id:'education',title:'Christian Education'},{id:'mission_leadership',title:'Mission/Leadership'},
];
type Props={scopeId:string;onPublished:()=>Promise<void>};
export default function BuklodSaliksikResearchLab({scopeId,onPublished}:Props){
 const [question,setQuestion]=useState('');
 const [reference,setReference]=useState('Juan 1:1-14');
 const [method,setMethod]=useState<SaliksikResearchMethod>('exegetical');
 const [jobs,setJobs]=useState<SaliksikAutoResearchReceipt[]>([]);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const alive=useRef(true),running=useRef(false),resumed=useRef(false);
 const reload=useCallback(async()=>{
  try{
   const list=await saliksikMyResearch(scopeId);
   if(alive.current)setJobs(list??[]);
   return list??[];
  }catch{
   if(alive.current)setNotice('Research history is temporarily unavailable.');
   return [];
  }
 },[scopeId]);
 const advance=useCallback(async(requestId:string)=>{
  if(!requestId||running.current)return;
  running.current=true;
  if(alive.current){setBusy(true);setNotice('Awtomatikong sinusuri ang mga source at tanong...');}
  try{
   // Four bounded resumable generation batches. Closing the app does not lose
   // canonical-source or generated-draft progress; no Admin intervention.
   for(let step=0;step<5;step++){
    const result=await saliksikAutoAdvance(requestId);
    if(!alive.current)break;
    if(result.ready||result.status==='ready'){
     setNotice('Handa na ang 8 investigations at Written Master.');
     await onPublished();break;
    }
    if(result.busy){
     setNotice('Kasulukuyang nagpoproseso. Maaaring awtomatikong magpatuloy sa susunod na pagbukas.');
     break;
    }
    if(result.status==='held'){
     setNotice('Hindi pumasa ang source check. Walang inilathalang hindi verified na research.');
     break;
    }
    setNotice('Verified research draft: '+(result.progress??0)+' / 8 investigations.');
   }
   if(alive.current)await reload();
  }catch{
   if(alive.current)setNotice('Naka-save ang research. Hindi available ang AI ngayon; puwedeng awtomatikong ipagpatuloy sa muling pagbukas.');
  }finally{running.current=false;if(alive.current)setBusy(false);}
 },[onPublished,reload]);
 useEffect(()=>{
  alive.current=true;
  void reload().then(items=>{
   if(!alive.current||resumed.current)return;
   const pending=items.find(item=>item.status==='queued'||item.status==='processing');
   if(pending?.request_id){resumed.current=true;void advance(pending.request_id);}
  });
  return()=>{alive.current=false;};
 },[advance,reload]);
 const submit=async()=>{
  if(busy||question.trim().length<12||!scopeId)return;
  setBusy(true);setNotice('');
  try{
   const r=await saliksikRequestResearch(scopeId,question,reference,method);
   if(r.status==='ready'){
    setNotice('Umiiral na ang verified research. Makikita ito sa catalog.');
    await onPublished();await reload();
   }else if(r.request_id){
    setBusy(false);
    void advance(r.request_id);
   }
  }catch(e){
   if(alive.current)setNotice(e instanceof Error?e.message:'Failed to save research request');
  }finally{if(alive.current&&!running.current)setBusy(false);}
 };
 return <View style={styles.card}>
  <View style={styles.row}>
   <MaterialCommunityIcons name="book-search" color={green} size={25}/>
   <View style={styles.expand}>
    <Text style={styles.title}>SALIKSIK Research Lab</Text>
    <Text style={styles.sub}>Tuklasin · Suriin · Unawain</Text>
   </View>
  </View>
  <Text style={styles.sub}>Magtanong, pumili ng canonical Bible passage, at awtomatikong buuin ang verifiable research. Walang Admin upload o approval.</Text>
  <TextInput multiline accessibilityLabel="Research question" style={styles.essay}
   value={question} onChangeText={setQuestion} maxLength={180}
   placeholder="Hal. Ano ang kahulugan ng paglalarawan sa Salita sa Juan 1:1–14?"/>
  <Text style={styles.caption}>Canonical Bible passage · KJV reference</Text>
  <TextInput accessibilityLabel="Bible passage" style={styles.input} value={reference}
   onChangeText={setReference} maxLength={90} placeholder="Juan 1:1-14"/>
  <Text style={styles.caption}>Research methodology</Text>
  <View style={styles.chips}>{methods.map(x=><Pressable key={x.id}
    accessibilityRole="radio" accessibilityState={{checked:method===x.id}}
    onPress={()=>setMethod(x.id)}
    style={[styles.chip,method===x.id&&styles.selected]}>
    <Text style={[styles.chipText,method===x.id&&styles.white]}>{x.title}</Text>
   </Pressable>)}</View>
  <Pressable accessibilityRole="button" disabled={busy||question.trim().length<12}
   onPress={()=>void submit()} style={[styles.button,(busy||question.trim().length<12)&&styles.disabled]}>
   {busy?<ActivityIndicator color="#fff" size="small"/>:<MaterialCommunityIcons name="auto-fix" color="#fff" size={20}/>}
   <Text style={styles.buttonText}>{busy?'VERIFYING RESEARCH':'AUTOMATIC RESEARCH'}</Text>
  </Pressable>
  {!!notice&&<Text style={styles.notice}>{notice}</Text>}
  {jobs.map(j=><View key={j.request_id} style={styles.job}>
   <View style={styles.row}>
    <Text style={styles.jobTitle}>{j.question??j.scripture_anchor}</Text>
    <Text style={styles.state}>{j.status.toUpperCase()}</Text>
   </View>
   <Text style={styles.sub}>{j.scripture_anchor} · {j.progress??0}/8 investigations</Text>
   {(j.status==='queued'||j.status==='processing')&&!busy&&<Pressable
     onPress={()=>j.request_id&&void advance(j.request_id)} accessibilityRole="button"
     style={styles.resume}><Text style={styles.resumeText}>RESUME AUTOMATIC VERIFICATION</Text></Pressable>}
  </View>)}
  <Text style={styles.footer}>Ang AI ay gumagawa ng draft, ngunit source checks at independent validation ang batayan ng publication. Walang Points para sa hindi verified na gawa.</Text>
 </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:'#fff',borderColor:'#D9E8DE',borderWidth:1,borderRadius:14,padding:13,gap:10},
 row:{flexDirection:'row',alignItems:'center',gap:9},expand:{flex:1},
 title:{color:'#153E29',fontSize:17,fontWeight:'800'},
 sub:{color:'#526F60',fontSize:12,lineHeight:17},caption:{color:green,fontSize:12,fontWeight:'700'},
 essay:{minHeight:74,padding:11,borderColor:'#C6DDCD',borderWidth:1,borderRadius:9,
  color:'#254634',backgroundColor:'#F9FCFA',textAlignVertical:'top',fontSize:13},
 input:{padding:11,borderColor:'#C6DDCD',borderWidth:1,borderRadius:9,color:'#254634',fontSize:13},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
 chip:{paddingVertical:7,paddingHorizontal:10,borderWidth:1,borderColor:'#BFD8C9',borderRadius:8},
 selected:{backgroundColor:green,borderColor:green},chipText:{fontSize:11,color:green,fontWeight:'700'},white:{color:'#fff'},
 button:{flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:green,
  borderRadius:10,padding:12,gap:8},disabled:{opacity:.5},
 buttonText:{color:'#fff',fontWeight:'800',fontSize:12},
 notice:{fontSize:12,color:'#17633F',lineHeight:18},
 job:{borderTopWidth:1,borderTopColor:'#E7EEE9',paddingTop:9,gap:5},
 jobTitle:{color:'#1A4430',fontSize:12,fontWeight:'700',flex:1},
 state:{fontSize:10,fontWeight:'800',color:green},
 resume:{padding:9,borderWidth:1,borderRadius:9,borderColor:green},
 resumeText:{textAlign:'center',fontSize:11,fontWeight:'800',color:green},
 footer:{fontSize:10,color:'#67776D',lineHeight:15},
});
