/** Classic BUKLOD app title bar restored for the new map-first gateway. */
import React,{useEffect,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNotifications} from '@/providers/NotificationProvider';
import BuklodNavigationSideMenu from '@/components/BuklodNavigationSideMenu';
import {GENESIS_IDENTITY} from '@/features/season2/genesis/genesisContract';
export default function BuklodMapHeader(){
 const insets=useSafeAreaInsets();
 const {unreadCount,refreshUnread}=useNotifications();
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{void refreshUnread();},[refreshUnread]);
 return <>
  <View style={[s.bar,{paddingTop:insets.top}]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD menu"
    onPress={()=>setMenuOpen(true)} style={s.action}>
    <MaterialCommunityIcons name="menu" size={25} color="#FFFFFF"/>
   </Pressable>
   <View style={s.brand}>
    <View style={s.logoClip}><Image source={require('../../../../assets/release/buklod-main-canonical.png')}
      resizeMode="contain" style={s.logo}/></View>
    <View style={s.words}>
     <Text style={s.title} numberOfLines={1}>BUKLOD</Text>
     <Text style={s.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{GENESIS_IDENTITY.title}</Text>
    </View>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Search BUKLOD features"
    onPress={()=>router.push('/feature-search' as any)} style={s.action}>
    <MaterialCommunityIcons name="magnify" size={25} color="#FFFFFF"/>
   </Pressable>
   <Pressable accessibilityRole="button"
    accessibilityLabel={unreadCount>0?'Notifications, '+unreadCount+' unread':'Notifications'}
    onPress={()=>router.push('/notifications' as any)} style={s.action}>
    <MaterialCommunityIcons name="bell-outline" size={23} color="#FFFFFF"/>
    {unreadCount>0?<View pointerEvents="none" style={s.badge}>
     <Text style={s.badgeText}>{unreadCount>99?'99+':unreadCount}</Text>
    </View>:null}
   </Pressable>
  </View>
  <BuklodNavigationSideMenu visible={menuOpen} onClose={()=>setMenuOpen(false)}/>
 </>;
}
const s=StyleSheet.create({
 bar:{minHeight:55,paddingHorizontal:3,backgroundColor:'#07182D',
  borderBottomWidth:1,borderBottomColor:'#32506B',flexDirection:'row',alignItems:'center'},
 action:{minWidth:45,minHeight:48,alignItems:'center',justifyContent:'center',position:'relative'},
 brand:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:7},
 logoClip:{width:33,height:34,borderRadius:9,overflow:'hidden',backgroundColor:'#07182D'},
 logo:{position:'absolute',width:58,height:58,left:-12,top:-7},
 words:{flex:1,minWidth:0},
 title:{color:'#FFFFFF',fontSize:20,lineHeight:25,fontWeight:'900'},
 subtitle:{color:'#F6D8A7',fontSize:9,lineHeight:12,fontWeight:'900'},
 badge:{position:'absolute',right:0,top:0,minWidth:18,height:18,paddingHorizontal:3,borderRadius:10,
  borderWidth:1,borderColor:'#07182D',backgroundColor:'#B83B50',alignItems:'center',justifyContent:'center'},
 badgeText:{fontSize:9,fontWeight:'900',color:'#FFFFFF'},
});
