import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Animated, AppState, Pressable, StyleSheet, Text, View,
} from 'react-native';
import type { BuklodGameResult } from '@/features/games/types';
import { useBuklodGameLanguage } from '@/features/games/runtime/BuklodGameLanguage';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import type { ArcadeSpec } from './arcadeCatalog';
import {
  actArcade, nextArcadeStage, startArcade, tickArcade, type ArcadeState,
} from './arcadeCore';

type Props = { game: ArcadeSpec; onFinish: (result:BuklodGameResult,sessionId:string)=>void };
type Phase = 'ready'|'playing'|'paused'|'clear'|'lost'|'done';
const LANES = [0,1,2] as const;
const CELLS = [0,1,2,3,4,5,6,7,8] as const;
const TICK_MS = 160;
const TRACK_MODES = new Set(['catch','lane','runner','rhythm','defend']);

export function ArcadeGameV1({game,onFinish}:Props) {
  const {t} = useBuklodGameLanguage();
  const [run,setRun] = useState<ArcadeState>(()=>startArcade(game.mode,17));
  const [phase,setPhase] = useState<Phase>('ready');
  const receipt = useRef('');
  const saved = useRef(false);
  const touchX = useRef(0);
  const glow = useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(glow,{toValue:1.08,duration:850,useNativeDriver:true}),
      Animated.timing(glow,{toValue:1,duration:850,useNativeDriver:true}),
    ]));
    animation.start();
    return ()=>animation.stop();
  },[glow]);

  // App backgrounding or navigating away must never consume lives offscreen.
  useEffect(()=>{
    const listener=AppState.addEventListener('change',state=>{
      if(state!=='active')setPhase(previous=>previous==='playing'?'paused':previous);
    });
    return ()=>listener.remove();
  },[]);
  useFocusEffect(useCallback(()=>()=>{
    setPhase(previous=>previous==='playing'?'paused':previous);
  },[]));

  useEffect(()=>{
    if(phase!=='playing'||run.status!=='playing')return;
    const timer=setInterval(()=>setRun(current=>tickArcade(current)),TICK_MS);
    return ()=>clearInterval(timer);
  },[phase,run.status]);

  useEffect(()=>{
    if(phase==='playing' && run.status==='clear')setPhase('clear');
    if(phase==='playing' && run.status==='lost')setPhase('lost');
  },[phase,run.status]);

  useEffect(()=>{
    if(run.eventSeq===0)return;
    if(run.outcome==='collect')void playBuklodGameFeedback('collect');
    else if(run.outcome==='impact')void playBuklodGameFeedback('impact');
  },[run.eventSeq,run.outcome]);

  useEffect(()=>{
    if(phase==='clear')void playBuklodGameFeedback('success');
    if(phase==='lost')void playBuklodGameFeedback('failure');
  },[phase]);

  const begin=()=>{
    saved.current=false;
    receipt.current='arc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
    setRun(startArcade(game.mode,Date.now()>>>0));
    setPhase('playing');
  };

  const input=(action:'left'|'right'|'jump'|'cell'|'drop'|'lane',value?:number)=>{
    if(phase!=='playing')return;
    setRun(previous=>actArcade(previous,action,value));
  };

  const finish=()=>{
    if(saved.current || (phase!=='clear' && phase!=='lost'))return;
    saved.current=true;
    const won=phase==='clear';
    onFinish({
      gameId:game.id,status:won?'won':'lost',score:run.score,
      stars:(!won ? 0 : run.stage>=3 ? 3 : run.stage===2 ? 2 : 1) as 0|1|2|3,
      reward:{xp:0,kingdomXp:0},
    },receipt.current);
    setPhase('done');
  };

  const track=TRACK_MODES.has(game.mode);
  const isTap=game.mode==='tap'||game.mode==='search';
  const isStack=game.mode==='stack';
  const canControl=phase==='playing';
  const iconFor=(good:boolean,variant:number)=>
    (good?game.good:game.bad)[variant%(good?game.good.length:game.bad.length)]||game.icon;
  const prompt=game.mode==='rhythm'
    ? t('Tap a lane when the note reaches the golden line.','I-tap ang lane kapag nasa gintong linya ang nota.')
    : game.mode==='defend'
    ? t('Tap each incoming enemy lane.','I-tap ang lane ng paparating na kalaban.')
    : game.mode==='stack'
    ? t('Tap DROP when the block lines up with the foundation.','I-tap ang IBAGSAK kapag tumapat ang bloke.')
    : game.mode==='search'
    ? t('Watch the glowing tile, then tap where it was.','Tandaan ang kumikislap na tile saka i-tap.')
    : t(game.instructionEn,game.instructionTl);

  return <View style={[s.shell,{borderColor:game.accent}]}>
    <View style={s.heading}>
      <Animated.View style={[s.heroCircle,{borderColor:game.accent,transform:[{scale:glow}]}]}>
        <Text style={s.hero}>{game.icon}</Text>
      </Animated.View>
      <View style={s.headingCopy}>
        <Text style={s.kicker}>{game.character.toUpperCase()} • ARCADE</Text>
        <Text style={s.title}>{game.title}</Text>
        <Text style={s.help}>{prompt}</Text>
      </View>
    </View>

    <View style={s.hud}>
      <View style={s.hudItem}><Text style={s.hudLabel}>{t('STAGE','YUGTO')}</Text>
        <Text style={s.hudValue}>{run.stage} ∞</Text></View>
      <View style={s.hudItem}><Text style={s.hudLabel}>{t('SCORE','PUNTOS SA LARO')}</Text>
        <Text style={s.hudValue}>{run.score.toLocaleString()}</Text></View>
      <View style={s.hudItem}><Text style={s.hudLabel}>{t('LIVES','BUHAY')}</Text>
        <Text style={s.hudValue}>{'❤️'.repeat(run.lives)||'—'}</Text></View>
      <View style={s.hudItem}><Text style={s.hudLabel}>{t('TIME','ORAS')}</Text>
        <Text style={s.hudValue}>{Math.ceil(run.remaining*TICK_MS/1000)}s</Text></View>
    </View>
    <View style={s.progressBack}><View style={[s.progressFill,{backgroundColor:game.accent,
      width:(100*Math.min(1,run.stageHits/run.goal))+'%' as `${number}%`}]} /></View>
    <Text style={s.progressText}>{t('Stage goal','Target')}: {run.stageHits}/{run.goal} • {t('Combo','Sunod-sunod')}: x{run.combo}</Text>

    {phase==='ready' ? <View style={s.overlay}>
      <Text style={s.overlayIcon}>{game.hero}</Text>
      <Text style={s.bigTitle}>{t('Ready to play?','Handa ka na ba?')}</Text>
      <Text style={s.overlayText}>{prompt}</Text>
      <Text style={s.overlayText}>{t(
        'Easy controls, harder stages. Complete each stage to unlock endless play. No real points or cash are awarded.',
        'Madaling controls, pahirap nang pahirap. Kumpletuhin ang mga yugto para sa walang katapusang laro. Walang totoong points o cash reward.'
      )}</Text>
      <Pressable accessibilityRole="button" style={[s.mainButton,{backgroundColor:game.accent}]} onPress={begin}>
        <Text style={s.darkText}>{t('▶ PLAY NOW','▶ MAGLARO')}</Text>
      </Pressable>
    </View> : null}

    {(phase==='playing'||phase==='paused') ? <>
      {track ? <View style={s.board} onTouchStart={e=>{touchX.current=e.nativeEvent.pageX;}}
          onTouchEnd={e=>{
            if(!canControl||!['catch','lane','runner'].includes(game.mode))return;
            const distance=e.nativeEvent.pageX-touchX.current;
            if(Math.abs(distance)>34)input(distance<0?'left':'right');
          }}>
        <View style={s.track}>
          {LANES.map(lane=><View key={lane} style={[s.trackLane,lane===1&&s.centerLane]} />)}
        </View>
        {game.mode==='rhythm' ? <View style={s.hitLine}><Text style={s.hitText}>♪ PERFECT ♪</Text></View>:null}
        {run.entities.map(item=><View pointerEvents="none" key={item.id}
          style={[s.entity,{top:(Math.min(80,item.y/6*82))+'%' as `${number}%`,
            left:(item.lane*33.333+4)+'%' as `${number}%`,backgroundColor:game.accent+'33'}]}>
          <Text style={s.entityIcon}>{iconFor(item.good,item.variant)}</Text>
        </View>)}
        {['catch','lane','runner'].includes(game.mode) ? <View pointerEvents="none"
          style={[s.player,{left:(run.lane*33.333+4)+'%' as `${number}%`,borderColor:game.accent}]}>
          <Text style={s.playerIcon}>{run.jumpUntil>=run.ticks && game.mode==='runner'?'⬆️':game.hero}</Text>
        </View>:null}
      </View>:null}

      {isTap ? <View style={s.tileBoard}>{CELLS.map(index=>{
        const reveal=game.mode==='tap'||run.ticks<run.flashUntil;
        const highlighted=index===run.cell&&reveal;
        return <Pressable key={index} accessibilityRole="button"
          accessibilityLabel={t('Tile','Puwesto')+' '+(index+1)}
          disabled={!canControl || (game.mode==='search' && run.ticks<run.flashUntil)}
          onPress={()=>input('cell',index)}
          style={[s.tile,highlighted&&{backgroundColor:game.accent+'77',borderColor:game.accent}]}>
          <Text style={s.tileText}>{highlighted?game.good[0]:'✦'}</Text>
        </Pressable>;
      })}</View>:null}

      {isStack ? <View style={s.stackBoard}>
        <Text style={s.stackHint}>{t('Keep the tower balanced.','Panatilihing balanse ang tore.')}</Text>
        <View style={s.stackCells}>{[0,1,2,3,4].map(index=><View key={index}
          style={[s.stackCell,index===run.target&&{borderColor:game.accent,borderWidth:3}]}>
          <Text style={s.stackEmoji}>{index===run.marker?'🧱':index===run.target?'⬇️':'·'}</Text>
        </View>)}</View>
        <Text style={s.stackTower}>{'🏗️'.repeat(Math.min(6,Math.floor(run.stageHits/2)+1))}</Text>
      </View>:null}

      {game.mode==='rhythm'||game.mode==='defend' ? <View style={s.controls}>
        {LANES.map((lane)=><Pressable key={lane} accessibilityRole="button" disabled={!canControl}
          style={[s.control,{borderColor:game.accent}]} onPress={()=>input('lane',lane)}>
          <Text style={s.controlText}>{game.mode==='rhythm'?'🎵':'🛡️'} {lane+1}</Text>
        </Pressable>)}
      </View>:null}
      {['catch','lane','runner'].includes(game.mode)?<View style={s.controls}>
        <Pressable accessibilityRole="button" style={[s.control,{borderColor:game.accent}]} disabled={!canControl}
          onPress={()=>input('left')}><Text style={s.controlText}>◀</Text></Pressable>
        {game.mode==='runner'?<Pressable accessibilityRole="button" style={[s.control,{borderColor:game.accent}]} disabled={!canControl}
          onPress={()=>input('jump')}><Text style={s.controlText}>{t('JUMP','TALON')} ⬆</Text></Pressable>:null}
        <Pressable accessibilityRole="button" style={[s.control,{borderColor:game.accent}]} disabled={!canControl}
          onPress={()=>input('right')}><Text style={s.controlText}>▶</Text></Pressable>
      </View>:null}
      {isStack?<Pressable accessibilityRole="button" disabled={!canControl}
        style={[s.mainButton,{backgroundColor:game.accent}]} onPress={()=>input('drop')}>
        <Text style={s.darkText}>{t('DROP BLOCK','IBAGSAK ANG BLOKE')}</Text>
      </Pressable>:null}
      <Pressable accessibilityRole="button" style={s.pause}
        onPress={()=>setPhase(phase==='playing'?'paused':'playing')}>
        <Text style={s.pauseText}>{phase==='paused'?t('▶ RESUME','▶ ITULOY'):t('Ⅱ PAUSE','Ⅱ IHINTO')}</Text>
      </Pressable>
      {phase==='paused'?<Text style={s.pausedNote}>{t('Paused—time is stopped.','Naka-pause—nakahinto ang oras.')}</Text>:null}
    </>:null}

    {phase==='clear'?<View style={s.overlay}>
      <Text style={s.overlayIcon}>🏆</Text>
      <Text style={s.bigTitle}>{t('STAGE CLEARED!','NATAPOS ANG YUGTO!')}</Text>
      <Text style={s.overlayText}>{t('Keep playing for a harder stage and higher mastery score.','Ituloy sa mas mahirap na yugto para sa mas mataas na score.')}</Text>
      <Pressable accessibilityRole="button" style={[s.mainButton,{backgroundColor:game.accent}]}
        onPress={()=>{setRun(previous=>nextArcadeStage(previous));setPhase('playing');}}>
        <Text style={s.darkText}>{t('NEXT STAGE','SUSUNOD NA YUGTO')} {run.stage+1} ▶</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.secondaryButton} onPress={finish}>
        <Text style={s.secondaryText}>{t('SAVE MY RUN','I-SAVE ANG LARO')}</Text>
      </Pressable>
    </View>:null}

    {phase==='lost'?<View style={s.overlay}>
      <Text style={s.overlayIcon}>💪</Text>
      <Text style={s.bigTitle}>{t('TRY AGAIN!','SUBUKAN MULI!')}</Text>
      <Text style={s.overlayText}>{t('Every attempt builds your skill.','Bawat subok ay dagdag na galing.')}</Text>
      <Pressable accessibilityRole="button" style={[s.mainButton,{backgroundColor:game.accent}]} onPress={begin}>
        <Text style={s.darkText}>{t('PLAY AGAIN','ULITIN')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.secondaryButton} onPress={finish}>
        <Text style={s.secondaryText}>{t('SAVE GAME-ONLY SCORE','I-SAVE ANG GAME SCORE')}</Text>
      </Pressable>
    </View>:null}

    {phase==='done'?<View style={s.overlay}>
      <Text style={s.overlayIcon}>✅</Text>
      <Text style={s.bigTitle}>{t('Run finished','Tapos ang laro')}</Text>
      <Text style={s.overlayText}>{t('Your result was sent to local preview storage. No BP, Character Points, XP or cash were issued.',
        'Ipinasa ang resulta sa local game record. Walang BP, Character Points, XP o cash na ibinigay.')}</Text>
      <Pressable accessibilityRole="button" style={[s.mainButton,{backgroundColor:game.accent}]} onPress={begin}>
        <Text style={s.darkText}>{t('PLAY AGAIN','ULITIN')}</Text>
      </Pressable>
    </View>:null}
  </View>;
}

