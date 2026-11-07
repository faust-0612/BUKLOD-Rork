import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {
 NOTE_NAMES,MELODY_LEVELS,BEAT_LANES,BEAT_LEVELS,
 createMelodyRound,hintMelody,enterMelodyNote,
 createBeatRound,toggleBeat,hintBeat,gradeBeat,
 type MelodyRound,type BeatRound,
} from './musicCityRules';
type Props={onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
const NOTE_ICONS=['🔴','🟡','🟢','🔵'];
type Phase='ready'|'preview-ready'|'preview'|'playing'|'paused'|'clear'|'won'|'lost';
const receipt=()=> 'mu-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);

function MelodyMemoryGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<Phase>('ready');const phaseRef=useRef<Phase>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<MelodyRound>(()=>createMelodyRound(0));const ref=useRef(run);
 const [lit,setLit]=useState<number|null>(null);
 const [total,setTotal]=useState(0);const totalRef=useRef(0);
 const [message,setMessage]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const playbackId=useRef(0),id=useRef(''),finished=useRef(false);
 const change=(v:Phase)=>{phaseRef.current=v;setPhase(v);};
 const cancel=useCallback(()=>{playbackId.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;setLit(null);},[]);
 useEffect(()=>()=>{playbackId.current++;if(timer.current)clearTimeout(timer.current);},[]);
 const begin=useCallback((next:number)=>{
  cancel();const fresh=createMelodyRound(next);ref.current=fresh;setRun(fresh);setLevel(next);
  setMessage(t('Watch the phrase before entering the notes.','Panoorin ang phrase bago ilagay ang notes.'));
  change('preview-ready');
 },[cancel,t]);
 const start=useCallback(()=>{
  finished.current=false;totalRef.current=0;setTotal(0);id.current=receipt();begin(0);
 },[begin]);
 const finish=useCallback((status:'won'|'lost',score:number)=>{
  if(finished.current)return;finished.current=true;cancel();change(status);
  const stars:0|1|2|3=status==='lost'?0:score>=2100?3:score>=1600?2:1;
  onFinish?.({gameId:'lhen-melody-memory',status,score,stars,reward:{xp:0,kingdomXp:0}},id.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[cancel,onFinish]);
 const demo=useCallback(()=>{
  if(phaseRef.current!=='preview-ready')return;
  change('preview');
  const runId=++playbackId.current;
  const sequence=ref.current.notes;
  const tick=(index:number)=>{
   if(runId!==playbackId.current||phaseRef.current!=='preview')return;
   if(index>=sequence.length){setLit(null);change('playing');setMessage(t('Now repeat the phrase in order.','Ulitin ang phrase nang sunod-sunod.'));return;}
   setLit(sequence[index]);
   void playBuklodGameFeedback('move');
   timer.current=setTimeout(()=>{if(runId!==playbackId.current)return;
    setLit(null);
    timer.current=setTimeout(()=>tick(index+1),150);
   },MELODY_LEVELS[level].tempoMs);
  };
  tick(0);
 },[level,t]);
 const press=useCallback((note:number)=>{
  if(phaseRef.current!=='playing')return;
  const before=ref.current,next=enterMelodyNote(before,note);
  ref.current=next;setRun(next);
  if(next.misses>before.misses){
   setMessage(t('Different note. Replay the phrase before trying again.','Ibang note. Panoorin muli ang phrase bago subukan.'));
   void playBuklodGameFeedback('impact');
   if(next.status==='lost')finish('lost',totalRef.current);
   else change('preview-ready');
  }else if(next.status==='won'){
   totalRef.current+=next.score;setTotal(totalRef.current);
   if(level===MELODY_LEVELS.length-1)finish('won',totalRef.current);
   else{change('clear');void playBuklodGameFeedback('success');}
  }else void playBuklodGameFeedback('collect');
 },[finish,level,t]);
 const revealHint=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const next=hintMelody(ref.current);ref.current=next;setRun(next);
 },[]);
 const pause=()=>{cancel();change('paused');};
 return <View style={s.root}>
  <View style={s.header}><View style={s.headerCopy}><Text style={s.eyebrow}>LHEN • MUSIC CITY</Text>
    <Text style={s.title}>MELODY MEMORY</Text><Text style={s.subtitle}>{t('Listen with your eyes, remember with your hands.','Panoorin, tandaan at tugtugin ang mga note.')}</Text></View>
   <View style={s.scoreCard}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Three original note sequences','Tatlong orihinal na note pattern')}</Text>
   <Text style={s.body}>{t('Watch the four color-note pads light up in order, then tap them back. Each level adds notes and speeds up. Three mistakes in one level end the attempt. You may replay the phrase between attempts. Visual cues work without sound; original pitched music assets are a separate production gate.',
    'Panoorin ang pagkakasunod ng apat na kulay, saka i-tap ang mga ito. Humahaba at bumibilis ang susunod na level. Tatlong pagkakamali sa isang level ang katapusan. Maaaring ulitin ang demo. May visual cues kahit walang tunog.')}</Text>
   <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('START MELODY MEMORY','SIMULAN ANG MELODY')}</Text></Pressable></View>
  :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Paused','Naka-pause')}</Text>
   <Pressable style={s.primary} onPress={()=>change('preview-ready')}><Text style={s.primaryText}>{t('RESUME & REPLAY','ITULOY AT ULITIN')}</Text></Pressable></View>
  :phase==='clear'?<View style={s.panel}><Text style={s.panelTitle}>{t('PHRASE REMEMBERED!','NATANDAAN ANG PATTERN!')}</Text>
   <Text style={s.body}>{t('The next phrase has more notes.','Mas mahaba ang susunod na phrase.')}</Text>
   <Pressable style={s.primary} onPress={()=>begin(level+1)}><Text style={s.primaryText}>{t('NEXT PHRASE','SUSUNOD NA PHRASE')}</Text></Pressable></View>
  :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('MELODY MASTER!','MASTER NG MELODY!'):t('KEEP PRACTICING','MAGPRAKTIS MULI')}</Text>
   <Text style={s.final}>{total}</Text><Text style={s.body}>{t('Game mastery only; no Character Points or redeemable awards.','Game mastery lamang; walang Character Points o redeemable rewards.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
  :<>
   <View style={s.stats}><Text style={s.stat}>{t('PHRASE','PHRASE')} {level+1}/3</Text>
    <Text style={s.stat}>{t('NOTES','NOTES')} {run.index}/{run.notes.length}</Text>
    <Text style={s.stat}>{t('MISTAKES','MALI')} {run.misses}/3</Text>
    <Pressable onPress={pause} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <View style={s.padRow}>{NOTE_NAMES.map((name,i)=><Pressable key={name} disabled={phase!=='playing'}
      accessibilityRole="button" accessibilityLabel={'Play '+name}
      onPress={()=>press(i)} style={[s.pad,lit===i&&s.padLit,phase==='preview'&&lit!==i&&s.padDim]}>
     <Text style={s.padEmoji}>{NOTE_ICONS[i]}</Text><Text style={s.padName}>{name}</Text>
   </Pressable>)}</View>
   {phase==='preview-ready'?<Pressable style={s.primary} onPress={demo}>
    <Text style={s.primaryText}>{t('PLAY VISUAL PHRASE','IPAKITA ANG PHRASE')}</Text></Pressable>:null}
   {phase==='preview'?<Text style={s.notice}>{t('Watch the pattern...','Panoorin ang pattern...')}</Text>:null}
   {phase==='playing'&&<Pressable style={s.minor} disabled={run.hintUsed} onPress={revealHint}>
     <Text style={s.minorText}>{t('FIRST NOTE HINT','CLUE SA UNANG NOTE')}</Text></Pressable>}
   {run.hintUsed&&<Text style={s.hint}>{t('First note','Unang note')}: {NOTE_NAMES[run.notes[0]]}</Text>}
   {!!message?<Text style={s.notice}>{message}</Text>:null}
  </>}
 </View>;
}

function BeatComposerGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<Phase>('ready');const phaseRef=useRef<Phase>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<BeatRound>(()=>createBeatRound(0));const ref=useRef(run);
 const [lit,setLit]=useState<number|null>(null);
 const [total,setTotal]=useState(0);const totalRef=useRef(0);
 const [message,setMessage]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),playbackId=useRef(0),id=useRef(''),finished=useRef(false);
 const change=(v:Phase)=>{phaseRef.current=v;setPhase(v);};
 const cancel=useCallback(()=>{playbackId.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;setLit(null);},[]);
 useEffect(()=>()=>{playbackId.current++;if(timer.current)clearTimeout(timer.current);},[]);
 const begin=useCallback((next:number)=>{
  cancel();const fresh=createBeatRound(next);ref.current=fresh;setRun(fresh);setLevel(next);
  setMessage(t('Watch the 8-step rhythm, then place your own beats.','Panoorin ang 8-step rhythm, saka ilagay ang mga beat.'));
  change('preview-ready');
 },[cancel,t]);
 const start=useCallback(()=>{finished.current=false;totalRef.current=0;setTotal(0);id.current=receipt();begin(0);},[begin]);
 const finish=useCallback((status:'won'|'lost',score:number)=>{
  if(finished.current)return;finished.current=true;cancel();change(status);
  const stars:0|1|2|3=status==='lost'?0:score>=2700?3:score>=2300?2:1;
  onFinish?.({gameId:'lhen-beat-composer',status,score,stars,reward:{xp:0,kingdomXp:0}},id.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[cancel,onFinish]);
 const demo=useCallback(()=>{
  if(phaseRef.current!=='preview-ready')return;
  change('preview');const id=++playbackId.current;
  const tick=(step:number)=>{
   if(playbackId.current!==id||phaseRef.current!=='preview')return;
   if(step>=8){setLit(null);change('playing');return;}
   setLit(step);
   if(ref.current.target.some(track=>track[step]))void playBuklodGameFeedback('move');
   timer.current=setTimeout(()=>tick(step+1),540-level*35);
  };
  tick(0);
 },[level]);
 const toggle=useCallback((lane:number,step:number)=>{
  if(phaseRef.current!=='playing')return;
  const next=toggleBeat(ref.current,lane,step);ref.current=next;setRun(next);void playBuklodGameFeedback('move');
 },[]);
 const submit=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const next=gradeBeat(ref.current);ref.current=next;setRun(next);
  if(next.status==='won'){
   totalRef.current+=next.score;setTotal(totalRef.current);
   if(level===BEAT_LEVELS.length-1)finish('won',totalRef.current);
   else{change('clear');void playBuklodGameFeedback('success');}
  }else if(next.status==='lost')finish('lost',totalRef.current);
  else{setMessage(t('Not quite the same. Replay the example and adjust your grid.','Hindi pa pareho. Ulitin ang halimbawa at ayusin ang grid.'));void playBuklodGameFeedback('impact');}
 },[finish,level,t]);
 const hint=()=>{if(phaseRef.current!=='playing')return;const next=hintBeat(ref.current);ref.current=next;setRun(next);};
 const pause=()=>{cancel();change('paused');};
 const lanes=['🥁','👏','✨','🔔'];
 return <View style={s.root}>
  <View style={s.header}><View style={s.headerCopy}><Text style={s.eyebrow}>LHEN • MUSIC CITY</Text>
   <Text style={s.title}>BEAT COMPOSER</Text><Text style={s.subtitle}>{t('Compose a precise eight-step rhythm.','Bumuo ng eksaktong walong beat na pattern.')}</Text></View>
   <View style={s.scoreCard}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Compose three rhythm patterns','Bumuo ng tatlong rhythm pattern')}</Text>
   <Text style={s.body}>{t('Watch the original 8-step rhythm and remember the four instrument lanes: kick, clap, hat and bell. Tap grid squares to switch beats on or off. Check the composition against the example. Three incorrect submissions end the level. Rhythm preview has visual cues and basic feedback; original multitrack music remains to be professionally produced.','Panoorin ang walong beat sa apat na linya: kick, clap, hat at bell. I-tap ang grid para i-on o i-off ang beats. I-check kung tugma sa pattern. Tatlong maling submit ang katapusan ng level. May visual na gabay kahit walang tunog.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('START BEAT COMPOSER','SIMULAN ANG BEAT')}</Text></Pressable></View>
  :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Paused','Naka-pause')}</Text>
   <Pressable onPress={()=>change('preview-ready')} style={s.primary}><Text style={s.primaryText}>{t('RESUME & REPLAY','ITULOY AT ULITIN')}</Text></Pressable></View>
  :phase==='clear'?<View style={s.panel}><Text style={s.panelTitle}>{t('PATTERN MATCHED!','TUGMA ANG PATTERN!')}</Text>
   <Pressable onPress={()=>begin(level+1)} style={s.primary}><Text style={s.primaryText}>{t('NEXT PATTERN','SUSUNOD NA PATTERN')}</Text></Pressable></View>
  :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('MASTER COMPOSER!','MASTER NG BEAT!'):t('KEEP PRACTICING','MAGPRAKTIS MULI')}</Text>
   <Text style={s.final}>{total}</Text><Text style={s.body}>{t('Game-only mastery. No Character Points or redeemable rewards.','Score lamang ng laro. Walang Character Points o redeemable rewards.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
  :<>
   <View style={s.stats}><Text style={s.stat}>{t('PATTERN','PATTERN')} {level+1}/3</Text>
    <Text style={s.stat}>{t('ATTEMPTS','SUBOK')} {run.attempts}/3</Text>
    <Pressable onPress={pause} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <View style={s.beatBoard}><View style={s.beatHeader}><Text style={s.laneHeading}>TRACK</Text>
    {Array.from({length:8},(_,i)=><Text key={i} style={s.stepNum}>{i+1}</Text>)}</View>
    {run.draft.map((line,lane)=><View key={lane} style={s.beatRow}>
     <Text style={s.laneHeading}>{lanes[lane]}</Text>
     {line.map((on,step)=>{
      const demoOn=phase==='preview'&&lit===step&&run.target[lane][step];
      return <Pressable key={step} disabled={phase!=='playing'} accessibilityRole="button"
       accessibilityLabel={BEAT_LANES[lane]+' beat '+(step+1)}
       accessibilityState={{selected:on}} onPress={()=>toggle(lane,step)}
       style={[s.beatCell,phase==='playing'&&on&&s.beatActive,lit===step&&s.beatLit,demoOn&&s.beatDemo]}>
        {(phase==='playing'&&on)||demoOn?<MaterialCommunityIcons name="music-note" color="#fff4dc" size={13}/>:null}
       </Pressable>;
     })}</View>)}
   </View>
   {phase==='preview-ready'?<Pressable onPress={demo} style={s.primary}><Text style={s.primaryText}>{t('PLAY VISUAL RHYTHM','IPAKITA ANG RHYTHM')}</Text></Pressable>:null}
   {phase==='preview'?<Text style={s.notice}>{t('Follow the highlighted beats.','Sundan ang mga umiilaw na beat.')}</Text>:null}
   {phase==='playing'?<View style={s.actions}>
    <Pressable onPress={hint} disabled={run.hintUsed} style={s.minor}><Text style={s.minorText}>{t('HINT','TULONG')}</Text></Pressable>
    <Pressable onPress={submit} style={[s.primary,{flex:1}]}><Text style={s.primaryText}>{t('CHECK COMPOSITION','I-CHECK ANG BEAT')}</Text></Pressable>
    <Pressable onPress={()=>change('preview-ready')} style={s.minor}><Text style={s.minorText}>{t('REPLAY','ULITIN')}</Text></Pressable>
   </View>:null}
   {run.hintUsed&&<Text style={s.hint}>{t('Kick starts on step 1; watch which other lanes also start there.','Ang kick ay nagsisimula sa beat 1; pansinin kung aling ibang linya ang nagsisimula rin doon.')}</Text>}
   {!!message?<Text style={s.notice}>{message}</Text>:null}
  </>}
 </View>;
}
export {MelodyMemoryGameV1,BeatComposerGameV1};
const s=StyleSheet.create({
 root:{alignSelf:'center',width:'100%',maxWidth:830,padding:12,gap:12},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},headerCopy:{flex:1},
 eyebrow:{fontSize:10,color:'#dacef1',fontWeight:'900',letterSpacing:1},
 title:{fontSize:26,color:'#fff0dc',fontWeight:'900'},
 subtitle:{fontSize:12,color:'#dddbeb',lineHeight:18},
 scoreCard:{padding:10,backgroundColor:'#3e3659',borderColor:'#a9a0c5',borderWidth:1,borderRadius:10,alignItems:'center'},
 score:{color:'#ffdda7',fontSize:23,fontWeight:'900'},scoreLabel:{fontSize:9,color:'#e7dbe5',fontWeight:'900'},
 panel:{padding:17,borderRadius:15,backgroundColor:'#352f53',borderWidth:1,borderColor:'#9882bb',gap:13},
 panelTitle:{fontSize:22,color:'#ffecda',fontWeight:'900'},body:{color:'#e9e1ed',fontSize:13,lineHeight:21},
 primary:{padding:13,backgroundColor:'#e6cce2',borderRadius:10,alignItems:'center',justifyContent:'center'},
 primaryText:{fontSize:12,fontWeight:'900',color:'#463451'},final:{fontSize:42,color:'#fce3ad',fontWeight:'900'},
 stats:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:9},
 stat:{color:'#eee4f1',fontSize:11,fontWeight:'900'},
 minor:{borderWidth:1,borderColor:'#bba1cd',borderRadius:9,padding:10,justifyContent:'center',alignItems:'center'},
 minorText:{color:'#f8eaf0',fontSize:10,fontWeight:'900'},
 padRow:{flexDirection:'row',gap:9,justifyContent:'center',flexWrap:'wrap'},
 pad:{width:74,height:91,justifyContent:'center',alignItems:'center',borderRadius:13,borderColor:'#b7a5cc',borderWidth:2,backgroundColor:'#554c7f',gap:5},
 padLit:{backgroundColor:'#e9cb82',borderWidth:3,borderColor:'#fff6db'},padDim:{opacity:.6},
 padEmoji:{fontSize:31},padName:{fontSize:12,color:'#fcf1db',fontWeight:'900'},
 hint:{fontSize:12,color:'#f6daa9',textAlign:'center'},notice:{fontSize:12,color:'#e8def1',lineHeight:19,textAlign:'center'},
 beatBoard:{alignSelf:'center',maxWidth:580,width:'100%',padding:6,backgroundColor:'#342c53',borderColor:'#aaa0bd',borderWidth:1,borderRadius:12,gap:5},
 beatHeader:{flexDirection:'row',gap:4},
 beatRow:{flexDirection:'row',gap:4},laneHeading:{width:52,color:'#f2e7de',fontSize:11,fontWeight:'900',textAlign:'center',alignSelf:'center'},
 stepNum:{flex:1,color:'#d2bed9',fontSize:10,textAlign:'center',fontWeight:'900'},
 beatCell:{flex:1,aspectRatio:1,borderRadius:5,backgroundColor:'#514a70',borderWidth:1,borderColor:'#857aa8',alignItems:'center',justifyContent:'center'},
 beatActive:{backgroundColor:'#856bac',borderColor:'#f0d1fb'},
 beatLit:{borderColor:'#ffda8b',borderWidth:2},
 beatDemo:{backgroundColor:'#d0a76a'},
 actions:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},
});
