import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type TeamKey='care'|'transport'|'community';
type Request={id:string;district:string;districtTl:string;need:TeamKey;urgency:1|2|3;distance:1|2|3;title:string;titleTl:string};
const GAME_ID='van-living-city-dispatch';
const REQUESTS:Request[]=[
{id:'r1',district:'Riverside',districtTl:'Tabing-Ilog',need:'care',urgency:3,distance:2,title:'Elder needs urgent assistance',titleTl:'Kailangan ng agarang tulong ng isang nakatatanda'},
{id:'r2',district:'Market Row',districtTl:'Hanay ng Pamilihan',need:'transport',urgency:2,distance:1,title:'Supply delivery is blocked',titleTl:'Nahaharang ang delivery ng supplies'},
{id:'r3',district:'North Homes',districtTl:'Hilagang Kabahayan',need:'community',urgency:2,distance:2,title:'Family support visit requested',titleTl:'Humihingi ng family support visit'},
{id:'r4',district:'School Quarter',districtTl:'Distrito ng Paaralan',need:'transport',urgency:3,distance:3,title:'Students stranded after road closure',titleTl:'Na-stranded ang mga estudyante dahil sa pagsara ng kalsada'},
{id:'r5',district:'West Block',districtTl:'Kanlurang Block',need:'care',urgency:1,distance:1,title:'Medication follow-up visit',titleTl:'Follow-up visit para sa gamot'},
{id:'r6',district:'Central Plaza',districtTl:'Gitnang Plaza',need:'community',urgency:3,distance:1,title:'Crowd conflict needs mediation',titleTl:'Kailangan ng mediation sa alitan ng mga tao'},
];
const TEAM_LABEL:Record<TeamKey,string>={care:'Care Team',transport:'Mobility Team',community:'Community Team'};
const TEAM_LABEL_TL:Record<TeamKey,string>={care:'Care Team',transport:'Mobility Team',community:'Community Team'};
const starsForScore=(score:number):1|2|3=>score>=1550?3:score>=1150?2:1;

const localizeMessage=(message:string,language:'en'|'tl')=>{
 if(language==='en')return message;
 const exact:Record<string,string>={
  'City requests arrive with different urgency, distance and service needs. Dispatch the right team before capacity collapses.':'Dumarating ang city requests na iba-iba ang urgency, distance, at service needs. I-dispatch ang tamang team bago maubos ang capacity.',
  'Wrong specialization. The request was handled poorly and city trust dropped.':'Maling specialization. Hindi maayos ang paghawak sa request kaya bumaba ang city trust.',
  'Dispatch capacity or public trust collapsed before the city stabilized.':'Naubos ang dispatch capacity o bumagsak ang public trust bago maging matatag ang lungsod.',
 };
 if(exact[message])return exact[message];
 const capacityMatch=message.match(/^(.+) needs (\d+) capacity for this distance but has only (\d+)\.$/);
 if(capacityMatch)return `${capacityMatch[1]} ay nangangailangan ng ${capacityMatch[2]} capacity para sa distance na ito pero ${capacityMatch[3]} lamang ang mayroon.`;
 const resolvedMatch=message.match(/^(.+) resolved (.+)\. Trust improved\.$/);
 if(resolvedMatch){
  const req=REQUESTS.find(r=>r.district===resolvedMatch[2]);
  return `${resolvedMatch[1]} ang tumugon sa ${req?.districtTl??resolvedMatch[2]}. Tumaas ang trust.`;
 }
 const stabilizedMatch=message.match(/^City shift stabilized with (\d+) trust and (\d+) reserve team capacity\.$/);
 if(stabilizedMatch)return `Naging matatag ang city shift na may ${stabilizedMatch[1]} trust at ${stabilizedMatch[2]} reserve team capacity.`;
 return message;
};

