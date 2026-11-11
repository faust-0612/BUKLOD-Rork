import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';

export default function BuklodWallQuickLinks({onCommunityPress}:{onCommunityPress:()=>void}) {
  const {colors} = useBuklodPresentation();
  const base = {minHeight:42,borderRadius:13,justifyContent:'center' as const,
    alignItems:'center' as const,flexDirection:'row' as const,gap:4};
  const outline = {borderWidth:1,borderColor:colors.green,backgroundColor:colors.white};
  return <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:5,marginBottom:5}}>
    <Text numberOfLines={1} style={{color:colors.greenDark,fontSize:10,fontWeight:'900',
      letterSpacing:0.3,maxWidth:48}}>BUKLOD</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Open My Bible"
      onPress={()=>router.push('/bible/read?source=my_bible' as any)} hitSlop={4}
      style={({pressed})=>[base,{width:37,backgroundColor:'#36C650',borderWidth:1,borderColor:'#218B3D'},pressed&&{opacity:0.75}]}>
      <MaterialCommunityIcons name="book-open-variant" size={20} color="#FFFFFF"/>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Community Wall"
      accessibilityState={{selected:true}} onPress={onCommunityPress} hitSlop={3}
      style={({pressed})=>[base,{flex:1.3,minWidth:0,paddingHorizontal:4,backgroundColor:colors.greenDark,
        borderWidth:1,borderColor:colors.greenDark,elevation:2,shadowColor:colors.greenDark,
        shadowOpacity:0.16,shadowRadius:3,shadowOffset:{width:0,height:2}},pressed&&{opacity:0.76}]}>
      <MaterialCommunityIcons name="account-group" size={16} color="#FFFFFF"/>
      <Text numberOfLines={1} style={{fontSize:10,fontWeight:'900',color:'#FFFFFF'}}>COMMUNITY</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD IGPAT videos"
      onPress={()=>router.push('/igpat' as any)} hitSlop={4}
      style={({pressed})=>[base,outline,{flex:0.95,minWidth:0,paddingHorizontal:4},pressed&&{opacity:0.72}]}>
      <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.greenDark}/>
      <Text numberOfLines={1} style={{fontSize:10,fontWeight:'900',color:colors.greenDark}}>IGPAT</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Open 702 DZAS Radio"
      onPress={()=>router.push('/personal-home/radio' as any)} hitSlop={4}
      style={({pressed})=>[base,outline,{width:65,paddingHorizontal:4},pressed&&{opacity:0.72}]}>
      <MaterialCommunityIcons name="radio" size={16} color={colors.greenDark}/>
      <Text numberOfLines={1} style={{fontSize:10,fontWeight:'900',color:colors.greenDark}}>DZAS</Text>
    </Pressable>
  </View>;
}
