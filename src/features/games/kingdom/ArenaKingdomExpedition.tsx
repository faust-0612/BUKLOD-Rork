import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet} from 'react-native';
import * as Crypto from 'expo-crypto';
import {ARENA_STONES,type ArenaStoneId} from '@/lib/buklodArenaStoneCatalog';
import {startArenaExpedition,stepArenaExpedition,type Expedition,type ExpeditionAction} from '@/lib/buklodArenaStones';
const STAGES=['Rare discovery','Monster encounter','Treasure lock','Village supplies','Quest completion'];
type Pending={id:string;version:number;action:ExpeditionAction;answer:number|null};
export default function ArenaKingdomExpedition({uid,hero,onSettled}:{uid:string;hero:ArenaStoneId;onSettled:()=>void}){
 const [route,setRoute]=useState<Expedition|null>(null),[answer,setAnswer]=useState(''),[pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[clock,setClock]=useState(Date.now()),[cooldownUntil,setCooldownUntil]=useState(0);
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!route||route.state!=='active')return;const id=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(id);},[route?.state,route?.id]);
 function accept(d:Expedition|null){
  const now=Date.now();setClock(now);setCooldownUntil(d?now+Math.max(0,Date.parse(d.next_action_at)-Date.parse(d.server_now)):0);setRoute(d);
 }
 async function start(){
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  try{const d=await startArenaExpedition(uid,hero);if(!alive.current)return;accept(d);setPending(null);setAnswer('');onSettled();}
  catch{if(alive.current)setNotice('Could not load expedition. Resume the same route when online.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function step(req:Pending){
  if(!route||lock.current)return;lock.current=true;setBusy(true);setPending(req);setNotice('');
  try{const d=await stepArenaExpedition(uid,route.id,req.version,req.action,req.answer,req.id);if(!alive.current)return;const newReward=d.results.slice(route.results.length).some(x=>x.outcome==='awarded');accept(d);setPending(null);setAnswer('');if(newReward)onSettled();}
  catch{if(alive.current)setNotice('Turn not confirmed. Retry the same turn or resume the route.');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const wait=route?Math.max(0,Math.ceil((cooldownUntil-clock)/1000)):0;
 const action=(a:ExpeditionAction,n:number|null=null)=>{if(!route||pending||wait>0||busy)return;void step({id:Crypto.randomUUID(),version:route.version,action:a,answer:n});};
 const button=(label:string,run:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled} onPress={run} style={[s.button,(busy||disabled)&&{opacity:.45}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const active=ARENA_STONES.find(g=>g.heroId===(route?.hero_id??hero)),q=route?.question;
 return <View style={s.panel}>
 <Text style={s.title}>Kingdom expedition · {active?.kingdomLocation}</Text>
 <Text style={s.copy}>Free daily turn-based adventure. Server verifies every objective; rare rewards share the daily discovery cap. No offline inventory credit.</Text>
 {button(route?'Resume / refresh route':'Enter expedition',()=>void start())}
 {route?<><Text style={s.copy}>{route.state.toUpperCase()} · Health {route.health}/5 · Stage {Math.min(route.stage+1,5)}/5</Text>
 {route.state==='active'?<><Text style={s.title}>{STAGES[route.stage]}</Text>
 {q?<><Text style={s.copy}>{route.stage===0?`Search three caches: ${q.a} + ${q.b} + ${q.c}`:route.stage===2?`Unlock treasure: ${q.a} × ${q.b} + ${q.c}`:`Village supplies: ${q.a} × ${q.b} − ${q.c}`}</Text>
 <TextInput accessibilityLabel="Objective answer" value={answer} onChangeText={setAnswer} keyboardType="number-pad" maxLength={3} editable={!busy&&!pending} style={s.input}/>
 {button('Solve objective',()=>action('solve',Number(answer)),!!pending||wait>0||!/^\d{1,3}$/.test(answer))}
 </>:null}
 {route.stage===1?<><Text style={s.copy}>Monster HP {route.monster_hp}/3 · {route.monster_intent==='heavy'?'Heavy attack incoming — guard!':'Recovering — strike!'}</Text><View style={s.row}>{button('Strike',()=>action('strike'),!!pending||wait>0)}{button('Guard',()=>action('guard'),!!pending||wait>0)}</View></>:null}
 {route.stage===4?button('Complete quest',()=>action('finish'),!!pending||wait>0):null}
 {wait>0?<Text style={s.copy}>Next turn in {wait}s</Text>:null}
 </>:<Text style={s.copy}>Daily expedition concluded. Return on the next Manila day.</Text>}
 {route.results.map((x,i)=><Text key={i} style={s.copy}>{x.source.replace(/_/g,' ')}: {x.outcome==='awarded'?'Sacred Stone received':x.outcome.replace(/_/g,' ')}</Text>)}
 {pending?button('Retry same turn',()=>void step(pending)):null}
 </>:null}{notice?<Text accessibilityRole="alert" style={s.copy}>{notice}</Text>:null}
 </View>;
}
const s=StyleSheet.create({panel:{backgroundColor:'#102e42',padding:10,borderRadius:9,gap:7},title:{color:'#efcd86',fontWeight:'800',fontSize:14},copy:{color:'#deebeb',fontSize:12},input:{borderColor:'#a6c1bb',borderWidth:1,borderRadius:6,padding:7,color:'#fff'},row:{flexDirection:'row',gap:8},button:{padding:10,borderRadius:7,backgroundColor:'#efcd86',alignItems:'center'},buttonText:{fontWeight:'800',color:'#17333d'}});
