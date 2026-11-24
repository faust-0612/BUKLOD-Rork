import React,{useEffect,useRef,useState} from 'react';
import {View,Text,Pressable,StyleSheet,TextInput} from 'react-native';
import * as Crypto from 'expo-crypto';
import {ARENA_STONES,stoneRecipe,type ArenaStoneId} from '@/lib/buklodArenaStoneCatalog';
import {getArenaStones,actArenaStones,type StoneSnapshot,type StoneAction} from '@/lib/buklodArenaStones';
type Pending={action:StoneAction;args:Record<string,unknown>;id:string};
export default function ArenaStoneTreasury({uid}:{uid:string|null}){
 const [state,setState]=useState<StoneSnapshot|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<ArenaStoneId>('phan'),[input,setInput]=useState<ArenaStoneId[]>([]),[peer,setPeer]=useState('');
 const [pending,setPending]=useState<Pending|null>(null);
 const scope=useRef({uid,generation:0}),lock=useRef(false);
 if(scope.current.uid!==uid){scope.current={uid,generation:scope.current.generation+1};lock.current=false;}
 const generation=scope.current.generation;
 useEffect(()=>{setState(null);setPending(null);setBusy(false);setNotice('');setInput([]);setPeer('');if(uid)void reload();},[uid]);
 async function reload(){
  if(!uid||lock.current)return;lock.current=true;setBusy(true);
  try{const s=await getArenaStones(uid);if(scope.current.generation===generation)setState(s);}
  catch{if(scope.current.generation===generation){setState(null);setNotice('Arena stone service unavailable. No local stones credited.');}}
  finally{if(scope.current.generation===generation){lock.current=false;setBusy(false);}}
 }
 async function send(req:Pending){
  if(!uid||lock.current)return;lock.current=true;setBusy(true);setPending(req);setNotice('');
  try{
   const s=await actArenaStones(uid,req.action,req.args,req.id);
   if(scope.current.generation!==generation)return;
   if(!s)throw new Error('Stone service unavailable');
   setState(s);setPending(null);setInput([]);setNotice('Confirmed by server.');
  }catch{if(scope.current.generation===generation)setNotice('Not confirmed. Retry the same request or refresh; no local debit was applied.');}
  finally{if(scope.current.generation===generation){lock.current=false;setBusy(false);}}
 }
 const action=(a:StoneAction,args:Record<string,unknown>)=>{if(!pending)void send({action:a,args,id:Crypto.randomUUID()});};
 const wallet=state?.owner===uid?state:null;
 const row=(id:string)=>wallet?.stones.find(r=>r.hero_id===id);
 const count=(id:string)=>row(id)?.balance??0;
 const names=(ids:readonly string[])=>ids.map(id=>ARENA_STONES.find(s=>s.heroId===id)?.stone??id).join(' + ');
 const recipe=stoneRecipe(selected);
 const canCombine=recipe.length===2&&recipe.every(id=>count(id)>0);
 const canUniversal=input.length===3&&input.every(id=>id!==selected&&count(id)>=input.filter(x=>x===id).length);
 const canPeer=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(peer.trim())&&peer.trim()!==uid;
 const btn=(label:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy||!!pending} onPress={onPress} style={[s.button,(disabled||busy||!!pending)&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 if(!uid)return null;
 return <View style={s.shell}>
  <Text style={s.title}>ARENA SACRED STONES</Text>
  <Text style={s.copy}>Kingdom is an acquisition source. Stones are used only for Arena heroes, bans and counters. No Shard or BP cash conversion.</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void reload()}><Text style={s.link}>Refresh verified inventory</Text></Pressable>
  {!wallet?<Text style={s.copy}>{busy?'Checking server…':'Arena inventory is not enabled yet.'}</Text>:<>
   <Text style={s.copy}>Spendable BP: {wallet.spendable_bp} • 100 BP per stone</Text>
   {ARENA_STONES.map(g=><Pressable key={g.heroId} accessibilityRole="button" accessibilityState={{selected:selected===g.heroId}} onPress={()=>{setSelected(g.heroId);setInput([]);}} style={[s.row,selected===g.heroId&&s.selected]}>
    <View style={[s.dot,{backgroundColor:g.color}]}/><View style={{flex:1}}><Text style={s.name}>{g.stone} · {g.displayName}</Text><Text style={s.copy}>{g.mission} · {row(g.heroId)?.mastery_count??0}/3 mastery {row(g.heroId)?.quest_awarded?'• quest rewarded':''}</Text></View><Text style={s.name}>{count(g.heroId)}</Text>
   </Pressable>)}
   {btn('Exchange 100 BP',()=>action('exchange',{hero_id:selected}),!wallet.bp_exchange_enabled||wallet.spendable_bp<100)}
   <Text style={s.copy}>{names(recipe)} → {names([selected])}</Text>
   {btn('Combine 2 stones',()=>action('combine',{hero_id:selected,inputs:recipe}),!canCombine)}
   <Text style={s.copy}>Universal conversion: choose 3 unwanted stones</Text>
   <View style={s.chips}>{ARENA_STONES.filter(g=>g.heroId!==selected&&count(g.heroId)>0).map(g=><Pressable key={g.heroId} disabled={input.length>=3||input.filter(x=>x===g.heroId).length>=count(g.heroId)} onPress={()=>setInput(x=>[...x,g.heroId])} style={s.chip}><Text style={s.name}>{g.stone}</Text></Pressable>)}</View>
   <Text style={s.copy}>{names(input)||'No input selected'}</Text>
   {btn('Clear inputs',()=>setInput([]),input.length===0)}
   {btn('Convert 3 stones',()=>action('convert',{hero_id:selected,inputs:input}),!canUniversal)}
   <Text style={s.copy}>Share or trade with another account using its player ID.</Text>
   <TextInput accessibilityLabel="Recipient player ID" value={peer} onChangeText={setPeer} autoCapitalize="none" autoCorrect={false} placeholder="Player ID" placeholderTextColor="#aac1bd" style={s.field}/>
   {btn('Gift selected stone',()=>action('gift',{peer:peer.trim(),hero_id:selected}),!canPeer||count(selected)<1)}
   {btn('Request selected stone',()=>action('request',{peer:peer.trim(),hero_id:selected}),!canPeer)}
   {btn('Offer selected unwanted stone for chosen stone',()=>action('offer',{peer:peer.trim(),inputs:[input[0]],wanted:[selected]}),!canPeer||input.length!==1||count(input[0])<1)}
   {wallet.trades.map(t=><View key={t.id} style={s.row}><View style={{flex:1}}><Text style={s.copy}>{names(t.offered)} ↔ {names(t.wanted)}</Text>{t.recipient===uid?btn('Accept trade',()=>action('accept_trade',{id:t.id})):null}{btn('Cancel trade',()=>action('cancel_trade',{id:t.id}))}</View></View>)}
   {wallet.requests.filter(t=>t.donor===uid).map(t=><View key={t.id} style={s.row}><View style={{flex:1}}><Text style={s.copy}>Requested: {names([t.hero_id])}</Text>{btn('Sponsor / gift',()=>action('accept_request',{id:t.id}),count(t.hero_id)<1)}{btn('Decline',()=>action('decline_request',{id:t.id}))}</View></View>)}
  </>}
  {pending?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>void send(pending)}><Text style={s.link}>Retry same transaction safely</Text></Pressable>:null}
  {!!notice?<Text accessibilityRole="alert" style={s.copy}>{notice}</Text>:null}
 </View>;
}
const s=StyleSheet.create({shell:{backgroundColor:'#183d4c',borderRadius:14,padding:12,gap:9},title:{color:'#efcd86',fontWeight:'900',fontSize:16},copy:{color:'#d7e4e5',fontSize:12},link:{color:'#efcd86',fontWeight:'800',paddingVertical:8},row:{flexDirection:'row',alignItems:'center',gap:8,padding:7,borderRadius:8,backgroundColor:'#102e42'},selected:{borderColor:'#efcd86',borderWidth:1},dot:{height:20,width:20,borderRadius:10},name:{color:'#fff',fontWeight:'700',fontSize:13},button:{backgroundColor:'#efcd86',padding:10,borderRadius:8,alignItems:'center'},buttonText:{color:'#17333d',fontWeight:'800',fontSize:12},disabled:{opacity:.4},chips:{flexDirection:'row',flexWrap:'wrap',gap:5},chip:{backgroundColor:'#294f5e',padding:8,borderRadius:7},field:{borderColor:'#adc7c4',borderWidth:1,borderRadius:8,color:'#fff',padding:10}});
