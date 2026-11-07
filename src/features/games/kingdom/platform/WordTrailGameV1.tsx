import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {
 WORD_LEVELS,createWordRound,addWordCell,clearWordPath,currentWord,submitWordPath,
 type WordGameId,type WordRound,
} from './wordTrailRules';
type Props={gameId:WordGameId;onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
export function WordTrailGameV1({gameId,onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const garden=gameId==='trudice-word-garden';
 const [run,setRun]=useState<WordRound>(()=>createWordRound(gameId,0));const ref=useRef(run);
 const [phase,setPhase]=useState<'ready'|'playing'|'paused'|'clear'|'won'>('ready');
 const phaseRef=useRef<typeof phase>('ready');
 const [level,setLevel]=useState(0);
 const [total,setTotal]=useState(0);const totalRef=useRef(0);
 const [hint,setHint]=useState(false);
 const [notice,setNotice]=useState('');
 const receipt=useRef('');const finished=useRef(false);
 const changePhase=(v:typeof phase)=>{phaseRef.current=v;setPhase(v);};
 const levelStart=useCallback((nextLevel:number)=>{
  const fresh=createWordRound(gameId,nextLevel);ref.current=fresh;setRun(fresh);setLevel(nextLevel);
  setHint(false);setNotice(t('Tap neighboring letters in order, then submit your word.','I-tap ang magkakatabing letra nang sunod, saka isumite ang salita.'));
  changePhase('playing');void playBuklodGameFeedback('move');
 },[gameId,t]);
 const start=useCallback(()=>{
  totalRef.current=0;setTotal(0);finished.current=false;
  receipt.current='wd-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,13);
  levelStart(0);
 },[levelStart]);
 const pick=useCallback((row:number,col:number)=>{
  if(phaseRef.current!=='playing')return;
  const prev=ref.current,next=addWordCell(prev,{row,col});
  if(next!==prev){ref.current=next;setRun(next);void playBuklodGameFeedback('move');}
  else {setNotice(t('Choose an adjacent, unused letter. Tap the prior letter to backtrack.','Piliin ang katabing hindi pa nagamit na letra. I-tap ang nauna upang bumalik.'));}
 },[t]);
 const submit=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const prev=ref.current;
  if(!prev.path.length)return;
  const selected=currentWord(prev);
  const next=submitWordPath(prev);ref.current=next;setRun(next);
  if(next.found.length>prev.found.length){
   setNotice(t('Found','Nahanap')+': '+selected);
   void playBuklodGameFeedback('collect');
  }else{
   setNotice(t('Not in this level’s word list, or already found.','Wala sa listahan ng level, o nahanap na.'));
   void playBuklodGameFeedback('impact');
  }
  if(next.status==='won'){
   totalRef.current+=next.score;setTotal(totalRef.current);
   if(level===WORD_LEVELS[gameId].length-1){
    if(!finished.current){
     finished.current=true;
     changePhase('won');void playBuklodGameFeedback('success');
     const stars:0|1|2|3=next.attempts<=3?3:next.attempts<=6?2:1;
     onFinish?.({gameId,status:'won',score:totalRef.current,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
    }
   }else changePhase('clear');
  }
 },[gameId,level,onFinish,t]);
 const clear=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const next=clearWordPath(ref.current);ref.current=next;setRun(next);void playBuklodGameFeedback('move');
 },[]);
 const selected=new Set(run.path.map(c=>c.row+':'+c.col));
 return <View style={s.root}>
  <View style={s.head}><View style={s.headText}>
   <Text style={s.eyebrow}>{garden?'TRUDICE • WONDER GARDEN':'NIEL • MISSION FRONTIER'}</Text>
   <Text style={s.title}>{garden?'WORD GARDEN':'WORD EXPLORER'}</Text>
   <Text style={s.subtitle}>{t(garden?'Grow your knowledge by tracing hidden words.':'Trace the words that reveal the expedition map.',
     garden?'Palaguin ang kaalaman sa paghahanap ng mga salita.':'Tuklasin ang salita sa mapa ng ekspedisyon.')}</Text>
  </View><View style={s.scoreBox}><Text style={s.score}>{total+(phase==='playing'||phase==='paused'?run.score:0)}</Text>
   <Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Three hidden-word journeys','Tatlong yugto ng mga salita')}</Text>
    <Text style={s.body}>{t('The words shown in the list are all hidden on the 4×4 letter map. Connect neighboring letters horizontally, vertically or diagonally without reusing a square. Tap the previous letter to backtrack. Find every listed word to finish each level. There is no timer or random dictionary penalty.',
     'Nakatago sa 4×4 mapa ang lahat ng salita sa listahan. Pagdugtungin ang magkatabing letra—pahalang, patayo o pahilis—nang hindi inuulit ang square. I-tap ang naunang letra para bumalik. Walang timer o di-makatarungang dictionary penalty.')}</Text>
    <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('START WORD QUEST','SIMULAN ANG SALITA')}</Text></Pressable></View>
  :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Paused','Naka-pause')}</Text>
     <Pressable style={s.primary} onPress={()=>changePhase('playing')}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
  :phase==='clear'?<View style={s.panel}><Text style={s.panelTitle}>{t('ALL WORDS FOUND!','NAHANAP ANG LAHAT!')}</Text>
    <Text style={s.body}>{t('The next word map is ready.','Handa na ang susunod na mapa ng salita.')}</Text>
    <Pressable onPress={()=>levelStart(level+1)} style={s.primary}><Text style={s.primaryText}>{t('NEXT LEVEL','SUSUNOD NA LEVEL')}</Text></Pressable></View>
  :phase==='won'?<View style={s.panel}><Text style={s.panelTitle}>{t('WORD EXPLORER CHAMPION!','KAMPEON SA MGA SALITA!')}</Text>
    <Text style={s.final}>{total}</Text>
    <Text style={s.body}>{t('Offline mastery only. No Character Points or cash have been awarded.','Offline mastery lamang. Walang Character Points o cash na naibigay.')}</Text>
    <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
  :<>
   <View style={s.status}><Text style={s.stat}>{t('LEVEL','LEVEL')} {level+1}/3</Text>
    <Text style={s.stat}>{t('FOUND','NAHANAP')} {run.found.length}/{run.words.length}</Text>
    <Text style={s.stat}>{t('ATTEMPTS','SUBOK')} {run.attempts}</Text>
    <Pressable accessibilityRole="button" onPress={()=>changePhase('paused')} style={s.mini}><Text style={s.miniText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <View style={s.bank}>{run.words.map(w=><View key={w} style={[s.wordChip,run.found.includes(w)&&s.wordFound]}>
    <MaterialCommunityIcons name={run.found.includes(w)?'check-circle':'leaf'} size={14} color="#e2e4bc"/>
    <Text style={s.wordText}>{w}</Text>
   </View>)}</View>
   <View style={s.board}>{run.board.map((line,r)=><View key={r} style={s.boardRow}>
    {line.map((letter,c)=><Pressable key={c} accessibilityRole="button"
     accessibilityLabel={t('Letter','Letra')+' '+letter+' '+(r+1)+'-'+(c+1)}
     accessibilityState={{selected:selected.has(r+':'+c)}}
     onPress={()=>pick(r,c)} style={[s.letter,selected.has(r+':'+c)&&s.letterSelected]}>
      <Text style={s.letterText}>{letter}</Text>
     </Pressable>)}</View>)}</View>
   <View style={s.current}><Text style={s.currentLabel}>{t('CURRENT WORD','KASALUKUYANG SALITA')}</Text>
     <Text style={s.currentWord}>{currentWord(run)||'· · ·'}</Text></View>
   <View style={s.actions}>
    <Pressable onPress={clear} style={s.mini}><Text style={s.miniText}>{t('CLEAR','BURAHIN')}</Text></Pressable>
    <Pressable disabled={!run.path.length} onPress={submit} style={[s.primary,s.submit,!run.path.length&&s.disabled]}>
      <Text style={s.primaryText}>{t('SUBMIT WORD','ISUMITE ANG SALITA')}</Text></Pressable>
    <Pressable onPress={()=>setHint(v=>!v)} style={s.mini}><Text style={s.miniText}>{t('HINT','TULONG')}</Text></Pressable>
   </View>
   {hint?<Text style={s.hint}>{t('Look for the first letter of any unfound word; every listed word has a continuous path.','Hanapin ang unang letra ng hindi pa nakikitang salita; bawat salita ay may tuluy-tuloy na daan.')}</Text>:null}
   {!!notice?<Text style={s.notice}>{notice}</Text>:null}
  </>}
 </View>;
}
const s=StyleSheet.create({
 root:{maxWidth:760,width:'100%',alignSelf:'center',padding:12,gap:12},
 head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:9},headText:{flex:1},
 eyebrow:{color:'#d3e3b8',fontSize:10,letterSpacing:1,fontWeight:'900'},
 title:{fontSize:26,fontWeight:'900',color:'#fff0c6'},subtitle:{fontSize:12,color:'#d8e6db',lineHeight:18},
 scoreBox:{padding:9,backgroundColor:'#32564c',borderRadius:12,alignItems:'center',borderWidth:1,borderColor:'#b5c398'},
 score:{fontSize:22,color:'#fce5a9',fontWeight:'900'},scoreLabel:{fontSize:9,color:'#d9e7be',fontWeight:'900'},
 panel:{backgroundColor:'#264c44',borderWidth:1,borderColor:'#92b59c',padding:16,borderRadius:15,gap:13},
 panelTitle:{fontSize:22,color:'#ffefc9',fontWeight:'900'},body:{color:'#e3ecde',fontSize:13,lineHeight:21},
 primary:{padding:13,backgroundColor:'#dfdca8',borderRadius:11,alignItems:'center'},primaryText:{color:'#345046',fontSize:12,fontWeight:'900'},
 final:{fontSize:42,color:'#fce4a2',fontWeight:'900'},status:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
 stat:{fontSize:11,fontWeight:'900',color:'#e7efda'},mini:{borderWidth:1,borderColor:'#b6c7a6',borderRadius:8,padding:9},
 miniText:{fontWeight:'900',fontSize:10,color:'#e8f2d9'},
 bank:{flexDirection:'row',justifyContent:'center',flexWrap:'wrap',gap:7},
 wordChip:{flexDirection:'row',gap:5,alignItems:'center',borderRadius:9,padding:8,backgroundColor:'#345c4f',borderColor:'#b2c5a0',borderWidth:1},
 wordFound:{backgroundColor:'#397c64'},wordText:{color:'#f5ebcc',fontWeight:'900',fontSize:12},
 board:{alignSelf:'center',width:'100%',maxWidth:420,gap:6,padding:8,borderRadius:16,borderWidth:2,borderColor:'#b5c69f',backgroundColor:'#24463f'},
 boardRow:{flexDirection:'row',gap:6},
 letter:{flex:1,aspectRatio:1,alignItems:'center',justifyContent:'center',borderRadius:10,backgroundColor:'#77a17b',borderWidth:1,borderColor:'#b8d19e'},
 letterSelected:{backgroundColor:'#e4cb87',borderColor:'#fff9e5',borderWidth:3},
 letterText:{color:'#fff6df',fontWeight:'900',fontSize:24},
 current:{alignItems:'center',gap:3},currentLabel:{fontSize:10,color:'#e6e7cc',fontWeight:'900'},
 currentWord:{fontWeight:'900',fontSize:23,color:'#ffe0a6',letterSpacing:2},
 actions:{flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center',flexWrap:'wrap'},submit:{flex:1,maxWidth:190},
 disabled:{opacity:.45},notice:{color:'#deebd6',fontSize:12,textAlign:'center',lineHeight:18},
 hint:{color:'#ffe5a8',fontSize:12,textAlign:'center',lineHeight:19},
});
