import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

type State={trust:number;budget:number;time:number;unity:number};
type Choice={label:string;copy:string;delta:Partial<State>;score:number};
type Scenario={title:string;context:string;choices:Choice[]};

const GAME_ID='christian-civic-leadership';
const SCENARIOS:Scenario[]=[
 {title:'Two Groups, One Hall',context:'Two community groups request the same hall schedule and neither wants to move.',choices:[
  {label:'Facilitate a joint schedule',copy:'Meet both groups and split time transparently.',delta:{trust:8,time:-2,unity:10},score:240},
  {label:'Choose the larger group',copy:'Fast decision, but one side feels ignored.',delta:{trust:-5,time:-1,unity:-8},score:90},
  {label:'Delay the issue',copy:'Avoid conflict today, lose credibility tomorrow.',delta:{trust:-8,time:-3,unity:-4},score:50}]},
 {title:'Flooded Street',context:'A damaged drainage line needs urgent repair while the youth learning program also lacks materials.',choices:[
  {label:'Emergency repair first',copy:'Protect access now, then preserve a smaller learning allocation.',delta:{budget:-18,trust:6,unity:3},score:220},
  {label:'Split funds evenly',copy:'Both programs move, neither is fully solved.',delta:{budget:-16,trust:3,unity:2},score:160},
  {label:'Ignore infrastructure',copy:'Protect the learning budget but risk public frustration.',delta:{budget:-9,trust:-7,unity:-2},score:70}]},
 {title:'Rumor in the Plaza',context:'A false rumor spreads about the civic team. People demand an immediate answer.',choices:[
  {label:'Publish verified facts',copy:'Respond with evidence and invite questions.',delta:{trust:10,time:-2,unity:5},score:250},
  {label:'Attack the critics',copy:'Fast and emotional; division grows.',delta:{trust:-9,unity:-10},score:40},
  {label:'Say nothing',copy:'Avoid escalation, but uncertainty remains.',delta:{trust:-4,time:-1},score:100}]},
 {title:'Volunteer Burnout',context:'The same volunteers have carried too many projects and are close to quitting.',choices:[
  {label:'Reduce load and rotate teams',copy:'Slower delivery, stronger long-term capacity.',delta:{time:-2,unity:10,trust:5},score:240},
  {label:'Push through one more month',copy:'Output stays high today, burnout worsens.',delta:{time:1,unity:-8,trust:-2},score:100},
  {label:'Replace them immediately',copy:'Faster than mentoring, damaging to trust.',delta:{unity:-10,trust:-5,budget:-6},score:70}]},
 {title:'Final Community Forum',context:'Residents disagree on what the next major project should be.',choices:[
  {label:'Use needs data + open forum',copy:'Combine evidence with public participation.',delta:{trust:9,time:-3,unity:8,budget:-4},score:280},
  {label:'Leader decides alone',copy:'Fast, but low participation.',delta:{trust:-5,time:1,unity:-6},score:90},
  {label:'Promise every proposal',copy:'Popular now, impossible to fund.',delta:{trust:3,budget:-22,unity:2},score:80}]}
];
const starsForScore=(score:number):1|2|3=>score>=1500?3:score>=1125?2:1;

