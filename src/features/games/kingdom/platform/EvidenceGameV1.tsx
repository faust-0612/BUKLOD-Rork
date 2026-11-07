import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BuklodGameResult } from '@/features/games/types';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import {
  EVIDENCE_QUESTIONS, EVIDENCE_LENGTH,
  answerEvidence, advanceEvidence, createEvidenceRound, evidenceHint,
  type EvidenceGameId, type EvidenceRound,
} from './evidenceRules';
type Props = { gameId: EvidenceGameId; onFinish?: (result: BuklodGameResult, sessionId: string) => void };
export function EvidenceGameV1({ gameId, onFinish }: Props) {
 const { language, t } = useBuklodGameLanguage();
 const [run,setRun]=useState<EvidenceRound>(()=>createEvidenceRound(gameId));
 const ref=useRef(run);
 const [stage,setStage]=useState<'ready'|'play'|'paused'|'result'>('ready');
 const stageRef=useRef<'ready'|'play'|'paused'|'result'>('ready');
 const receipt=useRef('');
 const finished=useRef(false);
 const isVan=gameId==='van-mind-challenge';
 const title=isVan?'MIND CHALLENGE':'GUESSING QUEST';
 const q=EVIDENCE_QUESTIONS[gameId][run.index];
 const setPhase=(value:'ready'|'play'|'paused'|'result')=>{stageRef.current=value;setStage(value);};
 const start=useCallback(()=>{
  const fresh=createEvidenceRound(gameId);ref.current=fresh;setRun(fresh);
  receipt.current='ev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,13);
  finished.current=false;setPhase('play');void playBuklodGameFeedback('move');
 },[gameId]);
 const answer=useCallback((choice:number)=>{
  if(stageRef.current!=='play')return;
  const previous=ref.current;const next=answerEvidence(previous,choice);
  if(next===previous)return;
  ref.current=next;setRun(next);
  void playBuklodGameFeedback(next.correct>previous.correct?'success':'impact');
 },[]);
 const hint=useCallback(()=>{
  if(stageRef.current!=='play')return;
  const next=evidenceHint(ref.current);ref.current=next;setRun(next);
  void playBuklodGameFeedback('move');
 },[]);
 const nextQuestion=useCallback(()=>{
  if(stageRef.current!=='play')return;
  let next:EvidenceRound;
  try{next=advanceEvidence(ref.current);}catch{return;}
  ref.current=next;setRun(next);
  if(next.status!=='playing'){
   setPhase('result');
   if(!finished.current){
    finished.current=true;
    const status=next.status==='won'?'won':'lost';
    const stars:0|1|2|3=status==='lost'?0:next.correct>=9?3:next.correct>=8?2:1;
    onFinish?.({gameId,status,score:next.score,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
   }
   void playBuklodGameFeedback(next.status==='won'?'success':'failure');
  }else void playBuklodGameFeedback('move');
 },[gameId,onFinish]);
 return <View style={s.shell}>
  <View style={s.heading}><View style={s.headingText}><Text style={s.kicker}>{isVan?'VAN • MIND CITY':'QUIN • DISCOVERY WORLD'}</Text>
   <Text style={s.title}>{title}</Text><Text style={s.subtitle}>{t(isVan?'Patterns, spatial thinking and logical proofs.':'Use clues and scientific evidence to solve mysteries.',isVan?'Patterns, espasyo at lohikal na pangangatwiran.':'Gumamit ng clues at ebidensiya upang lutasin ang misteryo.')}</Text>
  </View><View style={s.scoreBox}><Text style={s.score}>{run.score}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {stage==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Nine challenges across three worlds','Siyam na hamon sa tatlong mundo')}</Text>
   <Text style={s.body}>{t('Each question has one verified answer. You get two attempts and one hint per question. Read the explanation after answering. Clear at least six of nine to win. Higher tiers earn more mastery score.', 'Bawat tanong ay may iisang tamang sagot. May dalawang subok at isang clue kada tanong. Basahin ang paliwanag pagkatapos sumagot. Kailangan ng anim sa siyam upang manalo.')}</Text>
   <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('START EXPLORATION','SIMULAN ANG HAMON')}</Text></Pressable></View>
  :stage==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Paused','Naka-pause')}</Text>
   <Pressable style={s.primary} onPress={()=>setPhase('play')}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
  :stage==='result'?<View style={s.panel}><Text style={s.panelTitle}>{run.status==='won'?t('CHALLENGES COMPLETE!','KUMPLETO ANG MGA HAMON!'):t('KEEP EXPLORING!','MAGPATULOY SA PAGTUKLAS!')}</Text>
    <Text style={s.bigScore}>{run.score}</Text><Text style={s.body}>{run.correct}/{EVIDENCE_LENGTH} {t('correct answers','tamang sagot')}. {t('Local preview only: no Character Points were granted.','Local preview lamang: walang Character Points na nadagdag.')}</Text>
    <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable>
   </View>
  :<View style={s.panel}>
   <View style={s.meta}><Text style={s.eyebrow}>{t('ROUND','ROUND')} {q.tier+1}/3 • {run.index+1}/{EVIDENCE_LENGTH}</Text>
    <Text style={s.eyebrow}>{t('CORRECT','TAMA')}: {run.correct} • {t('TRIES','SUBOK')}: {2-run.wrong}</Text>
    <Pressable accessibilityRole="button" onPress={()=>setPhase('paused')} style={s.pause}><Text style={s.pauseText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <Text style={s.prompt}>{q.prompt[language]}</Text>
   <View style={s.choices}>{q.choices[language].map((name,i)=>{
    const showRight=run.locked&&i===q.correct,selected=run.selected===i;
    return <Pressable key={i} disabled={run.locked} accessibilityRole="button" accessibilityLabel={name}
     onPress={()=>answer(i)} style={[s.choice,showRight&&s.choiceRight,selected&&!showRight&&s.choiceWrong]}>
     <Text style={s.letter}>{String.fromCharCode(65+i)}</Text><Text style={s.choiceText}>{name}</Text>
     {showRight?<MaterialCommunityIcons name="check-circle" color="#b5f0bb" size={18}/>:null}
    </Pressable>;
   })}</View>
   {!run.locked?<Pressable disabled={run.hints.includes(q.id)} style={[s.hintButton,run.hints.includes(q.id)&&s.dim]} onPress={hint}>
    <MaterialCommunityIcons name="lightbulb-on-outline" color="#f6e1ad" size={19}/>
    <Text style={s.hintText}>{t('SHOW ONE CLUE','PAKITA ANG ISANG CLUE')}</Text></Pressable>:null}
   {run.hints.includes(q.id)?<Text style={s.hint}>{q.hint[language]}</Text>:null}
   {run.wrong===1&&!run.locked?<Text style={s.feedback}>{t('Not quite. Try once more.','Hindi pa tama. Subukan muli.')}</Text>:null}
   {run.locked?<View style={s.explain}><Text style={s.answerLine}>{run.selected===q.correct?t('CORRECT!','TAMA!'):t('ANSWER REVEALED','ITO ANG SAGOT')}: {q.choices[language][q.correct]}</Text>
    <Text style={s.body}>{q.explanation[language]}</Text>
    <Pressable onPress={nextQuestion} style={s.primary}><Text style={s.primaryText}>{run.index===EVIDENCE_LENGTH-1?t('VIEW RESULTS','TINGNAN ANG RESULTA'):t('NEXT QUESTION','SUSUNOD NA TANONG')}</Text></Pressable></View>:null}
  </View>}
 </View>;
}
const s=StyleSheet.create({
 shell:{alignSelf:'center',width:'100%',maxWidth:830,padding:12,gap:12},
 heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},headingText:{flex:1},
 kicker:{color:'#c5e0d5',fontSize:10,fontWeight:'900',letterSpacing:1},title:{color:'#fdf1d3',fontSize:26,fontWeight:'900'},subtitle:{color:'#d4e3e0',fontSize:12,lineHeight:18},
 scoreBox:{alignItems:'center',padding:10,backgroundColor:'#294b55',borderColor:'#ccbb8d',borderWidth:1,borderRadius:12},
 score:{color:'#fce0a4',fontSize:23,fontWeight:'900'},scoreLabel:{color:'#cce4d4',fontSize:9,fontWeight:'900'},
 panel:{backgroundColor:'#203d4a',borderWidth:1,borderColor:'#7ea1a2',borderRadius:16,padding:16,gap:13},
 panelTitle:{color:'#fff0cc',fontSize:22,fontWeight:'900'},
 body:{color:'#e1eae2',fontSize:13,lineHeight:21},primary:{padding:13,backgroundColor:'#e5d0a2',alignItems:'center',borderRadius:10},
 primaryText:{color:'#244149',fontSize:12,fontWeight:'900'},bigScore:{color:'#ffe1a7',fontSize:41,fontWeight:'900'},
 meta:{flexDirection:'row',gap:8,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'},
 eyebrow:{color:'#cce8e0',fontSize:11,fontWeight:'900'},pause:{borderRadius:8,padding:8,borderColor:'#c0bd9d',borderWidth:1},
 pauseText:{fontSize:10,fontWeight:'900',color:'#f5e8ca'},
 prompt:{fontSize:19,fontWeight:'800',color:'#fff7dd',lineHeight:27},
 choices:{gap:8},choice:{minHeight:53,backgroundColor:'#31566b',borderWidth:1,borderColor:'#708e98',borderRadius:11,padding:11,flexDirection:'row',alignItems:'center',gap:10},
 choiceRight:{backgroundColor:'#2a6152',borderColor:'#a7d9b3'},choiceWrong:{backgroundColor:'#755049',borderColor:'#e4b9a6'},
 letter:{color:'#e9d7a7',fontSize:14,fontWeight:'900'},choiceText:{color:'#f8f3e5',fontSize:13,fontWeight:'700',flex:1},
 hintButton:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:7,padding:10,borderRadius:9,borderColor:'#b8c09e',borderWidth:1},
 hintText:{color:'#fbe9be',fontSize:11,fontWeight:'900'},dim:{opacity:.4},hint:{color:'#f7dfa5',fontSize:13,textAlign:'center'},
 feedback:{color:'#ffc1b2',textAlign:'center',fontSize:12},explain:{gap:10,backgroundColor:'#284753',padding:12,borderRadius:12},
 answerLine:{color:'#c2e9ca',fontSize:15,fontWeight:'900'},
});
