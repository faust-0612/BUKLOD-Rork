import BuklodPressable from '@/components/BuklodPressable';
import { buklodInstantPush } from '@/lib/buklodInstantNavigation';
import {useCallback,useEffect,useState} from 'react';
import {Alert,FlatList,StyleSheet,Text,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {supabase} from '@/lib/supabase';
import {Button,Card,shared} from '@/components/UI';
import {colors} from '@/lib/theme';
import { useBuklodScrollBottomInset } from '@/lib/buklodSafeArea';
import {useAuth} from '@/providers/AuthProvider';
import {useNotifications} from '@/providers/NotificationProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import {
  buklodNotificationTarget,
  syncScopeSelection,
} from '@/lib/buklodScopeRoute';
import { buklodReportLandingPath } from '@/lib/buklodReportRoutes';
import { resolveMzbOrganizationScopeId } from '@/lib/buklodMzbOrganization';

export default function NotificationCenter(){
 const insets = useSafeAreaInsets();
 const scrollBottomInset = useBuklodScrollBottomInset({ extra: 16 });
 const {user}=useAuth();
 const {scopes,selectScope,activeScope}=useBuklodScope();
 const {unreadCount,refreshUnread,markAllRead}=useNotifications();
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(false);
 const load=useCallback(async()=>{if(!user?.id)return;setLoading(true);const {data,error}=await supabase.from('notifications').select('id,title,body,kind,data,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(150);setLoading(false);if(error)return Alert.alert('Notifications',error.message);setItems(data??[]);await refreshUnread()},[user?.id,refreshUnread]);
 useEffect(()=>{void load()},[load]);
 const open=async(x:any)=>{
  const kind=String(x?.kind??'');
  const data=x?.data??null;
  const reportScopeId=String(data?.scope_id??'').trim();
  const reportAssignmentId=String(data?.report_assignment_id??'').trim();

  let p:string|null=null;
  let targetScopeId:string|null=null;

  if(kind.startsWith('report_')&&reportScopeId&&reportAssignmentId){
   p=buklodReportLandingPath(reportScopeId,reportAssignmentId);
   targetScopeId=reportScopeId;
  }else{
   const mzbCanonicalScopeId=await resolveMzbOrganizationScopeId().catch(()=>null);
   const target=buklodNotificationTarget(kind,data,{scopes,mzbCanonicalScopeId});
   p=target?.path??null;
   targetScopeId=target?.scopeId??null;
  }

  if(p){
   if(targetScopeId){
    void syncScopeSelection(selectScope,targetScopeId,activeScope?.scope_id);
   }
   buklodInstantPush(p as any);
  }

  void (async()=>{
   if(!x.read_at){
    await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',x.id).eq('user_id',user?.id);
    await refreshUnread();
   }
   if(!p){
    await load();
   }
  })();
 };
 return <View style={[shared.screen,{paddingTop:insets.top}]}><FlatList contentContainerStyle={[s.content,{paddingBottom:scrollBottomInset}]} data={items} keyExtractor={x=>x.id} refreshing={loading} onRefresh={load}
 ListHeaderComponent={<View><View style={s.header}><View style={{flex:1}}><Text style={shared.h1}>Notifications</Text><Text style={shared.muted}>{unreadCount} unread</Text></View><View style={s.bell}><MaterialCommunityIcons name="bell-outline" size={23} color={colors.greenDark}/>{unreadCount>0&&<View style={s.badge}><Text style={s.badgeText}>{Math.min(unreadCount,99)}</Text></View>}</View></View>
 {unreadCount>0&&<Button title="MARK ALL AS READ" outline onPress={async()=>{try{await markAllRead();await load()}catch(e:any){Alert.alert('Notifications',e?.message||'Could not mark as read.')}}}/>}</View>}
 ListEmptyComponent={<Card><Text style={shared.muted}>No notifications yet.</Text></Card>}
 renderItem={({item})=><BuklodPressable instant onPress={()=>open(item)}><Card><View style={s.row}><View style={[s.dot,item.read_at&&s.dotRead]}/><View style={{flex:1}}><Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.body}</Text><Text style={s.time}>{new Date(item.created_at).toLocaleString()}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted}/></View></Card></BuklodPressable>}/></View>
}
const s=StyleSheet.create({content:{padding:16},header:{flexDirection:'row',alignItems:'center',marginBottom:10},bell:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},badge:{position:'absolute',top:-2,right:-2,minWidth:20,height:20,paddingHorizontal:5,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#B3261E'},badgeText:{color:colors.white,fontSize:8.5,fontWeight:'900'},row:{flexDirection:'row',alignItems:'flex-start',gap:9},dot:{width:9,height:9,borderRadius:5,marginTop:5,backgroundColor:colors.green},dotRead:{backgroundColor:colors.line},title:{fontSize:13,fontWeight:'900',color:colors.text},body:{marginTop:5,fontSize:12,lineHeight:18,color:colors.text},time:{marginTop:6,fontSize:9.5,color:colors.muted}});