import {createContext,ReactNode,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {registerPushToken} from '@/lib/pushNotifications';

type Ctx={unreadCount:number;refreshUnread:()=>Promise<void>;markAllRead:()=>Promise<void>};
const Context=createContext<Ctx|undefined>(undefined);
/* PATCH_171C_PUSH_CHANNEL_V2 */
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true} as any)});

function pathFor(kind:string,data:any){
 if(data?.prayer_request_id)return `/prayer/${data.prayer_request_id}`;
 if(data?.prayer_id)return `/prayer/${data.prayer_id}`;
 if(data?.post_id&&['community_comment','community_reaction','community_mention','post_share_request','post_share_approved','post_share_declined'].includes(kind))return `/post/${data.post_id}`;
 if(kind==='direct_message'&&data?.conversation_id)return `/connect/${data.conversation_id}`;
 return '/notifications';
}

export function NotificationProvider({children}:{children:ReactNode}){
 const {user}=useAuth();const [unreadCount,setUnreadCount]=useState(0);
 useEffect(()=>{if(!user?.id)return;void registerPushToken(user.id).catch(e=>console.warn('BUKLOD push registration',e))},[user?.id]);
 const badge=useCallback(async(n:number)=>{try{await Notifications.setBadgeCountAsync(n)}catch(e){console.warn('Notification badge',e)}},[]);
 const refreshUnread=useCallback(async()=>{if(!user?.id){setUnreadCount(0);await badge(0);return}
  const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user.id).is('read_at',null);
  if(error){console.warn('Notification count',error.message);return}const n=count??0;setUnreadCount(n);await badge(n);
 },[user?.id,badge]);
 const markAllRead=useCallback(async()=>{if(!user?.id)return;const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);if(error)throw error;await refreshUnread()},[user?.id,refreshUnread]);

 useEffect(()=>{void (async()=>{try{if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('buklod-activity-v2',{
    name:'BUKLOD Activity Alerts',
    importance:Notifications.AndroidImportance.MAX,
    
    vibrationPattern:[0,250,250,250],
    enableVibrate:true,
    showBadge:true
});
  const p=await Notifications.getPermissionsAsync();if(p.status!=='granted')await Notifications.requestPermissionsAsync()}catch(e){console.warn('Notification permission',e)}})()},[]);
 useEffect(()=>{void refreshUnread()},[refreshUnread]);
 useEffect(()=>{if(!user?.id)return;const c=supabase.channel(`notifs:${user.id}`)
  /* PATCH_171C_REMOTE_PUSH_SINGLE_SOURCE
   Remote Expo push is the only user-visible notification source.
   Realtime only refreshes unread count. */
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},async()=>{await refreshUnread()})
.on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},()=>refreshUnread()).subscribe();
  return()=>{supabase.removeChannel(c)}},[user?.id,refreshUnread]);
 /* PATCH_171B_COLD_START_NOTIFICATION_RESPONSE */
 useEffect(()=>{
  let active=true;
  const handled=new Set<string>();

  const openResponse=(
   r:Notifications.NotificationResponse|null|undefined
  )=>{
   if(!active||!r)return;

   const requestId=
    r.notification.request.identifier||'unknown';

   const actionId=
    r.actionIdentifier||
    Notifications.DEFAULT_ACTION_IDENTIFIER;

   const key=`${requestId}:${actionId}`;

   if(handled.has(key))return;
   handled.add(key);

   const d:any=
    r.notification.request.content.data||{};

   router.push(
    pathFor(
     String(d.kind||'general'),
     d
    ) as any
   );
  };

  const initial=
   Notifications.getLastNotificationResponse();

  if(initial){
   openResponse(initial);
   Notifications.clearLastNotificationResponse();
  }

  const sub=
   Notifications.addNotificationResponseReceivedListener(
    r=>{
     openResponse(r);
     Notifications.clearLastNotificationResponse();
    }
   );

  return()=>{
   active=false;
   sub.remove();
  };
 },[]);
 const value=useMemo(()=>({unreadCount,refreshUnread,markAllRead}),[unreadCount,refreshUnread,markAllRead]);
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useNotifications(){const v=useContext(Context);if(!v)throw new Error('useNotifications must be used inside NotificationProvider');return v}

