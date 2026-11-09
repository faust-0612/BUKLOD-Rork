import React from 'react';
import {Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';
import {launchBuklodHealthCenter} from '@/lib/buklodHealthCenterLauncher';

/**
 * Home launchers reuse the real standalone modules. Never embed the complete
 * family/health application in a FlashList or duplicate its state and APIs.
 */
export default function BuklodHomeUtilityCards(){
  const {theme}=useBuklodTheme();
  const healthOpeningRef=React.useRef(false);
  const openCard=async (id:string,path:string)=>{
    if(id!=='health') {router.push(path as any);return;}
    if(healthOpeningRef.current)return;
    healthOpeningRef.current=true;
    try {await launchBuklodHealthCenter(url=>Linking.openURL(url));}
    catch {router.push('/profile/buklod-health' as any);}
    finally {healthOpeningRef.current=false;}
  };
  const cards=[
    {id:'home',title:'My BUKLOD Home',description:'Family · chores · bills · notes · garden',
      action:'Open my home',icon:'home-heart' as const,path:'/personal-home'},
    {id:'health',title:'Health Center',description:'Medicines · vitals · appointments · medical records',
      action:'Open Health Center',icon:'heart-pulse' as const,path:'/profile/buklod-health'},
  ];
  return <View style={s.grid} accessibilityLabel="BUKLOD Home dashboard apps">
    {cards.map((card,index)=><Pressable key={card.id}
      accessibilityRole="button" accessibilityLabel={card.action}
      onPress={()=>void openCard(card.id,card.path)}
      style={({pressed})=>[s.card,{
        backgroundColor:index===0?'#E0FFF7':'#FFF0FD',
        borderColor:index===0?'#00E6B5':'#F14AE0',
        shadowColor:index===0?'#00CFA5':'#DD2AD2',
        opacity:pressed ? 0.8 : 1}]}>
      {card.id==='home'?<View style={s.miniHouse} accessibilityLabel="Bahay room layout preview">
        <View style={s.roof}><MaterialCommunityIcons name="home-roof" size={19} color="#FFF"/></View>
        <View style={s.houseRooms}>
          {(['sofa-outline','silverware-fork-knife','bed-outline','flower-outline'] as const)
            .map(icon=><View key={icon} style={s.miniRoom}>
              <MaterialCommunityIcons name={icon} size={13} color="#31543E"/>
            </View>)}
        </View>
      </View>:<View style={[s.icon,{backgroundColor:theme.surface}]}>
        <MaterialCommunityIcons name={card.icon} size={32} color={theme.accent}/>
      </View>}
      <Text style={[s.title,{color:'#153F36'}]} numberOfLines={2}>{card.title}</Text>
      <Text style={[s.subtitle,{color:'#426258'}]} numberOfLines={3}>{card.description}</Text>
      <View style={s.bottom}>
        <Text style={[s.open,{color:theme.accent}]}>{card.action}</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={theme.accent}/>
      </View>
    </Pressable>)}
  </View>;
}
const s=StyleSheet.create({
 grid:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:8,marginHorizontal:0,paddingHorizontal:0},
 card:{width:'48.5%',aspectRatio:1,minHeight:152,flexGrow:1,borderRadius:12,
   borderWidth:2,padding:12,justifyContent:'space-between',gap:5,
   shadowOffset:{width:0,height:0},shadowOpacity:.25,shadowRadius:9,elevation:5},
 icon:{width:51,height:51,borderRadius:4,justifyContent:'center',alignItems:'center'},
 miniHouse:{width:86,borderWidth:1,borderColor:'#C6D8C8',borderRadius:3,overflow:'hidden'},
 roof:{height:20,backgroundColor:'#6D4A31',alignItems:'center',justifyContent:'center'},
 houseRooms:{flexDirection:'row',flexWrap:'wrap',padding:3,gap:3,backgroundColor:'#F1F7EF'},
 miniRoom:{width:36,height:24,alignItems:'center',justifyContent:'center',
   backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#DBE6DA'},
 title:{fontWeight:'900',fontSize:15,lineHeight:19},
 subtitle:{fontSize:11,lineHeight:15,flex:1},
 bottom:{flexDirection:'row',alignItems:'center',gap:6},
 open:{fontSize:11,fontWeight:'800',flex:1}
});
