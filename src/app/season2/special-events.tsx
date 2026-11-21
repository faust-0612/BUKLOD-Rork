/**
 * BUKLOD Special Events — premium animated foyer over EXISTING RLS-scoped
 * events, RSVP and verified attendance. No client reward or forged signup.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {
 AccessibilityInfo,ActivityIndicator,Animated,AppState,Pressable,RefreshControl,
 ScrollView,StyleSheet,Text,View,
} from 'react-native';
import {Image as ExpoImage} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Redirect,router,useFocusEffect} from 'expo-router';
import {useAuth} from '@/providers/AuthProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {getBuklodCitySnapshot} from '@/lib/buklodCity';
import {supabase} from '@/lib/supabase';
import BuklodHomeCheckinToday from '@/components/BuklodHomeCheckinToday';
import BuklodMapHeader from '@/features/season2/world/BuklodMapHeader';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {
 deriveSpecialEventState,normalizeSpecialEventRows,safeEventLabel,
 type SpecialEventItem,type SpecialEventState,
} from '@/features/season2/world/specialEventsLogic';

const PROGRAMS=[
 {id:'community',label:'Community & Bayanihan',description:'Bayanihan, outreach at volunteer events.',route:'/bayanihan',icon:'hand-heart-outline'},
 {id:'games',label:'Kingdom & Hero Arena',description:'Mga laro, practice at competitive community challenges.',route:'/season2/games',icon:'shield-sword-outline'},
 {id:'learning',label:'Learning Festivals',description:'Readings, KL, stories at learning programs.',route:'/season2/learnings',icon:'book-open-page-variant-outline'},
 {id:'academic',label:'University Activities',description:'Classes, quiz at faculty programs.',route:'/season2/university',icon:'school-outline'},
 {id:'faith',label:'Church Events',description:'Prayer, ministry, ABAKA at Bible events.',route:'/church',icon:'church',faithOnly:true},
] as const;
type Filter='all'|'live'|'upcoming'|'programs';
const FILTERS:readonly {id:Filter;label:string}[]=[
 {id:'all',label:'Lahat'}, {id:'live',label:'Ngayon'},
 {id:'upcoming',label:'Paparating'}, {id:'programs',label:'Mga Programa'},
];

export default function BuklodSpecialEvents(){
 const {session,loading:authLoading,profile}=useAuth();
 const {requiresAcceptance}=useCompliance();
 const {config,featureEnabled}=useRuntimeConfig();
 const {activeScope}=useBuklodScope();
 const showFaith=Boolean(activeScope?.show_faith_content);
 const churchEnabled=showFaith&&featureEnabled('church_life');
 const [focused,setFocused]=useState(false);
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const [reduceMotion,setReduceMotion]=useState(true);
 const [events,setEvents]=useState<SpecialEventItem[]>([]);
 const [busy,setBusy]=useState(false);
 const [problem,setProblem]=useState('');
 const [filter,setFilter]=useState<Filter>('all');
 const pulse=useRef(new Animated.Value(.55)).current;
 const refreshed=useRef(0);
 const requestId=useRef(0);
 useEffect(()=>{
  let live=true;
  const app=AppState.addEventListener('change',s=>setForeground(s==='active'));
  void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduceMotion(v);}).catch(()=>undefined);
  const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
  return()=>{live=false;app.remove();motion.remove();};
 },[]);
 useEffect(()=>{
  pulse.stopAnimation();
  if(!focused||!foreground||reduceMotion){pulse.setValue(.55);return;}
  const seq=Animated.loop(Animated.sequence([
   Animated.timing(pulse,{toValue:1,duration:1500,useNativeDriver:true}),
   Animated.timing(pulse,{toValue:.55,duration:1500,useNativeDriver:true}),
  ]));
  seq.start();return()=>{seq.stop();};
 },[pulse,focused,foreground,reduceMotion]);

 const load=useCallback(async()=>{
  if(!session?.user?.id)return;
  const id=++requestId.current;
  setBusy(true);setProblem('');
  const result=await Promise.allSettled([
   getBuklodCitySnapshot(),
   churchEnabled
    ?supabase.from('church_events')
      .select('id,title,event_type,starts_at,ends_at,location,is_cancelled,requires_rsvp')
      .eq('is_cancelled',false)
      .gte('starts_at',new Date(Date.now()-7*86400000).toISOString())
      .order('starts_at',{ascending:true}).limit(25)
    :Promise.resolve({data:[],error:null}),
  ]);
  if(id!==requestId.current)return;
  const joined:SpecialEventItem[]=[];
  let failed=0;
  if(result[0].status==='fulfilled'){
   for(const point of result[0].value.items.filter(p=>p.kind==='EVENT').slice(0,40)){
    if(!showFaith&&point.category==='faith')continue;
    if(point.status&&['CANCELLED','DELETED','INACTIVE'].includes(point.status.toUpperCase()))continue;
    joined.push({
     key:'city:'+point.id,id:point.id,
     title:safeEventLabel(point.title,120),description:safeEventLabel(point.description,180),
     category:safeEventLabel(point.category,40)||'Community',
     startsAt:point.startsAt??null,endsAt:point.endsAt??null,
     location:safeEventLabel(point.locality,90),source:'city',route:null,
     verified:point.verified===true,
    });
   }
  }else failed++;
  if(result[1].status==='fulfilled'&&!result[1].value.error){
   for(const row of result[1].value.data??[]){
    joined.push({
     key:'church:'+row.id,id:row.id,title:safeEventLabel(row.title,120),
     description:null,category:safeEventLabel(row.event_type,40)||'Church Event',
     startsAt:row.starts_at??null,endsAt:row.ends_at??null,
     location:safeEventLabel(row.location,90),source:'church',
     route:'/church/event/'+row.id,verified:false,requiresRsvp:row.requires_rsvp===true,
    });
   }
  }else failed++;
  const now=Date.now();
  setEvents(previous=>failed===2?previous:normalizeSpecialEventRows(joined,now));
  setProblem(failed?'Hindi ma-load ang lahat ng event sources. I-refresh para subukan muli.':'');
  setBusy(false);refreshed.current=Date.now();
 },[session?.user?.id,showFaith,churchEnabled]);
 useFocusEffect(useCallback(()=>{
  setFocused(true);
  if(Date.now()-refreshed.current>60000)void load();
  return()=>{setFocused(false);requestId.current++;};
 },[load]));
 useEffect(()=>{setEvents([]);refreshed.current=0;},[session?.user?.id,showFaith]);
 if(!isGenesisPreviewBuild())return <Redirect href="/(tabs)/buklod"/>;
 if(authLoading&&!session)return <View style={s.page}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;
 const now=Date.now();
 const displayed=events.filter(e=>{
  const status=deriveSpecialEventState(e,now);
  return filter==='all'||filter==='programs'||filter===status;
 });
 const liveCount=events.filter(e=>deriveSpecialEventState(e,now)==='live').length;
 const programs=PROGRAMS.filter(p=>!('faithOnly' in p)||showFaith);
 return <View style={s.page}>
  <BuklodMapHeader/>
  <ScrollView style={{flex:1}} contentContainerStyle={s.content}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>void load()} tintColor="#F2DCA5"/>}
    showsVerticalScrollIndicator={false}>
   <View style={s.hero}>
    <ExpoImage source={require('../../../assets/season2/genesis/world/buklod-community-map-compact.webp')}
      contentFit="cover" style={StyleSheet.absoluteFillObject}/>
    <LinearGradient colors={['rgba(4,22,31,.35)','rgba(5,24,35,.82)','rgba(5,20,34,.96)']}
      style={StyleSheet.absoluteFillObject}/>
    <Animated.View pointerEvents="none" style={[s.star,{opacity:pulse,transform:[{scale:pulse.interpolate({inputRange:[.55,1],outputRange:[.9,1.12]})}]}]}>
      <MaterialCommunityIcons name="star-four-points" color="#FFEEB6" size={48}/>
    </Animated.View>
    <View style={s.heroCopy}>
     <MaterialCommunityIcons name="star-circle" size={32} color="#FFE0A0"/>
     <Text style={s.heroTitle}>Special Events</Text>
     <Text style={s.heroSub}>Mga programa, hamon at bagong karanasan sa BUKLOD.</Text>
     <Text style={s.heroProof}>{liveCount>0?liveCount+' live event'+(liveCount>1?'s':''):'Makilahok sa mga tunay na naka-schedule na event'}</Text>
    </View>
   </View>
   <View style={s.filters}>{FILTERS.map(f=><Pressable key={f.id} accessibilityRole="button"
      accessibilityState={{selected:filter===f.id}} onPress={()=>setFilter(f.id)}
      style={[s.filter,filter===f.id&&s.filterOn]}>
      <Text style={[s.filterText,filter===f.id&&s.filterTextOn]}>{f.label}</Text>
   </Pressable>)}</View>
   <BuklodHomeCheckinToday/>
   {filter!=='programs'?<View style={s.section}>
    <Text style={s.sectionTitle}>Tunay na Events</Text>
    <Text style={s.hint}>Mga visible na anunsiyo mula sa authorized BUKLOD sources. RSVP at check-in ay sa original verified event flow lamang. Walang BP o Diamonds sa simpleng pagbisita sa event page.</Text>
    {busy&&events.length===0?<ActivityIndicator color="#F5DEA5"/>:null}
    {!!problem?<Text accessibilityRole="alert" style={s.error}>{problem}</Text>:null}
    {displayed.map(event=>{
     const phase:SpecialEventState=deriveSpecialEventState(event,now);
     return <View key={event.key} style={s.event}>
      <View style={s.eventHead}>
       <MaterialCommunityIcons name={phase==='live'?'broadcast':'calendar-star'} color="#FFE2AA" size={23}/>
       <Text style={s.eventType}>{event.category}</Text>
       <Text style={[s.state,phase==='live'&&s.stateLive]}>
        {phase==='live'?'LIVE':phase==='upcoming'?'PAPARATING':phase==='ended'?'TAPOS NA':'SCHEDULE CHECK'}
       </Text>
      </View>
      <Text style={s.eventName}>{event.title}</Text>
      {event.startsAt?<Text style={s.eventMeta}>
       <MaterialCommunityIcons name="calendar-clock" color="#BEDCCF" size={15}/> {' '}
       {new Date(event.startsAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})}
      </Text>:null}
      {!!event.location?<Text style={s.eventMeta}>{event.location}</Text>:null}
      {!!event.description?<Text style={s.eventDescription}>{event.description}</Text>:null}
      {event.route?<Pressable accessibilityRole="button" accessibilityLabel={'RSVP / event details: '+event.title}
       onPress={()=>router.push(event.route as any)} style={s.eventAction}>
       <Text style={s.eventActionText}>{event.requiresRsvp?'Detalye / RSVP':'Detalye ng Event'}</Text>
       <MaterialCommunityIcons name="arrow-right" color="#FFEECC" size={18}/>
      </Pressable>:<Text style={s.eventFootnote}>Community announcement · hindi pa available ang in-app RSVP link</Text>}
     </View>;
    })}
    {!busy&&displayed.length===0?<Text style={s.empty}>
      Walang kumpirmadong event sa kategoryang ito ngayon. Tingnan ang Mga Programa o mag-refresh.
     </Text>:null}
   </View>:null}
   <View style={s.section}>
    <Text style={s.sectionTitle}>Mga Programa</Text>
    <Text style={s.hint}>Mga tunay na feature na maaaring mag-host ng activity. Hindi nangangahulugang may aktibong event sa lahat.</Text>
    {programs.map(item=><Pressable key={item.id} accessibilityRole="button"
      accessibilityLabel={'Open '+item.label} onPress={()=>router.push(item.route as any)}
      style={({pressed})=>[s.program,pressed&&s.pressed]}>
      <MaterialCommunityIcons name={item.icon as any} size={23} color="#FFDC91"/>
      <View style={{flex:1,minWidth:0}}>
       <Text style={s.programName}>{item.label}</Text>
       <Text style={s.programDesc}>{item.description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#CDE6D4"/>
    </Pressable>)}
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Return to BUKLOD World Map"
    onPress={()=>router.push('/buklod-map' as any)} style={s.back}>
    <MaterialCommunityIcons name="map-outline" size={18} color="#FFE8AD"/>
    <Text style={s.backText}>Bumalik sa BUKLOD Map</Text>
   </Pressable>
  </ScrollView>
 </View>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#071729'},content:{paddingHorizontal:11,paddingTop:8,paddingBottom:30,gap:11},
 hero:{minHeight:230,borderRadius:19,overflow:'hidden',justifyContent:'flex-end',
   backgroundColor:'#154437',borderColor:'#E2C98A',borderWidth:1},
 star:{position:'absolute',right:16,top:18},
 heroCopy:{padding:17,gap:6},heroTitle:{color:'#FFE2A3',fontSize:27,fontWeight:'900'},
 heroSub:{fontSize:12,color:'#F1F8EF',lineHeight:18},
 heroProof:{fontSize:11,fontWeight:'800',color:'#BCEED6',marginTop:3},
 filters:{flexDirection:'row',gap:6},filter:{flex:1,alignItems:'center',justifyContent:'center',
   paddingVertical:10,minHeight:44,borderRadius:14,borderColor:'#496C67',borderWidth:1,
   backgroundColor:'#123037'},
 filterOn:{backgroundColor:'#315A42',borderColor:'#EED394'},
 filterText:{color:'#D2E6E0',fontSize:11,fontWeight:'800'},
 filterTextOn:{color:'#FFE9B8'},
 section:{gap:8,backgroundColor:'#0D2931',borderRadius:16,padding:11,borderWidth:1,
   borderColor:'#3B5B50'},
 sectionTitle:{fontSize:18,fontWeight:'900',color:'#FFDE9B'},
 hint:{fontSize:11,lineHeight:16,color:'#C9DED9'},
 event:{gap:6,padding:11,backgroundColor:'#163B3C',borderRadius:13,
   borderWidth:1,borderColor:'#56796A'},
 eventHead:{flexDirection:'row',alignItems:'center',gap:7},
 eventType:{fontSize:11,fontWeight:'900',color:'#D7EDC5',flex:1},
 state:{fontSize:9,fontWeight:'900',color:'#D3DDB2',padding:5,borderRadius:8,
   backgroundColor:'#28464A'},stateLive:{backgroundColor:'#0D7D54',color:'#FFFFFF'},
 eventName:{fontSize:15,fontWeight:'900',color:'#FFF5DC'},
 eventMeta:{fontSize:11,color:'#D0E3DB'},
 eventDescription:{fontSize:11,lineHeight:16,color:'#D8EAE5'},
 eventAction:{alignSelf:'flex-start',minHeight:44,backgroundColor:'#21654B',borderRadius:11,
   flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:14,marginTop:4},
 eventActionText:{color:'#FFF0D2',fontWeight:'900',fontSize:12},
 eventFootnote:{fontSize:10,color:'#B2CBC4',marginTop:4},
 empty:{fontSize:12,color:'#D9E5DD',padding:12,backgroundColor:'#173A41',borderRadius:10},
 error:{fontSize:11,color:'#FFE5A0',padding:8},
 program:{minHeight:67,padding:10,flexDirection:'row',gap:10,alignItems:'center',
   backgroundColor:'#1A3A3B',borderRadius:13,borderWidth:1,borderColor:'#50766C'},
 programName:{fontSize:13,fontWeight:'900',color:'#FFE5A8'},
 programDesc:{fontSize:11,lineHeight:15,color:'#D0E3D6',marginTop:2},
 pressed:{opacity:.75},back:{minHeight:45,backgroundColor:'#174D45',borderRadius:12,
   flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
 backText:{color:'#FFE7AF',fontWeight:'900'},
});
