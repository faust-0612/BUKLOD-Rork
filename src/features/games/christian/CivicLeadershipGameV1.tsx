import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type State={trust:number;budget:number;time:number;unity:number};
type StateKey=keyof State;
type Choice={label:string;labelTl:string;copy:string;copyTl:string;delta:Partial<State>;score:number};
type Scenario={title:string;titleTl:string;context:string;contextTl:string;choices:Choice[]};

const GAME_ID='christian-civic-leadership';
const SCENARIOS:Scenario[]=[
 {title:'Two Groups, One Hall',titleTl:'Dalawang Grupo, Isang Bulwagan',context:'Two community groups request the same hall schedule and neither wants to move.',contextTl:'Dalawang grupo ng komunidad ang humihingi ng parehong oras sa bulwagan at ayaw umatras ng alinman.',choices:[
  {label:'Facilitate a joint schedule',labelTl:'Bumuo ng pinagsamang iskedyul',copy:'Meet both groups and split time transparently.',copyTl:'Harapin ang dalawang grupo at hatiin nang malinaw ang oras.',delta:{trust:8,time:-2,unity:10},score:240},
  {label:'Choose the larger group',labelTl:'Piliin ang mas malaking grupo',copy:'Fast decision, but one side feels ignored.',copyTl:'Mabilis na desisyon, pero mararamdaman ng isang panig na hindi sila pinakinggan.',delta:{trust:-5,time:-1,unity:-8},score:90},
  {label:'Delay the issue',labelTl:'Ipagpaliban ang usapin',copy:'Avoid conflict today, lose credibility tomorrow.',copyTl:'Maiiwasan ang alitan ngayon, pero mababawasan ang kredibilidad bukas.',delta:{trust:-8,time:-3,unity:-4},score:50}]},
 {title:'Flooded Street',titleTl:'Binahang Kalsada',context:'A damaged drainage line needs urgent repair while the youth learning program also lacks materials.',contextTl:'Kailangang agarang ayusin ang sirang drainage habang kulang din sa materials ang youth learning program.',choices:[
  {label:'Emergency repair first',labelTl:'Unahin ang emergency repair',copy:'Protect access now, then preserve a smaller learning allocation.',copyTl:'Ayusin muna ang access, saka magtira ng mas maliit na allocation para sa learning.',delta:{budget:-18,trust:6,unity:3},score:220},
  {label:'Split funds evenly',labelTl:'Hatiin nang pantay ang pondo',copy:'Both programs move, neither is fully solved.',copyTl:'Parehong uusad ang dalawang programa pero walang ganap na malulutas.',delta:{budget:-16,trust:3,unity:2},score:160},
  {label:'Ignore infrastructure',labelTl:'Huwag unahin ang imprastraktura',copy:'Protect the learning budget but risk public frustration.',copyTl:'Mapoprotektahan ang learning budget pero posibleng tumaas ang pagkadismaya ng publiko.',delta:{budget:-9,trust:-7,unity:-2},score:70}]},
 {title:'Rumor in the Plaza',titleTl:'Usap-usapan sa Plaza',context:'A false rumor spreads about the civic team. People demand an immediate answer.',contextTl:'Kumalat ang maling balita tungkol sa civic team. Humihingi ang mga tao ng agarang sagot.',choices:[
  {label:'Publish verified facts',labelTl:'Ilabas ang beripikadong impormasyon',copy:'Respond with evidence and invite questions.',copyTl:'Sumagot gamit ang ebidensiya at tumanggap ng mga tanong.',delta:{trust:10,time:-2,unity:5},score:250},
  {label:'Attack the critics',labelTl:'Atakihin ang mga kritiko',copy:'Fast and emotional; division grows.',copyTl:'Mabilis at emosyonal; lalong lalalim ang pagkakahati.',delta:{trust:-9,unity:-10},score:40},
  {label:'Say nothing',labelTl:'Manahimik',copy:'Avoid escalation, but uncertainty remains.',copyTl:'Maiiwasan ang paglala pero mananatili ang pag-aalinlangan.',delta:{trust:-4,time:-1},score:100}]},
 {title:'Volunteer Burnout',titleTl:'Pagkapagod ng mga Volunteer',context:'The same volunteers have carried too many projects and are close to quitting.',contextTl:'Iisang volunteers ang sumalo ng napakaraming proyekto at malapit nang sumuko.',choices:[
  {label:'Reduce load and rotate teams',labelTl:'Bawasan ang load at mag-rotate ng teams',copy:'Slower delivery, stronger long-term capacity.',copyTl:'Mas mabagal ang delivery pero mas matatag ang pangmatagalang capacity.',delta:{time:-2,unity:10,trust:5},score:240},
  {label:'Push through one more month',labelTl:'Ituloy pa nang isang buwan',copy:'Output stays high today, burnout worsens.',copyTl:'Mataas ang output ngayon pero lalala ang burnout.',delta:{time:1,unity:-8,trust:-2},score:100},
  {label:'Replace them immediately',labelTl:'Palitan sila agad',copy:'Faster than mentoring, damaging to trust.',copyTl:'Mas mabilis kaysa mentoring pero makakasira sa tiwala.',delta:{unity:-10,trust:-5,budget:-6},score:70}]},
 {title:'Final Community Forum',titleTl:'Huling Forum ng Komunidad',context:'Residents disagree on what the next major project should be.',contextTl:'Hindi nagkakasundo ang mga residente kung ano ang susunod na pangunahing proyekto.',choices:[
  {label:'Use needs data + open forum',labelTl:'Gamitin ang needs data + open forum',copy:'Combine evidence with public participation.',copyTl:'Pagsamahin ang ebidensiya at pakikilahok ng publiko.',delta:{trust:9,time:-3,unity:8,budget:-4},score:280},
  {label:'Leader decides alone',labelTl:'Leader lang ang magdesisyon',copy:'Fast, but low participation.',copyTl:'Mabilis pero mababa ang partisipasyon.',delta:{trust:-5,time:1,unity:-6},score:90},
  {label:'Promise every proposal',labelTl:'Ipangako ang lahat ng proposal',copy:'Popular now, impossible to fund.',copyTl:'Popular ngayon pero imposibleng pondohan lahat.',delta:{trust:3,budget:-22,unity:2},score:80}]}
];

