import BuklodPressable from '@/components/BuklodPressable';
import ClusterNotificationActions from '@/components/ClusterNotificationActions';
import { buklodInstantPush } from '@/lib/buklodInstantNavigation';
import { runClusterJoinNotificationAction } from '@/lib/clusterJoinNotificationAction';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {Alert,FlatList,StyleSheet,Text,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {supabase} from '@/lib/supabase';
import {Card,useThemedShared} from '@/components/UI';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';
import { useBuklodScrollBottomInset } from '@/lib/buklodSafeArea';
import {useAuth} from '@/providers/AuthProvider';
import {useNotifications} from '@/providers/NotificationProvider';
import {useBuklodScope} from '@/providers/BuklodScopeProvider';
import { FAITH_NOTIFICATION_PATTERNS, isFaithNotificationKind } from '@/lib/buklodFaithNotificationPolicy';
import { syncScopeSelection } from '@/lib/buklodScopeRoute';
import { resolveBuklodNotificationTarget } from '@/lib/buklodNotificationNavigation';
import { resolveMzbOrganizationScopeId } from '@/lib/buklodMzbOrganization';

export default function NotificationCenter(){
 const insets = useSafeAreaInsets();
 const {theme,paletteId} = useBuklodTheme();
 const themedShared = useThemedShared();
 const isDark = paletteId==='nightPine'||paletteId==='graphite'||paletteId==='midnight';
 const scrollBottomInset = useBuklodScrollBottomInset({ extra: 16 });
 const {user}=useAuth();
 const {scopes,selectScope,activeScope}=useBuklodScope();
 const {unreadCount,refreshUnread,markAllRead}=useNotifications();
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(false),[busyId,setBusyId]=useState<string|null>(null);
 const [markingAll,setMarkingAll]=useState(false);
 const faithEnabled=activeScope?.show_faith_content===true;
 // Foreground notifications update the shared unread count. Refresh the visible
 // list on a new count or screen focus, without adding a Postgres CDC channel.
 // This does not touch PTT, call, push handling, or background audio.
 const notificationsFocused=useRef(false);
 const lastUnreadCount=useRef(unreadCount);
 const load=useCallback(async()=>{if(!user?.id)return;setLoading(true);
  let query=supabase.from('notifications').select('id,title,body,kind,data,read_at,created_at').eq('user_id',user.id).neq('kind','ptt_incoming');
  if(!faithEnabled){for(const pattern of FAITH_NOTIFICATION_PATTERNS){query=query.not('kind','ilike',pattern)}}
  const {data,error}=await query.order('created_at',{ascending:false}).limit(150);
  if(error){setLoading(false);return Alert.alert('Notifications',error.message);}
  let displayed=data??[];

  // Historical notification bodies say only "Daily Devotion needs improvement".
  // Resolve titles against the MEMBER'S OWN canonical submissions, so two
  // pending revisions cannot be confused. This is a read-only enhancement;
  // nothing rewrites history and the DB's own-user RLS remains authoritative.
  const ids=Array.from(new Set(displayed
    .filter(n=>['formation_needs_improvement','formation_approved'].includes(n.kind)
      && n.data?.item_kind==='DAILY_DEVOTION' && typeof n.data?.item_id==='string')
    .map(n=>String(n.data.item_id)))).slice(0,150);
  if(ids.length){
    try{
      const {data:mine,error:detailsError}=await supabase
        .from('devotional_reward_submissions')
        .select('id,devotional_title_snapshot,status,admin_note')
        .eq('user_id',user.id).in('id',ids);
      if(!detailsError&&mine){
        const byId=new Map(mine.map(sub=>[sub.id,sub]));
        displayed=displayed.map(n=>{
          const sub=byId.get(String(n.data?.item_id??''));
          if(!sub)return n;
          const title=String(sub.devotional_title_snapshot??'').trim()||'Daily Devotion';
          if(sub.status==='rejected')return {
            ...n,
            title:'Revision needed — '+title,
            body:String(sub.admin_note??'').trim()||n.body,
          };
          if(sub.status==='approved')return {
            ...n,
            title:'Approved — '+title,
            body:'This devotional is now approved. Open it to see the current status.',
          };
          return {...n,title:'Under review — '+title,
            body:'Your devotional was resubmitted and is being checked.'};
        });
      }
    }catch{/* Keep the original alert if the detail request fails. */}
  }
  setItems(displayed);
  setLoading(false);
  await refreshUnread();
 },[user?.id,refreshUnread,faithEnabled]);
 useFocusEffect(useCallback(()=>{
  notificationsFocused.current=true;
  void load();
  return ()=>{notificationsFocused.current=false};
 },[load]));
 useEffect(()=>{
  if(lastUnreadCount.current===unreadCount)return;
  lastUnreadCount.current=unreadCount;
  if(notificationsFocused.current)void load();
 },[unreadCount,load]);
 const open=async(x:any)=>{
  const kind=String(x?.kind??'');
  if(!faithEnabled && isFaithNotificationKind(kind))return;
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
 const markAll=async()=>{
  if(markingAll)return;
  setMarkingAll(true);
  try{
   await markAllRead();
   await load();
  }catch(e:any){
   Alert.alert('Notifications',e?.message||'Could not mark as read.');
  }finally{
   setMarkingAll(false);
  }
 };
 return (
  <View style={[themedShared.screen,{paddingTop:insets.top}]}>
   <StatusBar style={isDark?'light':'dark'}/>
   <FlatList
    contentContainerStyle={[s.content,{paddingBottom:scrollBottomInset}]}
    data={items}
    keyExtractor={item=>item.id}
    refreshing={loading}
    onRefresh={load}
    ItemSeparatorComponent={()=><View style={s.separator}/>}
    ListHeaderComponent={
     <View style={s.header}>
      <View style={s.heading}>
       <Text style={[s.headingTitle,{color:theme.textPrimary}]}>Notifications</Text>
       <Text style={[s.headingSub,{color:theme.textMuted}]}>{unreadCount} unread</Text>
      </View>
      {unreadCount>0&&(
       <BuklodPressable
        accessibilityRole="button"
        accessibilityLabel="Mark all notifications as read"
        accessibilityState={{disabled:markingAll}}
        disabled={markingAll}
        onPress={()=>void markAll()}
        style={[s.markRead,{backgroundColor:theme.accentSoft,borderColor:theme.border},markingAll&&s.disabled]}>
        <MaterialCommunityIcons name="check-all" size={20} color={theme.textPrimary}/>
        <Text style={[s.markReadText,{color:theme.textPrimary}]}>{markingAll?'Updating…':'Mark all read'}</Text>
       </BuklodPressable>
      )}
     </View>
    }
    ListEmptyComponent={
     <Card style={s.card}>
      <Text style={[s.body,{color:theme.textSecondary}]}>No notifications yet.</Text>
     </Card>
    }
    renderItem={({item})=>(
     <Card style={[s.card,{borderLeftWidth:item.read_at?1:3,borderLeftColor:item.read_at?theme.border:theme.accent}]}>
      <BuklodPressable accessibilityRole="button" accessibilityLabel={String(item.title??'Notification')} onPress={()=>open(item)} style={s.notificationPress}>
       <View style={s.row}>
        <View style={[s.dot,{backgroundColor:item.read_at?theme.border:theme.accent}]}/>
        <View style={s.message}>
         <Text style={[s.title,{color:theme.textPrimary,fontWeight:item.read_at?'700':'900'}]}>{item.title}</Text>
         <Text style={[s.body,{color:theme.textSecondary}]}>{item.body}</Text>
         <Text style={[s.time,{color:theme.textMuted}]}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted}/>
       </View>
      </BuklodPressable>
      <ClusterNotificationActions kind={String(item?.kind??'')} data={item?.data??null} busy={busyId===item.id} onAction={approve=>void decide(item,approve)}/>
     </Card>
    )}
   />
  </View>
 );

}
const s=StyleSheet.create({
 content:{paddingHorizontal:16,paddingTop:10},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12},
 heading:{flex:1,minWidth:0},
 headingTitle:{fontSize:24,lineHeight:29,fontWeight:'900'},
 headingSub:{fontSize:13,lineHeight:19,marginTop:1},
 markRead:{minHeight:44,paddingHorizontal:12,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},
 markReadText:{fontSize:12,fontWeight:'800'},
 separator:{height:8},
 card:{borderRadius:14,paddingHorizontal:13,paddingVertical:11},
 notificationPress:{minHeight:44,justifyContent:'center'},
 row:{flexDirection:'row',alignItems:'flex-start',gap:10},
 dot:{width:9,height:9,borderRadius:5,marginTop:5},
 message:{flex:1,minWidth:0},
 title:{fontSize:15,lineHeight:20},
 body:{fontSize:13,lineHeight:19,marginTop:4},
 time:{fontSize:11,lineHeight:15,marginTop:6},
 disabled:{opacity:0.55},
});
