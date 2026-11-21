/**
 * Genesis Special Events gateway.
 * Public entry; event visibility, RSVP, check-in, and reward authority remain
 * with their existing server-backed features. This page never awards BP.
 */
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Animated,AppState,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useFocusEffect,router} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Image as ExpoImage} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';

const LANDSCAPE=require('../../../assets/season2/genesis/kingdom/kingdom-nature-panorama.webp');
type EventRow={id:string;title:string;event_type:string;starts_at:string;ends_at:string|null;location:string|null;requires_rsvp:boolean|null};
type Icon=React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Category={id:string;title:string;description:string;icon:Icon;route:string;faith:boolean};
const CATEGORIES:readonly Category[]=[
 {id:'live',title:'Live Gatherings',description:'Tunay na event, RSVP at attendance',icon:'calendar-star',route:'/church',faith:false},
 {id:'challenges',title:'Bible Challenges',description:'Flash at monthly quiz challenges',icon:'book-open-page-variant-outline',route:'/faith/bible-events',faith:true},
 {id:'village',title:'Community Activities',description:'Mga gawain at proyekto ng komunidad',icon:'account-group-outline',route:'/season2/community-village',faith:false},
 {id:'kingdom',title:'Kingdom Games',description:'Mga laro at event sa Character Kingdom',icon:'castle',route:'/games',faith:false},
 {id:'arena',title:'Hero Arena',description:'Practice at competitive events kung available',icon:'shield-sword-outline',route:'/games/empire-arena',faith:false},
];
function fmt(date:string){const d=new Date(date);return Number.isFinite(d.getTime())?
 d.toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date unavailable';}
export default function GenesisSpecialEvents(){
 const {user}=useAuth();
 const {activeScope}=useBuklodScope();
 const insets=useSafeAreaInsets();
 const [events,setEvents]=useState<EventRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [reduceMotion,setReduceMotion]=useState(true);
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const [focused,setFocused]=useState(false);
 const sparkle=useRef(new Animated.Value(0)).current;
 const live=useRef(false);
 const showFaith=Boolean(activeScope?.show_faith_content);
 useEffect(()=>{
   let mounted=true;
   void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(mounted)setReduceMotion(v);}).catch(()=>undefined);
   const a=AppState.addEventListener('change',s=>setForeground(s==='active'));
   return()=>{mounted=false;a.remove();};
 },[]);
 useEffect(()=>{
   sparkle.stopAnimation();
   if(reduceMotion||!foreground||!focused){sparkle.setValue(0);return;}
   const loop=Animated.loop(Animated.sequence([
     Animated.timing(sparkle,{toValue:1,duration:1750,useNativeDriver:true}),
     Animated.timing(sparkle,{toValue:0,duration:1750,useNativeDriver:true}),
   ]));
   loop.start();
   return()=>{loop.stop();sparkle.stopAnimation();};
 },[reduceMotion,foreground,focused,sparkle]);
 const refresh=useCallback(async()=>{
   if(!user){setEvents([]);setLoading(false);setError('Mag-sign in para makita ang mga event na available sa iyo.');return;}
   setLoading(true);setError('');
   try{
     const now=new Date().toISOString();
     // RLS owns visibility. No service role, global admin bypass, or synthetic events.
     const {data,error:queryError}=await supabase.from('church_events')
       .select('id,title,event_type,starts_at,ends_at,location,requires_rsvp')
       .eq('is_cancelled',false).gte('starts_at',now).order('starts_at',{ascending:true}).limit(12);
     if(queryError)throw queryError;
     if(live.current)setEvents((data||[]) as EventRow[]);
   }catch(e){if(live.current)setError('Hindi ma-load ang live events. Subukan muli kapag may koneksiyon.');}
   finally{if(live.current)setLoading(false);}
 },[user?.id]);
 useFocusEffect(useCallback(()=>{
   live.current=true;setFocused(true);void refresh();
   return()=>{live.current=false;setFocused(false);};
 },[refresh]));
 const categories=CATEGORIES.filter(c=>!c.faith||showFaith);
 return <ScrollView style={styles.page} contentContainerStyle={{paddingTop:Math.max(insets.top,10)+8,paddingBottom:Math.max(insets.bottom,14)+30}}>
   <View style={styles.heading}>
     <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD World" onPress={()=>router.back()} style={styles.back}>
       <MaterialCommunityIcons name="arrow-left" size={24} color="#F7E9C9"/>
     </Pressable>
     <View style={{flex:1}}><Text style={styles.eyebrow}>BUKLOD · GENESIS</Text><Text style={styles.title}>SPECIAL EVENTS</Text></View>
     <MaterialCommunityIcons name="star-four-points-circle-outline" size={28} color="#F5DC9A"/>
   </View>
   <View style={styles.hero}>
     <ExpoImage source={LANDSCAPE} contentFit="cover" style={StyleSheet.absoluteFillObject}/>
     <LinearGradient colors={['rgba(5,26,30,.10)','rgba(4,22,27,.93)']} style={StyleSheet.absoluteFillObject}/>
     <Animated.View pointerEvents="none" style={[styles.sparkle,{opacity:sparkle.interpolate({inputRange:[0,1],outputRange:[.22,.75]}),
       transform:[{scale:sparkle.interpolate({inputRange:[0,1],outputRange:[.92,1.12]})}]}]}>
       <MaterialCommunityIcons name="star-four-points" color="#FFE4A0" size={38}/>
     </Animated.View>
     <View style={styles.heroCopy}><Text style={styles.heroTitle}>Sama-sama sa bagong karanasan!</Text>
       <Text style={styles.heroSubtitle}>Tunay na mga pagtitipon, hamon, laro at community activities.</Text>
     </View>
   </View>
   <View style={styles.sectionHeader}><MaterialCommunityIcons name="calendar-clock" color="#EED49B" size={22}/>
     <Text style={styles.sectionTitle}>Mga paparating na event</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Refresh upcoming events" onPress={()=>void refresh()} style={styles.refresh}>
       <MaterialCommunityIcons name="refresh" size={21} color="#EED49B"/>
     </Pressable>
   </View>
   {loading?<ActivityIndicator color="#EED49B" accessibilityLabel="Loading events"/>:null}
   {!!error?<Text accessibilityRole="alert" style={styles.message}>{error}</Text>:null}
   {!loading&&!error&&!events.length?<View style={styles.empty}><MaterialCommunityIcons name="calendar-blank-outline" color="#EED49B" size={25}/>
     <Text style={styles.emptyText}>Wala pang naka-schedule na event na available sa iyo.</Text></View>:null}
   {events.map(e=><Pressable key={e.id} accessibilityRole="button" accessibilityLabel={'View event '+e.title}
     onPress={()=>router.push(('/church/event/'+encodeURIComponent(e.id)) as any)} style={({pressed})=>[styles.event,pressed&&{opacity:.7}]}>
     <View style={styles.eventIcon}><MaterialCommunityIcons name="calendar-star" size={22} color="#FFE6AE"/></View>
     <View style={{flex:1,minWidth:0}}><Text style={styles.eventTitle} numberOfLines={2}>{e.title}</Text>
       <Text style={styles.eventDetail}>{fmt(e.starts_at)}{e.location?' · '+e.location:''}</Text>
       {e.requires_rsvp?<Text style={styles.rsvp}>RSVP sa event details</Text>:null}
     </View>
     <MaterialCommunityIcons name="chevron-right" size={22} color="#EED49B"/>
   </Pressable>)}
   <View style={styles.sectionHeader}><MaterialCommunityIcons name="compass-rose" color="#EED49B" size={22}/>
     <Text style={styles.sectionTitle}>Tuklasin ang events</Text></View>
   <View style={styles.grid}>{categories.map(c=><Pressable key={c.id} accessibilityRole="button" accessibilityLabel={'Open '+c.title}
     onPress={()=>router.push(c.route as any)} style={({pressed})=>[styles.category,pressed&&{opacity:.7}]}>
     <View style={styles.categoryIcon}><MaterialCommunityIcons name={c.icon} size={27} color="#FFE0A3"/></View>
     <Text style={styles.categoryTitle}>{c.title}</Text>
     <Text style={styles.categoryText}>{c.description}</Text>
   </Pressable>)}</View>
   <Text style={styles.disclaimer}>Attendance, rankings, BP at rewards ay mula lamang sa verified server events. Walang automatic reward sa pagbisita sa page.</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:'#061C22',paddingHorizontal:13},
 heading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},
 back:{minHeight:44,minWidth:44,justifyContent:'center',alignItems:'center'},
 eyebrow:{fontSize:10,fontWeight:'900',color:'#B7E1C8',letterSpacing:1.4},
 title:{fontSize:23,fontWeight:'900',color:'#FFE2A7'},
 hero:{height:220,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'#B4A47D',marginBottom:15},
 sparkle:{position:'absolute',top:18,right:22},
 heroCopy:{position:'absolute',bottom:15,left:15,right:15,gap:4},
 heroTitle:{color:'#FFF4D9',fontSize:23,fontWeight:'900'},
 heroSubtitle:{color:'#E5F6E9',fontSize:12,lineHeight:17},
 sectionHeader:{flexDirection:'row',alignItems:'center',gap:8,marginTop:7,marginBottom:9},
 sectionTitle:{fontSize:17,fontWeight:'900',color:'#FBE3B2',flex:1},
 refresh:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
 message:{color:'#F6D4B5',fontSize:12,padding:12},
 empty:{flexDirection:'row',gap:9,alignItems:'center',backgroundColor:'#143B3C',borderRadius:12,padding:14,marginBottom:12},
 emptyText:{color:'#E5F2E8',fontSize:12,flex:1},
 event:{flexDirection:'row',gap:10,alignItems:'center',padding:12,marginBottom:8,borderRadius:13,
  backgroundColor:'#153E3B',borderColor:'#638B73',borderWidth:1},
 eventIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#275B4C',justifyContent:'center',alignItems:'center'},
 eventTitle:{color:'#FFFFFF',fontSize:14,fontWeight:'900'},
 eventDetail:{color:'#D5E8DD',fontSize:11,marginTop:4},
 rsvp:{color:'#FFE3AA',fontSize:10,marginTop:4,fontWeight:'800'},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:9},
 category:{width:'47%',flexGrow:1,minHeight:125,borderRadius:14,backgroundColor:'#153B37',
  borderWidth:1,borderColor:'#66886F',padding:12,gap:5},
 categoryIcon:{width:43,height:43,backgroundColor:'#2A5B48',borderRadius:13,alignItems:'center',justifyContent:'center'},
 categoryTitle:{fontSize:13,color:'#FDE5B5',fontWeight:'900'},
 categoryText:{fontSize:11,color:'#E0F0E5',lineHeight:15},
 disclaimer:{fontSize:10,color:'#9CC5B5',lineHeight:15,marginTop:15},
});
