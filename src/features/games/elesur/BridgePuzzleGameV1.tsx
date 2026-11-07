import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,Line,Text as SvgText} from 'react-native-svg';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {BRIDGE_LEVELS,bridgeDegrees,bridgeIsConnected,createBridgeRound,setBridge,undoBridge,hintBridge,type BridgeRun,type BridgeEdge} from './bridgePuzzleRules';
type Props={onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
const abc=(id:number)=>String.fromCharCode(65+id);
const xy=(x:number)=>45+x*65;
const edgeLines=(edge:BridgeEdge,run:BridgeRun)=>{
 const a=run.nodes[edge.a],b=run.nodes[edge.b],offsets=edge.count===2?[-4,4]:[0];
 return offsets.map((offset,i)=>{
  const horizontal=edge.axis==='h';
  return <Line key={edge.id+'-'+i} x1={xy(a.x)+(horizontal?0:offset)} y1={xy(a.y)+(horizontal?offset:0)}
   x2={xy(b.x)+(horizontal?0:offset)} y2={xy(b.y)+(horizontal?offset:0)}
   stroke="#f2d69c" strokeWidth={4} strokeLinecap="round"/>;
 });
};
export function BridgePuzzleGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready'),phaseRef=useRef<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<BridgeRun>(()=>createBridgeRound(0)),ref=useRef(createBridgeRound(0));
 const [total,setTotal]=useState(0),scoreRef=useRef(0);
 const [attempts,setAttempts]=useState(0),attemptRef=useRef(0);
 const [message,setMessage]=useState('');
 const finished=useRef(false),receipt=useRef('');
 const phaseSet=(next:typeof phase)=>{phaseRef.current=next;setPhase(next);};
 const begin=useCallback((nextLevel:number,keepAttempts=false)=>{
  const fresh=createBridgeRound(nextLevel);ref.current=fresh;setRun(fresh);setLevel(nextLevel);
  if(!keepAttempts){attemptRef.current=0;setAttempts(0);}
  setMessage(t('Connect every island. Match the number on each island with the total bridge lines.',
   'Ikonekta lahat ng isla. Itugma ang numero sa kabuuang guhit ng tulay.'));
  phaseSet('playing');void playBuklodGameFeedback('move');
 },[t]);
 const start=useCallback(()=>{
  scoreRef.current=0;setTotal(0);finished.current=false;
  receipt.current='br-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  begin(0);
 },[begin]);
 const finish=useCallback((status:'won'|'lost',score:number)=>{
  if(finished.current)return;finished.current=true;phaseSet(status);
  const stars:0|1|2|3=status==='lost'?0:attemptRef.current===0?3:attemptRef.current===1?2:1;
  onFinish?.({gameId:'elesur-bridge-puzzle',status,score,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[onFinish]);
 const assess=useCallback((next:BridgeRun)=>{
  ref.current=next;setRun(next);
  if(next.status==='won'){
   scoreRef.current+=next.score;setTotal(scoreRef.current);
   if(level===BRIDGE_LEVELS.length-1)finish('won',scoreRef.current);
   else{phaseSet('clear');void playBuklodGameFeedback('success');}
  }else if(next.status==='lost'){
   const tries=attemptRef.current+1;attemptRef.current=tries;setAttempts(tries);
   if(tries>=3)finish('lost',scoreRef.current);
   else phaseSet('retry');
  }
 },[finish,level]);
 const edit=useCallback((id:string,delta:number)=>{
  if(phaseRef.current!=='playing')return;
  const e=ref.current.edges.find(x=>x.id===id);if(!e)return;
  const nextCount=e.count+delta;if(nextCount<0||nextCount>2)return;
  const previous=ref.current,next=setBridge(previous,id,nextCount);
  if(previous===next){
   setMessage(t('Bridge rejected: too much load or a crossing with another bridge.',
    'Hindi puwede: lampas sa limit ng isla o tatawid sa ibang tulay.'));
   void playBuklodGameFeedback('impact');return;
  }
  assess(next);void playBuklodGameFeedback('move');
 },[assess,t]);
 const undo=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const previous=ref.current,next=undoBridge(previous);
  if(previous!==next){assess(next);void playBuklodGameFeedback('move');}
 },[assess]);
 const hint=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const previous=ref.current,next=hintBridge(previous);
  if(previous===next){setMessage(t('No safe hint from this arrangement. Undo a bridge first.',
    'Walang ligtas na clue sa ngayon. Bawiin muna ang isang tulay.'));return;}
  assess(next);void playBuklodGameFeedback('collect');
 },[assess,t]);
 const degrees=bridgeDegrees(run),ready=bridgeIsConnected(run);
 const cfg=BRIDGE_LEVELS[level];
 return <View style={s.root}>
  <View style={s.header}><View style={s.headingText}><Text style={s.eyebrow}>ELESUR • HIGHLAND COMMUNITY</Text>
   <Text style={s.title}>BRIDGE PUZZLE</Text>
   <Text style={s.subtitle}>{t('Build safe connections across the highlands.','Bumuo ng ligtas na mga tulay sa kabundukan.')}</Text></View>
   <View style={s.scoreBox}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Connect three highland communities','Ikonekta ang tatlong pamayanan')}</Text>
   <Text style={s.body}>{t('Every island displays its required number of bridge lines. Use + or − beside each allowed pair to add or remove up to two lines. All islands must match their numbers AND be connected together. Bridges may not cross, run through islands or overload an endpoint. Three stages, with undo and optional hints.',
    'Ang numero sa isla ang dami ng tulay na kailangan. Gamitin ang + o − sa bawat koneksiyon, hanggang dalawang guhit. Dapat tugma ang lahat ng numero at magkakakonekta ang mga isla. Bawal magkrus, dumaan sa isla o sumobra sa kapasidad. May undo at hint.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('BUILD THE BRIDGES','SIMULAN ANG MGA TULAY')}</Text></Pressable></View>
  :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Paused','Naka-pause')}</Text>
   <Pressable onPress={()=>phaseSet('playing')} style={s.primary}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
  :phase==='clear'||phase==='retry'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='clear'?t('COMMUNITY CONNECTED!','KONEKTADO ANG PAMAYANAN!'):t('NO MOVES LEFT','UBOS NA ANG MOVES')}</Text>
   <Pressable onPress={()=>begin(phase==='clear'?level+1:level,phase==='retry')} style={s.primary}><Text style={s.primaryText}>{phase==='clear'?t('NEXT BRIDGE','SUSUNOD NA TULAY'):t('RETRY','ULITIN')}</Text></Pressable></View>
  :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('MASTER BRIDGE BUILDER!','MASTER NG MGA TULAY!'):t('PROJECT INCOMPLETE','HINDI NATAPOS ANG PROYEKTO')}</Text>
   <Text style={s.final}>{total}</Text>
   <Text style={s.body}>{t('Game score only. No Character Points or redeemable rewards were granted.','Score lamang ng laro. Walang Character Points o redeemable rewards.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
  :<>
   <View style={s.stats}><Text style={s.stat}>{t('STAGE','YUGTO')} {level+1}/3</Text>
    <Text style={s.stat}>{t('MOVES','GALAW')} {run.moves}/{cfg.maxMoves}</Text>
    <Text style={s.stat}>{ready?'✓ CONNECTED':'○ UNCONNECTED'}</Text>
    <Pressable onPress={()=>phaseSet('paused')} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <View style={s.diagram}><Svg width="100%" height={355} viewBox="0 0 360 360">
    {run.edges.filter(edge=>edge.count>0).flatMap(edge=>edgeLines(edge,run))}
    {run.nodes.map(node=>{
     const current=degrees[node.id],complete=current===node.target;
     return <React.Fragment key={node.id}>
      <Circle cx={xy(node.x)} cy={xy(node.y)} r={20} fill={complete?'#76a87c':'#d5be89'} stroke="#fff4d1" strokeWidth={3}/>
      <SvgText x={xy(node.x)} y={xy(node.y)+4} fontSize={14} textAnchor="middle" fontWeight="bold" fill="#2c4c4a">{node.target}</SvgText>
      <SvgText x={xy(node.x)} y={xy(node.y)-27} fontSize={10} textAnchor="middle" fill="#fcf0ce">{abc(node.id)}</SvgText>
     </React.Fragment>;
    })}
   </Svg></View>
   <Text style={s.bridgeHeading}>{t('BRIDGE CONNECTIONS','MGA KONEKSIYON')}</Text>
   <View style={s.routes}>{run.edges.map(edge=><View key={edge.id} style={s.edge}>
    <Text style={s.edgeName}>{abc(edge.a)} — {abc(edge.b)}</Text>
    <Pressable onPress={()=>edit(edge.id,-1)} accessibilityRole="button" accessibilityLabel={'Remove bridge '+edge.id} style={s.adjust}><MaterialCommunityIcons name="minus" size={17} color="#ecdfc3"/></Pressable>
    <Text style={s.amount}>{edge.count}/2</Text>
    <Pressable onPress={()=>edit(edge.id,1)} accessibilityRole="button" accessibilityLabel={'Add bridge '+edge.id} style={s.adjust}><MaterialCommunityIcons name="plus" size={17} color="#ecdfc3"/></Pressable>
   </View>)}</View>
   <View style={s.actions}>
    <Pressable disabled={!run.history.length} onPress={undo} style={[s.minor,!run.history.length&&s.disabled]}><Text style={s.minorText}>{t('UNDO','BAWI')}</Text></Pressable>
    <Pressable onPress={hint} style={s.minor}><Text style={s.minorText}>{t('HINT','CLUE')} ({run.hints})</Text></Pressable>
   </View>
   {!!message?<Text style={s.notice}>{message}</Text>:null}
  </>}
 </View>;
}
const s=StyleSheet.create({
 root:{maxWidth:830,width:'100%',alignSelf:'center',padding:12,gap:12},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},headingText:{flex:1},
 eyebrow:{fontSize:10,color:'#cfe2d7',fontWeight:'900'},title:{fontSize:26,color:'#fff0c7',fontWeight:'900'},
 subtitle:{fontSize:12,color:'#dce8d8',lineHeight:18},
 scoreBox:{backgroundColor:'#314b4d',borderWidth:1,borderColor:'#c0be8e',borderRadius:10,padding:10,alignItems:'center'},
 score:{fontSize:23,color:'#ffe0a3',fontWeight:'900'},scoreLabel:{fontSize:9,color:'#dfe4c9',fontWeight:'900'},
 panel:{backgroundColor:'#2a4545',borderColor:'#90aba2',borderWidth:1,borderRadius:15,padding:17,gap:13},
 panelTitle:{fontSize:22,color:'#ffe6bc',fontWeight:'900'},body:{fontSize:13,color:'#dfece1',lineHeight:21},
 primary:{backgroundColor:'#e5d2a4',padding:13,borderRadius:10,alignItems:'center'},
 primaryText:{fontSize:12,color:'#294543',fontWeight:'900'},final:{color:'#ffe2a5',fontSize:42,fontWeight:'900'},
 stats:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:9},
 stat:{fontSize:11,color:'#e3ebdb',fontWeight:'900'},minor:{borderWidth:1,borderColor:'#c3caa3',borderRadius:9,padding:9},
 minorText:{fontSize:10,color:'#f5e9d5',fontWeight:'900'},
 diagram:{width:'100%',alignSelf:'center',maxWidth:440,backgroundColor:'#1d3e4c',borderColor:'#9ab59d',borderWidth:2,borderRadius:15,overflow:'hidden'},
 bridgeHeading:{color:'#f3eacb',fontSize:12,fontWeight:'900',textAlign:'center'},
 routes:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:7},
 edge:{flexDirection:'row',alignItems:'center',gap:7,borderWidth:1,borderColor:'#92b4a4',backgroundColor:'#365d57',padding:6,borderRadius:9},
 edgeName:{color:'#faefda',fontSize:11,fontWeight:'900'},
 adjust:{backgroundColor:'#234e54',borderColor:'#afc9bb',borderWidth:1,borderRadius:6,padding:6},
 amount:{color:'#ffdeaa',fontSize:12,fontWeight:'900',minWidth:25,textAlign:'center'},
 actions:{flexDirection:'row',justifyContent:'center',gap:12},
 disabled:{opacity:.4},notice:{fontSize:12,color:'#e6ecdd',textAlign:'center',lineHeight:18},
});
