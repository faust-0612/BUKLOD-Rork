import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, View } from 'react-native';
import type { BuklodPostMotionPreset } from '@/lib/buklodPostCreatives';

// Reuses the existing lightweight Animated API. No video rendering, added
// native packages, expensive blur filters or audio player initialization.
type Props = { preset:BuklodPostMotionPreset; children:ReactNode; active?:boolean };
const AMBIENT=new Set<BuklodPostMotionPreset>([
  'rain','storm','snow','mist','sparkles','fireflies','petals','sunrays',
  'dust','bokeh','stars','autumn','underwater',
]);
const PARTICLES=Array.from({length:20},(_,i)=>({
  x:(i*37+7)%97,y:(i*29+11)%87,scale:0.7+((i*13)%9)/10,
  reverse:i%3===0,
}));
export default function BuklodPostMotion({preset,children,active=true}:Props){
  const progress=useRef(new Animated.Value(0)).current;
  const [reduceMotion,setReduceMotion]=useState(false);
  const [appActive,setAppActive]=useState(Platform.OS==='web'||AppState.currentState==='active');
  useEffect(()=>{
    let mounted=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v=>{
      if(mounted)setReduceMotion(Boolean(v));
    }).catch(()=>undefined);
    const accessibility=AccessibilityInfo.addEventListener?.('reduceMotionChanged',setReduceMotion);
    const app=AppState.addEventListener('change',state=>setAppActive(state==='active'));
    return ()=>{mounted=false;accessibility?.remove?.();app.remove();};
  },[]);
  const running=active&&appActive&&!reduceMotion&&preset!=='none';
  useEffect(()=>{
    progress.stopAnimation();
    progress.setValue(0);
    if(!running)return;
    const weather=preset==='rain'||preset==='storm';
    const animation=Animated.loop(Animated.timing(progress,{
      toValue:1,duration:weather?2600:7600,
      easing:Easing.linear,useNativeDriver:Platform.OS!=='web',
    }));
    animation.start();
    return ()=>animation.stop();
  },[running,preset,progress]);
  if(preset==='none')return <>{children}</>;
  const scale=progress.interpolate({inputRange:[0,1],outputRange:[1,1.035]});
  const x=progress.interpolate({inputRange:[0,1],outputRange:[-4,4]});
  const y=progress.interpolate({inputRange:[0,1],outputRange:[-3,3]});
  const opacity=progress.interpolate({inputRange:[0,1],outputRange:[1,.78]});
  const motionStyle=preset==='zoom'?{transform:[{scale}]}:
    preset==='pan'?{transform:[{translateX:x}]}:
    preset==='float'?{transform:[{translateY:y}]}:
    preset==='fade'?{opacity}:{};
  const weather=preset==='rain'||preset==='storm';
  const falling=weather||preset==='snow'||preset==='petals'||preset==='autumn';
  const rising=preset==='fireflies'||preset==='underwater';
  const mist=preset==='mist'||preset==='sunrays';
  const count=preset==='storm'?20:weather?16:mist?4:12;
  const tint=weather?'#badde7':preset==='snow'?'#ffffff':
    preset==='fireflies'?'#f8dc70':preset==='petals'?'#ffb6cc':
    preset==='sunrays'?'#ffe8a2':preset==='dust'?'#f1d7a4':
    preset==='bokeh'?'#ffeab9':preset==='stars'?'#ffffff':
    preset==='autumn'?'#eaa34d':preset==='underwater'?'#a3ebf5':
    preset==='mist'?'#e6edf2':'#fff4ce';
  return (
    <View style={{position:'relative',overflow:'hidden',borderRadius:12}}>
      <Animated.View style={motionStyle}>{children}</Animated.View>
      {AMBIENT.has(preset)&&running&&(
        <View pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{position:'absolute',left:0,right:0,top:0,bottom:0,overflow:'hidden'}}>
          {PARTICLES.slice(0,count).map((p,i)=>{
            const h=mist?95:weather?28:falling?8:8;
            const w=mist?75:weather?1.5:falling?6:8;
            const drift=progress.interpolate({inputRange:[0,1],
              outputRange:[p.reverse?-22:12,p.reverse?12:-22]});
            const vertical=progress.interpolate({inputRange:[0,1],
              outputRange:falling?[-80,270]:rising?[130,-230]:[-8,10]});
            const glow=progress.interpolate({inputRange:[0,.5,1],
              outputRange:[.13,.43,.13]});
            return (
              <Animated.View key={i} style={{
                position:'absolute',left:(p.x+'%') as `${number}%`,
                top:(p.y+'%') as `${number}%`,
                width:w*p.scale,height:h*p.scale,
                borderRadius:mist?50:weather?1:20,
                backgroundColor:tint,
                opacity:weather?(preset==='storm'?.55:.32):
                  falling?.65:mist?.12:glow,
                transform:[
                  {translateY:falling||rising?vertical:0},
                  {translateX:weather?0:drift},
                  {rotate:weather?'17deg':preset==='autumn'||preset==='petals'?'35deg':'0deg'},
                ],
              }}/>
            );
          })}
          {preset==='storm'&&(
            <Animated.View style={{position:'absolute',left:0,right:0,top:0,bottom:0,
              backgroundColor:'#d9ebff',
              opacity:progress.interpolate({inputRange:[0,.48,.50,.52,1],
                outputRange:[0,0,.15,0,0]})}}/>
          )}
        </View>
      )}
    </View>
  );
}
