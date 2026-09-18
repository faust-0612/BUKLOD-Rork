import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { BuklodGameText as Text } from '../runtime/BuklodGameLanguage';
import { useBuklodKingdomLevel } from '../runtime/BuklodGameLevelContext';
import type { BuklodGameResult } from '../types';

type TeamKey='care'|'transport'|'community';
type Request={id:string;district:string;need:TeamKey;urgency:1|2|3;distance:1|2|3;title:string};
const GAME_ID='van-living-city-dispatch';
const REQUESTS:Request[]=[
{id:'r1',district:'Riverside',need:'care',urgency:3,distance:2,title:'Elder needs urgent assistance'},
{id:'r2',district:'Market Row',need:'transport',urgency:2,distance:1,title:'Supply delivery is blocked'},
{id:'r3',district:'North Homes',need:'community',urgency:2,distance:2,title:'Family support visit requested'},
{id:'r4',district:'School Quarter',need:'transport',urgency:3,distance:3,title:'Students stranded after road closure'},
{id:'r5',district:'West Block',need:'care',urgency:1,distance:1,title:'Medication follow-up visit'},
{id:'r6',district:'Central Plaza',need:'community',urgency:3,distance:1,title:'Crowd conflict needs mediation'},
];
const TEAM_LABEL:Record<TeamKey,string>={care:'Care Team',transport:'Mobility Team',community:'Community Team'};
const starsForScore=(score:number):1|2|3=>score>=1550?3:score>=1150?2:1;

