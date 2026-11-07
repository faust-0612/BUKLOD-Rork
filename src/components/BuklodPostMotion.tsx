import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BuklodPostMotionPreset } from '@/lib/buklodPostCreatives';

export default function BuklodPostMotion({ preset, children }: {
  preset: BuklodPostMotionPreset; children: ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (active) setReduceMotion(Boolean(v));
    }).catch(() => undefined);
    const sub=AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => { active=false; sub?.remove?.(); };
  }, []);
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (preset === 'none' || reduceMotion || !playing) return;
    const config={duration: preset === 'fade' ? 1600 : 3000,
      easing:Easing.inOut(Easing.ease), useNativeDriver:Platform.OS !== 'web'};
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(progress,{...config,toValue:1}),
      Animated.timing(progress,{...config,toValue:0}),
    ]));
    animation.start();
    return () => animation.stop();
  }, [playing,preset,progress,reduceMotion]);
  if (preset === 'none') return <>{children}</>;
  const scale=progress.interpolate({inputRange:[0,1],outputRange:[1,1.035]});
  const x=progress.interpolate({inputRange:[0,1],outputRange:[-4,4]});
  const y=progress.interpolate({inputRange:[0,1],outputRange:[-3,3]});
  const opacity=progress.interpolate({inputRange:[0,1],outputRange:[1,.78]});
  const style=preset==='zoom'?{transform:[{scale}]}:
    preset==='pan'?{transform:[{translateX:x}]}:
    preset==='float'?{transform:[{translateY:y}]}:{opacity};
  return (
    <View>
      <Animated.View style={style}>{children}</Animated.View>
      {!reduceMotion && (
        <Pressable accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause post animation' : 'Play post animation'}
          onPress={() => setPlaying(v=>!v)}
          style={{alignSelf:'flex-end',paddingHorizontal:10,paddingVertical:6,marginTop:4,
            borderRadius:16,backgroundColor:'#e7f4ef',flexDirection:'row',gap:4,alignItems:'center'}}>
          <MaterialCommunityIcons name={playing?'pause-circle-outline':'play-circle-outline'} size={17} color="#195d47" />
          <Text style={{color:'#195d47',fontSize:10,fontWeight:'800'}}>
            {playing?'Pause motion':'Play motion'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
