import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

type ProjectKey = 'water' | 'school' | 'farm' | 'clinic' | 'road';
type Phase = 'build' | 'result';
type Project = {
  key: ProjectKey;
  label: string;
  need: number;
  workerCost: number;
  materialCost: number;
  impact: { care: number; access: number; learning: number; livelihood: number };
};

const GAME_ID = 'elesur-village-builder';
const START_WORKERS = 9;
const START_MATERIALS = 14;
const PROJECTS: Project[] = [
  { key:'water', label:'Water Point', need:92, workerCost:2, materialCost:4, impact:{care:18,access:10,learning:2,livelihood:8}},
  { key:'school', label:'Learning House', need:76, workerCost:2, materialCost:3, impact:{care:4,access:4,learning:22,livelihood:4}},
  { key:'farm', label:'Community Farm', need:68, workerCost:2, materialCost:3, impact:{care:4,access:2,learning:3,livelihood:22}},
  { key:'clinic', label:'Care Station', need:84, workerCost:2, materialCost:3, impact:{care:24,access:3,learning:2,livelihood:2}},
  { key:'road', label:'Highland Path', need:72, workerCost:3, materialCost:4, impact:{care:3,access:24,learning:5,livelihood:9}},
];

const starsForScore = (score:number):1|2|3 => score >= 1450 ? 3 : score >= 1100 ? 2 : 1;

type Props = { onFinish?: (result:BuklodGameResult)=>void };

export function VillageBuilderGameV1({ onFinish }:Props) {
  const [phase,setPhase]=useState<Phase>('build');
  const [workers,setWorkers]=useState(START_WORKERS);
  const [materials,setMaterials]=useState(START_MATERIALS);
  const [built,setBuilt]=useState<ProjectKey[]>([]);
  const [round,setRound]=useState(1);
  const [score,setScore]=useState(0);
  const [health,setHealth]=useState({care:38,access:32,learning:34,livelihood:36});
  const [message,setMessage]=useState('The highland village has more needs than resources. Build in the right order before the community enters crisis.');

  const builtSet=useMemo(()=>new Set(built),[built]);
  const pressure=useMemo(()=>PROJECTS.filter(p=>!builtSet.has(p.key)).sort((a,b)=>b.need-a.need),[builtSet]);

  const buildProject=useCallback((project:Project)=>{
    if(phase!=='build'||builtSet.has(project.key)) return;
    if(workers<project.workerCost||materials<project.materialCost){setMessage('Not enough workers or materials for that project. Prioritize what the village can finish.');void playBuklodGameFeedback('impact');return;}
    const priorityRank=pressure.findIndex(p=>p.key===project.key);
    const priorityBonus=priorityRank===0?220:priorityRank===1?120:50;
    const nextBuilt=[...built,project.key];
    const nextHealth={
      care:Math.min(100,health.care+project.impact.care-(priorityRank>2?3:0)),
      access:Math.min(100,health.access+project.impact.access),
      learning:Math.min(100,health.learning+project.impact.learning),
      livelihood:Math.min(100,health.livelihood+project.impact.livelihood),
    };
    setWorkers(v=>v-project.workerCost);setMaterials(v=>v-project.materialCost);setBuilt(nextBuilt);setHealth(nextHealth);setRound(v=>v+1);setScore(v=>v+priorityBonus+project.need*2);
    setMessage(`${project.label} completed. The village changed, but unresolved needs keep increasing pressure.`);void playBuklodGameFeedback('collect');

    if(nextBuilt.length>=3||workers-project.workerCost<=0||materials-project.materialCost<3){
      const avg=(nextHealth.care+nextHealth.access+nextHealth.learning+nextHealth.livelihood)/4;
      const unresolved=PROJECTS.filter(p=>!nextBuilt.includes(p.key));
      const critical=unresolved.filter(p=>p.need>=80).length;
      const finalScore=Math.round(score+priorityBonus+project.need*2+avg*5+(workers-project.workerCost)*35+(materials-project.materialCost)*20-critical*130);
      const failed=avg<48||critical>=2;
      const stars=starsForScore(finalScore);
      setScore(finalScore);setPhase('result');
      setMessage(failed?'The village improved, but too many urgent needs were left unresolved. Rebuild the intervention order.':`Village cycle stabilized. ${nextBuilt.length} priority projects now anchor the highland community.`);
      void playBuklodGameFeedback(failed?'failure':'success');
      onFinish?.({gameId:GAME_ID,status:failed?'lost':'won',score:finalScore,stars:failed?0:stars,reward:{xp:failed?25:130+stars*45,kingdomXp:failed?5:60+stars*20,collectibleKey:!failed&&stars===3?'elesur-highland-service-seal':undefined}});
    }
  },[built,builtSet,health,materials,onFinish,phase,pressure,score,workers]);

  const reset=useCallback(()=>{setPhase('build');setWorkers(START_WORKERS);setMaterials(START_MATERIALS);setBuilt([]);setRound(1);setScore(0);setHealth({care:38,access:32,learning:34,livelihood:36});setMessage('The highland village has more needs than resources. Build in the right order before the community enters crisis.');},[]);

  return <View style={styles.shell}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>ELESUR • HIGHLAND COMMUNITY</Text><Text style={styles.title}>Village Builder</Text></View><View style={styles.resourceBox}><Text style={styles.resource}>{workers}W • {materials}M</Text><Text style={styles.resourceLabel}>WORKERS / MATERIALS</Text></View></View>
    <Text style={styles.message}>{message}</Text>
    <View style={styles.healthRow}>{Object.entries(health).map(([k,v])=><View key={k} style={styles.healthCard}><Text style={styles.healthLabel}>{k.toUpperCase()}</Text><Text style={styles.healthValue}>{Math.round(v)}</Text></View>)}</View>

    {phase==='build'?<>
      <View style={styles.map}><Text style={styles.mapKicker}>HIGHLAND VILLAGE • ROUND {round}</Text><View style={styles.villageGrid}>{PROJECTS.map(project=>{
        const done=builtSet.has(project.key);const rank=pressure.findIndex(p=>p.key===project.key);return <Pressable key={project.key} disabled={done} onPress={()=>buildProject(project)} style={[styles.site,done&&styles.siteDone,rank===0&&!done&&styles.siteUrgent]}><Text style={styles.siteName}>{project.label}</Text><Text style={styles.siteNeed}>{done?'BUILT':`Need ${project.need}`}</Text><Text style={styles.siteCost}>{project.workerCost}W • {project.materialCost}M</Text>{rank===0&&!done?<Text style={styles.urgent}>MOST URGENT</Text>:null}</Pressable>})}</View></View>
      <Text style={styles.tip}>You can finish only a few projects this cycle. Highest need is not always the only factor—watch community health and remaining resources.</Text>
    </>:<View style={styles.result}><Text style={styles.resultKicker}>COMMUNITY CYCLE COMPLETE</Text><Text style={styles.bigScore}>{score}</Text><Text style={styles.resultCopy}>{message}</Text><Pressable style={styles.primary} onPress={reset}><Text style={styles.primaryText}>REBUILD PLAN</Text></Pressable></View>}
  </View>;
}