type Props={onFinish?:(result:BuklodGameResult)=>void};
export function CivicLeadershipGameV1({onFinish}:Props){
 const [index,setIndex]=useState(0),[state,setState]=useState<State>({trust:55,budget:70,time:12,unity:52}),[score,setScore]=useState(0),[finished,setFinished]=useState(false),[message,setMessage]=useState('Leadership is measured by consequences, not just fast answers. Keep trust, resources, time and community unity alive through five civic decisions.');
 const scenario=SCENARIOS[index];
 const choose=useCallback((choice:Choice)=>{
  if(finished||!scenario)return;
  const next:State={trust:Math.max(0,Math.min(100,state.trust+(choice.delta.trust??0))),budget:Math.max(0,state.budget+(choice.delta.budget??0)),time:Math.max(0,state.time+(choice.delta.time??0)),unity:Math.max(0,Math.min(100,state.unity+(choice.delta.unity??0)))};
  const nextScore=score+choice.score;setState(next);setScore(nextScore);setMessage(`${choice.label}: ${choice.copy}`);void playBuklodGameFeedback(choice.score>=200?'collect':'impact');
  const nextIndex=index+1;
  if(nextIndex>=SCENARIOS.length||next.trust<=20||next.unity<=18||next.budget<=0){
   const finalScore=Math.round(nextScore+next.trust*5+next.unity*5+next.budget*4+next.time*18);const failed=next.trust<38||next.unity<35||next.budget<10;const stars=starsForScore(finalScore);setScore(finalScore);setFinished(true);setMessage(failed?'Leadership mandate weakened: trust, unity, or resources fell below a sustainable level.':`Civic term completed with ${Math.round(next.trust)} trust, ${Math.round(next.unity)} unity and ${Math.round(next.budget)} budget reserve.`);void playBuklodGameFeedback(failed?'failure':'success');onFinish?.({gameId:GAME_ID,status:failed?'lost':'won',score:finalScore,stars:failed?0:stars,reward:{xp:failed?25:135+stars*45,kingdomXp:failed?5:62+stars*22,collectibleKey:!failed&&stars===3?'christian-civic-leadership-seal':undefined}});
  }else setIndex(nextIndex);
 },[finished,index,onFinish,scenario,score,state]);
 const reset=useCallback(()=>{setIndex(0);setState({trust:55,budget:70,time:12,unity:52});setScore(0);setFinished(false);setMessage('Leadership is measured by consequences, not just fast answers. Keep trust, resources, time and community unity alive through five civic decisions.');},[]);
 return <View style={s.shell}><View style={s.header}><View><Text style={s.eyebrow}>CHRISTIAN • CIVIC ACADEMY</Text><Text style={s.title}>Leadership Council</Text></View><Text style={s.score}>{score}</Text></View><Text style={s.message}>{message}</Text><View style={s.stats}>{Object.entries(state).map(([k,v])=><View key={k} style={s.stat}><Text style={s.statLabel}>{k.toUpperCase()}</Text><Text style={s.statValue}>{Math.round(v)}</Text></View>)}</View>{!finished&&scenario?<View style={s.card}><Text style={s.kicker}>CASE {index+1}/{SCENARIOS.length}</Text><Text style={s.caseTitle}>{scenario.title}</Text><Text style={s.context}>{scenario.context}</Text><View style={s.choices}>{scenario.choices.map(choice=><Pressable key={choice.label} style={s.choice} onPress={()=>choose(choice)}><Text style={s.choiceTitle}>{choice.label}</Text><Text style={s.choiceCopy}>{choice.copy}</Text></Pressable>)}</View></View>:<View style={s.result}><Text style={s.resultKicker}>TERM COMPLETE</Text><Text style={s.bigScore}>{score}</Text><Text style={s.resultCopy}>{message}</Text><Pressable style={s.primary} onPress={reset}><Text style={s.primaryText}>NEW TERM</Text></Pressable></View>}</View>;
}
const s=StyleSheet.create({shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#b6c8f0',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#f8fbff',fontSize:32,fontWeight:'900',marginTop:3},score:{color:'#ebcf8e',fontSize:28,fontWeight:'900'},message:{color:'#dce4f5',lineHeight:21},stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{flexGrow:1,minWidth:110,backgroundColor:'rgba(255,255,255,.05)',borderRadius:12,padding:10},statLabel:{color:'#9eabc7',fontSize:9,fontWeight:'900'},statValue:{color:'#fff',fontSize:22,fontWeight:'900',marginTop:2},card:{backgroundColor:'rgba(16,27,54,.84)',borderRadius:22,padding:18,borderWidth:1,borderColor:'rgba(116,150,216,.23)',gap:10},kicker:{color:'#aabde9',fontSize:10,fontWeight:'900',letterSpacing:1},caseTitle:{color:'#fff',fontSize:26,fontWeight:'900'},context:{color:'#d1dcf0',lineHeight:21},choices:{gap:9,marginTop:4},choice:{borderRadius:15,padding:14,backgroundColor:'rgba(255,255,255,.05)',borderWidth:1,borderColor:'rgba(255,255,255,.09)'},choiceTitle:{color:'#f4dfaa',fontSize:16,fontWeight:'900'},choiceCopy:{color:'#bfcbe2',lineHeight:19,marginTop:4},result:{alignItems:'center',backgroundColor:'rgba(16,27,54,.84)',borderRadius:22,padding:30,gap:10},resultKicker:{color:'#aebce0',fontSize:10,fontWeight:'900',letterSpacing:1},bigScore:{color:'#f1d99a',fontSize:58,fontWeight:'900'},resultCopy:{color:'#d9e3f3',textAlign:'center',maxWidth:620,lineHeight:21},primary:{backgroundColor:'#c8d5f6',borderRadius:14,paddingHorizontal:20,paddingVertical:14,marginTop:8},primaryText:{color:'#18223a',fontWeight:'900'}});