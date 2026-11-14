import React,{useCallback,useState} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';
import {supabase} from '@/lib/supabase';

type Activity={id:string;description:string|null;activity_type:string|null;points:number|null;created_at:string|null};
const reportRoutes=[
 {key:'bible',title:'My Bible reading report',route:'/bible/report',icon:'book-open-page-variant-outline' as const},
 {key:'mentoring',title:'My mentoring submissions',route:'/faith/mentor-evidence',icon:'account-heart-outline' as const},
 {key:'contributions',title:'My contribution reports',route:'/scope-fund',icon:'hand-heart-outline' as const},
 {key:'classroom',title:'Classroom work and submissions',route:'/profile/buklod-classrooms',icon:'school-outline' as const},
];
const titleFor=(row:Activity)=>String(row.description||row.activity_type||'Recorded activity').replace(/[_-]+/g,' ').trim();
const dateFor=(value:string|null)=>{
 const t=value?Date.parse(value):NaN;
 return Number.isFinite(t)?new Date(t).toLocaleDateString('en-PH'):'';
};
export default function BuklodProfileActivityCards({userId}:{userId:string}){
 const {user}=useAuth();const viewerId=user?.id??null;const {theme}=useBuklodTheme();
 const [activities,setActivities]=useState<Activity[]>([]);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 useFocusEffect(useCallback(()=>{
  let active=true;setActivities([]);
  if(!viewerId||viewerId!==userId){setStatus('ready');return ()=>{active=false;};}
  setStatus('loading');
  void Promise.resolve(supabase.from('buklod_points_ledger')
   .select('id,description,activity_type,points,created_at')
   .eq('user_id',viewerId).eq('direction','credit')
   .order('created_at',{ascending:false}).limit(4))
   .then(({data,error})=>{
    if(!active)return;
    if(error){setStatus('error');return;}
    setActivities(Array.isArray(data)?data as Activity[]:[]);
    setStatus('ready');
   }).catch(()=>{if(active)setStatus('error');});
  return ()=>{active=false;};
 },[viewerId,userId]));
 if(!viewerId||viewerId!==userId)return null;
 return <View style={{marginHorizontal:12,marginTop:12,gap:9}}>
  <Text allowFontScaling style={{color:theme.textPrimary,fontSize:16,fontWeight:'900'}}>MY ACTIVITY & REPORTS</Text>
  <View style={{borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSurface,borderRadius:16,padding:12,gap:9}}>
   {(status!=='ready'||activities.length>0)?<Text allowFontScaling style={{color:theme.textPrimary,fontSize:14,fontWeight:'800'}}>Recent recorded activity</Text>:null}
   {status==='loading'?<ActivityIndicator color={theme.accent}/>:null}
   {status==='error'?<Text allowFontScaling style={{color:theme.textMuted,fontSize:13}}>Activity could not be loaded. Your records were not changed.</Text>:null}
   {/* No fabricated activity or empty-state placeholder. */}
   {status==='ready'&&activities.map(row=><View key={row.id} style={{borderTopWidth:1,borderTopColor:theme.border,minHeight:44,paddingTop:8,flexDirection:'row',gap:8,alignItems:'center'}}>
    <View style={{flex:1,minWidth:0}}>
     <Text allowFontScaling numberOfLines={2} style={{color:theme.textPrimary,fontWeight:'700',fontSize:13.5}}>{titleFor(row)}</Text>
     <Text allowFontScaling style={{color:theme.textMuted,fontSize:12}}>{dateFor(row.created_at)}</Text>
    </View>
    {Number.isFinite(Number(row.points))&&Number(row.points)>0?<Text allowFontScaling style={{color:theme.accent,fontWeight:'800',fontSize:13}}>+{Math.trunc(Number(row.points))} pts</Text>:null}
   </View>)}
   {activities.length>0?<Pressable accessibilityRole="button" accessibilityLabel="See full personal Points record" onPress={()=>router.push('/points' as any)} style={{minHeight:44,justifyContent:'center'}}>
    <Text allowFontScaling style={{color:theme.accent,fontWeight:'800',fontSize:13}}>See full Points record</Text>
   </Pressable>:null}
  </View>
  <View style={{borderWidth:1,borderColor:theme.border,backgroundColor:theme.cardSurface,borderRadius:16,paddingHorizontal:12}}>
   {reportRoutes.map((report,index)=><Pressable key={report.key} accessibilityRole="button" accessibilityLabel={report.title}
    onPress={()=>router.push(report.route as any)}
    style={{minHeight:50,flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:index===0?0:1,borderTopColor:theme.border}}>
    <MaterialCommunityIcons name={report.icon} size={20} color={theme.accent}/>
    <Text allowFontScaling style={{flex:1,color:theme.textPrimary,fontSize:14,fontWeight:'700'}}>{report.title}</Text>
    <MaterialCommunityIcons name="chevron-right" size={19} color={theme.textMuted}/>
   </Pressable>)}
  </View>
  <Text allowFontScaling style={{color:theme.textMuted,fontSize:11}}>Private reports belong to the signed-in account. Recorded Points are not cash earnings.</Text>
 </View>;
}
