import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { playBuklodGameFeedback } from '../runtime/BuklodGameFeedback';
import type { BuklodGameResult } from '../types';

type ActionKey = 'produce' | 'process' | 'sell' | 'upgrade';
type Demand = 'local' | 'town' | 'premium';

const GAME_ID = 'phan-enterprise-builder';
const ROUNDS = 6;
const DEMANDS: Demand[] = ['local','town','premium','town','local','premium'];

const starsForScore=(score:number):1|2|3=>score>=1700?3:score>=1250?2:1;

type Props={onFinish?:(result:BuklodGameResult)=>void};

export function EnterpriseBuilderGameV1({onFinish}:Props){
  const [round,setRound]=useState(1);
  const [cash,setCash]=useState(320);
  const [raw,setRaw]=useState(4);
  const [goods,setGoods]=useState(0);
  const [capacity,setCapacity]=useState(4);
  const [reputation,setReputation]=useState(30);
  const [score,setScore]=useState(0);
  const [finished,setFinished]=useState(false);
  const [message,setMessage]=useState('Grow a small farmstead into a stable enterprise. Cash, production capacity, inventory and reputation must all survive six business cycles.');

  const demand=DEMANDS[Math.min(round-1,DEMANDS.length-1)];
  const sellPrice=demand==='premium'?90:demand==='town'?68:52;
  const demandLabel=demand==='premium'?'Premium Contract':demand==='town'?'Town Demand':'Local Market';
  const enterpriseValue=useMemo(()=>cash+raw*16+goods*48+capacity*55+reputation*4,[capacity,cash,goods,raw,reputation]);

  const endTurn=useCallback((next:{cash:number;raw:number;goods:number;capacity:number;reputation:number;scoreDelta:number;message:string})=>{
    const nextRound=round+1;
    setCash(next.cash);setRaw(next.raw);setGoods(next.goods);setCapacity(next.capacity);setReputation(Math.max(0,Math.min(100,next.reputation)));setScore(v=>v+next.scoreDelta);setMessage(next.message);
    if(nextRound>ROUNDS){
      const finalValue=next.cash+next.raw*16+next.goods*48+next.capacity*55+Math.max(0,Math.min(100,next.reputation))*4;
      const finalScore=Math.round(score+next.scoreDelta+finalValue);
      const failed=next.cash<0||next.reputation<18||finalValue<720;
      const stars=starsForScore(finalScore);
      setScore(finalScore);setFinished(true);
      setMessage(failed?'The enterprise expanded too fast or lost market trust. Rebuild with stronger cash flow and reputation.':`Enterprise stabilized at ${finalValue} value with ${Math.round(next.reputation)} reputation.`);
      void playBuklodGameFeedback(failed?'failure':'success');
      onFinish?.({gameId:GAME_ID,status:failed?'lost':'won',score:finalScore,stars:failed?0:stars,reward:{xp:failed?25:135+stars*45,kingdomXp:failed?5:60+stars*22,collectibleKey:!failed&&stars===3?'phan-enterprise-founder-seal':undefined}});
    }else setRound(nextRound);
  },[onFinish,round,score]);

  const act=useCallback((action:ActionKey)=>{
    if(finished)return;
    if(action==='produce'){
      const units=Math.min(capacity,6);const cost=units*22;if(cash<cost){setMessage('Not enough cash to fund another production cycle.');void playBuklodGameFeedback('impact');return;}
      endTurn({cash:cash-cost,raw:raw+units,goods,capacity,reputation:reputation+1,scoreDelta:units*18,message:`Harvest cycle completed: +${units} raw units. Cash fell by ${cost}, but the supply base grew.`});
    }else if(action==='process'){
      const units=Math.min(raw,capacity);const cost=units*14;if(units<=0||cash<cost){setMessage('Processing needs raw stock and working cash.');void playBuklodGameFeedback('impact');return;}
      endTurn({cash:cash-cost,raw:raw-units,goods:goods+units,capacity,reputation:reputation+2,scoreDelta:units*28,message:`Processed ${units} raw units into higher-value goods.`});
    }else if(action==='sell'){
      const units=Math.min(goods,demand==='premium'?3:4);if(units<=0){setMessage('No finished goods are ready for market. Production alone does not create revenue.');void playBuklodGameFeedback('impact');return;}
      const revenue=units*sellPrice;const repGain=demand==='premium'?8:demand==='town'?5:3;
      endTurn({cash:cash+revenue,raw,goods:goods-units,capacity,reputation:reputation+repGain,scoreDelta:revenue+repGain*8,message:`Sold ${units} goods into ${demandLabel} for ${revenue}. Market trust increased.`});
    }else{
      const cost=180+capacity*12;if(cash<cost){setMessage(`Expansion costs ${cost}. Growth without enough cash can break the enterprise.`);void playBuklodGameFeedback('impact');return;}
      endTurn({cash:cash-cost,raw,goods,capacity:capacity+2,reputation:reputation-2,scoreDelta:120,message:'Workshop expanded by 2 capacity. Short-term cash fell, but future production ceiling increased.'});
    }
    void playBuklodGameFeedback('collect');
  },[capacity,cash,demand,demandLabel,endTurn,finished,goods,raw,reputation,sellPrice]);

  const reset=useCallback(()=>{setRound(1);setCash(320);setRaw(4);setGoods(0);setCapacity(4);setReputation(30);setScore(0);setFinished(false);setMessage('Grow a small farmstead into a stable enterprise. Cash, production capacity, inventory and reputation must all survive six business cycles.');},[]);

  return <View style={styles.shell}>
    <View style={styles.header}><View><Text style={styles.eyebrow}>PHAN • FARMSTEAD TO ENTERPRISE</Text><Text style={styles.title}>Enterprise Builder</Text></View><View style={styles.valueBox}><Text style={styles.value}>{enterpriseValue}</Text><Text style={styles.valueLabel}>ENTERPRISE VALUE</Text></View></View>
    <Text style={styles.message}>{message}</Text>
    <View style={styles.dashboard}>{[['CASH',cash],['RAW',raw],['GOODS',goods],['CAPACITY',capacity],['REPUTATION',Math.round(reputation)]].map(([label,value])=><View key={String(label)} style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>)}</View>
    {!finished?<>
      <View style={styles.market}><Text style={styles.round}>BUSINESS CYCLE {round}/{ROUNDS}</Text><Text style={styles.marketTitle}>{demandLabel}</Text><Text style={styles.marketCopy}>Finished-goods price this cycle: {sellPrice}. Decide whether to produce, process, sell, or invest in capacity.</Text></View>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={()=>act('produce')}><Text style={styles.actionTitle}>PRODUCE</Text><Text style={styles.actionCopy}>Spend cash → increase raw stock</Text></Pressable>
        <Pressable style={styles.action} onPress={()=>act('process')}><Text style={styles.actionTitle}>PROCESS</Text><Text style={styles.actionCopy}>Convert raw stock → finished goods</Text></Pressable>
        <Pressable style={styles.action} onPress={()=>act('sell')}><Text style={styles.actionTitle}>SELL</Text><Text style={styles.actionCopy}>Convert goods → cash + reputation</Text></Pressable>
        <Pressable style={styles.action} onPress={()=>act('upgrade')}><Text style={styles.actionTitle}>EXPAND</Text><Text style={styles.actionCopy}>Invest cash → larger future capacity</Text></Pressable>
      </View>
      <Text style={styles.tip}>High demand is wasted if you have no finished goods. Too much inventory without cash can also trap the enterprise.</Text>
    </>:<View style={styles.result}><Text style={styles.resultKicker}>SIX CYCLES COMPLETE</Text><Text style={styles.bigScore}>{score}</Text><Text style={styles.resultCopy}>{message}</Text><Pressable style={styles.primary} onPress={reset}><Text style={styles.primaryText}>START NEW ENTERPRISE</Text></Pressable></View>}
  </View>;
}

