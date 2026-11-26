/** Genesis ABaKa directory: original A–Z and open-ended, approved doctrinal series. */
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,FlatList,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Image as ExpoImage} from 'expo-image';
import {Redirect,router,useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/AuthProvider';
import {useNetwork} from '@/providers/NetworkProvider';
import {useCompliance} from '@/providers/ComplianceProvider';
import {useRuntimeConfig} from '@/providers/RuntimeConfigProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {supabase} from '@/lib/supabase';
import {getOfflineCache,setOfflineCache} from '@/lib/offlineCache';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
import {ABC_LESSONS,ABC_SOURCE,type AbcLesson} from '@/data/faith/abcLessons';
import {DOCTRINE_CATALOG_PAGE_SIZE,DOCTRINE_DAILY_REWARD_CAP,DOCTRINE_LABELS,
  loadPublishedDoctrinalLessons} from '@/data/faith/abcDoctrinalCatalog';

type ProgressRow={lesson_id:string;completed_at:string|null;points:number;claim_state:string|null};
const STUDY_COUNT=ABC_LESSONS.filter(x=>x.id!=='intro').length;

export default function BuklodAbakaDirectory(){
 const {session,loading,profile}=useAuth();
 const {online}=useNetwork();
 const {requiresAcceptance}=useCompliance();
 const {config}=useRuntimeConfig();
 const {activeScope}=useBuklodScope();
 const insets=useSafeAreaInsets();
 const accountId=session?.user?.id??'';
 const showFaith=Boolean(activeScope?.show_faith_content);
 const [progress,setProgress]=useState<Record<string,ProgressRow>>({});
 const [doctrine,setDoctrine]=useState<AbcLesson[]>([]);
 const [query,setQuery]=useState('');
 const [isAdmin,setIsAdmin]=useState(false);
 const [nextOffset,setNextOffset]=useState(0);
 const [hasMore,setHasMore]=useState(true);
 const [loadingMore,setLoadingMore]=useState(false);
 const currentRequest=useRef(0);
 const inFlight=useRef(false);

 useEffect(()=>{setProgress({});setDoctrine([]);setIsAdmin(false);setNextOffset(0);setHasMore(true);},[accountId]);

 useFocusEffect(useCallback(()=>{
   let active=true;
   if(!accountId||!showFaith||!isGenesisPreviewBuild())return()=>{active=false;};
   void getOfflineCache<ProgressRow[]>('faith-abc-progress:v1',{
     userId:accountId,allowStale:true,
   }).then(cache=>{
     if(!active||!Array.isArray(cache?.data))return;
     const mapped:Record<string,ProgressRow>={};
     for(const row of cache.data)if(row.lesson_id)mapped[row.lesson_id]=row;
     setProgress(mapped);
   }).catch(()=>undefined);
   if(online){
     void (async()=>{
       try{
         const {data,error}=await (supabase as any).rpc('get_my_abc_growth_progress_v1');
         if(error||!Array.isArray(data)||!active)return;
         const mapped:Record<string,ProgressRow>={};
         for(const row of data)if(row.lesson_id)mapped[row.lesson_id]=row;
         setProgress(mapped);
         void setOfflineCache('faith-abc-progress:v1',data,{userId:accountId,ttlMs:30*60*1000}).catch(()=>undefined);
       }catch{ /* Keep last confirmed account-scoped snapshot. */ }
     })();
     void (supabase as any).rpc('buklod_is_system_admin').then(({data,error}:any)=>{
       if(active&&!error)setIsAdmin(data===true);
     }).catch(()=>undefined);
   }
   return()=>{active=false;};
 },[accountId,online,showFaith]));

 useEffect(()=>{
   let active=true;
   const request=++currentRequest.current;
   inFlight.current=Boolean(online&&accountId&&showFaith);
   setDoctrine([]);
   setNextOffset(0);
   setHasMore(true);
   setLoadingMore(Boolean(online&&accountId&&showFaith));
   if(!accountId||!showFaith||!isGenesisPreviewBuild())return()=>{active=false;};
   void getOfflineCache<AbcLesson[]>('faith-abc-doctrine-catalog:v1',{
     userId:accountId,allowStale:true,
   }).then(cached=>{
     const rows=cached?.data;
     if(active&&Array.isArray(rows)){
       setDoctrine(current=>current.length?current:rows);
     }
   }).catch(()=>undefined);
   if(online){
     void loadPublishedDoctrinalLessons(0).then(rows=>{
       if(!active||currentRequest.current!==request)return;
       setDoctrine(rows);setNextOffset(rows.length);
       setHasMore(rows.length===DOCTRINE_CATALOG_PAGE_SIZE);
       void setOfflineCache('faith-abc-doctrine-catalog:v1',rows,{
         userId:accountId,ttlMs:30*60*1000,
       }).catch(()=>undefined);
     }).catch(()=>{
       if(active&&currentRequest.current===request)setHasMore(false);
     }).finally(()=>{
       if(active&&currentRequest.current===request){
         inFlight.current=false;setLoadingMore(false);
       }
     });
   }
   return()=>{active=false;};
 },[accountId,online,showFaith]);

 const loadMore=useCallback(()=>{
   if(!online||!accountId||!showFaith||!hasMore||loadingMore||inFlight.current)return;
   const request=currentRequest.current;
   inFlight.current=true;setLoadingMore(true);
   void loadPublishedDoctrinalLessons(nextOffset).then(rows=>{
     if(request!==currentRequest.current)return;
     setDoctrine(current=>{
       const ids=new Set(current.map(item=>item.id));
       const updated=[...current,...rows.filter(row=>!ids.has(row.id))];
       void setOfflineCache('faith-abc-doctrine-catalog:v1',updated,{
         userId:accountId,ttlMs:30*60*1000,
       }).catch(()=>undefined);
       return updated;
     });
     setNextOffset(nextOffset+rows.length);
     setHasMore(rows.length===DOCTRINE_CATALOG_PAGE_SIZE);
   }).catch(()=>{
     if(request===currentRequest.current)setHasMore(false);
   }).finally(()=>{
     if(request===currentRequest.current){inFlight.current=false;setLoadingMore(false);}
   });
 },[accountId,hasMore,loadingMore,nextOffset,online,showFaith]);

 const lessons=useMemo(()=>{
   const all=[...ABC_LESSONS,...doctrine];
   const needle=query.trim().toLocaleLowerCase();
   return needle?all.filter(item=>
     [item.code,item.title,item.seriesTitle??'',item.difficulty??'']
       .join(' ').toLocaleLowerCase().includes(needle)
   ):all;
 },[doctrine,query]);

 const verified=Object.values(progress);
 const completedCount=verified.length;
 const claimed=verified.filter(row=>row.claim_state==='claimed'||row.claim_state==='legacy')
   .reduce((n,row)=>n+Number(row.points??0),0);
 const ready=verified.filter(row=>row.claim_state==='pending')
   .reduce((n,row)=>n+Number(row.points??0),0);

 const openLesson=(item:AbcLesson)=>{
   if(item.prerequisiteId&&!progress[item.prerequisiteId])return;
   router.push(('/faith/abc/'+encodeURIComponent(item.id)) as any);
 };

 if(!isGenesisPreviewBuild())return <Redirect href="/(tabs)/buklod"/>;
 if(loading&&!session)return <View style={styles.page}/>;
 if(!session)return <Redirect href="/(auth)/login"/>;
 if(config?.maintenance_mode)return <Redirect href="/system/maintenance"/>;
 if(config?.update_required)return <Redirect href="/system/update-required"/>;
 if(config?.pilot_access_required&&!config?.pilot_access_granted)return <Redirect href="/system/pilot-access"/>;
 if(requiresAcceptance)return <Redirect href="/privacy/consent"/>;
 if(!profile)return <Redirect href="/onboarding"/>;

 return <FlatList style={styles.page}
   contentContainerStyle={[styles.content,{
     paddingTop:Math.max(insets.top,12)+8,paddingBottom:Math.max(insets.bottom,16)+20,
   }]}
   keyboardShouldPersistTaps="handled"
   data={showFaith?lessons:[]}
   keyExtractor={item=>item.id}
   initialNumToRender={12} windowSize={8} maxToRenderPerBatch={12}
   onEndReached={showFaith&&!query?loadMore:undefined}
   onEndReachedThreshold={0.4}
   ListHeaderComponent={<>
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
       <Text style={styles.subtitle}>A–Z foundation at patuloy na orihinal na doctrinal series</Text>
     </View>
     {!showFaith?<View style={styles.off}>
       <Text style={styles.offText}>Naka-off ang Show Faith. Maaaring i-explore ang ibang learning paths sa BUKLOD Learnings.</Text>
       <Pressable accessibilityRole="button" accessibilityLabel="Open faith-neutral Learnings"
         onPress={()=>router.push('/season2/learnings' as any)}>
         <Text style={styles.learnLink}>Buksan ang Learnings →</Text>
       </Pressable>
     </View>:<>
       <View style={styles.progress}>
         <MaterialCommunityIcons name="book-check-outline" color="#F5D497" size={24}/>
         <View style={{flex:1}}>
           <Text style={styles.metricTitle}>Study progress · {completedCount} completed</Text>
           <Text style={styles.metric}>Foundation {STUDY_COUNT} lessons · {claimed} BP claimed · {ready} BP ready to claim</Text>
         </View>
       </View>
       <View style={styles.points}>
         <Text style={styles.metricTitle}>Difficulty-based BUKLOD Points</Text>
         <Text style={styles.metric}>Foundation +8 · Intermediate +12 · Advanced +18 · Deep Study +25</Text>
         <Text style={styles.metric}>Continuing doctrine: {DOCTRINE_DAILY_REWARD_CAP} BP daily reward limit; pag-aaral ay tuloy-tuloy.</Text>
       </View>
       {isAdmin&&<Pressable accessibilityRole="button" style={styles.admin}
         onPress={()=>router.push('/faith/abc/admin' as any)}>
         <MaterialCommunityIcons name="book-open-page-variant-outline" size={20} color="#FFE5A4"/>
         <Text style={styles.adminText}>Admin Doctrinal Studio · Create / Review / Publish</Text>
       </Pressable>}
       <View style={styles.search}>
         <MaterialCommunityIcons name="magnify" size={20} color="#D3E1D7"/>
         <TextInput accessibilityLabel="Search ABaKa foundation and doctrinal lessons"
           placeholder="Search doctrines, series, lessons..." placeholderTextColor="#AFC9BE"
           value={query} onChangeText={setQuery} style={styles.searchInput}/>
         {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>setQuery('')}>
           <MaterialCommunityIcons name="close-circle" size={20} color="#D3E1D7"/>
         </Pressable>}
       </View>
     </>}
   </>}
   renderItem={({item})=>{
     const entry=progress[item.id];
     const locked=Boolean(item.prerequisiteId&&!progress[item.prerequisiteId]);
     return <Pressable accessibilityRole="button" key={item.id}
       accessibilityLabel={(locked?'Locked':'Open')+' ABaKa '+item.code+': '+item.title}
       accessibilityState={{disabled:locked}} onPress={()=>openLesson(item)}
       style={({pressed})=>[styles.item,pressed&&!locked&&styles.pressed,locked&&styles.locked]}>
       <View style={styles.letter}>
         <Text style={styles.letterText}>{item.code}</Text>
       </View>
       <View style={{flex:1,minWidth:0}}>
         <Text style={styles.lessonTitle}>{item.title}</Text>
         <Text style={styles.lessonHint}>
           {locked?'Tapusin muna ang naunang lesson':
             item.seriesTitle
              ? item.seriesTitle+' · '+DOCTRINE_LABELS[item.difficulty??'foundation']
              : 'A–Z Sunday School · Bible-based study'}
         </Text>
       </View>
       {item.id!=='intro'&&<Text style={styles.earned}>
         {entry?entry.claim_state==='pending'?('+'+entry.points+' READY'):('+'+entry.points+' ✓')
           :('+'+(item.rewardPoints??8)+' BP')}
       </Text>}
       <MaterialCommunityIcons name={locked?'lock-outline':entry?'check-circle':'chevron-right'}
         color={locked?'#C0C9C0':'#FFE1A7'} size={21}/>
     </Pressable>;
   }}
   ItemSeparatorComponent={()=><View style={{height:6}}/>}
   ListFooterComponent={<>
     {loadingMore&&<ActivityIndicator color="#F9D797" style={{marginVertical:15}}/>}
     <Text style={styles.note}>Manual claim ng verified BUKLOD Points ang nananatili. Ang completed lessons ay hindi na magkakaroon ng ikalawang reward. {doctrine.length?doctrine.length+' continuing lessons loaded.':'Ang bagong doctrine ay lalabas matapos ma-publish sa staging backend.'}</Text>
   </>}
 />;
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
 progress:{flexDirection:'row',alignItems:'center',gap:10,padding:12,
  backgroundColor:'#183D3B',borderRadius:10},
 points:{padding:12,backgroundColor:'#30483B',borderRadius:10,gap:4},
 metricTitle:{fontSize:12,fontWeight:'900',color:'#FFE4A4'},
 metric:{fontSize:11,lineHeight:16,color:'#E3E6CE'},
 admin:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,
  borderWidth:1,borderColor:'#8CA476',backgroundColor:'#275A44',borderRadius:10},
 adminText:{flex:1,fontSize:12,fontWeight:'800',color:'#FFE9B5'},
 search:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#1D4545',
  minHeight:46,borderRadius:10,paddingHorizontal:10},
 searchInput:{flex:1,color:'#F6EEDD',fontSize:13,minHeight:43},
 item:{minHeight:68,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:11,
  borderRadius:11,borderColor:'#628878',borderWidth:1,backgroundColor:'#163B3B'},
 pressed:{opacity:.73},
 locked:{opacity:.6},
 letter:{minWidth:43,minHeight:43,maxWidth:72,paddingHorizontal:5,alignItems:'center',justifyContent:'center',
  borderRadius:10,backgroundColor:'#2B5D4A'},
 letterText:{fontSize:11,fontWeight:'900',color:'#FFE3AA',textAlign:'center'},
 lessonTitle:{fontSize:13,fontWeight:'800',color:'#FFF3D8'},
 lessonHint:{fontSize:10,color:'#C7DCD4',marginTop:3},
 earned:{fontSize:10,fontWeight:'900',color:'#F9DC9C'},
 note:{fontSize:10,color:'#B5CFC6',lineHeight:15,marginTop:10},
});