const STATE_LABEL_TL:Record<StateKey,string>={trust:'TIWALA',budget:'BUDGET',time:'ORAS',unity:'PAGKAKAISA'};
const starsForScore=(score:number):1|2|3=>score>=1500?3:score>=1125?2:1;

const localizeMessage=(message:string,language:'en'|'tl')=>{
 if(language==='en')return message;
 const exact:Record<string,string>={
  'Leadership is measured by consequences, not just fast answers. Keep trust, resources, time and community unity alive through five civic decisions.':'Nasusukat ang leadership sa bunga ng mga desisyon, hindi lamang sa bilis ng sagot. Panatilihin ang tiwala, resources, oras, at pagkakaisa sa limang civic decisions.',
  'Leadership mandate weakened: trust, unity, or resources fell below a sustainable level.':'Humina ang mandato ng pamumuno: bumaba sa hindi matatag na antas ang tiwala, pagkakaisa, o resources.',
 };
 if(exact[message])return exact[message];
 let match=message.match(/^Civic term completed with (\d+) trust, (\d+) unity and (\d+) budget reserve\.$/);
 if(match)return `Natapos ang civic term na may ${match[1]} tiwala, ${match[2]} pagkakaisa, at ${match[3]} budget reserve.`;
 for(const scenario of SCENARIOS){
  for(const choice of scenario.choices){
   if(message===`${choice.label}: ${choice.copy}`)return `${choice.labelTl}: ${choice.copyTl}`;
  }
 }
 return message;
};

