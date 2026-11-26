import React, { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { WallPostDesign } from '@/lib/buklodWallPostDesigns';

// One bounded procedural pass, no image downloads or per-frame JS updates.
// Time is a circular phase, so each 22-second animation loops seamlessly.
const SOURCE = `
uniform float2 size;
uniform float phase;
uniform float scene;
uniform float seed;
uniform float3 baseA;
uniform float3 baseB;
uniform float3 accent;
float hash(float2 p){ return fract(sin(dot(p,float2(127.1,311.7)))*43758.5453); }
float noise(float2 p){
 float2 i=floor(p), f=fract(p);
 f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+float2(1,0)),f.x),mix(hash(i+float2(0,1)),hash(i+1.0),f.x),f.y);
}
float cloud(float2 p){return noise(p)*.57+noise(p*2.03+11.0)*.29+noise(p*4.08+7.0)*.14;}
float stars(float2 p,float flicker){
 float2 cell=floor(p), f=fract(p)-.5;
 float h=hash(cell+seed);
 float2 pos=float2(hash(cell+1.7),hash(cell+8.2))*.55-.275;
 float d=length(f-pos);
 return step(.86,h)*(1.0-smoothstep(.017,.095,d))*(.55+.45*sin(flicker+h*31.0));
}
half4 main(float2 xy){
 float2 uv=xy/max(size,float2(1.0));
 float2 p=uv-.5;
 p.x*=size.x/max(size.y,1.0);
 float2 motion=float2(cos(phase),sin(phase));
 float3 bg=mix(baseA,baseB,clamp(.15+uv.x*.43+uv.y*.42,0.0,1.0));
 float fog=cloud(p*3.2+motion*.32+seed);
 float light=0.0, detail=0.0;
 // Foliage/light, water/crystal, architecture, aurora, fire, galaxy, celestial.
 if(scene<1.5){
   float canopy=cloud(float2(p.x*6.0,p.y*9.0)+motion*.4);
   light=pow(max(0.0,1.0-length(p-float2(-.57,-.35))),2.0)*.75;
   detail=canopy*.38+stars(p*13.0+motion*.2,phase)*.6;
 } else if(scene<2.5){
   float r=length(p-float2(.58,.30));
   detail=pow(.5+.5*sin(r*32.0+sin(phase)*2.0+fog*3.0),6.0)*.5;
   light=pow(max(0.0,1.0-r),3.0);
 } else if(scene<3.5){
   float2 q=abs(p);
   float frame=1.0-smoothstep(.006,.028,abs(q.y-.42));
   float pillar=pow(abs(cos(p.x*13.0)),16.0)*.28;
   light=pow(max(0.0,1.0-abs(p.x-.55*sin(phase))),8.0)*.6;
   detail=frame*.5+pillar+fog*.17;
 } else if(scene<4.5){
   float ribbon=p.y+.32+sin(p.x*4.0+motion.x)*.16+fog*.14;
   light=exp(-abs(ribbon)*12.0)*.85+exp(-abs(ribbon+.18)*19.0)*.45;
   detail=cloud(p*float2(4.0,12.0)+motion*.45)*.35;
 } else if(scene<5.5){
   float flame=cloud(float2(p.x*5.0,p.y*10.0)+motion*.7);
   light=pow(max(0.0,uv.y),3.0)*flame;
   detail=pow(flame,3.0)*.8+stars(p*19.0+motion*.22,phase)*.65;
 } else {
   float2 center=float2(.50+.045*motion.x,-.30+.035*motion.y);
   float2 q=p-center;
   float radius=length(q);
   float a=atan(q.y,q.x);
   float spiral=.5+.5*sin(a*3.0-radius*13.0+fog*3.0+motion.x*.6);
   float disc=exp(-radius*2.2);
   light=disc*(.28+spiral*.58)*fog;
   detail=stars(p*24.0+motion*.15,phase)*.85+stars(p*11.0+motion*.1,phase+2.0)*.45;
   if(scene>6.5){
     light+=exp(-abs(radius-.27)*28.0)*.55;
     detail+=pow(max(0.0,cos(a*6.0+motion.y*.2)),18.0)*disc*.35;
   }
 }
 // Keep a calm text-safe center; contrast is driven by the base palette,
 // never an unbounded bloom. More luminous detail stays at the edges.
 float edge=smoothstep(.28,.64,length((uv-.5)*float2(1.2,1.0)));
 float strength=clamp((light*.29+detail*.20+fog*.09)*(.20+.80*edge),0.0,.25);
 float3 col=mix(bg,accent,strength);
 return half4(half3(col),1.0);
}
`;
let effect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;
function getEffect(){ if(effect===undefined){try{effect=Skia.RuntimeEffect.Make(SOURCE);}catch{effect=null;}} return effect; }
function rgb(hex:string){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function designSeed(id:string){return Array.from(id).reduce((s,c)=>(s*31+c.charCodeAt(0))%997,0)/97;}
export default memo(function BuklodLivingWallArt({design,active=false}:{design:WallPostDesign;active?:boolean}){
 const [appActive,setAppActive]=useState(AppState.currentState==='active');
 const [allowMotion,setAllowMotion]=useState(false);
 const [size,setSize]=useState({width:0,height:0});
 const phase=useSharedValue(0);
 useEffect(()=>{
   if(!active)return;
   let mounted=true;
   setAppActive(AppState.currentState==='active');
   AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(mounted)setAllowMotion(!v);}).catch(()=>{});
   const a=AppState.addEventListener('change',s=>setAppActive(s==='active'));
   const b=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>setAllowMotion(!v));
   return()=>{mounted=false;a.remove();b.remove();setAllowMotion(false);};
 },[active]);
 const running=active&&appActive&&allowMotion&&size.width>0&&size.height>0;
 const source=useMemo(()=>active?getEffect():null,[active]);
 useEffect(()=>{
   cancelAnimation(phase);phase.value=0;
   if(running&&source)phase.value=withRepeat(withTiming(Math.PI*2,{duration:22000,easing:Easing.linear}),-1,false);
   return()=>cancelAnimation(phase);
 },[phase,running,source]);
 const params=useMemo(()=>({size:[size.width,size.height],scene:design.minFamilyIndex,seed:designSeed(design.id),baseA:rgb(design.start),baseB:rgb(design.end),accent:rgb(design.ink)}),[design,size]);
 const uniforms=useDerivedValue(()=>({...params,phase:phase.value}),[params]);
 if(!active||!appActive||!allowMotion||!source)return null;
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
   style={StyleSheet.absoluteFill} onLayout={e=>{const {width,height}=e.nativeEvent.layout;setSize(old=>old.width===width&&old.height===height?old:{width,height});}}>
   {running&&<Canvas style={StyleSheet.absoluteFill}><Fill><Shader source={source} uniforms={uniforms}/></Fill></Canvas>}
 </View>;
});
