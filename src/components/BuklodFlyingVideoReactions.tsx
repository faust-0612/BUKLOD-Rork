import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type BuklodVideoReactionBurst = { id: number; postId: string; emoji: string };

function FlyingReaction({ burst, onComplete }:{
  burst: BuklodVideoReactionBurst;
  onComplete: (id: number) => void;
}) {
  const progress=useRef(new Animated.Value(0)).current;
  const completeRef=useRef(onComplete);
  completeRef.current=onComplete;
  useEffect(()=>{
    const animation=Animated.timing(progress,{
      toValue:1,duration:1180,easing:Easing.out(Easing.cubic),useNativeDriver:true,
    });
    animation.start(({finished})=>{if(finished)completeRef.current(burst.id);});
    return ()=>animation.stop();
  },[burst.id,progress]);
  const opacity=progress.interpolate({
    inputRange:[0,0.12,0.78,1],outputRange:[0,1,1,0],
  });
  const rise=progress.interpolate({inputRange:[0,1],outputRange:[0,-190]});
  const scale=progress.interpolate({
    inputRange:[0,0.25,1],outputRange:[0.65,1.17,0.94],
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[-34,8,40].map((offset,index)=>(
        <Animated.Text key={index} accessible={false} style={[
          styles.emoji,{
            right:44+offset,bottom:index*7,fontSize:index===1?32:25,
            opacity,
            transform:[
              {translateY:rise},
              {translateX:progress.interpolate({
                inputRange:[0,0.6,1],outputRange:[0,offset*0.45,offset*0.8],
              })},
              {scale},
            ],
          },
        ]}>{burst.emoji}</Animated.Text>
      ))}
    </View>
  );
}

/** Local bounded animation; no network, polling or player allocation. */
export const BuklodFlyingVideoReactions=React.memo(function BuklodFlyingVideoReactions({
  bursts,bottom,onComplete,
}:{
  bursts:BuklodVideoReactionBurst[];
  bottom:number;
  onComplete:(id:number)=>void;
}) {
  if(!bursts.length)return null;
  return (
    <View pointerEvents="none" style={[styles.overlay,{bottom}]}>
      {bursts.map(burst=>(
        <FlyingReaction key={burst.id} burst={burst} onComplete={onComplete}/>
      ))}
    </View>
  );
});
const styles=StyleSheet.create({
  overlay:{position:'absolute',right:8,width:156,height:225,overflow:'visible'},
  emoji:{
    position:'absolute',textAlign:'center',
    textShadowColor:'rgba(0,0,0,0.65)',textShadowRadius:4,
  },
});
