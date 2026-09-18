import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import { BuklodGameText as Text } from '../runtime/BuklodGameLanguage';
import type { BuklodGameResult } from '../types';

type TileType='empty'|'clue'|'cache'|'hazard'|'relic';
type Pos={r:number;c:number};
const GAME_ID='quin-discovery-expedition';
const SIZE=5;
const START:Pos={r:4,c:0};
const RELIC:Pos={r:0,c:4};
const CLUES:Pos[]=[{r:3,c:1},{r:2,c:3},{r:1,c:2}];
const CACHES:Pos[]=[{r:4,c:3},{r:1,c:0}];
const HAZARDS:Pos[]=[{r:3,c:3},{r:2,c:1},{r:0,c:2}];
const key=(p:Pos)=>`${p.r}-${p.c}`;
const same=(a:Pos,b:Pos)=>a.r===b.r&&a.c===b.c;
const valid=(r:number,c:number)=>r>=0&&r<SIZE&&c>=0&&c<SIZE;
const adjacent=(p:Pos):Pos[]=>[[p.r-1,p.c],[p.r+1,p.c],[p.r,p.c-1],[p.r,p.c+1]].filter(([r,c])=>valid(r,c)).map(([r,c])=>({r,c}));
const typeAt=(p:Pos):TileType=>same(p,RELIC)?'relic':CLUES.some(x=>same(x,p))?'clue':CACHES.some(x=>same(x,p))?'cache':HAZARDS.some(x=>same(x,p))?'hazard':'empty';
const starsForScore=(score:number):1|2|3=>score>=1550?3:score>=1150?2:1;

