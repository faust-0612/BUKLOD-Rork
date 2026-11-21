/** Minimal safe landing for existing /learn links (which previously had no index).
 * Reuses established learning, education and stories routes without minting
 * rewards, copying student records or fabricating a public course catalog.
 */
import React,{useRef} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {router,Redirect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';

const DESTINATIONS=[
 {id:'education',label:'Education & Focus Apps',description:'Access eligible education services and workspaces',icon:'school-outline',route:'/profile/focus-apps'},
 {id:'classrooms',label:'Classrooms',description:'Class activities with existing school role and permission checks',icon:'google-classroom',route:'/profile/buklod-classrooms'},
 {id:'children',label:"Children's Stories",description:'Family-friendly stories and learning',icon:'book-open-page-variant',route:'/children-stories'},
 {id:'achievements',label:'Learning Achievements',description:'Progress and verified earned participation',icon:'trophy-outline',route:'/points/progression'},
 {id:'kingdom',label:'Character Kingdom',description:'Practice and exploration; rewards remain server-authorized',icon:'castle',route:'/games'},
 {id:'bible',label:'Bible & Daily Reading',description:'Optional faith-based reading',icon:'book-cross',route:'/bible',faithOnly:true},
] as const;
export default function LearningGrove() {
 const {session,loading,profile}=useAuth();
 const {requiresAcceptance}=useCompliance();
 const {config}=useRuntimeConfig();
 const {activeScope}=useBuklodScope();
 const insets=useSafeAreaInsets();
 const tapped=useRef(0);
 const genesis=isGenesisPreviewBuild();
 const showFaith=Boolean(activeScope?.show_faith_content);
 if(loading&&!session)return <View style={styles.root}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;
 const navigate=(route:string)=>{
  const now=Date.now();if(now-tapped.current<650)return;
  tapped.current=now;router.push(route as any);
 };
 return <View style={styles.root}>
  <ScrollView contentContainerStyle={[styles.content,{paddingTop:Math.max(insets.top,12)+12,paddingBottom:Math.max(28,insets.bottom)+28}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={genesis?'Back to BUKLOD world map':'Back to Home'}
    style={styles.back} onPress={()=>router.replace((genesis?'/buklod-map':'/(tabs)/hub') as any)}>
    <MaterialCommunityIcons name="arrow-left" size={20} color="#FFE8B6"/>
    <Text style={styles.backText}>{genesis?'WORLD MAP':'HOME'}</Text>
   </Pressable>
   <Text style={styles.eyebrow}>BUKLOD · LEARNING GROVE</Text>
   <Text style={styles.title}>Explore, learn and grow.</Text>
   <Text style={styles.intro}>Isang pintuan para sa pag-aaral, stories at iyong development. Ang access, lessons at completion ay pinangangasiwaan pa rin sa umiiral na learning services.</Text>
   <View style={styles.section}>
    {DESTINATIONS.filter(item=>!('faithOnly' in item && item.faithOnly)||showFaith).map(item=>(
      <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Open '+item.label}
       onPress={()=>navigate(item.route)} style={({pressed})=>[styles.link,pressed&&styles.pressed]}>
       <View style={styles.icon}>
        <MaterialCommunityIcons name={item.icon} size={23} color="#FCE5B4"/>
       </View>
       <View style={styles.linkText}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.description}>{item.description}</Text>
       </View>
       <MaterialCommunityIcons name="chevron-right" size={22} color="#FCE5B4"/>
      </Pressable>
    ))}
   </View>
   <Text style={styles.note}>Existing authorized screens only. Hindi ito bagong course database, financial reward system o learning-completion shortcut.</Text>
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#081E28'},
 content:{paddingHorizontal:14,gap:11,maxWidth:780,width:'100%',alignSelf:'center'},
 back:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,borderRadius:14,borderWidth:1,borderColor:'#8A9A7C',paddingHorizontal:12,minHeight:45,backgroundColor:'#15383B'},
 backText:{fontWeight:'900',color:'#FFE8B6',fontSize:11},
 eyebrow:{marginTop:10,color:'#A8E0C3',fontSize:11,letterSpacing:1.4,fontWeight:'900'},
 title:{fontSize:27,color:'#FFE6B6',fontWeight:'900'},
 intro:{fontSize:13,color:'#D2E4E6',lineHeight:20},
 section:{borderRadius:18,borderWidth:1,borderColor:'#547972',backgroundColor:'#102D36',paddingHorizontal:10},
 link:{minHeight:72,flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#63827C',gap:12},
 icon:{width:44,height:44,borderRadius:13,backgroundColor:'#27504C',alignItems:'center',justifyContent:'center'},
 linkText:{flex:1,gap:4},
 label:{fontSize:15,fontWeight:'800',color:'#FFF2D6'},
 description:{fontSize:11,lineHeight:15,color:'#D4E2DB'},
 pressed:{opacity:.72},
 note:{color:'#B7CEC5',fontSize:11,lineHeight:17},
});
