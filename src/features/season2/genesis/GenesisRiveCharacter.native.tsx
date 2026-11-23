import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,AppState,Image,View,type ImageSourcePropType} from 'react-native';
import {Fit,RiveView,useRiveFile} from '@rive-app/react-native';
import {getGenesisApprovedRig} from './genesisAssetRegistry';
type Props={rigId?:string|null;active:boolean;width:number;height:number;fallback?:React.ReactNode};
// Original 8-frame 4x2 full-body character animation sheets already approved and vendored for Godot.
const IDLE_SHEETS:Readonly<Record<string,ImageSourcePropType>>={
  ace:require('../../../../godot/empire-arena/art/fullbody/ace_idle.png'),
  angel:require('../../../../godot/empire-arena/art/fullbody/angel_idle.png'),
  christian:require('../../../../godot/empire-arena/art/fullbody/christian_idle.png'),
  ellusur:require('../../../../godot/empire-arena/art/fullbody/ellusur_idle.png'),
  jawo:require('../../../../godot/empire-arena/art/fullbody/jawo_idle.png'),
  lhen:require('../../../../godot/empire-arena/art/fullbody/lhen_idle.png'),
  mitch:require('../../../../godot/empire-arena/art/fullbody/mitch_idle.png'),
  niel:require('../../../../godot/empire-arena/art/fullbody/niel_idle.png'),
  phan:require('../../../../godot/empire-arena/art/fullbody/phan_idle.png'),
  quin:require('../../../../godot/empire-arena/art/fullbody/quin_idle.png'),
  trudice:require('../../../../godot/empire-arena/art/fullbody/trudice_idle.png'),
  van:require('../../../../godot/empire-arena/art/fullbody/van_idle.png'),
  vhen:require('../../../../godot/empire-arena/art/fullbody/vhen_idle.png'),
};
function ApprovedRig({uri,width,height,fallback}:{uri:string;width:number;height:number;fallback?:React.ReactNode}){
  const {riveFile,isLoading,error}=useRiveFile({uri});
  if(isLoading||error||!riveFile)return <>{fallback??null}</>;
  return <RiveView file={riveFile} autoPlay fit={Fit.Contain} style={{width,height}}/>;
}
function FrameHero({id,active,width,height}:{id:string;active:boolean;width:number;height:number}){
  const [frame,setFrame]=useState(0);
  const [reduceMotion,setReduceMotion]=useState(false);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{
    let live=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live)setReduceMotion(Boolean(value));}).catch(()=>undefined);
    const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{if(live)setReduceMotion(Boolean(value));});
    const state=AppState.addEventListener('change',value=>setForeground(value==='active'));
    return()=>{live=false;motion.remove();state.remove();};
  },[]);
  useEffect(()=>{
    setFrame(0);
    if(!active||reduceMotion||!foreground)return;
    const ticker=setInterval(()=>setFrame(value=>(value+1)%8),125);
    return()=>clearInterval(ticker);
  },[active,reduceMotion,foreground,id]);
  const cellHeight=Math.min(height,width*1.5);
  const cellWidth=cellHeight*2/3;
  const column=frame%4;
  const row=Math.floor(frame/4);
  return <View pointerEvents="none" accessible={false} style={{width:cellWidth,height:cellHeight,overflow:'hidden'}}>
    <Image source={IDLE_SHEETS[id]} resizeMode="stretch" fadeDuration={0}
      style={{position:'absolute',left:-column*cellWidth,top:-row*cellHeight,
        width:cellWidth*4,height:cellHeight*2}}/>
  </View>;
}
/** Approved Rive plays when available; otherwise actual local animated frames, never fake portrait bobbing. */
export default function GenesisRiveCharacter({rigId,active,width,height,fallback}:Props){
  const approved=getGenesisApprovedRig(rigId);
  const id=rigId??'';
  const art=Object.prototype.hasOwnProperty.call(IDLE_SHEETS,id);
  const renderedFallback=art?<FrameHero id={id} active={active} width={width} height={height}/>:fallback??null;
  return <View style={{width,height,alignItems:'center',justifyContent:'center'}}>
    {active&&approved?<ApprovedRig uri={approved.uri} width={width} height={height} fallback={renderedFallback}/>:renderedFallback}
  </View>;
}
