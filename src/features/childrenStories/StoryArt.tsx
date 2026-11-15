import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { ChildrenStory } from './catalog';

export default function StoryArt({ story, compact = false, page = 0, animate = false }: {
  story: ChildrenStory; compact?: boolean; page?: number; animate?: boolean;
}) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { drift.stopAnimation(); drift.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift,{toValue:1,duration:2600,useNativeDriver:true}),
      Animated.timing(drift,{toValue:0,duration:2600,useNativeDriver:true}),
    ]));
    loop.start();
    return () => { loop.stop(); drift.stopAnimation(); };
  }, [animate,drift]);
  const phase = page % 3;
  const gradientId = `kids-sky-${story.id}`;
  return (
    <View style={[styles.frame, compact ? styles.compact : styles.expanded]}
      accessible accessibilityRole="image" accessibilityLabel={`Illustrated scene: ${story.title.en}`}>
      <Svg width="100%" height="100%" viewBox="0 0 400 245" preserveAspectRatio="xMidYMid slice">
        <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={story.palette[0]} />
          <Stop offset="1" stopColor={story.palette[1]} />
        </LinearGradient></Defs>
        <Rect x="0" y="0" width="400" height="245" fill={`url(#${gradientId})`} />
        <Circle cx={phase===1?318:80} cy="50" r="34" fill="#FFF4C0" opacity=".88"/>
        <Ellipse cx="100" cy="86" rx="64" ry="12" fill="#FFFFFF" opacity=".23"/>
        <Ellipse cx="335" cy="111" rx="70" ry="15" fill="#FFFFFF" opacity=".16"/>
        <Path d="M0 180 Q70 120 154 179 Q240 103 400 170 L400 245 H0Z" fill="#FFFFFF" opacity=".15"/>
        <Path d="M0 217 Q100 152 202 213 Q300 162 400 213 L400 245 H0Z" fill="#154C46" opacity=".36"/>
        <Path d="M0 239 Q96 198 188 235 Q308 186 400 232 L400 245 H0Z" fill="#0E3F42" opacity=".22"/>
        <Path d="M45 152 l-8 36 h17z M52 158 l-20 20 h41z" fill="#F2FFF1" opacity=".45"/>
        <Path d="M355 160 l-11 32 h24z M355 145 l-26 35 h54z" fill="#F2FFF1" opacity=".39"/>
        <Circle cx="23" cy="55" r="2.4" fill="#FFF2CD" opacity=".8"/>
        <Circle cx="250" cy="20" r="2.1" fill="#FFF2CD" opacity=".9"/>
        <Circle cx="360" cy="43" r="2.4" fill="#FFF2CD" opacity=".8"/>
        <Path d="M156 69 q9 -8 18 0 q9 -8 18 0" stroke="#FFFFFF" strokeWidth="2" fill="none" opacity=".5"/>
      </Svg>
      <Animated.View style={[styles.character, { transform: [{translateY: drift.interpolate({inputRange:[0,1],outputRange:[0,-9]})}] }]}>
        <View style={[styles.characterHalo, compact && styles.smallHalo]}>
          <Text allowFontScaling={false} style={[styles.emoji, compact && styles.smallEmoji]}>{story.emoji}</Text>
        </View>
      </Animated.View>
      {!compact ? <View style={styles.tag}><Text style={styles.tagText}>BUKLOD STORY WORLD</Text></View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  frame:{width:'100%',overflow:'hidden',position:'relative',backgroundColor:'#294B62'},
  compact:{height:148,borderTopLeftRadius:17,borderTopRightRadius:17},
  expanded:{height:275,borderRadius:25},
  character:{position:'absolute',top:0,right:0,bottom:0,left:0,alignItems:'center',justifyContent:'center'},
  characterHalo:{height:145,width:145,borderRadius:80,backgroundColor:'rgba(255,255,255,.20)',borderWidth:2,borderColor:'rgba(255,255,255,.45)',alignItems:'center',justifyContent:'center'},
  smallHalo:{height:91,width:91},
  emoji:{fontSize:86,textAlign:'center',includeFontPadding:false},
  smallEmoji:{fontSize:59},
  tag:{position:'absolute',bottom:13,left:15,backgroundColor:'rgba(10,30,45,.38)',paddingVertical:7,paddingHorizontal:13,borderRadius:20},
  tagText:{fontSize:10,color:'#FFFFFF',fontWeight:'900',letterSpacing:1.3},
});
