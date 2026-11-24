import React,{useRef,useState,useEffect} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import {ARENA_STONES,type ArenaStoneId} from '@/lib/buklodArenaStoneCatalog';
import {startArenaDiscovery,finishArenaDiscovery,type DiscoveryTrial} from '@/lib/buklodArenaStones';
export default function ArenaDiscoveryTrial({uid,hero,onSettled}:{uid:string;hero:ArenaStoneId;onSettled:()=>void}){
 const [trial,setTrial]=useState<DiscoveryTrial|null>(null),[answers,setAnswers]=useState(['','','']),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function start(){
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  try{const d=await startArenaDiscovery(uid,hero);if(!alive.current)return;setTrial(d);setAnswers(['','','']);if(!d.enabled)setNotice('Discovery is not enabled.');}
  catch{if(alive.current)setNotice('Could not load trial. Retry to resume the same pending trial.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function finish(){
  if(lock.current||!trial?.id||answers.some(a=>!/^\d{1,3}$/.test(a)))return;
  lock.current=true;setBusy(true);setNotice('');
  try{const d=await finishArenaDiscovery(uid,trial.id,answers.map(Number));if(!alive.current)return;setTrial(d);onSettled();}
  catch{if(alive.current)setNotice('Result not confirmed. Retry the same trial; no duplicate reward.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const active=ARENA_STONES.find(x=>x.heroId===(trial?.status==='pending'?trial.hero_id:hero));
 const button=(label:string,act:()=>void,disabled=false)=><Pressable accessibilityRole="button" onPress={act} disabled={busy||disabled} style={[s.button,(busy||disabled)&&{opacity:.45}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.panel}>
  <Text style={s.title}>Kingdom discovery trial · {active?.kingdomLocation}</Text>
  <Text style={s.copy}>Free server-scored challenge. Three attempts per day, 20% chance after three correct answers, maximum one discovery stone per Manila day across repeatable sources. No BP or payment required.</Text>
  {trial?.status==='pending'?<>
   <Text style={s.copy}>Find {active?.stone}: solve the three supply puzzles.</Text>
   {trial.questions?.map((q,i)=><View key={i} style={s.row}><Text style={s.copy}>{i+1}. {q.a} groups of {q.b} plus {q.c} reserve supplies = ?</Text><TextInput accessibilityLabel={'Answer '+(i+1)} keyboardType="number-pad" maxLength={3} editable={!busy} value={answers[i]} onChangeText={a=>setAnswers(old=>old.map((v,j)=>i===j?a:v))} style={s.input}/></View>)}
   {button('Verify trial',()=>void finish(),answers.some(a=>!/^\d{1,3}$/.test(a)))}
  </>:<>
   {trial?.status==='verified'?<Text style={s.copy}>{trial.outcome==='awarded'?'Sacred Stone received! Inventory updated by server.':trial.outcome==='no_drop'?'Trial verified. No rare stone this time.':'Trial verified. Daily discovery limit reached.'}</Text>:null}
   {trial?.status==='failed'?<Text style={s.copy}>Not all answers correct. Try again if attempts remain.</Text>:null}
   {trial?.status==='expired'?<Text style={s.copy}>Trial expired.</Text>:null}
   {trial?.status==='daily_cap'||trial?.status==='attempt_cap'?<Text style={s.copy}>Daily limit reached. Return tomorrow (Manila time).</Text>:null}
   {button('Start / resume free trial',()=>void start(),trial?.status==='daily_cap'||trial?.status==='attempt_cap')}
  </>}
  {notice?<Text accessibilityRole="alert" style={s.copy}>{notice}</Text>:null}
 </View>;
}
const s=StyleSheet.create({panel:{backgroundColor:'#102e42',padding:10,borderRadius:9,gap:7},title:{color:'#efcd86',fontWeight:'800',fontSize:14},copy:{color:'#deebeb',fontSize:12},row:{gap:4},input:{borderColor:'#a6c1bb',borderWidth:1,borderRadius:6,padding:7,color:'#fff'},button:{padding:10,borderRadius:7,backgroundColor:'#efcd86',alignItems:'center'},buttonText:{fontWeight:'800',color:'#17333d'}});
