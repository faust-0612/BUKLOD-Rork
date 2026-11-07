import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,Line,Text as SvgText} from 'react-native-svg';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {EXPEDITION_MAPS,createExpeditionRun,moveExpedition,expeditionNeighbors,type ExpeditionRun} from './expeditionPuzzleRules';
type Props={onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
export function ExpeditionPuzzleGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready');
 const phaseRef=useRef<typeof phase>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<ExpeditionRun>(()=>createExpeditionRun(0)),ref=useRef(createExpeditionRun(0));
 const [total,setTotal]=useState(0),scoreRef=useRef(0);
 const [attempts,setAttempts]=useState(0),attemptRef=useRef(0);
 const [message,setMessage]=useState('');
 const completed=useRef(false),receipt=useRef('');
 const phaseSet=(v:typeof phase)=>{phaseRef.current=v;setPhase(v);};
 const startLevel=useCallback((nextLevel:number,keepAttempt=false)=>{
  const fresh=createExpeditionRun(nextLevel);ref.current=fresh;setRun(fresh);setLevel(nextLevel);
  if(!keepAttempt){attemptRef.current=0;setAttempts(0);}
  setMessage(t('Choose a neighboring stop. Complete all objectives before reaching the exit.',
   'Pumili ng katabing lugar. Kumpletuhin ang mga misyon bago tumungo sa labasan.'));
  phaseSet('playing');void playBuklodGameFeedback('move');
 },[t]);
 const start=useCallback(()=>{
  scoreRef.current=0;setTotal(0);completed.current=false;
  receipt.current='ex-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,13);
  startLevel(0);
 },[startLevel]);
 const finish=useCallback((status:'won'|'lost',score:number)=>{
  if(completed.current)return;completed.current=true;phaseSet(status);
  const stars:0|1|2|3=status==='lost'?0:attemptRef.current===0?3:attemptRef.current===1?2:1;
  onFinish?.({gameId:'niel-expedition-puzzle',status,score,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[onFinish]);
 const travel=useCallback((nextNode:number)=>{
  if(phaseRef.current!=='playing')return;
  const before=ref.current,after=moveExpedition(before,nextNode);
  if(after===before){
   setMessage(t('This path is inaccessible or supplies are insufficient.',
   'Hindi madaanan ang daang iyon o kulang ang supplies.'));
   void playBuklodGameFeedback('impact');return;
  }
  ref.current=after;setRun(after);
  void playBuklodGameFeedback('move');
  if(after.status==='won'){
   scoreRef.current+=after.score;setTotal(scoreRef.current);
   if(level===EXPEDITION_MAPS.length-1)finish('won',scoreRef.current);
   else{phaseSet('clear');void playBuklodGameFeedback('success');}
  }else if(after.status==='lost'){
   const tries=attemptRef.current+1;attemptRef.current=tries;setAttempts(tries);
   if(tries>=3)finish('lost',scoreRef.current);
   else{phaseSet('retry');setMessage(t('The route exhausted safety margins.','Naubos ang ligtas na supplies sa ruta.'));}
  }else{
   const cfg=EXPEDITION_MAPS[level];
   setMessage(nextNode===cfg.exit?t('Objectives are still missing; plan a safe return.','May kulang pang misyon. Bumalik sa ligtas na daan.'):
    t('Reached waypoint. Review the remaining supplies.','Narating ang waypoint. Suriin ang natitirang supplies.'));
  }
 },[finish,level,t]);
 const cfg=EXPEDITION_MAPS[level],neighbors=expeditionNeighbors(run);
 const targetDone=cfg.required.filter(id=>run.visited.includes(id)).length;
 const x=(n:number)=>cfg.nodes[n]?.name??'Unknown';
 return <View style={s.root}>
 <View style={s.head}><View style={s.headCopy}><Text style={s.eyebrow}>NIEL • MISSION FRONTIER</Text>
  <Text style={s.title}>EXPEDITION PUZZLE</Text>
  <Text style={s.subtitle}>{t('Plan safe routes, protect supplies and reach the base.','Planuhin ang ruta at ingatan ang supplies.')}</Text></View>
  <View style={s.scoreBox}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
 {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Three finite expedition missions','Tatlong misyon ng ekspedisyon')}</Text>
  <Text style={s.body}>{t('Visit the named mission stops before reaching the Exit. Each connection spends food, water and sometimes safety risk. Plan a path that keeps supplies above zero. Early exits do not count until all objectives are reached. Your route score rewards remaining supplies and safety. Up to three attempts per mission.',
   'Bisitahin muna ang lahat ng mission stop bago pumunta sa Exit. Ang bawat daan ay gumagamit ng pagkain, tubig at minsan safety risk. Magplanong hindi mauubusan ng supplies. Hindi pa panalo kapag kulang ang objective. Hanggang tatlong pagtatangka bawat misyon.')}</Text>
  <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('BEGIN EXPEDITION','SIMULAN ANG MISYON')}</Text></Pressable></View>
 :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Mission paused','Naka-pause ang misyon')}</Text>
  <Pressable onPress={()=>phaseSet('playing')} style={s.primary}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
 :phase==='clear'||phase==='retry'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='clear'?t('MISSION COMPLETE!','KUMPLETO ANG MISYON!'):t('MISSION UNSAFE','HINDI LIGTAS ANG MISYON')}</Text>
  <Text style={s.body}>{phase==='clear'?t('A new frontier opens.','May bagong lugar na bubuksan.'):t('Try a better route with lower supply costs.','Subukan ang mas ligtas at matipid na ruta.')}</Text>
  <Pressable onPress={()=>startLevel(phase==='clear'?level+1:level,phase==='retry')} style={s.primary}><Text style={s.primaryText}>{phase==='clear'?t('NEXT MISSION','SUSUNOD NA MISYON'):t('RETRY MISSION','ULITIN ANG MISYON')}</Text></Pressable></View>
 :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('FRONTIER EXPERT!','MASTER NG EKSPEDISYON!'):t('EXPEDITION ENDED','TAPOS ANG EKSPEDISYON')}</Text>
  <Text style={s.final}>{total}</Text><Text style={s.body}>{t('Offline mastery score only. No Character Points, cash or redeemable rewards.','Mastery score lamang. Walang Character Points, cash o redeemable reward.')}</Text>
  <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
 :<>
  <View style={s.stats}><Text style={s.stat}>{t('MISSION','MISYON')} {level+1}/3</Text><Text style={s.stat}>🥖 {run.food}</Text><Text style={s.stat}>💧 {run.water}</Text>
   <Text style={s.stat}>⚠ {run.risk}/{cfg.maxRisk}</Text><Pressable onPress={()=>phaseSet('paused')} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
  <Text style={s.targets}>{t('OBJECTIVES','MGA LAYUNIN')}: {cfg.required.map(id=>(run.visited.includes(id)?'✓ ':'○ ')+x(id)).join(' • ')} ({targetDone}/{cfg.required.length})</Text>
  <View style={s.mapFrame}><Svg width="100%" height={235} viewBox="0 0 370 240">
    {cfg.edges.map(edge=>{
     const a=cfg.nodes[edge.a],b=cfg.nodes[edge.b];
     const visited=run.history.some((node,i)=>i>0&&((node===a.id&&run.history[i-1]===b.id)||(node===b.id&&run.history[i-1]===a.id)));
     return <Line key={edge.a+'-'+edge.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
      stroke={visited?'#ffd890':'#8bbcaf'} strokeWidth={visited?5:3} strokeDasharray={edge.risk?'5 3':undefined}/>;
    })}
    {cfg.nodes.map(node=>{
     const current=run.position===node.id,visited=run.visited.includes(node.id),required=cfg.required.includes(node.id);
     return <React.Fragment key={node.id}>
      <Circle cx={node.x} cy={node.y} r={current?19:15}
       fill={current?'#fff0ba':visited?'#75ad94':required?'#426b7b':'#294d67'} stroke={current?'#e2b766':'#b9ded4'} strokeWidth={2}/>
      <SvgText x={node.x} y={node.y+4} fontSize={11} fontWeight="bold" textAnchor="middle" fill={current?'#324b49':'#f3eddb'}>{node.id}</SvgText>
      <SvgText x={node.x} y={node.y-23} fontSize={9} textAnchor="middle" fill="#f4e9ce">{node.name}</SvgText>
     </React.Fragment>;
    })}
  </Svg></View>
  <Text style={s.current}>{t('CURRENT STOP','KASALUKUYANG LUGAR')}: {x(run.position)}</Text>
  <Text style={s.nextLabel}>{t('AVAILABLE ROUTES — choose one','MGA MAAARING DAAN — pumili')}</Text>
  <View style={s.routes}>{neighbors.map(({node,edge})=><Pressable key={node.id} onPress={()=>travel(node.id)}
    accessibilityRole="button" accessibilityLabel={'Travel to '+node.name}
    style={s.route}><Text style={s.routeTitle}>{node.name} <MaterialCommunityIcons name="arrow-right" size={14} color="#f0e1c3"/></Text>
    <Text style={s.routeCost}>🥖 {edge.food} • 💧 {edge.water} • ⚠ {edge.risk}</Text>
   </Pressable>)}</View>
  {!!message?<Text style={s.notice}>{message}</Text>:null}
 </>}
 </View>;
}
const s=StyleSheet.create({
 root:{maxWidth:820,width:'100%',alignSelf:'center',padding:12,gap:12},
 head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},headCopy:{flex:1},
 eyebrow:{fontSize:10,color:'#d5e0c3',fontWeight:'900'},
 title:{color:'#fff1d4',fontSize:25,fontWeight:'900'},subtitle:{color:'#dae9de',fontSize:12},
 scoreBox:{borderWidth:1,borderColor:'#b7c8ac',backgroundColor:'#2e4853',padding:9,borderRadius:10,alignItems:'center'},
 score:{fontSize:22,fontWeight:'900',color:'#ffdfaa'},scoreLabel:{fontSize:9,color:'#e1e1ce',fontWeight:'900'},
 panel:{padding:17,borderWidth:1,borderColor:'#92b5ac',backgroundColor:'#2c4553',borderRadius:15,gap:13},
 panelTitle:{fontSize:21,color:'#ffebc7',fontWeight:'900'},body:{fontSize:13,lineHeight:21,color:'#e2eae0'},
 primary:{backgroundColor:'#ded5a8',borderRadius:11,padding:13,alignItems:'center'},
 primaryText:{color:'#36514d',fontSize:12,fontWeight:'900'},final:{fontSize:43,color:'#ffdf9f',fontWeight:'900'},
 stats:{flexDirection:'row',gap:8,flexWrap:'wrap',alignItems:'center',justifyContent:'space-between'},
 stat:{color:'#e7f0d9',fontSize:11,fontWeight:'900'},
 minor:{borderColor:'#b8d0bc',borderWidth:1,borderRadius:9,padding:9},minorText:{color:'#e7f0df',fontSize:10,fontWeight:'900'},
 targets:{color:'#d9ebd6',fontSize:11,fontWeight:'700',lineHeight:18},
 mapFrame:{width:'100%',maxWidth:490,alignSelf:'center',borderRadius:14,backgroundColor:'#1c3d50',borderWidth:2,borderColor:'#8fac9e',padding:4},
 current:{color:'#ffdfac',fontSize:13,fontWeight:'900',textAlign:'center'},
 nextLabel:{color:'#e3ead2',fontSize:11,fontWeight:'900',textAlign:'center'},
 routes:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},
 route:{borderWidth:1,borderColor:'#b5d3b6',borderRadius:9,padding:10,backgroundColor:'#32635f',minWidth:95},
 routeTitle:{color:'#fff2da',fontSize:12,fontWeight:'900'},routeCost:{color:'#dcebd4',fontSize:10,marginTop:4},
 notice:{color:'#dce5da',fontSize:12,lineHeight:18,textAlign:'center'},
});