const s=StyleSheet.create({
  shell:{width:'100%',maxWidth:820,alignSelf:'center',borderWidth:1,borderRadius:18,backgroundColor:'#102237',
    padding:12,gap:10,overflow:'hidden'},
  heading:{flexDirection:'row',alignItems:'center',gap:12},heroCircle:{width:66,height:66,alignItems:'center',
    justifyContent:'center',borderWidth:2,borderRadius:36,backgroundColor:'#32435a'},
  hero:{fontSize:32},headingCopy:{flex:1,gap:2},kicker:{fontSize:10,letterSpacing:1.1,fontWeight:'900',color:'#e0d3ad'},
  title:{fontSize:23,fontWeight:'900',color:'#fff4db'},help:{fontSize:12,lineHeight:17,color:'#e2e9f1'},
  hud:{flexDirection:'row',gap:5,justifyContent:'space-between',flexWrap:'wrap'},
  hudItem:{minWidth:68,flex:1,padding:7,borderRadius:10,backgroundColor:'#20334e'},
  hudLabel:{fontSize:8,letterSpacing:.4,fontWeight:'900',color:'#b9cfe4'},
  hudValue:{fontSize:15,fontWeight:'900',color:'#fff2cd'},
  progressBack:{height:7,borderRadius:5,backgroundColor:'#30455c',overflow:'hidden'},
  progressFill:{height:'100%',borderRadius:5},progressText:{fontSize:11,color:'#d6e8f7',textAlign:'center'},
  overlay:{minHeight:270,padding:17,alignItems:'center',justifyContent:'center',gap:12,
    borderRadius:15,backgroundColor:'#1d3855'},overlayIcon:{fontSize:58},bigTitle:{fontSize:23,fontWeight:'900',color:'#fff0d1',textAlign:'center'},
  overlayText:{fontSize:13,lineHeight:19,color:'#e1edfd',textAlign:'center'},
  mainButton:{minHeight:49,width:'100%',borderRadius:12,alignItems:'center',justifyContent:'center',padding:11},
  darkText:{color:'#162b3c',fontSize:13,fontWeight:'900'},
  secondaryButton:{padding:12,borderWidth:1,borderColor:'#bdcbe0',borderRadius:10,width:'100%',alignItems:'center'},
  secondaryText:{color:'#f9e7c5',fontWeight:'800',fontSize:12},
  board:{height:330,maxWidth:420,width:'100%',alignSelf:'center',borderRadius:16,overflow:'hidden',backgroundColor:'#234163',
    borderWidth:1,borderColor:'#5e7391',position:'relative'},
  track:{...StyleSheet.absoluteFillObject,flexDirection:'row'},
  trackLane:{flex:1,borderRightWidth:1,borderColor:'#7a9abe55',backgroundColor:'#334e6a44'},
  centerLane:{backgroundColor:'#526b8355'},
  entity:{position:'absolute',width:'26%',height:52,borderRadius:15,alignItems:'center',justifyContent:'center'},
  entityIcon:{fontSize:30},player:{position:'absolute',top:'81%',width:'26%',height:55,borderRadius:18,
    backgroundColor:'#18253b',borderWidth:2,alignItems:'center',justifyContent:'center'},
  playerIcon:{fontSize:29},hitLine:{position:'absolute',top:'73%',left:0,right:0,borderBottomWidth:3,borderColor:'#f2da87',alignItems:'center'},
  hitText:{color:'#ffe8a6',fontWeight:'900',fontSize:9},
  controls:{flexDirection:'row',gap:8,justifyContent:'center'},
  control:{flex:1,maxWidth:160,minHeight:49,borderWidth:2,borderRadius:12,backgroundColor:'#29445d',
    alignItems:'center',justifyContent:'center',padding:6},
  controlText:{color:'#fff3cf',fontWeight:'900',fontSize:14},
  tileBoard:{alignSelf:'center',maxWidth:420,width:'100%',flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6},
  tile:{width:'31%',aspectRatio:1,borderWidth:1,borderRadius:16,borderColor:'#617d9b',backgroundColor:'#2a4564',
    alignItems:'center',justifyContent:'center'},
  tileText:{fontSize:34,color:'#e6f2ff'},
  stackBoard:{minHeight:235,justifyContent:'center',gap:18,alignItems:'center'},
  stackHint:{fontSize:13,color:'#e5e9f6'},
  stackCells:{flexDirection:'row',width:'100%',maxWidth:420,justifyContent:'space-between',gap:3},
  stackCell:{flex:1,aspectRatio:.9,backgroundColor:'#284665',borderWidth:1,borderColor:'#537691',
    alignItems:'center',justifyContent:'center',borderRadius:9},
  stackEmoji:{fontSize:28},stackTower:{fontSize:28},
  pause:{alignSelf:'center',padding:9},pauseText:{color:'#dbe8f6',fontSize:12,fontWeight:'900'},
  pausedNote:{color:'#f1dca3',textAlign:'center',fontWeight:'900'},
});