type Props={onFinish?:(result:BuklodGameResult)=>void};
export function LivingCityDispatchGameV1({onFinish}:Props){
 const {language,t}=useBuklodGameLanguage();
 const [index,setIndex]=useState(0),[trust,setTrust]=useState(60),[energy,setEnergy]=useState<Record<TeamKey,number>>({care:3,transport:3,community:3}),[score,setScore]=useState(0),[finished,setFinished]=useState(false),[message,setMessage]=useState('City requests arrive with different urgency, distance and service needs. Dispatch the right team before capacity collapses.');
 const request=REQUESTS[index];
 const available=useMemo(()=>Object.values(energy).reduce((a,b)=>a+b,0),[energy]);
 const dispatch=useCallback((team:TeamKey)=>{
  if(finished||!request)return;
  const cost=request.distance;
  if(energy[team]<cost){setMessage(`${TEAM_LABEL[team]} needs ${cost} capacity for this distance but has only ${energy[team]}.`);void playBuklodGameFeedback('impact');return;}
  const match=team===request.need;const nextEnergy={...energy,[team]:energy[team]-cost};
  const urgencyPoints=request.urgency*110;const fitBonus=match?180:-90;const distancePenalty=request.distance*25;
  const delta=Math.max(0,urgencyPoints+fitBonus-distancePenalty);const trustDelta=match?6+request.urgency*2:-8-request.urgency*2;
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
 },[energy,finished,index,onFinish,request,score,trust]);
 const reset=useCallback(()=>{setIndex(0);setTrust(60);setEnergy({care:3,transport:3,community:3});setScore(0);setFinished(false);setMessage('City requests arrive with different urgency, distance and service needs. Dispatch the right team before capacity collapses.');},[]);
 return <View style={s.shell}><View style={s.header}><View><Text style={s.eyebrow}>{t('VAN • THE LIVING CITY','VAN • BUHAY NA LUNGSOD')}</Text><Text style={s.title}>{t('City Dispatch','Dispatch ng Lungsod')}</Text></View><View style={s.trustBox}><Text style={s.trust}>{trust}</Text><Text style={s.trustLabel}>{t('CITY TRUST','TIWALA NG LUNGSOD')}</Text></View></View><Text style={s.message}>{localizeMessage(message,language)}</Text><View style={s.teamRow}>{(Object.keys(TEAM_LABEL) as TeamKey[]).map(k=><View key={k} style={s.team}><Text style={s.teamName}>{language==='tl'?TEAM_LABEL_TL[k]:TEAM_LABEL[k]}</Text><Text style={s.teamEnergy}>{energy[k]} {t('capacity','capacity')}</Text></View>)}</View>{!finished&&request?<View style={s.requestCard}><View style={s.requestTop}><Text style={s.district}>{language==='tl'?request.districtTl:request.district}</Text><Text style={s.urgency}>{'●'.repeat(request.urgency)} {t('URGENCY','URGENCY')}</Text></View><Text style={s.requestTitle}>{language==='tl'?request.titleTl:request.title}</Text><Text style={s.meta}>{t('Distance','Distansya')} {request.distance} • {t('Ideal response','Tamang tugon')}: {language==='tl'?TEAM_LABEL_TL[request.need]:TEAM_LABEL[request.need]}</Text><Text style={s.counter}>{t('REQUEST','REQUEST')} {index+1}/{REQUESTS.length} • {t('TOTAL CAPACITY','KABUUANG CAPACITY')} {available}</Text><View style={s.buttons}>{(Object.keys(TEAM_LABEL) as TeamKey[]).map(k=><Pressable key={k} style={s.button} onPress={()=>dispatch(k)}><Text style={s.buttonTitle}>{language==='tl'?TEAM_LABEL_TL[k]:TEAM_LABEL[k]}</Text><Text style={s.buttonSub}>{t('Deploy','I-deploy')}</Text></Pressable>)}</View></View>:<View style={s.result}><Text style={s.resultKicker}>{t('CITY SHIFT COMPLETE','TAPOS ANG CITY SHIFT')}</Text><Text style={s.bigScore}>{score}</Text><Text style={s.resultCopy}>{localizeMessage(message,language)}</Text><Text style={s.resultCopy}>{t('This dispatch result is recorded in Van’s Kingdom station progress.','Naitala ang dispatch result sa progreso ng Kingdom station ni Van.')}</Text><Pressable style={s.primary} onPress={reset}><Text style={s.primaryText}>{t('NEW CITY SHIFT','BAGONG CITY SHIFT')}</Text></Pressable></View>}</View>;
}
const s=StyleSheet.create({shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#91c4d5',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#f4fbff',fontSize:32,fontWeight:'900',marginTop:3},trustBox:{alignItems:'flex-end'},trust:{color:'#a9e0ee',fontSize:29,fontWeight:'900'},trustLabel:{color:'#829eaa',fontSize:9,fontWeight:'900'},message:{color:'#d7e7ec',lineHeight:21},teamRow:{flexDirection:'row',flexWrap:'wrap',gap:8},team:{flexGrow:1,minWidth:160,backgroundColor:'rgba(255,255,255,.05)',padding:11,borderRadius:12},teamName:{color:'#fff',fontWeight:'900'},teamEnergy:{color:'#9fb5be',marginTop:3,fontSize:12},requestCard:{backgroundColor:'rgba(10,27,38,.84)',borderRadius:22,padding:18,borderWidth:1,borderColor:'rgba(90,171,198,.25)',gap:11},requestTop:{flexDirection:'row',justifyContent:'space-between',gap:10},district:{color:'#92cce0',fontWeight:'900'},urgency:{color:'#e79a7a',fontSize:10,fontWeight:'900'},requestTitle:{color:'#fff',fontSize:25,fontWeight:'900'},meta:{color:'#bfd0d6'},counter:{color:'#7899a5',fontSize:10,fontWeight:'900'},buttons:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:4},button:{flexGrow:1,flexBasis:190,minHeight:88,borderRadius:14,padding:13,backgroundColor:'rgba(255,255,255,.055)',borderWidth:1,borderColor:'rgba(255,255,255,.09)'},buttonTitle:{color:'#dff6ff',fontWeight:'900'},buttonSub:{color:'#91aeb8',marginTop:6},result:{alignItems:'center',backgroundColor:'rgba(10,27,38,.84)',borderRadius:22,padding:30,gap:10},resultKicker:{color:'#8db8c7',fontSize:10,fontWeight:'900',letterSpacing:1},bigScore:{color:'#b8ecf8',fontSize:58,fontWeight:'900'},resultCopy:{color:'#d7e6eb',textAlign:'center',lineHeight:21,maxWidth:620},primary:{backgroundColor:'#8fd1e4',borderRadius:14,paddingHorizontal:20,paddingVertical:14,marginTop:8},primaryText:{color:'#10232b',fontWeight:'900'}});
