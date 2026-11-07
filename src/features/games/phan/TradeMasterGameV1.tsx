import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {GOODS,TRADE_SEASONS,createTradeRound,tradePrice,tradeBuy,tradeSell,fulfillTrade,endTradeDay,type TradeGood,type TradeRound} from './tradeMasterRules';
type Props={onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
const LABELS=[
 {en:'Wheat',tl:'Trigo',icon:'🌾'},
 {en:'Cloth',tl:'Tela',icon:'🧵'},
 {en:'Lumber',tl:'Kahoy',icon:'🪵'},
] as const;
export function TradeMasterGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<'ready'|'playing'|'paused'|'clear'|'retry'|'won'|'lost'>('ready');
 const phaseRef=useRef<typeof phase>('ready');
 const [level,setLevel]=useState(0);
 const [run,setRun]=useState<TradeRound>(()=>createTradeRound(0));const ref=useRef(run);
 const [total,setTotal]=useState(0);const totalRef=useRef(0);
 const [retries,setRetries]=useState(0);const retriesRef=useRef(0);
 const [notice,setNotice]=useState('');
 const completed=useRef(false),receipt=useRef('');
 const change=(v:typeof phase)=>{phaseRef.current=v;setPhase(v);};
 const begin=useCallback((nextLevel:number,keepRetries=false)=>{
  const r=createTradeRound(nextLevel);ref.current=r;setRun(r);setLevel(nextLevel);
  if(!keepRetries){retriesRef.current=0;setRetries(0);}
  setNotice(t('Buy supplies, meet delivery contracts, and end the day after planning.',
    'Bumili ng produkto, tumupad sa kontrata, saka tapusin ang araw kapag handa.'));
  change('playing');void playBuklodGameFeedback('move');
 },[t]);
 const start=useCallback(()=>{
  totalRef.current=0;setTotal(0);completed.current=false;
  receipt.current='tm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  begin(0);
 },[begin]);
 const finish=useCallback((status:'won'|'lost',score:number)=>{
  if(completed.current)return;
  completed.current=true;change(status);
  const stars:0|1|2|3=status==='lost'?0:retriesRef.current===0?3:retriesRef.current===1?2:1;
  onFinish?.({gameId:'phan-trade-master',status,score,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[onFinish]);
 const changeStock=useCallback((kind:'buy'|'sell',good:TradeGood,qty:number)=>{
  if(phaseRef.current!=='playing')return;
  const before=ref.current,after=kind==='buy'?tradeBuy(before,good,qty):tradeSell(before,good,qty);
  if(before===after){
   setNotice(t('Not enough funds, inventory, or market stock for this order.','Hindi sapat ang pera, hawak na produkto, o stock ng palengke.'));
   void playBuklodGameFeedback('impact');return;
  }
  ref.current=after;setRun(after);void playBuklodGameFeedback(kind==='buy'?'move':'collect');
  setNotice(t(kind==='buy'?'Supplies purchased.':'Sale completed.',kind==='buy'?'Nabili ang produkto.':'Naibenta ang produkto.'));
 },[t]);
 const contract=useCallback((id:string)=>{
  if(phaseRef.current!=='playing')return;
  const before=ref.current,after=fulfillTrade(before,id);
  if(before===after){setNotice(t('Collect the required quantity before fulfilling this contract.','Kunin muna ang kinakailangang dami para sa kontrata.'));return;}
  ref.current=after;setRun(after);void playBuklodGameFeedback('success');
  setNotice(t('Contract delivered! Reward added to your GAME cash.','Naipadala ang kontrata! Nadagdag ang bayad sa perang pang-laro.'));
 },[t]);
 const nextDay=useCallback(()=>{
  if(phaseRef.current!=='playing')return;
  const next=endTradeDay(ref.current);ref.current=next;setRun(next);
  if(next.status==='won'){
   totalRef.current+=next.score;setTotal(totalRef.current);
   if(level===TRADE_SEASONS.length-1)finish('won',totalRef.current);
   else change('clear');
  }else if(next.status==='lost'){
   const tries=retriesRef.current+1;retriesRef.current=tries;setRetries(tries);
   if(tries>=3)finish('lost',totalRef.current);else change('retry');
  }else{
   setNotice(t('A new market day has begun. Prices have changed.','Bagong araw sa palengke! Nagbago ang mga presyo.'));
   void playBuklodGameFeedback('move');
  }
 },[finish,level,t]);
 return <View style={s.root}>
 <View style={s.header}><View style={s.headText}><Text style={s.eyebrow}>PHAN • ENTERPRISE TOWN</Text><Text style={s.title}>TRADE MASTER</Text>
  <Text style={s.subtitle}>{t('Buy smart, fulfill orders, protect the town.','Bumili nang matalino, tumupad sa order, alagaan ang bayan.')}</Text>
 </View><View style={s.scoreBox}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
 {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Three market seasons','Tatlong panahon sa palengke')}</Text>
  <Text style={s.body}>{t('Each market lasts five days. You can buy or sell wheat, cloth and lumber, with limited daily stock and changing prices. Collect enough inventory to fulfill delivery contracts for cash payouts. Deliver the target number of contracts and keep at least 150 GAME coins to clear the season. Up to three attempts per season.', 'Limang araw bawat season. Bumili at magbenta ng trigo, tela at kahoy ayon sa stock at presyo. Mag-ipon para sa mga delivery contract. Tapusin ang sapat na kontrata at magtira ng hindi bababa sa 150 GAME coins. Hanggang tatlong subok bawat season.')}</Text>
  <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('OPEN THE MARKET','BUKSAN ANG PALENGKE')}</Text></Pressable></View>
 :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Market paused','Naka-pause')}</Text>
  <Pressable style={s.primary} onPress={()=>change('playing')}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
 :phase==='clear'||phase==='retry'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='clear'?t('SEASON COMPLETE!','KUMPLETO ANG SEASON!'):t('CONTRACT GOALS NOT MET','KULANG ANG KONTRATA')}</Text>
  <Text style={s.body}>{phase==='clear'?t('The next marketplace opens.','Bukas na ang susunod na palengke.'):t('Try different buying and delivery strategies.','Subukan ang ibang diskarte sa pagbili at delivery.')}</Text>
  <Pressable style={s.primary} onPress={()=>begin(phase==='clear'?level+1:level,phase==='retry')}><Text style={s.primaryText}>{phase==='clear'?t('NEXT SEASON','SUSUNOD NA SEASON'):t('RETRY SEASON','ULITIN ANG SEASON')}</Text></Pressable></View>
 :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('TRADE MASTER!','MASTER NG KALAKAL!'):t('MARKET CLOSED','SARADO ANG PALENGKE')}</Text>
  <Text style={s.bigScore}>{total}</Text>
  <Text style={s.body}>{t('This is an offline-game economy only. No Character Points, cash, or redeemable credits were granted.','Pang-laro lamang ang mga coins; walang Character Points, cash o redeemable credits na nadagdag.')}</Text>
  <Pressable style={s.primary} onPress={start}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
 :<>
  <View style={s.stats}><Text style={s.stat}>{t('SEASON','SEASON')} {level+1}/3</Text><Text style={s.stat}>{t('DAY','ARAW')} {run.day+1}/5</Text>
   <Text style={s.stat}>{t('CASH','PERA')}: {run.cash}</Text>
   <Pressable onPress={()=>change('paused')} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
  <View style={s.goods}>{GOODS.map((name,i)=>{
   const good=i as TradeGood;
   return <View key={name} style={s.good}>
    <Text style={s.goodsIcon}>{LABELS[i].icon}</Text>
    <Text style={s.goodsName}>{t(LABELS[i].en,LABELS[i].tl)}</Text>
    <Text style={s.goodsMeta}>{t('YOU','HAWAK')}: {run.inventory[good]} • {t('STOCK','STOCK')}: {run.marketStock[good]}</Text>
    <Text style={s.price}>{t('BUY','BILI')}: {tradePrice(level,run.day,good,'buy')}</Text>
    <Text style={s.price}>{t('SELL','BENTA')}: {tradePrice(level,run.day,good,'sell')}</Text>
    <View style={s.buttons}>
     <Pressable accessibilityRole="button" accessibilityLabel={'Buy '+name+' 1'} onPress={()=>changeStock('buy',good,1)} style={s.buy}><Text style={s.buyText}>+1</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={'Sell '+name+' 1'} onPress={()=>changeStock('sell',good,1)} style={s.sell}><Text style={s.sellText}>−1</Text></Pressable>
    </View>
   </View>;
  })}</View>
  <Text style={s.contractTitle}>{t('DELIVERY CONTRACTS','MGA KONTRATA')}: {run.fulfilled.length}/{TRADE_SEASONS[level].targets}</Text>
  {run.contracts.map(job=><View key={job.id} style={[s.contract,run.fulfilled.includes(job.id)&&s.contractDone]}>
    <View style={s.contractCopy}><Text style={s.contractName}>{LABELS[job.good].icon} {job.id.toUpperCase()}</Text>
      <Text style={s.contractText}>{job.quantity} {t(LABELS[job.good].en,LABELS[job.good].tl)} • {job.payout} GAME COINS</Text></View>
    <Pressable disabled={run.fulfilled.includes(job.id)||run.inventory[job.good]<job.quantity}
      onPress={()=>contract(job.id)} style={[s.delivery,(run.fulfilled.includes(job.id)||run.inventory[job.good]<job.quantity)&&s.disabled]}>
      <Text style={s.deliveryText}>{run.fulfilled.includes(job.id)?'✓':t('DELIVER','IHATID')}</Text></Pressable>
  </View>)}
  <Pressable onPress={nextDay} style={s.primary}><Text style={s.primaryText}>{run.day===4?t('FINISH SEASON','TAPUSIN ANG SEASON'):t('END DAY & UPDATE PRICES','TAPUSIN ANG ARAW')}</Text></Pressable>
  {!!notice&&<Text style={s.notice}>{notice}</Text>}
 </>}
 </View>;
}
const s=StyleSheet.create({
 root:{maxWidth:900,width:'100%',alignSelf:'center',padding:12,gap:12},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 headText:{flex:1},eyebrow:{color:'#e8d9ad',fontSize:10,fontWeight:'900'},
 title:{color:'#fff2c6',fontSize:26,fontWeight:'900'},subtitle:{color:'#dce6d6',fontSize:12},
 scoreBox:{backgroundColor:'#43504d',borderColor:'#b7aa86',borderWidth:1,borderRadius:11,padding:9,alignItems:'center'},
 score:{fontSize:23,color:'#ffdc9e',fontWeight:'900'},scoreLabel:{fontSize:9,color:'#e7dfc3',fontWeight:'900'},
 panel:{backgroundColor:'#344a49',borderRadius:16,padding:16,borderWidth:1,borderColor:'#a2b59c',gap:13},
 panelTitle:{color:'#ffeece',fontSize:22,fontWeight:'900'},body:{color:'#e7ebdd',fontSize:13,lineHeight:21},
 primary:{backgroundColor:'#eed6a4',padding:13,borderRadius:10,alignItems:'center'},
 primaryText:{color:'#35443f',fontWeight:'900',fontSize:12},bigScore:{fontSize:43,color:'#ffe0a4',fontWeight:'900'},
 stats:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'space-between'},
 stat:{color:'#f5eccb',fontWeight:'900',fontSize:11},minor:{borderColor:'#bdc3a1',borderWidth:1,borderRadius:8,padding:9},
 minorText:{fontSize:10,color:'#f7ead0',fontWeight:'900'},goods:{flexDirection:'row',flexWrap:'wrap',gap:9},
 good:{flex:1,minWidth:98,backgroundColor:'#2d5351',borderColor:'#8eae9b',borderWidth:1,borderRadius:12,padding:10,gap:5},
 goodsIcon:{fontSize:26},goodsName:{fontSize:13,color:'#fff3d8',fontWeight:'900'},
 goodsMeta:{fontSize:10,color:'#d4e4d4',fontWeight:'700'},price:{fontSize:11,color:'#f6dfb2',fontWeight:'800'},
 buttons:{flexDirection:'row',justifyContent:'space-between',gap:6},
 buy:{backgroundColor:'#cce1a7',borderRadius:8,paddingVertical:7,flex:1,alignItems:'center'},
 sell:{backgroundColor:'#e8c6aa',borderRadius:8,paddingVertical:7,flex:1,alignItems:'center'},
 buyText:{color:'#36553e',fontWeight:'900'},sellText:{color:'#674938',fontWeight:'900'},
 contractTitle:{color:'#fff1c7',fontSize:12,fontWeight:'900'},
 contract:{flexDirection:'row',alignItems:'center',gap:10,padding:10,borderColor:'#7eac95',borderWidth:1,backgroundColor:'#2d4d4b',borderRadius:10},
 contractDone:{backgroundColor:'#345e4f'},contractCopy:{flex:1},
 contractName:{color:'#ffedcd',fontSize:11,fontWeight:'900'},contractText:{color:'#d4e4d6',fontSize:10,marginTop:4},
 delivery:{backgroundColor:'#e6d29c',borderRadius:9,padding:9},deliveryText:{color:'#3c5247',fontWeight:'900',fontSize:10},
 disabled:{opacity:.4},notice:{color:'#e8e4c7',textAlign:'center',fontSize:12,lineHeight:19},
});
