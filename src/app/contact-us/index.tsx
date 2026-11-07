import React from 'react';
import {Linking,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {colors} from '@/lib/theme';

const EMAIL='mzbministry@gmail.com';
const PHONE='09167366414';
const FACEBOOK_PAGE='Mt Zion Baptist Ministry';
// Search rather than inventing an official page URL or page ID.
const FACEBOOK_SEARCH='https://www.facebook.com/search/top?q=Mt%20Zion%20Baptist%20Ministry';

function ContactRow({icon,title,detail,onPress,action}:{
 icon:React.ComponentProps<typeof MaterialCommunityIcons>['name'];
 title:string;detail:string;onPress:()=>void;action:string;
}){
 return <Pressable accessibilityRole="button" onPress={onPress} style={s.card}>
   <View style={s.icon}><MaterialCommunityIcons name={icon} size={24} color={colors.green}/></View>
   <View style={{flex:1}}>
     <Text style={s.label}>{title}</Text><Text selectable style={s.detail}>{detail}</Text>
     <Text style={s.action}>{action}</Text>
   </View>
   <MaterialCommunityIcons name="open-in-new" size={18} color={colors.green}/>
 </Pressable>;
}
export default function ContactUsScreen(){
 return <ScrollView style={s.page} contentContainerStyle={s.content}>
   <Pressable onPress={()=>router.back()} accessibilityRole="button">
     <Text style={s.back}>‹ Back</Text>
   </Pressable>
   <Text style={s.title}>Contact Us</Text>
   <Text style={s.intro}>Reach Mt Zion Baptist Ministry directly through the official contact details below. This page is separate from BUKLOD feedback and BSOC support cases.</Text>
   <ContactRow icon="email-outline" title="Email" detail={EMAIL}
     action="Write an email" onPress={()=>{void Linking.openURL('mailto:'+EMAIL);}}/>
   <ContactRow icon="phone-outline" title="Mobile" detail={PHONE}
     action="Call" onPress={()=>{void Linking.openURL('tel:'+PHONE);}}/>
   <ContactRow icon="facebook" title="Facebook Page" detail={FACEBOOK_PAGE}
     action="Find page on Facebook" onPress={()=>{void Linking.openURL(FACEBOOK_SEARCH);}}/>
   <Text style={s.note}>For account problems, bugs, and screenshot or video evidence, use Live BUKLOD Support in Profile. For general inquiries, use the contact details here.</Text>
 </ScrollView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.background},
 content:{padding:18,paddingBottom:80,gap:12},
 back:{color:colors.green,fontWeight:'800',paddingVertical:8},
 title:{fontSize:27,fontWeight:'900',color:colors.greenDark},
 intro:{color:colors.text,lineHeight:21,marginBottom:8},
 card:{flexDirection:'row',alignItems:'center',padding:16,gap:12,
   borderRadius:12,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white},
 icon:{width:42,height:42,alignItems:'center',justifyContent:'center',
   backgroundColor:'#EAF6F0',borderRadius:10},
 label:{fontSize:13,color:colors.muted,fontWeight:'800'},
 detail:{fontSize:16,color:colors.text,fontWeight:'800',marginTop:3},
 action:{color:colors.green,fontSize:12,fontWeight:'800',marginTop:7},
 note:{fontSize:12,lineHeight:19,color:colors.muted,marginTop:7}
});