type Props={onFinish?:(result:BuklodGameResult)=>void};
export function DiscoveryExpeditionGameV1({onFinish}:Props){
 const [pos,setPos]=useState<Pos>(START),[energy,setEnergy]=useState(14),[clues,setClues]=useState(0),[score,setScore]=useState(0),[revealed,setRevealed]=useState<Set<string>>(new Set([key(START),...adjacent(START).map(key)])),[visited,setVisited]=useState<Set<string>>(new Set([key(START)])),[finished,setFinished]=useState(false),[message,setMessage]=useState('Explore the hidden grid, collect enough clues, protect expedition energy, and locate the relic before the map goes dark.');
 const distanceToRelic=Math.abs(pos.r-RELIC.r)+Math.abs(pos.c-RELIC.c);
 const clueHint=clues===0?'No directional evidence yet.':clues===1?`First clue: the relic lies mostly ${RELIC.r<pos.r?'north':'south'} of your position.`:clues===2?`Second clue: move ${RELIC.c>pos.c?'east':'west'} while preserving energy.`:`Relic signature is close: ${distanceToRelic} grid steps away.`;
 const neighbors=useMemo(()=>adjacent(pos),[pos]);
 const move=useCallback((next:Pos)=>{
  if(finished||!neighbors.some(n=>same(n,next)))return;
  let nextEnergy=energy-1;let nextClues=clues;let nextScore=score+25;let nextMessage='New ground mapped.';const tile=typeAt(next);const firstVisit=!visited.has(key(next));
  if(firstVisit&&tile==='clue'){nextClues++;nextScore+=220;nextMessage='Discovery clue recovered. The relic location is becoming clearer.';void playBuklodGameFeedback('collect');}
  else if(firstVisit&&tile==='cache'){nextEnergy+=3;nextScore+=130;nextMessage='Supply cache found: +3 expedition energy.';void playBuklodGameFeedback('collect');}
  else if(firstVisit&&tile==='hazard'){nextEnergy-=2;nextScore=Math.max(0,nextScore-70);nextMessage='Hazard zone: the expedition loses extra energy.';void playBuklodGameFeedback('impact');}
  else void playBuklodGameFeedback('move');
  const nextVisited=new Set(visited);nextVisited.add(key(next));const nextRevealed=new Set(revealed);nextRevealed.add(key(next));adjacent(next).forEach(n=>nextRevealed.add(key(n)));
  setPos(next);setEnergy(nextEnergy);setClues(nextClues);setScore(nextScore);setVisited(nextVisited);setRevealed(nextRevealed);setMessage(nextMessage);
  if(tile==='relic'){
   const evidenceBonus=nextClues*180;const energyBonus=Math.max(0,nextEnergy)*45;const finalScore=nextScore+evidenceBonus+energyBonus;const failed=nextClues<2||nextEnergy<0;const stars=starsForScore(finalScore);setScore(finalScore);setFinished(true);setMessage(failed?'The relic was found, but the expedition lacked enough evidence or reserve energy to secure the discovery.':`Relic secured with ${nextClues} clues and ${Math.max(0,nextEnergy)} energy remaining.`);void playBuklodGameFeedback(failed?'failure':'success');onFinish?.({gameId:GAME_ID,status:failed?'lost':'won',score:finalScore,stars:failed?0:stars,reward:{xp:failed?25:135+stars*45,kingdomXp:failed?5:60+stars*22,collectibleKey:!failed&&stars===3?'quin-first-discovery-relic':undefined}});
  }else if(nextEnergy<=0){setFinished(true);setMessage('Expedition energy is exhausted before the relic is secured.');void playBuklodGameFeedback('failure');onFinish?.({gameId:GAME_ID,status:'lost',score:nextScore,stars:0,reward:{xp:25,kingdomXp:5}});}
 },[clues,energy,finished,neighbors,onFinish,revealed,score,visited]);
 const reset=useCallback(()=>{setPos(START);setEnergy(14);setClues(0);setScore(0);setRevealed(new Set([key(START),...adjacent(START).map(key)]));setVisited(new Set([key(START)]));setFinished(false);setMessage('Explore the hidden grid, collect enough clues, protect expedition energy, and locate the relic before the map goes dark.');},[]);
 return <View style={s.shell}><View style={s.header}><View><Text style={s.eyebrow}>QUIN • DISCOVERY WORLD</Text><Text style={s.title}>Discovery Expedition</Text></View><View style={s.energyBox}><Text style={s.energy}>{energy}</Text><Text style={s.energyLabel}>ENERGY</Text></View></View><Text style={s.message}>{message}</Text><View style={s.hint}><Text style={s.hintKicker}>FIELD NOTES • {clues}/3 CLUES</Text><Text style={s.hintText}>{clueHint}</Text></View><View style={s.grid}>{Array.from({length:SIZE*SIZE},(_,i)=>{const tile={r:Math.floor(i/SIZE),c:i%SIZE};const visible=revealed.has(key(tile));const here=same(tile,pos);const reachable=neighbors.some(n=>same(n,tile));const known=visible?typeAt(tile):null;return <Pressable key={key(tile)} disabled={!reachable||finished} onPress={()=>move(tile)} style={[s.cell,!visible&&s.hidden,reachable&&s.reachable,here&&s.here]}><Text style={s.cellMain}>{here?'YOU':!visible?'?':known==='clue'?'CLUE':known==='cache'?'CACHE':known==='hazard'?'RISK':known==='relic'?'RELIC':'·'}</Text><Text style={s.cellSub}>{visible&&!here?`${tile.r+1},${tile.c+1}`:''}</Text></Pressable>})}</View><View style={s.footer}><Text style={s.footerText}>Score {score} • Visited {visited.size} tiles</Text>{finished?<Pressable style={s.primary} onPress={reset}><Text style={s.primaryText}>NEW EXPEDITION</Text></Pressable>:<Text style={s.tip}>Only adjacent tiles can be entered. Revealed hazards are avoidable; clues improve the final discovery rating.</Text>}</View></View>;
}
const s=StyleSheet.create({shell:{width:'100%',maxWidth:760,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#aab7ef',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#f4f6ff',fontSize:32,fontWeight:'900',marginTop:3},energyBox:{alignItems:'flex-end'},energy:{color:'#c8d2ff',fontSize:30,fontWeight:'900'},energyLabel:{color:'#8e99c5',fontSize:9,fontWeight:'900'},message:{color:'#dbe0f6',lineHeight:21},hint:{backgroundColor:'rgba(27,35,76,.76)',borderRadius:16,padding:13,borderWidth:1,borderColor:'rgba(116,137,210,.22)'},hintKicker:{color:'#9eade0',fontSize:10,fontWeight:'900',letterSpacing:1},hintText:{color:'#eef1ff',lineHeight:20,marginTop:4},grid:{flexDirection:'row',flexWrap:'wrap',gap:5,justifyContent:'center',backgroundColor:'rgba(14,20,48,.78)',borderRadius:22,padding:10},cell:{width:'18%',minWidth:52,height:76,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.055)',borderWidth:1,borderColor:'rgba(255,255,255,.08)'},hidden:{backgroundColor:'rgba(5,8,24,.86)'},reachable:{borderColor:'#93a8f1',backgroundColor:'rgba(100,123,210,.13)'},here:{backgroundColor:'#b6c3ff',borderColor:'#eff2ff'},cellMain:{color:'#eef1ff',fontWeight:'900',fontSize:11},cellSub:{color:'#8995bf',fontSize:9,marginTop:3},footer:{gap:10},footerText:{color:'#aeb8dd',fontWeight:'800'},tip:{color:'#9aa5ca',fontSize:12,lineHeight:18},primary:{alignSelf:'flex-start',backgroundColor:'#b6c3ff',borderRadius:14,paddingHorizontal:20,paddingVertical:14},primaryText:{color:'#1c2450',fontWeight:'900'}});