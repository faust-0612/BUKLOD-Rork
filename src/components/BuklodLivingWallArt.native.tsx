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
float h(float2 p){return fract(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
float n(float2 p){float2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+float2(1,0)),f.x),mix(h(i+float2(0,1)),h(i+1.),f.x),f.y);}
float fb(float2 p){return .57*n(p)+.29*n(p*2.03+7.)+.14*n(p*4.09+13.);}
float soft(float d,float w){return 1.-smoothstep(0.,w,d);}
float hill(float x,float k){return .48+.09*sin(x*7.+k)+.05*sin(x*15.+k*1.7)+.04*fb(float2(x*12.,k));}
float3 render(float2 xy){
 float2 uv=xy/max(size,float2(1.));float2 p=uv-.5;p.x*=size.x/max(size.y,1.);float2 m=float2(cos(phase),sin(phase));float t=seed;
 float3 bg=mix(baseA,baseB,clamp(.18+uv.x*.32+uv.y*.43,0.,1.));float3 gold=float3(1.,.72,.29),ice=float3(.46,.84,1.),dark=baseA*.35;
 bool light=dot(accent,float3(.2126,.7152,.0722))<.45;float3 shine=light?gold:mix(accent,gold,.25);float3 c=bg;float f=fb(p*4.+m*.24+t);
 if(scene<1.5){
  float2 sun=float2(-.63,-.32);float r=length(p-sun);c=mix(c,shine,.55*exp(-r*4.)+.4*soft(r-.075,.012));
  for(int j=0;j<3;j++){float z=float(j);float ridge=hill(uv.x,z*2.+t)+z*.13;c=mix(c,mix(baseB,dark,.28+z*.25),smoothstep(ridge-.005,ridge+.008,uv.y)*.83);}
  for(int j=0;j<2;j++){float z=float(j);float q=uv.x*(10.+z*5.)+z*.41;float cell=floor(q),x=fract(q)-.5;float top=1.-(.22+.26*h(float2(cell,z+t)));float sway=.05*sin(phase+cell*.8+uv.y*4.);float trunk=soft(abs(x-sway)-.035,.018)*smoothstep(top,top+.02,uv.y);float crown=soft(length(float2((x-sway)*1.6,(uv.y-top-.04)*4.))-.28,.12);c=mix(c,mix(baseA,dark,.3+z*.32),max(trunk,crown)*.91);}
  float beam=pow(max(0.,cos(atan(p.y-sun.y,p.x-sun.x)*13.+.4*m.y)),8.)*exp(-r*1.8);c=mix(c,shine,beam*.18);
 }else if(scene<2.5){
  float2 moon=float2(.60,-.28);float r=length(p-moon);c=mix(c,ice,.35*exp(-r*4.));c=mix(c,shine,.9*soft(r-.10,.008));float ridge=hill(uv.x,t)*.66+.05;c=mix(c,dark,smoothstep(ridge-.005,ridge+.008,uv.y)*.86);
  float water=smoothstep(.50,.51,uv.y);float wave=sin(uv.y*90.+sin(uv.x*10.+phase)*1.1+f*3.+m.y*1.3);float reflection=exp(-abs(p.x-moon.x+wave*.03)*7.)*pow(.5+.5*wave,4.);c=mix(c,mix(baseA,baseB,.5+wave*.15),water);c=mix(c,ice,water*reflection*.72);
  float crystal=soft(abs(p.x+.66)-(.10-abs(p.y-.20)*.2),.008)*smoothstep(.02,.08,p.y);c=mix(c,mix(ice,baseB,.4),crystal*.65);
 }else if(scene<3.5){
  float x=abs(p.x);float pil=soft(abs(x-.65)-.10,.008);float flutes=.5+.5*cos(x*135.);float band=soft(abs(abs(p.y)-.40)-.018,.008);float arch=soft(abs(length(float2(p.x,p.y+.08))-.78)-.028,.01);float3 stone=mix(baseA,gold,.30+flutes*.14+f*.10);c=mix(c,stone,max(pil,band)*.85);c=mix(c,shine,arch*.65+band*.13);float sweep=exp(-abs(p.x-.85*m.x)*7.)*max(pil,arch);c=mix(c,gold,sweep*.72);
 }else if(scene<4.5){
  for(int j=0;j<3;j++){float z=float(j);float ribbon=p.y+.27+z*.07+sin(p.x*3.8+m.x*.55+z)*.14+fb(p*3.+t)*.1;float glow=exp(-abs(ribbon)*(14.+z*8.));c=mix(c,mix(ice,float3(.20,1.,.66),z*.38),glow*.44);}
  float land=hill(uv.x,t)*.49+.29;c=mix(c,dark,smoothstep(land,land+.009,uv.y)*.87);float w=smoothstep(.61,.62,uv.y);float waves=sin(uv.y*72.+sin(uv.x*12.+phase)*1.4+f*4.);c=mix(c,mix(baseA,baseB,.43+waves*.22),w);c=mix(c,ice,w*pow(.5+.5*waves,8.)*.34);
 }else if(scene<5.5){
  float flameHeight=.20+.24*fb(float2(p.x*6.+m.x*.65,p.y*2.+t));float tongues=fb(float2(p.x*10.+m.x*.75,p.y*7.+m.y*.6));float flame=smoothstep(.01,.12,p.y+flameHeight)*pow(tongues,1.8);c=mix(c,float3(.92,.18,.055),flame*.84);c=mix(c,gold,pow(flame,2.)*.84);
  float x=abs(p.x);float crownTop=.22+.12*abs(sin(p.x*11.));float crown=soft(x-.45,.012)*smoothstep(crownTop,crownTop+.02,p.y)*soft(p.y-.44,.01);float metal=.5+.5*cos(p.x*30.+p.y*9.+m.x*2.);c=mix(c,mix(float3(.35,.13,.03),gold,metal*.65+.22),crown*.90);
 }else{
  float2 center=float2(.57+.045*m.x,-.18+.035*m.y),q=p-center;float r=length(q),a=atan(q.y,q.x);float neb=fb(p*5.+m*.45+t);float spiral=pow(.5+.5*sin(a*3.-r*17.+neb*4.+m.x*.5),3.);c=mix(c,mix(ice,float3(.75,.32,.91),neb),exp(-r*1.9)*(.25+spiral*.6)*neb);
  float2 cells=p*31.;float star=step(.972,h(floor(cells)+t))*soft(length(fract(cells)-.5)-.025,.08);c=mix(c,float3(1.),star*.8);float rad=.20;float disk=soft(r-rad,.006);float normal=sqrt(max(0.,1.-dot(q,q)/(rad*rad)));float lit=max(0.,dot(float3(q/rad,normal),float3(-.64,-.48,.55)));float bands=fb(q*float2(7.,45.)+m*.3+t);float3 planet=mix(baseA,mix(ice,gold,.3),clamp(lit*(.55+bands*.4),0.,1.));c=mix(c,planet,disk);float ring=soft(abs(length(float2(q.x,q.y*3.1))-(rad+.09))-.012,.012);c=mix(c,shine,ring*.75*(1.-disk*.65));c=mix(c,ice,exp(-abs(r-rad)*57.)*.37);
  if(scene>6.5){float ray=pow(max(0.,cos(a*8.+m.x*.5)),12.)*exp(-r*2.);float halo=exp(-abs(r-.34)*26.);c=mix(c,gold,ray*.38+halo*.38);}
 }
 float edge=smoothstep(.17,.68,length((uv-.5)*float2(1.1,1.)));float3 veil=light?mix(baseA,float3(1.),.25):mix(baseA,float3(0.),.18);c=mix(veil,c,.32+.68*edge);return clamp(c,0.,1.);
}
half4 main(float2 xy){return half4(half3(render(xy)),1.0);}
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
 if(!active||!appActive||!source)return null;
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
   style={StyleSheet.absoluteFill} onLayout={e=>{const {width,height}=e.nativeEvent.layout;setSize(old=>old.width===width&&old.height===height?old:{width,height});}}>
   {size.width>0&&size.height>0&&<Canvas style={StyleSheet.absoluteFill}><Fill><Shader source={source} uniforms={uniforms}/></Fill></Canvas>}
 </View>;
});
