/** Curated special destinations. Main navigation remains the single global bottom pane. */
import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Redirect,router} from 'expo-router';
import {Image as ExpoImage} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import BuklodMapHeader from './BuklodMapHeader';

type Directory='games'|'learnings'|'university'|'church';
type Door={label:string;description:string;icon:string;route:string;faithOnly?:boolean};
const DATA:Record<Directory,{title:string;subtitle:string;icon:string;entries:readonly Door[]}>={
 games:{title:'Kingdom at Hero Arena',subtitle:'Dalawang magkahiwalay na laro sa iisang BUKLOD app.',icon:'gamepad-variant-outline',entries:[
  {label:'Character Kingdom',description:'Mini-games, collectibles, growth at character progression.',icon:'castle',route:'/games'},
  {label:'Hero Arena',description:'Action / strategy battles. Ranked play follows its own guarded eligibility.',icon:'shield-sword-outline',route:'/games/empire-arena'},
 ]},
 learnings:{title:'BUKLOD Learnings',subtitle:'Iisang daan sa readings, KL, children at iba pang learning packages.',icon:'book-open-page-variant-outline',entries:[
  {label:'Learning Center',description:'Lessons at learning tracks.',icon:'school',route:'/learn'},
  {label:'Daily Reading',description:'Mga chapter at offline Bible reading.',icon:'book-open-variant',route:'/bible/read',faithOnly:true},
  {label:'KL · Kabihasnang Ligaw',description:'Explore KL reading at reflection.',icon:'bookshelf',route:'/kabihasnang-ligaw'},
  {label:'Children’s Stories',description:'Complete stories at Sunday School learning.',icon:'human-male-child',route:'/children-stories'},
  {label:'Life',description:'Pag-asa, layunin at direksiyon.',icon:'sprout',route:'/life'},
  {label:'WORD',description:'Faith-based lesson at reflection.',icon:'book-cross',route:'/faith/word',faithOnly:true},
  {label:'ABAKA Lessons',description:'Structured Christian learning.',icon:'book-education-outline',route:'/faith/abc',faithOnly:true},
 ]},
 university:{title:'BUKLOD University',subtitle:'Classroom, faculty, assessments, materials at academic activities.',icon:'school-outline',entries:[
  {label:'Classrooms',description:'Classes at enrolled learning spaces.',icon:'google-classroom',route:'/profile/buklod-classrooms'},
  {label:'Faculty',description:'Faculty dashboard at teaching tools; permissions apply.',icon:'account-tie-outline',route:'/profile/buklod-faculty'},
  {label:'Quizzes & Assessments',description:'Existing faculty assessment workspaces; role checks remain intact.',icon:'clipboard-text-outline',route:'/profile/buklod-faculty-assessments'},
  {label:'Learning Materials',description:'Classroom resources, modules at activities.',icon:'book-open-page-variant-outline',route:'/profile/buklod-classroom-materials'},
 ]},
 church:{title:'BUKLOD Church',subtitle:'Buklod Lessons, ABAKA, WORD, prayer at spiritual life.',icon:'church',entries:[
  {label:'Church Life & Events',description:'Church announcements at RSVP.',icon:'church',route:'/church',faithOnly:true},
  {label:'BUKLOD Lesson',description:'Scope-based formation and lesson room.',icon:'account-school-outline',route:'/scope/buklod-lesson',faithOnly:true},
  {label:'ABAKA',description:'Structured ABC/ABAKA lessons.',icon:'book-education-outline',route:'/faith/abc',faithOnly:true},
  {label:'WORD',description:'Word readings, reflections at study.',icon:'book-cross',route:'/faith/word',faithOnly:true},
  {label:'Prayer',description:'Prayer and requests.',icon:'hands-pray',route:'/prayer/new',faithOnly:true},
  {label:'Bible',description:'Daily reading and scripture.',icon:'book-open-variant',route:'/bible',faithOnly:true},
  {label:'Bible Events',description:'Registered events and Bible challenges.',icon:'calendar-star',route:'/faith/bible-events',faithOnly:true},
 ]},
};

export default function BuklodSpecialDoorDirectory({kind}:{kind:Directory}){
 const {session,loading,profile}=useAuth();
 const {requiresAcceptance}=useCompliance();
 const {config}=useRuntimeConfig();
 const {activeScope}=useBuklodScope();
 const showFaith=Boolean(activeScope?.show_faith_content);
 const data=DATA[kind];
 if(!isGenesisPreviewBuild())return <Redirect href="/(tabs)/buklod"/>;
 if(loading&&!session)return <View style={s.page}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;
 const items=data.entries.filter(item=>!item.faithOnly||showFaith);
 return <View style={s.page}>
  <BuklodMapHeader/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.hero}>
    <ExpoImage source={require('../../../../assets/season2/genesis/kingdom/kingdom-nature-panorama-compact.webp')}
      contentFit="cover" style={StyleSheet.absoluteFillObject}/>
    <LinearGradient colors={['rgba(4,21,34,.48)','rgba(4,21,34,.88)']} style={StyleSheet.absoluteFillObject}/>
    <MaterialCommunityIcons name={data.icon as any} size={40} color="#FFE5A7"/>
    <Text style={s.title}>{data.title}</Text>
    <Text style={s.subtitle}>{data.subtitle}</Text>
   </View>
   {kind==='church'&&!showFaith ? <Text style={s.off}>
     Naka-off ang Show Faith. Nakatago ang church-specific activities; available pa rin ang Learnings at ibang equivalent paths.
    </Text>:null}
   <View style={s.grid}>
    {items.map(item=><Pressable key={item.route} accessibilityRole="button"
      accessibilityLabel={'Open '+item.label} onPress={()=>router.push(item.route as any)}
      style={({pressed})=>[s.card,pressed&&s.pressed]}>
      <MaterialCommunityIcons name={item.icon as any} color="#FFE3A7" size={25}/>
      <View style={{flex:1,minWidth:0}}>
       <Text style={s.cardTitle}>{item.label}</Text>
       <Text style={s.cardDesc}>{item.description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#C9E1D6"/>
    </Pressable>)}
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to the BUKLOD world map"
    onPress={()=>router.push('/buklod-map' as any)} style={s.back}>
    <MaterialCommunityIcons name="map-outline" size={20} color="#FFE5B5"/>
    <Text style={s.backLabel}>BUKLOD Map</Text>
   </Pressable>
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#07162C'},content:{paddingHorizontal:12,paddingTop:9,paddingBottom:25,gap:11},
 hero:{minHeight:184,borderRadius:18,overflow:'hidden',padding:18,justifyContent:'flex-end',gap:6,
  borderColor:'#DBCA92',borderWidth:1},
 title:{fontSize:24,fontWeight:'900',color:'#FFE8B0'},subtitle:{fontSize:12,lineHeight:18,color:'#F0F7F2'},
 grid:{gap:9},card:{minHeight:77,flexDirection:'row',alignItems:'center',gap:10,padding:12,
  backgroundColor:'#102E35',borderRadius:14,borderWidth:1,borderColor:'#597B73'},
 cardTitle:{fontSize:15,fontWeight:'900',color:'#FEF5D8'},
 cardDesc:{fontSize:11,color:'#CEE5E2',lineHeight:16,marginTop:2},
 off:{color:'#FFE4A9',fontSize:12,padding:12,backgroundColor:'#1B3540',borderRadius:10},
 back:{flexDirection:'row',alignItems:'center',justifyContent:'center',minHeight:44,
  gap:6,borderRadius:12,backgroundColor:'#1A4642'},
 backLabel:{color:'#FFE8B8',fontWeight:'900'},pressed:{opacity:.73},
});
