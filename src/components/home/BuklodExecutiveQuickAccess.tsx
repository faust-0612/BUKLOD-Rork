import React,{useEffect,useRef} from 'react';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {useGenesisMotionAllowed} from '@/features/season2/genesis/GenesisVisuals';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {Animated,Easing,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

const shortcuts = [
  {label:'Bible', icon:'book-open-page-variant-outline', route:'/bible'},
  {label:'KL', icon:'school-outline', route:'/kabihasnang-ligaw'},
  {label:'Quiz', icon:'trophy-outline', route:'/faith/bible-quiz'},
  {label:'Music', icon:'headphones', route:'/faith/hymns'},
  {label:'More', icon:'view-grid-outline', route:'/feature-search'},
] as const;

/** One compact row of non-tab quick actions; standard touch sizes and safe scaling. */
export default function BuklodExecutiveQuickAccess({active=true}:{active?:boolean}) {
  const { theme } = useBuklodTheme();
  const { fontScale } = useWindowDimensions();
  const genesis=isGenesisPreviewBuild();
  const pulse=useRef(new Animated.Value(0)).current;
  const shouldAnimate=useGenesisMotionAllowed(active);
  useEffect(()=>{
    if(!genesis||!shouldAnimate){pulse.stopAnimation();pulse.setValue(0);return;}
    const animation=Animated.loop(Animated.timing(pulse,{toValue:1,duration:3200,
      easing:Easing.inOut(Easing.sin),useNativeDriver:true}));
    animation.start();return()=>{animation.stop();pulse.setValue(0);};
  },[genesis,shouldAnimate,pulse]);
  return (
    <View accessibilityLabel="BUKLOD quick services" style={{ gap: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection:'row', gap:7, paddingVertical:1 }}>
        {shortcuts.map((item,index) => (
          <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={'Open ' + item.label}
            onPress={() => router.push(item.route as any)}
            style={({pressed}) => ({
              minWidth: fontScale >= 1.4 ? 84 : 75, minHeight: 64,
              borderWidth:1, borderColor:theme.border,
              backgroundColor:pressed ? theme.accentSoft : theme.cardSurface,
              borderRadius:12, alignItems:'center', justifyContent:'center',
              paddingVertical:7, paddingHorizontal:10, gap:4,
            })}>
            
            <View style={{width:27,height:27,alignItems:'center',justifyContent:'center'}}>
              {genesis ? <Animated.View pointerEvents="none" style={{
                position:'absolute',width:27,height:27,borderRadius:14,
                borderWidth:1,borderColor:'#F3D399',backgroundColor:'#2C386A',
                opacity:pulse.interpolate({inputRange:[0,.24,.49,.73,1],
                  outputRange:index%2===0?[.2,.68,.23,.52,.2]:[.52,.2,.67,.19,.52]}),
              }}/> : null}
              <MaterialCommunityIcons name={item.icon} size={21} color={genesis ? '#FFE3AA' : theme.accent}/>
            </View>
            <Text allowFontScaling numberOfLines={1} style={{color:theme.textPrimary,fontSize:12,fontWeight:'800'}}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
