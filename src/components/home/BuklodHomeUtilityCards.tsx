import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';

/**
 * Home launchers reuse the real standalone modules. Never embed the complete
 * family/health application in a FlashList or duplicate its state and APIs.
 */
export default function BuklodHomeUtilityCards(){
  const {theme}=useBuklodTheme();
  const cards=[
    {id:'home',title:'My BUKLOD Home',description:'Family · chores · bills · notes · garden',
      action:'Open my home',icon:'home-heart' as const,path:'/personal-home'},
    {id:'health',title:'Health Center',description:'Personal health tools and information',
      action:'Open Health Center',icon:'heart-pulse' as const,path:'/profile/buklod-health'},
  ];
  return <View style={s.grid} accessibilityLabel="BUKLOD Home dashboard apps">
    {cards.map((card,index)=><Pressable key={card.id}
      accessibilityRole="button" accessibilityLabel={card.action}
      onPress={()=>router.push(card.path as any)}
      style={({pressed})=>[s.card,{backgroundColor:index===0?theme.accentSoft:theme.surface,
        borderColor:theme.border,opacity:pressed ? 0.8 : 1}]}>
      <View style={[s.icon,{backgroundColor:theme.surface}]}>
        <MaterialCommunityIcons name={card.icon} size={32} color={theme.accent}/>
      </View>
      <Text style={[s.title,{color:theme.textPrimary}]} numberOfLines={2}>{card.title}</Text>
      <Text style={[s.subtitle,{color:theme.textMuted}]} numberOfLines={3}>{card.description}</Text>
      <View style={s.bottom}>
        <Text style={[s.open,{color:theme.accent}]}>{card.action}</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={theme.accent}/>
      </View>
    </Pressable>)}
  </View>;
}
const s=StyleSheet.create({
 grid:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:8,marginHorizontal:0,paddingHorizontal:0},
 card:{width:'48.5%',aspectRatio:1,minHeight:152,flexGrow:1,borderRadius:4,
   borderWidth:1,padding:12,justifyContent:'space-between',gap:5},
 icon:{width:51,height:51,borderRadius:4,justifyContent:'center',alignItems:'center'},
 title:{fontWeight:'900',fontSize:15,lineHeight:19},
 subtitle:{fontSize:11,lineHeight:15,flex:1},
 bottom:{flexDirection:'row',alignItems:'center',gap:6},
 open:{fontSize:11,fontWeight:'800',flex:1}
});
