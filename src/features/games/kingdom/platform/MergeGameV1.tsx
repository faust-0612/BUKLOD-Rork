import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {MERGE_LEVELS,createMergeRound,moveMerge,type MergeGameId,type MergeDirection,type MergeRound} from './mergeRules';

type Props={gameId:MergeGameId;onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
const WORLDS:Record<MergeGameId,{name:string;character:string;items:readonly string[];descEn:string;descTl:string}>={
 'mitch-color-merge':{name:'COLOR MERGE',character:'MITCH',items:['','🔴','🟠','🟡','🟢','🔵','🟣','🎨'],
  descEn:'Combine matching paint colors to complete three mural palettes.',descTl:'Pagsamahin ang mga pintura upang makumpleto ang tatlong mural palette.'},
 'angel-treasure-merge':{name:'TREASURE MERGE',character:'ANGEL',items:['','🪙','💍','💎','👑','🏆','✨','💰'],
  descEn:'Merge matching treasures to restore the vault collection.',descTl:'Pagsamahin ang yaman upang maibalik ang kayamanan ng vault.'},
 'vhen-farm-merge':{name:'FARM MERGE',character:'VHEN',items:['','🌱','🌿','🌾','🥕','🌽','🍉','🚜'],
  descEn:'Merge growing produce into advanced farm harvests.',descTl:'Pagsamahin ang mga ani sa mas mataas na antas ng bukirin.'},
};
const order:MergeDirection[]=['left','up','down','right'];
const icons:{[K in MergeDirection]:'arrow-left-bold'|'arrow-up-bold'|'arrow-down-bold'|'arrow-right-bold'}={
 left:'arrow-left-bold',right:'arrow-right-bold',up:'arrow-up-bold',down:'arrow-down-bold'};
export function MergeGameV1({gameId,onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const theme=WORLDS[gameId];
 const [phase,setPhase]=useState<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready');
 const phaseRef=useRef<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<MergeRound>(()=>createMergeRound(gameId,0));
 const runRef=useRef(run);
 const [total,setTotal]=useState(0);const totalRef=useRef(0);
 const [attempts,setAttempts]=useState(0);const attemptsRef=useRef(0);
 const [hint,setHint]=useState(false);
 const receipt=useRef('');const finished=useRef(false);
 const phaseSet=(v:typeof phase)=>{phaseRef.current=v;setPhase(v);};
 const levelStart=useCallback((nextLevel:number,keepAttempts=false)=>{
  const next=createMergeRound(gameId,nextLevel);
  runRef.current=next;setRun(next);setLevel(nextLevel);setHint(false);
  if(!keepAttempts){attemptsRef.current=0;setAttempts(0);}
  phaseSet('playing');void playBuklodGameFeedback('move');
 },[gameId]);
 const start=useCallback(()=>{
  finished.current=false;totalRef.current=0;setTotal(0);
  receipt.current='mg-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  levelStart(0);
 },[levelStart]);
 const finish=useCallback((status:'won'|'lost',points:number)=>{
  if(finished.current)return;
  finished.current=true;phaseSet(status);
  const stars=status==='lost'?0:attemptsRef.current===0?3:attemptsRef.current===1?2:1;
  onFinish?.({gameId,status,score:points,stars:stars as 0|1|2|3,reward:{xp:0,kingdomXp:0}},receipt.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[gameId,onFinish]);
 const move=useCallback((dir:MergeDirection)=>{
  if(phaseRef.current!=='playing')return;
  const previous=runRef.current;const next=moveMerge(previous,dir);
  if(next===previous){void playBuklodGameFeedback('impact');return;}
  runRef.current=next;setRun(next);
  void playBuklodGameFeedback(next.lastGained?'collect':'move');
  if(next.status==='won'){
   const added=next.score+Math.max(0,next.maxMoves-next.moves)*30;
   totalRef.current+=added;setTotal(totalRef.current);
   if(level===MERGE_LEVELS[gameId].length-1)finish('won',totalRef.current);
   else phaseSet('clear');
  }else if(next.status==='lost'){
   const times=attemptsRef.current+1;
   attemptsRef.current=times;setAttempts(times);
   if(times>=3)finish('lost',totalRef.current);
   else phaseSet('retry');
  }
 },[finish,gameId,level]);
 const symbol=(value:number)=>theme.items[Math.log2(value)]??'★';
 return <View style={s.shell}>
   <View style={s.header}><View style={s.headerText}><Text style={s.eyebrow}>{theme.character} • KINGDOM STUDIO</Text>
    <Text style={s.title}>{theme.name}</Text><Text style={s.subtitle}>{t(theme.descEn,theme.descTl)}</Text>
   </View><View style={s.scoreBox}><Text style={s.score}>{total+(phase==='playing'||phase==='paused'?run.score:0)}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
   {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Make something wonderful','Lumikha ng kakaiba')}</Text>
    <Text style={s.body}>{t('Play three increasingly challenging 4×4 merge boards. Tap the arrows to slide ALL tiles. Equal tiles merge once per move and double in value. Create the target tile before the move budget ends. Invalid moves cost nothing. A failed board may be retried twice; game score is local only.','Tatlong 4×4 merge board ang lalaruin. I-tap ang arrows upang igalaw lahat ng tiles. Magkaparehong tiles ay nagsasama at dumodoble. Abutin ang target bago maubos ang moves. Walang bawas sa invalid moves; puwedeng subukan muli ng dalawang beses.')}</Text>
    <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('START MERGE GAME','SIMULAN ANG LARO')}</Text></Pressable>
   </View>:phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Paused','Naka-pause')}</Text>
    <Pressable style={s.primary} onPress={()=>phaseSet('playing')}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
   :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('COLLECTION COMPLETE!','KUMPLETO ANG KOLEKSIYON!'):t('TRY A NEW STRATEGY','SUBUKAN MULI')}</Text>
    <Text style={s.final}>{total}</Text>
    <Text style={s.body}>{t('Game mastery only; no Character Points or redeemable rewards.','Game mastery lamang; walang Character Points o redeemable reward.')}</Text>
    <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable>
   </View>:phase==='clear'||phase==='retry'?<View style={s.panel}>
    <Text style={s.panelTitle}>{phase==='clear'?t('LEVEL COMPLETE!','KUMPLETO ANG LEVEL!'):t('OUT OF MOVES','UBOS NA ANG MOVES')}</Text>
    <Text style={s.body}>{phase==='clear'?t('You earned the next level.','Nabuksan ang susunod na level.'):t('Replan your merges and try again.','Baguhin ang diskarte at subukan muli.')}</Text>
    <Pressable style={s.primary} onPress={()=>levelStart(phase==='clear'?level+1:level,phase==='retry')}><Text style={s.primaryText}>{phase==='clear'?t('NEXT LEVEL','SUSUNOD NA LEVEL'):t('RETRY','SUBUKAN MULI')}</Text></Pressable>
   </View>:<>
     <View style={s.stats}><Text style={s.stat}>{t('LEVEL','LEVEL')} {level+1}/3</Text><Text style={s.stat}>{t('TARGET','TARGET')}: {run.goal}</Text>
      <Text style={s.stat}>{t('MOVES','GALAW')}: {run.maxMoves-run.moves}</Text>
      <Pressable onPress={()=>phaseSet('paused')} style={s.pause}><Text style={s.pauseText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
     <View style={s.board}>{run.board.map((line,r)=><View key={r} style={s.row}>{line.map((value,c)=><View key={c} style={[s.tile,value>0&&s.tileFilled]}>
       <Text style={s.icon}>{value?symbol(value):''}</Text><Text style={s.value}>{value||''}</Text>
     </View>)}</View>)}</View>
     <View style={s.buttons}>{order.map(dir=><Pressable key={dir} accessibilityRole="button" accessibilityLabel={t('Slide','Igalaw')+' '+dir}
      onPress={()=>move(dir)} style={s.direction}><MaterialCommunityIcons name={icons[dir]} size={25} color="#fff2db"/></Pressable>)}</View>
     <View style={s.support}><Pressable style={s.pause} onPress={()=>setHint(v=>!v)}><Text style={s.pauseText}>{t('RULES','PATNUBAY')}</Text></Pressable>
     {run.lastGained>0?<Text style={s.combo}>+{run.lastGained} {t('MERGE!','MERGE!')}</Text>:null}</View>
     {hint?<Text style={s.body}>{t('Move toward your largest tile while keeping free spaces available. The next new tile appears only after a valid move.','Paglapitin ang malalaking tile habang nagtitira ng puwang. May bagong tile lamang kapag may valid move.')}</Text>:null}
   </>}
  </View>;
}
const s=StyleSheet.create({
 shell:{maxWidth:790,width:'100%',alignSelf:'center',padding:12,gap:12},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},headerText:{flex:1},
 eyebrow:{fontSize:10,color:'#e3d7b2',fontWeight:'900'},title:{fontSize:26,color:'#fff0d0',fontWeight:'900'},subtitle:{fontSize:12,color:'#e0e7d9',lineHeight:18},
 scoreBox:{backgroundColor:'#32474c',borderColor:'#cab98f',borderWidth:1,borderRadius:11,alignItems:'center',padding:9},
 score:{color:'#ffe0a5',fontSize:22,fontWeight:'900'},scoreLabel:{color:'#e0d6b9',fontSize:9,fontWeight:'900'},
 panel:{backgroundColor:'#29434a',borderWidth:1,borderColor:'#9ab4a3',padding:16,borderRadius:15,gap:13},
 panelTitle:{color:'#ffecc8',fontSize:21,fontWeight:'900'},body:{color:'#e1ecdf',fontSize:13,lineHeight:21},
 primary:{backgroundColor:'#e7d2a3',padding:13,alignItems:'center',borderRadius:11},primaryText:{color:'#30444b',fontSize:12,fontWeight:'900'},
 final:{color:'#ffe2a3',fontSize:42,fontWeight:'900'},
 stats:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8},
 stat:{color:'#f1e7c7',fontSize:11,fontWeight:'900'},pause:{borderColor:'#b5b89c',borderWidth:1,borderRadius:9,padding:9},
 pauseText:{color:'#e5edda',fontSize:10,fontWeight:'900'},board:{width:'100%',maxWidth:440,alignSelf:'center',gap:5,padding:7,backgroundColor:'#263d47',borderColor:'#b7b292',borderWidth:2,borderRadius:15},
 row:{flexDirection:'row',gap:5},tile:{flex:1,aspectRatio:1,backgroundColor:'#435a57',borderRadius:10,justifyContent:'center',alignItems:'center',gap:1},
 tileFilled:{backgroundColor:'#7d9677',borderColor:'#d3dcad',borderWidth:1},icon:{fontSize:26},
 value:{fontSize:12,color:'#fff9e7',fontWeight:'900'},
 buttons:{flexDirection:'row',justifyContent:'center',flexWrap:'wrap',gap:10},
 direction:{width:65,height:55,alignItems:'center',justifyContent:'center',backgroundColor:'#325f64',borderRadius:10,borderColor:'#adc6b5',borderWidth:1},
 support:{justifyContent:'center',alignItems:'center',flexDirection:'row',gap:15},
 combo:{color:'#ffe1a0',fontSize:13,fontWeight:'900'},
});
