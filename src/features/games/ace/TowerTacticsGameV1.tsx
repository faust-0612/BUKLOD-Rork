import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {TOWER_TYPES,TOWER_LEVELS,createTowerRound,placeTower,upgradeTower,advanceTowerTurn,type TowerRound,type TowerType} from './towerTacticsRules';
type Props={onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
const OPTIONS:[TowerType,string][]=[['archer','🏹'],['cannon','💣'],['scout','🔭']];
export function TowerTacticsGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready');
 const phaseRef=useRef<typeof phase>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<TowerRound>(()=>createTowerRound(0)),ref=useRef(createTowerRound(0));
 const [selected,setSelected]=useState<TowerType>('archer');
 const [total,setTotal]=useState(0),scoreRef=useRef(0);
 const [retries,setRetries]=useState(0),retriesRef=useRef(0);
 const [message,setMessage]=useState('');
 const finished=useRef(false),receipt=useRef('');
 const change=(v:typeof phase)=>{phaseRef.current=v;setPhase(v);};
 const begin=useCallback((next:number,keepRetries=false)=>{
  const fresh=createTowerRound(next);ref.current=fresh;setRun(fresh);setLevel(next);
  setSelected('archer');if(!keepRetries){setRetries(0);retriesRef.current=0;}
  change('playing');setMessage(t('Place towers beside the central road; then advance the wave one turn at a time.','Maglagay ng tower sa tabi ng gitnang daan at mag-advance ng isang turn bawat pindot.'));
  void playBuklodGameFeedback('move');
 },[t]);
 const start=useCallback(()=>{
  scoreRef.current=0;setTotal(0);finished.current=false;
  receipt.current='tw-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  begin(0);
 },[begin]);
 const finish=useCallback((status:'won'|'lost',score:number)=>{
  if(finished.current)return;finished.current=true;change(status);
  const stars:0|1|2|3=status==='lost'?0:retriesRef.current===0?3:retriesRef.current===1?2:1;
  onFinish?.({gameId:'ace-tower-tactics',status,score,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[onFinish]);
 const click=(row:number,col:number)=>{
  if(phaseRef.current!=='playing')return;
  const before=ref.current,tower=before.towers.find(v=>v.row===row&&v.col===col);
  const next=tower?upgradeTower(before,tower.id):placeTower(before,row,col,selected);
  if(next===before){
   setMessage(t('Cannot place/upgrade here. Check the road, funds and occupied cells.','Hindi puwede rito. Tingnan ang daan, budget at mga occupied cell.'));
   void playBuklodGameFeedback('impact');return;
  }
  ref.current=next;setRun(next);void playBuklodGameFeedback('collect');
  setMessage(t(tower?'Tower upgraded.':'Tower placed. Plan your next step.',tower?'Na-upgrade ang tower.':'Nailagay ang tower. Magplano ng susunod na hakbang.'));
 };
 const turn=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const next=advanceTowerTurn(ref.current);ref.current=next;setRun(next);
  void playBuklodGameFeedback(next.kills>run.kills?'collect':'move');
  if(next.status==='won'){
   scoreRef.current+=next.score;setTotal(scoreRef.current);
   if(level===TOWER_LEVELS.length-1)finish('won',scoreRef.current);
   else change('clear');
  }else if(next.status==='lost'){
   const attempt=retriesRef.current+1;retriesRef.current=attempt;setRetries(attempt);
   if(attempt>=3)finish('lost',scoreRef.current);else change('retry');
  }
 },[finish,level,run.kills]);
 const enemiesTotal=TOWER_LEVELS[level].wave.length;
 return <View style={s.root}>
  <View style={s.head}><View style={s.headText}><Text style={s.eyebrow}>ACE • STRATEGY FORTRESS</Text>
   <Text style={s.title}>TOWER TACTICS</Text><Text style={s.subtitle}>{t('Defend the fortress one calculated turn at a time.','Ipagtanggol ang kuta sa bawat maingat na turn.')}</Text>
  </View><View style={s.scoreBox}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Three fortress defense battles','Tatlong laban para sa kuta')}</Text>
   <Text style={s.body}>{t('Place archers, cannons or scouts on the 7×7 field outside the center road. Towers shoot automatically during each NEXT TURN. Enemies move one road square each turn. Towers cost funds and can be upgraded by tapping an existing tower. Defeat the wave while keeping the fortress alive. Three tries per battlefield.',
    'Maglagay ng archer, cannon o scout sa 7×7 field sa labas ng gitnang daan. Babaril ang mga tower sa bawat NEXT TURN at uusad ang mga kalaban. May presyo ang bawat tower at puwedeng i-upgrade sa pag-tap. Ubusin ang wave at panatilihing buhay ang kuta. Tatlong subok kada laban.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('DEFEND THE FORTRESS','IPAGTANGGOL ANG KUTA')}</Text></Pressable></View>
  :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Defense paused','Naka-pause')}</Text>
   <Pressable onPress={()=>change('playing')} style={s.primary}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
  :phase==='clear'||phase==='retry'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='clear'?t('WAVE DEFEATED!','NALUPIG ANG WAVE!'):t('FORTRESS BREACHED','NASIRA ANG DEPENSA')}</Text>
   <Text style={s.body}>{phase==='clear'?t('More enemies await in the next battlefield.','May mas malakas na kalaban sa susunod.'):t('Move the towers closer to the road and manage your credits.','Ilapit sa daan ang mga tower at ayusin ang budget.')}</Text>
   <Pressable onPress={()=>begin(phase==='clear'?level+1:level,phase==='retry')} style={s.primary}><Text style={s.primaryText}>{phase==='clear'?t('NEXT WAVE','SUSUNOD NA WAVE'):t('RETRY BATTLE','ULITIN ANG LABAN')}</Text></Pressable></View>
  :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('FORTRESS CHAMPION!','KAMPEON NG KUTA!'):t('BATTLE ENDED','TAPOS ANG LABAN')}</Text>
   <Text style={s.final}>{total}</Text><Text style={s.body}>{t('Game mastery only; no Character Points, cash or redeemable rewards.','Mastery score lamang; walang Character Points, cash o redeemable reward.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
  :<>
   <View style={s.stats}><Text style={s.stat}>{t('BATTLE','LABAN')} {level+1}/3</Text>
    <Text style={s.stat}>🏰 {run.health}</Text><Text style={s.stat}>🪙 {run.credits}</Text>
    <Text style={s.stat}>{t('DEFEATED','TALO')}: {run.kills}/{enemiesTotal}</Text>
    <Pressable onPress={()=>change('paused')} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <View style={s.shop}>{OPTIONS.map(([type,emoji])=><Pressable key={type} onPress={()=>setSelected(type)}
     style={[s.shopItem,selected===type&&s.shopSelected]}>
     <Text style={s.shopEmoji}>{emoji}</Text>
     <Text style={s.shopName}>{type.toUpperCase()}</Text>
     <Text style={s.shopCost}>🪙 {TOWER_TYPES[type].cost} • RNG {TOWER_TYPES[type].range}</Text>
   </Pressable>)}</View>
   <View style={s.board}>{Array.from({length:7},(_,row)=><View key={row} style={s.row}>
    {Array.from({length:7},(_,col)=>{
     const road=row===3,tower=run.towers.find(v=>v.row===row&&v.col===col);
     const onRoad=road?run.enemies.filter(e=>e.step===col):[];
     return <Pressable key={col} accessibilityRole="button" disabled={road}
      accessibilityLabel={tower?'Upgrade '+tower.type+' tower':road?'Enemy road':'Place '+selected+' tower'}
      onPress={()=>click(row,col)} style={[s.cell,road&&s.road,tower&&s.towerCell]}>
      {tower?<Text style={s.icon}>{tower.type==='cannon'?'💣':tower.type==='archer'?'🏹':'🔭'}{tower.level===2?'★':''}</Text>
      :onRoad.length?<View style={s.enemyCell}><Text style={s.enemy}>👹</Text><Text style={s.hp}>{onRoad.reduce((sum,e)=>sum+e.hp,0)}</Text></View>
      :road?<Text style={s.roadText}>{col===6?'🏰':'·'}</Text>:null}
     </Pressable>;
    })}</View>)}</View>
   <Text style={s.message}>{t('TURN','TURNO')} {run.turn} • {t('SPAWNED','LUMABAS')} {run.nextEnemy}/{enemiesTotal}
     {'  •  '}{t('LIVE ENEMIES','BUHAY NA KALABAN')} {run.enemies.length}</Text>
   <Pressable onPress={turn} style={s.primary}><Text style={s.primaryText}>{t('ADVANCE ONE TURN','ISANG TURNO PASULONG')}</Text></Pressable>
   {!!message?<Text style={s.notice}>{message}</Text>:null}
  </>}
 </View>;
}
const s=StyleSheet.create({
 root:{maxWidth:850,alignSelf:'center',width:'100%',padding:12,gap:12},
 head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:9},headText:{flex:1},
 eyebrow:{fontSize:10,color:'#e9d3a8',fontWeight:'900'},title:{fontSize:26,color:'#fff1d0',fontWeight:'900'},subtitle:{fontSize:12,color:'#e1e1d3'},
 scoreBox:{borderColor:'#cbb491',borderWidth:1,backgroundColor:'#3d4650',borderRadius:11,padding:9,alignItems:'center'},
 score:{color:'#ffe0ad',fontSize:23,fontWeight:'900'},scoreLabel:{color:'#e4dbc8',fontSize:9,fontWeight:'900'},
 panel:{borderColor:'#9eada0',borderWidth:1,backgroundColor:'#303f51',padding:17,borderRadius:14,gap:13},
 panelTitle:{fontSize:21,color:'#ffedc9',fontWeight:'900'},body:{fontSize:13,lineHeight:21,color:'#e2e7e1'},
 primary:{backgroundColor:'#e6d2a5',padding:13,alignItems:'center',borderRadius:11},
 primaryText:{fontSize:12,color:'#35414a',fontWeight:'900'},final:{color:'#ffe1a5',fontSize:42,fontWeight:'900'},
 stats:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:9,alignItems:'center'},
 stat:{fontSize:11,color:'#e9e6cf',fontWeight:'900'},minor:{borderWidth:1,borderColor:'#b7baad',padding:8,borderRadius:8},
 minorText:{fontSize:10,color:'#e4e9df',fontWeight:'900'},shop:{flexDirection:'row',flexWrap:'wrap',gap:8},
 shopItem:{minWidth:100,flex:1,alignItems:'center',padding:9,borderColor:'#647c8a',borderWidth:1,backgroundColor:'#2d4a5a',borderRadius:10},
 shopSelected:{borderColor:'#ffe3a6',backgroundColor:'#546778'},shopEmoji:{fontSize:26},shopName:{fontSize:10,color:'#e8e6da',fontWeight:'900'},
 shopCost:{fontSize:9,color:'#d3d9ce',fontWeight:'700'},
 board:{width:'100%',maxWidth:480,alignSelf:'center',backgroundColor:'#283e49',borderWidth:2,borderColor:'#9ab39c',borderRadius:15,padding:6,gap:2},
 row:{flexDirection:'row',gap:2},cell:{flex:1,aspectRatio:1,backgroundColor:'#588074',borderRadius:4,alignItems:'center',justifyContent:'center'},
 road:{backgroundColor:'#b3a07d',borderColor:'#e0cba8',borderWidth:1},towerCell:{backgroundColor:'#405f70',borderColor:'#ffe5ac',borderWidth:1},
 icon:{fontSize:17},enemyCell:{alignItems:'center'},enemy:{fontSize:18},hp:{fontSize:10,color:'#482d2d',fontWeight:'900'},roadText:{fontSize:19,color:'#7e6956'},
 message:{textAlign:'center',color:'#e2e7d2',fontSize:11,fontWeight:'900'},notice:{color:'#e4e7d7',textAlign:'center',fontSize:12,lineHeight:18},
});