const styles=StyleSheet.create({shell:{width:'100%',maxWidth:900,alignSelf:'center',padding:16,gap:14},header:{flexDirection:'row',justifyContent:'space-between',gap:12},eyebrow:{color:'#d6c67b',fontSize:12,fontWeight:'900',letterSpacing:1},title:{color:'#fffbe9',fontSize:32,fontWeight:'900',marginTop:3},valueBox:{alignItems:'flex-end'},value:{color:'#ffe99a',fontSize:27,fontWeight:'900'},valueLabel:{color:'#a9a77d',fontSize:9,fontWeight:'900'},message:{color:'#e5e8cf',lineHeight:21},dashboard:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{flexGrow:1,minWidth:110,backgroundColor:'rgba(255,255,255,.05)',borderRadius:12,padding:10},statLabel:{color:'#aeb399',fontSize:9,fontWeight:'900'},statValue:{color:'#fff',fontSize:22,fontWeight:'900',marginTop:2},market:{backgroundColor:'rgba(34,31,12,.78)',borderRadius:20,padding:18,borderWidth:1,borderColor:'rgba(216,190,82,.22)'},round:{color:'#ccb96d',fontSize:10,fontWeight:'900',letterSpacing:1},marketTitle:{color:'#fff6ce',fontSize:24,fontWeight:'900',marginTop:5},marketCopy:{color:'#d8d6bd',lineHeight:20,marginTop:4},actions:{flexDirection:'row',flexWrap:'wrap',gap:10},action:{flexGrow:1,flexBasis:260,minHeight:112,borderRadius:16,padding:14,backgroundColor:'rgba(255,255,255,.045)',borderWidth:1,borderColor:'rgba(255,255,255,.09)'},actionTitle:{color:'#ffe99a',fontSize:15,fontWeight:'900'},actionCopy:{color:'#bac0aa',lineHeight:18,marginTop:6},tip:{color:'#aeb59f',fontSize:12,lineHeight:18},result:{alignItems:'center',backgroundColor:'rgba(25,27,13,.82)',borderRadius:22,padding:30,gap:10},resultKicker:{color:'#cfc075',fontSize:10,fontWeight:'900',letterSpacing:1},bigScore:{color:'#ffe99a',fontSize:58,fontWeight:'900'},resultCopy:{color:'#dde3cf',textAlign:'center',maxWidth:620,lineHeight:21},primary:{backgroundColor:'#d7c464',borderRadius:14,paddingHorizontal:20,paddingVertical:14,marginTop:8},primaryText:{color:'#1d2011',fontWeight:'900'}});