const styles=StyleSheet.create({
  shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:14},eyebrow:{color:'#b8d1c2',fontSize:12,fontWeight:'900',letterSpacing:1.1},title:{color:'#f2f7f2',fontSize:32,fontWeight:'900',marginTop:3},resourceBox:{alignItems:'flex-end'},resource:{color:'#dceacb',fontSize:23,fontWeight:'900'},resourceLabel:{color:'#94aa9b',fontSize:9,fontWeight:'900'},message:{color:'#d9e7dd',lineHeight:21},healthRow:{flexDirection:'row',gap:8,flexWrap:'wrap'},healthCard:{flexGrow:1,minWidth:105,backgroundColor:'rgba(255,255,255,.05)',borderRadius:12,padding:10},healthLabel:{color:'#9eb3a7',fontSize:10,fontWeight:'900'},healthValue:{color:'#eef7ee',fontSize:22,fontWeight:'900',marginTop:2},map:{backgroundColor:'rgba(11,24,26,.8)',borderWidth:1,borderColor:'rgba(160,190,178,.2)',borderRadius:22,padding:16,gap:12},mapKicker:{color:'#9db8aa',fontSize:11,fontWeight:'900',letterSpacing:1},villageGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},site:{flexGrow:1,flexBasis:240,minHeight:130,borderRadius:16,padding:14,backgroundColor:'rgba(255,255,255,.045)',borderWidth:1,borderColor:'rgba(255,255,255,.1)'},siteDone:{backgroundColor:'rgba(126,166,119,.16)',borderColor:'rgba(158,204,147,.45)'},siteUrgent:{borderColor:'#e0a56e',backgroundColor:'rgba(213,126,74,.1)'},siteName:{color:'#fff',fontSize:17,fontWeight:'900'},siteNeed:{color:'#bdd0c3',fontWeight:'800',marginTop:8},siteCost:{color:'#8ea497',fontSize:12,marginTop:5},urgent:{color:'#f2b47e',fontSize:10,fontWeight:'900',marginTop:8},tip:{color:'#aebfb3',fontSize:12,lineHeight:18},result:{alignItems:'center',backgroundColor:'rgba(11,24,26,.82)',borderRadius:22,padding:28,gap:10},resultKicker:{color:'#a7c1b2',fontSize:11,fontWeight:'900',letterSpacing:1},bigScore:{color:'#edf5d0',fontSize:58,fontWeight:'900'},resultCopy:{color:'#d8e4dc',textAlign:'center',lineHeight:21,maxWidth:600},primary:{backgroundColor:'#b7ce92',borderRadius:14,paddingVertical:14,paddingHorizontal:22,marginTop:8},primaryText:{color:'#18231c',fontWeight:'900'}
});