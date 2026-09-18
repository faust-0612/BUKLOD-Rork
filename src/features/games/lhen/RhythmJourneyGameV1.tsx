import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { BuklodGameText as Text } from '../runtime/BuklodGameLanguage';
import { useBuklodKingdomLevel } from '../runtime/BuklodGameLevelContext';
import type { BuklodGameResult } from '../types';

type Phase='ready'|'playing'|'result';
type Hit='perfect'|'good'|'miss';
type Beat={time:number;accent:boolean};

const GAME_ID='lhen-rhythm-journey';
const BEAT_MS=640;
const BEATS:Beat[]=Array.from({length:16},(_,i)=>({time:900+i*BEAT_MS,accent:i%4===0}));
const SONG_END=BEATS[BEATS.length-1].time+900;
const starsForScore=(score:number):1|2|3=>score>=2350?3:score>=1750?2:1;

type Props={onFinish?:(result:BuklodGameResult)=>void};
export function RhythmJourneyGameV1({onFinish}:Props){
 const { targetMultiplier } = useBuklodKingdomLevel();
 const missWindow=Math.max(125,230/targetMultiplier),tapWindow=Math.max(145,260/targetMultiplier),perfectWindow=Math.max(45,85/targetMultiplier),goodWindow=Math.max(95,180/targetMultiplier);
 const [phase,setPhase]=useState<Phase>('ready'),[elapsed,setElapsed]=useState(0),[beatIndex,setBeatIndex]=useState(0),[score,setScore]=useState(0),[combo,setCombo]=useState(0),[bestCombo,setBestCombo]=useState(0),[hits,setHits]=useState<Hit[]>([]),[message,setMessage]=useState('Tap when the pulse reaches the center. Perfect timing builds combo; missed beats break the flow.');
 const startedRef=useRef(0),handledRef=useRef<Set<number>>(new Set()),scoreRef=useRef(0),comboRef=useRef(0),bestComboRef=useRef(0),hitsRef=useRef<Hit[]>([]),finishedRef=useRef(false);
 const currentBeat=BEATS[Math.min(beatIndex,BEATS.length-1)];
 const offset=currentBeat?elapsed-currentBeat.time:9999;
 const proximity=Math.max(0,1-Math.abs(offset)/BEAT_MS);
 const accuracy=useMemo(()=>hits.length?Math.round(hits.reduce((sum,h)=>sum+(h==='perfect'?100:h==='good'?72:0),0)/hits.length):0,[hits]);

 const finish=useCallback((rawScore:number,finalHits:Hit[],finalBest:number)=>{
  if(finishedRef.current)return;finishedRef.current=true;
  const misses=finalHits.filter(h=>h==='miss').length;const finalAccuracy=finalHits.length?Math.round(finalHits.reduce((sum,h)=>sum+(h==='perfect'?100:h==='good'?72:0),0)/finalHits.length):0;const adjusted=rawScore+finalAccuracy*6+finalBest*24;const failed=misses>7||finalAccuracy<45;const stars=starsForScore(adjusted);scoreRef.current=adjusted;setScore(adjusted);setPhase('result');setMessage(failed?'The rhythm broke too often to complete the performance. Re-enter the journey and rebuild the timing flow.':`Performance complete at ${finalAccuracy}% accuracy with a best combo of ${finalBest}.`);void playBuklodGameFeedback(failed?'failure':'success');onFinish?.({gameId:GAME_ID,status:failed?'lost':'won',score:adjusted,stars:failed?0:stars,reward:{xp:failed?25:130+stars*45,kingdomXp:failed?5:58+stars*20,collectibleKey:!failed&&stars===3?'lhen-perfect-rhythm-note':undefined}});
 },[onFinish]);

 useEffect(()=>{
  if(phase!=='playing')return;
  const timer=setInterval(()=>{
   const now=Date.now()-startedRef.current;setElapsed(now);
   let idx=BEATS.findIndex((beat,i)=>!handledRef.current.has(i)&&now<=beat.time+230);if(idx<0)idx=BEATS.length-1;setBeatIndex(idx);
   BEATS.forEach((beat,i)=>{if(!handledRef.current.has(i)&&now>beat.time+missWindow){handledRef.current.add(i);hitsRef.current=[...hitsRef.current,'miss'];comboRef.current=0;setHits(hitsRef.current);setCombo(0);setMessage('Missed pulse. Reset your timing and re-enter the rhythm.');void playBuklodGameFeedback('impact');}});
   if(now>=SONG_END){clearInterval(timer);finish(scoreRef.current,[...hitsRef.current],bestComboRef.current);}
  },45);
  return()=>clearInterval(timer);
 },[finish,phase]);

 const start=useCallback(()=>{handledRef.current=new Set();startedRef.current=Date.now();scoreRef.current=0;comboRef.current=0;bestComboRef.current=0;hitsRef.current=[];finishedRef.current=false;setElapsed(0);setBeatIndex(0);setScore(0);setCombo(0);setBestCombo(0);setHits([]);setPhase('playing');setMessage('Follow the visual pulse and local feedback. Timing windows become tighter as your Kingdom Level rises.');void playBuklodGameFeedback('move');},[]);

 const tap=useCallback(()=>{
  if(phase!=='playing')return;
  const idx=BEATS.findIndex((_beat,i)=>!handledRef.current.has(i));if(idx<0)return;
  const beat=BEATS[idx];const deviation=Math.abs(elapsed-beat.time);if(deviation>tapWindow){setMessage('Too early. Wait for the pulse to collapse into the center.');void playBuklodGameFeedback('impact');return;}
  handledRef.current.add(idx);let hit:Hit='good';let points=110;if(deviation<=perfectWindow){hit='perfect';points=190;}else if(deviation<=goodWindow){hit='good';points=120;}else{hit='miss';points=0;}
  const nextCombo=hit==='miss'?0:comboRef.current+1;const bonus=hit==='miss'?0:nextCombo*12+(beat.accent?45:0);comboRef.current=nextCombo;bestComboRef.current=Math.max(bestComboRef.current,nextCombo);scoreRef.current+=points+bonus;hitsRef.current=[...hitsRef.current,hit];setCombo(nextCombo);setBestCombo(bestComboRef.current);setScore(scoreRef.current);setHits(hitsRef.current);setMessage(hit==='perfect'?(beat.accent?'PERFECT ACCENT • flow surges':'PERFECT • keep the line'):hit==='good'?'GOOD • stay centered':'Late miss • recover on the next pulse');void playBuklodGameFeedback(hit==='miss'?'impact':'collect');
 },[elapsed,goodWindow,missWindow,perfectWindow,phase,tapWindow]);

 const reset=useCallback(()=>{finishedRef.current=false;setPhase('ready');setElapsed(0);setBeatIndex(0);setScore(0);setCombo(0);setBestCombo(0);setHits([]);setMessage('Tap when the pulse reaches the center. Perfect timing builds combo; missed beats break the flow.');},[]);
 const progress=Math.min(100,Math.round(elapsed/SONG_END*100));
 return <View style={s.shell}><View style={s.header}><View><Text style={s.eyebrow}>LHEN • MUSIC & MISSION CITY</Text><Text style={s.title}>Rhythm Journey</Text></View><View style={s.scoreBox}><Text style={s.score}>{score}</Text><Text style={s.scoreLabel}>RHYTHM SCORE</Text></View></View><Text style={s.message}>{message}</Text><View style={s.hud}><Text style={s.hudText}>Combo ×{combo}</Text><Text style={s.hudText}>Accuracy {accuracy}%</Text><Text style={s.hudText}>Beat {Math.min(beatIndex+1,BEATS.length)}/{BEATS.length}</Text></View><View style={s.progress}><View style={[s.progressFill,{width:`${progress}%`}]} /></View>{phase==='ready'?<View style={s.stage}><Text style={s.stageKicker}>TIMING ENGINE</Text><Text style={s.stageTitle}>Follow the center pulse.</Text><Text style={s.stageCopy}>This timing engine uses real Perfect, Good, and Miss windows. Higher Kingdom Levels tighten the timing challenge.</Text><Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>START JOURNEY</Text></Pressable></View>:phase==='playing'?<View style={s.stage}><View style={s.rhythmField}><View style={[s.outerRing,{transform:[{scale:1+proximity*.25}],opacity:.35+proximity*.45}]} /><View style={[s.midRing,{transform:[{scale:1+proximity*.12}],opacity:.35+proximity*.55}]} /><View style={[s.core,currentBeat?.accent&&s.coreAccent,{transform:[{scale:.82+proximity*.36}]}]} /></View><Text style={s.timing}>{offset<0?`${Math.abs(Math.round(offset))} ms early`:`${Math.round(offset)} ms late`}</Text><Pressable style={s.tapButton} onPress={tap}><Text style={s.tapText}>TAP THE PULSE</Text></Pressable></View>:<View style={s.stage}><Text style={s.stageKicker}>PERFORMANCE COMPLETE</Text><Text style={s.bigScore}>{score}</Text><Text style={s.stageCopy}>{message}</Text><Pressable style={s.primary} onPress={reset}><Text style={s.primaryText}>PLAY AGAIN</Text></Pressable></View>}</View>;
}
const s=StyleSheet.create({shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#e0acd8',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#fff3ff',fontSize:32,fontWeight:'900',marginTop:3},scoreBox:{alignItems:'flex-end'},score:{color:'#ffd3f4',fontSize:29,fontWeight:'900'},scoreLabel:{color:'#b78faf',fontSize:9,fontWeight:'900'},message:{color:'#ead9ea',lineHeight:21},hud:{flexDirection:'row',justifyContent:'space-between',gap:10,flexWrap:'wrap'},hudText:{color:'#d8bed7',fontWeight:'800',fontSize:12},progress:{height:6,borderRadius:99,overflow:'hidden',backgroundColor:'rgba(255,255,255,.08)'},progressFill:{height:'100%',backgroundColor:'#d681c0'},stage:{alignItems:'center',backgroundColor:'rgba(35,14,45,.82)',borderRadius:24,borderWidth:1,borderColor:'rgba(220,128,204,.22)',padding:28,gap:12},stageKicker:{color:'#dba5d2',fontSize:10,fontWeight:'900',letterSpacing:1},stageTitle:{color:'#fff',fontSize:27,fontWeight:'900',textAlign:'center'},stageCopy:{color:'#d7c4d7',lineHeight:21,textAlign:'center',maxWidth:620},primary:{backgroundColor:'#dc9ad0',borderRadius:14,paddingHorizontal:22,paddingVertical:14,marginTop:8},primaryText:{color:'#35152f',fontWeight:'900'},rhythmField:{width:260,height:260,alignItems:'center',justifyContent:'center',marginVertical:8},outerRing:{position:'absolute',width:235,height:235,borderRadius:118,borderWidth:4,borderColor:'#cc7cc2'},midRing:{position:'absolute',width:165,height:165,borderRadius:83,borderWidth:3,borderColor:'#efb9e5'},core:{width:78,height:78,borderRadius:39,backgroundColor:'#df8bd0',shadowColor:'#ffd8f4',shadowOpacity:.5,shadowRadius:18},coreAccent:{backgroundColor:'#ffd26c'},timing:{color:'#cbb1c9',fontSize:12,fontWeight:'800'},tapButton:{width:'100%',maxWidth:420,borderRadius:20,paddingVertical:22,alignItems:'center',backgroundColor:'#f2b9e6'},tapText:{color:'#3d1736',fontSize:18,fontWeight:'900',letterSpacing:1},bigScore:{color:'#ffd3f4',fontSize:58,fontWeight:'900'}});