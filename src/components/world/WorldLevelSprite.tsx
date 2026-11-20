import React, {useEffect,useMemo,useRef,useState} from 'react';
import {
  AccessibilityInfo,Animated,Image,StyleSheet,Text,View,
  type ImageSourcePropType,
} from 'react-native';
import {
  chooseWorldSpriteAsset,mayShowWorldSpriteFrame,resolveWorldSpriteFrame,
  type WorldSpriteFrame,type WorldSpriteProgress,
} from '@/features/world/worldSpriteFrame';

export type WorldLevelSpriteProps = {
  progress:WorldSpriteProgress;
  /** Values must use literal, statically imported `require()` bundled PNG assets. */
  sprites:Readonly<Partial<Record<string,ImageSourcePropType>>>;
  width?:number;
  height?:number;
  active?:boolean;
  disableMotion?:boolean;
};

/** Asset-only, fail-closed World renderer. Not an upgrade or reward control. */
export default function WorldLevelSprite({
  progress,sprites,width=280,height=200,active=true,disableMotion=false,
}:WorldLevelSpriteProps) {
  const next=useMemo(()=>resolveWorldSpriteFrame(progress),[
    progress.worldId,progress.track,progress.level,progress.stage,
    progress.revision,progress.origin,progress.receiptId,
  ]);
  const [current,setCurrent]=useState<WorldSpriteFrame>(next);
  const [previous,setPrevious]=useState<WorldSpriteFrame|null>(null);
  const currentRef=useRef(next);
  const animationRef=useRef<Animated.CompositeAnimation|null>(null);
  const generation=useRef(0);
  const fade=useRef(new Animated.Value(1)).current;
  const scale=useRef(new Animated.Value(1)).current;
  const [reduceMotion,setReduceMotion]=useState(false);

  useEffect(()=>{
    let live=true;
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{
      if(live)setReduceMotion(Boolean(value));
    }).catch(()=>{});
    const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return()=>{live=false;subscription.remove();};
  },[]);

  useEffect(()=>{
    const last=currentRef.current;
    if(!mayShowWorldSpriteFrame(last,next))return;
    if(next.worldId===last.worldId && next.track===last.track &&
       next.frameKey===last.frameKey && next.status===last.status &&
       next.revision===last.revision)return;
    generation.current+=1;
    const token=generation.current;
    animationRef.current?.stop();
    animationRef.current=null;
    currentRef.current=next;
    const from=chooseWorldSpriteAsset(last,sprites);
    const to=chooseWorldSpriteAsset(next,sprites);
    const animate=active&&!disableMotion&&!reduceMotion&&
      from.source!=null&&to.source!=null&&last.worldId===next.worldId &&
      last.status!=='unavailable'&&next.status!=='unavailable' &&
      from.artKey!==to.artKey;
    if(!animate){
      setPrevious(null);setCurrent(next);fade.setValue(1);scale.setValue(1);
      return;
    }
    setPrevious(last);
    setCurrent(next);
    fade.setValue(0);scale.setValue(1.035);
    const animation=Animated.parallel([
      Animated.timing(fade,{toValue:1,duration:420,useNativeDriver:true}),
      Animated.spring(scale,{toValue:1,speed:14,bounciness:2,useNativeDriver:true}),
    ]);
    animationRef.current=animation;
    animation.start(({finished})=>{
      if(finished&&generation.current===token){setPrevious(null);animationRef.current=null;}
    });
  },[next,active,disableMotion,reduceMotion,fade,scale,sprites]);
  useEffect(()=>()=>{
    generation.current+=1;
    animationRef.current?.stop();
  },[]);

  // Do not display the previous account/world even for a single paint before the effect runs.
  const visibleFrame=current.worldId===next.worldId?current:next;
  const shown=chooseWorldSpriteAsset(visibleFrame,sprites);
  const old=current.worldId===next.worldId&&previous?chooseWorldSpriteAsset(previous,sprites):null;
  const caption=visibleFrame.status==='preview'?'Design preview only':
    visibleFrame.status==='unavailable'?'No verified progress available':
    shown.isFallback?'Construction artwork pending':
    visibleFrame.stage>0?'Verified construction stage':
    visibleFrame.completedLevel===0?'Verified vacant state':'Verified completed level';
  return <View style={[styles.container,{width,height}]} accessible
    accessibilityLabel={`${visibleFrame.label}. ${caption}`}>
    {old?.source?<Image source={old.source} resizeMode="contain" style={StyleSheet.absoluteFill}/>:null}
    {shown.source?<Animated.Image source={shown.source} resizeMode="contain"
      style={[StyleSheet.absoluteFill,{opacity:fade,transform:[{scale}]}]}/>:null}
    {!shown.source?<View style={styles.pending}>
      <Text style={styles.pendingTitle}>{visibleFrame.label}</Text>
      <Text style={styles.pendingText}>{visibleFrame.completedLevel===0&&visibleFrame.stage===0
        ?'Ready to start construction':'Approved PNG artwork not installed'}</Text>
    </View>:null}
    <View pointerEvents="none" style={styles.captionBar}>
      <Text style={styles.captionText}>{caption}</Text>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  container:{overflow:'hidden',borderRadius:14,backgroundColor:'#10203B'},
  pending:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:12},
  pendingTitle:{color:'#F8F3E3',fontWeight:'700',fontSize:14,textAlign:'center'},
  pendingText:{color:'#D0DCF0',fontSize:11,marginTop:5,textAlign:'center'},
  captionBar:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:8,paddingVertical:5,backgroundColor:'rgba(6,15,31,0.85)'},
  captionText:{color:'#F7F2DF',fontSize:10,textAlign:'center'},
});