type Props={onFinish?:(result:BuklodGameResult)=>void};
export function LivingCityDispatchGameV1({onFinish}:Props){
 const { difficulty, resourceMultiplier } = useBuklodKingdomLevel();
 const startCapacity=Math.max(2,Math.round(3*resourceMultiplier));
 const startTrust=Math.max(48,Math.round(60-(difficulty-1)*10));
 const [index,setIndex]=useState(0),[trust,setTrust]=useState(startTrust),[energy,setEnergy]=useState<Record<TeamKey,number>>({care:startCapacity,transport:startCapacity,community:startCapacity}),[score,setScore]=useState(0),[finished,setFinished]=useState(false),[message,setMessage]=useState('City requests arrive with different urgency, distance and service needs. Dispatch the right team before capacity collapses.');
 const request=REQUESTS[index];
 const available=useMemo(()=>Object.values(energy).reduce((a,b)=>a+b,0),[energy]);
 const dispatch=useCallback((team:TeamKey)=>{
  if(finished||!request)return;
  const cost=request.distance;
  if(energy[team]<cost){setMessage(`${TEAM_LABEL[team]} needs ${cost} capacity for this distance but has only ${energy[team]}.`);void playBuklodGameFeedback('impact');return;}
  const match=team===request.need;const nextEnergy={...energy,[team]:energy[team]-cost};
  const urgencyPoints=request.urgency*110;const fitBonus=match?180:-90;const distancePenalty=request.distance*25;
  const delta=Math.max(0,urgencyPoints+fitBonus-distancePenalty);const trustDelta=match?Math.max(3,Math.round((6+request.urgency*2)/difficulty)):Math.round((-8-request.urgency*2)*difficulty);
  const nextTrust=Math.max(0,Math.min(100,trust+trustDelta));const nextScore=score+delta;
  setEnergy(nextEnergy);setTrust(nextTrust);setScore(nextScore);
  setMessage(match?`${TEAM_LABEL[team]} resolved ${request.district}. Trust improved.`:`Wrong specialization. The request was handled poorly and city trust dropped.`);
  void playBuklodGameFeedback(match?'collect':'impact');
  const nextIndex=index+1;
  if(nextIndex>=REQUESTS.length||Object.values(nextEnergy).every(v=>v<=0)){
    const finalScore=Math.round(nextScore+nextTrust*6+Object.values(nextEnergy).reduce((a,b)=>a+b,0)*55);const failed=nextTrust<38||nextIndex<4;const stars=starsForScore(finalScore);
    setScore(finalScore);setFinished(true);setMessage(failed?'Dispatch capacity or public trust collapsed before the city stabilized.':`City shift stabilized with ${nextTrust} trust and ${Object.values(nextEnergy).reduce((a,b)=>a+b,0)} reserve team capacity.`);
    void playBuklodGameFeedback(failed?'failure':'success');
    onFinish?.({gameId:GAME_ID,status:failed?'lost':'won',score:finalScore,stars:failed?0:stars,reward:{xp:failed?25:130+stars*45,kingdomXp:failed?5:60+stars*20,collectibleKey:!failed&&stars===3?'van-city-service-medal':undefined}});
  }else setIndex(nextIndex);
 },[difficulty,energy,finished,index,onFinish,request,score,trust]);
 const reset=useCallback(()=>{setIndex(0);setTrust(startTrust);setEnergy({care:startCapacity,transport:startCapacity,community:startCapacity});setScore(0);setFinished(false);setMessage('City requests arrive with different urgency, distance and service needs. Dispatch the right team before capacity collapses.');},[startCapacity,startTrust]);
 return <View style={s.shell}><View style={s.header}><View><Text style={s.eyebrow}>VAN • THE LIVING CITY</Text><Text style={s.title}>City Dispatch</Text></View><View style={s.trustBox}><Text style={s.trust}>{trust}</Text><Text style={s.trustLabel}>CITY TRUST</Text></View></View><Text style={s.message}>{message}</Text><View style={s.teamRow}>{(Object.keys(TEAM_LABEL) as TeamKey[]).map(k=><View key={k} style={s.team}><Text style={s.teamName}>{TEAM_LABEL[k]}</Text><Text style={s.teamEnergy}>{energy[k]} capacity</Text></View>)}</View>{!finished&&request?<View style={s.requestCard}><View style={s.requestTop}><Text style={s.district}>{request.district}</Text><Text style={s.urgency}>{'●'.repeat(request.urgency)} URGENCY</Text></View><Text style={s.requestTitle}>{request.title}</Text><Text style={s.meta}>Distance {request.distance} • Ideal response: {TEAM_LABEL[request.need]}</Text><Text style={s.counter}>REQUEST {index+1}/{REQUESTS.length} • TOTAL CAPACITY {available}</Text><View style={s.buttons}>{(Object.keys(TEAM_LABEL) as TeamKey[]).map(k=><Pressable key={k} style={s.button} onPress={()=>dispatch(k)}><Text style={s.buttonTitle}>{TEAM_LABEL[k]}</Text><Text style={s.buttonSub}>Deploy</Text></Pressable>)}</View></View>:<View style={s.result}><Text style={s.resultKicker}>CITY SHIFT COMPLETE</Text><Text style={s.bigScore}>{score}</Text><Text style={s.resultCopy}>{message}</Text><Pressable style={s.primary} onPress={reset}><Text style={s.primaryText}>NEW CITY SHIFT</Text></Pressable></View>}</View>;
}
const s=StyleSheet.create({shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#91c4d5',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#f4fbff',fontSize:32,fontWeight:'900',marginTop:3},trustBox:{alignItems:'flex-end'},trust:{color:'#a9e0ee',fontSize:29,fontWeight:'900'},trustLabel:{color:'#829eaa',fontSize:9,fontWeight:'900'},message:{color:'#d7e7ec',lineHeight:21},teamRow:{flexDirection:'row',flexWrap:'wrap',gap:8},team:{flexGrow:1,minWidth:160,backgroundColor:'rgba(255,255,255,.05)',padding:11,borderRadius:12},teamName:{color:'#fff',fontWeight:'900'},teamEnergy:{color:'#9fb5be',marginTop:3,fontSize:12},requestCard:{backgroundColor:'rgba(10,27,38,.84)',borderRadius:22,borderWidth:1,borderColor:'rgba(90,171,198,.25)',padding:18,gap:11},requestTop:{flexDirection:'row',justifyContent:'space-between',gap:10},district:{color:'#92cce0',fontWeight:'900'},urgency:{color:'#e79a7a',fontSize:10,fontWeight:'900'},requestTitle:{color:'#fff',fontSize:25,fontWeight:'900'},meta:{color:'#bfd0d6'},counter:{color:'#7899a5',fontSize:10,fontWeight:'900'},buttons:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:4},button:{flexGrow:1,flexBasis:190,minHeight:88,borderRadius:14,padding:13,backgroundColor:'rgba(255,255,255,.055)',borderWidth:1,borderColor:'rgba(255,255,255,.09)'},buttonTitle:{color:'#dff6ff',fontWeight:'900'},buttonSub:{color:'#91aeb8',marginTop:6},result:{alignItems:'center',backgroundColor:'rgba(10,27,38,.84)',borderRadius:22,padding:30,gap:10},resultKicker:{color:'#8db8c7',fontSize:10,fontWeight:'900',letterSpacing:1},bigScore:{color:'#b8ecf8',fontSize:58,fontWeight:'900'},resultCopy:{color:'#d7e6eb',textAlign:'center',lineHeight:21,maxWidth:620},primary:{backgroundColor:'#8fd1e4',borderRadius:14,paddingHorizontal:20,paddingVertical:14,marginTop:8},primaryText:{color:'#10232b',fontWeight:'900'}});