type Props={onFinish?:(result:BuklodGameResult)=>void};
export function CivicLeadershipGameV1({onFinish}:Props){
 const {language,t}=useBuklodGameLanguage();
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
 return <View style={s.shell}><View style={s.header}><View><Text style={s.eyebrow}>{t('CHRISTIAN • CIVIC ACADEMY','CHRISTIAN • AKADEMYANG SIBIKO')}</Text><Text style={s.title}>{t('Leadership Council','Konseho ng Pamumuno')}</Text></View><Text style={s.score}>{score}</Text></View><Text style={s.message}>{localizeMessage(message,language)}</Text><View style={s.stats}>{(Object.entries(state) as Array<[StateKey,number]>).map(([k,v])=><View key={k} style={s.stat}><Text style={s.statLabel}>{language==='tl'?STATE_LABEL_TL[k]:k.toUpperCase()}</Text><Text style={s.statValue}>{Math.round(v)}</Text></View>)}</View>{!finished&&scenario?<View style={s.card}><Text style={s.kicker}>{t('CASE','KASO')} {index+1}/{SCENARIOS.length}</Text><Text style={s.caseTitle}>{language==='tl'?scenario.titleTl:scenario.title}</Text><Text style={s.context}>{language==='tl'?scenario.contextTl:scenario.context}</Text><View style={s.choices}>{scenario.choices.map(choice=><Pressable key={choice.label} style={s.choice} onPress={()=>choose(choice)}><Text style={s.choiceTitle}>{language==='tl'?choice.labelTl:choice.label}</Text><Text style={s.choiceCopy}>{language==='tl'?choice.copyTl:choice.copy}</Text></Pressable>)}</View></View>:<View style={s.result}><Text style={s.resultKicker}>{t('TERM COMPLETE','TAPOS ANG TERM')}</Text><Text style={s.bigScore}>{score}</Text><Text style={s.resultCopy}>{localizeMessage(message,language)}</Text><Text style={s.resultCopy}>{t('This civic term is recorded in Christian’s Kingdom station progress.','Naitala ang civic term na ito sa progreso ng Kingdom station ni Christian.')}</Text><Pressable style={s.primary} onPress={reset}><Text style={s.primaryText}>{t('NEW TERM','BAGONG TERM')}</Text></Pressable></View>}</View>;
}
const s=StyleSheet.create({shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#b6c8f0',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#f8fbff',fontSize:32,fontWeight:'900',marginTop:3},score:{color:'#ebcf8e',fontSize:28,fontWeight:'900'},message:{color:'#dce4f5',lineHeight:21},stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{flexGrow:1,minWidth:110,backgroundColor:'rgba(255,255,255,.05)',borderRadius:12,padding:10},statLabel:{color:'#9eabc7',fontSize:9,fontWeight:'900'},statValue:{color:'#fff',fontSize:22,fontWeight:'900',marginTop:2},card:{backgroundColor:'rgba(16,27,54,.84)',borderRadius:22,padding:18,borderWidth:1,borderColor:'rgba(116,150,216,.23)',gap:10},kicker:{color:'#aabde9',fontSize:10,fontWeight:'900',letterSpacing:1},caseTitle:{color:'#fff',fontSize:26,fontWeight:'900'},context:{color:'#d1dcf0',lineHeight:21},choices:{gap:9,marginTop:4},choice:{borderRadius:15,padding:14,backgroundColor:'rgba(255,255,255,.05)',borderWidth:1,borderColor:'rgba(255,255,255,.09)'},choiceTitle:{color:'#f4dfaa',fontSize:16,fontWeight:'900'},choiceCopy:{color:'#bfcbe2',lineHeight:19,marginTop:4},result:{alignItems:'center',backgroundColor:'rgba(16,27,54,.84)',borderRadius:22,padding:30,gap:10},resultKicker:{color:'#aebce0',fontSize:10,fontWeight:'900',letterSpacing:1},bigScore:{color:'#f1d99a',fontSize:58,fontWeight:'900'},resultCopy:{color:'#d9e3f3',textAlign:'center',maxWidth:620,lineHeight:21},primary:{backgroundColor:'#c8d5f6',borderRadius:14,paddingHorizontal:20,paddingVertical:14,marginTop:8},primaryText:{color:'#18223a',fontWeight:'900'}});
