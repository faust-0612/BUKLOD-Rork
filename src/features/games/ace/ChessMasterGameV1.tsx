import React,{useCallback,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import type {BuklodGameResult} from '@/features/games/types';
import {useBuklodGameLanguage} from '@/features/games/runtime/BuklodGameLanguage';
import {playBuklodGameFeedback} from '@/features/games/runtime/BuklodGameFeedback';
import {
 Chess,chessStatus,chessMove,legalChessMoves,chooseChessAiMove,
 type ChessSquare,type ChessInput,
} from './chessRules';
type Props={onFinish?:(result:BuklodGameResult,sessionId:string)=>void};
type Phase='ready'|'playing'|'paused'|'promotion'|'clear'|'retry'|'won'|'lost';
const PIECES:Record<string,string>={
 wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',
 bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟',
};
const FILES='abcdefgh';
const LEVEL_NAMES=['CADET','TACTICIAN','STRATEGIST'];
const PROMOTIONS:['q'|'r'|'b'|'n',string][]=[['q','♕'],['r','♖'],['b','♗'],['n','♘']];
export function ChessMasterGameV1({onFinish}:Props){
 const {t}=useBuklodGameLanguage();
 const [phase,setPhase]=useState<Phase>('ready');const phaseRef=useRef<Phase>('ready');
 const [level,setLevel]=useState(0);
 const gameRef=useRef(new Chess());
 const [fen,setFen]=useState(gameRef.current.fen());
 const [selected,setSelected]=useState<ChessSquare|null>(null),selectedRef=useRef<ChessSquare|null>(null);
 const [promotion,setPromotion]=useState<{from:ChessSquare;to:ChessSquare}|null>(null);
 const [undos,setUndos]=useState(0),undosRef=useRef(0);
 const [attempts,setAttempts]=useState(0),attemptsRef=useRef(0);
 const [total,setTotal]=useState(0),scoreRef=useRef(0);
 const [roundOutcome,setRoundOutcome]=useState<'checkmate'|'draw'|'loss'|''>('');
 const [notice,setNotice]=useState('');
 const finished=useRef(false),receipt=useRef('');
 const setGamePhase=(p:Phase)=>{phaseRef.current=p;setPhase(p);};
 const update=()=>{setFen(gameRef.current.fen());};
 const clearSelection=()=>{selectedRef.current=null;setSelected(null);setPromotion(null);};
 const beginLevel=useCallback((nextLevel:number,keepTries=false)=>{
  gameRef.current=new Chess();setFen(gameRef.current.fen());setSelected(null);selectedRef.current=null;setPromotion(null);
  setLevel(nextLevel);undosRef.current=0;setUndos(0);setRoundOutcome('');
  if(!keepTries){attemptsRef.current=0;setAttempts(0);}
  setNotice(t('You play White. Tap a piece, then a highlighted legal destination.','Ikaw ang White. I-tap ang piyesa, saka ang naka-highlight na legal na galaw.'));
  setGamePhase('playing');void playBuklodGameFeedback('move');
 },[t]);
 const start=useCallback(()=>{
  scoreRef.current=0;setTotal(0);finished.current=false;
  receipt.current='ch-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  beginLevel(0);
 },[beginLevel]);
 const finish=useCallback((status:'won'|'lost',points:number)=>{
  if(finished.current)return;
  finished.current=true;setGamePhase(status);
  const stars:0|1|2|3=status==='lost'?0:undosRef.current===0?3:undosRef.current<3?2:1;
  onFinish?.({gameId:'ace-chess-master',status,score:points,stars,reward:{xp:0,kingdomXp:0}},receipt.current);
  void playBuklodGameFeedback(status==='won'?'success':'failure');
 },[onFinish]);
 const handleGameOver=useCallback((outcome:'white-win'|'black-win'|'draw')=>{
  const chess=gameRef.current;
  if(outcome==='white-win'){
   setRoundOutcome('checkmate');
   const points=Math.max(250,2500-chess.history().length*12-undosRef.current*115);
   scoreRef.current+=points;setTotal(scoreRef.current);
   if(level===2)finish('won',scoreRef.current);
   else setGamePhase('clear');
  }else{
   setRoundOutcome(outcome==='draw'?'draw':'loss');
   const next=attemptsRef.current+1;attemptsRef.current=next;setAttempts(next);
   if(next>=3)finish('lost',scoreRef.current);else setGamePhase('retry');
  }
 },[finish,level]);
 const execute=useCallback((input:ChessInput)=>{
  if(phaseRef.current!=='playing'&&phaseRef.current!=='promotion')return;
  const game=gameRef.current;
  try{chessMove(game,input);}catch{
   setNotice(t('That is not a legal move.','Hindi legal ang galaw na iyon.'));void playBuklodGameFeedback('impact');return;
  }
  clearSelection();
  update();void playBuklodGameFeedback('collect');
  const humanResult=chessStatus(game);
  if(humanResult!=='playing'){handleGameOver(humanResult);return;}
  const ai=chooseChessAiMove(game,level);
  if(ai){chessMove(game,ai);update();}
  const after=chessStatus(game);
  if(after!=='playing'){handleGameOver(after);return;}
  setNotice(game.isCheck()?t('CHECK! Protect your king.','CHECK! Iligtas ang iyong hari.'):t('Your turn. Plan the next move.','Ikaw naman. Magplano ng susunod na galaw.'));
 },[handleGameOver,level,t]);
 const tapSquare=useCallback((square:ChessSquare)=>{
  if(phaseRef.current!=='playing'||gameRef.current.turn()!=='w')return;
  const game=gameRef.current;
  const from=selectedRef.current;
  const piece=game.get(square);
  if(!from||piece?.color==='w'){
   if(piece?.color==='w'){selectedRef.current=square;setSelected(square);void playBuklodGameFeedback('move');}
   else clearSelection();
   return;
  }
  const candidate=legalChessMoves(game,from).filter(m=>m.to===square);
  if(!candidate.length){
   setNotice(t('Move to a highlighted square.','Lumipat sa naka-highlight na square.'));
   clearSelection();return;
  }
  if(candidate.some(m=>!!m.promotion)){
   setPromotion({from,to:square});setGamePhase('promotion');return;
  }
  execute({from,to:square});
 },[execute,t]);
 const promote=(piece:'q'|'r'|'b'|'n')=>{
  if(phaseRef.current!=='promotion'||!promotion)return;
  const input:ChessInput={...promotion,promotion:piece};
  setGamePhase('playing');execute(input);
 };
 const undo=()=>{
  if(phaseRef.current!=='playing'||gameRef.current.turn()!=='w')return;
  const game=gameRef.current;
  if(!game.history().length)return;
  game.undo();if(game.turn()==='b')game.undo();
  undosRef.current++;setUndos(undosRef.current);update();clearSelection();
  void playBuklodGameFeedback('move');
 };
 const game=gameRef.current,board=game.board(),available=selected?legalChessMoves(game,selected).map(m=>m.to):[];
 const status=chessStatus(game);
 const moves=game.history();
 return <View style={s.root}>
  <View style={s.head}><View style={s.headText}><Text style={s.eyebrow}>ACE • STRATEGY FORTRESS</Text>
   <Text style={s.title}>CHESS MASTER</Text>
   <Text style={s.subtitle}>{t('Real chess rules. Three increasingly challenging opponents.','Tunay na tuntunin ng chess. Tatlong kalabang may iba-ibang antas.')}</Text></View>
   <View style={s.scoreCard}><Text style={s.score}>{total}</Text><Text style={s.scoreLabel}>MASTERY</Text></View></View>
  {phase==='ready'?<View style={s.panel}><Text style={s.panelTitle}>{t('Outthink the fortress chess masters','Daigin ang mga master ng chess')}</Text>
   <Text style={s.body}>{t('You play White against a local, legal-move-only AI. Complete three matches against Cadet, Tactician and Strategist. Real rules include check, castling, en passant, selectable pawn promotion and game draws. Tap a white piece to see legal moves; you may undo your last turn. You must checkmate to win a match. No clock and no connection required.','Ikaw ang White laban sa offline AI na legal moves lamang. Tatlong kalaban: Cadet, Tactician at Strategist. May check, castling, en passant, pagpili ng promotion at mga draw. I-tap ang puting piyesa upang makita ang legal moves. Puwedeng i-undo ang huling turn. Kailangan ng checkmate para manalo. Walang timer o internet.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('START CHESS MASTER','SIMULAN ANG CHESS')}</Text></Pressable></View>
  :phase==='paused'?<View style={s.panel}><Text style={s.panelTitle}>{t('Match paused','Naka-pause ang laban')}</Text>
   <Pressable onPress={()=>setGamePhase('playing')} style={s.primary}><Text style={s.primaryText}>{t('RESUME','ITULOY')}</Text></Pressable></View>
  :phase==='clear'||phase==='retry'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='clear'?t('CHECKMATE! YOU WIN','CHECKMATE! PANALO KA'):roundOutcome==='draw'?t('MATCH DRAWN','TABLA ANG LABAN'):t('OPPONENT CHECKMATED','PANALO ANG KALABAN')}</Text>
   <Text style={s.body}>{phase==='clear'?t('The next opponent plans further ahead.','Mas mahusay magplano ang susunod na kalaban.'):t('Review your openings and try again.','Suriin ang opening at subukan muli.')}</Text>
   <Pressable onPress={()=>beginLevel(phase==='clear'?level+1:level,phase==='retry')} style={s.primary}><Text style={s.primaryText}>{phase==='clear'?t('NEXT OPPONENT','SUSUNOD NA KALABAN'):t('RETRY CHESS','ULITIN ANG CHESS')}</Text></Pressable></View>
  :phase==='won'||phase==='lost'?<View style={s.panel}><Text style={s.panelTitle}>{phase==='won'?t('FORTRESS CHESS CHAMPION!','KAMPEON SA CHESS!'):t('MATCH SERIES ENDED','TAPOS ANG LABAN')}</Text>
   <Text style={s.final}>{total}</Text><Text style={s.body}>{t('Practice-only mastery. No Character Points, cash or redeemable rewards.','Mastery score lamang. Walang Character Points, cash o redeemable reward.')}</Text>
   <Pressable onPress={start} style={s.primary}><Text style={s.primaryText}>{t('PLAY AGAIN','ULITIN')}</Text></Pressable></View>
  :<>
   <View style={s.stats}><Text style={s.stat}>{LEVEL_NAMES[level]} • {level+1}/3</Text>
    <Text style={s.stat}>{game.isCheck()?'CHECK!':t('WHITE TO MOVE','GALAW NG WHITE')}</Text>
    <Text style={s.stat}>{t('UNDO','BAWI')}: {undos}</Text>
    <Pressable onPress={()=>{clearSelection();setGamePhase('paused');}} style={s.minor}><Text style={s.minorText}>{t('PAUSE','IHINTO')}</Text></Pressable></View>
   <View style={s.board}>{board.map((line,row)=><View key={row} style={s.row}>{line.map((p,col)=>{
    const square=(FILES[col]+(8-row)) as ChessSquare;
    const isSelected=selected===square,legal=available.includes(square);
    return <Pressable key={col} disabled={phase==='promotion'} accessibilityRole="button"
     accessibilityLabel={square+' '+(p?(p.color==='w'?'white ':'black ')+p.type:'empty')}
     accessibilityState={{selected:isSelected}} onPress={()=>tapSquare(square)}
     style={[s.cell,(row+col)%2===1?s.dark:s.light,isSelected&&s.selected,legal&&s.legal]}>
     <Text style={[s.piece,p?.color==='b'&&s.black]}>{p?PIECES[p.color+p.type]:legal?'·':''}</Text>
    </Pressable>;
   })}</View>)}</View>
   {phase==='promotion'?<View style={s.promotion}><Text style={s.promoLabel}>{t('CHOOSE PROMOTION','PUMILI NG PROMOTION')}</Text>
    <View style={s.promoRow}>{PROMOTIONS.map(([p,glyph])=><Pressable key={p} onPress={()=>promote(p)} style={s.promoButton}><Text style={s.promoPiece}>{glyph}</Text></Pressable>)}</View>
   </View>:<View style={s.actions}><Pressable disabled={moves.length<2} onPress={undo} style={[s.minor,moves.length<2&&s.disabled]}>
    <Text style={s.minorText}>{t('UNDO FULL TURN','BAWIIN ANG TURNO')}</Text></Pressable>
    <Text style={s.moveLog}>{moves.slice(-6).join('  ·  ')||'1. —'}</Text></View>}
   <Text style={s.notice}>{status==='playing'?notice:status}</Text>
  </>}
 </View>;
}
const s=StyleSheet.create({
 root:{maxWidth:810,width:'100%',alignSelf:'center',padding:12,gap:12},
 head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:9},headText:{flex:1},
 eyebrow:{fontSize:10,color:'#d9d3c9',fontWeight:'900'},title:{fontSize:26,color:'#fff1d7',fontWeight:'900'},
 subtitle:{fontSize:12,color:'#e5e5d9',lineHeight:18},
 scoreCard:{backgroundColor:'#454a50',borderWidth:1,borderColor:'#cebea0',padding:9,borderRadius:11,alignItems:'center'},
 score:{fontSize:22,color:'#ffe2aa',fontWeight:'900'},scoreLabel:{fontSize:9,color:'#e7e0cf',fontWeight:'900'},
 panel:{padding:16,borderRadius:16,backgroundColor:'#303e4c',borderColor:'#98aebb',borderWidth:1,gap:13},
 panelTitle:{fontSize:21,color:'#ffefce',fontWeight:'900'},body:{fontSize:13,color:'#dfe5e0',lineHeight:21},
 primary:{backgroundColor:'#e8d6af',padding:13,borderRadius:11,alignItems:'center'},
 primaryText:{fontSize:12,color:'#31454d',fontWeight:'900'},final:{fontSize:43,color:'#ffe1ac',fontWeight:'900'},
 stats:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'space-between',alignItems:'center'},
 stat:{fontSize:11,color:'#e2e9e3',fontWeight:'900'},minor:{padding:9,borderColor:'#b7c7c7',borderWidth:1,borderRadius:9},
 minorText:{fontSize:10,color:'#ebebdd',fontWeight:'900'},
 board:{alignSelf:'center',maxWidth:460,width:'100%',borderWidth:3,borderColor:'#bfa985',borderRadius:11,overflow:'hidden'},
 row:{flexDirection:'row'},cell:{flex:1,aspectRatio:1,justifyContent:'center',alignItems:'center'},
 dark:{backgroundColor:'#668379'},light:{backgroundColor:'#e5dcbf'},
 selected:{borderWidth:3,borderColor:'#ffb552',backgroundColor:'#c7b56c'},
 legal:{borderWidth:3,borderColor:'#5bd7f1'},
 piece:{fontSize:31,color:'#fefcf5',textShadowColor:'#233d3b',textShadowRadius:2,textShadowOffset:{width:1,height:1}},
 black:{color:'#172834',textShadowColor:'#d6d1b6'},actions:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:9},
 disabled:{opacity:.4},moveLog:{fontSize:10,color:'#d6e6d8',flex:1},
 notice:{fontSize:12,color:'#e6e6d3',textAlign:'center',lineHeight:18},
 promotion:{backgroundColor:'#34525a',borderRadius:13,padding:10,alignItems:'center',gap:8},
 promoLabel:{color:'#fff0c8',fontSize:12,fontWeight:'900'},
 promoRow:{flexDirection:'row',gap:10},
 promoButton:{backgroundColor:'#f1e2c8',padding:12,borderRadius:10},
 promoPiece:{fontSize:33,color:'#2b4251'},
});
