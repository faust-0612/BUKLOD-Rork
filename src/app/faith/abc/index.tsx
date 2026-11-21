/** Genesis ABAKA table of contents. Each lesson remains governed by its existing original detail route. */
import React from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Image as ExpoImage} from 'expo-image';
import {Redirect,router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {ABC_LESSONS,ABC_SOURCE} from '@/data/faith/abcLessons';

export default function BuklodAbakaDirectory(){
 const {session,loading,profile}=useAuth();
 const {requiresAcceptance}=useCompliance();
 const {config}=useRuntimeConfig();
 const {activeScope}=useBuklodScope();
 const insets=useSafeAreaInsets();
 const showFaith=Boolean(activeScope?.show_faith_content);
 if(!isGenesisPreviewBuild())return <Redirect href="/(tabs)/buklod"/>;
 if(loading&&!session)return <View style={styles.page}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;
 const lessons=[...ABC_LESSONS].sort((a,b)=>a.order-b.order);
 return <ScrollView style={styles.page} contentContainerStyle={[styles.content,{
    paddingTop:Math.max(insets.top,12)+8,paddingBottom:Math.max(insets.bottom,16)+20,
  }]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to Church"
    onPress={()=>router.push('/season2/church' as any)} style={styles.back}>
    <MaterialCommunityIcons name="arrow-left" size={20} color="#FFE5AE"/>
    <Text style={styles.backText}>Church</Text>
   </Pressable>
   <View style={styles.hero}>
    <ExpoImage source={require('../../../../assets/season2/genesis/kingdom/kingdom-nature-panorama-compact.webp')}
      contentFit="cover" style={StyleSheet.absoluteFillObject}/>
    <View style={styles.heroShade}/>
    <MaterialCommunityIcons name="book-cross" color="#FFE1A7" size={31}/>
    <Text style={styles.title}>{ABC_SOURCE.title}</Text>
    <Text style={styles.subtitle}>Mga orihinal na aralin sa BUKLOD · A–Z Sunday School</Text>
   </View>
   {!showFaith?<View style={styles.off}>
    <Text style={styles.offText}>Naka-off ang Show Faith. Maaaring i-explore ang ibang learning paths sa BUKLOD Learnings.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Open faith-neutral Learnings" onPress={()=>router.push('/season2/learnings' as any)}>
     <Text style={styles.learnLink}>Buksan ang Learnings →</Text>
    </Pressable>
   </View>:<View style={styles.list}>
     {lessons.map(item=><Pressable key={item.id} accessibilityRole="button"
       accessibilityLabel={'Open ABAKA '+item.code+': '+item.title}
       onPress={()=>router.push(('/faith/abc/'+encodeURIComponent(item.id)) as any)}
       style={({pressed})=>[styles.item,pressed&&styles.pressed]}>
       <View style={styles.letter}><Text style={styles.letterText}>{item.code}</Text></View>
       <View style={{flex:1,minWidth:0}}>
        <Text style={styles.lessonTitle}>{item.title}</Text>
        <Text style={styles.lessonHint}>Buksan ang aralin · Pagbasa at mga tanong</Text>
       </View>
       <MaterialCommunityIcons name="chevron-right" color="#FFE1A7" size={21}/>
     </Pressable>)}
   </View>}
   <Text style={styles.note}>Ang lesson completion at BP eligibility ay nananatili sa existing verified service, hindi sa directory na ito.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:'#071C29'},
 content:{paddingHorizontal:12,gap:11},
 back:{alignSelf:'flex-start',minHeight:44,flexDirection:'row',alignItems:'center',gap:6,
  paddingHorizontal:12,borderRadius:11,backgroundColor:'#17423F'},
 backText:{fontWeight:'900',color:'#FFE5AE'},
 hero:{height:185,borderRadius:17,overflow:'hidden',padding:15,justifyContent:'flex-end',gap:5,
  borderWidth:1,borderColor:'#D2BE84'},
 heroShade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(5,21,32,.68)'},
 title:{fontWeight:'900',fontSize:23,color:'#FFE6AE'},
 subtitle:{fontSize:12,lineHeight:17,color:'#E4EEE5'},
 off:{padding:13,backgroundColor:'#193E39',borderRadius:12,gap:9},
 offText:{fontSize:12,color:'#E4E7DC',lineHeight:18},
 learnLink:{fontWeight:'900',fontSize:13,color:'#FFE4A2',paddingVertical:10},
 list:{gap:6},
 item:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:11,
  borderRadius:11,borderColor:'#628878',borderWidth:1,backgroundColor:'#163B3B'},
 pressed:{opacity:.73},
 letter:{minWidth:43,minHeight:43,paddingHorizontal:5,alignItems:'center',justifyContent:'center',
  borderRadius:10,backgroundColor:'#2B5D4A'},
 letterText:{fontSize:15,fontWeight:'900',color:'#FFE3AA'},
 lessonTitle:{fontSize:13,fontWeight:'800',color:'#FFF3D8'},
 lessonHint:{fontSize:10,color:'#C7DCD4',marginTop:3},
 note:{fontSize:10,color:'#B5CFC6',lineHeight:15},
});
