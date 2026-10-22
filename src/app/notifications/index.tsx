import BuklodPressable from '@/components/BuklodPressable';
import ClusterNotificationActions from '@/components/ClusterNotificationActions';
import { buklodInstantPush } from '@/lib/buklodInstantNavigation';
import { runClusterJoinNotificationAction } from '@/lib/clusterJoinNotificationAction';
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
import { syncScopeSelection } from '@/lib/buklodScopeRoute';
import { resolveBuklodNotificationTarget } from '@/lib/buklodNotificationNavigation';
import { resolveMzbOrganizationScopeId } from '@/lib/buklodMzbOrganization';

export default function NotificationCenter(){
 const insets = useSafeAreaInsets();
 const scrollBottomInset = useBuklodScrollBottomInset({ extra: 16 });
 const {user}=useAuth();
 const {scopes,selectScope,activeScope}=useBuklodScope();
 const {unreadCount,refreshUnread,markAllRead}=useNotifications();
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(false),[busyId,setBusyId]=useState<string|null>(null);
 const load=useCallback(async()=>{if(!user?.id)return;setLoading(true);const {data,error}=await supabase.from('notifications').select('id,title,body,kind,data,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(150);setLoading(false);if(error)return Alert.alert('Notifications',error.message);setItems(data??[]);await refreshUnread()},[user?.id,refreshUnread]);
 useEffect(()=>{void load()},[load]);
 const open=async(x:any)=>{
  const kind=String(x?.kind??'');
  const data=(x?.data??null) as Record<string,unknown>|null;
  const mzbCanonicalScopeId=await resolveMzbOrganizationScopeId().catch(()=>null);
  const target=resolveBuklodNotificationTarget(kind,data,{scopes,mzbCanonicalScopeId});
  const p=target?.path??null;

  if(!x.read_at){
   const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',x.id).eq('user_id',user?.id);
   if(!error){
    setItems(current=>current.map(item=>item.id===x.id?{...item,read_at:new Date().toISOString()}:item));
    await refreshUnread();
   }
  }

  if(p){
   if(target?.scopeId){
    await syncScopeSelection(selectScope,target.scopeId,activeScope?.scope_id);
   }
   buklodInstantPush(p as any);
   return;
  }

  Alert.alert('Notification','This notification does not have a destination yet.');
 };
 const decide=async(item:any,approve:boolean)=>{
  setBusyId(item.id);
  try{
   await runClusterJoinNotificationAction({kind:String(item?.kind??''),data:item?.data??null,approve});
   const resolved=approve?'APPROVED':'DECLINED';
   setItems(current=>current.map(row=>row.id===item.id?{...row,read_at:row.read_at??new Date().toISOString(),data:{...(row.data??{}),resolved}}:row));
   await refreshUnread();
  }catch(error:any){
   Alert.alert('Cluster',error?.message||'Could not update this request.');
  }finally{
   setBusyId(null);
  }
 };
 return <View style={[shared.screen,{paddingTop:insets.top}]}><FlatList contentContainerStyle={[s.content,{paddingBottom:scrollBottomInset}]} data={items} keyExtractor={x=>x.id} refreshing={loading} onRefresh={load}
 ListHeaderComponent={<View><View style={s.header}><View style={{flex:1}}><Text style={shared.h1}>Notifications</Text><Text style={shared.muted}>{unreadCount} unread</Text></View><View style={s.bell}><MaterialCommunityIcons name="bell-outline" size={23} color={colors.greenDark}/>{unreadCount>0&&<View style={s.badge}><Text style={s.badgeText}>{Math.min(unreadCount,99)}</Text></View>}</View></View>
 {unreadCount>0&&<Button title="MARK ALL AS READ" outline onPress={async()=>{try{await markAllRead();await load()}catch(e:any){Alert.alert('Notifications',e?.message||'Could not mark as read.')}}}/>}</View>}
 ListEmptyComponent={<Card><Text style={shared.muted}>No notifications yet.</Text></Card>}
 renderItem={({item})=><Card><BuklodPressable onPress={()=>open(item)}><View style={s.row}><View style={[s.dot,item.read_at&&s.dotRead]}/><View style={{flex:1}}><Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.body}</Text><Text style={s.time}>{new Date(item.created_at).toLocaleString()}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted}/></View></BuklodPressable><ClusterNotificationActions kind={String(item?.kind??'')} data={item?.data??null} busy={busyId===item.id} onAction={approve=>void decide(item,approve)}/></Card>}/></View>
}
const s=StyleSheet.create({content:{padding:16},header:{flexDirection:'row',alignItems:'center',marginBottom:10},bell:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:colors.greenSoft},badge:{position:'absolute',top:-2,right:-2,minWidth:20,height:20,paddingHorizontal:5,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#B3261E'},badgeText:{color:colors.white,fontSize:8.5,fontWeight:'900'},row:{flexDirection:'row',alignItems:'flex-start',gap:9},dot:{width:9,height:9,borderRadius:5,marginTop:5,backgroundColor:colors.green},dotRead:{backgroundColor:colors.line},title:{fontSize:13,fontWeight:'900',color:colors.text},body:{marginTop:5,fontSize:12,lineHeight:18,color:colors.text},time:{marginTop:6,fontSize:9.5,color:colors.muted}});